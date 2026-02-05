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
        if self._on_session_state_change:
            state = {
                "session_id": session.id,
                "status": session.status.value,
                "current_sequence_index": session.current_sequence_index,
                "current_sequence_elapsed_ms": session.current_sequence_elapsed_ms,
                "total_sequences": session.total_sequences,
            }
            if session.current_sequence:
                state["current_sequence"] = {
                    "id": session.current_sequence.id,
                    "name": session.current_sequence.name,
                    "duration_type": session.current_sequence.duration_type.value,
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

            # Restart execution task
            task = asyncio.create_task(self._run_session(session_id))
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

    async def _run_session(self, session_id: str) -> None:
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
                    break

                # Execute sequence
                await self._execute_sequence(session, sequence)

                # Check if still running after sequence
                session = await self._get_session(session_id)
                if session.status != SessionStatus.RUNNING:
                    break

                # Move to next sequence
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

    async def _execute_sequence(self, session: Session, sequence: Sequence) -> None:
        """Execute a single sequence."""
        logger.info(f"Executing sequence {sequence.name} ({sequence.id})")

        # Execute all actions at sequence start
        for action in sequence.actions:
            if action.delay_ms > 0:
                await asyncio.sleep(action.delay_ms / 1000)

            result = await self._execute_action(action)

            if not result.success and action.on_failure == OnFailure.ABORT:
                raise EngineError(f"Action {action.id} failed: {result.error}")

        # Wait for sequence duration
        duration_ms = sequence.effective_duration_ms
        if duration_ms > 0:
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
        """Execute a single action via the appropriate adapter."""
        start_time = datetime.now(timezone.utc)

        try:
            # Get adapter instance for the service
            if action.service_id:
                adapter = AdapterRegistry.get_instance(action.service_id)
            else:
                # Use mock adapter for testing
                adapter = AdapterRegistry.get_instance("mock")

            if not adapter:
                # No adapter available, log and continue
                logger.warning(f"No adapter for action {action.id}, skipping")
                return ActionResult(
                    action_id=action.id,
                    success=True,
                    message="No adapter available, skipped",
                )

            # Execute command
            command = Command(
                action=action.command,
                parameters=action.parameters,
                targets=action.targets,
            )
            result = await adapter.execute(command)

            duration_ms = int(
                (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
            )

            action_result = ActionResult(
                action_id=action.id,
                success=result.success,
                message=result.message,
                duration_ms=duration_ms,
                error=result.message if not result.success else None,
            )

            # Emit event
            if self._on_action_executed and result.success:
                await asyncio.to_thread(
                    self._on_action_executed,
                    action.sequence.session_id,
                    {
                        "action_id": action.id,
                        "action_type": action.action_type.value,
                        "command": action.command,
                        "success": True,
                        "duration_ms": duration_ms,
                    },
                )
            elif self._on_action_failed and not result.success:
                await asyncio.to_thread(
                    self._on_action_failed,
                    action.sequence.session_id,
                    {
                        "action_id": action.id,
                        "action_type": action.action_type.value,
                        "command": action.command,
                        "error": result.message,
                        "on_failure": action.on_failure.value,
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
            "status": session.status.value,
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
                "duration_type": seq.duration_type.value,
                "duration_ms": seq.duration_ms,
                "remaining_ms": remaining,
            }
        return state


# Global engine instance (will be initialized with db session)
_engine: SequenceEngine | None = None


def get_engine(db: AsyncSession) -> SequenceEngine:
    """Get or create engine instance."""
    global _engine
    if _engine is None or _engine.db != db:
        _engine = SequenceEngine(db)
    return _engine
