"""Wallmount API router for Theatarr."""

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from theatarr.database import DbSession
from theatarr.models.movie import Movie
from theatarr.models.palette import ColorPalette
from theatarr.models.session import Session, SessionStatus
from theatarr.models.template import Template
from theatarr.schemas.base import BaseSchema
from theatarr.services.palette import create_palette_for_movie

router = APIRouter(prefix="/wallmount", tags=["Wallmount"])


class WallmountStateResponse(BaseSchema):
    """Current wallmount state."""

    session_id: str | None = None
    session_name: str | None = None
    session_status: str | None = None
    current_sequence_index: int = 0
    total_sequences: int = 0
    current_sequence_name: str | None = None
    current_sequence_elapsed_ms: int = 0
    current_sequence_duration_ms: int | None = None
    movie: dict | None = None
    palette: dict | None = None
    template: dict | None = None
    countdown_to: str | None = None


class PaletteResponse(BaseSchema):
    """Color palette response."""

    id: str | None = None
    primary: str
    secondary: str | None
    accent: str | None
    background: str | None
    text: str | None
    muted: str | None
    vibrant: str | None
    vibrant_light: str | None
    vibrant_dark: str | None
    css_vars: dict | None = None


@router.get(
    "/state",
    response_model=WallmountStateResponse,
    summary="Get Current Wallmount State",
)
async def get_wallmount_state(db: DbSession) -> WallmountStateResponse:
    """Get current state for wallmount display.

    This endpoint is public (no auth required) and returns the current
    session state, movie info, and palette for display.
    """
    # Find the current active session
    result = await db.execute(
        select(Session)
        .where(Session.status.in_([SessionStatus.RUNNING, SessionStatus.PAUSED]))
        .order_by(Session.started_at.desc())
    )
    session = result.scalar_one_or_none()

    if not session:
        # Check for upcoming scheduled session
        result = await db.execute(
            select(Session)
            .where(Session.status == SessionStatus.SCHEDULED)
            .where(Session.scheduled_at.isnot(None))
            .order_by(Session.scheduled_at.asc())
        )
        scheduled_session = result.scalar_one_or_none()

        if scheduled_session:
            return WallmountStateResponse(
                session_id=scheduled_session.id,
                session_name=scheduled_session.name,
                session_status="scheduled",
                countdown_to=scheduled_session.scheduled_at.isoformat() if scheduled_session.scheduled_at else None,
            )

        return WallmountStateResponse()

    # Get current sequence
    current_sequence = None
    if session.sequences and 0 <= session.current_sequence_index < len(session.sequences):
        current_sequence = session.sequences[session.current_sequence_index]

    # Get movie info if linked
    movie_data = None
    palette_data = None

    if session.movie_id:
        result = await db.execute(select(Movie).where(Movie.id == session.movie_id))
        movie = result.scalar_one_or_none()

        if movie:
            movie_data = {
                "id": movie.id,
                "title": movie.title,
                "year": movie.year,
                "runtime_minutes": movie.runtime_minutes,
                "overview": movie.overview,
                "tagline": movie.tagline,
                "poster_url": movie.poster_url,
                "backdrop_url": movie.backdrop_url,
                "rating": movie.rating,
                "genres": movie.genres,
                "directors": movie.directors,
                "cast": movie.cast[:5] if movie.cast else [],
            }

            # Get or create palette
            result = await db.execute(
                select(ColorPalette)
                .where(ColorPalette.movie_id == movie.id)
                .order_by(ColorPalette.created_at.desc())
            )
            palette = result.scalar_one_or_none()

            if palette:
                palette_data = {
                    "primary": palette.primary,
                    "secondary": palette.secondary,
                    "accent": palette.accent,
                    "background": palette.background,
                    "text": palette.text,
                    "vibrant": palette.vibrant,
                    "css_vars": palette.to_css_vars(),
                }

    return WallmountStateResponse(
        session_id=session.id,
        session_name=session.name,
        session_status=session.status.value,
        current_sequence_index=session.current_sequence_index,
        total_sequences=len(session.sequences) if session.sequences else 0,
        current_sequence_name=current_sequence.name if current_sequence else None,
        current_sequence_elapsed_ms=session.current_sequence_elapsed_ms or 0,
        current_sequence_duration_ms=current_sequence.duration_ms if current_sequence else None,
        movie=movie_data,
        palette=palette_data,
    )


@router.post(
    "/palette/extract",
    response_model=PaletteResponse,
    summary="Extract Palette from Image",
)
async def extract_palette(
    db: DbSession,
    image_url: str,
    movie_id: str | None = None,
) -> PaletteResponse:
    """Extract color palette from an image URL.

    Optionally saves the palette associated with a movie.
    """
    try:
        palette_data = await create_palette_for_movie(
            movie_id=movie_id or "temp",
            poster_url=image_url,
        )

        # Save if movie_id provided
        if movie_id:
            palette = ColorPalette(
                movie_id=movie_id,
                source_url=image_url,
                source_type=palette_data.get("source_type", "poster"),
                primary=palette_data["primary"],
                secondary=palette_data.get("secondary"),
                accent=palette_data.get("accent"),
                background=palette_data.get("background"),
                text=palette_data.get("text"),
                muted=palette_data.get("muted"),
                vibrant=palette_data.get("vibrant"),
                vibrant_light=palette_data.get("vibrant_light"),
                vibrant_dark=palette_data.get("vibrant_dark"),
                muted_color=palette_data.get("muted_color"),
                muted_light=palette_data.get("muted_light"),
                muted_dark=palette_data.get("muted_dark"),
                raw_palette=palette_data.get("raw_palette"),
            )
            db.add(palette)
            await db.commit()
            await db.refresh(palette)

            return PaletteResponse(
                id=palette.id,
                primary=palette.primary,
                secondary=palette.secondary,
                accent=palette.accent,
                background=palette.background,
                text=palette.text,
                muted=palette.muted,
                vibrant=palette.vibrant,
                vibrant_light=palette.vibrant_light,
                vibrant_dark=palette.vibrant_dark,
                css_vars=palette.to_css_vars(),
            )

        return PaletteResponse(
            primary=palette_data["primary"],
            secondary=palette_data.get("secondary"),
            accent=palette_data.get("accent"),
            background=palette_data.get("background"),
            text=palette_data.get("text"),
            muted=palette_data.get("muted"),
            vibrant=palette_data.get("vibrant"),
            vibrant_light=palette_data.get("vibrant_light"),
            vibrant_dark=palette_data.get("vibrant_dark"),
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to extract palette: {str(e)}",
        )


@router.get(
    "/templates/active",
    summary="Get Active Template",
)
async def get_active_template(db: DbSession) -> dict:
    """Get the currently active wallmount template."""
    result = await db.execute(
        select(Template)
        .where(Template.is_active == True)
        .order_by(Template.updated_at.desc())
    )
    template = result.scalar_one_or_none()

    if not template:
        # Return default template config
        return {
            "name": "Default",
            "template_type": "movie_info",
            "layout": {
                "components": [
                    {"type": "backdrop", "opacity": 0.2},
                    {"type": "poster", "position": "left"},
                    {"type": "title"},
                    {"type": "metadata"},
                ]
            },
            "config": {},
        }

    return template.render_context({})
