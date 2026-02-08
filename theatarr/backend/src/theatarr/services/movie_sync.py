"""Service for syncing movie metadata from external sources."""

import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from theatarr.adapters.registry import get_adapter, discover_adapters
from theatarr.adapters.base import Command

# Ensure adapters are discovered
discover_adapters()
from theatarr.models.movie import Movie
from theatarr.models.palette import ColorPalette
from theatarr.models.service import Service, ServiceCategory
from theatarr.services.palette import extract_palette_from_url

logger = logging.getLogger(__name__)


class MovieSyncError(Exception):
    """Error during movie sync."""
    pass


async def sync_movie_from_source(
    db: AsyncSession,
    source: str,
    source_id: str,
    poster_url: str | None = None,
) -> Movie:
    """
    Sync a movie from an external source (Plex, Jellyfin, etc.).

    Fetches full metadata from the source and creates or updates the movie
    in the local database.

    Args:
        db: Database session
        source: Source adapter type (e.g., "plex", "jellyfin")
        source_id: Movie ID on the source (e.g., Plex ratingKey)
        poster_url: Optional poster URL (used if source doesn't provide one)

    Returns:
        The created or updated Movie object

    Raises:
        MovieSyncError: If sync fails
    """
    # Check if movie already exists
    existing_query = select(Movie).where(
        Movie.source == source,
        Movie.plex_key == source_id if source == "plex" else Movie.jellyfin_id == source_id
    )
    result = await db.execute(existing_query)
    existing_movie = result.scalar_one_or_none()

    if existing_movie:
        logger.info(f"Movie already exists: {existing_movie.title} (ID: {existing_movie.id})")
        return existing_movie

    # Find the service for this source type
    service_query = select(Service).where(
        Service.adapter_type == source,
        Service.category == ServiceCategory.MEDIA_SOURCE,
        Service.is_enabled == True,
    )
    result = await db.execute(service_query)
    service = result.scalar_one_or_none()

    if not service:
        raise MovieSyncError(f"No enabled service found for source: {source}")

    # Get adapter and fetch movie details
    try:
        adapter = get_adapter(service.adapter_type, service.config)
        await adapter.connect()

        command = Command(action="get_movie", parameters={"movie_id": source_id})
        result = await adapter.execute(command)

        if not result.success or not result.data:
            raise MovieSyncError(f"Failed to fetch movie details: {result.message}")

        movie_data = result.data

    except Exception as e:
        logger.error(f"Error fetching movie from {source}: {e}")
        raise MovieSyncError(f"Failed to fetch movie from {source}: {str(e)}")

    # Convert duration from milliseconds to minutes
    duration_ms = movie_data.get("duration")
    runtime_minutes = int(duration_ms / 60000) if duration_ms else None

    # Get poster and backdrop URLs
    thumb_url = movie_data.get("thumb") or poster_url
    art_url = movie_data.get("art")

    # Fetch alternative images from Plex
    extra_posters = []
    extra_backdrops = []
    if source == "plex":
        try:
            images_command = Command(action="get_movie_images", parameters={"movie_id": source_id})
            images_result = await adapter.execute(images_command)
            if images_result.success and images_result.data:
                extra_posters = images_result.data.get("extra_posters", [])
                extra_backdrops = images_result.data.get("extra_backdrops", [])
        except Exception as e:
            logger.warning(f"Failed to fetch alternative images from Plex: {e}")

    # Create movie object
    movie = Movie(
        title=movie_data.get("title", "Unknown"),
        original_title=movie_data.get("title"),
        year=movie_data.get("year"),
        runtime_minutes=runtime_minutes,
        overview=movie_data.get("summary"),
        tagline=movie_data.get("tagline"),
        poster_url=thumb_url,
        backdrop_url=art_url or thumb_url,
        extra_backdrops=extra_backdrops,
        extra_posters=extra_posters,
        rating=movie_data.get("rating"),
        genres=movie_data.get("genres", []),
        directors=movie_data.get("directors", []),
        cast=movie_data.get("actors", []),
        source=source,
        plex_key=source_id if source == "plex" else None,
        jellyfin_id=source_id if source == "jellyfin" else None,
    )

    db.add(movie)
    await db.flush()  # Get the movie.id

    logger.info(f"Created movie: {movie.title} (ID: {movie.id})")

    # Extract color palette from poster
    if thumb_url:
        try:
            palette_data = await extract_palette_from_url(thumb_url)

            palette = ColorPalette(
                movie_id=movie.id,
                source_url=thumb_url,
                source_type="poster",
                primary=palette_data.get("primary"),
                secondary=palette_data.get("secondary"),
                accent=palette_data.get("accent"),
                background=palette_data.get("background"),
                text=palette_data.get("text"),
                vibrant=palette_data.get("vibrant"),
                vibrant_light=palette_data.get("vibrant_light"),
                vibrant_dark=palette_data.get("vibrant_dark"),
                muted=palette_data.get("muted"),
                muted_light=palette_data.get("muted_light"),
                muted_dark=palette_data.get("muted_dark"),
                raw_palette=palette_data.get("raw_palette"),
            )
            db.add(palette)
            logger.info(f"Created color palette for movie: {movie.title}")

        except Exception as e:
            logger.warning(f"Failed to extract palette for {movie.title}: {e}")

    await db.commit()
    await db.refresh(movie)

    return movie


async def ensure_movie_synced(
    db: AsyncSession,
    movie_source: str | None,
    movie_source_id: str | None,
    movie_poster_url: str | None = None,
) -> str | None:
    """
    Ensure a movie is synced from source and return its ID.

    If movie_source and movie_source_id are provided, syncs the movie
    and returns the movie ID. Returns None if no source info provided.

    Args:
        db: Database session
        movie_source: Source type (e.g., "plex")
        movie_source_id: Movie ID on the source
        movie_poster_url: Optional poster URL

    Returns:
        Movie ID if synced, None otherwise
    """
    if not movie_source or not movie_source_id:
        return None

    try:
        movie = await sync_movie_from_source(
            db=db,
            source=movie_source,
            source_id=movie_source_id,
            poster_url=movie_poster_url,
        )
        return movie.id
    except MovieSyncError as e:
        logger.warning(f"Failed to sync movie: {e}")
        return None
