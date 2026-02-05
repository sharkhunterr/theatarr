"""Session scheduler service for Theatarr.

Handles scheduled session starts and auto-resume after system restart.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from theatarr.config import settings
from theatarr.models.session import Session, SessionStatus
from theatarr.services.engine import SequenceEngine, get_engine

logger = logging.getLogger(__name__)


class SessionScheduler:
    """Scheduler for managing session timing and auto-resume."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self._running = False
        self._task: asyncio.Task | None = None
        self._check_interval = 30  # Check every 30 seconds

    async def start(self) -> None:
        """Start the scheduler."""
        if self._running:
            return

        self._running = True
        self._task = asyncio.create_task(self._scheduler_loop())
        logger.info("Session scheduler started")

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
                await asyncio.sleep(self._check_interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.exception(f"Error in scheduler loop: {e}")
                await asyncio.sleep(self._check_interval)

    async def _check_scheduled_sessions(self) -> None:
        """Check and start any scheduled sessions that are due."""
        now = datetime.now(timezone.utc)
        # Add a small buffer for timing
        check_time = now + timedelta(seconds=5)

        result = await self.db.execute(
            select(Session).where(
                Session.status == SessionStatus.SCHEDULED,
                Session.scheduled_at <= check_time,
            )
        )
        sessions = result.scalars().all()

        engine = get_engine(self.db)

        for session in sessions:
            try:
                logger.info(f"Starting scheduled session: {session.id} ({session.name})")
                await engine.start_session(session.id)
            except Exception as e:
                logger.exception(f"Failed to start scheduled session {session.id}: {e}")

    async def _auto_resume_interrupted_sessions(self) -> None:
        """Auto-resume sessions that were interrupted (e.g., by system restart)."""
        result = await self.db.execute(
            select(Session).where(
                Session.status == SessionStatus.INTERRUPTED,
                Session.auto_resume_enabled == True,
            )
        )
        sessions = result.scalars().all()

        if not sessions:
            return

        logger.info(f"Found {len(sessions)} interrupted sessions to auto-resume")
        engine = get_engine(self.db)

        for session in sessions:
            try:
                logger.info(f"Auto-resuming session: {session.id} ({session.name})")
                # Set status to allow starting
                session.status = SessionStatus.PAUSED
                await self.db.commit()
                await engine.resume_session(session.id)
            except Exception as e:
                logger.exception(f"Failed to auto-resume session {session.id}: {e}")

    async def schedule_session(
        self,
        session_id: str,
        scheduled_at: datetime,
    ) -> Session:
        """Schedule a session to start at a specific time."""
        result = await self.db.execute(
            select(Session).where(Session.id == session_id)
        )
        session = result.scalar_one_or_none()

        if not session:
            raise ValueError(f"Session {session_id} not found")

        if session.status not in (SessionStatus.DRAFT, SessionStatus.SCHEDULED):
            raise ValueError(
                f"Cannot schedule session in status: {session.status}"
            )

        if scheduled_at <= datetime.now(timezone.utc):
            raise ValueError("Scheduled time must be in the future")

        session.scheduled_at = scheduled_at
        session.status = SessionStatus.SCHEDULED
        await self.db.commit()

        logger.info(f"Scheduled session {session_id} for {scheduled_at}")
        return session

    async def unschedule_session(self, session_id: str) -> Session:
        """Remove a session from the schedule."""
        result = await self.db.execute(
            select(Session).where(Session.id == session_id)
        )
        session = result.scalar_one_or_none()

        if not session:
            raise ValueError(f"Session {session_id} not found")

        if session.status != SessionStatus.SCHEDULED:
            raise ValueError(
                f"Cannot unschedule session in status: {session.status}"
            )

        session.scheduled_at = None
        session.status = SessionStatus.DRAFT
        await self.db.commit()

        logger.info(f"Unscheduled session {session_id}")
        return session


# Global scheduler instance
_scheduler: SessionScheduler | None = None


def get_scheduler(db: AsyncSession) -> SessionScheduler:
    """Get or create scheduler instance."""
    global _scheduler
    if _scheduler is None or _scheduler.db != db:
        _scheduler = SessionScheduler(db)
    return _scheduler
