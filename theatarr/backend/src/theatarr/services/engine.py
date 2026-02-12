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
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from theatarr.adapters.base import Command
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

    Owns a single long-lived DB session (created lazily).
    Background tasks and request-handler calls all share this session.
    SQLite WAL mode + busy_timeout prevent "database is locked" errors.
    """

    def __init__(self):
        self._db: AsyncSession | None = None
        self._running_sessions: dict[str, asyncio.Task] = {}
        self._session_locks: dict[str, asyncio.Lock] = {}
        self._display_states: dict[str, list[dict]] = {}

    @property
    def db(self) -> AsyncSession:
        """Get the engine's DB session, creating it lazily if needed."""
        if self._db is None:
            from theatarr.database import async_session_maker
            self._db = async_session_maker()
        return self._db

    def get_display_state(self, session_id: str) -> list[dict] | None:
        """Get all broadcast actions for the current block (for reconnection replay)."""
        return self._display_states.get(session_id) or None

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
        """Emit session state change event via WebSocket broadcast."""
        from theatarr.api.ws import ws_manager

        logger.info(
            "Emitting state change: session=%s status=%s seq_index=%d/%d",
            session.id, _enum_val(session.status),
            session.current_sequence_index, session.total_sequences,
        )
        state: dict[str, Any] = {
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
        await ws_manager.broadcast_session_state(session.id, state)

    # ------------------------------------------------------------------
    # Public lifecycle methods (called from request handlers)
    # ------------------------------------------------------------------

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

            session.status = SessionStatus.RUNNING
            session.started_at = datetime.now(timezone.utc)
            session.current_sequence_index = 0
            session.current_sequence_elapsed_ms = 0
            await self.db.commit()

            logger.info("Starting session %s", session_id)
            await self._emit_state_change(session)

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

            logger.info("Paused session %s", session_id)
            await self._emit_state_change(session)

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

            logger.info("Resuming session %s", session_id)
            await self._emit_state_change(session)

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

            if session_id in self._running_sessions:
                self._running_sessions[session_id].cancel()
                del self._running_sessions[session_id]

            session.status = SessionStatus.COMPLETED
            session.completed_at = datetime.now(timezone.utc)
            await self.db.commit()

            self._display_states.pop(session_id, None)
            logger.info("Stopped session %s", session_id)
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

            next_index = session.current_sequence_index + 1
            if next_index >= session.total_sequences:
                session.status = SessionStatus.COMPLETED
                session.completed_at = datetime.now(timezone.utc)
            else:
                session.current_sequence_index = next_index
                session.current_sequence_elapsed_ms = 0

            await self.db.commit()
            logger.info("Skipped to sequence %d in session %s", session.current_sequence_index, session_id)
            await self._emit_state_change(session)

            return session

    # ------------------------------------------------------------------
    # Background session execution
    # ------------------------------------------------------------------

    async def _run_session(self, session_id: str, resuming: bool = False) -> None:
        """Main session execution loop."""
        try:
            while True:
                session = await self._get_session(session_id)

                if session.status != SessionStatus.RUNNING:
                    break

                if session.current_sequence_index >= session.total_sequences:
                    session.status = SessionStatus.COMPLETED
                    session.completed_at = datetime.now(timezone.utc)
                    await self.db.commit()
                    self._display_states.pop(session_id, None)
                    await self._emit_state_change(session)
                    break

                sequence = session.current_sequence
                if not sequence:
                    logger.warning("Session %s: no current sequence at index %d", session_id, session.current_sequence_index)
                    break

                await self._execute_sequence(session, sequence, skip_actions=resuming)
                resuming = False

                session = await self._get_session(session_id)
                if session.status != SessionStatus.RUNNING:
                    logger.info("Session %s: status changed to %s during sequence, stopping", session_id, _enum_val(session.status))
                    break

                logger.info("Session %s: transitioning from sequence %d to next", session_id, session.current_sequence_index)
                await self._transition_to_next_sequence(session)

        except asyncio.CancelledError:
            logger.info("Session %s execution cancelled", session_id)
        except Exception as e:
            logger.exception("Error in session %s: %s", session_id, e)
            try:
                session = await self._get_session(session_id)
                session.status = SessionStatus.INTERRUPTED
                await self.db.commit()
                self._display_states.pop(session_id, None)
                await self._emit_state_change(session)
            except Exception:
                pass
        finally:
            self._running_sessions.pop(session_id, None)

    async def _execute_sequence(self, session: Session, sequence: Sequence, skip_actions: bool = False) -> None:
        """Execute a single sequence (all actions in parallel)."""
        duration_ms = sequence.effective_duration_ms
        logger.info(
            "Executing sequence %s (%s) — duration_type=%s duration_ms=%s effective=%dms, %d action(s), skip_actions=%s",
            sequence.name, sequence.id,
            _enum_val(sequence.duration_type), sequence.duration_ms,
            duration_ms, len(sequence.actions), skip_actions,
        )

        if skip_actions:
            logger.info("Resuming sequence %s — skipping action execution (elapsed: %dms)", sequence.name, session.current_sequence_elapsed_ms)
        else:
            self._display_states[session.id] = []

            async def _exec_one(action: Action) -> ActionResult:
                if action.delay_ms > 0:
                    await asyncio.sleep(action.delay_ms / 1000)
                return await self._execute_action(
                    action, sequence_duration_ms=duration_ms, block_id=sequence.id,
                )

            results = await asyncio.gather(
                *[_exec_one(a) for a in sequence.actions],
                return_exceptions=True,
            )

            for i, result in enumerate(results):
                action = sequence.actions[i]
                if isinstance(result, Exception):
                    logger.exception("Action %s failed: %s", action.id, result)
                    if _enum_val(action.on_failure) == OnFailure.ABORT.value:
                        raise EngineError(f"Action {action.id} failed: {result}")
                elif isinstance(result, ActionResult):
                    logger.info("Action %s result: success=%s message=%s", action.id, result.success, result.message)
                    if not result.success and _enum_val(action.on_failure) == OnFailure.ABORT.value:
                        raise EngineError(f"Action {action.id} failed: {result.error}")

        dur_type = _enum_val(sequence.duration_type)
        if dur_type == "manual":
            logger.info("Sequence %s is MANUAL — waiting for external signal (skip/stop)", sequence.name)
            while True:
                await asyncio.sleep(1)
                session = await self._get_session(session.id)
                if session.status != SessionStatus.RUNNING:
                    return
                if session.current_sequence_index != sequence.order_index:
                    return
        elif duration_ms > 0:
            elapsed = session.current_sequence_elapsed_ms
            remaining = max(0, duration_ms - elapsed)
            chunk_ms = 1000
            while remaining > 0:
                session = await self._get_session(session.id)
                if session.status != SessionStatus.RUNNING:
                    return
                wait_ms = min(chunk_ms, remaining)
                await asyncio.sleep(wait_ms / 1000)
                session.current_sequence_elapsed_ms += wait_ms
                await self.db.commit()
                remaining -= wait_ms

    async def _execute_action(self, action: Action, *, sequence_duration_ms: int = 0, block_id: str | None = None) -> ActionResult:
        """Execute a single action via the appropriate adapter and/or display channel."""
        start_time = datetime.now(timezone.utc)
        session_id = action.sequence.session_id

        try:
            from theatarr.api.ws import ws_manager

            success = True
            message = ""
            adapter = None

            if action.service_id:
                adapter = AdapterRegistry.get_instance(action.service_id)
                if not adapter:
                    from theatarr.models.service import Service
                    svc_result = await self.db.execute(
                        select(Service).where(Service.id == action.service_id)
                    )
                    svc = svc_result.scalar_one_or_none()
                    if svc and svc.is_enabled:
                        try:
                            adapter = AdapterRegistry.create_adapter(
                                svc.adapter_type, svc.config, instance_id=svc.id,
                            )
                        except Exception as e:
                            logger.warning("Failed to create adapter for service %s: %s", svc.id, e)

                if adapter:
                    result = await adapter.execute(Command(
                        action=action.command,
                        parameters=action.parameters,
                        targets=action.targets,
                    ))
                    success = result.success
                    message = result.message or ""

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
                    for key in ("audio_stream_id", "subtitle_stream_id", "video_quality"):
                        if ws_params.get(key):
                            url_params[key] = ws_params[key]
                    url_result = await adapter.execute(Command(
                        action="get_playback_url", parameters=url_params,
                    ))
                    if url_result.success and url_result.data:
                        playback_url = url_result.data.get("playback_url")
                        if playback_url:
                            ws_params["url"] = playback_url
                except Exception as e:
                    logger.warning("Failed to resolve playback URL: %s", e)

            if sequence_duration_ms > 0:
                ws_params['sequence_duration_ms'] = sequence_duration_ms
                ws_params['sequence_started_at'] = datetime.now(timezone.utc).isoformat()

            logger.info(
                "Broadcasting action_execute: %s:%s to session %s",
                action_type_val, action.command, session_id,
            )
            sent = await ws_manager.broadcast_display_action(
                session_id=session_id,
                action_type=action_type_val,
                command=action.command,
                parameters=ws_params,
                block_id=block_id,
            )
            self._display_states.setdefault(session_id, []).append({
                "action_type": action_type_val,
                "command": action.command,
                "parameters": ws_params,
                "broadcast_at": datetime.now(timezone.utc).isoformat(),
                "block_id": block_id,
            })
            if sent == 0:
                logger.warning("Action %s: no display client connected (session %s)", action.id, session_id)
            else:
                ws_msg = f"Sent to {sent} display client(s)"
                message = f"{message}; {ws_msg}" if message else ws_msg

            elapsed = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
            return ActionResult(
                action_id=action.id, success=success, message=message,
                duration_ms=elapsed, error=message if not success else None,
            )

        except Exception as e:
            logger.exception("Error executing action %s: %s", action.id, e)
            return ActionResult(action_id=action.id, success=False, error=str(e))

    async def _transition_to_next_sequence(self, session: Session) -> None:
        """Transition to the next sequence."""
        transition_start = time.perf_counter()
        monitor = get_performance_monitor()
        next_index = session.current_sequence_index + 1

        if next_index >= session.total_sequences:
            session.status = SessionStatus.COMPLETED
            session.completed_at = datetime.now(timezone.utc)
            await self.db.commit()
            logger.info("Session %s completed (all sequences done)", session.id)
            await self._emit_state_change(session)
            return

        next_sequence = session.sequences[next_index]
        pre_delay_ms = (time.perf_counter() - transition_start) * 1000

        if next_sequence.transition_ms > 0:
            await asyncio.sleep(next_sequence.transition_ms / 1000)

        post_delay_start = time.perf_counter()
        session.current_sequence_index = next_index
        session.current_sequence_elapsed_ms = 0
        await self.db.commit()
        await self._emit_state_change(session)
        post_delay_ms = (time.perf_counter() - post_delay_start) * 1000

        overhead_ms = pre_delay_ms + post_delay_ms
        monitor.record_sync(
            "transition_overhead", overhead_ms,
            session_id=session.id,
            from_index=session.current_sequence_index - 1,
            to_index=next_index,
        )
        if overhead_ms > TRANSITION_OVERHEAD_TARGET_MS:
            logger.warning(
                "Transition overhead (%.2fms) exceeded target (%dms) for session %s",
                overhead_ms, TRANSITION_OVERHEAD_TARGET_MS, session.id,
            )

    async def get_session_state(self, session_id: str) -> dict[str, Any]:
        """Get current state of a session."""
        session = await self._get_session(session_id)
        state: dict[str, Any] = {
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


# ------------------------------------------------------------------
# Global singleton
# ------------------------------------------------------------------

_engine: SequenceEngine | None = None


def get_engine() -> SequenceEngine:
    """Get the global engine singleton."""
    global _engine
    if _engine is None:
        _engine = SequenceEngine()
    return _engine
