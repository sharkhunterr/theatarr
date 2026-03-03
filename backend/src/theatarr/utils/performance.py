"""Performance monitoring utilities for Theatarr.

Provides timing instrumentation and performance verification
to ensure operations meet latency requirements (<200ms for transitions).
"""

import asyncio
import functools
import logging
import time
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, TypeVar

logger = logging.getLogger(__name__)

# Performance thresholds (in milliseconds)
TRANSITION_LATENCY_TARGET_MS = 200
ACTION_EXECUTION_WARNING_MS = 500
DB_QUERY_WARNING_MS = 100

F = TypeVar("F", bound=Callable[..., Any])


@dataclass
class PerformanceMetric:
    """Single performance measurement."""

    operation: str
    duration_ms: float
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    success: bool = True
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def exceeds_threshold(self) -> bool:
        """Check if duration exceeds the target threshold."""
        thresholds = {
            "transition": TRANSITION_LATENCY_TARGET_MS,
            "action": ACTION_EXECUTION_WARNING_MS,
            "db_query": DB_QUERY_WARNING_MS,
        }
        for key, threshold in thresholds.items():
            if key in self.operation.lower():
                return self.duration_ms > threshold
        return self.duration_ms > TRANSITION_LATENCY_TARGET_MS


class PerformanceMonitor:
    """Monitor and track performance metrics.

    Usage:
        monitor = PerformanceMonitor()

        # Context manager for timing
        async with monitor.measure("transition"):
            await do_transition()

        # Decorator for timing
        @monitor.timed("action_execution")
        async def execute_action():
            ...

        # Get statistics
        stats = monitor.get_stats()
    """

    def __init__(self, max_history: int = 1000):
        self._metrics: list[PerformanceMetric] = []
        self._max_history = max_history
        self._lock = asyncio.Lock()

    @asynccontextmanager
    async def measure(self, operation: str, **metadata: Any):
        """Context manager to measure operation duration."""
        start = time.perf_counter()
        success = True

        try:
            yield
        except Exception:
            success = False
            raise
        finally:
            duration_ms = (time.perf_counter() - start) * 1000
            metric = PerformanceMetric(
                operation=operation,
                duration_ms=duration_ms,
                success=success,
                metadata=metadata,
            )
            await self._record_metric(metric)

    def timed(self, operation: str) -> Callable[[F], F]:
        """Decorator to time async functions."""

        def decorator(func: F) -> F:
            @functools.wraps(func)
            async def wrapper(*args: Any, **kwargs: Any) -> Any:
                async with self.measure(operation):
                    return await func(*args, **kwargs)

            return wrapper  # type: ignore

        return decorator

    async def _record_metric(self, metric: PerformanceMetric) -> None:
        """Record a performance metric."""
        async with self._lock:
            self._metrics.append(metric)

            # Trim history if needed
            if len(self._metrics) > self._max_history:
                self._metrics = self._metrics[-self._max_history :]

        # Log warnings for slow operations
        if metric.exceeds_threshold:
            logger.warning(
                f"Slow {metric.operation}: {metric.duration_ms:.2f}ms "
                f"(threshold exceeded)"
            )

    def record_sync(self, operation: str, duration_ms: float, **metadata: Any) -> None:
        """Synchronously record a metric (for use in sync contexts)."""
        metric = PerformanceMetric(
            operation=operation,
            duration_ms=duration_ms,
            metadata=metadata,
        )
        self._metrics.append(metric)

        if metric.exceeds_threshold:
            logger.warning(
                f"Slow {metric.operation}: {metric.duration_ms:.2f}ms "
                f"(threshold exceeded)"
            )

    def get_stats(self, operation: str | None = None) -> dict[str, Any]:
        """Get performance statistics.

        Args:
            operation: Optional filter by operation name

        Returns:
            Dictionary with min, max, avg, p50, p95, p99 latencies
        """
        metrics = self._metrics
        if operation:
            metrics = [m for m in metrics if operation in m.operation]

        if not metrics:
            return {
                "count": 0,
                "min_ms": 0,
                "max_ms": 0,
                "avg_ms": 0,
                "p50_ms": 0,
                "p95_ms": 0,
                "p99_ms": 0,
            }

        durations = sorted(m.duration_ms for m in metrics)
        count = len(durations)

        def percentile(p: float) -> float:
            idx = int(count * p)
            return durations[min(idx, count - 1)]

        return {
            "count": count,
            "min_ms": durations[0],
            "max_ms": durations[-1],
            "avg_ms": sum(durations) / count,
            "p50_ms": percentile(0.5),
            "p95_ms": percentile(0.95),
            "p99_ms": percentile(0.99),
            "threshold_violations": sum(1 for m in metrics if m.exceeds_threshold),
        }

    def get_recent_violations(self, limit: int = 10) -> list[PerformanceMetric]:
        """Get recent threshold violations."""
        violations = [m for m in self._metrics if m.exceeds_threshold]
        return violations[-limit:]

    def clear(self) -> None:
        """Clear all recorded metrics."""
        self._metrics.clear()


# Global performance monitor instance
_monitor: PerformanceMonitor | None = None


def get_performance_monitor() -> PerformanceMonitor:
    """Get the global performance monitor instance."""
    global _monitor
    if _monitor is None:
        _monitor = PerformanceMonitor()
    return _monitor


def measure_transition(func: F) -> F:
    """Decorator specifically for transition timing."""

    @functools.wraps(func)
    async def wrapper(*args: Any, **kwargs: Any) -> Any:
        monitor = get_performance_monitor()
        async with monitor.measure("transition"):
            return await func(*args, **kwargs)

    return wrapper  # type: ignore


def measure_action(func: F) -> F:
    """Decorator specifically for action execution timing."""

    @functools.wraps(func)
    async def wrapper(*args: Any, **kwargs: Any) -> Any:
        monitor = get_performance_monitor()
        async with monitor.measure("action_execution"):
            return await func(*args, **kwargs)

    return wrapper  # type: ignore


async def verify_transition_performance(
    sample_size: int = 100, max_duration_ms: float = TRANSITION_LATENCY_TARGET_MS
) -> dict[str, Any]:
    """Verify that transition performance meets requirements.

    Returns a report on whether the <200ms target is being met.
    """
    monitor = get_performance_monitor()
    stats = monitor.get_stats("transition")

    passed = stats["p95_ms"] <= max_duration_ms if stats["count"] > 0 else True

    return {
        "target_ms": max_duration_ms,
        "passed": passed,
        "sample_count": stats["count"],
        "p95_ms": stats["p95_ms"],
        "p99_ms": stats["p99_ms"],
        "max_ms": stats["max_ms"],
        "avg_ms": stats["avg_ms"],
        "threshold_violations": stats.get("threshold_violations", 0),
        "message": (
            f"P95 latency ({stats['p95_ms']:.2f}ms) "
            f"{'meets' if passed else 'EXCEEDS'} "
            f"target ({max_duration_ms}ms)"
        ),
    }
