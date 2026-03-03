"""Movies API router for Theatarr."""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from theatarr.database import get_db
from theatarr.api.deps import get_current_user
from theatarr.models import User, Movie, Service
from theatarr.models.service import ServiceCategory
from theatarr.schemas.base import PaginatedResponse
from theatarr.adapters.registry import get_adapter
from theatarr.adapters.base import Command
from theatarr.services.movie_enrichment import (
    enrich_from_tmdb,
    enrich_from_fanart,
    get_enrichment_status as _get_enrichment_status,
    EnrichmentError,
)

logger = logging.getLogger(__name__)


router = APIRouter(prefix="/movies", tags=["movies"])


_MOVIE_LIB_TYPES = {"movie", "movies"}  # Plex uses "movie", Jellyfin uses "movies"


def _get_selected_libraries(
    libraries: list[dict], selected_ids: list[str] | None
) -> list[dict]:
    """Filter libraries based on user selection, or fall back to all movie-type libraries."""
    if selected_ids:
        return [lib for lib in libraries if str(lib.get("id")) in selected_ids]
    return [lib for lib in libraries if lib.get("type") in _MOVIE_LIB_TYPES]


# ============================================================================
# Schemas
# ============================================================================


class MovieSchema(BaseModel):
    """Movie response schema."""

    id: str
    title: str
    year: int | None
    overview: str | None
    poster_url: str | None
    backdrop_url: str | None
    rating: float | None
    runtime_minutes: int | None
    genres: list[str] | None
    source: str  # plex, jellyfin, tmdb, local
    source_id: str | None
    has_trailer: bool
    enrichment_sources: list[str] | None = None


class MovieSearchResult(BaseModel):
    """Movie search result."""

    id: str
    title: str
    year: int | None
    poster_url: str | None
    backdrop_url: str | None = None
    overview: str | None = None
    rating: float | None = None
    runtime_minutes: int | None = None
    genres: list[str] | None = None
    directors: list[str] | None = None
    cast: list[str] | None = None
    tagline: str | None = None
    source: str
    source_id: str | None


class MovieListResponse(BaseModel):
    """Response for movie list."""

    movies: list[MovieSchema]
    total: int
    source: str


# ============================================================================
# Endpoints
# ============================================================================


@router.get("")
async def list_movies(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    source: Optional[str] = None,
    genre: Optional[str] = None,
    year: Optional[int] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaginatedResponse[MovieSchema]:
    """List movies from local database and connected services."""
    # Start with local movies
    query = select(Movie)

    if search:
        query = query.where(Movie.title.ilike(f"%{search}%"))
    if year:
        query = query.where(Movie.year == year)
    if genre:
        query = query.where(Movie.genres.contains([genre]))

    # Count total
    count_query = select(func.count()).select_from(Movie)
    if search:
        count_query = count_query.where(Movie.title.ilike(f"%{search}%"))
    if year:
        count_query = count_query.where(Movie.year == year)
    if genre:
        count_query = count_query.where(Movie.genres.contains([genre]))

    total = (await db.execute(count_query)).scalar() or 0

    # Get paginated results
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)
    result = await db.execute(query)
    movies = result.scalars().all()

    items = [
        MovieSchema(
            id=m.id,
            title=m.title,
            year=m.year,
            overview=m.overview,
            poster_url=m.poster_url,
            backdrop_url=m.backdrop_url,
            rating=m.rating,
            runtime_minutes=m.runtime_minutes,
            genres=m.genres,
            source="local",
            source_id=m.tmdb_id,
            has_trailer=False,
        )
        for m in movies
    ]

    return PaginatedResponse.create(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/search")
async def search_movies(
    query: str = Query(..., min_length=1),
    source: Optional[str] = None,
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[MovieSearchResult]:
    """Search movies across all connected services."""
    results: list[MovieSearchResult] = []

    # Search connected media services (Plex, Jellyfin, etc.)
    # Local DB movies are not shown — they are only used as enrichment cache
    services_result = await db.execute(
        select(Service)
        .where(Service.category == ServiceCategory.MEDIA_SOURCE)
        .where(Service.is_enabled == True)
    )
    services = services_result.scalars().all()

    for service in services:
        # Filter by source if provided (can be service_id OR adapter_type)
        if source and service.id != source and service.adapter_type != source:
            continue

        try:
            adapter = get_adapter(service.adapter_type, service.config)
            selected_libs = service.config.get("selected_libraries")

            # Search — pass library IDs so adapter can filter natively
            search_params: dict = {"query": query, "type": "movie"}
            if selected_libs:
                search_params["library_ids"] = selected_libs

            command = Command(action="search", parameters=search_params)
            result = await adapter.execute(command)

            if result.success and result.data:
                adapter_results = result.data.get("results", [])

                for item in adapter_results[:limit - len(results)]:
                    # Both adapters now return normalized fields
                    duration = item.get("duration")
                    runtime_minutes = duration // 60000 if duration else None
                    genres = item.get("genres", [])
                    directors = item.get("directors", [])
                    cast = item.get("cast", [])[:5]

                    results.append(MovieSearchResult(
                        id=str(item.get("id", "")),
                        title=item.get("title", ""),
                        year=item.get("year"),
                        poster_url=item.get("poster_url"),
                        backdrop_url=item.get("backdrop_url"),
                        overview=item.get("overview") or item.get("summary"),
                        rating=item.get("rating"),
                        runtime_minutes=runtime_minutes,
                        genres=genres if genres else None,
                        directors=directors if directors else None,
                        cast=cast if cast else None,
                        tagline=item.get("tagline"),
                        source=service.adapter_type,
                        source_id=str(item.get("id", "")),
                    ))
        except Exception:
            # Skip failed services
            pass

    return results[:limit]


@router.get("/from-service/{service_id}")
async def get_movies_from_service(
    service_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MovieListResponse:
    """Get movies from a specific media service (Plex, Jellyfin)."""
    result = await db.execute(select(Service).where(Service.id == service_id))
    service = result.scalar_one_or_none()

    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    if service.category != ServiceCategory.MEDIA_SOURCE:
        raise HTTPException(status_code=400, detail="Service is not a media service")

    if not service.is_enabled:
        raise HTTPException(status_code=400, detail="Service is disabled")

    try:
        adapter = get_adapter(service.adapter_type, service.config)

        # List libraries and filter by user selection
        list_libs_cmd = Command(action="list_libraries", parameters={})
        libs_result = await adapter.execute(list_libs_cmd)

        if not libs_result.success or not libs_result.data:
            return MovieListResponse(movies=[], total=0, source=service.adapter_type)

        libraries = libs_result.data.get("libraries", [])
        selected_ids = service.config.get("selected_libraries") or None
        movie_libraries = _get_selected_libraries(libraries, selected_ids)

        if not movie_libraries:
            return MovieListResponse(movies=[], total=0, source=service.adapter_type)

        # Fetch movies from all selected libraries
        all_movies_raw: list[dict] = []

        for lib in movie_libraries:
            list_movies_cmd = Command(
                action="list_movies",
                parameters={"library_id": lib.get("id")}
            )
            movies_result = await adapter.execute(list_movies_cmd)
            if movies_result.success and movies_result.data:
                all_movies_raw.extend(movies_result.data.get("movies", []))

        # Manual pagination
        total = len(all_movies_raw)
        offset = (page - 1) * page_size
        paginated = all_movies_raw[offset:offset + page_size]

        movies = []
        for m in paginated:
            movies.append(MovieSchema(
                id=str(m.get("id", "")),
                title=m.get("title", ""),
                year=m.get("year"),
                overview=m.get("overview"),
                poster_url=m.get("poster_url"),
                backdrop_url=m.get("backdrop_url"),
                rating=m.get("rating"),
                runtime_minutes=m.get("duration") // 60000 if m.get("duration") else None,
                genres=m.get("genres", []),
                source=service.adapter_type,
                source_id=str(m.get("id", "")),
                has_trailer=False,
            ))

        return MovieListResponse(
            movies=movies,
            total=total,
            source=service.adapter_type,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch movies: {str(e)}")


@router.get("/details/{source}/{source_id}")
async def get_movie_details_from_source(
    source: str,
    source_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MovieSearchResult:
    """Get detailed movie info from an external source (plex, jellyfin)."""
    # Find the service for this source
    services_result = await db.execute(
        select(Service)
        .where(Service.adapter_type == source)
        .where(Service.category == ServiceCategory.MEDIA_SOURCE)
        .where(Service.is_enabled == True)
    )
    service = services_result.scalar_one_or_none()

    if not service:
        raise HTTPException(status_code=404, detail=f"No {source} service configured")

    try:
        adapter = get_adapter(service.adapter_type, service.config)
        command = Command(action="get_movie", parameters={"movie_id": source_id})
        result = await adapter.execute(command)

        if not result.success or not result.data:
            raise HTTPException(status_code=404, detail="Movie not found")

        movie_data = result.data
        duration = movie_data.get("duration")
        return MovieSearchResult(
            id=str(movie_data.get("id", source_id)),
            title=movie_data.get("title", ""),
            year=movie_data.get("year"),
            poster_url=movie_data.get("poster_url"),
            backdrop_url=movie_data.get("backdrop_url"),
            overview=movie_data.get("overview"),
            rating=movie_data.get("rating"),
            runtime_minutes=duration // 60000 if duration else None,
            genres=movie_data.get("genres"),
            directors=movie_data.get("directors"),
            cast=movie_data.get("cast", movie_data.get("actors", []))[:5] or None,
            tagline=movie_data.get("tagline"),
            source=source,
            source_id=source_id,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch movie details: {str(e)}")


class EnrichmentStatusResponse(BaseModel):
    """Response for enrichment service status."""
    tmdb: dict
    fanart: dict


class EnrichmentResultResponse(BaseModel):
    """Response for enrichment result."""
    success: bool
    movie_id: str
    sources_enriched: list[str]
    enrichment_sources: list[str]
    message: str | None = None


@router.get("/enrichment-status")
async def enrichment_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EnrichmentStatusResponse:
    """Check which metadata enrichment services are available."""
    status = await _get_enrichment_status(db)
    return EnrichmentStatusResponse(**status)


@router.post("/{movie_id}/enrich")
async def enrich_movie(
    movie_id: str,
    sources: str = Query("tmdb,fanart", description="Comma-separated list of sources: tmdb,fanart"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EnrichmentResultResponse:
    """Enrich a movie with metadata from TMDB and/or Fanart.tv."""
    result = await db.execute(select(Movie).where(Movie.id == movie_id))
    movie = result.scalar_one_or_none()
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")

    source_list = [s.strip() for s in sources.split(",") if s.strip()]
    enriched: list[str] = []
    errors: list[str] = []

    for source in source_list:
        try:
            if source == "tmdb":
                await enrich_from_tmdb(db, movie_id)
                enriched.append("tmdb")
            elif source == "fanart":
                await enrich_from_fanart(db, movie_id)
                enriched.append("fanart")
            else:
                errors.append(f"Unknown source: {source}")
        except EnrichmentError as e:
            logger.warning(f"Enrichment error ({source}): {e}")
            errors.append(f"{source}: {str(e)}")

    await db.refresh(movie)

    message = None
    if errors:
        message = "; ".join(errors)

    return EnrichmentResultResponse(
        success=len(enriched) > 0,
        movie_id=movie_id,
        sources_enriched=enriched,
        enrichment_sources=movie.enrichment_sources or [],
        message=message,
    )


@router.get("/{movie_id}")
async def get_movie(
    movie_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MovieSchema:
    """Get a specific movie by ID."""
    result = await db.execute(select(Movie).where(Movie.id == movie_id))
    movie = result.scalar_one_or_none()

    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")

    return MovieSchema(
        id=movie.id,
        title=movie.title,
        year=movie.year,
        overview=movie.overview,
        poster_url=movie.poster_url,
        backdrop_url=movie.backdrop_url,
        rating=movie.rating,
        runtime_minutes=movie.runtime_minutes,
        genres=movie.genres,
        source="local",
        source_id=movie.tmdb_id,
        has_trailer=False,
        enrichment_sources=movie.enrichment_sources or [],
    )


@router.post("/sync/{service_id}")
async def sync_movies_from_service(
    service_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, int]:
    """Sync movies from a media service to local database."""
    result = await db.execute(select(Service).where(Service.id == service_id))
    service = result.scalar_one_or_none()

    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    if service.category != ServiceCategory.MEDIA_SOURCE:
        raise HTTPException(status_code=400, detail="Service is not a media service")

    try:
        adapter = get_adapter(service.adapter_type, service.config)

        # List libraries and filter by user selection
        list_libs_cmd = Command(action="list_libraries", parameters={})
        libs_result = await adapter.execute(list_libs_cmd)

        if not libs_result.success or not libs_result.data:
            return {"synced": 0, "errors": 0}

        libraries = libs_result.data.get("libraries", [])
        selected_ids = service.config.get("selected_libraries") or None
        movie_libraries = _get_selected_libraries(libraries, selected_ids)

        if not movie_libraries:
            return {"synced": 0, "errors": 0}

        # Fetch movies from all selected libraries
        all_movies_raw: list[dict] = []
        for lib in movie_libraries:
            list_movies_cmd = Command(
                action="list_movies",
                parameters={"library_id": lib.get("id")}
            )
            movies_result = await adapter.execute(list_movies_cmd)
            if movies_result.success and movies_result.data:
                all_movies_raw.extend(movies_result.data.get("movies", []))

        synced = 0
        errors = 0

        for movie_data in all_movies_raw:
            try:
                title = movie_data.get("title")
                year = movie_data.get("year")

                # Check if movie exists
                existing = await db.execute(
                    select(Movie).where(
                        (Movie.title == title) &
                        (Movie.year == year)
                    )
                )
                movie = existing.scalar_one_or_none()

                # Both adapters now return normalized poster_url/backdrop_url
                m_poster = movie_data.get("poster_url")
                m_backdrop = movie_data.get("backdrop_url")
                runtime = movie_data.get("duration") // 60000 if movie_data.get("duration") else None

                if movie:
                    # Update existing
                    movie.overview = movie_data.get("overview") or movie.overview
                    movie.poster_url = m_poster or movie.poster_url
                    movie.backdrop_url = m_backdrop or movie.backdrop_url
                    movie.rating = movie_data.get("rating") or movie.rating
                    movie.runtime_minutes = runtime or movie.runtime_minutes
                else:
                    # Create new
                    movie = Movie(
                        title=title or "Unknown",
                        year=year,
                        overview=movie_data.get("overview"),
                        poster_url=m_poster,
                        backdrop_url=m_backdrop,
                        rating=movie_data.get("rating"),
                        runtime_minutes=runtime,
                        genres=movie_data.get("genres", []),
                    )
                    db.add(movie)

                synced += 1
            except Exception:
                errors += 1

        await db.commit()
        return {"synced": synced, "errors": errors}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")


@router.get("/genres/list")
async def list_genres(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[str]:
    """Get all genres from the connected media service (Plex/Jellyfin).

    Falls back to local database genres if no media service is available.
    """
    # Try to get genres from the media service first
    services_result = await db.execute(
        select(Service)
        .where(Service.category == ServiceCategory.MEDIA_SOURCE)
        .where(Service.is_enabled == True)
    )
    service = services_result.scalars().first()

    if service:
        try:
            adapter = get_adapter(service.adapter_type, service.config)

            # Find selected or movie libraries
            libs_result = await adapter.execute(
                Command(action="list_libraries", parameters={})
            )
            if libs_result.success and libs_result.data:
                libraries = libs_result.data.get("libraries", [])
                selected_ids = service.config.get("selected_libraries") or None
                movie_libraries = _get_selected_libraries(libraries, selected_ids)

                all_genres: set[str] = set()
                for lib in movie_libraries:
                    genres_result = await adapter.execute(
                        Command(
                            action="list_genres",
                            parameters={"library_id": lib.get("id")},
                        )
                    )
                    if genres_result.success and genres_result.data:
                        all_genres.update(genres_result.data.get("genres", []))
                if all_genres:
                    return sorted(all_genres)
        except Exception:
            logger.warning("Failed to fetch genres from media service, falling back to local DB")

    # Fallback: local database genres
    result = await db.execute(select(Movie.genres).distinct())
    all_genres = result.scalars().all()

    genres = set()
    for genre_list in all_genres:
        if genre_list:
            genres.update(genre_list)

    return sorted(genres)
