"""WebSocket manager for Theatarr real-time communication."""

import asyncio
import json
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect
from jose import JWTError, jwt

from theatarr.config import settings


class Channel(str, Enum):
    """WebSocket channel types."""

    SESSION = "session"
    WALLMOUNT = "wallmount"
    VOTE = "vote"
    SERVICES = "services"
    DISPLAY = "display"  # Per-session: display:{session_id}


@dataclass
class WebSocketClient:
    """Represents a connected WebSocket client."""

    websocket: WebSocket
    user_id: str | None = None
    is_admin: bool = False
    subscriptions: set[str] = field(default_factory=set)
    connected_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class WebSocketManager:
    """Manager for WebSocket connections and message broadcasting."""

    def __init__(self):
        self._clients: dict[WebSocket, WebSocketClient] = {}
        self._channels: dict[str, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(
        self,
        websocket: WebSocket,
        token: str | None = None,
        wallmount: bool = False,
        vote_token: str | None = None,
    ) -> WebSocketClient:
        """Accept a WebSocket connection and authenticate."""
        await websocket.accept()

        user_id = None
        is_admin = False

        # Authenticate if token provided
        if token:
            try:
                payload = jwt.decode(
                    token,
                    settings.secret_key,
                    algorithms=[settings.jwt_algorithm],
                )
                user_id = payload.get("sub")
                is_admin = True
            except JWTError:
                await websocket.close(code=4001, reason="Invalid token")
                raise WebSocketDisconnect(code=4001)

        # Check wallmount access
        if wallmount and settings.wallmount_requires_token and not is_admin:
            await websocket.close(code=4003, reason="Wallmount requires authentication")
            raise WebSocketDisconnect(code=4003)

        client = WebSocketClient(
            websocket=websocket,
            user_id=user_id,
            is_admin=is_admin,
        )

        async with self._lock:
            self._clients[websocket] = client

        # Send connected confirmation
        await self._send(
            websocket,
            {
                "type": "connected",
                "payload": {
                    "is_authenticated": is_admin,
                    "user_id": user_id,
                },
            },
        )

        # Auto-subscribe wallmount clients to WALLMOUNT channel
        if wallmount:
            await self.subscribe(websocket, Channel.WALLMOUNT.value)

        return client

    async def disconnect(self, websocket: WebSocket) -> None:
        """Handle client disconnection."""
        display_sessions_to_check: list[str] = []
        async with self._lock:
            client = self._clients.pop(websocket, None)
            if client:
                # Remove from all channels
                for channel in client.subscriptions:
                    self._channels[channel].discard(websocket)
                    # Track display channels that lost their last subscriber
                    if channel.startswith(f"{Channel.DISPLAY.value}:") and len(self._channels[channel]) == 0:
                        display_sessions_to_check.append(channel.split(":", 1)[1])

        # Handle display disconnect outside the lock
        for session_id in display_sessions_to_check:
            await self._handle_display_disconnect(session_id)

    async def subscribe(self, websocket: WebSocket, channel: str) -> bool:
        """Subscribe a client to a channel."""
        async with self._lock:
            client = self._clients.get(websocket)
            if not client:
                return False

            # Check permissions for admin-only channels
            if channel == "services" and not client.is_admin:
                await self._send(
                    websocket,
                    {
                        "type": "error",
                        "payload": {
                            "code": "FORBIDDEN",
                            "message": "Admin access required for services channel",
                        },
                    },
                )
                return False

            client.subscriptions.add(channel)
            self._channels[channel].add(websocket)

        await self._send(
            websocket,
            {
                "type": "subscribed",
                "payload": {"channel": channel},
            },
        )
        return True

    async def unsubscribe(self, websocket: WebSocket, channel: str) -> None:
        """Unsubscribe a client from a channel."""
        async with self._lock:
            client = self._clients.get(websocket)
            if client:
                client.subscriptions.discard(channel)
                self._channels[channel].discard(websocket)

        await self._send(
            websocket,
            {
                "type": "unsubscribed",
                "payload": {"channel": channel},
            },
        )

    async def broadcast(self, channel: str, message: dict[str, Any]) -> int:
        """Broadcast a message to all subscribers of a channel."""
        message["timestamp"] = datetime.now(timezone.utc).isoformat()

        async with self._lock:
            subscribers = list(self._channels.get(channel, set()))

        sent_count = 0
        for websocket in subscribers:
            try:
                await self._send(websocket, message)
                sent_count += 1
            except Exception:
                # Client disconnected, will be cleaned up
                pass

        return sent_count

    async def send_to_client(
        self,
        websocket: WebSocket,
        message: dict[str, Any],
    ) -> None:
        """Send a message to a specific client."""
        message["timestamp"] = datetime.now(timezone.utc).isoformat()
        await self._send(websocket, message)

    async def _send(self, websocket: WebSocket, message: dict[str, Any]) -> None:
        """Send a JSON message to a WebSocket."""
        await websocket.send_text(json.dumps(message))

    async def handle_message(
        self,
        websocket: WebSocket,
        data: dict[str, Any],
    ) -> None:
        """Handle incoming WebSocket message."""
        msg_type = data.get("type")
        payload = data.get("payload", {})
        request_id = data.get("request_id")

        if msg_type == "ping":
            await self._send(websocket, {"type": "pong"})

        elif msg_type == "subscribe":
            channel = payload.get("channel")
            if channel:
                await self.subscribe(websocket, channel)

        elif msg_type == "unsubscribe":
            channel = payload.get("channel")
            if channel:
                await self.unsubscribe(websocket, channel)

        elif msg_type == "session_control":
            # Will be handled by session control service
            # For now, forward to appropriate handler
            pass

        elif msg_type == "subscribe_wallmount":
            # Auto-subscribe to wallmount channel
            await self.subscribe(websocket, Channel.WALLMOUNT.value)
            # Send current wallmount state
            await self._send_wallmount_state(websocket)

        elif msg_type == "subscribe_vote":
            # Subscribe to vote channel for real-time results
            vote_session_id = payload.get("vote_session_id")
            if vote_session_id:
                channel = f"{Channel.VOTE.value}:{vote_session_id}"
                await self.subscribe(websocket, channel)
            else:
                await self.subscribe(websocket, Channel.VOTE.value)

        elif msg_type == "subscribe_display":
            # Subscribe to display channel for a specific session
            session_id = payload.get("session_id")
            if session_id:
                channel = f"{Channel.DISPLAY.value}:{session_id}"
                await self.subscribe(websocket, channel)
                # Also subscribe to session state updates
                await self.subscribe(websocket, Channel.SESSION.value)

                # Replay current display state and auto-resume if needed
                await self._handle_display_subscribe(websocket, session_id)
            else:
                await self._send(
                    websocket,
                    {
                        "type": "error",
                        "payload": {
                            "code": "MISSING_SESSION_ID",
                            "message": "session_id is required for subscribe_display",
                        },
                    },
                )

        elif msg_type == "playback_ended":
            # Display client reports playback has ended
            session_id = payload.get("session_id")
            if session_id:
                await self.broadcast(
                    Channel.SESSION.value,
                    {
                        "type": "playback_ended",
                        "payload": {"session_id": session_id},
                    },
                )

        else:
            await self._send(
                websocket,
                {
                    "type": "error",
                    "payload": {
                        "code": "INVALID_MESSAGE",
                        "message": f"Unknown message type: {msg_type}",
                    },
                    "request_id": request_id,
                },
            )

    @property
    def client_count(self) -> int:
        """Get the number of connected clients."""
        return len(self._clients)

    def get_channel_subscribers(self, channel: str) -> int:
        """Get the number of subscribers for a channel."""
        return len(self._channels.get(channel, set()))

    async def _send_wallmount_state(self, websocket: WebSocket) -> None:
        """Send current wallmount state to a client."""
        # This is a placeholder - the actual state will be fetched from the database
        # when sessions are running. For now, send an empty state.
        await self._send(
            websocket,
            {
                "type": "wallmount_state",
                "payload": {
                    "session_id": None,
                    "session_name": None,
                    "session_status": None,
                    "current_sequence_index": 0,
                    "total_sequences": 0,
                    "movie": None,
                    "palette": None,
                    "template": None,
                },
            },
        )

    async def _handle_display_subscribe(self, websocket: WebSocket, session_id: str) -> None:
        """Replay display state on subscribe and auto-resume if session was paused on disconnect."""
        import logging
        logger = logging.getLogger(__name__)

        try:
            from theatarr.services.engine import _engine
            if not _engine:
                return

            # Check session status first — skip replay/resume for terminal sessions
            session = await _engine._get_session(session_id)
            from theatarr.models.session import SessionStatus
            if session.status in (SessionStatus.COMPLETED, SessionStatus.INTERRUPTED):
                return

            # Replay all actions from current block if session has them
            display_states = _engine.get_display_state(session_id)
            if display_states:
                for state in display_states:
                    await self._send(websocket, {
                        "type": "action_execute",
                        "payload": {
                            **state,
                            "is_replay": True,
                        },
                    })

            # Auto-resume if session was paused and has pause_on_display_disconnect
            if (
                session.pause_on_display_disconnect
                and session.status == SessionStatus.PAUSED
            ):
                logger.info("Display reconnected for session %s — auto-resuming", session_id)
                await _engine.resume_session(session_id)
        except Exception as e:
            logging.getLogger(__name__).warning(
                "Failed to handle display subscribe for session %s: %s", session_id, e
            )

    async def _handle_display_disconnect(self, session_id: str) -> None:
        """Pause session if pause_on_display_disconnect is enabled and session is running."""
        import logging
        logger = logging.getLogger(__name__)

        try:
            from theatarr.services.engine import _engine
            if not _engine:
                return

            session = await _engine._get_session(session_id)
            from theatarr.models.session import SessionStatus
            if (
                session.pause_on_display_disconnect
                and session.status == SessionStatus.RUNNING
            ):
                logger.info("Display disconnected for session %s — auto-pausing", session_id)
                await _engine.pause_session(session_id)
        except Exception as e:
            logger.warning("Failed to auto-pause session %s on display disconnect: %s", session_id, e)

    async def broadcast_wallmount_state(self, state: dict) -> int:
        """Broadcast wallmount state to all wallmount subscribers."""
        return await self.broadcast(
            Channel.WALLMOUNT.value,
            {
                "type": "wallmount_state",
                "payload": state,
            },
        )

    async def broadcast_session_state(self, session_id: str, state: dict) -> int:
        """Broadcast session state update to all session channel subscribers."""
        return await self.broadcast(
            Channel.SESSION.value,
            {
                "type": "session_state",
                "payload": {
                    "session_id": session_id,
                    **state,
                },
            },
        )

    async def broadcast_vote_update(
        self,
        vote_session_id: str,
        event_type: str,
        data: dict,
    ) -> int:
        """Broadcast vote update to all subscribers.

        Args:
            vote_session_id: ID of the vote session
            event_type: Type of event (vote_cast, vote_closed, etc.)
            data: Event data

        Returns:
            Number of clients notified
        """
        # Broadcast to general vote channel
        general_count = await self.broadcast(
            Channel.VOTE.value,
            {
                "type": event_type,
                "payload": {
                    "vote_session_id": vote_session_id,
                    **data,
                },
            },
        )

        # Also broadcast to session-specific channel
        session_count = await self.broadcast(
            f"{Channel.VOTE.value}:{vote_session_id}",
            {
                "type": event_type,
                "payload": data,
            },
        )

        return general_count + session_count

    async def broadcast_display_action(
        self,
        session_id: str,
        action_type: str,
        command: str,
        parameters: dict,
        block_id: str | None = None,
    ) -> int:
        """Broadcast an action to the display channel for a session.

        Used by the engine when an action has no service_id,
        meaning it should be executed by the connected browser/kiosk.
        """
        payload: dict = {
            "action_type": action_type,
            "command": command,
            "parameters": parameters,
        }
        if block_id is not None:
            payload["block_id"] = block_id
        return await self.broadcast(
            f"{Channel.DISPLAY.value}:{session_id}",
            {
                "type": "action_execute",
                "payload": payload,
            },
        )


# Global WebSocket manager instance
ws_manager = WebSocketManager()
