"""Trailers API router for Theatarr."""

import logging
import os
import random
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select

from theatarr.api.deps import AdminUser
from theatarr.api.errors import NotFoundError
from theatarr.database import DbSession
from theatarr.models.trailer import Trailer, TrailerRule, TrailerStatus
from theatarr.schemas.trailer import (
    StorageStatsResponse,
    TrailerCreate,
    TrailerDownloadRequest,
    TrailerListResponse,
    TrailerResponse,
    TrailerRuleCreate,
    TrailerRuleListResponse,
    TrailerRuleResponse,
    TrailerRuleUpdate,
    TrailerUpdate,
)
from theatarr.services.trailer_manager import (
    apply_rotation,
    download_trailer,
    get_storage_stats,
    run_trailer_rule,
    select_contextual_trailers,
)

logger = logging.getLogger(__name__)

# Bidirectional genre name mapping for EN↔FR normalisation
_GENRE_NORMALIZE: dict[str, str] = {
    # EN → canonical FR
    "action": "Action",
    "adventure": "Aventure",
    "animation": "Animation",
    "comedy": "Comédie",
    "crime": "Crime",
    "documentary": "Documentaire",
    "drama": "Drame",
    "family": "Familial",
    "fantasy": "Fantastique",
    "history": "Histoire",
    "horror": "Horreur",
    "music": "Musique",
    "mystery": "Mystère",
    "romance": "Romance",
    "science fiction": "Science-Fiction",
    "tv movie": "Téléfilm",
    "thriller": "Thriller",
    "war": "Guerre",
    "western": "Western",
    # FR → canonical FR (normalise case/accents)
    "aventure": "Aventure",
    "comédie": "Comédie",
    "documentaire": "Documentaire",
    "drame": "Drame",
    "familial": "Familial",
    "fantastique": "Fantastique",
    "histoire": "Histoire",
    "horreur": "Horreur",
    "musique": "Musique",
    "mystère": "Mystère",
    "science-fiction": "Science-Fiction",
    "téléfilm": "Téléfilm",
    "guerre": "Guerre",
}


def _normalize_genres(genres: list[str] | set[str]) -> set[str]:
    """Normalize genre names to canonical French, handling EN/FR/mixed inputs."""
    result: set[str] = set()
    for g in genres:
        canonical = _GENRE_NORMALIZE.get(g.lower(), g)
        result.add(canonical)
    return result


router = APIRouter(prefix="/trailers", tags=["Trailers"])


def _trailer_to_response(trailer: Trailer) -> TrailerResponse:
    """Convert Trailer model to response schema."""
    return TrailerResponse(
        id=trailer.id,
        movie_title=trailer.movie_title,
        movie_year=trailer.movie_year,
        movie_tmdb_id=trailer.movie_tmdb_id,
        title=trailer.title,
        description=trailer.description,
        source_type=trailer.source_type,
        source_url=trailer.source_url,
        source_id=trailer.source_id,
        duration_seconds=trailer.duration_seconds,
        file_path=trailer.file_path,
        file_size_bytes=trailer.file_size_bytes,
        file_size_mb=trailer.file_size_mb,
        quality=trailer.quality,
        format=trailer.format,
        thumbnail_url=trailer.thumbnail_url or trailer.thumbnail_path,
        status=trailer.status.value if hasattr(trailer.status, "value") else trailer.status,
        error_message=trailer.error_message,
        download_progress=trailer.download_progress,
        genres=trailer.genres,
        tags=trailer.tags,
        rating=trailer.rating,
        play_count=trailer.play_count,
        last_played_at=trailer.last_played_at,
        is_ready=trailer.is_ready,
        created_at=trailer.created_at,
        updated_at=trailer.updated_at,
    )


def _rule_to_response(rule: TrailerRule) -> TrailerRuleResponse:
    """Convert TrailerRule model to response schema."""
    return TrailerRuleResponse(
        id=rule.id,
        name=rule.name,
        description=rule.description,
        is_enabled=rule.is_enabled,
        genres=rule.genres,
        min_year=rule.min_year,
        max_year=rule.max_year,
        min_rating=rule.min_rating,
        max_rating=rule.max_rating,
        preferred_quality=rule.preferred_quality,
        min_quality=rule.min_quality,
        min_duration=rule.min_duration,
        max_duration=rule.max_duration,
        max_storage_gb=rule.max_storage_gb,
        max_trailer_count=rule.max_trailer_count,
        max_downloads_per_run=rule.max_downloads_per_run,
        frequency=rule.frequency,
        rotation_enabled=rule.rotation_enabled,
        rotation_keep_most_recent=rule.rotation_keep_most_recent,
        rotation_keep_most_played=rule.rotation_keep_most_played,
        last_run_at=rule.last_run_at,
        next_run_at=rule.next_run_at,
        total_downloads=rule.total_downloads,
        total_storage_bytes=rule.total_storage_bytes,
        storage_used_gb=rule.storage_used_gb,
        is_at_storage_limit=rule.is_at_storage_limit,
        trailer_count=len(rule.trailers) if rule.trailers else 0,
        created_at=rule.created_at,
        updated_at=rule.updated_at,
    )


# ============================================================================
# Trailer Endpoints
# ============================================================================


@router.get(
    "",
    response_model=TrailerListResponse,
    summary="List Trailers",
)
async def list_trailers(
    db: DbSession,
    user: AdminUser,
    status_filter: str | None = None,
    genre: str | None = None,
    quality: str | None = None,
    search: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> TrailerListResponse:
    """List all trailers with optional filters."""
    query = select(Trailer)

    if status_filter:
        query = query.where(Trailer.status == status_filter)
    if genre:
        query = query.where(Trailer.genres.contains([genre]))
    if quality:
        query = query.where(Trailer.quality == quality)
    if search:
        query = query.where(
            Trailer.movie_title.ilike(f"%{search}%")
            | Trailer.title.ilike(f"%{search}%")
        )

    # Get total size
    size_query = select(func.sum(Trailer.file_size_bytes)).where(
        Trailer.status == TrailerStatus.READY
    )
    size_result = await db.execute(size_query)
    total_size = size_result.scalar() or 0

    # Get total count
    count_query = select(func.count(Trailer.id))
    if status_filter:
        count_query = count_query.where(Trailer.status == status_filter)
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    # Get paginated results
    query = query.order_by(Trailer.created_at.desc())
    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    trailers = result.scalars().all()

    return TrailerListResponse(
        items=[_trailer_to_response(t) for t in trailers],
        total=total,
        total_size_bytes=total_size,
        total_size_gb=round(total_size / (1024 * 1024 * 1024), 2),
    )


@router.post(
    "",
    response_model=TrailerResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Trailer Entry",
)
async def create_trailer(
    db: DbSession,
    user: AdminUser,
    data: TrailerCreate,
) -> TrailerResponse:
    """Create a new trailer entry (without downloading)."""
    trailer = Trailer(
        movie_title=data.movie_title,
        movie_year=data.movie_year,
        movie_tmdb_id=data.movie_tmdb_id,
        title=data.title,
        description=data.description,
        source_type=data.source_type,
        source_url=data.source_url,
        source_id=data.source_id,
        genres=data.genres,
        tags=data.tags,
    )
    db.add(trailer)
    await db.commit()
    await db.refresh(trailer)

    return _trailer_to_response(trailer)


@router.post(
    "/download",
    response_model=TrailerResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Download Trailer",
)
async def download_trailer_endpoint(
    db: DbSession,
    user: AdminUser,
    background_tasks: BackgroundTasks,
    data: TrailerDownloadRequest,
) -> TrailerResponse:
    """Create and download a trailer from URL."""
    # Check for existing trailer with same source URL
    if data.source_url:
        existing = await db.execute(
            select(Trailer).where(Trailer.source_url == data.source_url)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Une bande-annonce avec cette URL existe déjà",
            )

    # Create trailer entry
    trailer = Trailer(
        movie_title=data.movie_title,
        movie_year=data.movie_year,
        movie_tmdb_id=data.movie_tmdb_id,
        title=f"{data.movie_title} - Trailer",
        source_type="youtube",
        source_url=data.source_url,
        quality=data.preferred_quality,
    )
    db.add(trailer)
    await db.commit()
    await db.refresh(trailer)

    # Start download in background
    background_tasks.add_task(download_trailer, db, trailer)

    return _trailer_to_response(trailer)


@router.get(
    "/stats",
    response_model=StorageStatsResponse,
    summary="Get Storage Stats",
)
async def get_storage_statistics(
    db: DbSession,
    user: AdminUser,
) -> StorageStatsResponse:
    """Get storage statistics for trailers."""
    stats = await get_storage_stats(db)
    return StorageStatsResponse(**stats)


@router.get(
    "/contextual",
    response_model=TrailerListResponse,
    summary="Get Contextual Trailers",
)
async def get_contextual_trailers(
    db: DbSession,
    user: AdminUser,
    genres: str | None = None,  # Comma-separated
    count: int = 3,
    exclude: str | None = None,  # Comma-separated IDs
) -> TrailerListResponse:
    """Get trailers contextually matched to genres."""
    genre_list = genres.split(",") if genres else None
    exclude_list = exclude.split(",") if exclude else None

    trailers = await select_contextual_trailers(
        db,
        genres=genre_list,
        count=count,
        exclude_ids=exclude_list,
    )

    total_size = sum(t.file_size_bytes or 0 for t in trailers)

    return TrailerListResponse(
        items=[_trailer_to_response(t) for t in trailers],
        total=len(trailers),
        total_size_bytes=total_size,
        total_size_gb=round(total_size / (1024 * 1024 * 1024), 2),
    )


@router.post(
    "/auto-preview",
    summary="Preview auto-trailer candidates from TMDB",
)
async def auto_preview(
    db: DbSession,
    user: AdminUser,
    count: int = 3,
    exclude_tmdb_ids: str | None = None,
    movie_id: str | None = None,
    movie_tmdb_id: str | None = None,
    genres: str | None = None,
) -> list[dict]:
    """Search TMDB for upcoming/popular trailer candidates without downloading.

    Accepts movie_id (internal DB UUID), movie_tmdb_id (TMDB source ID),
    or genres (comma-separated genre names from frontend, e.g. "Animation,Familial").
    If provided, prioritises candidates matching the movie's genres.
    Returns a list of {tmdb_id, movie_title, trailer_title, genres} for preview.
    """
    from theatarr.adapters.base import Command
    from theatarr.adapters.registry import AdapterRegistry
    from theatarr.models.movie import Movie
    from theatarr.models.service import Service

    # Resolve session movie genres if provided (normalised to canonical FR)
    target_genres: set[str] = set()
    session_tmdb_id: str | None = movie_tmdb_id

    # Priority: direct genres param > movie_id lookup > movie_tmdb_id lookup
    if genres:
        target_genres = _normalize_genres([g.strip() for g in genres.split(",") if g.strip()])

    if movie_id and not target_genres:
        movie_result = await db.execute(select(Movie).where(Movie.id == movie_id))
        movie = movie_result.scalar_one_or_none()
        if movie:
            target_genres = _normalize_genres(movie.genres or [])
            session_tmdb_id = session_tmdb_id or movie.tmdb_id

    svc_result = await db.execute(
        select(Service).where(Service.adapter_type == "tmdb", Service.is_enabled == True)
    )
    tmdb_service = svc_result.scalar_one_or_none()
    if not tmdb_service:
        raise HTTPException(status_code=400, detail="No TMDB service configured")

    adapter = AdapterRegistry.create_adapter("tmdb", tmdb_service.config)
    await adapter.connect()
    try:
        # If we have a TMDB ID but no genres yet, fetch them from TMDB
        if session_tmdb_id and not target_genres:
            details_res = await adapter.execute(
                Command(action="get_movie", parameters={"movie_id": session_tmdb_id})
            )
            if details_res.success and details_res.data:
                target_genres = _normalize_genres(details_res.data.get("genres", []))

        # Fetch upcoming movies (primary source) + now_playing for variety
        upcoming: list[dict] = []
        for page in (1, 2, 3):
            res = await adapter.execute(
                Command(action="get_upcoming_movies", parameters={"page": page})
            )
            if res.success and res.data:
                upcoming.extend(res.data.get("results", []))
        # Also fetch now_playing (recent releases that still have trailers)
        res = await adapter.execute(
            Command(action="get_now_playing", parameters={"page": 1})
        )
        if res.success and res.data:
            upcoming.extend(res.data.get("results", []))

        # Deduplicate
        seen: set[str] = set()
        candidates: list[dict] = []
        for m in upcoming:
            tid = str(m.get("tmdb_id", ""))
            if tid and tid not in seen:
                seen.add(tid)
                candidates.append(m)

        # Exclude specified IDs + session movie itself
        exclude_set = set((exclude_tmdb_ids or "").split(",")) - {""}
        if session_tmdb_id:
            exclude_set.add(str(session_tmdb_id))
        if exclude_set:
            candidates = [m for m in candidates if str(m.get("tmdb_id")) not in exclude_set]

        # Shuffle for randomness on each call
        random.shuffle(candidates)

        adapter_lang = getattr(adapter, "language", "") or "fr-FR"

        # Collect viable candidates (with trailers in configured language),
        # checking up to max_check movies to build a decent pool.
        max_check = min(len(candidates), 25)
        viable: list[dict] = []
        fallback: list[dict] = []
        for movie_data in candidates[:max_check]:
            tmdb_id = str(movie_data.get("tmdb_id", ""))
            trailer_result = await adapter.execute(
                Command(action="get_trailers", parameters={"movie_id": tmdb_id})
            )
            if not (trailer_result.success and trailer_result.data):
                continue
            all_trailers = [
                t for t in trailer_result.data.get("trailers", [])
                if t.get("type") == "Trailer"
            ]
            if not all_trailers:
                continue
            # Strictly prefer trailers in the configured language
            lang_trailers = [t for t in all_trailers if t.get("language") == adapter_lang]
            entry = {
                "tmdb_id": tmdb_id,
                "movie_title": movie_data.get("title", "Unknown"),
                "trailer_title": (lang_trailers or all_trailers)[0].get("name", "Trailer"),
                "movie_year": movie_data.get("year"),
                "poster_url": movie_data.get("poster_url"),
                "genres": movie_data.get("genres", []),
            }
            if lang_trailers:
                viable.append(entry)
            else:
                fallback.append(entry)

        # Pick from viable pool; use fallback only if not enough
        pool = viable if len(viable) >= count else viable + fallback
        if len(pool) <= count:
            return pool
        return random.sample(pool, count)
    finally:
        await adapter.disconnect()


@router.get(
    "/{trailer_id}/file",
    summary="Serve Trailer File",
)
async def serve_trailer_file(
    db: DbSession,
    trailer_id: str,
) -> FileResponse:
    """Serve a trailer file for playback. No auth required for display access."""
    result = await db.execute(select(Trailer).where(Trailer.id == trailer_id))
    trailer = result.scalar_one_or_none()
    if not trailer:
        raise NotFoundError("Trailer", trailer_id)
    if not trailer.file_path or not os.path.exists(trailer.file_path):
        raise HTTPException(status_code=404, detail="Trailer file not found on disk")
    media_types = {"mp4": "video/mp4", "mkv": "video/x-matroska", "webm": "video/webm"}
    media_type = media_types.get(trailer.format, "video/mp4")
    return FileResponse(
        path=trailer.file_path, media_type=media_type,
        filename=f"{trailer.movie_title}.{trailer.format}",
    )


@router.get(
    "/{trailer_id}",
    response_model=TrailerResponse,
    summary="Get Trailer",
)
async def get_trailer(
    db: DbSession,
    user: AdminUser,
    trailer_id: str,
) -> TrailerResponse:
    """Get a trailer by ID."""
    result = await db.execute(select(Trailer).where(Trailer.id == trailer_id))
    trailer = result.scalar_one_or_none()

    if not trailer:
        raise NotFoundError("Trailer", trailer_id)

    return _trailer_to_response(trailer)


@router.patch(
    "/{trailer_id}",
    response_model=TrailerResponse,
    summary="Update Trailer",
)
async def update_trailer(
    db: DbSession,
    user: AdminUser,
    trailer_id: str,
    data: TrailerUpdate,
) -> TrailerResponse:
    """Update trailer metadata."""
    result = await db.execute(select(Trailer).where(Trailer.id == trailer_id))
    trailer = result.scalar_one_or_none()

    if not trailer:
        raise NotFoundError("Trailer", trailer_id)

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(trailer, field, value)

    await db.commit()
    await db.refresh(trailer)

    return _trailer_to_response(trailer)


@router.delete(
    "/{trailer_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Trailer",
)
async def delete_trailer(
    db: DbSession,
    user: AdminUser,
    trailer_id: str,
) -> None:
    """Delete a trailer and its files."""
    result = await db.execute(select(Trailer).where(Trailer.id == trailer_id))
    trailer = result.scalar_one_or_none()

    if not trailer:
        raise NotFoundError("Trailer", trailer_id)

    # Delete files
    import os
    if trailer.file_path and os.path.exists(trailer.file_path):
        os.remove(trailer.file_path)
    if trailer.thumbnail_path and os.path.exists(trailer.thumbnail_path):
        os.remove(trailer.thumbnail_path)

    await db.delete(trailer)
    await db.commit()


@router.post(
    "/{trailer_id}/play",
    response_model=TrailerResponse,
    summary="Mark Trailer as Played",
)
async def mark_played(
    db: DbSession,
    user: AdminUser,
    trailer_id: str,
) -> TrailerResponse:
    """Increment play count and update last played timestamp."""
    result = await db.execute(select(Trailer).where(Trailer.id == trailer_id))
    trailer = result.scalar_one_or_none()

    if not trailer:
        raise NotFoundError("Trailer", trailer_id)

    trailer.play_count += 1
    trailer.last_played_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(trailer)

    return _trailer_to_response(trailer)


# ============================================================================
# Trailer Rule Endpoints
# ============================================================================


@router.get(
    "/rules",
    response_model=TrailerRuleListResponse,
    summary="List Trailer Rules",
)
async def list_rules(
    db: DbSession,
    user: AdminUser,
) -> TrailerRuleListResponse:
    """List all trailer download rules."""
    result = await db.execute(
        select(TrailerRule).order_by(TrailerRule.created_at.desc())
    )
    rules = result.scalars().all()

    return TrailerRuleListResponse(
        items=[_rule_to_response(r) for r in rules],
        total=len(rules),
    )


@router.post(
    "/rules",
    response_model=TrailerRuleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Trailer Rule",
)
async def create_rule(
    db: DbSession,
    user: AdminUser,
    data: TrailerRuleCreate,
) -> TrailerRuleResponse:
    """Create a new trailer download rule."""
    rule = TrailerRule(
        name=data.name,
        description=data.description,
        is_enabled=data.is_enabled,
        genres=data.genres,
        min_year=data.min_year,
        max_year=data.max_year,
        min_rating=data.min_rating,
        max_rating=data.max_rating,
        preferred_quality=data.preferred_quality,
        min_quality=data.min_quality,
        min_duration=data.min_duration,
        max_duration=data.max_duration,
        max_storage_gb=data.max_storage_gb,
        max_trailer_count=data.max_trailer_count,
        max_downloads_per_run=data.max_downloads_per_run,
        frequency=data.frequency,
        rotation_enabled=data.rotation_enabled,
        rotation_keep_most_recent=data.rotation_keep_most_recent,
        rotation_keep_most_played=data.rotation_keep_most_played,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)

    return _rule_to_response(rule)


@router.get(
    "/rules/{rule_id}",
    response_model=TrailerRuleResponse,
    summary="Get Trailer Rule",
)
async def get_rule(
    db: DbSession,
    user: AdminUser,
    rule_id: str,
) -> TrailerRuleResponse:
    """Get a trailer rule by ID."""
    result = await db.execute(select(TrailerRule).where(TrailerRule.id == rule_id))
    rule = result.scalar_one_or_none()

    if not rule:
        raise NotFoundError("TrailerRule", rule_id)

    return _rule_to_response(rule)


@router.patch(
    "/rules/{rule_id}",
    response_model=TrailerRuleResponse,
    summary="Update Trailer Rule",
)
async def update_rule(
    db: DbSession,
    user: AdminUser,
    rule_id: str,
    data: TrailerRuleUpdate,
) -> TrailerRuleResponse:
    """Update a trailer rule."""
    result = await db.execute(select(TrailerRule).where(TrailerRule.id == rule_id))
    rule = result.scalar_one_or_none()

    if not rule:
        raise NotFoundError("TrailerRule", rule_id)

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(rule, field, value)

    await db.commit()
    await db.refresh(rule)

    return _rule_to_response(rule)


@router.delete(
    "/rules/{rule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Trailer Rule",
)
async def delete_rule(
    db: DbSession,
    user: AdminUser,
    rule_id: str,
) -> None:
    """Delete a trailer rule."""
    result = await db.execute(select(TrailerRule).where(TrailerRule.id == rule_id))
    rule = result.scalar_one_or_none()

    if not rule:
        raise NotFoundError("TrailerRule", rule_id)

    await db.delete(rule)
    await db.commit()


@router.post(
    "/rules/{rule_id}/run",
    response_model=dict,
    summary="Run Trailer Rule",
)
async def run_rule(
    db: DbSession,
    user: AdminUser,
    background_tasks: BackgroundTasks,
    rule_id: str,
) -> dict:
    """Manually trigger a trailer rule execution."""
    result = await db.execute(select(TrailerRule).where(TrailerRule.id == rule_id))
    rule = result.scalar_one_or_none()

    if not rule:
        raise NotFoundError("TrailerRule", rule_id)

    # Find TMDB adapter
    from theatarr.adapters.registry import AdapterRegistry
    from theatarr.models.service import Service

    svc_result = await db.execute(
        select(Service).where(Service.adapter_type == "tmdb", Service.is_enabled == True)
    )
    tmdb_service = svc_result.scalar_one_or_none()
    if not tmdb_service:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Aucun service TMDB actif configuré",
        )

    tmdb_adapter = AdapterRegistry.create_adapter("tmdb", tmdb_service.config)
    await tmdb_adapter.connect()

    async def _run_rule() -> None:
        try:
            result = await run_trailer_rule(db, rule, tmdb_adapter)
            logger.info("Trailer rule %s executed: %s", rule_id, result)
        except Exception:
            logger.exception("Failed to run trailer rule %s", rule_id)
        finally:
            await tmdb_adapter.disconnect()

    background_tasks.add_task(_run_rule)

    return {
        "status": "queued",
        "message": "L'exécution de la règle a été lancée",
        "rule_id": rule_id,
    }


@router.post(
    "/rules/{rule_id}/rotate",
    response_model=dict,
    summary="Apply Rotation Policy",
)
async def rotate_rule(
    db: DbSession,
    user: AdminUser,
    rule_id: str,
) -> dict:
    """Apply rotation policy to a rule's trailers."""
    result = await db.execute(select(TrailerRule).where(TrailerRule.id == rule_id))
    rule = result.scalar_one_or_none()

    if not rule:
        raise NotFoundError("TrailerRule", rule_id)

    deleted_ids = await apply_rotation(db, rule)

    return {
        "status": "completed",
        "deleted_count": len(deleted_ids),
        "deleted_ids": deleted_ids,
    }
