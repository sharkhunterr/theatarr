"""Wallmount API router for Theatarr."""

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from sqlalchemy.orm import selectinload

from theatarr.database import DbSession
from theatarr.models.movie import Movie
from theatarr.models.palette import ColorPalette
from theatarr.models.session import MovieSelectionMode, Session, SessionStatus
from theatarr.models.template import Template
from theatarr.models.vote import VoteSession
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
    vote_info: dict | None = None  # Vote session info if session uses vote mode


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
async def get_wallmount_state(
    db: DbSession,
    session_id: str | None = None,
) -> WallmountStateResponse:
    """Get current state for wallmount display.

    This endpoint is public (no auth required) and returns the current
    session state, movie info, and palette for display.

    If session_id is provided, returns the state for that specific session.
    Otherwise, returns the current active/scheduled session.
    """
    session = None

    # If specific session requested, fetch it
    if session_id:
        result = await db.execute(
            select(Session).where(Session.id == session_id)
        )
        session = result.scalar_one_or_none()

        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session {session_id} not found",
            )

        # Get movie info for the specific session
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
                    "extra_backdrops": movie.extra_backdrops or [],
                    "extra_posters": movie.extra_posters or [],
                    "logos": movie.logos or [],
                    "rating": movie.rating,
                    "genres": movie.genres,
                    "directors": movie.directors,
                    "cast": movie.cast[:10] if movie.cast else [],
                    "studios": movie.studios or [],
                    "original_title": movie.original_title,
                    "enrichment_sources": movie.enrichment_sources or [],
                    "keywords": movie.keywords or [],
                    "vote_count": movie.vote_count,
                }

                # Get palette
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

        # Fallback to session's denormalized movie fields or vote session movie_options
        if not movie_data and session.movie_title:
            movie_data = {
                "id": session.movie_source_id,
                "title": session.movie_title,
                "poster_url": session.movie_poster_url,
                "backdrop_url": session.movie_poster_url,  # Use poster as backdrop fallback
            }

            # Try to get more details from vote session movie_options if available
            if session.linked_vote_session_id:
                vs_result = await db.execute(
                    select(VoteSession).where(VoteSession.id == session.linked_vote_session_id)
                )
                vote_session = vs_result.scalar_one_or_none()
                if vote_session and vote_session.winning_movie_index is not None and vote_session.movie_options:
                    winner_idx = vote_session.winning_movie_index
                    if 0 <= winner_idx < len(vote_session.movie_options):
                        winning_movie = vote_session.movie_options[winner_idx]
                        movie_data = {
                            "id": winning_movie.get("movie_id") or winning_movie.get("source_id"),
                            "title": winning_movie.get("title"),
                            "year": winning_movie.get("year"),
                            "runtime_minutes": winning_movie.get("runtime_minutes"),
                            "overview": winning_movie.get("overview"),
                            "tagline": winning_movie.get("tagline"),
                            "poster_url": winning_movie.get("poster_url"),
                            "backdrop_url": winning_movie.get("backdrop_url") or winning_movie.get("poster_url"),
                            "rating": winning_movie.get("rating"),
                            "genres": winning_movie.get("genres"),
                            "directors": winning_movie.get("directors"),
                            "cast": winning_movie.get("cast", [])[:5] if winning_movie.get("cast") else [],
                        }

            # Use session's color palette if available
            if session.color_palette:
                palette_data = {
                    "primary": session.color_palette.get("primary"),
                    "secondary": session.color_palette.get("secondary"),
                    "accent": session.color_palette.get("accent"),
                    "background": session.color_palette.get("background"),
                    "text": session.color_palette.get("text"),
                    "vibrant": session.color_palette.get("vibrant"),
                }

        # Get current sequence info for running/paused sessions
        current_sequence = None
        if session.sequences and 0 <= session.current_sequence_index < len(session.sequences):
            current_sequence = session.sequences[session.current_sequence_index]

        # For scheduled sessions with a scheduled_at, include countdown
        countdown_to = None
        status_value = session.status.value if hasattr(session.status, 'value') else session.status
        if status_value == SessionStatus.SCHEDULED.value and session.scheduled_at:
            countdown_to = session.scheduled_at.isoformat()

        # Get template: session's template if set, otherwise active template
        template_data = None
        if session.template_id:
            result = await db.execute(
                select(Template).where(Template.id == session.template_id)
            )
            template = result.scalar_one_or_none()
            if template:
                template_data = template.render_context({})

        if not template_data:
            # Fall back to globally active template
            result = await db.execute(
                select(Template)
                .where(Template.is_active == True)
                .order_by(Template.updated_at.desc())
            )
            template = result.scalar_one_or_none()
            if template:
                template_data = template.render_context({})

        # Get vote info if session uses vote mode
        vote_info = None
        if session.linked_vote_session_id:
            result = await db.execute(
                select(VoteSession)
                .options(selectinload(VoteSession.votes))
                .where(VoteSession.id == session.linked_vote_session_id)
            )
            vote_session = result.scalar_one_or_none()
            if vote_session:
                vote_info = {
                    "total_votes": vote_session.total_votes,
                    "is_open": vote_session.is_open,
                    "status": vote_session.status.value if hasattr(vote_session.status, 'value') else vote_session.status,
                    "winning_movie_index": vote_session.winning_movie_index,
                }

        return WallmountStateResponse(
            session_id=session.id,
            session_name=session.name,
            session_status=status_value,
            current_sequence_index=session.current_sequence_index,
            total_sequences=len(session.sequences) if session.sequences else 0,
            current_sequence_name=current_sequence.name if current_sequence else None,
            current_sequence_elapsed_ms=session.current_sequence_elapsed_ms or 0,
            current_sequence_duration_ms=current_sequence.duration_ms if current_sequence else None,
            countdown_to=countdown_to,
            movie=movie_data,
            palette=palette_data,
            template=template_data,
            vote_info=vote_info,
        )

    # No specific session - find current active/scheduled session
    else:
        # Find the current active session (get the most recent one)
        result = await db.execute(
            select(Session)
            .where(Session.status.in_([SessionStatus.RUNNING, SessionStatus.PAUSED]))
            .order_by(Session.started_at.desc())
            .limit(1)
        )
        session = result.scalar_one_or_none()

        if not session:
            # Check for upcoming scheduled session (get the first one)
            result = await db.execute(
                select(Session)
                .where(Session.status == SessionStatus.SCHEDULED)
                .where(Session.scheduled_at.isnot(None))
                .order_by(Session.scheduled_at.asc())
                .limit(1)
            )
            scheduled_session = result.scalar_one_or_none()

            if scheduled_session:
                # Get movie info for scheduled session
                movie_data = None
                palette_data = None

                if scheduled_session.movie_id:
                    result = await db.execute(select(Movie).where(Movie.id == scheduled_session.movie_id))
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
                            "extra_backdrops": movie.extra_backdrops or [],
                            "extra_posters": movie.extra_posters or [],
                            "logos": movie.logos or [],
                            "rating": movie.rating,
                            "genres": movie.genres,
                            "directors": movie.directors,
                            "cast": movie.cast[:10] if movie.cast else [],
                            "studios": movie.studios or [],
                            "original_title": movie.original_title,
                            "enrichment_sources": movie.enrichment_sources or [],
                            "keywords": movie.keywords or [],
                            "vote_count": movie.vote_count,
                        }

                        # Get palette
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

                # Fallback to session's denormalized movie fields or vote session movie_options
                if not movie_data and scheduled_session.movie_title:
                    movie_data = {
                        "id": scheduled_session.movie_source_id,
                        "title": scheduled_session.movie_title,
                        "poster_url": scheduled_session.movie_poster_url,
                        "backdrop_url": scheduled_session.movie_poster_url,
                    }

                    # Try to get more details from vote session movie_options if available
                    if scheduled_session.linked_vote_session_id:
                        vs_result = await db.execute(
                            select(VoteSession).where(VoteSession.id == scheduled_session.linked_vote_session_id)
                        )
                        vote_session_data = vs_result.scalar_one_or_none()
                        if vote_session_data and vote_session_data.winning_movie_index is not None and vote_session_data.movie_options:
                            winner_idx = vote_session_data.winning_movie_index
                            if 0 <= winner_idx < len(vote_session_data.movie_options):
                                winning_movie = vote_session_data.movie_options[winner_idx]
                                movie_data = {
                                    "id": winning_movie.get("movie_id") or winning_movie.get("source_id"),
                                    "title": winning_movie.get("title"),
                                    "year": winning_movie.get("year"),
                                    "runtime_minutes": winning_movie.get("runtime_minutes"),
                                    "overview": winning_movie.get("overview"),
                                    "tagline": winning_movie.get("tagline"),
                                    "poster_url": winning_movie.get("poster_url"),
                                    "backdrop_url": winning_movie.get("backdrop_url") or winning_movie.get("poster_url"),
                                    "rating": winning_movie.get("rating"),
                                    "genres": winning_movie.get("genres"),
                                    "directors": winning_movie.get("directors"),
                                    "cast": winning_movie.get("cast", [])[:5] if winning_movie.get("cast") else [],
                                }

                    if scheduled_session.color_palette:
                        palette_data = {
                            "primary": scheduled_session.color_palette.get("primary"),
                            "secondary": scheduled_session.color_palette.get("secondary"),
                            "accent": scheduled_session.color_palette.get("accent"),
                            "background": scheduled_session.color_palette.get("background"),
                            "text": scheduled_session.color_palette.get("text"),
                            "vibrant": scheduled_session.color_palette.get("vibrant"),
                        }

                # Get template: session's template if set, otherwise active template
                template_data = None
                if scheduled_session.template_id:
                    result = await db.execute(
                        select(Template).where(Template.id == scheduled_session.template_id)
                    )
                    template = result.scalar_one_or_none()
                    if template:
                        template_data = template.render_context({})

                if not template_data:
                    # Fall back to globally active template
                    result = await db.execute(
                        select(Template)
                        .where(Template.is_active == True)
                        .order_by(Template.updated_at.desc())
                    )
                    template = result.scalar_one_or_none()
                    if template:
                        template_data = template.render_context({})

                # Get vote info if session uses vote mode
                vote_info = None
                if scheduled_session.linked_vote_session_id:
                    result = await db.execute(
                        select(VoteSession)
                        .options(selectinload(VoteSession.votes))
                        .where(VoteSession.id == scheduled_session.linked_vote_session_id)
                    )
                    vote_session = result.scalar_one_or_none()
                    if vote_session:
                        vote_info = {
                            "total_votes": vote_session.total_votes,
                            "is_open": vote_session.is_open,
                            "status": vote_session.status.value if hasattr(vote_session.status, 'value') else vote_session.status,
                            "winning_movie_index": vote_session.winning_movie_index,
                        }

                return WallmountStateResponse(
                    session_id=scheduled_session.id,
                    session_name=scheduled_session.name,
                    session_status="scheduled",
                    countdown_to=scheduled_session.scheduled_at.isoformat() if scheduled_session.scheduled_at else None,
                    movie=movie_data,
                    palette=palette_data,
                    template=template_data,
                    vote_info=vote_info,
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
                "extra_backdrops": movie.extra_backdrops or [],
                "extra_posters": movie.extra_posters or [],
                "logos": movie.logos or [],
                "rating": movie.rating,
                "genres": movie.genres,
                "directors": movie.directors,
                "cast": movie.cast[:10] if movie.cast else [],
                "studios": movie.studios or [],
                "original_title": movie.original_title,
                "enrichment_sources": movie.enrichment_sources or [],
                "keywords": movie.keywords or [],
                "vote_count": movie.vote_count,
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

    # Fallback to session's denormalized movie fields or vote session movie_options
    if not movie_data and session.movie_title:
        movie_data = {
            "id": session.movie_source_id,
            "title": session.movie_title,
            "poster_url": session.movie_poster_url,
            "backdrop_url": session.movie_poster_url,
        }

        # Try to get more details from vote session movie_options if available
        if session.linked_vote_session_id:
            vs_result = await db.execute(
                select(VoteSession).where(VoteSession.id == session.linked_vote_session_id)
            )
            vote_session_data = vs_result.scalar_one_or_none()
            if vote_session_data and vote_session_data.winning_movie_index is not None and vote_session_data.movie_options:
                winner_idx = vote_session_data.winning_movie_index
                if 0 <= winner_idx < len(vote_session_data.movie_options):
                    winning_movie = vote_session_data.movie_options[winner_idx]
                    movie_data = {
                        "id": winning_movie.get("movie_id") or winning_movie.get("source_id"),
                        "title": winning_movie.get("title"),
                        "year": winning_movie.get("year"),
                        "runtime_minutes": winning_movie.get("runtime_minutes"),
                        "overview": winning_movie.get("overview"),
                        "tagline": winning_movie.get("tagline"),
                        "poster_url": winning_movie.get("poster_url"),
                        "backdrop_url": winning_movie.get("backdrop_url") or winning_movie.get("poster_url"),
                        "rating": winning_movie.get("rating"),
                        "genres": winning_movie.get("genres"),
                        "directors": winning_movie.get("directors"),
                        "cast": winning_movie.get("cast", [])[:5] if winning_movie.get("cast") else [],
                    }

        if session.color_palette:
            palette_data = {
                "primary": session.color_palette.get("primary"),
                "secondary": session.color_palette.get("secondary"),
                "accent": session.color_palette.get("accent"),
                "background": session.color_palette.get("background"),
                "text": session.color_palette.get("text"),
                "vibrant": session.color_palette.get("vibrant"),
            }

    # Get template: session's template if set, otherwise active template
    template_data = None
    if session.template_id:
        result = await db.execute(
            select(Template).where(Template.id == session.template_id)
        )
        template = result.scalar_one_or_none()
        if template:
            template_data = template.render_context({})

    if not template_data:
        # Fall back to globally active template
        result = await db.execute(
            select(Template)
            .where(Template.is_active == True)
            .order_by(Template.updated_at.desc())
        )
        template = result.scalar_one_or_none()
        if template:
            template_data = template.render_context({})

    # Get vote info if session uses vote mode
    vote_info = None
    if session.linked_vote_session_id:
        result = await db.execute(
            select(VoteSession)
            .options(selectinload(VoteSession.votes))
            .where(VoteSession.id == session.linked_vote_session_id)
        )
        vote_session = result.scalar_one_or_none()
        if vote_session:
            vote_info = {
                "total_votes": vote_session.total_votes,
                "is_open": vote_session.is_open,
                "status": vote_session.status.value if hasattr(vote_session.status, 'value') else vote_session.status,
                "winning_movie_index": vote_session.winning_movie_index,
            }

    status_val = session.status.value if hasattr(session.status, 'value') else session.status
    return WallmountStateResponse(
        session_id=session.id,
        session_name=session.name,
        session_status=status_val,
        current_sequence_index=session.current_sequence_index,
        total_sequences=len(session.sequences) if session.sequences else 0,
        current_sequence_name=current_sequence.name if current_sequence else None,
        current_sequence_elapsed_ms=session.current_sequence_elapsed_ms or 0,
        current_sequence_duration_ms=current_sequence.duration_ms if current_sequence else None,
        movie=movie_data,
        palette=palette_data,
        template=template_data,
        vote_info=vote_info,
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
