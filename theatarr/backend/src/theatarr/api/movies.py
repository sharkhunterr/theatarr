"""Movies API router for Theatarr."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from theatarr.database import get_db
from theatarr.api.deps import get_current_user
from theatarr.models import User, Movie, Service
from theatarr.schemas.base import PaginatedResponse
from theatarr.adapters.registry import get_adapter


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
            source="local",
            source_id=m.tmdb_id,
        ))

    # Search connected media services if no specific source requested
    if not source or source in ["plex", "jellyfin"]:
        services_result = await db.execute(
            select(Service)
            .where(Service.service_type == "media")
            .where(Service.is_enabled == True)
        )
        services = services_result.scalars().all()

        for service in services:
            if source and service.adapter_name != source:
                continue

            try:
                adapter = get_adapter(service.adapter_name)
                if adapter and hasattr(adapter, 'search'):
                    adapter_results = await adapter.search(query, service.config)
                    for item in adapter_results[:limit - len(results)]:
                        results.append(MovieSearchResult(
                            id=item.get("id", ""),
                            title=item.get("title", ""),
                            year=item.get("year"),
                            poster_url=item.get("poster_url"),
                            source=service.adapter_name,
                            source_id=item.get("id"),
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

    if service.service_type != "media":
        raise HTTPException(status_code=400, detail="Service is not a media service")

    if not service.is_enabled:
        raise HTTPException(status_code=400, detail="Service is disabled")

    try:
        adapter = get_adapter(service.adapter_name)
        if not adapter:
            raise HTTPException(status_code=400, detail="Adapter not found")

        # Try to get movies from adapter
        if hasattr(adapter, 'get_movies'):
            movies_data = await adapter.get_movies(
                service.config,
                offset=(page - 1) * page_size,
                limit=page_size,
            )

            movies = [
                MovieSchema(
                    id=m.get("id", ""),
                    title=m.get("title", ""),
                    year=m.get("year"),
                    overview=m.get("overview"),
                    poster_url=m.get("poster_url"),
                    backdrop_url=m.get("backdrop_url"),
                    rating=m.get("rating"),
                    runtime_minutes=m.get("runtime_minutes"),
                    genres=m.get("genres", []),
                    source=service.adapter_name,
                    source_id=m.get("id"),
                    has_trailer=bool(m.get("trailer_url")),
                )
                for m in movies_data.get("items", [])
            ]

            return MovieListResponse(
                movies=movies,
                total=movies_data.get("total", len(movies)),
                source=service.adapter_name,
            )
        else:
            return MovieListResponse(movies=[], total=0, source=service.adapter_name)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch movies: {str(e)}")


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

    if service.service_type != "media":
        raise HTTPException(status_code=400, detail="Service is not a media service")

    try:
        adapter = get_adapter(service.adapter_name)
        if not adapter or not hasattr(adapter, 'get_movies'):
            return {"synced": 0, "errors": 0}

        synced = 0
        errors = 0

        # Get all movies from service
        offset = 0
        limit = 100

        while True:
            movies_data = await adapter.get_movies(
                service.config,
                offset=offset,
                limit=limit,
            )

            items = movies_data.get("items", [])
            if not items:
                break

            for movie_data in items:
                try:
                    # Check if movie exists
                    existing = await db.execute(
                        select(Movie).where(
                            (Movie.title == movie_data.get("title")) &
                            (Movie.year == movie_data.get("year"))
                        )
                    )
                    movie = existing.scalar_one_or_none()

                    if movie:
                        # Update existing
                        movie.overview = movie_data.get("overview") or movie.overview
                        movie.poster_url = movie_data.get("poster_url") or movie.poster_url
                        movie.backdrop_url = movie_data.get("backdrop_url") or movie.backdrop_url
                        movie.rating = movie_data.get("rating") or movie.rating
                        movie.runtime_minutes = movie_data.get("runtime_minutes") or movie.runtime_minutes
                        movie.genres = movie_data.get("genres") or movie.genres
                    else:
                        # Create new
                        movie = Movie(
                            title=movie_data.get("title", "Unknown"),
                            year=movie_data.get("year"),
                            overview=movie_data.get("overview"),
                            poster_url=movie_data.get("poster_url"),
                            backdrop_url=movie_data.get("backdrop_url"),
                            rating=movie_data.get("rating"),
                            runtime_minutes=movie_data.get("runtime_minutes"),
                            genres=movie_data.get("genres", []),
                        )
                        db.add(movie)

                    synced += 1
                except Exception:
                    errors += 1

            offset += limit
            if len(items) < limit:
                break

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
