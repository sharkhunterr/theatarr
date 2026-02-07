"""Movies API router for Theatarr."""

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


router = APIRouter(prefix="/movies", tags=["movies"])


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
            has_trailer=bool(m.trailer_url),
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

    # Search local database first
    local_query = select(Movie).where(Movie.title.ilike(f"%{query}%")).limit(limit)
    local_result = await db.execute(local_query)
    local_movies = local_result.scalars().all()

    for m in local_movies:
        results.append(MovieSearchResult(
            id=m.id,
            title=m.title,
            year=m.year,
            poster_url=m.poster_url,
            backdrop_url=m.backdrop_url,
            overview=m.overview,
            rating=m.rating,
            runtime_minutes=m.runtime_minutes,
            genres=m.genres,
            directors=m.directors,
            cast=m.cast[:5] if m.cast else None,
            tagline=m.tagline,
            source="local",
            source_id=m.tmdb_id,
        ))

    # Search connected media services if no specific source requested
    # source can be: service_id (UUID), adapter_type ("plex", "jellyfin"), or None
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
            # Use the execute method with a search command
            command = Command(action="search", parameters={"query": query, "type": "movie"})
            result = await adapter.execute(command)

            if result.success and result.data:
                adapter_results = result.data.get("results", [])
                server_url = service.config.get("server_url", "").rstrip("/")
                token = service.config.get("token", "")

                for item in adapter_results[:limit - len(results)]:
                    # Build full URLs for Plex
                    thumb = item.get("thumb")
                    art = item.get("art")
                    poster_url = None
                    backdrop_url = None
                    if thumb and server_url and token:
                        poster_url = f"{server_url}{thumb}?X-Plex-Token={token}"
                    if art and server_url and token:
                        backdrop_url = f"{server_url}{art}?X-Plex-Token={token}"

                    # Extract runtime in minutes
                    duration = item.get("duration")
                    runtime_minutes = duration // 60000 if duration else None

                    # Extract directors and cast
                    directors = [d.get("tag") for d in item.get("Director", []) if d.get("tag")]
                    cast = [r.get("tag") for r in item.get("Role", [])[:5] if r.get("tag")]
                    genres = [g.get("tag") for g in item.get("Genre", []) if g.get("tag")]

                    results.append(MovieSearchResult(
                        id=str(item.get("id", "")),
                        title=item.get("title", ""),
                        year=item.get("year"),
                        poster_url=poster_url,
                        backdrop_url=backdrop_url,
                        overview=item.get("summary"),
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

        # First list libraries to find a movie library
        list_libs_cmd = Command(action="list_libraries", parameters={})
        libs_result = await adapter.execute(list_libs_cmd)

        if not libs_result.success or not libs_result.data:
            return MovieListResponse(movies=[], total=0, source=service.adapter_type)

        libraries = libs_result.data.get("libraries", [])
        movie_library = next((lib for lib in libraries if lib.get("type") == "movie"), None)

        if not movie_library:
            return MovieListResponse(movies=[], total=0, source=service.adapter_type)

        # List movies from the library
        list_movies_cmd = Command(
            action="list_movies",
            parameters={"library_id": movie_library.get("id")}
        )
        movies_result = await adapter.execute(list_movies_cmd)

        if not movies_result.success or not movies_result.data:
            return MovieListResponse(movies=[], total=0, source=service.adapter_type)

        server_url = service.config.get("server_url", "").rstrip("/")
        token = service.config.get("token", "")

        movies_raw = movies_result.data.get("movies", [])
        # Manual pagination
        total = len(movies_raw)
        offset = (page - 1) * page_size
        paginated = movies_raw[offset:offset + page_size]

        movies = []
        for m in paginated:
            thumb = m.get("thumb")
            art = m.get("art")
            poster_url = f"{server_url}{thumb}?X-Plex-Token={token}" if thumb else None
            backdrop_url = f"{server_url}{art}?X-Plex-Token={token}" if art else None

            movies.append(MovieSchema(
                id=str(m.get("id", "")),
                title=m.get("title", ""),
                year=m.get("year"),
                overview=m.get("summary"),
                poster_url=poster_url,
                backdrop_url=backdrop_url,
                rating=m.get("rating"),
                runtime_minutes=m.get("duration") // 60000 if m.get("duration") else None,
                genres=[],  # Not in list response
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
        return MovieSearchResult(
            id=str(movie_data.get("id", source_id)),
            title=movie_data.get("title", ""),
            year=movie_data.get("year"),
            poster_url=movie_data.get("thumb"),
            backdrop_url=movie_data.get("art"),
            overview=movie_data.get("summary"),
            rating=movie_data.get("rating"),
            runtime_minutes=movie_data.get("duration") // 60000 if movie_data.get("duration") else None,
            genres=movie_data.get("genres"),
            directors=movie_data.get("directors"),
            cast=movie_data.get("actors", [])[:5] if movie_data.get("actors") else None,
            tagline=None,
            source=source,
            source_id=source_id,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch movie details: {str(e)}")


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
        has_trailer=bool(movie.trailer_url),
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

        # First list libraries to find a movie library
        list_libs_cmd = Command(action="list_libraries", parameters={})
        libs_result = await adapter.execute(list_libs_cmd)

        if not libs_result.success or not libs_result.data:
            return {"synced": 0, "errors": 0}

        libraries = libs_result.data.get("libraries", [])
        movie_library = next((lib for lib in libraries if lib.get("type") == "movie"), None)

        if not movie_library:
            return {"synced": 0, "errors": 0}

        # List movies from the library
        list_movies_cmd = Command(
            action="list_movies",
            parameters={"library_id": movie_library.get("id")}
        )
        movies_result = await adapter.execute(list_movies_cmd)

        if not movies_result.success or not movies_result.data:
            return {"synced": 0, "errors": 0}

        synced = 0
        errors = 0

        server_url = service.config.get("server_url", "").rstrip("/")
        token = service.config.get("token", "")

        for movie_data in movies_result.data.get("movies", []):
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

                thumb = movie_data.get("thumb")
                art = movie_data.get("art")
                poster_url = f"{server_url}{thumb}?X-Plex-Token={token}" if thumb else None
                backdrop_url = f"{server_url}{art}?X-Plex-Token={token}" if art else None
                runtime = movie_data.get("duration") // 60000 if movie_data.get("duration") else None

                if movie:
                    # Update existing
                    movie.overview = movie_data.get("summary") or movie.overview
                    movie.poster_url = poster_url or movie.poster_url
                    movie.backdrop_url = backdrop_url or movie.backdrop_url
                    movie.rating = movie_data.get("rating") or movie.rating
                    movie.runtime_minutes = runtime or movie.runtime_minutes
                else:
                    # Create new
                    movie = Movie(
                        title=title or "Unknown",
                        year=year,
                        overview=movie_data.get("summary"),
                        poster_url=poster_url,
                        backdrop_url=backdrop_url,
                        rating=movie_data.get("rating"),
                        runtime_minutes=runtime,
                        genres=[],
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
    """Get list of all genres in the database."""
    result = await db.execute(select(Movie.genres).distinct())
    all_genres = result.scalars().all()

    # Flatten and deduplicate
    genres = set()
    for genre_list in all_genres:
        if genre_list:
            genres.update(genre_list)

    return sorted(genres)
