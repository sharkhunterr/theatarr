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
        auto_accept_invitations=user.auto_accept_invitations,
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
        auto_accept_invitations=user.auto_accept_invitations,
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
    # Count pending votes from direct participation
    direct_pending_query = (
        select(func.count(VoteSessionParticipant.id))
        .join(VoteSession)
        .where(
            VoteSessionParticipant.user_id == user.id,
            VoteSessionParticipant.has_voted == False,
            VoteSession.status == VoteSessionStatus.OPEN,
        )
    )
    direct_pending_result = await db.execute(direct_pending_query)
    pending_votes = direct_pending_result.scalar() or 0

    # Also count pending votes from session-linked vote sessions
    # Only count if user has ACCEPTED the session invitation
    session_linked_query = (
        select(VoteSession.id)
        .join(Session, VoteSession.linked_session_id == Session.id)
        .join(SessionParticipant)
        .where(
            SessionParticipant.user_id == user.id,
            SessionParticipant.invitation_status == InvitationStatus.ACCEPTED.value,
            VoteSession.linked_session_id.isnot(None),
            VoteSession.status == VoteSessionStatus.OPEN,
        )
    )
    session_linked_result = await db.execute(session_linked_query)
    session_linked_vote_ids = [row[0] for row in session_linked_result.all()]

    # Check which session-linked votes user hasn't voted in
    for vs_id in session_linked_vote_ids:
        vote_check = await db.execute(
            select(Vote).where(
                Vote.vote_session_id == vs_id,
                Vote.voter_identifier == f"user:{user.id}",
            )
        )
        if vote_check.scalar_one_or_none() is None:
            pending_votes += 1

    # Count pending invitations
    pending_invitations_query = (
        select(func.count(SessionParticipant.id))
        .join(Session)
        .where(
            SessionParticipant.user_id == user.id,
            SessionParticipant.invitation_status == InvitationStatus.PENDING.value,
            Session.status.in_([SessionStatus.SCHEDULED.value, SessionStatus.DRAFT.value]),
        )
    )
    pending_invitations_result = await db.execute(pending_invitations_query)
    pending_invitations = pending_invitations_result.scalar() or 0

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

    # Count total votes cast by this user (using Vote table for accuracy)
    total_votes_query = select(func.count(Vote.id)).where(
        Vote.voter_identifier == f"user:{user.id}",
    )
    total_votes_result = await db.execute(total_votes_query)
    total_votes_cast = total_votes_result.scalar() or 0

    return PortalStatsResponse(
        pending_votes=pending_votes,
        pending_invitations=pending_invitations,
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
        # Check if linked vote session is open
        linked_vote_is_open = None
        if session.linked_vote_session_id:
            vote_result = await db.execute(
                select(VoteSession).where(VoteSession.id == session.linked_vote_session_id)
            )
            linked_vote = vote_result.scalar_one_or_none()
            if linked_vote:
                linked_vote_is_open = linked_vote.is_open

        items.append(
            PortalSessionSummary(
                id=session.id,
                name=session.name,
                movie_title=session.movie_title,
                movie_poster_url=session.movie_poster_url,
                status=session.status.value if isinstance(session.status, SessionStatus) else session.status,
                scheduled_at=session.scheduled_at,
                invitation_status=p.invitation_status,
                movie_selection_mode=session.movie_selection_mode,
                movie_resolved=session.movie_resolved,
                linked_vote_session_id=session.linked_vote_session_id,
                linked_vote_is_open=linked_vote_is_open,
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
    "/sessions/pending",
    response_model=PortalSessionListResponse,
    summary="Get Pending Session Invitations",
)
async def get_pending_invitations(
    db: DbSession,
    user: CurrentUser,
) -> PortalSessionListResponse:
    """Get sessions where the user has a pending invitation."""
    query = (
        select(SessionParticipant)
        .options(selectinload(SessionParticipant.session))
        .join(Session)
        .where(
            SessionParticipant.user_id == user.id,
            SessionParticipant.invitation_status == InvitationStatus.PENDING.value,
            Session.status.in_([SessionStatus.SCHEDULED.value, SessionStatus.DRAFT.value]),
        )
        .order_by(Session.scheduled_at.asc())
    )

    result = await db.execute(query)
    participations = result.scalars().all()

    items = []
    for p in participations:
        session = p.session
        # Check if linked vote session is open
        linked_vote_is_open = None
        if session.linked_vote_session_id:
            vote_result = await db.execute(
                select(VoteSession).where(VoteSession.id == session.linked_vote_session_id)
            )
            linked_vote = vote_result.scalar_one_or_none()
            if linked_vote:
                linked_vote_is_open = linked_vote.is_open

        items.append(
            PortalSessionSummary(
                id=session.id,
                name=session.name,
                movie_title=session.movie_title,
                movie_poster_url=session.movie_poster_url,
                status=session.status.value if isinstance(session.status, SessionStatus) else session.status,
                scheduled_at=session.scheduled_at,
                invitation_status=p.invitation_status,
                movie_selection_mode=session.movie_selection_mode,
                movie_resolved=session.movie_resolved,
                linked_vote_session_id=session.linked_vote_session_id,
                linked_vote_is_open=linked_vote_is_open,
            )
        )

    return PortalSessionListResponse(items=items, total=len(items))


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

    # Check if linked vote session is open
    linked_vote_is_open = None
    if session.linked_vote_session_id:
        vote_result = await db.execute(
            select(VoteSession).where(VoteSession.id == session.linked_vote_session_id)
        )
        linked_vote = vote_result.scalar_one_or_none()
        if linked_vote:
            linked_vote_is_open = linked_vote.is_open

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
        movie_selection_mode=session.movie_selection_mode,
        movie_resolved=session.movie_resolved,
        linked_vote_session_id=session.linked_vote_session_id,
        linked_vote_is_open=linked_vote_is_open,
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
    """Get vote sessions where the current user is a participant.

    This includes:
    1. Vote sessions where user is a direct participant
    2. Vote sessions linked to cinema sessions where user is a participant
    """
    # Get vote sessions from direct participation
    direct_query = (
        select(VoteSessionParticipant)
        .options(selectinload(VoteSessionParticipant.vote_session))
        .where(VoteSessionParticipant.user_id == user.id)
    )
    direct_result = await db.execute(direct_query)
    direct_participations = direct_result.scalars().all()

    # Get vote sessions linked to cinema sessions where user is a participant
    session_linked_query = (
        select(VoteSession)
        .join(Session, VoteSession.linked_session_id == Session.id)
        .join(SessionParticipant)
        .where(
            SessionParticipant.user_id == user.id,
            VoteSession.linked_session_id.isnot(None),
        )
    )
    session_linked_result = await db.execute(session_linked_query)
    session_linked_votes = session_linked_result.scalars().all()

    # Combine and deduplicate
    seen_vote_session_ids = set()
    items = []

    # Add direct participations
    for p in direct_participations:
        vs = p.vote_session
        if vs.id in seen_vote_session_ids:
            continue
        seen_vote_session_ids.add(vs.id)

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

    # Add session-linked vote sessions (where user may not be direct participant)
    for vs in session_linked_votes:
        if vs.id in seen_vote_session_ids:
            continue
        seen_vote_session_ids.add(vs.id)

        movie_options = vs.movie_options or []
        preview = movie_options[:3]

        # Check if user has voted in this session
        vote_check = await db.execute(
            select(Vote).where(
                Vote.vote_session_id == vs.id,
                Vote.voter_identifier == f"user:{user.id}",
            )
        )
        has_voted = vote_check.scalar_one_or_none() is not None

        items.append(
            PortalVoteSessionSummary(
                id=vs.id,
                name=vs.name,
                description=vs.description,
                movie_options_preview=preview,
                has_voted=has_voted,
                closes_at=vs.closes_at,
                status=vs.status.value if isinstance(vs.status, VoteSessionStatus) else vs.status,
            )
        )

    # Sort by created_at desc and paginate
    total = len(items)
    items = items[skip : skip + limit]

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
    """Get vote sessions where the user hasn't voted yet and voting is open.

    This includes:
    1. Vote sessions where user is a direct participant and hasn't voted
    2. Vote sessions linked to cinema sessions where user is a participant and hasn't voted
    """
    # Get pending from direct participation
    direct_query = (
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
    direct_result = await db.execute(direct_query)
    direct_participations = direct_result.scalars().all()

    # Get pending from session-linked votes
    # Only include if user has ACCEPTED the session invitation
    session_linked_query = (
        select(VoteSession)
        .join(Session, VoteSession.linked_session_id == Session.id)
        .join(SessionParticipant)
        .where(
            SessionParticipant.user_id == user.id,
            SessionParticipant.invitation_status == InvitationStatus.ACCEPTED.value,
            VoteSession.linked_session_id.isnot(None),
            VoteSession.status == VoteSessionStatus.OPEN,
        )
    )
    session_linked_result = await db.execute(session_linked_query)
    session_linked_votes = session_linked_result.scalars().all()

    # Combine and deduplicate
    seen_vote_session_ids = set()
    items = []

    for p in direct_participations:
        vs = p.vote_session
        if vs.id in seen_vote_session_ids:
            continue
        seen_vote_session_ids.add(vs.id)

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

    # Add session-linked where user hasn't voted
    for vs in session_linked_votes:
        if vs.id in seen_vote_session_ids:
            continue

        # Check if user has voted
        vote_check = await db.execute(
            select(Vote).where(
                Vote.vote_session_id == vs.id,
                Vote.voter_identifier == f"user:{user.id}",
            )
        )
        if vote_check.scalar_one_or_none() is not None:
            continue  # Already voted

        seen_vote_session_ids.add(vs.id)
        movie_options = vs.movie_options or []
        preview = movie_options[:3]

        items.append(
            PortalVoteSessionSummary(
                id=vs.id,
                name=vs.name,
                description=vs.description,
                movie_options_preview=preview,
                has_voted=False,
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
    """Get detailed vote session info for a participant.

    Access is allowed if user is:
    1. A direct vote session participant
    2. A participant in a cinema session linked to this vote session
    """
    # Check if user is a direct vote session participant
    result = await db.execute(
        select(VoteSessionParticipant)
        .options(selectinload(VoteSessionParticipant.vote_session))
        .where(
            VoteSessionParticipant.vote_session_id == vote_session_id,
            VoteSessionParticipant.user_id == user.id,
        )
    )
    participation = result.scalar_one_or_none()

    has_access = participation is not None
    vs = None

    if participation:
        vs = participation.vote_session
    else:
        # Check if vote session is linked to a session where user is a participant
        linked_result = await db.execute(
            select(VoteSession)
            .join(Session, VoteSession.linked_session_id == Session.id)
            .join(SessionParticipant)
            .where(
                VoteSession.id == vote_session_id,
                SessionParticipant.user_id == user.id,
            )
        )
        vs = linked_result.scalar_one_or_none()
        has_access = vs is not None

    if not has_access or not vs:
        raise NotFoundError("Vote session", vote_session_id)

    # Get user's vote if they voted
    vote_result = await db.execute(
        select(Vote).where(
            Vote.vote_session_id == vote_session_id,
            Vote.voter_identifier == f"user:{user.id}",
        )
    )
    my_vote = vote_result.scalar_one_or_none()
    my_vote_index = my_vote.movie_index if my_vote else None
    has_voted = my_vote is not None

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
        has_voted=has_voted,
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
    """Cast a vote as an authenticated user.

    Access is allowed if user is:
    1. A direct vote session participant
    2. A participant in a cinema session linked to this vote session
    """
    # Check if user is a direct vote session participant
    result = await db.execute(
        select(VoteSessionParticipant)
        .options(selectinload(VoteSessionParticipant.vote_session))
        .where(
            VoteSessionParticipant.vote_session_id == vote_session_id,
            VoteSessionParticipant.user_id == user.id,
        )
    )
    participation = result.scalar_one_or_none()

    vs = None
    is_session_linked_access = False

    if participation:
        vs = participation.vote_session
    else:
        # Check if vote session is linked to a session where user is a participant
        linked_result = await db.execute(
            select(VoteSession)
            .join(Session, VoteSession.linked_session_id == Session.id)
            .join(SessionParticipant)
            .where(
                VoteSession.id == vote_session_id,
                SessionParticipant.user_id == user.id,
            )
        )
        vs = linked_result.scalar_one_or_none()
        is_session_linked_access = vs is not None

    if not vs:
        raise NotFoundError("Vote session", vote_session_id)

    # Check if voting is open
    if not vs.is_open:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Voting is not open",
        )

    # Check if already voted
    existing_vote = await db.execute(
        select(Vote).where(
            Vote.vote_session_id == vote_session_id,
            Vote.voter_identifier == f"user:{user.id}",
        )
    )
    has_already_voted = existing_vote.scalar_one_or_none() is not None

    if has_already_voted and not vs.allow_multiple_votes:
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

    # Update direct participation if exists
    if participation:
        participation.has_voted = True
        participation.voted_at = datetime.now(timezone.utc)

    await db.commit()

    # Refresh vote session to get latest state
    await db.refresh(vs)

    # Check if we should auto-close when all have voted
    if vs.close_when_all_voted and vs.linked_session_id:
        # Count pending invitations - don't close if any are pending
        pending_count_result = await db.execute(
            select(func.count(SessionParticipant.id))
            .where(
                SessionParticipant.session_id == vs.linked_session_id,
                SessionParticipant.invitation_status == InvitationStatus.PENDING.value,
            )
        )
        pending_invitations = pending_count_result.scalar() or 0

        # Count expected voters from accepted participants
        participants_count_result = await db.execute(
            select(func.count(SessionParticipant.id))
            .where(
                SessionParticipant.session_id == vs.linked_session_id,
                SessionParticipant.invitation_status == InvitationStatus.ACCEPTED.value,
            )
        )
        expected_voters = participants_count_result.scalar() or 0

        # Count actual votes (unique voters)
        votes_count_result = await db.execute(
            select(func.count(func.distinct(Vote.voter_identifier)))
            .where(Vote.vote_session_id == vote_session_id)
        )
        actual_voters = votes_count_result.scalar() or 0

        # Close only if: no pending invitations AND all accepted have voted
        if pending_invitations == 0 and expected_voters > 0 and actual_voters >= expected_voters:
            vs.status = VoteSessionStatus.CLOSED
            vs.closed_at = datetime.now(timezone.utc)
            # Reload votes to determine winner
            votes_result = await db.execute(
                select(Vote).where(Vote.vote_session_id == vote_session_id)
            )
            votes = votes_result.scalars().all()
            # Calculate winner
            vote_counts: dict[int, int] = {}
            for v in votes:
                vote_counts[v.movie_index] = vote_counts.get(v.movie_index, 0) + 1
            if vote_counts:
                vs.winning_movie_index = max(vote_counts, key=lambda k: vote_counts[k])
            await db.commit()

            # Resolve movie for linked session
            from theatarr.services.movie_resolution import resolve_vote_winner, MovieResolutionError

            session_result = await db.execute(
                select(Session).where(Session.id == vs.linked_session_id)
            )
            linked_session = session_result.scalar_one_or_none()
            if linked_session and not linked_session.movie_resolved:
                try:
                    await resolve_vote_winner(db, linked_session, vs)
                except MovieResolutionError:
                    pass  # Ignore resolution errors

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
