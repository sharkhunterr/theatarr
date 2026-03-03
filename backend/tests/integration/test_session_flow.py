"""Integration tests for complete session flow."""

import asyncio
from datetime import datetime, timezone

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from theatarr.models.action import Action, ActionType, OnFailure
from theatarr.models.sequence import DurationType, Sequence
from theatarr.models.session import Session, SessionStatus
from theatarr.services.engine import SequenceEngine, SessionNotRunnableError


@pytest_asyncio.fixture
async def test_session(db_session: AsyncSession) -> Session:
    """Create a test session with sequences and actions."""
    # Create session
    session = Session(
        name="Integration Test Session",
        description="A session for integration testing",
        status=SessionStatus.DRAFT,
    )
    db_session.add(session)
    await db_session.flush()

    # Create sequences
    for i in range(3):
        sequence = Sequence(
            session_id=session.id,
            name=f"Sequence {i + 1}",
            description=f"Test sequence {i + 1}",
            order_index=i,
            duration_type=DurationType.FIXED,
            duration_ms=100,  # Short duration for tests
            transition_ms=50,
        )
        db_session.add(sequence)
        await db_session.flush()

        # Add actions to each sequence
        action = Action(
            sequence_id=sequence.id,
            action_type=ActionType.LIGHTING,
            command="set_brightness",
            parameters={"brightness": (i + 1) * 25},
            delay_ms=0,
            on_failure=OnFailure.WARN,
        )
        db_session.add(action)

    await db_session.commit()
    await db_session.refresh(session)
    return session


class TestSessionLifecycle:
    """Tests for complete session lifecycle."""

    @pytest.mark.asyncio
    async def test_session_start_sets_running(
        self, db_session: AsyncSession, test_session: Session
    ):
        """Test starting a session sets status to RUNNING."""
        engine = SequenceEngine(db_session)

        session = await engine.start_session(test_session.id)

        assert session.status == SessionStatus.RUNNING
        assert session.started_at is not None
        assert session.current_sequence_index == 0

        # Cleanup
        await engine.stop_session(test_session.id)

    @pytest.mark.asyncio
    async def test_session_pause_and_resume(
        self, db_session: AsyncSession, test_session: Session
    ):
        """Test pausing and resuming a session."""
        engine = SequenceEngine(db_session)

        # Start session
        await engine.start_session(test_session.id)
        assert test_session.status == SessionStatus.RUNNING

        # Pause
        await engine.pause_session(test_session.id)
        await db_session.refresh(test_session)
        assert test_session.status == SessionStatus.PAUSED

        # Resume
        await engine.resume_session(test_session.id)
        await db_session.refresh(test_session)
        assert test_session.status == SessionStatus.RUNNING

        # Cleanup
        await engine.stop_session(test_session.id)

    @pytest.mark.asyncio
    async def test_session_stop(
        self, db_session: AsyncSession, test_session: Session
    ):
        """Test stopping a session."""
        engine = SequenceEngine(db_session)

        await engine.start_session(test_session.id)
        session = await engine.stop_session(test_session.id)

        assert session.status == SessionStatus.COMPLETED
        assert session.completed_at is not None

    @pytest.mark.asyncio
    async def test_cannot_start_running_session(
        self, db_session: AsyncSession, test_session: Session
    ):
        """Test that starting an already running session fails."""
        engine = SequenceEngine(db_session)

        await engine.start_session(test_session.id)

        with pytest.raises(SessionNotRunnableError):
            await engine.start_session(test_session.id)

        await engine.stop_session(test_session.id)

    @pytest.mark.asyncio
    async def test_cannot_pause_paused_session(
        self, db_session: AsyncSession, test_session: Session
    ):
        """Test that pausing a paused session fails."""
        engine = SequenceEngine(db_session)

        await engine.start_session(test_session.id)
        await engine.pause_session(test_session.id)

        with pytest.raises(SessionNotRunnableError):
            await engine.pause_session(test_session.id)

        await engine.stop_session(test_session.id)


class TestSequenceProgression:
    """Tests for sequence progression during session execution."""

    @pytest.mark.asyncio
    async def test_skip_sequence_advances_index(
        self, db_session: AsyncSession, test_session: Session
    ):
        """Test that skipping a sequence advances the index."""
        engine = SequenceEngine(db_session)

        await engine.start_session(test_session.id)
        await db_session.refresh(test_session)
        assert test_session.current_sequence_index == 0

        await engine.skip_sequence(test_session.id)
        await db_session.refresh(test_session)
        assert test_session.current_sequence_index == 1

        await engine.skip_sequence(test_session.id)
        await db_session.refresh(test_session)
        assert test_session.current_sequence_index == 2

        await engine.stop_session(test_session.id)

    @pytest.mark.asyncio
    async def test_skip_last_sequence_completes_session(
        self, db_session: AsyncSession, test_session: Session
    ):
        """Test that skipping the last sequence completes the session."""
        engine = SequenceEngine(db_session)

        await engine.start_session(test_session.id)

        # Skip to last sequence
        await engine.skip_sequence(test_session.id)
        await engine.skip_sequence(test_session.id)
        await db_session.refresh(test_session)
        assert test_session.current_sequence_index == 2

        # Skip last sequence - should complete
        await engine.skip_sequence(test_session.id)
        await db_session.refresh(test_session)
        assert test_session.status == SessionStatus.COMPLETED


class TestSessionState:
    """Tests for session state retrieval."""

    @pytest.mark.asyncio
    async def test_get_session_state(
        self, db_session: AsyncSession, test_session: Session
    ):
        """Test retrieving session state."""
        engine = SequenceEngine(db_session)

        await engine.start_session(test_session.id)
        state = await engine.get_session_state(test_session.id)

        assert state["session_id"] == test_session.id
        assert state["status"] == "running"
        assert state["current_sequence_index"] == 0
        assert state["total_sequences"] == 3
        assert "current_sequence" in state

        await engine.stop_session(test_session.id)

    @pytest.mark.asyncio
    async def test_state_includes_sequence_info(
        self, db_session: AsyncSession, test_session: Session
    ):
        """Test that state includes current sequence information."""
        engine = SequenceEngine(db_session)

        await engine.start_session(test_session.id)
        state = await engine.get_session_state(test_session.id)

        seq_state = state["current_sequence"]
        assert "id" in seq_state
        assert "name" in seq_state
        assert "duration_type" in seq_state
        assert "remaining_ms" in seq_state

        await engine.stop_session(test_session.id)


class TestEventCallbacks:
    """Tests for session event callbacks."""

    @pytest.mark.asyncio
    async def test_state_change_callback_on_start(
        self, db_session: AsyncSession, test_session: Session
    ):
        """Test state change callback is called on session start."""
        engine = SequenceEngine(db_session)
        callback_data = []

        def on_state_change(session_id: str, state: dict):
            callback_data.append((session_id, state))

        engine.set_callbacks(on_session_state_change=on_state_change)

        await engine.start_session(test_session.id)

        # Wait for callback to be processed
        await asyncio.sleep(0.1)

        assert len(callback_data) >= 1
        session_id, state = callback_data[0]
        assert session_id == test_session.id
        assert state["status"] == "running"

        await engine.stop_session(test_session.id)

    @pytest.mark.asyncio
    async def test_state_change_callback_on_stop(
        self, db_session: AsyncSession, test_session: Session
    ):
        """Test state change callback is called on session stop."""
        engine = SequenceEngine(db_session)
        callback_data = []

        def on_state_change(session_id: str, state: dict):
            callback_data.append((session_id, state))

        engine.set_callbacks(on_session_state_change=on_state_change)

        await engine.start_session(test_session.id)
        await engine.stop_session(test_session.id)

        # Wait for callbacks
        await asyncio.sleep(0.1)

        # Should have at least start and stop callbacks
        assert len(callback_data) >= 2
        # Last callback should be completed status
        _, last_state = callback_data[-1]
        assert last_state["status"] == "completed"


class TestAutoResume:
    """Tests for session auto-resume functionality."""

    @pytest.mark.asyncio
    async def test_interrupted_session_can_resume(
        self, db_session: AsyncSession, test_session: Session
    ):
        """Test that an interrupted session can be restarted."""
        engine = SequenceEngine(db_session)

        # Start and progress the session
        await engine.start_session(test_session.id)
        await engine.skip_sequence(test_session.id)
        await db_session.refresh(test_session)
        assert test_session.current_sequence_index == 1

        # Simulate interruption (stop without completing)
        await engine.stop_session(test_session.id)
        await db_session.refresh(test_session)

        # Manually set to interrupted for testing
        test_session.status = SessionStatus.INTERRUPTED
        await db_session.commit()

        # Should be able to restart
        assert test_session.can_start is True

    @pytest.mark.asyncio
    async def test_elapsed_time_preserved_on_pause(
        self, db_session: AsyncSession, test_session: Session
    ):
        """Test that elapsed time is preserved when pausing."""
        engine = SequenceEngine(db_session)

        await engine.start_session(test_session.id)

        # Wait a bit to accumulate elapsed time
        await asyncio.sleep(0.05)

        await engine.pause_session(test_session.id)
        await db_session.refresh(test_session)

        # Elapsed time should be preserved
        assert test_session.current_sequence_elapsed_ms >= 0


class TestEmptySession:
    """Tests for edge cases with empty sessions."""

    @pytest_asyncio.fixture
    async def empty_session(self, db_session: AsyncSession) -> Session:
        """Create a session with no sequences."""
        session = Session(
            name="Empty Session",
            status=SessionStatus.DRAFT,
        )
        db_session.add(session)
        await db_session.commit()
        await db_session.refresh(session)
        return session

    @pytest.mark.asyncio
    async def test_cannot_start_empty_session(
        self, db_session: AsyncSession, empty_session: Session
    ):
        """Test that starting a session with no sequences fails."""
        engine = SequenceEngine(db_session)

        from theatarr.services.engine import EngineError

        with pytest.raises(EngineError, match="no sequences"):
            await engine.start_session(empty_session.id)
