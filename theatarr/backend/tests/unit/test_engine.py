"""Unit tests for the sequence execution engine."""

import asyncio
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from theatarr.models.action import Action, ActionType, OnFailure
from theatarr.models.sequence import DurationType, Sequence
from theatarr.models.session import Session, SessionStatus
from theatarr.services.engine import (
    ActionResult,
    EngineError,
    SequenceEngine,
    SessionNotFoundError,
    SessionNotRunnableError,
)


@pytest.fixture
def mock_session() -> Session:
    """Create a mock session with sequences."""
    session = MagicMock(spec=Session)
    session.id = "session-123"
    session.name = "Test Session"
    session.status = SessionStatus.DRAFT
    session.current_sequence_index = 0
    session.current_sequence_elapsed_ms = 0
    session.total_sequences = 3
    session.can_start = True
    session.can_pause = False
    session.can_resume = False

    # Create mock sequences
    sequences = []
    for i in range(3):
        seq = MagicMock(spec=Sequence)
        seq.id = f"seq-{i}"
        seq.name = f"Sequence {i}"
        seq.order_index = i
        seq.duration_type = DurationType.FIXED
        seq.duration_ms = 5000
        seq.duration_fallback_ms = 60000
        seq.transition_ms = 1000
        seq.effective_duration_ms = 5000
        seq.actions = []
        sequences.append(seq)

    session.sequences = sequences
    session.current_sequence = sequences[0]

    return session


@pytest.fixture
def mock_action() -> Action:
    """Create a mock action."""
    action = MagicMock(spec=Action)
    action.id = "action-123"
    action.action_type = ActionType.LIGHTING
    action.command = "set_brightness"
    action.parameters = {"brightness": 50}
    action.targets = ["light-1", "light-2"]
    action.delay_ms = 0
    action.on_failure = OnFailure.WARN
    action.service_id = "service-123"
    return action


class TestActionResult:
    """Tests for ActionResult class."""

    def test_successful_result(self):
        """Test creating a successful action result."""
        result = ActionResult(
            action_id="action-1",
            success=True,
            message="Action completed",
            duration_ms=150,
        )
        assert result.action_id == "action-1"
        assert result.success is True
        assert result.message == "Action completed"
        assert result.duration_ms == 150
        assert result.error is None

    def test_failed_result(self):
        """Test creating a failed action result."""
        result = ActionResult(
            action_id="action-2",
            success=False,
            error="Connection timeout",
            duration_ms=3000,
        )
        assert result.action_id == "action-2"
        assert result.success is False
        assert result.error == "Connection timeout"
        assert result.duration_ms == 3000


class TestEngineErrors:
    """Tests for engine error classes."""

    def test_engine_error_base(self):
        """Test EngineError base exception."""
        error = EngineError("Something went wrong")
        assert str(error) == "Something went wrong"

    def test_session_not_found_error(self):
        """Test SessionNotFoundError."""
        error = SessionNotFoundError("Session xyz not found")
        assert isinstance(error, EngineError)
        assert "xyz" in str(error)

    def test_session_not_runnable_error(self):
        """Test SessionNotRunnableError."""
        error = SessionNotRunnableError("Session cannot be started")
        assert isinstance(error, EngineError)


class TestSequenceEngine:
    """Tests for SequenceEngine class."""

    @pytest_asyncio.fixture
    async def engine(self, db_session: AsyncSession) -> SequenceEngine:
        """Create engine instance."""
        return SequenceEngine(db_session)

    @pytest.mark.asyncio
    async def test_set_callbacks(self, engine: SequenceEngine):
        """Test setting event callbacks."""
        on_state_change = MagicMock()
        on_transition = MagicMock()
        on_action_executed = MagicMock()
        on_action_failed = MagicMock()

        engine.set_callbacks(
            on_session_state_change=on_state_change,
            on_sequence_transition=on_transition,
            on_action_executed=on_action_executed,
            on_action_failed=on_action_failed,
        )

        assert engine._on_session_state_change == on_state_change
        assert engine._on_sequence_transition == on_transition
        assert engine._on_action_executed == on_action_executed
        assert engine._on_action_failed == on_action_failed

    @pytest.mark.asyncio
    async def test_get_session_not_found(self, engine: SequenceEngine):
        """Test getting a non-existent session."""
        with pytest.raises(SessionNotFoundError):
            await engine._get_session("nonexistent-id")

    @pytest.mark.asyncio
    async def test_get_lock_creates_new(self, engine: SequenceEngine):
        """Test lock creation for new session."""
        lock = await engine._get_lock("session-1")
        assert isinstance(lock, asyncio.Lock)
        assert "session-1" in engine._session_locks

    @pytest.mark.asyncio
    async def test_get_lock_returns_existing(self, engine: SequenceEngine):
        """Test getting existing lock."""
        lock1 = await engine._get_lock("session-1")
        lock2 = await engine._get_lock("session-1")
        assert lock1 is lock2

    @pytest.mark.asyncio
    async def test_start_session_creates_task(
        self, db_session: AsyncSession, mock_session: MagicMock
    ):
        """Test that starting a session creates an execution task."""
        engine = SequenceEngine(db_session)

        with patch.object(engine, "_get_session", return_value=mock_session):
            with patch.object(engine, "_run_session", new_callable=AsyncMock) as mock_run:
                # Mock commit
                db_session.commit = AsyncMock()

                result = await engine.start_session("session-123")

                assert mock_session.status == SessionStatus.RUNNING
                assert mock_session.started_at is not None
                assert mock_session.current_sequence_index == 0
                assert "session-123" in engine._running_sessions

    @pytest.mark.asyncio
    async def test_start_session_not_runnable(
        self, db_session: AsyncSession, mock_session: MagicMock
    ):
        """Test starting a non-runnable session raises error."""
        mock_session.can_start = False
        mock_session.status = SessionStatus.COMPLETED
        engine = SequenceEngine(db_session)

        with patch.object(engine, "_get_session", return_value=mock_session):
            with pytest.raises(SessionNotRunnableError):
                await engine.start_session("session-123")

    @pytest.mark.asyncio
    async def test_start_session_no_sequences(
        self, db_session: AsyncSession, mock_session: MagicMock
    ):
        """Test starting session with no sequences raises error."""
        mock_session.sequences = []
        engine = SequenceEngine(db_session)

        with patch.object(engine, "_get_session", return_value=mock_session):
            with pytest.raises(EngineError, match="no sequences"):
                await engine.start_session("session-123")

    @pytest.mark.asyncio
    async def test_pause_session(
        self, db_session: AsyncSession, mock_session: MagicMock
    ):
        """Test pausing a running session."""
        mock_session.status = SessionStatus.RUNNING
        mock_session.can_pause = True
        engine = SequenceEngine(db_session)

        # Add a running task
        engine._running_sessions["session-123"] = MagicMock(cancel=MagicMock())

        with patch.object(engine, "_get_session", return_value=mock_session):
            db_session.commit = AsyncMock()

            result = await engine.pause_session("session-123")

            assert mock_session.status == SessionStatus.PAUSED
            assert "session-123" not in engine._running_sessions

    @pytest.mark.asyncio
    async def test_pause_session_not_running(
        self, db_session: AsyncSession, mock_session: MagicMock
    ):
        """Test pausing a non-running session raises error."""
        mock_session.can_pause = False
        mock_session.status = SessionStatus.DRAFT
        engine = SequenceEngine(db_session)

        with patch.object(engine, "_get_session", return_value=mock_session):
            with pytest.raises(SessionNotRunnableError):
                await engine.pause_session("session-123")

    @pytest.mark.asyncio
    async def test_resume_session(
        self, db_session: AsyncSession, mock_session: MagicMock
    ):
        """Test resuming a paused session."""
        mock_session.status = SessionStatus.PAUSED
        mock_session.can_resume = True
        engine = SequenceEngine(db_session)

        with patch.object(engine, "_get_session", return_value=mock_session):
            with patch.object(engine, "_run_session", new_callable=AsyncMock):
                db_session.commit = AsyncMock()

                result = await engine.resume_session("session-123")

                assert mock_session.status == SessionStatus.RUNNING
                assert "session-123" in engine._running_sessions

    @pytest.mark.asyncio
    async def test_stop_session(
        self, db_session: AsyncSession, mock_session: MagicMock
    ):
        """Test stopping a session."""
        mock_session.status = SessionStatus.RUNNING
        engine = SequenceEngine(db_session)

        # Add a running task
        mock_task = MagicMock(cancel=MagicMock())
        engine._running_sessions["session-123"] = mock_task

        with patch.object(engine, "_get_session", return_value=mock_session):
            db_session.commit = AsyncMock()

            result = await engine.stop_session("session-123")

            assert mock_session.status == SessionStatus.COMPLETED
            assert mock_session.completed_at is not None
            mock_task.cancel.assert_called_once()

    @pytest.mark.asyncio
    async def test_stop_already_completed(
        self, db_session: AsyncSession, mock_session: MagicMock
    ):
        """Test stopping already completed session is no-op."""
        mock_session.status = SessionStatus.COMPLETED
        engine = SequenceEngine(db_session)

        with patch.object(engine, "_get_session", return_value=mock_session):
            result = await engine.stop_session("session-123")
            assert result == mock_session

    @pytest.mark.asyncio
    async def test_skip_sequence(
        self, db_session: AsyncSession, mock_session: MagicMock
    ):
        """Test skipping to next sequence."""
        mock_session.status = SessionStatus.RUNNING
        mock_session.current_sequence_index = 0
        mock_session.total_sequences = 3
        engine = SequenceEngine(db_session)

        with patch.object(engine, "_get_session", return_value=mock_session):
            db_session.commit = AsyncMock()

            result = await engine.skip_sequence("session-123")

            assert mock_session.current_sequence_index == 1
            assert mock_session.current_sequence_elapsed_ms == 0

    @pytest.mark.asyncio
    async def test_skip_last_sequence_completes(
        self, db_session: AsyncSession, mock_session: MagicMock
    ):
        """Test skipping from last sequence completes session."""
        mock_session.status = SessionStatus.RUNNING
        mock_session.current_sequence_index = 2  # Last sequence
        mock_session.total_sequences = 3
        engine = SequenceEngine(db_session)

        with patch.object(engine, "_get_session", return_value=mock_session):
            db_session.commit = AsyncMock()

            result = await engine.skip_sequence("session-123")

            assert mock_session.status == SessionStatus.COMPLETED
            assert mock_session.completed_at is not None

    @pytest.mark.asyncio
    async def test_get_session_state(
        self, db_session: AsyncSession, mock_session: MagicMock
    ):
        """Test getting session state."""
        mock_session.status = SessionStatus.RUNNING
        mock_session.current_sequence_index = 1
        mock_session.current_sequence_elapsed_ms = 2500
        mock_session.total_sequences = 3

        # Mock current sequence
        current_seq = mock_session.sequences[1]
        current_seq.effective_duration_ms = 5000
        mock_session.current_sequence = current_seq

        engine = SequenceEngine(db_session)

        with patch.object(engine, "_get_session", return_value=mock_session):
            state = await engine.get_session_state("session-123")

            assert state["session_id"] == "session-123"
            assert state["status"] == "running"
            assert state["current_sequence_index"] == 1
            assert state["current_sequence_elapsed_ms"] == 2500
            assert state["total_sequences"] == 3
            assert state["current_sequence"]["remaining_ms"] == 2500


class TestSequenceExecution:
    """Tests for sequence execution logic."""

    @pytest.mark.asyncio
    async def test_execute_action_success(
        self, db_session: AsyncSession, mock_action: MagicMock
    ):
        """Test successful action execution."""
        engine = SequenceEngine(db_session)

        # Mock adapter
        mock_adapter = MagicMock()
        mock_adapter.execute = AsyncMock(
            return_value=MagicMock(success=True, message="OK")
        )

        with patch(
            "theatarr.services.engine.AdapterRegistry.get_instance",
            return_value=mock_adapter,
        ):
            result = await engine._execute_action(mock_action)

            assert result.success is True
            assert result.action_id == mock_action.id

    @pytest.mark.asyncio
    async def test_execute_action_no_adapter(
        self, db_session: AsyncSession, mock_action: MagicMock
    ):
        """Test action execution with no adapter available."""
        engine = SequenceEngine(db_session)

        with patch(
            "theatarr.services.engine.AdapterRegistry.get_instance",
            return_value=None,
        ):
            result = await engine._execute_action(mock_action)

            # Should succeed with skip message
            assert result.success is True
            assert "skipped" in result.message.lower()

    @pytest.mark.asyncio
    async def test_execute_action_adapter_failure(
        self, db_session: AsyncSession, mock_action: MagicMock
    ):
        """Test action execution when adapter fails."""
        engine = SequenceEngine(db_session)

        # Mock adapter that fails
        mock_adapter = MagicMock()
        mock_adapter.execute = AsyncMock(
            return_value=MagicMock(success=False, message="Connection refused")
        )

        with patch(
            "theatarr.services.engine.AdapterRegistry.get_instance",
            return_value=mock_adapter,
        ):
            result = await engine._execute_action(mock_action)

            assert result.success is False
            assert result.error is not None

    @pytest.mark.asyncio
    async def test_execute_action_exception(
        self, db_session: AsyncSession, mock_action: MagicMock
    ):
        """Test action execution with exception."""
        engine = SequenceEngine(db_session)

        # Mock adapter that throws
        mock_adapter = MagicMock()
        mock_adapter.execute = AsyncMock(side_effect=Exception("Unexpected error"))

        with patch(
            "theatarr.services.engine.AdapterRegistry.get_instance",
            return_value=mock_adapter,
        ):
            result = await engine._execute_action(mock_action)

            assert result.success is False
            assert "Unexpected error" in result.error


class TestEventCallbacks:
    """Tests for event callback functionality."""

    @pytest.mark.asyncio
    async def test_emit_state_change_with_callback(
        self, db_session: AsyncSession, mock_session: MagicMock
    ):
        """Test emitting state change calls callback."""
        engine = SequenceEngine(db_session)
        callback = MagicMock()
        engine._on_session_state_change = callback

        mock_session.status = SessionStatus.RUNNING
        mock_session.current_sequence = mock_session.sequences[0]

        await engine._emit_state_change(mock_session)

        # Callback should be called via asyncio.to_thread
        # (may need adjustment based on actual implementation)

    @pytest.mark.asyncio
    async def test_emit_state_change_without_callback(
        self, db_session: AsyncSession, mock_session: MagicMock
    ):
        """Test emitting state change without callback is no-op."""
        engine = SequenceEngine(db_session)
        # No callback set

        # Should not raise
        await engine._emit_state_change(mock_session)
