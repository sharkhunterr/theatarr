"""Movie resolution service for Theatarr.

Handles resolving movies for vote and mystery selection modes.
"""

import logging
import random
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from theatarr.models.session import MovieSelectionMode, Session
from theatarr.models.vote import VoteSession
from theatarr.services.palette import extract_palette_from_url, PaletteExtractionError

logger = logging.getLogger(__name__)


async def _ensure_movie_in_db(
    db: AsyncSession,
    movie_id: str | None,
    movie_source: str,
    movie_source_id: str,
    movie_poster_url: str | None = None,
) -> str | None:
    """Ensure the movie exists in the local database.

    The movie_id from vote/mystery options may be a source key (e.g. Plex ratingKey)
    rather than a DB UUID. This checks if it's a valid DB movie, and if not,
    syncs the movie from source.

    Returns:
        Valid DB movie ID, or None if sync fails.
    """
    from theatarr.models.movie import Movie
    from theatarr.services.movie_sync import ensure_movie_synced

    # Check if movie_id is a valid DB movie
    if movie_id:
        result = await db.execute(
            select(Movie).where(Movie.id == movie_id)
        )
        if result.scalar_one_or_none():
            return movie_id  # Already a valid DB ID

    # movie_id is missing or not a valid DB ID — sync from source
    synced_id = await ensure_movie_synced(
        db=db,
        movie_source=movie_source,
        movie_source_id=movie_source_id,
        movie_poster_url=movie_poster_url,
    )
    if synced_id:
        logger.info(f"Synced movie from {movie_source}/{movie_source_id} -> DB ID {synced_id}")
    return synced_id


async def _apply_enrichment(
    db: AsyncSession,
    session: Session,
    movie_id: str,
) -> None:
    """Apply enrichment options (TMDB, Fanart, palette) to a resolved movie.

    Reads enrichment_options from the session and applies requested enrichments.

    Args:
        db: Database session.
        session: Cinema session with enrichment_options.
        movie_id: ID of the movie to enrich.
    """
    options = session.enrichment_options or {}
    if not options:
        return

    from theatarr.services.movie_enrichment import (
        enrich_from_tmdb,
        enrich_from_fanart,
        EnrichmentError,
    )

    # TMDB enrichment
    if options.get("tmdb"):
        try:
            await enrich_from_tmdb(db, movie_id)
            logger.info(f"TMDB enrichment applied for session {session.id}")
        except EnrichmentError as e:
            logger.warning(f"TMDB enrichment failed for session {session.id}: {e}")

    # Fanart.tv enrichment
    if options.get("fanart"):
        try:
            await enrich_from_fanart(db, movie_id)
            logger.info(f"Fanart.tv enrichment applied for session {session.id}")
        except EnrichmentError as e:
            logger.warning(f"Fanart.tv enrichment failed for session {session.id}: {e}")

    # Palette extraction
    if options.get("palette") and session.movie_poster_url:
        try:
            palette = await extract_palette_from_url(session.movie_poster_url)
            session.color_palette = palette
            logger.info(f"Palette extracted for session {session.id}")
        except PaletteExtractionError as e:
            logger.warning(f"Palette extraction failed for session {session.id}: {e}")


class MovieResolutionError(Exception):
    """Error during movie resolution."""

    pass


async def resolve_vote_winner(
    db: AsyncSession,
    session: Session,
    vote_session: VoteSession | None = None,
) -> Session:
    """Resolve the winning movie from a vote session and apply it to the cinema session.

    Also extracts color palette from the winning movie's poster.

    Args:
        db: Database session.
        session: Cinema session to update.
        vote_session: Vote session (will be fetched if not provided).

    Returns:
        Updated Session with movie info populated.

    Raises:
        MovieResolutionError: If resolution fails.
    """
    if session.movie_selection_mode != MovieSelectionMode.VOTE.value:
        raise MovieResolutionError(
            f"Session {session.id} is not in VOTE mode"
        )

    if session.movie_resolved:
        logger.info(f"Session {session.id} already has a resolved movie")
        return session

    # Get linked vote session if not provided
    if vote_session is None:
        if not session.linked_vote_session_id:
            raise MovieResolutionError(
                f"Session {session.id} has no linked vote session"
            )
        result = await db.execute(
            select(VoteSession).where(VoteSession.id == session.linked_vote_session_id)
        )
        vote_session = result.scalar_one_or_none()

    if not vote_session:
        raise MovieResolutionError(
            f"Vote session {session.linked_vote_session_id} not found"
        )

    # Check if vote session has a winner
    if vote_session.winning_movie_index is None:
        raise MovieResolutionError(
            f"Vote session {vote_session.id} has no winner yet"
        )

    # Get winning movie info
    if not vote_session.movie_options:
        raise MovieResolutionError(
            f"Vote session {vote_session.id} has no movie options"
        )

    winner_index = vote_session.winning_movie_index
    if winner_index >= len(vote_session.movie_options):
        raise MovieResolutionError(
            f"Winner index {winner_index} out of range"
        )

    winning_movie = vote_session.movie_options[winner_index]

    # Update session with movie info
    session.movie_title = winning_movie.get("title")
    session.movie_poster_url = winning_movie.get("poster_url")
    session.movie_source_id = winning_movie.get("source_id") or winning_movie.get("movie_id")
    session.movie_source = winning_movie.get("source", "vote")
    session.movie_id = winning_movie.get("movie_id")

    # Ensure movie is synced to local DB (needed for enrichment)
    if session.movie_source and session.movie_source_id:
        synced_id = await _ensure_movie_in_db(
            db, session.movie_id, session.movie_source,
            session.movie_source_id, session.movie_poster_url,
        )
        if synced_id:
            session.movie_id = synced_id

    session.movie_resolved = True
    session.movie_resolved_at = datetime.now(timezone.utc)

    # Apply enrichment options if configured on the session
    if session.enrichment_options and session.movie_id:
        await _apply_enrichment(db, session, session.movie_id)
    elif session.movie_poster_url:
        # Fallback: extract palette even without enrichment options
        try:
            palette = await extract_palette_from_url(session.movie_poster_url)
            session.color_palette = palette
            logger.info(f"Extracted color palette for session {session.id}")
        except PaletteExtractionError as e:
            logger.warning(f"Failed to extract palette: {e}")

    await db.commit()
    await db.refresh(session)

    logger.info(
        f"Resolved vote winner for session {session.id}: {session.movie_title}"
    )

    return session


async def resolve_mystery_movie(
    db: AsyncSession,
    session: Session,
) -> Session:
    """Resolve a mystery movie for a cinema session.

    Selects a movie based on the mystery config (random, filtered, or curated).
    Also extracts color palette from the movie's poster.

    Args:
        db: Database session.
        session: Cinema session to update.

    Returns:
        Updated Session with movie info populated.

    Raises:
        MovieResolutionError: If resolution fails.
    """
    if session.movie_selection_mode != MovieSelectionMode.MYSTERY.value:
        raise MovieResolutionError(
            f"Session {session.id} is not in MYSTERY mode"
        )

    if session.movie_resolved:
        logger.info(f"Session {session.id} already has a resolved movie")
        return session

    mystery_config = session.mystery_config or {}
    source = mystery_config.get("source", "random")

    selected_movie = None

    if source == "curated":
        # Select from curated list
        curated_movies = mystery_config.get("curated_movies", [])
        if not curated_movies:
            raise MovieResolutionError(
                f"Session {session.id} has empty curated movie list"
            )
        selected_movie = random.choice(curated_movies)

    elif source == "filtered":
        # Select from filtered movies
        filters = mystery_config.get("filters", {})
        selected_movie = await _get_filtered_random_movie(db, filters)

    else:  # random
        # Select random movie from library
        selected_movie = await _get_random_movie(db)

    if not selected_movie:
        raise MovieResolutionError(
            f"No movie available for session {session.id}"
        )

    # Update session with movie info
    session.movie_title = selected_movie.get("title")
    session.movie_poster_url = selected_movie.get("poster_url")
    session.movie_source_id = selected_movie.get("source_id") or selected_movie.get("movie_id")
    session.movie_source = selected_movie.get("source", "mystery")
    session.movie_id = selected_movie.get("movie_id")

    # Ensure movie is synced to local DB (needed for enrichment)
    if session.movie_source and session.movie_source_id:
        synced_id = await _ensure_movie_in_db(
            db, session.movie_id, session.movie_source,
            session.movie_source_id, session.movie_poster_url,
        )
        if synced_id:
            session.movie_id = synced_id

    session.movie_resolved = True
    session.movie_resolved_at = datetime.now(timezone.utc)

    # Apply enrichment options if configured on the session
    if session.enrichment_options and session.movie_id:
        await _apply_enrichment(db, session, session.movie_id)

    # Always extract palette if we have a poster (even without enrichment options)
    if not session.color_palette and session.movie_poster_url:
        try:
            palette = await extract_palette_from_url(session.movie_poster_url)
            session.color_palette = palette
            logger.info(f"Extracted color palette for session {session.id}")
        except PaletteExtractionError as e:
            logger.warning(f"Failed to extract palette: {e}")

    await db.commit()
    await db.refresh(session)

    logger.info(
        f"Resolved mystery movie for session {session.id}: {session.movie_title}"
    )

    return session


async def _get_movies_from_service(db: AsyncSession) -> tuple[list[dict], str, str, str]:
    """Fetch all movies from the first enabled media source service (Plex/Jellyfin).

    Respects selected_libraries from service config.

    Returns:
        Tuple of (movies_list, adapter_type).

    Raises:
        MovieResolutionError: If no media service is available.
    """
    from theatarr.adapters.base import Command
    from theatarr.adapters.registry import get_adapter
    from theatarr.models.service import Service, ServiceCategory

    result = await db.execute(
        select(Service)
        .where(Service.category == ServiceCategory.MEDIA_SOURCE)
        .where(Service.is_enabled == True)
    )
    service = result.scalars().first()

    if not service:
        raise MovieResolutionError("No enabled media source service found")

    adapter = get_adapter(service.adapter_type, service.config)

    # List libraries and filter by user selection
    libs_result = await adapter.execute(
        Command(action="list_libraries", parameters={})
    )
    if not libs_result.success or not libs_result.data:
        raise MovieResolutionError("Failed to list libraries from media service")

    libraries = libs_result.data.get("libraries", [])
    selected_ids = service.config.get("selected_libraries") or None

    # Use selected libraries, or fall back to all movie-type libraries
    # Plex uses "movie", Jellyfin uses "movies"
    if selected_ids:
        movie_libraries = [lib for lib in libraries if str(lib.get("id")) in selected_ids]
    else:
        movie_libraries = [lib for lib in libraries if lib.get("type") in ("movie", "movies")]

    if not movie_libraries:
        raise MovieResolutionError("No movie library found in media service")

    # Fetch movies from all selected libraries
    all_movies: list[dict] = []
    for lib in movie_libraries:
        movies_result = await adapter.execute(
            Command(
                action="list_movies",
                parameters={"library_id": lib.get("id")},
            )
        )
        if movies_result.success and movies_result.data:
            all_movies.extend(movies_result.data.get("movies", []))

    return all_movies, service.adapter_type


def _build_movie_dict(
    movie: dict, adapter_type: str,
) -> dict:
    """Build a standard movie info dict from a raw service movie entry."""
    return {
        "title": movie.get("title"),
        "poster_url": movie.get("poster_url"),
        "movie_id": str(movie.get("id", "")),
        "source": adapter_type,
        "source_id": str(movie.get("id", "")),
        "year": movie.get("year"),
    }


async def _get_random_movie(db: AsyncSession) -> dict | None:
    """Get a random movie from the media service (Plex/Jellyfin).

    Fetches the full movie list from the connected media service,
    same pattern as vote and fixed modes.

    Args:
        db: Database session.

    Returns:
        Movie info dict or None if no movies available.
    """
    try:
        movies, adapter_type = await _get_movies_from_service(db)
    except MovieResolutionError:
        logger.warning("No media service available for random movie selection")
        return None

    if not movies:
        return None

    movie = random.choice(movies)
    return _build_movie_dict(movie, adapter_type)


async def _get_filtered_random_movie(
    db: AsyncSession,
    filters: dict,
) -> dict | None:
    """Get a random movie from the media service matching filters.

    Fetches movies from the connected media service (Plex/Jellyfin)
    and applies filters, same pattern as vote and fixed modes.

    Args:
        db: Database session.
        filters: Filter criteria (genres, year_min, year_max, rating_min).

    Returns:
        Movie info dict or None if no movies match.
    """
    try:
        movies, adapter_type = await _get_movies_from_service(db)
    except MovieResolutionError:
        logger.warning("No media service available for filtered movie selection")
        return None

    # Apply filters
    year_min = filters.get("year_min")
    year_max = filters.get("year_max")
    rating_min = filters.get("rating_min")
    genres = filters.get("genres", [])

    logger.info(
        f"Filtering {len(movies)} movies from service "
        f"(genres={genres}, year_min={year_min}, year_max={year_max}, rating_min={rating_min})"
    )

    filtered = movies
    if year_min:
        filtered = [m for m in filtered if m.get("year") and m["year"] >= year_min]
    if year_max:
        filtered = [m for m in filtered if m.get("year") and m["year"] <= year_max]
    if rating_min:
        filtered = [m for m in filtered if m.get("rating") and m["rating"] >= rating_min]
    if genres:
        # Log a sample of genres to help diagnose language mismatches
        sample_genres = set()
        for m in filtered[:20]:
            for g in (m.get("genres") or []):
                sample_genres.add(g)
        logger.info(f"Sample genres from service: {sorted(sample_genres)}")

        filtered = [
            m for m in filtered
            if m.get("genres") and any(
                g.lower() in [mg.lower() for mg in m["genres"]]
                for g in genres
            )
        ]

    logger.info(f"After filtering: {len(filtered)} movies match")

    if not filtered:
        logger.warning(f"No movies match filters: {filters}")
        return None

    movie = random.choice(filtered)
    return _build_movie_dict(movie, adapter_type)


def get_movie_display_status(session: Session) -> dict:
    """Get display status for a session's movie.

    Returns appropriate text and icon based on selection mode and resolved state.

    Args:
        session: Cinema session.

    Returns:
        Dict with 'text', 'icon', 'resolved' fields.
    """
    mode = session.movie_selection_mode

    if mode == MovieSelectionMode.FIXED.value:
        if session.movie_title:
            return {
                "text": session.movie_title,
                "icon": "film",
                "resolved": True,
            }
        return {
            "text": "No movie selected",
            "icon": "film",
            "resolved": False,
        }

    elif mode == MovieSelectionMode.VOTE.value:
        if session.movie_resolved and session.movie_title:
            return {
                "text": session.movie_title,
                "icon": "trophy",
                "resolved": True,
            }
        return {
            "text": "Awaiting vote results",
            "icon": "vote",
            "resolved": False,
        }

    elif mode == MovieSelectionMode.MYSTERY.value:
        if session.movie_resolved and session.movie_title:
            return {
                "text": session.movie_title,
                "icon": "sparkles",
                "resolved": True,
            }
        return {
            "text": "Mystery movie",
            "icon": "shuffle",
            "resolved": False,
        }

    return {
        "text": "Unknown mode",
        "icon": "help",
        "resolved": False,
    }
