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
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from theatarr.adapters.base import Command
from theatarr.adapters.registry import AdapterRegistry
from theatarr.models.action import Action, OnFailure
from theatarr.models.sequence import Sequence
from theatarr.models.session import Session, SessionStatus
from theatarr.services.session_logger import log_session_event
from theatarr.utils.performance import get_performance_monitor

logger = logging.getLogger(__name__)

# Performance threshold for transition overhead (excluding intentional delays)
TRANSITION_OVERHEAD_TARGET_MS = 200


def _enum_val(v: Any) -> str:
    """Safely extract .value from an enum or return string as-is."""
    return v.value if hasattr(v, 'value') else v


def _format_ms(ms: int) -> str:
    """Format milliseconds as HH:MM:SS or M:SS."""
    total_s = ms // 1000
    h, rem = divmod(total_s, 3600)
    m, s = divmod(rem, 60)
    if h > 0:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"


async def _describe_action(action: "Action", db: "AsyncSession | None" = None) -> tuple[str, str, dict]:
    """Return (label, icon_hint, details) for a session action."""
    params = action.parameters or {}
    at = _enum_val(action.action_type)
    cmd = action.command

    if at == "media" and cmd == "play":
        pause_at = params.get("pause_at_ms")
        details: dict[str, Any] = {}
        if pause_at:
            details["pause_at_ms"] = pause_at
            return f"Lecture du film (entracte a {_format_ms(int(pause_at))})", "film", details
        return "Lecture du film", "film", details

    if at == "media" and cmd == "resume":
        return "Reprise du film", "film", {}

    if at == "display" and params.get("content_type") == "waiting_screen":
        style = (params.get("layout") or {}).get("style", "")
        if "intermission" in style:
            return "Entracte", "coffee", {}
        if style == "waiting-session-info":
            return "Accueil", "monitor", {}
        return "Ecran d'attente", "monitor", {}

    if at == "display" and params.get("content_type") == "quiz":
        quiz_id = params.get("quiz_session_id")
        total_q = 0
        if quiz_id and db:
            try:
                from theatarr.models.quiz import QuizSession
                q_result = await db.execute(
                    select(QuizSession.questions).where(QuizSession.id == quiz_id)
                )
                questions = q_result.scalar_one_or_none()
                total_q = len(questions) if questions else 0
            except Exception:
                pass
        label = f"Quiz ({total_q} questions)" if total_q else "Quiz"
        return label, "quiz", {"quiz_session_id": quiz_id, "total_questions": total_q}

    if at == "display" and params.get("content_type") == "text":
        return "Affichage texte", "text", {}

    if at == "display" and params.get("content_type") == "image":
        return "Affichage image", "image", {}

    if at == "audio":
        return "Audio", "audio", {}

    if at == "lighting":
        return "Eclairage", "lighting", {}

    if at == "session" and cmd == "open_feedback":
        return "Ouverture des feedbacks", "clipboard-check", {}

    return f"{at}:{cmd}", "default", {}


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

    Lifecycle methods (start/pause/resume/stop/skip) use self.db.
    Background tasks (_run_session and its callees) use a dedicated
    per-session DB session stored in _bg_db to avoid "prepared state"
    conflicts when both run concurrently on the same event loop.
    """

    def __init__(self):
        self._db: AsyncSession | None = None
        self._bg_db: dict[str, AsyncSession] = {}
        self._running_sessions: dict[str, asyncio.Task] = {}
        self._session_locks: dict[str, asyncio.Lock] = {}
        self._display_states: dict[str, list[dict]] = {}
        # Stores last media play state per session for pause/resume
        # {session_id: {url, media_id, position_ms, ...original play params}}
        self._media_states: dict[str, dict[str, Any]] = {}
        # In-memory action execution log per session (last 100 per session)
        self._action_logs: dict[str, list[dict]] = {}
        # Background quiz timer tasks per session
        self._quiz_tasks: dict[str, asyncio.Task] = {}
        # Events to wake up sequence wait loops immediately on playback_ended
        self._playback_events: dict[str, asyncio.Event] = {}

    @property
    def db(self) -> AsyncSession:
        """Get the engine's DB session, creating it lazily if needed."""
        if self._db is None:
            from theatarr.database import async_session_maker
            self._db = async_session_maker()
        return self._db

    def _session_db(self, session_id: str) -> AsyncSession:
        """Get the DB session for a given cinema session.

        Background tasks get a dedicated session; lifecycle methods
        fall back to self.db.
        """
        return self._bg_db.get(session_id) or self.db

    def get_display_state(self, session_id: str) -> list[dict] | None:
        """Get all broadcast actions for the current block (for reconnection replay)."""
        return self._display_states.get(session_id) or None

    def get_action_log(self, session_id: str) -> list[dict]:
        """Get the in-memory action execution log for a session."""
        return list(self._action_logs.get(session_id, []))

    def store_media_play(self, session_id: str, params: dict[str, Any]) -> None:
        """Store media play parameters for later resume."""
        self._media_states[session_id] = dict(params)
        logger.info("Stored media state for session %s: media_id=%s", session_id, params.get("media_id"))

    def store_media_pause(self, session_id: str, position_ms: int) -> None:
        """Update stored media state with pause position."""
        if session_id in self._media_states:
            self._media_states[session_id]["pause_position_ms"] = position_ms
            logger.info("Stored pause position %dms for session %s", position_ms, session_id)

    def get_media_state(self, session_id: str) -> dict[str, Any] | None:
        """Get stored media state for resume."""
        return self._media_states.get(session_id)

    async def _resolve_trailer_url(self, session_id: str, ws_params: dict[str, Any]) -> None:
        """Resolve trailer URL based on trailer_mode parameter."""
        import random

        from theatarr.database import async_session_maker
        from theatarr.models.trailer import Trailer, TrailerStatus

        trailer_mode = ws_params.get("trailer_mode", "manual")

        if trailer_mode == "manual":
            trailer_id = ws_params.get("trailer_id")
            if trailer_id:
                ws_params["url"] = f"/api/v1/trailers/{trailer_id}/file"
                await self._increment_play_count("trailer", trailer_id)
                logger.info("Resolved manual trailer %s for session %s", trailer_id, session_id)
                await log_session_event(session_id, "trailer_resolved", {
                    "trailer_id": trailer_id, "mode": "manual",
                })

        elif trailer_mode == "auto":
            # Check if trailer was pre-resolved at session save time
            resolved_id = ws_params.get("_resolved_trailer_id")
            resolved_name = ws_params.get("_resolved_trailer_name", "?")
            preview_tmdb = ws_params.get("_preview_tmdb_id")
            preview_name = ws_params.get("_preview_trailer_name", "?")
            logger.info("Auto trailer: resolved_id=%s (%s), preview_tmdb=%s (%s)", resolved_id, resolved_name, preview_tmdb, preview_name)
            if resolved_id:
                async with async_session_maker() as db:
                    result = await db.execute(
                        select(Trailer).where(Trailer.id == resolved_id, Trailer.status == TrailerStatus.READY.value)
                    )
                    resolved = result.scalar_one_or_none()
                    if resolved:
                        ws_params["url"] = f"/api/v1/trailers/{resolved.id}/file"
                        await self._increment_play_count("trailer", resolved.id)
                        logger.info("Using pre-resolved trailer %s (%s) for session %s", resolved.id, resolved.movie_title, session_id)
                        await log_session_event(session_id, "trailer_resolved", {
                            "trailer_id": resolved.id, "movie_title": resolved.movie_title,
                            "trailer_title": resolved.title, "mode": "auto", "source": "pre-resolved",
                        })
                        return

            # Fallback: resolve at runtime (shouldn't normally happen)
            async with async_session_maker() as db:
                session = await self._get_session(session_id)
                session_tmdb_id: str | None = None
                if session.movie_id:
                    from theatarr.models.movie import Movie
                    movie_result = await db.execute(
                        select(Movie).where(Movie.id == session.movie_id)
                    )
                    movie = movie_result.scalar_one_or_none()
                    if movie:
                        session_tmdb_id = movie.tmdb_id

                # 1) Check local trailers (exclude session's own movie)
                query = select(Trailer).where(Trailer.status == TrailerStatus.READY.value)
                if session_tmdb_id:
                    query = query.where(Trailer.movie_tmdb_id != session_tmdb_id)
                result = await db.execute(query)
                local_trailers = result.scalars().all()

                if local_trailers:
                    chosen = random.choice(local_trailers)
                    ws_params["url"] = f"/api/v1/trailers/{chosen.id}/file"
                    await self._increment_play_count("trailer", chosen.id)
                    logger.info("Auto-selected local trailer %s (%s) for session %s", chosen.id, chosen.movie_title, session_id)
                    await log_session_event(session_id, "trailer_resolved", {
                        "trailer_id": chosen.id, "movie_title": chosen.movie_title,
                        "trailer_title": chosen.title, "mode": "auto", "source": "local_random",
                    })
                else:
                    # 2) Fallback: download from TMDB
                    file_url = await self._get_tmdb_upcoming_trailer(db, exclude_tmdb_id=session_tmdb_id)
                    if file_url:
                        ws_params["url"] = file_url
                        logger.info("Auto-downloaded TMDB trailer for session %s: %s", session_id, file_url)
                        await log_session_event(session_id, "trailer_resolved", {
                            "mode": "auto", "source": "tmdb_download", "url": file_url,
                        })
                    else:
                        logger.warning("No trailers available (local or TMDB) for session %s", session_id)

        elif trailer_mode == "rule":
            trailer_rule_id = ws_params.get("trailer_rule_id")
            if trailer_rule_id:
                async with async_session_maker() as db:
                    result = await db.execute(
                        select(Trailer).where(
                            Trailer.rule_id == trailer_rule_id,
                            Trailer.status == TrailerStatus.READY.value,
                        )
                    )
                    pool = result.scalars().all()
                    if pool:
                        chosen = random.choice(pool)
                        ws_params["url"] = f"/api/v1/trailers/{chosen.id}/file"
                        await self._increment_play_count("trailer", chosen.id)
                        logger.info("Rule-selected trailer %s for session %s", chosen.id, session_id)
                        await log_session_event(session_id, "trailer_resolved", {
                            "trailer_id": chosen.id, "movie_title": chosen.movie_title,
                            "mode": "rule", "rule_id": trailer_rule_id,
                        })
                    else:
                        logger.warning("No ready trailers for rule %s (session %s)", trailer_rule_id, session_id)

    async def _increment_play_count(self, media_type: str, media_id: str) -> None:
        """Increment play_count and set last_played_at for a trailer or preroll."""
        from theatarr.database import async_session_maker

        async with async_session_maker() as db:
            if media_type == "trailer":
                from theatarr.models.trailer import Trailer
                result = await db.execute(select(Trailer).where(Trailer.id == media_id))
                item = result.scalar_one_or_none()
            else:
                from theatarr.models.preroll import PreRoll
                result = await db.execute(select(PreRoll).where(PreRoll.id == media_id))
                item = result.scalar_one_or_none()

            if item:
                item.play_count = (item.play_count or 0) + 1
                item.last_played_at = datetime.now()
                await db.commit()

    async def _get_tmdb_upcoming_trailer(
        self, db: AsyncSession, *, exclude_tmdb_id: str | None = None,
    ) -> str | None:
        """Download a trailer for a popular upcoming movie and return its file URL.

        Picks the most popular upcoming movie from TMDB (excluding the session
        movie), downloads the trailer via yt-dlp, creates a Trailer record,
        and returns the local file serving URL.
        """
        try:
            from theatarr.models.service import Service
            from theatarr.models.trailer import Trailer, TrailerStatus

            svc_result = await db.execute(
                select(Service).where(Service.adapter_type == "tmdb", Service.is_enabled == True)
            )
            tmdb_service = svc_result.scalar_one_or_none()
            if not tmdb_service:
                logger.debug("No active TMDB service for trailer lookup")
                return None

            adapter = AdapterRegistry.create_adapter("tmdb", tmdb_service.config)
            await adapter.connect()
            try:
                # Fetch upcoming + popular movies
                candidates: list[dict] = []
                for source in ("get_upcoming_movies", "get_popular_movies"):
                    result = await adapter.execute(
                        Command(action=source, parameters={"page": 1})
                    )
                    if result.success and result.data:
                        candidates.extend(result.data.get("results", []))

                # Deduplicate by tmdb_id
                seen: set[str] = set()
                unique: list[dict] = []
                for m in candidates:
                    tid = str(m.get("tmdb_id", ""))
                    if tid and tid not in seen:
                        seen.add(tid)
                        unique.append(m)
                candidates = unique

                # Exclude the session's movie
                if exclude_tmdb_id:
                    candidates = [m for m in candidates if str(m.get("tmdb_id")) != str(exclude_tmdb_id)]

                # Sort by popularity descending (most anticipated first)
                candidates.sort(key=lambda m: m.get("popularity", 0), reverse=True)

                if not candidates:
                    return None

                # Try top candidates until we find one with a proper trailer
                for movie in candidates[:15]:
                    tmdb_id = movie.get("tmdb_id")
                    if not tmdb_id:
                        continue
                    trailer_result = await adapter.execute(
                        Command(action="get_trailers", parameters={"movie_id": str(tmdb_id)})
                    )
                    if not (trailer_result.success and trailer_result.data):
                        continue
                    all_trailers = trailer_result.data.get("trailers", [])
                    # Only full "Trailer" type (not "Teaser" which can be shorts)
                    full_trailers = [t for t in all_trailers if t.get("type") == "Trailer"]
                    if not full_trailers:
                        continue

                    best = full_trailers[0]  # already sorted by official+size
                    youtube_url = best.get("youtube_url")
                    movie_title = movie.get("title", "Unknown")
                    movie_year = movie.get("year")

                    # Check if we already have this trailer downloaded locally
                    existing = await db.execute(
                        select(Trailer).where(
                            Trailer.movie_tmdb_id == str(tmdb_id),
                            Trailer.status == TrailerStatus.READY.value,
                        )
                    )
                    existing_trailer = existing.scalar_one_or_none()
                    if existing_trailer:
                        logger.info("Found existing local trailer for %s", movie_title)
                        return f"/api/v1/trailers/{existing_trailer.id}/file"

                    # Create a Trailer record and download via yt-dlp
                    logger.info("Downloading trailer for %s (%s)…", movie_title, youtube_url)
                    new_trailer = Trailer(
                        movie_title=movie_title,
                        movie_year=movie_year,
                        movie_tmdb_id=str(tmdb_id),
                        title=best.get("name", f"Trailer — {movie_title}"),
                        source_type="youtube",
                        source_url=youtube_url,
                        source_id=best.get("key"),
                        quality="hd",
                        genres=movie.get("genres", []),
                        rating=movie.get("rating"),
                        status=TrailerStatus.PENDING,
                    )
                    db.add(new_trailer)
                    await db.commit()
                    await db.refresh(new_trailer)

                    from theatarr.services.trailer_manager import download_trailer
                    downloaded = await download_trailer(db, new_trailer)

                    if downloaded.status == TrailerStatus.READY:
                        logger.info("Auto-downloaded trailer: %s → %s", movie_title, downloaded.file_path)
                        return f"/api/v1/trailers/{downloaded.id}/file"
                    else:
                        logger.warning("Failed to download trailer for %s: %s", movie_title, downloaded.error_message)

            finally:
                await adapter.disconnect()
        except Exception as e:
            logger.warning("Failed to get TMDB upcoming trailer: %s", e)

        return None

    async def _get_session(self, session_id: str, *, use_lifecycle_db: bool = False) -> Session:
        """Get a session by ID with sequences and actions loaded.

        Args:
            session_id: The session ID to look up.
            use_lifecycle_db: If True, always use self.db (the lifecycle DB)
                instead of the background task DB.  Lifecycle methods
                (start/pause/resume/stop/skip) must set this to True so
                that the returned object is tracked by self.db and
                self.db.commit() will persist changes.
        """
        db = self.db if use_lifecycle_db else self._session_db(session_id)
        result = await db.execute(
            select(Session)
            .where(Session.id == session_id)
            .options(
                selectinload(Session.sequences).selectinload(Sequence.actions),
            )
            .execution_options(populate_existing=True)
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
        """Emit session state change event via WebSocket broadcast.

        Re-fetches the session to ensure relationships (sequences, actions)
        are loaded.  This avoids greenlet errors caused by expired lazy
        attributes after commit().
        """
        from theatarr.api.ws import ws_manager

        # Re-fetch to guarantee relationships are loaded (commit() expires them)
        session = await self._get_session(session.id)

        logger.info(
            "Emitting state change: session=%s status=%s seq_index=%d/%d",
            session.id, _enum_val(session.status),
            session.current_sequence_index, session.total_sequences,
        )
        state: dict[str, Any] = {
            "session_id": session.id,
            "status": _enum_val(session.status),
            "current_sequence_index": session.current_sequence_index,
            "current_sequence_elapsed_ms": session.current_sequence_elapsed_ms,
            "total_sequences": session.total_sequences,
        }
        if session.current_sequence:
            state["current_sequence"] = {
                "id": session.current_sequence.id,
                "name": session.current_sequence.name,
                "duration_type": _enum_val(session.current_sequence.duration_type),
                "duration_ms": session.current_sequence.duration_ms,
            }
        await ws_manager.broadcast_session_state(session.id, state)

    # ------------------------------------------------------------------
    # Public lifecycle methods (called from request handlers)
    # ------------------------------------------------------------------

    async def start_session(self, session_id: str) -> Session:
        """Start a session."""
        lock = await self._get_lock(session_id)
        async with lock:
            session = await self._get_session(session_id, use_lifecycle_db=True)

            if not session.can_start:
                raise SessionNotRunnableError(
                    f"Session {session_id} cannot be started (status: {session.status})"
                )

            if not session.sequences:
                raise EngineError(f"Session {session_id} has no sequences")

            session.status = SessionStatus.RUNNING
            session.started_at = datetime.now(timezone.utc)
            session.current_sequence_index = 0
            session.current_sequence_elapsed_ms = 0
            await self.db.commit()

            logger.info("Starting session %s", session_id)
            await self._emit_state_change(session)
            await log_session_event(session_id, "session_started", {
                "name": session.name,
                "movie_title": session.movie_title,
                "total_sequences": session.total_sequences,
            })

            task = asyncio.create_task(self._run_session(session_id))
            self._running_sessions[session_id] = task

            return session

    async def pause_session(self, session_id: str) -> Session:
        """Pause a running session."""
        lock = await self._get_lock(session_id)
        async with lock:
            session = await self._get_session(session_id, use_lifecycle_db=True)

            if not session.can_pause:
                raise SessionNotRunnableError(
                    f"Session {session_id} cannot be paused (status: {session.status})"
                )

            session.status = SessionStatus.PAUSED
            await self.db.commit()

            logger.info("Paused session %s", session_id)
            await self._emit_state_change(session)
            await log_session_event(session_id, "session_paused", {
                "sequence_index": session.current_sequence_index,
                "elapsed_ms": session.current_sequence_elapsed_ms,
            })

            if session_id in self._running_sessions:
                self._running_sessions[session_id].cancel()
                del self._running_sessions[session_id]

            quiz_task = self._quiz_tasks.pop(session_id, None)
            if quiz_task and not quiz_task.done():
                quiz_task.cancel()

            return session

    async def resume_session(self, session_id: str) -> Session:
        """Resume a paused session."""
        lock = await self._get_lock(session_id)
        async with lock:
            session = await self._get_session(session_id, use_lifecycle_db=True)

            if not session.can_resume:
                raise SessionNotRunnableError(
                    f"Session {session_id} cannot be resumed (status: {session.status})"
                )

            session.status = SessionStatus.RUNNING
            await self.db.commit()

            logger.info("Resuming session %s", session_id)
            await self._emit_state_change(session)
            await log_session_event(session_id, "session_resumed", {
                "sequence_index": session.current_sequence_index,
            })

            task = asyncio.create_task(self._run_session(session_id, resuming=True))
            self._running_sessions[session_id] = task

            return session

    async def stop_session(self, session_id: str) -> Session:
        """Stop a session."""
        lock = await self._get_lock(session_id)
        async with lock:
            session = await self._get_session(session_id, use_lifecycle_db=True)

            if session.status == SessionStatus.COMPLETED:
                return session

            if session_id in self._running_sessions:
                self._running_sessions[session_id].cancel()
                del self._running_sessions[session_id]

            quiz_task = self._quiz_tasks.pop(session_id, None)
            if quiz_task and not quiz_task.done():
                quiz_task.cancel()

            session.status = SessionStatus.COMPLETED
            session.completed_at = datetime.now(timezone.utc)
            await self.db.commit()

            self._display_states.pop(session_id, None)
            self._media_states.pop(session_id, None)
            logger.info("Stopped session %s", session_id)
            await self._emit_state_change(session)
            await log_session_event(session_id, "session_stopped", {
                "reason": "manual",
            })

            return session

    async def skip_sequence(self, session_id: str) -> Session:
        """Skip to the next sequence."""
        lock = await self._get_lock(session_id)
        async with lock:
            session = await self._get_session(session_id, use_lifecycle_db=True)

            if session.status not in (SessionStatus.RUNNING, SessionStatus.PAUSED):
                raise SessionNotRunnableError(
                    f"Cannot skip sequence in session {session_id} (status: {session.status})"
                )

            cur_index = session.current_sequence_index
            next_index = cur_index + 1
            is_last = next_index >= session.total_sequences
            if is_last:
                session.status = SessionStatus.COMPLETED
                session.completed_at = datetime.now(timezone.utc)
            else:
                session.current_sequence_index = next_index
                session.current_sequence_elapsed_ms = 0

            await self.db.commit()
            target_index = cur_index if is_last else next_index
            logger.info("Skipped to sequence %d in session %s", target_index, session_id)
            await self._emit_state_change(session)
            await log_session_event(session_id, "sequence_skipped", {
                "from_index": cur_index,
                "to_index": target_index,
                "session_completed": is_last,
            })

            return session

    async def notify_playback_ended(self, session_id: str) -> None:
        """Signal the wait loop to wake up immediately after playback ends.

        Also expires the background DB session cache so the wait loop
        sees the updated current_sequence_index committed by skip_sequence()
        (which uses the lifecycle DB, a separate SQLAlchemy session).
        """
        bg_db = self._bg_db.get(session_id)
        if bg_db:
            bg_db.expire_all()
        event = self._playback_events.get(session_id)
        if event:
            event.set()

    # ------------------------------------------------------------------
    # Background session execution
    # ------------------------------------------------------------------

    async def _run_session(self, session_id: str, resuming: bool = False) -> None:
        """Main session execution loop.

        Creates a dedicated DB session so it never conflicts with
        lifecycle methods (skip/pause/stop) using self.db concurrently.
        """
        from theatarr.database import async_session_maker

        bg_db = async_session_maker()
        self._bg_db[session_id] = bg_db
        self._playback_events[session_id] = asyncio.Event()
        try:
            while True:
                session = await self._get_session(session_id)

                if session.status != SessionStatus.RUNNING:
                    break

                if session.current_sequence_index >= session.total_sequences:
                    session.status = SessionStatus.COMPLETED
                    completed_at = datetime.now(timezone.utc)
                    session.completed_at = completed_at
                    started_at = session.started_at
                    total_seq = session.total_sequences
                    await bg_db.commit()
                    self._display_states.pop(session_id, None)
                    self._media_states.pop(session_id, None)
                    await self._emit_state_change(session)
                    duration_s = None
                    if started_at and completed_at:
                        duration_s = int((completed_at - started_at).total_seconds())
                    await log_session_event(session_id, "session_completed", {
                        "duration_seconds": duration_s,
                        "total_sequences": total_seq,
                    })
                    break

                sequence = session.current_sequence
                if not sequence:
                    logger.warning("Session %s: no current sequence at index %d", session_id, session.current_sequence_index)
                    break

                seq_index_before = sequence.order_index
                await self._execute_sequence(session, sequence, skip_actions=resuming)
                resuming = False

                session = await self._get_session(session_id)
                if session.status != SessionStatus.RUNNING:
                    logger.info("Session %s: status changed to %s during sequence, stopping", session_id, _enum_val(session.status))
                    break

                # If skip_sequence() already advanced the index, don't double-advance
                if session.current_sequence_index != seq_index_before:
                    logger.info("Session %s: sequence was skipped externally (index %d → %d), continuing", session_id, seq_index_before, session.current_sequence_index)
                    continue

                logger.info("Session %s: transitioning from sequence %d to next", session_id, session.current_sequence_index)
                await self._transition_to_next_sequence(session)

        except asyncio.CancelledError:
            logger.info("Session %s execution cancelled", session_id)
        except Exception as e:
            logger.exception("Error in session %s: %s", session_id, e)
            try:
                session = await self._get_session(session_id)
                session.status = SessionStatus.INTERRUPTED
                await bg_db.commit()
                self._display_states.pop(session_id, None)
                await self._emit_state_change(session)
                await log_session_event(session_id, "session_interrupted", {
                    "error": str(e),
                })
            except Exception:
                pass
        finally:
            self._bg_db.pop(session_id, None)
            self._playback_events.pop(session_id, None)
            await bg_db.close()
            self._running_sessions.pop(session_id, None)
            quiz_task = self._quiz_tasks.pop(session_id, None)
            if quiz_task and not quiz_task.done():
                quiz_task.cancel()

    async def _execute_sequence(self, session: Session, sequence: Sequence, skip_actions: bool = False) -> None:
        """Execute a single sequence (all actions in parallel)."""
        # Capture IDs as local strings BEFORE any commit() can expire the ORM
        # objects.  After commit(), accessing session.id or sequence.id would
        # trigger a synchronous lazy-load which crashes in async context
        # (greenlet_spawn error).
        session_id = session.id
        seq_id = sequence.id
        seq_name = sequence.name
        seq_order = sequence.order_index

        seq_start_time = time.monotonic()
        duration_ms = sequence.effective_duration_ms
        logger.info(
            "Executing sequence %s (%s) — duration_type=%s duration_ms=%s effective=%dms, %d action(s), skip_actions=%s",
            seq_name, seq_id,
            _enum_val(sequence.duration_type), sequence.duration_ms,
            duration_ms, len(sequence.actions), skip_actions,
        )
        await log_session_event(session_id, "sequence_started", {
            "sequence_id": seq_id,
            "sequence_name": seq_name,
            "order_index": seq_order,
            "duration_type": _enum_val(sequence.duration_type),
            "duration_ms": duration_ms,
            "action_count": len(sequence.actions),
            "resuming": skip_actions,
        })

        if skip_actions:
            logger.info("Resuming sequence %s — skipping action execution (elapsed: %dms)", seq_name, session.current_sequence_elapsed_ms)
        else:
            self._display_states[session_id] = []

            async def _exec_one(action: Action) -> ActionResult:
                if action.delay_ms > 0:
                    await asyncio.sleep(action.delay_ms / 1000)
                return await self._execute_action(
                    action, sequence_duration_ms=duration_ms, block_id=seq_id,
                )

            results = await asyncio.gather(
                *[_exec_one(a) for a in sequence.actions],
                return_exceptions=True,
            )

            for i, result in enumerate(results):
                action = sequence.actions[i]
                if isinstance(result, Exception):
                    logger.exception("Action %s failed: %s", action.id, result)
                    if _enum_val(action.on_failure) == OnFailure.ABORT.value:
                        raise EngineError(f"Action {action.id} failed: {result}")
                elif isinstance(result, ActionResult):
                    logger.info("Action %s result: success=%s message=%s", action.id, result.success, result.message)
                    if not result.success and _enum_val(action.on_failure) == OnFailure.ABORT.value:
                        raise EngineError(f"Action {action.id} failed: {result.error}")

        dur_type = _enum_val(sequence.duration_type)
        if dur_type == "manual":
            # Check if any action has a pause_at_ms — use it as an auto-skip timer
            # so the engine advances even without a display sending video_paused_at.
            auto_skip_ms = None
            for action in sequence.actions:
                params = action.parameters or {}
                pat = params.get("pause_at_ms")
                if pat is not None:
                    pat_int = int(pat)
                    if auto_skip_ms is None or pat_int > auto_skip_ms:
                        auto_skip_ms = pat_int

            if auto_skip_ms is not None:
                # Add a small buffer (3s) to let the display handle it first
                auto_skip_ms += 3000
                logger.info(
                    "Sequence %s is MANUAL with auto-skip at %dms",
                    seq_name, auto_skip_ms,
                )
            else:
                logger.info("Sequence %s is MANUAL — waiting for external signal (skip/stop)", seq_name)

            event = self._playback_events.get(session_id)
            while True:
                # Wait up to 1s, but wake immediately if playback_ended fires
                if event:
                    event.clear()
                    try:
                        await asyncio.wait_for(event.wait(), timeout=1.0)
                    except asyncio.TimeoutError:
                        pass
                else:
                    await asyncio.sleep(1)

                session = await self._get_session(session_id)
                if session.status != SessionStatus.RUNNING:
                    return
                if session.current_sequence_index != seq_order:
                    return
                session.current_sequence_elapsed_ms += 1000
                await self._session_db(session_id).commit()
                await self._emit_state_change(session)

                # Auto-skip when elapsed exceeds pause_at_ms
                if auto_skip_ms is not None and session.current_sequence_elapsed_ms >= auto_skip_ms:
                    logger.info(
                        "Auto-skipping sequence %s — elapsed %dms >= pause_at %dms",
                        seq_name, session.current_sequence_elapsed_ms, auto_skip_ms,
                    )
                    # Store the pause position for media:resume
                    self.store_media_pause(session_id, auto_skip_ms - 3000)
                    await self.skip_sequence(session_id)
                    return
        elif duration_ms > 0:
            elapsed = session.current_sequence_elapsed_ms
            remaining = max(0, duration_ms - elapsed)
            chunk_ms = 1000
            event = self._playback_events.get(session_id)
            while remaining > 0:
                session = await self._get_session(session_id)
                if session.status != SessionStatus.RUNNING:
                    return
                if session.current_sequence_index != seq_order:
                    return
                wait_ms = min(chunk_ms, remaining)
                # Wait up to wait_ms, but wake immediately if playback_ended fires
                if event:
                    event.clear()
                    try:
                        await asyncio.wait_for(event.wait(), timeout=wait_ms / 1000)
                    except asyncio.TimeoutError:
                        pass
                else:
                    await asyncio.sleep(wait_ms / 1000)
                # Re-check after sleep: skip_sequence() may have changed the
                # index and reset elapsed_ms while we were sleeping.  We must
                # re-fetch BEFORE touching elapsed_ms to avoid contaminating
                # the next sequence and to prevent stale-attribute errors.
                session = await self._get_session(session_id)
                if session.status != SessionStatus.RUNNING:
                    return
                if session.current_sequence_index != seq_order:
                    return
                session.current_sequence_elapsed_ms += wait_ms
                await self._session_db(session_id).commit()
                await self._emit_state_change(session)
                remaining -= wait_ms

        # Log sequence completion
        actual_ms = int((time.monotonic() - seq_start_time) * 1000)
        await log_session_event(session_id, "sequence_completed", {
            "sequence_id": seq_id,
            "sequence_name": seq_name,
            "order_index": seq_order,
            "planned_duration_ms": duration_ms,
            "actual_duration_ms": actual_ms,
        })

        # Stop audio from this sequence when it ends
        await self._cleanup_sequence_audio(session_id)

    async def _cleanup_sequence_audio(self, session_id: str) -> None:
        """Stop any audio that was started in the current sequence."""
        states = self._display_states.get(session_id, [])
        had_audio_play = any(
            s.get("action_type") == "audio" and s.get("command") == "play"
            for s in states
        )
        if had_audio_play:
            from theatarr.api.ws import ws_manager
            logger.info("Sequence ended — broadcasting audio:stop for session %s", session_id)
            await ws_manager.broadcast_display_action(
                session_id=session_id,
                action_type="audio",
                command="stop",
                parameters={"fade_out_ms": 500},
            )

    async def _execute_action(self, action: Action, *, sequence_duration_ms: int = 0, block_id: str | None = None) -> ActionResult:
        """Execute a single action via the appropriate adapter and/or display channel."""
        start_time = datetime.now(timezone.utc)
        session_id = action.sequence.session_id

        try:
            from theatarr.api.ws import ws_manager

            success = True
            message = ""
            adapter = None

            if action.service_id:
                adapter = AdapterRegistry.get_instance(action.service_id)
                if not adapter:
                    from theatarr.models.service import Service
                    svc_result = await self._session_db(session_id).execute(
                        select(Service).where(Service.id == action.service_id)
                    )
                    svc = svc_result.scalar_one_or_none()
                    if svc and svc.is_enabled:
                        try:
                            adapter = AdapterRegistry.create_adapter(
                                svc.adapter_type, svc.config, instance_id=svc.id,
                            )
                        except Exception as e:
                            logger.warning("Failed to create adapter for service %s: %s", svc.id, e)

                if adapter:
                    result = await adapter.execute(Command(
                        action=action.command,
                        parameters=action.parameters,
                        targets=action.targets,
                    ))
                    if result.success:
                        success = True
                        message = result.message or ""
                    elif "Unknown command" in (result.message or ""):
                        # Adapter doesn't handle this command (e.g. Plex source
                        # adapter receiving "play") — not a failure, the action
                        # will proceed via WebSocket broadcast.
                        logger.debug(
                            "Adapter %s does not handle command '%s' — skipping",
                            action.service_id, action.command,
                        )
                    else:
                        success = False
                        message = result.message or ""

            ws_params = dict(action.parameters or {})
            action_type_val = _enum_val(action.action_type)

            # Auto-setup quiz if this is a quiz display action
            if (
                action_type_val == "display"
                and action.command == "show"
                and ws_params.get("content_type") == "quiz"
                and ws_params.get("quiz_session_id")
            ):
                quiz_state = await self._setup_quiz_for_session(
                    session_id, ws_params["quiz_session_id"]
                )
                if quiz_state:
                    ws_params["quiz_display_state"] = quiz_state
                    # Start quiz timer for auto-advancing questions on timeout
                    old_task = self._quiz_tasks.pop(session_id, None)
                    if old_task and not old_task.done():
                        old_task.cancel()
                    total_s = (sequence_duration_ms / 1000) if sequence_duration_ms > 0 else None
                    task = asyncio.create_task(
                        self._run_quiz_timer(session_id, ws_params["quiz_session_id"], total_s)
                    )
                    self._quiz_tasks[session_id] = task
                    logger.info(
                        "Started quiz timer for session %s, quiz %s (total_duration=%ss)",
                        session_id, ws_params["quiz_session_id"], total_s,
                    )

            # session:open_feedback — marks feedback as available on the session
            if action_type_val == "session" and action.command == "open_feedback":
                logger.info("Feedback opened for session %s via action", session_id)
                # Persist feedback_opened flag on the session
                db = self._session_db(session_id)
                session_obj = await self._get_session(session_id)
                session_obj.feedback_opened = True
                await db.commit()
                elapsed = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
                await self._log_action(session_id, action, action_type_val, True, "Feedback opened", elapsed)
                return ActionResult(
                    action_id=action.id, success=True, message="Feedback opened",
                    duration_ms=elapsed, error=None,
                )

            action_cmd_override = None

            # Inject session overview for session-info waiting screens
            if (
                action_type_val == "display"
                and action.command == "show"
                and ws_params.get("content_type") == "waiting_screen"
            ):
                layout = ws_params.get("layout") or {}
                if isinstance(layout, dict) and layout.get("style") == "waiting-session-info":
                    try:
                        overview = await self._build_session_overview(session_id)
                        ws_params["session_overview"] = overview
                    except Exception as e:
                        logger.warning("Failed to build session overview: %s", e)

            # Inject feedback display data for feedback templates
            if (
                action_type_val == "display"
                and action.command == "show"
                and ws_params.get("content_type") == "feedback"
            ):
                try:
                    feedback_data = await self._build_feedback_display_data(session_id)
                    ws_params["feedback_display_data"] = feedback_data
                    logger.info("Injected feedback display data for session %s", session_id)
                except Exception as e:
                    logger.exception("Failed to build feedback display data: %s", e)

            if (
                action_type_val == "media"
                and action.command == "play"
                and "url" not in ws_params
            ):
                media_source = ws_params.get("media_source", "service")

                if media_source == "service" and ws_params.get("media_id") and adapter:
                    # Existing: resolve via service adapter
                    try:
                        url_params = {"media_id": ws_params["media_id"]}
                        for key in ("audio_stream_id", "subtitle_stream_id", "video_quality"):
                            if ws_params.get(key):
                                url_params[key] = ws_params[key]
                        url_result = await adapter.execute(Command(
                            action="get_playback_url", parameters=url_params,
                        ))
                        if url_result.success and url_result.data:
                            playback_url = url_result.data.get("playback_url")
                            if playback_url:
                                ws_params["url"] = playback_url
                    except Exception as e:
                        logger.warning("Failed to resolve playback URL: %s", e)

                elif media_source == "trailer":
                    await self._resolve_trailer_url(session_id, ws_params)

                elif media_source == "preroll":
                    preroll_id = ws_params.get("preroll_id")
                    if preroll_id:
                        ws_params["url"] = f"/api/v1/prerolls/{preroll_id}/file"
                        await self._increment_play_count("preroll", preroll_id)
                        logger.info("Resolved preroll %s for session %s", preroll_id, session_id)
                        await log_session_event(session_id, "preroll_resolved", {
                            "preroll_id": preroll_id,
                        })

            # Resolve sound_id → URL for audio play actions
            if (
                action_type_val == "audio"
                and action.command == "play"
                and ws_params.get("sound_id")
                and "url" not in ws_params
            ):
                ws_params["url"] = f"/api/v1/sounds/{ws_params['sound_id']}/file"

            # Store media play state for later resume
            if action_type_val == "media" and action.command == "play":
                self.store_media_play(session_id, ws_params)

            # For resume command: inject stored media state
            if action_type_val == "media" and action.command == "resume":
                stored = self.get_media_state(session_id)
                if stored:
                    # Pass the stored URL and pause position to the display
                    ws_params["resume_url"] = stored.get("url")
                    ws_params["resume_position_ms"] = stored.get("pause_position_ms")
                    ws_params["resume_media_id"] = stored.get("media_id")
                    logger.info(
                        "Resume action for session %s: url=%s position=%sms",
                        session_id, bool(stored.get("url")), stored.get("pause_position_ms"),
                    )

            if sequence_duration_ms > 0:
                ws_params['sequence_duration_ms'] = sequence_duration_ms
                ws_params['sequence_started_at'] = datetime.now(timezone.utc).isoformat()

            broadcast_cmd = action_cmd_override or action.command
            logger.info(
                "Broadcasting action_execute: %s:%s to session %s",
                action_type_val, broadcast_cmd, session_id,
            )
            sent = await ws_manager.broadcast_display_action(
                session_id=session_id,
                action_type=action_type_val,
                command=broadcast_cmd,
                parameters=ws_params,
                block_id=block_id,
            )
            self._display_states.setdefault(session_id, []).append({
                "action_type": action_type_val,
                "command": broadcast_cmd,
                "parameters": ws_params,
                "broadcast_at": datetime.now(timezone.utc).isoformat(),
                "block_id": block_id,
            })
            if sent == 0:
                logger.warning("Action %s: no display client connected (session %s)", action.id, session_id)
            else:
                ws_msg = f"Sent to {sent} display client(s)"
                message = f"{message}; {ws_msg}" if message else ws_msg

            elapsed = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
            await self._log_action(session_id, action, action_type_val, success, message, elapsed)
            return ActionResult(
                action_id=action.id, success=success, message=message,
                duration_ms=elapsed, error=message if not success else None,
            )

        except Exception as e:
            logger.exception("Error executing action %s: %s", action.id, e)
            await self._log_action(session_id, action, _enum_val(action.action_type), False, None, 0, str(e))
            return ActionResult(action_id=action.id, success=False, error=str(e))

    async def _log_action(
        self,
        session_id: str,
        action: "Action",
        action_type: str,
        success: bool,
        message: str | None,
        duration_ms: int,
        error: str | None = None,
    ) -> None:
        """Log an action result to DB and keep in-memory copy."""
        params = action.parameters or {}
        # Strip internal/sensitive keys from logged parameters
        safe_params = {k: v for k, v in params.items() if not k.startswith("_")}

        event_data = {
            "action_id": action.id,
            "sequence_id": action.sequence.id,
            "sequence_name": action.sequence.name,
            "action_type": action_type,
            "command": action.command,
            "parameters": safe_params,
            "success": success,
            "message": message,
            "duration_ms": duration_ms,
            "error": error or (message if not success else None),
        }

        # In-memory copy (legacy, for action-log endpoint fallback)
        self._action_logs.setdefault(session_id, []).append({
            **event_data,
            "executed_at": datetime.now(timezone.utc).isoformat(),
        })
        if len(self._action_logs[session_id]) > 100:
            self._action_logs[session_id] = self._action_logs[session_id][-100:]

        # Persist to DB
        await log_session_event(session_id, "action_executed", event_data)

    async def _setup_quiz_for_session(
        self, session_id: str, quiz_session_id: str
    ) -> dict | None:
        """Auto-enroll accepted session participants into quiz and start it.

        Returns a dict with quiz display state to include in the broadcast,
        or None on failure.
        """
        from theatarr.api.ws import ws_manager, Channel
        from theatarr.models.session_participant import SessionParticipant, InvitationStatus
        from theatarr.models.quiz import QuizSession, QuizToken, QuizSessionStatus
        from theatarr.models.user import User
        from theatarr.services.quiz import open_quiz, start_quiz, generate_quiz_token

        try:
            db = self._session_db(session_id)

            # 1. Get accepted participants
            result = await db.execute(
                select(SessionParticipant, User)
                .join(User, SessionParticipant.user_id == User.id)
                .where(
                    SessionParticipant.session_id == session_id,
                    SessionParticipant.invitation_status == InvitationStatus.ACCEPTED.value,
                )
            )
            participants = result.all()

            # 2. Get quiz session
            quiz_result = await db.execute(
                select(QuizSession).where(QuizSession.id == quiz_session_id)
            )
            quiz = quiz_result.scalar_one_or_none()
            if not quiz:
                logger.warning("Quiz session %s not found for auto-setup", quiz_session_id)
                return None

            # 3. Create tokens for participants who don't have one
            participant_names: list[str] = []
            for participant, user in participants:
                existing = await db.execute(
                    select(QuizToken).where(
                        QuizToken.quiz_session_id == quiz_session_id,
                        QuizToken.user_id == user.id,
                    )
                )
                name = getattr(user, 'display_name', None) or user.username
                if not existing.scalar_one_or_none():
                    token = QuizToken(
                        quiz_session_id=quiz_session_id,
                        token=generate_quiz_token(),
                        user_id=user.id,
                        participant_name=name,
                        is_active=True,
                        joined_at=datetime.now(),
                    )
                    db.add(token)
                participant_names.append(name)

            await db.flush()

            # 4. Open and start quiz if not already active
            questions = quiz.questions or []
            config = quiz.config or {}
            qs_status = quiz.status.value if isinstance(quiz.status, QuizSessionStatus) else quiz.status
            if qs_status == QuizSessionStatus.DRAFT.value:
                quiz = await open_quiz(db, quiz)
                qs_status = quiz.status.value if isinstance(quiz.status, QuizSessionStatus) else quiz.status

            started_now = False
            if qs_status == QuizSessionStatus.OPEN.value:
                quiz = await start_quiz(db, quiz)
                started_now = True

                # Broadcast quiz_started + first question
                if questions:
                    first_q = questions[0]
                    await ws_manager.broadcast(
                        f"{Channel.QUIZ.value}:{quiz_session_id}",
                        {
                            "type": "quiz_started",
                            "payload": {
                                "quiz_session_id": quiz_session_id,
                                "total_questions": len(questions),
                            },
                        },
                    )
                    await ws_manager.broadcast(
                        f"{Channel.QUIZ.value}:{quiz_session_id}",
                        {
                            "type": "quiz_question",
                            "payload": {
                                "quiz_session_id": quiz_session_id,
                                "question_index": 0,
                                "question": {
                                    "text": first_q.get("text", ""),
                                    "choices": first_q.get("choices", []),
                                    "allow_multiple": first_q.get("allow_multiple", False),
                                    "time_limit_seconds": first_q.get("time_limit_seconds")
                                    or config.get("default_time_limit_seconds", 30),
                                    "hint": first_q.get("hint"),
                                },
                                "total_questions": len(questions),
                            },
                        },
                    )

            await db.commit()
            logger.info(
                "Quiz %s auto-setup for session %s: %d participants enrolled",
                quiz_session_id, session_id, len(participants),
            )

            # 5. Build display state for the broadcast
            qs_status = quiz.status.value if isinstance(quiz.status, QuizSessionStatus) else quiz.status
            current_idx = quiz.current_question_index
            phase = "waiting"
            current_question = None
            time_limit = None

            if started_now and questions:
                phase = "question"
                first_q = questions[0]
                time_limit = first_q.get("time_limit_seconds") or config.get("default_time_limit_seconds", 30)
                current_question = {
                    "text": first_q.get("text", ""),
                    "choices": first_q.get("choices", []),
                    "allow_multiple": first_q.get("allow_multiple", False),
                    "time_limit_seconds": time_limit,
                    "hint": first_q.get("hint"),
                }
            elif qs_status == QuizSessionStatus.ACTIVE.value and 0 <= current_idx < len(questions):
                phase = "question"
                q = questions[current_idx]
                time_limit = q.get("time_limit_seconds") or config.get("default_time_limit_seconds", 30)
                current_question = {
                    "text": q.get("text", ""),
                    "choices": q.get("choices", []),
                    "allow_multiple": q.get("allow_multiple", False),
                    "time_limit_seconds": time_limit,
                    "hint": q.get("hint"),
                }

            # Build join URL (best-effort — uses localhost fallback)
            join_url = f"http://localhost:2173/portal/quiz/{quiz_session_id}"

            return {
                "quiz_session_id": quiz_session_id,
                "name": quiz.name,
                "status": qs_status,
                "phase": phase,
                "current_question_index": current_idx,
                "total_questions": len(questions),
                "current_question": current_question,
                "time_remaining_seconds": time_limit,
                "participants": [
                    {"name": n, "score": 0, "has_answered_current": False}
                    for n in participant_names
                ],
                "scoreboard": [],
                "join_url": join_url,
            }

        except Exception as e:
            logger.exception("Failed to auto-setup quiz %s for session %s: %s", quiz_session_id, session_id, e)
            return None

    async def _run_quiz_timer(
        self,
        session_id: str,
        quiz_session_id: str,
        total_duration_s: float | None = None,
    ) -> None:
        """Auto-advance quiz questions when time limit expires.

        Runs as a background task. Advances questions even when no display
        is connected and no participants answer. Ends the quiz when total
        sequence duration is exceeded.
        """
        from theatarr.database import async_session_maker
        from theatarr.models.quiz import QuizSession, QuizSessionStatus
        from theatarr.services.quiz import (
            advance_question, end_quiz, get_scoreboard, get_question_stats,
        )
        from theatarr.api.ws import ws_manager, Channel
        from theatarr.api.quiz import _build_public_question, _pending_advance_tasks

        quiz_start = time.monotonic()

        try:
            while True:
                # 1. Read current quiz state
                async with async_session_maker() as db:
                    result = await db.execute(
                        select(QuizSession).where(QuizSession.id == quiz_session_id)
                    )
                    qs = result.scalar_one_or_none()
                    if not qs:
                        return
                    qs_status = qs.status.value if isinstance(qs.status, QuizSessionStatus) else qs.status
                    if qs_status != QuizSessionStatus.ACTIVE.value:
                        return

                    questions = qs.questions or []
                    config = qs.config or {}
                    current_idx = qs.current_question_index
                    if current_idx < 0 or current_idx >= len(questions):
                        return

                    question = questions[current_idx]
                    time_limit = question.get("time_limit_seconds") or config.get("default_time_limit_seconds", 30)

                    if qs.current_question_started_at:
                        q_elapsed = (datetime.now() - qs.current_question_started_at).total_seconds()
                        wait_s = max(0, time_limit - q_elapsed)
                    else:
                        wait_s = time_limit

                # Cap by total duration
                if total_duration_s is not None:
                    total_remaining = max(0, total_duration_s - (time.monotonic() - quiz_start))
                    wait_s = min(wait_s, total_remaining)

                # 2. Sleep until question timeout
                if wait_s > 0:
                    await asyncio.sleep(wait_s)

                # 3. Check total time exceeded → force end quiz
                if total_duration_s is not None and (time.monotonic() - quiz_start) >= total_duration_s:
                    async with async_session_maker() as db:
                        result = await db.execute(
                            select(QuizSession).where(QuizSession.id == quiz_session_id)
                        )
                        qs = result.scalar_one_or_none()
                        if qs:
                            qs_status = qs.status.value if isinstance(qs.status, QuizSessionStatus) else qs.status
                            if qs_status == QuizSessionStatus.ACTIVE.value:
                                logger.info("Quiz %s: total duration exceeded, ending quiz", quiz_session_id)
                                qs = await end_quiz(db, qs)
                                scoreboard = await get_scoreboard(db, qs.id)
                                all_stats = await get_question_stats(db, qs.id)
                                await ws_manager.broadcast(
                                    f"{Channel.QUIZ.value}:{qs.id}",
                                    {
                                        "type": "quiz_ended",
                                        "payload": {
                                            "quiz_session_id": qs.id,
                                            "scoreboard": scoreboard,
                                            "question_stats": all_stats,
                                        },
                                    },
                                )
                    return

                # 4. Re-check state and advance
                async with async_session_maker() as db:
                    result = await db.execute(
                        select(QuizSession).where(QuizSession.id == quiz_session_id)
                    )
                    qs = result.scalar_one_or_none()
                    if not qs:
                        return
                    qs_status = qs.status.value if isinstance(qs.status, QuizSessionStatus) else qs.status
                    if qs_status != QuizSessionStatus.ACTIVE.value:
                        return

                    # Already advanced by participants or admin
                    if qs.current_question_index != current_idx:
                        continue

                    questions = qs.questions or []
                    config = qs.config or {}
                    show_feedback = config.get("show_feedback", True)
                    feedback_delay = config.get("feedback_delay_seconds", 5)

                    # Cancel any pending delayed advance from _check_auto_advance
                    pending = _pending_advance_tasks.pop(quiz_session_id, None)
                    if pending and not pending.done():
                        pending.cancel()

                    # Show feedback if configured
                    if show_feedback and current_idx < len(questions):
                        prev_q = questions[current_idx]
                        q_stats = await get_question_stats(db, qs.id, current_idx)
                        await ws_manager.broadcast(
                            f"{Channel.QUIZ.value}:{qs.id}",
                            {
                                "type": "quiz_question_results",
                                "payload": {
                                    "quiz_session_id": qs.id,
                                    "question_index": current_idx,
                                    "correct_indices": prev_q.get("correct_indices", []),
                                    "stats": q_stats[0] if q_stats else None,
                                    "feedback_delay_seconds": feedback_delay,
                                },
                            },
                        )
                        await asyncio.sleep(feedback_delay)

                    # Advance to next question
                    logger.info("Quiz %s: auto-advancing from question %d (timeout)", quiz_session_id, current_idx)
                    qs, is_ended = await advance_question(db, qs)

                    if is_ended:
                        scoreboard = await get_scoreboard(db, qs.id)
                        all_stats = await get_question_stats(db, qs.id)
                        await ws_manager.broadcast(
                            f"{Channel.QUIZ.value}:{qs.id}",
                            {
                                "type": "quiz_ended",
                                "payload": {
                                    "quiz_session_id": qs.id,
                                    "scoreboard": scoreboard,
                                    "question_stats": all_stats,
                                },
                            },
                        )
                        return
                    else:
                        new_idx = qs.current_question_index
                        if new_idx < len(questions):
                            new_question = _build_public_question(questions[new_idx], config)
                            await ws_manager.broadcast(
                                f"{Channel.QUIZ.value}:{qs.id}",
                                {
                                    "type": "quiz_question",
                                    "payload": {
                                        "quiz_session_id": qs.id,
                                        "question_index": new_idx,
                                        "question": new_question,
                                        "total_questions": len(questions),
                                    },
                                },
                            )
        except asyncio.CancelledError:
            pass
        except Exception:
            logger.exception("Quiz timer error for session %s, quiz %s", session_id, quiz_session_id)
        finally:
            self._quiz_tasks.pop(session_id, None)

    async def _transition_to_next_sequence(self, session: Session) -> None:
        """Transition to the next sequence."""
        # Capture IDs before any commit() can expire ORM objects
        sid = session.id
        transition_start = time.perf_counter()
        monitor = get_performance_monitor()
        db = self._session_db(sid)
        next_index = session.current_sequence_index + 1

        if next_index >= session.total_sequences:
            session.status = SessionStatus.COMPLETED
            session.completed_at = datetime.now(timezone.utc)
            await db.commit()
            logger.info("Session %s completed (all sequences done)", sid)
            await self._emit_state_change(session)
            return

        next_sequence = session.sequences[next_index]
        pre_delay_ms = (time.perf_counter() - transition_start) * 1000

        if next_sequence.transition_ms > 0:
            await asyncio.sleep(next_sequence.transition_ms / 1000)

        post_delay_start = time.perf_counter()
        session.current_sequence_index = next_index
        session.current_sequence_elapsed_ms = 0
        await db.commit()
        await self._emit_state_change(session)
        post_delay_ms = (time.perf_counter() - post_delay_start) * 1000

        overhead_ms = pre_delay_ms + post_delay_ms
        monitor.record_sync(
            "transition_overhead", overhead_ms,
            session_id=sid,
            from_index=next_index - 1,
            to_index=next_index,
        )
        if overhead_ms > TRANSITION_OVERHEAD_TARGET_MS:
            logger.warning(
                "Transition overhead (%.2fms) exceeded target (%dms) for session %s",
                overhead_ms, TRANSITION_OVERHEAD_TARGET_MS, sid,
            )

    async def _build_session_overview(self, session_id: str) -> dict[str, Any]:
        """Build a session overview for the session-info waiting screen."""
        from datetime import timedelta

        from theatarr.models.session_participant import SessionParticipant, InvitationStatus
        from sqlalchemy import func

        db = self._session_db(session_id)
        session = await self._get_session(session_id)

        # Participant counts
        part_result = await db.execute(
            select(
                func.count().label("total"),
                func.count().filter(
                    SessionParticipant.invitation_status == InvitationStatus.ACCEPTED.value
                ).label("accepted"),
            ).where(SessionParticipant.session_id == session_id)
        )
        part_row = part_result.first()
        participants_total = part_row.total if part_row else 0
        participants_accepted = int(part_row.accepted or 0) if part_row else 0

        # Build sequences summary
        sequences_summary = []
        total_duration_ms = 0
        for seq in sorted(session.sequences, key=lambda s: s.order_index):
            eff_dur = seq.effective_duration_ms
            total_duration_ms += eff_dur

            actions_summary = []
            for act in (seq.actions or []):
                label, icon, details = await _describe_action(act, db)
                actions_summary.append({
                    "action_type": _enum_val(act.action_type),
                    "command": act.command,
                    "label": label,
                    "icon": icon,
                    "details": details,
                })

            sequences_summary.append({
                "name": seq.name,
                "order_index": seq.order_index,
                "duration_ms": eff_dur,
                "duration_type": _enum_val(seq.duration_type),
                "actions": actions_summary,
            })

        # Estimated end time
        now = datetime.now(timezone.utc)
        elapsed_ms = session.current_sequence_elapsed_ms or 0
        elapsed_sequences_ms = sum(
            s["duration_ms"] for s in sequences_summary[:session.current_sequence_index]
        )
        remaining_ms = total_duration_ms - elapsed_sequences_ms - elapsed_ms
        estimated_end = (now + timedelta(milliseconds=max(0, remaining_ms))).isoformat()

        return {
            "participants_accepted": participants_accepted,
            "participants_total": participants_total,
            "sequences": sequences_summary,
            "total_duration_ms": total_duration_ms,
            "estimated_end_time": estimated_end,
            "current_sequence_index": session.current_sequence_index,
        }

    async def _build_feedback_display_data(self, session_id: str) -> dict[str, Any]:
        """Build feedback display data for the wallmount template."""
        from theatarr.api.feedback import _get_session_action_types
        from theatarr.models.settings import get_frontend_url

        db = self._session_db(session_id)
        session = await self._get_session(session_id)
        action_types = await _get_session_action_types(db, session_id)

        frontend_url = await get_frontend_url(db)
        feedback_url = f"{frontend_url}/portal/sessions/{session_id}#feedback"

        return {
            "session_id": session_id,
            "session_name": session.name,
            "movie_title": session.movie_title,
            "movie_poster_url": session.movie_poster_url,
            "action_types": sorted(action_types),
            "feedback_url": feedback_url,
        }

    async def get_session_state(self, session_id: str) -> dict[str, Any]:
        """Get current state of a session."""
        session = await self._get_session(session_id, use_lifecycle_db=True)
        state: dict[str, Any] = {
            "session_id": session.id,
            "status": _enum_val(session.status),
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
                "duration_type": _enum_val(seq.duration_type),
                "duration_ms": seq.duration_ms,
                "remaining_ms": remaining,
            }
        return state


# ------------------------------------------------------------------
# Global singleton
# ------------------------------------------------------------------

_engine: SequenceEngine | None = None


def get_engine() -> SequenceEngine:
    """Get the global engine singleton."""
    global _engine
    if _engine is None:
        _engine = SequenceEngine()
    return _engine
