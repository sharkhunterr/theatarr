"""Sequence execution engine for Theatarr.

This is the core engine that orchestrates session execution,
handling sequence transitions, action execution, and state management.

Performance Target: Transitions must complete in <200ms (excluding configured
transition_ms delays which are intentional waits).
"""

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Any, Callable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from theatarr.adapters.base import Command, CommandResult
from theatarr.adapters.registry import AdapterRegistry
from theatarr.models.action import Action, OnFailure
from theatarr.models.sequence import Sequence
from theatarr.models.session import Session, SessionStatus
from theatarr.utils.performance import get_performance_monitor

logger = logging.getLogger(__name__)

# Performance threshold for transition overhead (excluding intentional delays)
TRANSITION_OVERHEAD_TARGET_MS = 200


def _enum_val(v: Any) -> str:
    """Safely extract .value from an enum or return string as-is."""
    return v.value if hasattr(v, 'value') else v


class EngineError(Exception):
    """Base exception for engine errors."""

    pass


class SessionNotFoundError(EngineError):
    """Session not found."""

    pass


class SessionNotRunnableError(EngineError):
    """Session cannot be started/resumed."""

    pass


class ActionResult:
    """Result of executing an action."""

    def __init__(
        self,
        action_id: str,
        success: bool,
        message: str | None = None,
        duration_ms: int = 0,
        error: str | None = None,
    ):
        self.action_id = action_id
        self.success = success
        self.message = message
        self.duration_ms = duration_ms
        self.error = error


class SequenceEngine:
    """Engine for executing cinema session sequences.

    The engine manages:
    - Session lifecycle (start, pause, resume, stop, skip)
    - Sequence execution with transitions
    - Action dispatch to service adapters
    - State persistence for auto-resume
    - Event callbacks for real-time updates
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self._running_sessions: dict[str, asyncio.Task] = {}
        self._session_locks: dict[str, asyncio.Lock] = {}

        # Event callbacks
        self._on_session_state_change: Callable[[str, dict], None] | None = None
        self._on_sequence_transition: Callable[[str, dict], None] | None = None
        self._on_action_executed: Callable[[str, dict], None] | None = None
        self._on_action_failed: Callable[[str, dict], None] | None = None

    def set_callbacks(
        self,
        on_session_state_change: Callable[[str, dict], None] | None = None,
        on_sequence_transition: Callable[[str, dict], None] | None = None,
        on_action_executed: Callable[[str, dict], None] | None = None,
        on_action_failed: Callable[[str, dict], None] | None = None,
    ) -> None:
        """Set event callbacks for real-time updates."""
        self._on_session_state_change = on_session_state_change
        self._on_sequence_transition = on_sequence_transition
        self._on_action_executed = on_action_executed
        self._on_action_failed = on_action_failed

    async def _get_session(self, session_id: str) -> Session:
        """Get a session by ID with sequences and actions loaded."""
        result = await self.db.execute(
            select(Session).where(Session.id == session_id)
        )
        session = result.scalar_one_or_none()
        if not session:
            raise SessionNotFoundError(f"Session {session_id} not found")
        return session

    async def _get_lock(self, session_id: str) -> asyncio.Lock:
        """Get or create a lock for a session."""
        if session_id not in self._session_locks:
            self._session_locks[session_id] = asyncio.Lock()
        return self._session_locks[session_id]

    async def _emit_state_change(self, session: Session) -> None:
        """Emit session state change event."""
        logger.info(
            "Emitting state change: session=%s status=%s seq_index=%d/%d",
            session.id, _enum_val(session.status),
            session.current_sequence_index, session.total_sequences,
        )
        if self._on_session_state_change:
            state = {
                "session_id": session.id,
                "status": _enum_val(session.status),
                "current_sequence_index": session.current_sequence_index,
                "current_sequence_elapsed_ms": session.current_sequence_elapsed_ms,
                "total_sequences": session.total_sequences,
            }
            if session.current_sequence:
                state["current_sequence"] = {
                    "id": session.current_sequence.id,
                    "name": session.current_sequence.name,
                    "duration_type": _enum_val(session.current_sequence.duration_type),
                    "duration_ms": session.current_sequence.duration_ms,
                }
            await asyncio.to_thread(self._on_session_state_change, session.id, state)

    async def start_session(self, session_id: str) -> Session:
        """Start a session."""
        lock = await self._get_lock(session_id)
        async with lock:
            session = await self._get_session(session_id)

            if not session.can_start:
                raise SessionNotRunnableError(
                    f"Session {session_id} cannot be started (status: {session.status})"
                )

            if not session.sequences:
                raise EngineError(f"Session {session_id} has no sequences")

            # Update session state
            session.status = SessionStatus.RUNNING
            session.started_at = datetime.now(timezone.utc)
            session.current_sequence_index = 0
            session.current_sequence_elapsed_ms = 0
            await self.db.commit()

            logger.info(f"Starting session {session_id}")
            await self._emit_state_change(session)

            # Start execution task
            task = asyncio.create_task(self._run_session(session_id))
            self._running_sessions[session_id] = task

            return session

    async def pause_session(self, session_id: str) -> Session:
        """Pause a running session."""
        lock = await self._get_lock(session_id)
        async with lock:
            session = await self._get_session(session_id)

            if not session.can_pause:
                raise SessionNotRunnableError(
                    f"Session {session_id} cannot be paused (status: {session.status})"
                )

            session.status = SessionStatus.PAUSED
            await self.db.commit()

            logger.info(f"Paused session {session_id}")
            await self._emit_state_change(session)

            # Cancel the running task
            if session_id in self._running_sessions:
                self._running_sessions[session_id].cancel()
                del self._running_sessions[session_id]

            return session

    async def resume_session(self, session_id: str) -> Session:
        """Resume a paused session."""
        lock = await self._get_lock(session_id)
        async with lock:
            session = await self._get_session(session_id)

            if not session.can_resume:
                raise SessionNotRunnableError(
                    f"Session {session_id} cannot be resumed (status: {session.status})"
                )

            session.status = SessionStatus.RUNNING
            await self.db.commit()

            logger.info(f"Resuming session {session_id}")
            await self._emit_state_change(session)

            # Restart execution task (skip re-executing actions)
            task = asyncio.create_task(self._run_session(session_id, resuming=True))
            self._running_sessions[session_id] = task

            return session

    async def stop_session(self, session_id: str) -> Session:
        """Stop a session."""
        lock = await self._get_lock(session_id)
        async with lock:
            session = await self._get_session(session_id)

            if session.status == SessionStatus.COMPLETED:
                return session

            # Cancel running task
            if session_id in self._running_sessions:
                self._running_sessions[session_id].cancel()
                del self._running_sessions[session_id]

            session.status = SessionStatus.COMPLETED
            session.completed_at = datetime.now(timezone.utc)
            await self.db.commit()

            logger.info(f"Stopped session {session_id}")
            await self._emit_state_change(session)

            return session

    async def skip_sequence(self, session_id: str) -> Session:
        """Skip to the next sequence."""
        lock = await self._get_lock(session_id)
        async with lock:
            session = await self._get_session(session_id)

            if session.status not in (SessionStatus.RUNNING, SessionStatus.PAUSED):
                raise SessionNotRunnableError(
                    f"Cannot skip sequence in session {session_id} (status: {session.status})"
                )

            # Move to next sequence
            next_index = session.current_sequence_index + 1
            if next_index >= session.total_sequences:
                # No more sequences, complete the session
                session.status = SessionStatus.COMPLETED
                session.completed_at = datetime.now(timezone.utc)
            else:
                session.current_sequence_index = next_index
                session.current_sequence_elapsed_ms = 0

            await self.db.commit()
            logger.info(f"Skipped to sequence {session.current_sequence_index} in session {session_id}")
            await self._emit_state_change(session)

            return session

    async def _run_session(self, session_id: str, resuming: bool = False) -> None:
        """Main session execution loop."""
        try:
            while True:
                session = await self._get_session(session_id)

                if session.status != SessionStatus.RUNNING:
                    break

                if session.current_sequence_index >= session.total_sequences:
                    # All sequences completed
                    session.status = SessionStatus.COMPLETED
                    session.completed_at = datetime.now(timezone.utc)
                    await self.db.commit()
                    await self._emit_state_change(session)
                    break

                sequence = session.current_sequence
                if not sequence:
                    logger.warning("Session %s: no current sequence at index %d", session_id, session.current_sequence_index)
                    break

                # Execute sequence (skip actions on first iteration if resuming)
                await self._execute_sequence(session, sequence, skip_actions=resuming)
                resuming = False  # Only skip on the first sequence after resume

                # Check if still running after sequence
                session = await self._get_session(session_id)
                if session.status != SessionStatus.RUNNING:
                    logger.info("Session %s: status changed to %s during sequence, stopping", session_id, _enum_val(session.status))
                    break

                # Move to next sequence
                logger.info("Session %s: transitioning from sequence %d to next", session_id, session.current_sequence_index)
                await self._transition_to_next_sequence(session)

        except asyncio.CancelledError:
            logger.info(f"Session {session_id} execution cancelled")
        except Exception as e:
            logger.exception(f"Error in session {session_id}: {e}")
            # Mark as interrupted
            try:
                session = await self._get_session(session_id)
                session.status = SessionStatus.INTERRUPTED
                await self.db.commit()
                await self._emit_state_change(session)
            except Exception:
                pass
        finally:
            self._running_sessions.pop(session_id, None)

    async def _execute_sequence(self, session: Session, sequence: Sequence, skip_actions: bool = False) -> None:
        """Execute a single sequence."""
        duration_ms = sequence.effective_duration_ms
        logger.info(
            "Executing sequence %s (%s) — duration_type=%s duration_ms=%s effective=%dms, %d action(s), skip_actions=%s",
            sequence.name, sequence.id,
            _enum_val(sequence.duration_type), sequence.duration_ms,
            duration_ms, len(sequence.actions), skip_actions,
        )

        # Execute all actions at sequence start (skip when resuming from pause)
        if skip_actions:
            logger.info("Resuming sequence %s — skipping action execution (elapsed: %dms)", sequence.name, session.current_sequence_elapsed_ms)
        else:
            for action in sequence.actions:
                if action.delay_ms > 0:
                    await asyncio.sleep(action.delay_ms / 1000)

                result = await self._execute_action(action)
                logger.info(
                    "Action %s result: success=%s message=%s",
                    action.id, result.success, result.message,
                )

                if not result.success and _enum_val(action.on_failure) == OnFailure.ABORT.value:
                    raise EngineError(f"Action {action.id} failed: {result.error}")

        # Wait for sequence duration
        dur_type = _enum_val(sequence.duration_type)
        if dur_type == "manual":
            # Manual sequence: wait indefinitely until status changes (skip/stop/pause)
            logger.info("Sequence %s is MANUAL — waiting for external signal (skip/stop)", sequence.name)
            while True:
                await asyncio.sleep(1)
                session = await self._get_session(session.id)
                if session.status != SessionStatus.RUNNING:
                    return
                # If current_sequence_index changed (via skip), break out
                if session.current_sequence_index != sequence.order_index:
                    return
        elif duration_ms > 0:
            elapsed = session.current_sequence_elapsed_ms
            remaining = max(0, duration_ms - elapsed)

            # Update elapsed time in chunks for real-time updates
            chunk_ms = 1000  # Update every second
            while remaining > 0:
                # Check if still running
                session = await self._get_session(session.id)
                if session.status != SessionStatus.RUNNING:
                    return

                wait_ms = min(chunk_ms, remaining)
                await asyncio.sleep(wait_ms / 1000)

                # Update elapsed time
                session.current_sequence_elapsed_ms += wait_ms
                await self.db.commit()

                remaining -= wait_ms

    async def _execute_action(self, action: Action) -> ActionResult:
        """Execute a single action via the appropriate adapter and/or display channel."""
        start_time = datetime.now(timezone.utc)

        try:
            from theatarr.api.ws import ws_manager

            session_id = action.sequence.session_id
            success = True
            message = ""

            # 1) Execute via adapter if service_id is set
            if action.service_id:
                adapter = AdapterRegistry.get_instance(action.service_id)
                if not adapter:
                    # Adapter not in cache — try loading from DB
                    from theatarr.models.service import Service
                    svc_result = await self.db.execute(
                        select(Service).where(Service.id == action.service_id)
                    )
                    svc = svc_result.scalar_one_or_none()
                    if svc and svc.is_enabled:
                        try:
                            adapter = AdapterRegistry.create_adapter(
                                svc.adapter_type,
                                svc.config,
                                instance_id=svc.id,
                            )
                            logger.info("Auto-loaded adapter %s for service %s", svc.adapter_type, svc.id)
                        except Exception as e:
                            logger.warning("Failed to create adapter for service %s: %s", svc.id, e)
                    elif svc:
                        logger.warning("Service %s is disabled, skipping adapter", svc.id)
                    else:
                        logger.warning("No service found with id %s for action %s", action.service_id, action.id)

                if adapter:
                    command = Command(
                        action=action.command,
                        parameters=action.parameters,
                        targets=action.targets,
                    )
                    result = await adapter.execute(command)
                    success = result.success
                    message = result.message or ""

            # 2) Resolve stream URL for media:play if adapter can provide it
            ws_params = dict(action.parameters or {})
            action_type_val = _enum_val(action.action_type)
            if (
                action_type_val == "media"
                and action.command == "play"
                and "url" not in ws_params
                and ws_params.get("media_id")
                and adapter
            ):
                try:
                    url_params = {"media_id": ws_params["media_id"]}
                    if ws_params.get("audio_stream_id"):
                        url_params["audio_stream_id"] = ws_params["audio_stream_id"]
                    if ws_params.get("subtitle_stream_id"):
                        url_params["subtitle_stream_id"] = ws_params["subtitle_stream_id"]
                    if ws_params.get("video_quality"):
                        url_params["video_quality"] = ws_params["video_quality"]
                    url_result = await adapter.execute(Command(
                        action="get_playback_url",
                        parameters=url_params,
                    ))
                    if url_result.success and url_result.data:
                        playback_url = url_result.data.get("playback_url")
                        if playback_url:
                            ws_params["url"] = playback_url
                            logger.info("Resolved playback URL for media_id %s", ws_params["media_id"])
                except Exception as e:
                    logger.warning("Failed to resolve playback URL: %s", e)

            # 3) Always notify display clients via WebSocket
            logger.info(
                "Broadcasting WS action_execute: %s:%s to session %s (params keys: %s)",
                action_type_val, action.command, session_id,
                list(ws_params.keys()),
            )
            sent = await ws_manager.broadcast_display_action(
                session_id=session_id,
                action_type=action_type_val,
                command=action.command,
                parameters=ws_params,
            )
            logger.info("WS broadcast sent to %d display client(s)", sent)
            if sent > 0:
                ws_msg = f"Sent to {sent} display client(s)"
                message = f"{message}; {ws_msg}" if message else ws_msg
            elif sent == 0:
                logger.warning(
                    "Action %s: no display client connected (session %s)",
                    action.id, session_id,
                )

            duration_ms = int(
                (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
            )

            action_result = ActionResult(
                action_id=action.id,
                success=success,
                message=message,
                duration_ms=duration_ms,
                error=message if not success else None,
            )

            # Emit event
            action_type_str = _enum_val(action.action_type)
            on_failure_str = _enum_val(action.on_failure)

            if self._on_action_executed and success:
                await asyncio.to_thread(
                    self._on_action_executed,
                    action.sequence.session_id,
                    {
                        "action_id": action.id,
                        "action_type": action_type_str,
                        "command": action.command,
                        "success": True,
                        "duration_ms": duration_ms,
                    },
                )
            elif self._on_action_failed and not success:
                await asyncio.to_thread(
                    self._on_action_failed,
                    action.sequence.session_id,
                    {
                        "action_id": action.id,
                        "action_type": action_type_str,
                        "command": action.command,
                        "error": message,
                        "on_failure": on_failure_str,
                    },
                )

            return action_result

        except Exception as e:
            logger.exception(f"Error executing action {action.id}: {e}")
            return ActionResult(
                action_id=action.id,
                success=False,
                error=str(e),
            )

    async def _transition_to_next_sequence(self, session: Session) -> None:
        """Transition to the next sequence.

        Performance target: Transition overhead (excluding intentional delays)
        must be <200ms.
        """
        transition_start = time.perf_counter()
        monitor = get_performance_monitor()

        current = session.current_sequence
        next_index = session.current_sequence_index + 1

        if next_index >= session.total_sequences:
            # All sequences done — mark session as completed
            session.status = SessionStatus.COMPLETED
            session.completed_at = datetime.now(timezone.utc)
            await self.db.commit()
            logger.info(f"Session {session.id} completed (all sequences done)")
            await self._emit_state_change(session)
            return

        next_sequence = session.sequences[next_index]

        # Emit transition event
        if self._on_sequence_transition:
            await asyncio.to_thread(
                self._on_sequence_transition,
                session.id,
                {
                    "from_sequence": {
                        "id": current.id,
                        "name": current.name,
                        "index": session.current_sequence_index,
                    } if current else None,
                    "to_sequence": {
                        "id": next_sequence.id,
                        "name": next_sequence.name,
                        "index": next_index,
                    },
                    "transition_ms": next_sequence.transition_ms,
                },
            )

        # Record overhead before intentional delay
        pre_delay_ms = (time.perf_counter() - transition_start) * 1000

        # Wait for transition (intentional delay - not counted against perf target)
        if next_sequence.transition_ms > 0:
            await asyncio.sleep(next_sequence.transition_ms / 1000)

        # Update session state
        post_delay_start = time.perf_counter()
        session.current_sequence_index = next_index
        session.current_sequence_elapsed_ms = 0
        await self.db.commit()
        await self._emit_state_change(session)
        post_delay_ms = (time.perf_counter() - post_delay_start) * 1000

        # Record total overhead (excluding intentional delay)
        overhead_ms = pre_delay_ms + post_delay_ms
        monitor.record_sync(
            "transition_overhead",
            overhead_ms,
            session_id=session.id,
            from_index=session.current_sequence_index - 1,
            to_index=next_index,
        )

        if overhead_ms > TRANSITION_OVERHEAD_TARGET_MS:
            logger.warning(
                f"Transition overhead ({overhead_ms:.2f}ms) exceeded target "
                f"({TRANSITION_OVERHEAD_TARGET_MS}ms) for session {session.id}"
            )

    async def get_session_state(self, session_id: str) -> dict[str, Any]:
        """Get current state of a session."""
        session = await self._get_session(session_id)
        state = {
            "session_id": session.id,
            "status": _enum_val(session.status),
            "current_sequence_index": session.current_sequence_index,
            "current_sequence_elapsed_ms": session.current_sequence_elapsed_ms,
            "total_sequences": session.total_sequences,
        }
        if session.current_sequence:
            seq = session.current_sequence
            remaining = max(0, seq.effective_duration_ms - session.current_sequence_elapsed_ms)
            state["current_sequence"] = {
                "id": seq.id,
                "name": seq.name,
                "duration_type": _enum_val(seq.duration_type),
                "duration_ms": seq.duration_ms,
                "remaining_ms": remaining,
            }
        return state


# Global engine instance (will be initialized with db session)
_engine: SequenceEngine | None = None


def _setup_ws_callbacks(engine: SequenceEngine) -> None:
    """Wire engine callbacks to broadcast state changes via WebSocket."""
    from theatarr.api.ws import ws_manager

    loop = asyncio.get_event_loop()

    def on_session_state_change(session_id: str, state: dict) -> None:
        asyncio.run_coroutine_threadsafe(
            ws_manager.broadcast_session_state(session_id, state),
            loop,
        )

    engine.set_callbacks(
        on_session_state_change=on_session_state_change,
    )


def get_engine(db: AsyncSession) -> SequenceEngine:
    """Get or create engine instance."""
    global _engine
    if _engine is None or _engine.db != db:
        _engine = SequenceEngine(db)
        _setup_ws_callbacks(_engine)
    return _engine
