"""Vote API router for Theatarr."""

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Header, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from theatarr.api.deps import AdminUser
from theatarr.api.errors import NotFoundError
from theatarr.api.ws import ws_manager, Channel
from theatarr.config import settings
from theatarr.database import DbSession
from theatarr.models.session import Session
from theatarr.models.session_participant import InvitationStatus, SessionParticipant
from theatarr.models.vote import Vote, VoteSession, VoteSessionStatus, VoteToken
from theatarr.schemas.vote import (
    VoteCast,
    VoteResponse,
    VoteResultsResponse,
    VoteSessionCreate,
    VoteSessionListResponse,
    VoteSessionPublicResponse,
    VoteSessionResponse,
    VoteSessionUpdate,
    VoteTokenCreate,
    VoteTokenListResponse,
    VoteTokenResponse,
)
from theatarr.services.vote import (
    cast_vote,
    close_voting,
    create_vote_tokens,
    get_vote_results,
    hash_ip_address,
    open_voting,
    validate_vote_token,
)

router = APIRouter(tags=["Votes"])


def _vote_session_to_response(
    vs: VoteSession,
    linked_session_name: str | None = None,
) -> VoteSessionResponse:
    """Convert VoteSession model to response schema."""
    return VoteSessionResponse(
        id=vs.id,
        name=vs.name,
        description=vs.description,
        status=vs.status.value if isinstance(vs.status, VoteSessionStatus) else vs.status,
        movie_options=vs.movie_options,
        max_votes_per_user=vs.max_votes_per_user,
        allow_multiple_votes=vs.allow_multiple_votes,
        require_token=vs.require_token,
        show_results_during_voting=vs.show_results_during_voting,
        anonymous_voting=vs.anonymous_voting,
        close_when_all_voted=vs.close_when_all_voted,
        opens_at=vs.opens_at,
        closes_at=vs.closes_at,
        closed_at=vs.closed_at,
        winner_movie_id=vs.winner_movie_id,
        winning_movie_index=vs.winning_movie_index,
        target_session_id=vs.target_session_id,
        total_votes=vs.total_votes,
        is_open=vs.is_open,
        created_at=vs.created_at,
        updated_at=vs.updated_at,
        linked_session_id=vs.linked_session_id,
        linked_session_name=linked_session_name,
    )


def _token_to_response(token: VoteToken, base_url: str = "") -> VoteTokenResponse:
    """Convert VoteToken model to response schema."""
    vote_url = f"{base_url}/vote/{token.token}" if base_url else None
    return VoteTokenResponse(
        id=token.id,
        token=token.token,
        label=token.label,
        max_uses=token.max_uses,
        use_count=token.use_count,
        is_active=token.is_active,
        is_valid=token.is_valid,
        expires_at=token.expires_at,
        last_used_at=token.last_used_at,
        vote_url=vote_url,
    )


# ============================================================================
# Admin Routes (require authentication)
# ============================================================================


@router.get(
    "/vote-sessions",
    response_model=VoteSessionListResponse,
    summary="List Vote Sessions",
)
async def list_vote_sessions(
    db: DbSession,
    user: AdminUser,
    status_filter: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> VoteSessionListResponse:
    """List all vote sessions (admin only)."""
    # Use outerjoin to fetch linked session names
    from sqlalchemy.orm import aliased
    LinkedSession = aliased(Session)

    query = (
        select(VoteSession, LinkedSession.name.label("linked_session_name"))
        .outerjoin(LinkedSession, VoteSession.linked_session_id == LinkedSession.id)
        .options(selectinload(VoteSession.votes))
    )

    if status_filter:
        query = query.where(VoteSession.status == status_filter)

    query = query.order_by(VoteSession.created_at.desc())
    query = query.limit(limit).offset(offset)

    result = await db.execute(query)
    rows = result.all()

    # Get total count
    count_query = select(VoteSession)
    if status_filter:
        count_query = count_query.where(VoteSession.status == status_filter)
    count_result = await db.execute(count_query)
    total = len(count_result.scalars().all())

    return VoteSessionListResponse(
        items=[_vote_session_to_response(vs, linked_session_name) for vs, linked_session_name in rows],
        total=total,
    )


@router.post(
    "/vote-sessions",
    response_model=VoteSessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Vote Session",
)
async def create_vote_session(
    db: DbSession,
    user: AdminUser,
    data: VoteSessionCreate,
) -> VoteSessionResponse:
    """Create a new vote session (admin only)."""
    # Determine initial status based on open_immediately
    initial_status = VoteSessionStatus.OPEN if data.open_immediately else VoteSessionStatus.DRAFT

    vote_session = VoteSession(
        name=data.name,
        description=data.description,
        status=initial_status,
        movie_options=[opt.model_dump() for opt in data.movie_options],
        max_votes_per_user=data.max_votes_per_user,
        allow_multiple_votes=data.allow_multiple_votes,
        require_token=data.require_token,
        show_results_during_voting=data.show_results_during_voting,
        anonymous_voting=data.anonymous_voting,
        close_when_all_voted=data.close_when_all_voted,
        opens_at=data.opens_at,
        closes_at=data.closes_at,
        target_session_id=data.target_session_id,
        created_by=user.id,
    )
    db.add(vote_session)
    await db.commit()

    # Re-fetch with votes relationship loaded
    result = await db.execute(
        select(VoteSession)
        .options(selectinload(VoteSession.votes))
        .where(VoteSession.id == vote_session.id)
    )
    vote_session = result.scalar_one()

    return _vote_session_to_response(vote_session)


@router.get(
    "/vote-sessions/{session_id}",
    response_model=VoteSessionResponse,
    summary="Get Vote Session",
)
async def get_vote_session(
    db: DbSession,
    user: AdminUser,
    session_id: str,
) -> VoteSessionResponse:
    """Get a vote session by ID (admin only)."""
    from sqlalchemy.orm import aliased
    LinkedSession = aliased(Session)

    result = await db.execute(
        select(VoteSession, LinkedSession.name.label("linked_session_name"))
        .outerjoin(LinkedSession, VoteSession.linked_session_id == LinkedSession.id)
        .options(selectinload(VoteSession.votes))
        .where(VoteSession.id == session_id)
    )
    row = result.one_or_none()

    if not row:
        raise NotFoundError("VoteSession", session_id)

    vote_session, linked_session_name = row
    return _vote_session_to_response(vote_session, linked_session_name)


@router.patch(
    "/vote-sessions/{session_id}",
    response_model=VoteSessionResponse,
    summary="Update Vote Session",
)
async def update_vote_session(
    db: DbSession,
    user: AdminUser,
    session_id: str,
    data: VoteSessionUpdate,
) -> VoteSessionResponse:
    """Update a vote session (admin only)."""
    result = await db.execute(
        select(VoteSession)
        .options(selectinload(VoteSession.votes))
        .where(VoteSession.id == session_id)
    )
    vote_session = result.scalar_one_or_none()

    if not vote_session:
        raise NotFoundError("VoteSession", session_id)

    update_data = data.model_dump(exclude_unset=True)

    # Handle movie_options specially
    if "movie_options" in update_data:
        update_data["movie_options"] = [
            opt.model_dump() if hasattr(opt, "model_dump") else opt
            for opt in update_data["movie_options"]
        ]

    for field, value in update_data.items():
        setattr(vote_session, field, value)

    await db.commit()

    # Re-fetch with votes relationship loaded
    result = await db.execute(
        select(VoteSession)
        .options(selectinload(VoteSession.votes))
        .where(VoteSession.id == session_id)
    )
    vote_session = result.scalar_one()

    return _vote_session_to_response(vote_session)


@router.delete(
    "/vote-sessions/{session_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Vote Session",
)
async def delete_vote_session(
    db: DbSession,
    user: AdminUser,
    session_id: str,
) -> None:
    """Delete a vote session (admin only)."""
    result = await db.execute(
        select(VoteSession).where(VoteSession.id == session_id)
    )
    vote_session = result.scalar_one_or_none()

    if not vote_session:
        raise NotFoundError("VoteSession", session_id)

    await db.delete(vote_session)
    await db.commit()


@router.post(
    "/vote-sessions/{session_id}/open",
    response_model=VoteSessionResponse,
    summary="Open Vote Session",
)
async def open_vote_session(
    db: DbSession,
    user: AdminUser,
    session_id: str,
) -> VoteSessionResponse:
    """Open a vote session for voting (admin only)."""
    result = await db.execute(
        select(VoteSession)
        .options(selectinload(VoteSession.votes))
        .where(VoteSession.id == session_id)
    )
    vote_session = result.scalar_one_or_none()

    if not vote_session:
        raise NotFoundError("VoteSession", session_id)

    try:
        vote_session = await open_voting(db, vote_session)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    # Fire-and-forget email notifications for vote participants
    import asyncio
    from theatarr.models.vote_session_participant import VoteSessionParticipant
    from theatarr.models.user import User
    from theatarr.services.email import notify_vote_invitation

    # Collect all participant user IDs (direct + session-linked)
    notify_user_ids: set[str] = set()
    part_result = await db.execute(
        select(VoteSessionParticipant.user_id)
        .where(VoteSessionParticipant.vote_session_id == session_id)
    )
    for row in part_result.all():
        notify_user_ids.add(row[0])

    if vote_session.linked_session_id:
        from theatarr.models.session_participant import SessionParticipant
        sp_result = await db.execute(
            select(SessionParticipant.user_id)
            .where(SessionParticipant.session_id == vote_session.linked_session_id)
        )
        for row in sp_result.all():
            notify_user_ids.add(row[0])

    for uid in notify_user_ids:
        u_result = await db.execute(select(User).where(User.id == uid))
        u = u_result.scalar_one_or_none()
        if u and u.email:
            asyncio.create_task(notify_vote_invitation(
                u, vote_session.name, vote_session.id, vote_session.closes_at,
            ))

    return _vote_session_to_response(vote_session)


@router.post(
    "/vote-sessions/{session_id}/close",
    response_model=VoteSessionResponse,
    summary="Close Vote Session",
)
async def close_vote_session(
    db: DbSession,
    user: AdminUser,
    session_id: str,
    assign_winner: bool = True,
) -> VoteSessionResponse:
    """Close a vote session (admin only)."""
    result = await db.execute(
        select(VoteSession)
        .options(selectinload(VoteSession.votes))
        .where(VoteSession.id == session_id)
    )
    vote_session = result.scalar_one_or_none()

    if not vote_session:
        raise NotFoundError("VoteSession", session_id)

    # Store linked session ID before closing (it may auto-resolve)
    linked_session_id = vote_session.linked_session_id

    vote_session = await close_voting(db, vote_session, assign_winner)

    # Broadcast vote closed results
    results = await get_vote_results(db, vote_session)
    await ws_manager.broadcast(
        Channel.VOTE.value,
        {
            "type": "vote_closed",
            "payload": {
                "vote_session_id": vote_session.id,
                "results": results,
            },
        },
    )

    # If linked to a session and movie was resolved, broadcast movie_resolved
    if linked_session_id and assign_winner:
        from theatarr.models.session import Session

        session_result = await db.execute(
            select(Session).where(Session.id == linked_session_id)
        )
        linked_session = session_result.scalar_one_or_none()

        if linked_session and linked_session.movie_resolved:
            await ws_manager.broadcast(
                Channel.SESSION.value,
                {
                    "type": "movie_resolved",
                    "payload": {
                        "session_id": linked_session.id,
                        "movie_title": linked_session.movie_title,
                        "movie_poster_url": linked_session.movie_poster_url,
                        "selection_mode": "vote",
                        "vote_session_id": vote_session.id,
                    },
                },
            )

    return _vote_session_to_response(vote_session)


@router.post(
    "/vote-sessions/{session_id}/check-close",
    response_model=VoteSessionResponse,
    summary="Check and Close Vote Session",
)
async def check_and_close_vote_session(
    db: DbSession,
    user: AdminUser,
    session_id: str,
) -> VoteSessionResponse:
    """Check if all participants have voted and close if so (admin only)."""
    result = await db.execute(
        select(VoteSession)
        .options(selectinload(VoteSession.votes))
        .where(VoteSession.id == session_id)
    )
    vote_session = result.scalar_one_or_none()

    if not vote_session:
        raise NotFoundError("VoteSession", session_id)

    if vote_session.status != VoteSessionStatus.OPEN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Vote session is not open (status: {vote_session.status})",
        )

    if not vote_session.linked_session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vote session is not linked to a cinema session",
        )

    # Count expected voters from linked session participants
    participants_count_result = await db.execute(
        select(func.count(SessionParticipant.id))
        .where(
            SessionParticipant.session_id == vote_session.linked_session_id,
            SessionParticipant.invitation_status == InvitationStatus.ACCEPTED.value,
        )
    )
    expected_voters = participants_count_result.scalar() or 0

    # Count actual votes (unique voters)
    votes_count_result = await db.execute(
        select(func.count(func.distinct(Vote.voter_identifier)))
        .where(Vote.vote_session_id == session_id)
    )
    actual_voters = votes_count_result.scalar() or 0

    if actual_voters < expected_voters:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Not all participants have voted ({actual_voters}/{expected_voters})",
        )

    # Close the vote
    vote_session = await close_voting(db, vote_session, assign_winner=True)

    # Broadcast vote closed results
    results = await get_vote_results(db, vote_session)
    await ws_manager.broadcast(
        Channel.VOTE.value,
        {
            "type": "vote_closed",
            "payload": {
                "vote_session_id": vote_session.id,
                "results": results,
            },
        },
    )

    return _vote_session_to_response(vote_session)


@router.get(
    "/vote-sessions/{session_id}/results",
    response_model=VoteResultsResponse,
    summary="Get Vote Results",
)
async def get_vote_session_results(
    db: DbSession,
    user: AdminUser,
    session_id: str,
) -> VoteResultsResponse:
    """Get vote results for a session (admin only)."""
    result = await db.execute(
        select(VoteSession).where(VoteSession.id == session_id)
    )
    vote_session = result.scalar_one_or_none()

    if not vote_session:
        raise NotFoundError("VoteSession", session_id)

    results = await get_vote_results(db, vote_session)
    return VoteResultsResponse(**results)


@router.post(
    "/vote-sessions/{session_id}/tokens",
    response_model=VoteTokenListResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Vote Tokens",
)
async def create_tokens(
    db: DbSession,
    user: AdminUser,
    request: Request,
    session_id: str,
    data: VoteTokenCreate,
) -> VoteTokenListResponse:
    """Create vote tokens for a session (admin only)."""
    result = await db.execute(
        select(VoteSession).where(VoteSession.id == session_id)
    )
    vote_session = result.scalar_one_or_none()

    if not vote_session:
        raise NotFoundError("VoteSession", session_id)

    tokens = await create_vote_tokens(
        db,
        session_id,
        count=data.count,
        label_prefix=data.label_prefix,
        max_uses=data.max_uses,
        expires_at=data.expires_at,
    )

    base_url = str(request.base_url).rstrip("/")

    return VoteTokenListResponse(
        items=[_token_to_response(t, base_url) for t in tokens],
        total=len(tokens),
    )


@router.get(
    "/vote-sessions/{session_id}/tokens",
    response_model=VoteTokenListResponse,
    summary="List Vote Tokens",
)
async def list_tokens(
    db: DbSession,
    user: AdminUser,
    request: Request,
    session_id: str,
) -> VoteTokenListResponse:
    """List all tokens for a vote session (admin only)."""
    result = await db.execute(
        select(VoteToken).where(VoteToken.vote_session_id == session_id)
    )
    tokens = result.scalars().all()

    base_url = str(request.base_url).rstrip("/")

    return VoteTokenListResponse(
        items=[_token_to_response(t, base_url) for t in tokens],
        total=len(tokens),
    )


@router.delete(
    "/vote-sessions/{session_id}/tokens/{token_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Vote Token",
)
async def delete_token(
    db: DbSession,
    user: AdminUser,
    session_id: str,
    token_id: str,
) -> None:
    """Delete a vote token (admin only)."""
    result = await db.execute(
        select(VoteToken).where(
            VoteToken.id == token_id,
            VoteToken.vote_session_id == session_id,
        )
    )
    token = result.scalar_one_or_none()

    if not token:
        raise NotFoundError("VoteToken", token_id)

    await db.delete(token)
    await db.commit()


# ============================================================================
# Vote Session Participants endpoints
# ============================================================================


@router.get(
    "/vote-sessions/{session_id}/participants",
    summary="List Vote Session Participants",
)
async def list_vote_participants(
    db: DbSession,
    user: AdminUser,
    session_id: str,
) -> dict:
    """List all participants for a vote session."""
    from theatarr.models.vote_session_participant import VoteSessionParticipant
    from theatarr.models.user import User

    # Check vote session exists
    result = await db.execute(select(VoteSession).where(VoteSession.id == session_id))
    vote_session = result.scalar_one_or_none()
    if not vote_session:
        raise NotFoundError("VoteSession", session_id)

    # Get participants with user info
    query = (
        select(VoteSessionParticipant, User)
        .join(User)
        .where(VoteSessionParticipant.vote_session_id == session_id)
        .order_by(VoteSessionParticipant.invited_at.desc())
    )
    result = await db.execute(query)
    rows = result.all()

    items = []
    for participant, participant_user in rows:
        items.append({
            "id": participant.id,
            "user_id": participant.user_id,
            "username": participant_user.username,
            "first_name": participant_user.first_name,
            "last_name": participant_user.last_name,
            "email": participant_user.email,
            "has_voted": participant.has_voted,
            "invited_at": participant.invited_at.isoformat() if participant.invited_at else None,
            "voted_at": participant.voted_at.isoformat() if participant.voted_at else None,
        })

    return {"items": items, "total": len(items)}


@router.post(
    "/vote-sessions/{session_id}/participants",
    status_code=status.HTTP_201_CREATED,
    summary="Add Vote Session Participants",
)
async def add_vote_participants(
    db: DbSession,
    user: AdminUser,
    session_id: str,
    user_ids: list[str],
) -> dict:
    """Add participants to a vote session."""
    from datetime import datetime, timezone
    from theatarr.models.vote_session_participant import VoteSessionParticipant
    from theatarr.models.user import User

    # Check vote session exists
    result = await db.execute(select(VoteSession).where(VoteSession.id == session_id))
    vote_session = result.scalar_one_or_none()
    if not vote_session:
        raise NotFoundError("VoteSession", session_id)

    added = []
    for uid in user_ids:
        # Check user exists
        user_result = await db.execute(select(User).where(User.id == uid))
        target_user = user_result.scalar_one_or_none()
        if not target_user:
            continue

        # Check if already a participant
        existing = await db.execute(
            select(VoteSessionParticipant).where(
                VoteSessionParticipant.vote_session_id == session_id,
                VoteSessionParticipant.user_id == uid,
            )
        )
        if existing.scalar_one_or_none():
            continue

        # Create participant
        participant = VoteSessionParticipant(
            vote_session_id=session_id,
            user_id=uid,
            has_voted=False,
            invited_at=datetime.now(timezone.utc),
        )
        db.add(participant)
        added.append(uid)

    await db.commit()

    # Fire-and-forget email notifications for vote participants
    if added and vote_session.status == VoteSessionStatus.OPEN:
        import asyncio
        from theatarr.services.email import notify_vote_invitation
        for uid in added:
            u_result = await db.execute(select(User).where(User.id == uid))
            u = u_result.scalar_one_or_none()
            if u and u.email:
                asyncio.create_task(notify_vote_invitation(
                    u, vote_session.name, vote_session.id, vote_session.closes_at,
                ))

    return {"added": added, "count": len(added)}


@router.delete(
    "/vote-sessions/{session_id}/participants/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove Vote Session Participant",
)
async def remove_vote_participant(
    db: DbSession,
    user: AdminUser,
    session_id: str,
    user_id: str,
) -> None:
    """Remove a participant from a vote session."""
    from theatarr.models.vote_session_participant import VoteSessionParticipant

    result = await db.execute(
        select(VoteSessionParticipant).where(
            VoteSessionParticipant.vote_session_id == session_id,
            VoteSessionParticipant.user_id == user_id,
        )
    )
    participant = result.scalar_one_or_none()

    if not participant:
        raise NotFoundError("Vote session participant", f"{session_id}/{user_id}")

    await db.delete(participant)
    await db.commit()


# ============================================================================
# Public Routes (for voters)
# ============================================================================


@router.get(
    "/vote/{token}",
    response_model=VoteSessionPublicResponse,
    summary="Get Vote Session (Public)",
)
async def get_public_vote_session(
    db: DbSession,
    token: str,
) -> VoteSessionPublicResponse:
    """Get vote session info using a vote token (public)."""
    # Find token
    result = await db.execute(
        select(VoteToken).where(VoteToken.token == token)
    )
    vote_token = result.scalar_one_or_none()

    if not vote_token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid vote token",
        )

    if not vote_token.is_valid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vote token is no longer valid",
        )

    # Get vote session
    result = await db.execute(
        select(VoteSession).where(VoteSession.id == vote_token.vote_session_id)
    )
    vote_session = result.scalar_one_or_none()

    if not vote_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vote session not found",
        )

    # Get results if allowed
    results = None
    if vote_session.show_results_during_voting:
        results_data = await get_vote_results(db, vote_session)
        results = results_data["vote_counts"]

    return VoteSessionPublicResponse(
        id=vote_session.id,
        name=vote_session.name,
        description=vote_session.description,
        movie_options=vote_session.movie_options,
        is_open=vote_session.is_open,
        show_results_during_voting=vote_session.show_results_during_voting,
        allow_multiple_votes=vote_session.allow_multiple_votes,
        max_votes_per_user=vote_session.max_votes_per_user,
        closes_at=vote_session.closes_at,
        results=results,
    )


@router.post(
    "/vote/{token}",
    response_model=VoteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Cast Vote (Public)",
)
async def cast_public_vote(
    db: DbSession,
    request: Request,
    token: str,
    data: VoteCast,
    user_agent: str | None = Header(default=None),
) -> VoteResponse:
    """Cast a vote using a vote token (public)."""
    # Find and validate token
    result = await db.execute(
        select(VoteToken).where(VoteToken.token == token)
    )
    vote_token = result.scalar_one_or_none()

    if not vote_token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid vote token",
        )

    if not vote_token.is_valid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vote token is no longer valid",
        )

    # Get vote session
    result = await db.execute(
        select(VoteSession).where(VoteSession.id == vote_token.vote_session_id)
    )
    vote_session = result.scalar_one_or_none()

    if not vote_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vote session not found",
        )

    # Get client IP hash for anonymized tracking
    client_ip = request.client.host if request.client else "unknown"
    ip_hash = hash_ip_address(client_ip, vote_session.id)

    try:
        vote = await cast_vote(
            db,
            vote_session,
            movie_index=data.movie_index,
            token=vote_token,
            voter_identifier=f"token:{vote_token.id}",
            user_agent=user_agent,
            ip_hash=ip_hash,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    # Broadcast vote update
    if vote_session.show_results_during_voting:
        results = await get_vote_results(db, vote_session)
        await ws_manager.broadcast(
            Channel.VOTE.value,
            {
                "type": "vote_cast",
                "payload": {
                    "vote_session_id": vote_session.id,
                    "results": results,
                },
            },
        )

    return VoteResponse(
        id=vote.id,
        movie_index=vote.movie_index,
        created_at=vote.created_at,
    )
