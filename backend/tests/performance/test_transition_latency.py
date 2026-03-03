"""Performance tests for transition latency.

Verifies that transitions meet the <200ms target (excluding intentional delays).
"""

import pytest
import asyncio
import time
from unittest.mock import AsyncMock, MagicMock, patch

from theatarr.services.engine import SequenceEngine, TRANSITION_OVERHEAD_TARGET_MS
from theatarr.models.session import Session, SessionStatus
from theatarr.models.sequence import Sequence, DurationType
from theatarr.utils.performance import get_performance_monitor, PerformanceMonitor


class TestTransitionLatency:
    """Performance tests for sequence transitions."""

    @pytest.fixture
    def mock_db(self):
        """Create a mock database session."""
        db = AsyncMock()
        db.commit = AsyncMock()
        db.refresh = AsyncMock()
        return db

    @pytest.fixture
    def mock_session(self) -> Session:
        """Create a mock session with sequences."""
        session = MagicMock(spec=Session)
        session.id = "perf-test-session"
        session.status = SessionStatus.RUNNING
        session.current_sequence_index = 0
        session.current_sequence_elapsed_ms = 0
        session.total_sequences = 3

        # Create mock sequences
        sequences = []
        for i in range(3):
            seq = MagicMock(spec=Sequence)
            seq.id = f"seq-{i}"
            seq.name = f"Sequence {i}"
            seq.order_index = i
            seq.duration_type = DurationType.FIXED
            seq.duration_ms = 1000
            seq.transition_ms = 0  # No intentional delay for perf testing
            seq.actions = []
            sequences.append(seq)

        session.sequences = sequences
        session.current_sequence = sequences[0]

        return session

    @pytest.fixture
    def engine(self, mock_db) -> SequenceEngine:
        """Create engine instance."""
        return SequenceEngine(mock_db)

    @pytest.fixture
    def performance_monitor(self) -> PerformanceMonitor:
        """Get fresh performance monitor."""
        monitor = get_performance_monitor()
        monitor.clear()
        return monitor

    @pytest.mark.asyncio
    async def test_transition_overhead_under_target(
        self,
        engine: SequenceEngine,
        mock_session: Session,
        performance_monitor: PerformanceMonitor,
    ):
        """Test that transition overhead is under 200ms target."""
        # Run multiple transitions to get average
        num_transitions = 10

        for i in range(num_transitions):
            mock_session.current_sequence_index = i % 2  # Alternate between 0 and 1
            mock_session.current_sequence = mock_session.sequences[
                mock_session.current_sequence_index
            ]

            start = time.perf_counter()
            await engine._transition_to_next_sequence(mock_session)
            elapsed_ms = (time.perf_counter() - start) * 1000

            # Each individual transition should be fast
            assert elapsed_ms < TRANSITION_OVERHEAD_TARGET_MS * 2, (
                f"Single transition took {elapsed_ms:.2f}ms, "
                f"expected <{TRANSITION_OVERHEAD_TARGET_MS * 2}ms"
            )

        # Check stats from monitor
        stats = performance_monitor.get_stats("transition_overhead")
        assert stats["count"] >= num_transitions

        # P95 should be under target
        assert stats["p95_ms"] < TRANSITION_OVERHEAD_TARGET_MS, (
            f"P95 transition overhead ({stats['p95_ms']:.2f}ms) "
            f"exceeded target ({TRANSITION_OVERHEAD_TARGET_MS}ms)"
        )

    @pytest.mark.asyncio
    async def test_transition_with_callback_still_fast(
        self,
        engine: SequenceEngine,
        mock_session: Session,
        performance_monitor: PerformanceMonitor,
    ):
        """Test that transitions with callbacks are still fast."""
        callback_calls = []

        def on_transition(session_id: str, data: dict):
            callback_calls.append((session_id, data))

        engine.set_callbacks(on_sequence_transition=on_transition)

        num_transitions = 5
        for _ in range(num_transitions):
            mock_session.current_sequence_index = 0
            mock_session.current_sequence = mock_session.sequences[0]

            start = time.perf_counter()
            await engine._transition_to_next_sequence(mock_session)
            elapsed_ms = (time.perf_counter() - start) * 1000

            assert elapsed_ms < TRANSITION_OVERHEAD_TARGET_MS * 2

        # Verify callbacks were called
        assert len(callback_calls) == num_transitions

    @pytest.mark.asyncio
    async def test_transition_excludes_intentional_delay(
        self,
        engine: SequenceEngine,
        mock_session: Session,
        performance_monitor: PerformanceMonitor,
    ):
        """Test that intentional delays are not counted against overhead."""
        # Set intentional delay
        mock_session.sequences[1].transition_ms = 500  # 500ms intentional delay
        mock_session.current_sequence_index = 0
        mock_session.current_sequence = mock_session.sequences[0]

        start = time.perf_counter()
        await engine._transition_to_next_sequence(mock_session)
        total_elapsed_ms = (time.perf_counter() - start) * 1000

        # Total time should include the delay
        assert total_elapsed_ms >= 500

        # But recorded overhead should be low
        stats = performance_monitor.get_stats("transition_overhead")
        assert stats["count"] >= 1

        # The overhead (excluding delay) should be small
        assert stats["max_ms"] < TRANSITION_OVERHEAD_TARGET_MS

    @pytest.mark.asyncio
    async def test_concurrent_transitions_performance(
        self,
        mock_db,
        performance_monitor: PerformanceMonitor,
    ):
        """Test that concurrent transitions don't degrade performance."""

        async def create_and_transition():
            engine = SequenceEngine(mock_db)
            session = MagicMock(spec=Session)
            session.id = f"concurrent-{id(asyncio.current_task())}"
            session.status = SessionStatus.RUNNING
            session.current_sequence_index = 0
            session.total_sequences = 2

            sequences = []
            for i in range(2):
                seq = MagicMock(spec=Sequence)
                seq.id = f"seq-{i}"
                seq.name = f"Sequence {i}"
                seq.transition_ms = 0
                seq.actions = []
                sequences.append(seq)

            session.sequences = sequences
            session.current_sequence = sequences[0]

            await engine._transition_to_next_sequence(session)

        # Run multiple concurrent transitions
        num_concurrent = 10
        tasks = [create_and_transition() for _ in range(num_concurrent)]

        start = time.perf_counter()
        await asyncio.gather(*tasks)
        total_ms = (time.perf_counter() - start) * 1000

        # All concurrent transitions should complete quickly
        # Even with 10 concurrent, shouldn't take more than a few hundred ms
        assert total_ms < 1000, (
            f"Concurrent transitions took {total_ms:.2f}ms, expected <1000ms"
        )


class TestActionLatency:
    """Performance tests for action execution."""

    @pytest.fixture
    def mock_db(self):
        db = AsyncMock()
        db.commit = AsyncMock()
        return db

    @pytest.fixture
    def engine(self, mock_db) -> SequenceEngine:
        return SequenceEngine(mock_db)

    @pytest.mark.asyncio
    async def test_action_execution_timing(self, engine: SequenceEngine):
        """Test that action execution timing is recorded."""
        from theatarr.models.action import Action, ActionType, OnFailure

        action = MagicMock(spec=Action)
        action.id = "test-action"
        action.action_type = ActionType.LIGHTING
        action.command = "set_brightness"
        action.parameters = {"brightness": 50}
        action.targets = []
        action.on_failure = OnFailure.CONTINUE
        action.service_id = None
        action.delay_ms = 0

        # Mock sequence reference
        action.sequence = MagicMock()
        action.sequence.session_id = "test-session"

        with patch(
            "theatarr.services.engine.AdapterRegistry.get_instance"
        ) as mock_registry:
            mock_adapter = AsyncMock()
            mock_adapter.execute = AsyncMock(
                return_value=MagicMock(success=True, message="OK")
            )
            mock_registry.return_value = mock_adapter

            result = await engine._execute_action(action)

            assert result.success
            assert result.duration_ms > 0
            assert result.duration_ms < 100  # Should be very fast with mocks


class TestPerformanceMonitor:
    """Tests for the performance monitoring utility."""

    def test_monitor_records_metrics(self):
        """Test that monitor records metrics correctly."""
        monitor = PerformanceMonitor()
        monitor.record_sync("test_operation", 50.0)

        stats = monitor.get_stats("test_operation")
        assert stats["count"] == 1
        assert stats["avg_ms"] == 50.0

    def test_monitor_threshold_detection(self):
        """Test that monitor detects threshold violations."""
        monitor = PerformanceMonitor()

        # Record a slow transition
        monitor.record_sync("transition_overhead", 300.0)

        violations = monitor.get_recent_violations()
        assert len(violations) == 1
        assert violations[0].operation == "transition_overhead"

    @pytest.mark.asyncio
    async def test_context_manager_timing(self):
        """Test the async context manager for timing."""
        monitor = PerformanceMonitor()

        async with monitor.measure("test_context"):
            await asyncio.sleep(0.01)  # 10ms

        stats = monitor.get_stats("test_context")
        assert stats["count"] == 1
        assert stats["avg_ms"] >= 10  # At least 10ms

    def test_percentile_calculation(self):
        """Test percentile calculations."""
        monitor = PerformanceMonitor()

        # Record various durations
        for i in range(100):
            monitor.record_sync("percentile_test", float(i))

        stats = monitor.get_stats("percentile_test")
        assert stats["count"] == 100
        assert stats["min_ms"] == 0.0
        assert stats["max_ms"] == 99.0
        assert 45 <= stats["p50_ms"] <= 55  # Median around 50
        assert stats["p95_ms"] >= 90
