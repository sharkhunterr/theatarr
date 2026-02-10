"""Display API router for Theatarr.

Public endpoints for display/kiosk mode - no authentication required.
A browser connects to a session by entering a display code.
"""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from theatarr.database import DbSession
from theatarr.models.movie import Movie
from theatarr.models.session import Session, SessionStatus

router = APIRouter(prefix="/display", tags=["Display"])


@router.get(
    "/{code}",
    summary="Validate Display Code",
)
async def get_display_session(
    code: str,
    db: DbSession,
) -> dict:
    """Validate a display code and return session info (public, no auth required)."""
    result = await db.execute(
        select(Session).where(Session.display_code == code.upper())
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Code invalide",
        )

    movie = None
    if session.movie_id:
        # Fetch full movie data for rich template rendering
        movie_result = await db.execute(
            select(Movie).where(Movie.id == session.movie_id)
        )
        movie_obj = movie_result.scalar_one_or_none()
        if movie_obj:
            movie = {
                "id": movie_obj.id,
                "title": movie_obj.title,
                "original_title": movie_obj.original_title,
                "year": movie_obj.year,
                "runtime_minutes": movie_obj.runtime_minutes,
                "overview": movie_obj.overview,
                "tagline": movie_obj.tagline,
                "poster_url": movie_obj.poster_url,
                "backdrop_url": movie_obj.backdrop_url,
                "rating": movie_obj.rating,
                "vote_count": movie_obj.vote_count,
                "genres": movie_obj.genres or [],
                "directors": movie_obj.directors or [],
                "cast": movie_obj.cast or [],
                "studios": movie_obj.studios or [],
                "keywords": movie_obj.keywords or [],
                "extra_backdrops": movie_obj.extra_backdrops or [],
                "extra_posters": movie_obj.extra_posters or [],
                "logos": movie_obj.logos or [],
                "enrichment_sources": movie_obj.enrichment_sources or [],
            }
    elif session.movie_title:
        # Fallback to basic session movie info
        movie = {
            "title": session.movie_title,
            "poster_url": session.movie_poster_url,
        }

    # Include full template data for rendering
    template = None
    if session.template:
        template = {
            "id": session.template.id,
            "name": session.template.name,
            "template_type": session.template.template_type.value if hasattr(session.template.template_type, 'value') else session.template.template_type,
            "layout": session.template.layout,
            "config": session.template.config,
        }

    return {
        "session_id": session.id,
        "session_name": session.name,
        "session_status": session.status.value if isinstance(session.status, SessionStatus) else session.status,
        "movie": movie,
        "display_code": session.display_code,
        "color_palette": session.color_palette,
        "template_id": session.template_id,
        "template": template,
    }
