"""Persistent session event logger.

Provides a lightweight helper to persist SessionEvent rows.
Never raises — failures are logged as warnings so the engine is never blocked.
"""

import logging
from datetime import datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def log_session_event(
    session_id: str,
    event_type: str,
    data: dict[str, Any] | None = None,
    *,
    db: AsyncSession | None = None,
) -> None:
    """Persist a session event row.

    Args:
        session_id: The session this event belongs to.
        event_type: Short event name (e.g. "session_started").
        data: Optional JSON-serialisable dict with event details.
        db: If provided, the event is added to this session (caller commits).
            Otherwise a dedicated ephemeral session is created and committed.
    """
    try:
        from theatarr.models.session_event import SessionEvent

        event = SessionEvent(
            session_id=session_id,
            event_type=event_type,
            timestamp=datetime.now(),
            data=data,
        )

        if db is not None:
            db.add(event)
            # Caller is responsible for commit
        else:
            from theatarr.database import async_session_maker

            async with async_session_maker() as ephemeral_db:
                ephemeral_db.add(event)
                await ephemeral_db.commit()
    except Exception:
        logger.warning(
            "Failed to log session event %s for session %s",
            event_type,
            session_id,
            exc_info=True,
        )
