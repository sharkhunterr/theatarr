"""Service for enriching movie metadata from TMDB and Fanart.tv."""

import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from theatarr.adapters.base import Command
from theatarr.adapters.registry import AdapterRegistry, get_adapter
from theatarr.models.movie import Movie
from theatarr.models.service import Service, ServiceCategory

logger = logging.getLogger(__name__)


class EnrichmentError(Exception):
    """Error during movie enrichment."""
    pass


def _find_metadata_service(services: list[Service], adapter_type: str) -> Service | None:
    """Find an enabled metadata service by adapter type."""
    for service in services:
        if (
            service.adapter_type == adapter_type
            and service.category == ServiceCategory.METADATA
            and service.is_enabled
        ):
            return service
    return None


async def get_enrichment_status(db: AsyncSession) -> dict[str, Any]:
    """Check which metadata services are configured and available.

    Returns:
        Dict with tmdb and fanart availability info.
    """
    result = await db.execute(
        select(Service).where(Service.category == ServiceCategory.METADATA)
    )
    services = result.scalars().all()

    status: dict[str, Any] = {
        "tmdb": {"available": False, "service_id": None},
        "fanart": {"available": False, "service_id": None},
    }

    for service in services:
        if service.adapter_type == "tmdb" and service.is_enabled:
            status["tmdb"] = {"available": True, "service_id": service.id}
        elif service.adapter_type == "fanart" and service.is_enabled:
            status["fanart"] = {"available": True, "service_id": service.id}

    return status


async def resolve_tmdb_id(db: AsyncSession, movie: Movie) -> str | None:
    """Resolve TMDB ID for a movie.

    If the movie already has a tmdb_id, returns it.
    Otherwise, searches TMDB by title + year to find a match.

    Returns:
        TMDB ID string, or None if not found.
    """
    if movie.tmdb_id:
        return movie.tmdb_id

    # Find TMDB service
    result = await db.execute(
        select(Service).where(
            Service.adapter_type == "tmdb",
            Service.category == ServiceCategory.METADATA,
            Service.is_enabled == True,
        )
    )
    service = result.scalar_one_or_none()
    if not service:
        return None

    try:
        adapter = get_adapter("tmdb", service.config)
        await adapter.connect()

        command = Command(
            action="search_movies",
            parameters={"query": movie.title, "year": movie.year},
        )
        search_result = await adapter.execute(command)

        if not search_result.success or not search_result.data:
            return None

        results = search_result.data.get("results", [])
        if not results:
            return None

        # Take the first result
        tmdb_id = results[0].get("tmdb_id")

        # Update movie with TMDB ID
        if tmdb_id:
            movie.tmdb_id = tmdb_id
            await db.flush()
            logger.info(f"Resolved TMDB ID {tmdb_id} for movie: {movie.title}")

        return tmdb_id

    except Exception as e:
        logger.warning(f"Failed to resolve TMDB ID for {movie.title}: {e}")
        return None


async def enrich_from_tmdb(db: AsyncSession, movie_id: str) -> Movie:
    """Enrich a movie with TMDB metadata.

    Fetches detailed metadata from TMDB and merges it additively
    (doesn't overwrite existing non-null data).

    Returns:
        Updated Movie object.

    Raises:
        EnrichmentError: If enrichment fails.
    """
    result = await db.execute(select(Movie).where(Movie.id == movie_id))
    movie = result.scalar_one_or_none()
    if not movie:
        raise EnrichmentError(f"Movie not found: {movie_id}")

    # Resolve TMDB ID
    tmdb_id = await resolve_tmdb_id(db, movie)
    if not tmdb_id:
        raise EnrichmentError(f"Could not resolve TMDB ID for: {movie.title}")

    # Find TMDB service
    svc_result = await db.execute(
        select(Service).where(
            Service.adapter_type == "tmdb",
            Service.category == ServiceCategory.METADATA,
            Service.is_enabled == True,
        )
    )
    service = svc_result.scalar_one_or_none()
    if not service:
        raise EnrichmentError("TMDB service not configured")

    try:
        adapter = get_adapter("tmdb", service.config)
        await adapter.connect()

        command = Command(action="get_movie", parameters={"movie_id": tmdb_id})
        result = await adapter.execute(command)

        if not result.success or not result.data:
            raise EnrichmentError(f"Failed to fetch TMDB data: {result.message}")

        data = result.data

    except EnrichmentError:
        raise
    except Exception as e:
        raise EnrichmentError(f"TMDB enrichment failed: {str(e)}")

    # Merge data additively
    if not movie.imdb_id and data.get("imdb_id"):
        movie.imdb_id = data["imdb_id"]
    if not movie.tagline and data.get("tagline"):
        movie.tagline = data["tagline"]
    if not movie.overview and data.get("overview"):
        movie.overview = data["overview"]
    if not movie.rating and data.get("rating"):
        movie.rating = data["rating"]
    if not movie.runtime_minutes and data.get("runtime_minutes"):
        movie.runtime_minutes = data["runtime_minutes"]
    if not movie.original_title and data.get("original_title"):
        movie.original_title = data["original_title"]

    # Merge lists (additive, deduplicate)
    existing_backdrops = set(movie.extra_backdrops or [])
    new_backdrops = [url for url in (data.get("extra_backdrops") or []) if url not in existing_backdrops]
    if new_backdrops:
        movie.extra_backdrops = list(existing_backdrops) + new_backdrops

    existing_posters = set(movie.extra_posters or [])
    new_posters = [url for url in (data.get("extra_posters") or []) if url not in existing_posters]
    if new_posters:
        movie.extra_posters = list(existing_posters) + new_posters

    existing_logos = set(movie.logos or [])
    new_logos = [url for url in (data.get("logos") or []) if url not in existing_logos]
    if new_logos:
        movie.logos = list(existing_logos) + new_logos

    # Merge metadata lists
    if not movie.genres and data.get("genres"):
        movie.genres = data["genres"]
    if not movie.directors and data.get("directors"):
        movie.directors = data["directors"]
    if not movie.cast and data.get("cast"):
        movie.cast = data["cast"]
    if not movie.studios and data.get("studios"):
        movie.studios = data["studios"]
    if not movie.keywords and data.get("keywords"):
        movie.keywords = data["keywords"]
    if not movie.vote_count and data.get("vote_count"):
        movie.vote_count = data["vote_count"]

    # Track enrichment source
    sources = list(movie.enrichment_sources or [])
    if "tmdb" not in sources:
        sources.append("tmdb")
    movie.enrichment_sources = sources

    await db.commit()
    await db.refresh(movie)

    logger.info(f"Enriched movie from TMDB: {movie.title} (ID: {movie.id})")
    return movie


async def enrich_from_fanart(db: AsyncSession, movie_id: str) -> Movie:
    """Enrich a movie with Fanart.tv artwork.

    Fetches HD logos, backdrops, posters from Fanart.tv.

    Returns:
        Updated Movie object.

    Raises:
        EnrichmentError: If enrichment fails.
    """
    result = await db.execute(select(Movie).where(Movie.id == movie_id))
    movie = result.scalar_one_or_none()
    if not movie:
        raise EnrichmentError(f"Movie not found: {movie_id}")

    # We need a TMDB ID for Fanart.tv
    tmdb_id = await resolve_tmdb_id(db, movie)
    if not tmdb_id:
        raise EnrichmentError(
            f"Could not resolve TMDB ID for: {movie.title}. "
            "Fanart.tv requires a TMDB ID. Try enriching from TMDB first."
        )

    # Find Fanart service
    svc_result = await db.execute(
        select(Service).where(
            Service.adapter_type == "fanart",
            Service.category == ServiceCategory.METADATA,
            Service.is_enabled == True,
        )
    )
    service = svc_result.scalar_one_or_none()
    if not service:
        raise EnrichmentError("Fanart.tv service not configured")

    try:
        adapter = get_adapter("fanart", service.config)
        await adapter.connect()

        command = Command(action="get_movie_art", parameters={"tmdb_id": tmdb_id})
        result = await adapter.execute(command)

        if not result.success or not result.data:
            raise EnrichmentError(f"Failed to fetch Fanart.tv data: {result.message}")

        data = result.data

    except EnrichmentError:
        raise
    except Exception as e:
        raise EnrichmentError(f"Fanart.tv enrichment failed: {str(e)}")

    # Merge artwork additively
    existing_backdrops = set(movie.extra_backdrops or [])
    new_backdrops = [url for url in (data.get("backdrops") or []) if url not in existing_backdrops]
    if new_backdrops:
        movie.extra_backdrops = list(existing_backdrops) + new_backdrops

    existing_posters = set(movie.extra_posters or [])
    new_posters = [url for url in (data.get("posters") or []) if url not in existing_posters]
    if new_posters:
        movie.extra_posters = list(existing_posters) + new_posters

    # Logos from Fanart.tv are HD - prepend them (higher priority)
    fanart_logos = data.get("logos") or []
    existing_logos = list(movie.logos or [])
    existing_logo_set = set(existing_logos)
    new_logos = [url for url in fanart_logos if url not in existing_logo_set]
    if new_logos:
        movie.logos = new_logos + existing_logos

    # Track enrichment source
    sources = list(movie.enrichment_sources or [])
    if "fanart" not in sources:
        sources.append("fanart")
    movie.enrichment_sources = sources

    await db.commit()
    await db.refresh(movie)

    logger.info(f"Enriched movie from Fanart.tv: {movie.title} (ID: {movie.id})")
    return movie
