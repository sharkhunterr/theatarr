"""Session scheduler service for Theatarr.

Handles scheduled session starts, mystery movie reveals,
and auto-resume after system restart.
"""

import asyncio
import logging
from datetime import datetime, timedelta

from sqlalchemy import select

from theatarr.config import settings
from theatarr.database import async_session_maker
from theatarr.models.session import MovieSelectionMode, Session, SessionStatus

logger = logging.getLogger(__name__)


class SessionScheduler:
    """Scheduler for managing session timing and auto-resume.

    Creates its own DB sessions per cycle to avoid stale connections.
    """

    def __init__(self) -> None:
        self._running = False
        self._task: asyncio.Task | None = None
        self._check_interval = 30  # Check every 30 seconds

    async def start(self) -> None:
        """Start the scheduler."""
        if self._running:
            return

        self._running = True
        self._task = asyncio.create_task(self._scheduler_loop())
        logger.info("Session scheduler started (interval: %ds)", self._check_interval)

        # Check for sessions to auto-resume on startup
        if settings.auto_resume_sessions:
            await self._auto_resume_interrupted_sessions()

    async def stop(self) -> None:
        """Stop the scheduler."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        logger.info("Session scheduler stopped")

    async def _scheduler_loop(self) -> None:
        """Main scheduler loop."""
        while self._running:
            try:
                await self._check_scheduled_sessions()
                await self._check_mystery_reveals()
                await asyncio.sleep(self._check_interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.exception(f"Error in scheduler loop: {e}")
                await asyncio.sleep(self._check_interval)

    async def _check_scheduled_sessions(self) -> None:
        """Check and start any scheduled sessions that are due."""
        from theatarr.services.engine import get_engine

        # Use naive local time since DB stores naive local datetimes
        now = datetime.now()
        check_time = now + timedelta(seconds=5)

        async with async_session_maker() as db:
            result = await db.execute(
                select(Session).where(
                    Session.status == SessionStatus.SCHEDULED,
                    Session.scheduled_at <= check_time,
                )
            )
            sessions = result.scalars().all()

            if not sessions:
                return

            engine = get_engine(db)

            for session in sessions:
                try:
                    logger.info(f"Starting scheduled session: {session.id} ({session.name})")
                    await engine.start_session(session.id)
                except Exception as e:
                    logger.exception(f"Failed to start scheduled session {session.id}: {e}")

    async def _check_mystery_reveals(self) -> None:
        """Check and reveal any mystery movies that are due."""
        from theatarr.api.ws import ws_manager, Channel
        from theatarr.services.movie_resolution import (
            resolve_mystery_movie,
            MovieResolutionError,
        )

        # Use naive local time since DB stores naive local datetimes
        now = datetime.now()

        async with async_session_maker() as db:
            # First, log all pending mystery sessions for debugging
            pending = await db.execute(
                select(Session).where(
                    Session.movie_selection_mode == MovieSelectionMode.MYSTERY.value,
                    Session.movie_resolved == False,
                )
            )
            pending_sessions = pending.scalars().all()
            for ps in pending_sessions:
                reveal_at = ps.mystery_reveal_at
                if reveal_at:
                    delta = (reveal_at - now).total_seconds()
                    logger.debug(
                        "Mystery session '%s' (%s): reveal_at=%s, now=%s, delta=%.0fs (%s)",
                        ps.name, ps.id, reveal_at, now.isoformat(),
                        delta, "due" if delta <= 0 else f"in {delta:.0f}s",
                    )
                else:
                    logger.debug(
                        "Mystery session '%s' (%s): no reveal_at set",
                        ps.name, ps.id,
                    )

            result = await db.execute(
                select(Session).where(
                    Session.movie_selection_mode == MovieSelectionMode.MYSTERY.value,
                    Session.movie_resolved == False,
                    Session.mystery_reveal_at <= now,
                )
            )
            sessions = result.scalars().all()

            if sessions:
                logger.info("Found %d mystery sessions ready to reveal", len(sessions))

            for session in sessions:
                try:
                    logger.info(f"Revealing mystery movie for session: {session.id} ({session.name})")
                    await resolve_mystery_movie(db, session)

                    # Broadcast movie resolved event via WebSocket
                    await ws_manager.broadcast(
                        Channel.SESSION.value,
                        {
                            "type": "movie_resolved",
                            "payload": {
                                "session_id": session.id,
                                "movie_title": session.movie_title,
                                "movie_poster_url": session.movie_poster_url,
                                "selection_mode": "mystery",
                            },
                        },
                    )
                    logger.info(f"Mystery movie revealed for session {session.id}: {session.movie_title}")

                except MovieResolutionError as e:
                    logger.exception(f"Failed to reveal mystery movie for session {session.id}: {e}")

    async def _auto_resume_interrupted_sessions(self) -> None:
        """Auto-resume sessions that were interrupted (e.g., by system restart)."""
        from theatarr.services.engine import get_engine

        async with async_session_maker() as db:
            result = await db.execute(
                select(Session).where(
                    Session.status == SessionStatus.INTERRUPTED,
                    Session.auto_resume_enabled == True,
                )
            )
            sessions = result.scalars().all()

            if not sessions:
                return

            logger.info(f"Found {len(sessions)} interrupted sessions to auto-resume")
            engine = get_engine(db)

            for session in sessions:
                try:
                    logger.info(f"Auto-resuming session: {session.id} ({session.name})")
                    session.status = SessionStatus.PAUSED
                    await db.commit()
                    await engine.resume_session(session.id)
                except Exception as e:
                    logger.exception(f"Failed to auto-resume session {session.id}: {e}")


# Global scheduler instance
_scheduler: SessionScheduler | None = None


def get_scheduler() -> SessionScheduler:
    """Get or create scheduler instance."""
    global _scheduler
    if _scheduler is None:
        _scheduler = SessionScheduler()
    return _scheduler
