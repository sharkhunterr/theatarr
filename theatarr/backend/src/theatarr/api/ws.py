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
        async with self._lock:
            client = self._clients.pop(websocket, None)
            if client:
                # Remove from all channels
                for channel in client.subscriptions:
                    self._channels[channel].discard(websocket)

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


# Global WebSocket manager instance
ws_manager = WebSocketManager()
