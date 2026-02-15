"""Feedback API router for Theatarr - Session rating endpoints."""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from theatarr.api.deps import AdminUser
from theatarr.api.errors import NotFoundError
from theatarr.database import DbSession
from theatarr.models.action import Action
from theatarr.models.sequence import Sequence
from theatarr.models.session import Session, SessionStatus
from theatarr.models.session_feedback import SessionFeedback
from theatarr.models.session_participant import InvitationStatus, SessionParticipant
from theatarr.schemas.feedback import (
    FEEDBACK_CATEGORY_MAP,
    FeedbackCategoriesResponse,
    FeedbackCategoryAverage,
    FeedbackCategoryInfo,
    FeedbackEntryResponse,
    FeedbackStatusResponse,
    FeedbackSubmit,
    FeedbackSummaryResponse,
)
from theatarr.services.auth import CurrentUser

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/feedback", tags=["Feedback"])


async def _get_session_action_types(db, session_id: str) -> set[str]:
    """Get distinct action types used in a session's sequences."""
    result = await db.execute(
        select(Action.action_type)
        .join(Sequence)
        .where(Sequence.session_id == session_id)
        .distinct()
    )
    return {
        row[0].value if hasattr(row[0], "value") else row[0]
        for row in result.all()
    }


def _build_categories(action_types: set[str]) -> list[FeedbackCategoryInfo]:
    """Build applicable feedback categories based on action types present."""
    categories = []
    # Always include "media" if there's a media action
    for slug in ("media", "lighting", "audio", "display", "actuator"):
        if slug in action_types:
            info = FEEDBACK_CATEGORY_MAP[slug]
            categories.append(FeedbackCategoryInfo(
                slug=slug,
                label_fr=info["label_fr"],
                label_en=info["label_en"],
                icon=info["icon"],
            ))
    # Always include "organisation"
    info = FEEDBACK_CATEGORY_MAP["organisation"]
    categories.append(FeedbackCategoryInfo(
        slug="organisation",
        label_fr=info["label_fr"],
        label_en=info["label_en"],
        icon=info["icon"],
    ))
    return categories


async def _check_feedback_access(db, session_id: str, user) -> SessionParticipant | None:
    """Verify user is an accepted participant (or admin). Returns participation or None for admin."""
    result = await db.execute(
        select(SessionParticipant)
        .options(selectinload(SessionParticipant.session))
        .where(
            SessionParticipant.session_id == session_id,
            SessionParticipant.user_id == user.id,
        )
    )
    participation = result.scalar_one_or_none()

    if not participation:
        # Allow admins to access feedback for any session
        if user.role == "admin":
            sess_result = await db.execute(
                select(Session).where(Session.id == session_id)
            )
            session = sess_result.scalar_one_or_none()
            if not session:
                raise NotFoundError("Session", session_id)
            # Create a fake participation-like object for consistency
            participation = None
            session_status = session.status.value if hasattr(session.status, "value") else session.status
            if session_status not in ("running", "completed") and not session.feedback_opened:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Feedback is only available for running or completed sessions",
                )
            return participation
        raise NotFoundError("Session", session_id)

    if participation.invitation_status != InvitationStatus.ACCEPTED.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be an accepted participant to give feedback",
        )

    session = participation.session
    session_status = session.status.value if hasattr(session.status, "value") else session.status
    if session_status not in ("running", "completed") and not session.feedback_opened:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Feedback is only available for running or completed sessions",
        )

    return participation


@router.get(
    "/sessions/{session_id}/categories",
    response_model=FeedbackCategoriesResponse,
    summary="Get Feedback Categories",
)
async def get_feedback_categories(
    db: DbSession,
    user: CurrentUser,
    session_id: str,
) -> FeedbackCategoriesResponse:
    """Get applicable feedback categories for a session based on its action types."""
    participation = await _check_feedback_access(db, session_id, user)
    if participation:
        session = participation.session
    else:
        sess_result = await db.execute(select(Session).where(Session.id == session_id))
        session = sess_result.scalar_one()

    action_types = await _get_session_action_types(db, session_id)
    categories = _build_categories(action_types)

    # Check if user has already submitted
    existing = await db.execute(
        select(SessionFeedback.id).where(
            SessionFeedback.session_id == session_id,
            SessionFeedback.user_id == user.id,
        )
    )
    has_submitted = existing.scalar_one_or_none() is not None

    return FeedbackCategoriesResponse(
        session_id=session_id,
        categories=categories,
        has_submitted=has_submitted,
        session_name=session.name,
        movie_title=session.movie_title,
        movie_poster_url=session.movie_poster_url,
        scheduled_at=session.scheduled_at,
        completed_at=session.completed_at,
    )


@router.post(
    "/sessions/{session_id}/submit",
    summary="Submit Feedback",
)
async def submit_feedback(
    db: DbSession,
    user: CurrentUser,
    session_id: str,
    data: FeedbackSubmit,
) -> dict:
    """Submit feedback for a session."""
    await _check_feedback_access(db, session_id, user)

    # Check if already submitted
    existing = await db.execute(
        select(SessionFeedback).where(
            SessionFeedback.session_id == session_id,
            SessionFeedback.user_id == user.id,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already submitted feedback for this session",
        )

    # Calculate overall rating (average of all category ratings)
    ratings_dict = {}
    total_rating = 0
    for slug, item in data.ratings.items():
        ratings_dict[slug] = {
            "rating": item.rating,
            "comment": item.comment,
        }
        total_rating += item.rating
    overall_rating = total_rating / len(data.ratings)

    feedback = SessionFeedback(
        session_id=session_id,
        user_id=user.id,
        ratings=ratings_dict,
        overall_rating=overall_rating,
        submitted_at=datetime.now(timezone.utc),
    )
    db.add(feedback)
    await db.commit()

    logger.info(
        "User %s submitted feedback for session %s (overall: %.1f)",
        user.username, session_id, overall_rating,
    )

    return {"success": True, "overall_rating": overall_rating}


@router.get(
    "/sessions/{session_id}/my-feedback",
    summary="Get My Feedback",
)
async def get_my_feedback(
    db: DbSession,
    user: CurrentUser,
    session_id: str,
) -> dict:
    """Get the current user's feedback for a session."""
    result = await db.execute(
        select(SessionFeedback).where(
            SessionFeedback.session_id == session_id,
            SessionFeedback.user_id == user.id,
        )
    )
    feedback = result.scalar_one_or_none()

    if not feedback:
        return {"has_submitted": False}

    return {
        "has_submitted": True,
        "ratings": feedback.ratings,
        "overall_rating": feedback.overall_rating,
        "submitted_at": feedback.submitted_at.isoformat(),
    }


@router.get(
    "/sessions/{session_id}/summary",
    response_model=FeedbackSummaryResponse,
    summary="Get Feedback Summary (Admin)",
)
async def get_feedback_summary(
    db: DbSession,
    user: AdminUser,
    session_id: str,
) -> FeedbackSummaryResponse:
    """Get aggregated feedback summary for a session (admin only)."""
    # Verify session exists
    session_result = await db.execute(
        select(Session).where(Session.id == session_id)
    )
    if not session_result.scalar_one_or_none():
        raise NotFoundError("Session", session_id)

    # Get all feedback entries with user info
    result = await db.execute(
        select(SessionFeedback)
        .options(selectinload(SessionFeedback.user))
        .where(SessionFeedback.session_id == session_id)
        .order_by(SessionFeedback.submitted_at.desc())
    )
    entries = result.scalars().all()

    if not entries:
        return FeedbackSummaryResponse(
            session_id=session_id,
            total_submissions=0,
            overall_average=0,
            category_averages=[],
            entries=[],
        )

    # Build entries response
    entry_responses = []
    for entry in entries:
        entry_responses.append(FeedbackEntryResponse(
            id=entry.id,
            user_id=entry.user_id,
            username=entry.user.username if entry.user else "Unknown",
            ratings=entry.ratings,
            overall_rating=entry.overall_rating,
            submitted_at=entry.submitted_at,
        ))

    # Compute category averages
    category_totals: dict[str, list[int]] = {}
    for entry in entries:
        for slug, data in entry.ratings.items():
            if slug not in category_totals:
                category_totals[slug] = []
            category_totals[slug].append(data.get("rating", 0))

    category_averages = []
    for slug, ratings in category_totals.items():
        info = FEEDBACK_CATEGORY_MAP.get(slug, {})
        category_averages.append(FeedbackCategoryAverage(
            slug=slug,
            label_fr=info.get("label_fr", slug),
            label_en=info.get("label_en", slug),
            average=sum(ratings) / len(ratings),
            count=len(ratings),
        ))

    overall_average = sum(e.overall_rating for e in entries) / len(entries)

    return FeedbackSummaryResponse(
        session_id=session_id,
        total_submissions=len(entries),
        overall_average=overall_average,
        category_averages=category_averages,
        entries=entry_responses,
    )


@router.get(
    "/sessions/{session_id}/status",
    response_model=FeedbackStatusResponse,
    summary="Get Feedback Status",
)
async def get_feedback_status(
    db: DbSession,
    user: CurrentUser,
    session_id: str,
) -> FeedbackStatusResponse:
    """Get lightweight feedback status for a session (badge display)."""
    # Check user has submitted
    existing = await db.execute(
        select(SessionFeedback.id).where(
            SessionFeedback.session_id == session_id,
            SessionFeedback.user_id == user.id,
        )
    )
    has_submitted = existing.scalar_one_or_none() is not None

    # Get count and average
    count_result = await db.execute(
        select(func.count(SessionFeedback.id)).where(
            SessionFeedback.session_id == session_id,
        )
    )
    feedback_count = count_result.scalar() or 0

    overall_average = None
    if feedback_count > 0:
        avg_result = await db.execute(
            select(func.avg(SessionFeedback.overall_rating)).where(
                SessionFeedback.session_id == session_id,
            )
        )
        overall_average = avg_result.scalar()

    return FeedbackStatusResponse(
        has_submitted=has_submitted,
        feedback_count=feedback_count,
        overall_average=round(overall_average, 1) if overall_average else None,
    )
