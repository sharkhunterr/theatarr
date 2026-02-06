"""Portal API router for Theatarr - User portal endpoints."""

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import selectinload

from theatarr.api.errors import NotFoundError
from theatarr.database import DbSession
from theatarr.models.session import Session, SessionStatus
from theatarr.models.session_participant import InvitationStatus, SessionParticipant
from theatarr.models.user import User
from theatarr.models.vote import Vote, VoteSession, VoteSessionStatus
from theatarr.models.vote_session_participant import VoteSessionParticipant
from theatarr.schemas.portal import (
    PortalHistorySessionItem,
    PortalHistoryVoteItem,
    PortalProfileResponse,
    PortalSessionDetail,
    PortalSessionListResponse,
    PortalSessionSummary,
    PortalStatsResponse,
    PortalVoteCast,
    PortalVoteListResponse,
    PortalVoteResponse,
    PortalVoteSessionDetail,
    PortalVoteSessionSummary,
    SessionRespondRequest,
)
from theatarr.schemas.user import PasswordChangeRequest, UserSelfUpdate
from theatarr.services.auth import CurrentUser, hash_password, verify_password

router = APIRouter(prefix="/portal", tags=["Portal"])


# ============================================================================
# Profile endpoints
# ============================================================================


@router.get(
    "/me",
    response_model=PortalProfileResponse,
    summary="Get My Profile",
)
async def get_my_profile(
    user: CurrentUser,
) -> PortalProfileResponse:
    """Get current user's profile."""
    return PortalProfileResponse(
        id=user.id,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        email=user.email,
        role=user.role,
        created_at=user.created_at,
    )


@router.patch(
    "/me",
    response_model=PortalProfileResponse,
    summary="Update My Profile",
)
async def update_my_profile(
    db: DbSession,
    user: CurrentUser,
    data: UserSelfUpdate,
) -> PortalProfileResponse:
    """Update current user's profile."""
    # Check if email is being changed and if it's already in use
    if data.email is not None and data.email != user.email:
        result = await db.execute(
            select(User).where(User.email == data.email, User.id != user.id)
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already in use",
            )

    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)

    await db.commit()
    await db.refresh(user)

    return PortalProfileResponse(
        id=user.id,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        email=user.email,
        role=user.role,
        created_at=user.created_at,
    )


@router.post(
    "/me/change-password",
    summary="Change My Password",
)
async def change_my_password(
    db: DbSession,
    user: CurrentUser,
    data: PasswordChangeRequest,
) -> dict:
    """Change current user's password."""
    # Verify current password
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    user.password_hash = hash_password(data.new_password)
    await db.commit()

    return {"success": True, "message": "Password changed successfully"}


@router.get(
    "/stats",
    response_model=PortalStatsResponse,
    summary="Get My Stats",
)
async def get_my_stats(
    db: DbSession,
    user: CurrentUser,
) -> PortalStatsResponse:
    """Get current user's statistics for portal home."""
    now = datetime.now(timezone.utc)

    # Count pending votes
    pending_votes_query = select(func.count(VoteSessionParticipant.id)).where(
        VoteSessionParticipant.user_id == user.id,
        VoteSessionParticipant.has_voted == False,
    )
    # Join to check vote session is open
    pending_votes_query = (
        select(func.count(VoteSessionParticipant.id))
        .join(VoteSession)
        .where(
            VoteSessionParticipant.user_id == user.id,
            VoteSessionParticipant.has_voted == False,
            VoteSession.status == VoteSessionStatus.OPEN,
        )
    )
    pending_votes_result = await db.execute(pending_votes_query)
    pending_votes = pending_votes_result.scalar() or 0

    # Count upcoming sessions
    upcoming_sessions_query = (
        select(func.count(SessionParticipant.id))
        .join(Session)
        .where(
            SessionParticipant.user_id == user.id,
            SessionParticipant.invitation_status == InvitationStatus.ACCEPTED.value,
            Session.status.in_([SessionStatus.SCHEDULED.value, SessionStatus.DRAFT.value]),
        )
    )
    upcoming_sessions_result = await db.execute(upcoming_sessions_query)
    upcoming_sessions = upcoming_sessions_result.scalar() or 0

    # Count total sessions attended
    total_sessions_query = (
        select(func.count(SessionParticipant.id))
        .join(Session)
        .where(
            SessionParticipant.user_id == user.id,
            SessionParticipant.invitation_status == InvitationStatus.ACCEPTED.value,
            Session.status == SessionStatus.COMPLETED.value,
        )
    )
    total_sessions_result = await db.execute(total_sessions_query)
    total_sessions_attended = total_sessions_result.scalar() or 0

    # Count total votes cast
    total_votes_query = select(func.count(VoteSessionParticipant.id)).where(
        VoteSessionParticipant.user_id == user.id,
        VoteSessionParticipant.has_voted == True,
    )
    total_votes_result = await db.execute(total_votes_query)
    total_votes_cast = total_votes_result.scalar() or 0

    return PortalStatsResponse(
        pending_votes=pending_votes,
        upcoming_sessions=upcoming_sessions,
        total_sessions_attended=total_sessions_attended,
        total_votes_cast=total_votes_cast,
    )


# ============================================================================
# Sessions endpoints
# ============================================================================


@router.get(
    "/sessions",
    response_model=PortalSessionListResponse,
    summary="Get My Sessions",
)
async def get_my_sessions(
    db: DbSession,
    user: CurrentUser,
    status_filter: str | None = None,
    skip: int = 0,
    limit: int = 20,
) -> PortalSessionListResponse:
    """Get sessions where the current user is a participant."""
    query = (
        select(SessionParticipant)
        .options(selectinload(SessionParticipant.session))
        .where(SessionParticipant.user_id == user.id)
    )

    if status_filter:
        query = query.join(Session).where(Session.status == status_filter)

    query = query.order_by(SessionParticipant.invited_at.desc()).offset(skip).limit(limit)

    result = await db.execute(query)
    participations = result.scalars().all()

    items = []
    for p in participations:
        session = p.session
        items.append(
            PortalSessionSummary(
                id=session.id,
                name=session.name,
                movie_title=session.movie_title,
                movie_poster_url=session.movie_poster_url,
                status=session.status.value if isinstance(session.status, SessionStatus) else session.status,
                scheduled_at=session.scheduled_at,
                invitation_status=p.invitation_status,
            )
        )

    # Get total count
    count_query = select(func.count(SessionParticipant.id)).where(
        SessionParticipant.user_id == user.id
    )
    if status_filter:
        count_query = count_query.join(Session).where(Session.status == status_filter)
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    return PortalSessionListResponse(items=items, total=total)


@router.get(
    "/sessions/{session_id}",
    response_model=PortalSessionDetail,
    summary="Get Session Detail",
)
async def get_session_detail(
    db: DbSession,
    user: CurrentUser,
    session_id: str,
) -> PortalSessionDetail:
    """Get detailed session info for a participant."""
    # Check if user is a participant
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
        raise NotFoundError("Session", session_id)

    session = participation.session
    return PortalSessionDetail(
        id=session.id,
        name=session.name,
        description=session.description,
        movie_title=session.movie_title,
        movie_poster_url=session.movie_poster_url,
        movie_source=session.movie_source,
        color_palette=session.color_palette,
        status=session.status.value if isinstance(session.status, SessionStatus) else session.status,
        scheduled_at=session.scheduled_at,
        started_at=session.started_at,
        completed_at=session.completed_at,
        invitation_status=participation.invitation_status,
        responded_at=participation.responded_at,
    )


@router.post(
    "/sessions/{session_id}/respond",
    summary="Respond to Session Invitation",
)
async def respond_to_session(
    db: DbSession,
    user: CurrentUser,
    session_id: str,
    data: SessionRespondRequest,
) -> dict:
    """Accept or decline a session invitation."""
    result = await db.execute(
        select(SessionParticipant).where(
            SessionParticipant.session_id == session_id,
            SessionParticipant.user_id == user.id,
        )
    )
    participation = result.scalar_one_or_none()

    if not participation:
        raise NotFoundError("Session invitation", session_id)

    participation.invitation_status = (
        InvitationStatus.ACCEPTED.value if data.accept else InvitationStatus.DECLINED.value
    )
    participation.responded_at = datetime.now(timezone.utc)

    await db.commit()

    return {
        "success": True,
        "status": participation.invitation_status,
    }


# ============================================================================
# Votes endpoints
# ============================================================================


@router.get(
    "/votes",
    response_model=PortalVoteListResponse,
    summary="Get My Votes",
)
async def get_my_votes(
    db: DbSession,
    user: CurrentUser,
    skip: int = 0,
    limit: int = 20,
) -> PortalVoteListResponse:
    """Get vote sessions where the current user is a participant."""
    query = (
        select(VoteSessionParticipant)
        .options(selectinload(VoteSessionParticipant.vote_session))
        .where(VoteSessionParticipant.user_id == user.id)
        .order_by(VoteSessionParticipant.invited_at.desc())
        .offset(skip)
        .limit(limit)
    )

    result = await db.execute(query)
    participations = result.scalars().all()

    items = []
    for p in participations:
        vs = p.vote_session
        # Get first 3 movie options for preview
        movie_options = vs.movie_options or []
        preview = movie_options[:3]

        items.append(
            PortalVoteSessionSummary(
                id=vs.id,
                name=vs.name,
                description=vs.description,
                movie_options_preview=preview,
                has_voted=p.has_voted,
                closes_at=vs.closes_at,
                status=vs.status.value if isinstance(vs.status, VoteSessionStatus) else vs.status,
            )
        )

    # Get total count
    count_query = select(func.count(VoteSessionParticipant.id)).where(
        VoteSessionParticipant.user_id == user.id
    )
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    return PortalVoteListResponse(items=items, total=total)


@router.get(
    "/votes/pending",
    response_model=PortalVoteListResponse,
    summary="Get Pending Votes",
)
async def get_pending_votes(
    db: DbSession,
    user: CurrentUser,
) -> PortalVoteListResponse:
    """Get vote sessions where the user hasn't voted yet and voting is open."""
    query = (
        select(VoteSessionParticipant)
        .options(selectinload(VoteSessionParticipant.vote_session))
        .join(VoteSession)
        .where(
            VoteSessionParticipant.user_id == user.id,
            VoteSessionParticipant.has_voted == False,
            VoteSession.status == VoteSessionStatus.OPEN,
        )
        .order_by(VoteSession.closes_at.asc())
    )

    result = await db.execute(query)
    participations = result.scalars().all()

    items = []
    for p in participations:
        vs = p.vote_session
        movie_options = vs.movie_options or []
        preview = movie_options[:3]

        items.append(
            PortalVoteSessionSummary(
                id=vs.id,
                name=vs.name,
                description=vs.description,
                movie_options_preview=preview,
                has_voted=p.has_voted,
                closes_at=vs.closes_at,
                status=vs.status.value if isinstance(vs.status, VoteSessionStatus) else vs.status,
            )
        )

    return PortalVoteListResponse(items=items, total=len(items))


@router.get(
    "/votes/{vote_session_id}",
    response_model=PortalVoteSessionDetail,
    summary="Get Vote Session Detail",
)
async def get_vote_detail(
    db: DbSession,
    user: CurrentUser,
    vote_session_id: str,
) -> PortalVoteSessionDetail:
    """Get detailed vote session info for a participant."""
    # Check if user is a participant
    result = await db.execute(
        select(VoteSessionParticipant)
        .options(selectinload(VoteSessionParticipant.vote_session))
        .where(
            VoteSessionParticipant.vote_session_id == vote_session_id,
            VoteSessionParticipant.user_id == user.id,
        )
    )
    participation = result.scalar_one_or_none()

    if not participation:
        raise NotFoundError("Vote session", vote_session_id)

    vs = participation.vote_session

    # Get user's vote if they voted
    my_vote_index = None
    if participation.has_voted:
        vote_result = await db.execute(
            select(Vote).where(
                Vote.vote_session_id == vote_session_id,
                Vote.voter_identifier == f"user:{user.id}",
            )
        )
        my_vote = vote_result.scalar_one_or_none()
        if my_vote:
            my_vote_index = my_vote.movie_index

    # Get results if allowed
    show_results = vs.show_results_during_voting or vs.status == VoteSessionStatus.CLOSED
    results = None
    if show_results:
        # Get vote counts
        votes_query = select(Vote).where(Vote.vote_session_id == vote_session_id)
        votes_result = await db.execute(votes_query)
        votes = votes_result.scalars().all()
        results = {}
        for vote in votes:
            results[vote.movie_index] = results.get(vote.movie_index, 0) + 1

    return PortalVoteSessionDetail(
        id=vs.id,
        name=vs.name,
        description=vs.description,
        movie_options=vs.movie_options or [],
        has_voted=participation.has_voted,
        my_vote_index=my_vote_index,
        show_results=show_results,
        results=results,
        closes_at=vs.closes_at,
        status=vs.status.value if isinstance(vs.status, VoteSessionStatus) else vs.status,
        is_open=vs.is_open,
    )


@router.post(
    "/votes/{vote_session_id}/cast",
    response_model=PortalVoteResponse,
    summary="Cast Vote",
)
async def cast_vote(
    db: DbSession,
    user: CurrentUser,
    vote_session_id: str,
    data: PortalVoteCast,
) -> PortalVoteResponse:
    """Cast a vote as an authenticated user."""
    # Check if user is a participant
    result = await db.execute(
        select(VoteSessionParticipant)
        .options(selectinload(VoteSessionParticipant.vote_session))
        .where(
            VoteSessionParticipant.vote_session_id == vote_session_id,
            VoteSessionParticipant.user_id == user.id,
        )
    )
    participation = result.scalar_one_or_none()

    if not participation:
        raise NotFoundError("Vote session", vote_session_id)

    vs = participation.vote_session

    # Check if voting is open
    if not vs.is_open:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Voting is not open",
        )

    # Check if already voted
    if participation.has_voted and not vs.allow_multiple_votes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already voted",
        )

    # Validate movie index
    movie_options = vs.movie_options or []
    if data.movie_index < 0 or data.movie_index >= len(movie_options):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid movie selection",
        )

    # Create vote
    vote = Vote(
        vote_session_id=vote_session_id,
        movie_index=data.movie_index,
        voter_identifier=f"user:{user.id}",
    )
    db.add(vote)

    # Update participation
    participation.has_voted = True
    participation.voted_at = datetime.now(timezone.utc)

    await db.commit()

    return PortalVoteResponse(
        success=True,
        movie_index=data.movie_index,
        vote_session_id=vote_session_id,
    )


# ============================================================================
# History endpoints
# ============================================================================


@router.get(
    "/history/sessions",
    summary="Get Session History",
)
async def get_session_history(
    db: DbSession,
    user: CurrentUser,
    skip: int = 0,
    limit: int = 20,
) -> dict:
    """Get past sessions the user participated in."""
    query = (
        select(SessionParticipant)
        .options(selectinload(SessionParticipant.session))
        .join(Session)
        .where(
            SessionParticipant.user_id == user.id,
            Session.status == SessionStatus.COMPLETED,
        )
        .order_by(Session.completed_at.desc())
        .offset(skip)
        .limit(limit)
    )

    result = await db.execute(query)
    participations = result.scalars().all()

    items = []
    for p in participations:
        session = p.session
        items.append(
            PortalHistorySessionItem(
                id=session.id,
                name=session.name,
                movie_title=session.movie_title,
                movie_poster_url=session.movie_poster_url,
                scheduled_at=session.scheduled_at,
                completed_at=session.completed_at,
                invitation_status=p.invitation_status,
            )
        )

    # Get total count
    count_query = (
        select(func.count(SessionParticipant.id))
        .join(Session)
        .where(
            SessionParticipant.user_id == user.id,
            Session.status == SessionStatus.COMPLETED,
        )
    )
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    return {"items": [item.model_dump() for item in items], "total": total}


@router.get(
    "/history/votes",
    summary="Get Vote History",
)
async def get_vote_history(
    db: DbSession,
    user: CurrentUser,
    skip: int = 0,
    limit: int = 20,
) -> dict:
    """Get past votes the user participated in."""
    query = (
        select(VoteSessionParticipant)
        .options(selectinload(VoteSessionParticipant.vote_session))
        .join(VoteSession)
        .where(
            VoteSessionParticipant.user_id == user.id,
            VoteSession.status == VoteSessionStatus.CLOSED,
        )
        .order_by(VoteSession.closed_at.desc())
        .offset(skip)
        .limit(limit)
    )

    result = await db.execute(query)
    participations = result.scalars().all()

    items = []
    for p in participations:
        vs = p.vote_session
        movie_options = vs.movie_options or []

        # Get the user's vote
        voted_movie_title = None
        voted_movie_poster_url = None
        if p.has_voted:
            vote_result = await db.execute(
                select(Vote).where(
                    Vote.vote_session_id == vs.id,
                    Vote.voter_identifier == f"user:{user.id}",
                )
            )
            my_vote = vote_result.scalar_one_or_none()
            if my_vote and my_vote.movie_index < len(movie_options):
                voted_movie = movie_options[my_vote.movie_index]
                voted_movie_title = voted_movie.get("title")
                voted_movie_poster_url = voted_movie.get("poster_url")

        # Get winner info
        winner_movie_title = None
        winner_movie_poster_url = None
        if vs.winning_movie_index is not None and vs.winning_movie_index < len(movie_options):
            winner_movie = movie_options[vs.winning_movie_index]
            winner_movie_title = winner_movie.get("title")
            winner_movie_poster_url = winner_movie.get("poster_url")

        items.append(
            PortalHistoryVoteItem(
                id=vs.id,
                name=vs.name,
                voted_movie_title=voted_movie_title,
                voted_movie_poster_url=voted_movie_poster_url,
                winner_movie_title=winner_movie_title,
                winner_movie_poster_url=winner_movie_poster_url,
                voted_at=p.voted_at,
                closed_at=vs.closed_at,
            )
        )

    # Get total count
    count_query = (
        select(func.count(VoteSessionParticipant.id))
        .join(VoteSession)
        .where(
            VoteSessionParticipant.user_id == user.id,
            VoteSession.status == VoteSessionStatus.CLOSED,
        )
    )
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    return {"items": [item.model_dump() for item in items], "total": total}
