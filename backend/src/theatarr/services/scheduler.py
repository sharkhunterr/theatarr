"""Session scheduler service for Theatarr.

Handles scheduled session starts, mystery movie reveals,
and auto-resume after system restart.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import selectinload

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
                await self._check_vote_closes()
                await self._check_vote_reveals()
                await self._check_trailer_rules()
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

            engine = get_engine()

            for session in sessions:
                try:
                    logger.info(f"Starting scheduled session: {session.id} ({session.name})")
                    await engine.start_session(session.id)
                except Exception as e:
                    logger.exception(f"Failed to start scheduled session {session.id}: {e}")
                    # Move back to DRAFT to avoid infinite retry loop
                    session.status = SessionStatus.DRAFT
                    await db.commit()
                    logger.warning(
                        "Session %s moved back to DRAFT after failed start",
                        session.id,
                    )

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
                    resolved_payload = {
                        "type": "movie_resolved",
                        "payload": {
                            "session_id": session.id,
                            "movie_title": session.movie_title,
                            "movie_poster_url": session.movie_poster_url,
                            "selection_mode": "mystery",
                        },
                    }
                    await ws_manager.broadcast(Channel.SESSION.value, resolved_payload)
                    # Also broadcast to wallmount channel so wallmount displays refresh
                    await ws_manager.broadcast(Channel.WALLMOUNT.value, resolved_payload)
                    logger.info(f"Mystery movie revealed for session {session.id}: {session.movie_title}")

                except MovieResolutionError as e:
                    logger.exception(f"Failed to reveal mystery movie for session {session.id}: {e}")

    async def _check_vote_closes(self) -> None:
        """Check and auto-close any vote sessions past their closes_at time."""
        from theatarr.api.ws import ws_manager, Channel
        from theatarr.models.vote import VoteSession, VoteSessionStatus
        from theatarr.services.vote import close_voting

        # closes_at is stored as naive LOCAL time (frontend sends datetime-local value directly)
        now = datetime.now()

        async with async_session_maker() as db:
            result = await db.execute(
                select(VoteSession)
                .options(selectinload(VoteSession.votes))
                .where(
                    VoteSession.status == VoteSessionStatus.OPEN,
                    VoteSession.closes_at <= now,
                )
            )
            vote_sessions = result.scalars().all()

            if not vote_sessions:
                return

            logger.info("Found %d vote sessions to auto-close", len(vote_sessions))

            for vs in vote_sessions:
                try:
                    # Check if linked session has a future vote_reveal_at
                    auto_resolve = True
                    if vs.linked_session_id:
                        linked = await db.execute(
                            select(Session).where(Session.id == vs.linked_session_id)
                        )
                        linked_session = linked.scalar_one_or_none()
                        if linked_session and linked_session.vote_reveal_at:
                            # vote_reveal_at is stored as UTC (frontend converts with toISOString())
                            # Compare with UTC time (strip tzinfo for safe naive comparison)
                            now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
                            reveal_at = linked_session.vote_reveal_at.replace(tzinfo=None) if hasattr(linked_session.vote_reveal_at, 'replace') and linked_session.vote_reveal_at.tzinfo else linked_session.vote_reveal_at
                            if reveal_at > now_utc:
                                auto_resolve = False
                                logger.info(
                                    "Vote session %s: delayed reveal until %s",
                                    vs.id, linked_session.vote_reveal_at,
                                )

                    logger.info("Auto-closing vote session: %s (%s)", vs.id, vs.name)
                    await close_voting(db, vs, assign_winner=True, auto_resolve_linked=auto_resolve)

                    await ws_manager.broadcast(Channel.VOTE.value, {
                        "type": "vote_closed",
                        "payload": {"vote_session_id": vs.id, "name": vs.name},
                    })

                    # Fire-and-forget email notifications for vote results
                    try:
                        import asyncio
                        from theatarr.services.email import notify_vote_closed
                        from theatarr.models.vote_session_participant import VoteSessionParticipant
                        from theatarr.models.user import User

                        winner_title = None
                        if vs.winning_movie_index is not None and vs.movie_options:
                            opts = vs.movie_options
                            if vs.winning_movie_index < len(opts):
                                winner_title = opts[vs.winning_movie_index].get("title")

                        notify_uids: set[str] = set()
                        pr = await db.execute(
                            select(VoteSessionParticipant.user_id)
                            .where(VoteSessionParticipant.vote_session_id == vs.id)
                        )
                        for row in pr.all():
                            notify_uids.add(row[0])
                        if vs.linked_session_id:
                            from theatarr.models.session_participant import SessionParticipant
                            spr = await db.execute(
                                select(SessionParticipant.user_id)
                                .where(SessionParticipant.session_id == vs.linked_session_id)
                            )
                            for row in spr.all():
                                notify_uids.add(row[0])

                        for uid in notify_uids:
                            ur = await db.execute(select(User).where(User.id == uid))
                            u = ur.scalar_one_or_none()
                            if u and u.email:
                                asyncio.create_task(notify_vote_closed(u, vs.name, winner_title))
                    except Exception:
                        logger.warning("Failed to send vote_closed emails for %s", vs.id, exc_info=True)

                except Exception as e:
                    logger.exception("Failed to auto-close vote session %s: %s", vs.id, e)

    async def _check_vote_reveals(self) -> None:
        """Check and reveal any vote movies that are due."""
        from theatarr.api.ws import ws_manager, Channel
        from theatarr.models.vote import VoteSession, VoteSessionStatus
        from theatarr.services.movie_resolution import (
            resolve_vote_winner,
            MovieResolutionError,
        )

        # Use UTC-aware time: vote_reveal_at is DateTime(timezone=True)
        now = datetime.now(timezone.utc)

        async with async_session_maker() as db:
            result = await db.execute(
                select(Session).where(
                    Session.movie_selection_mode == MovieSelectionMode.VOTE.value,
                    Session.movie_resolved == False,
                    Session.vote_reveal_at <= now,
                    Session.linked_vote_session_id.isnot(None),
                )
            )
            sessions = result.scalars().all()

            if not sessions:
                return

            logger.info("Found %d vote sessions ready to reveal", len(sessions))

            for session in sessions:
                try:
                    # Verify the vote is actually closed
                    vs_result = await db.execute(
                        select(VoteSession).where(
                            VoteSession.id == session.linked_vote_session_id
                        )
                    )
                    vote_session = vs_result.scalar_one_or_none()

                    if not vote_session or vote_session.status != VoteSessionStatus.CLOSED:
                        logger.debug(
                            "Vote session for %s not closed yet, skipping reveal",
                            session.id,
                        )
                        continue

                    logger.info(
                        "Revealing vote winner for session: %s (%s)",
                        session.id, session.name,
                    )
                    await resolve_vote_winner(db, session, vote_session)

                    resolved_payload = {
                        "type": "movie_resolved",
                        "payload": {
                            "session_id": session.id,
                            "movie_title": session.movie_title,
                            "movie_poster_url": session.movie_poster_url,
                            "selection_mode": "vote",
                        },
                    }
                    await ws_manager.broadcast(Channel.SESSION.value, resolved_payload)
                    await ws_manager.broadcast(Channel.WALLMOUNT.value, resolved_payload)
                    logger.info(
                        "Vote movie revealed for session %s: %s",
                        session.id, session.movie_title,
                    )

                except MovieResolutionError as e:
                    logger.exception(
                        "Failed to reveal vote movie for session %s: %s",
                        session.id, e,
                    )

    async def _check_trailer_rules(self) -> None:
        """Check and run trailer rules that are due."""
        from theatarr.adapters.registry import AdapterRegistry
        from theatarr.models.service import Service
        from theatarr.models.trailer import TrailerRule, TrailerRuleFrequency
        from theatarr.services.trailer_manager import run_trailer_rule

        now = datetime.now()

        async with async_session_maker() as db:
            result = await db.execute(
                select(TrailerRule).where(
                    TrailerRule.is_enabled == True,
                    TrailerRule.frequency != TrailerRuleFrequency.MANUAL.value,
                    TrailerRule.next_run_at <= now,
                )
            )
            rules = result.scalars().all()
            if not rules:
                return

            # Find TMDB service
            svc_result = await db.execute(
                select(Service).where(
                    Service.adapter_type == "tmdb", Service.is_enabled == True,
                )
            )
            tmdb_service = svc_result.scalar_one_or_none()
            if not tmdb_service:
                logger.debug("No active TMDB service, skipping trailer rules")
                return

            tmdb_adapter = AdapterRegistry.create_adapter("tmdb", tmdb_service.config)
            await tmdb_adapter.connect()

            try:
                for rule in rules:
                    try:
                        logger.info("Running scheduled trailer rule: %s (%s)", rule.id, rule.name)
                        result = await run_trailer_rule(db, rule, tmdb_adapter)
                        logger.info("Trailer rule %s result: %s", rule.name, result)
                    except Exception:
                        logger.exception("Failed to run trailer rule %s", rule.id)
            finally:
                await tmdb_adapter.disconnect()

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
            engine = get_engine()

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
