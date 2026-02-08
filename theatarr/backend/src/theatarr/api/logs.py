"""Session history and logs API router for Theatarr."""

import logging
from collections import deque
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from theatarr.database import get_db
from theatarr.api.deps import get_current_user, AdminUser
from theatarr.models import User, Session
from theatarr.schemas.base import PaginatedResponse


router = APIRouter(prefix="/logs", tags=["logs"])


# ============================================================================
# In-memory log buffer (captures Python logging output)
# ============================================================================

MAX_LOG_ENTRIES = 2000


class LogEntry(BaseModel):
    """A single log entry."""

    timestamp: str
    level: str
    logger_name: str
    message: str


_log_buffer: deque[dict] = deque(maxlen=MAX_LOG_ENTRIES)


class BufferedLogHandler(logging.Handler):
    """Logging handler that stores entries in a memory buffer."""

    def emit(self, record: logging.LogRecord) -> None:
        try:
            _log_buffer.append({
                "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
                "level": record.levelname,
                "logger_name": record.name,
                "message": self.format(record),
            })
        except Exception:
            pass


def setup_log_capture() -> None:
    """Install the buffered log handler on the root logger."""
    handler = BufferedLogHandler()
    handler.setLevel(logging.DEBUG)
    handler.setFormatter(logging.Formatter("%(message)s"))
    logging.getLogger().addHandler(handler)
    # Also ensure root logger captures everything
    logging.getLogger().setLevel(logging.DEBUG)


# ============================================================================
# Schemas
# ============================================================================


class SessionLogEntry(BaseModel):
    """Log entry for a session event."""

    id: str
    session_id: str
    session_name: str
    event_type: str
    event_data: dict | None
    timestamp: datetime
    user_id: str | None
    user_name: str | None


class SessionHistory(BaseModel):
    """Session history record."""

    id: str
    name: str
    status: str
    movie_title: str | None
    started_at: datetime | None
    completed_at: datetime | None
    duration_seconds: int | None
    sequences_completed: int
    total_sequences: int


class DailyStats(BaseModel):
    """Daily session statistics."""

    date: str
    sessions_started: int
    sessions_completed: int
    total_duration_minutes: int


class SessionStatsResponse(BaseModel):
    """Session statistics response."""

    total_sessions: int
    sessions_today: int
    sessions_this_week: int
    sessions_this_month: int
    avg_session_duration_minutes: float
    total_playback_hours: float
    most_played_movie: str | None
    daily_stats: list[DailyStats]


# ============================================================================
# Endpoints
# ============================================================================


@router.get("/sessions/history")
async def get_session_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaginatedResponse[SessionHistory]:
    """Get paginated session history."""
    query = select(Session).order_by(desc(Session.created_at))

    if status:
        query = query.where(Session.status == status)

    # Count total
    count_query = select(func.count()).select_from(Session)
    if status:
        count_query = count_query.where(Session.status == status)
    total = (await db.execute(count_query)).scalar() or 0

    # Get paginated results
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)
    result = await db.execute(query)
    sessions = result.scalars().all()

    items = []
    for session in sessions:
        # Calculate duration if session has both started_at and completed times
        duration = None
        if session.started_at and session.status == "completed":
            # Estimate completion time from updated_at
            if hasattr(session, 'updated_at') and session.updated_at:
                duration = int((session.updated_at - session.started_at).total_seconds())

        items.append(SessionHistory(
            id=session.id,
            name=session.name,
            status=session.status,
            movie_title=session.movie.title if session.movie else None,
            started_at=session.started_at,
            completed_at=session.updated_at if session.status == "completed" else None,
            duration_seconds=duration,
            sequences_completed=session.current_sequence_index or 0,
            total_sequences=len(session.sequences) if session.sequences else 0,
        ))

    return PaginatedResponse.create(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/sessions/stats", response_model=SessionStatsResponse)
async def get_session_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SessionStatsResponse:
    """Get session statistics."""
    from datetime import timedelta

    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=now.weekday())
    month_start = today_start.replace(day=1)

    # Total sessions
    total = (await db.execute(select(func.count()).select_from(Session))).scalar() or 0

    # Sessions today
    today_count = (await db.execute(
        select(func.count())
        .select_from(Session)
        .where(Session.created_at >= today_start)
    )).scalar() or 0

    # Sessions this week
    week_count = (await db.execute(
        select(func.count())
        .select_from(Session)
        .where(Session.created_at >= week_start)
    )).scalar() or 0

    # Sessions this month
    month_count = (await db.execute(
        select(func.count())
        .select_from(Session)
        .where(Session.created_at >= month_start)
    )).scalar() or 0

    # Calculate average duration and total playback
    # For now, use estimated values based on session count
    avg_duration = 120.0  # Default 2 hours average
    total_hours = (total * avg_duration) / 60.0

    # Daily stats for last 7 days
    daily_stats = []
    for i in range(7):
        date = today_start - timedelta(days=i)
        next_date = date + timedelta(days=1)

        day_count = (await db.execute(
            select(func.count())
            .select_from(Session)
            .where(Session.created_at >= date)
            .where(Session.created_at < next_date)
        )).scalar() or 0

        completed_count = (await db.execute(
            select(func.count())
            .select_from(Session)
            .where(Session.created_at >= date)
            .where(Session.created_at < next_date)
            .where(Session.status == "completed")
        )).scalar() or 0

        daily_stats.append(DailyStats(
            date=date.strftime("%Y-%m-%d"),
            sessions_started=day_count,
            sessions_completed=completed_count,
            total_duration_minutes=completed_count * 120,  # Estimate
        ))

    return SessionStatsResponse(
        total_sessions=total,
        sessions_today=today_count,
        sessions_this_week=week_count,
        sessions_this_month=month_count,
        avg_session_duration_minutes=avg_duration,
        total_playback_hours=total_hours,
        most_played_movie=None,  # Would need movie tracking
        daily_stats=daily_stats,
    )


@router.get("/sessions/{session_id}/events")
async def get_session_events(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[SessionLogEntry]:
    """Get event log for a specific session.

    Note: In a full implementation, this would query a separate events/audit log table.
    For now, we generate synthetic events based on session state.
    """
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()

    if not session:
        return []

    events = []

    # Session created event
    events.append(SessionLogEntry(
        id=f"{session_id}_created",
        session_id=session_id,
        session_name=session.name,
        event_type="session_created",
        event_data={"name": session.name},
        timestamp=session.created_at,
        user_id=None,
        user_name=None,
    ))

    # Session started event
    if session.started_at:
        events.append(SessionLogEntry(
            id=f"{session_id}_started",
            session_id=session_id,
            session_name=session.name,
            event_type="session_started",
            event_data=None,
            timestamp=session.started_at,
            user_id=None,
            user_name=None,
        ))

    # Add sequence events if session has been running
    if session.sequences and session.current_sequence_index:
        for i, seq in enumerate(session.sequences[:session.current_sequence_index]):
            events.append(SessionLogEntry(
                id=f"{session_id}_seq_{i}",
                session_id=session_id,
                session_name=session.name,
                event_type="sequence_completed",
                event_data={"sequence_name": seq.name, "sequence_index": i},
                timestamp=session.started_at + timedelta(seconds=i * 60),  # Estimate
                user_id=None,
                user_name=None,
            ))

    # Session completed/stopped event
    if session.status in ["completed", "stopped"]:
        events.append(SessionLogEntry(
            id=f"{session_id}_{session.status}",
            session_id=session_id,
            session_name=session.name,
            event_type=f"session_{session.status}",
            event_data=None,
            timestamp=session.updated_at,
            user_id=None,
            user_name=None,
        ))

    return sorted(events, key=lambda e: e.timestamp)


@router.get("/activity/recent")
async def get_recent_activity(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[SessionLogEntry]:
    """Get recent activity across all sessions."""
    result = await db.execute(
        select(Session)
        .order_by(desc(Session.updated_at))
        .limit(limit)
    )
    sessions = result.scalars().all()

    events = []
    for session in sessions:
        # Add the most recent event for each session
        if session.status == "running":
            event_type = "session_running"
        elif session.status == "completed":
            event_type = "session_completed"
        elif session.status == "paused":
            event_type = "session_paused"
        else:
            event_type = "session_updated"

        events.append(SessionLogEntry(
            id=f"{session.id}_recent",
            session_id=session.id,
            session_name=session.name,
            event_type=event_type,
            event_data={"status": session.status},
            timestamp=session.updated_at,
            user_id=None,
            user_name=None,
        ))

    return sorted(events, key=lambda e: e.timestamp, reverse=True)


# ============================================================================
# System Logs (Python logging captured in-memory)
# ============================================================================


@router.get("/system", response_model=list[LogEntry])
async def get_system_logs(
    current_user: AdminUser,
    level: Optional[str] = Query(None, description="Filter by level: DEBUG, INFO, WARNING, ERROR"),
    category: Optional[str] = Query(None, description="Filter by category: scheduler, sessions, vote, services, enrichment, movies, auth, system"),
    search: Optional[str] = Query(None, description="Search in message text"),
    limit: int = Query(200, ge=1, le=2000),
) -> list[LogEntry]:
    """Get system logs from in-memory buffer.

    Categories map to logger name prefixes:
    - scheduler: theatarr.services.scheduler
    - sessions: theatarr.api.sessions, theatarr.services.engine
    - vote: theatarr.api.vote, theatarr.services.vote, theatarr.api.portal
    - services: theatarr.api.services, theatarr.adapters
    - enrichment: theatarr.services.movie_enrichment, theatarr.services.movie_sync, theatarr.services.movie_resolution
    - movies: theatarr.api.movies
    - auth: theatarr.api.auth, theatarr.api.deps
    - system: uvicorn, sqlalchemy (excluded by default)
    """
    CATEGORY_PREFIXES = {
        "scheduler": ["theatarr.services.scheduler"],
        "sessions": ["theatarr.api.sessions", "theatarr.services.engine"],
        "vote": ["theatarr.api.vote", "theatarr.services.vote", "theatarr.api.portal"],
        "services": ["theatarr.api.services", "theatarr.adapters"],
        "enrichment": [
            "theatarr.services.movie_enrichment",
            "theatarr.services.movie_sync",
            "theatarr.services.movie_resolution",
            "theatarr.services.palette",
        ],
        "movies": ["theatarr.api.movies"],
        "auth": ["theatarr.api.auth", "theatarr.api.deps"],
        "system": ["uvicorn", "fastapi"],
    }

    results = []
    for entry in reversed(_log_buffer):
        # Filter by level
        if level and entry["level"] != level.upper():
            continue

        # Filter by category
        if category:
            prefixes = CATEGORY_PREFIXES.get(category, [])
            if prefixes and not any(entry["logger_name"].startswith(p) for p in prefixes):
                continue
            # Exclude sqlalchemy noise unless explicitly requested
            if category != "system" and entry["logger_name"].startswith("sqlalchemy"):
                continue

        # Exclude sqlalchemy by default (too noisy)
        if not category and entry["logger_name"].startswith("sqlalchemy"):
            continue

        # Search filter
        if search and search.lower() not in entry["message"].lower():
            continue

        results.append(LogEntry(**entry))

        if len(results) >= limit:
            break

    return results
