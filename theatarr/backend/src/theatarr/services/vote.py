"""Vote service for Theatarr - handles vote token generation and vote management."""

import secrets
import string
from datetime import datetime, timezone
from hashlib import sha256

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from theatarr.models.vote import Vote, VoteSession, VoteSessionStatus, VoteToken


def generate_vote_token(length: int = 8) -> str:
    """Generate a short, URL-safe vote token.

    Uses uppercase letters and digits for easy typing/sharing.
    Excludes confusing characters (0/O, 1/I/L).
    """
    alphabet = "".join(
        c for c in string.ascii_uppercase + string.digits if c not in "0OIL1"
    )
    return "".join(secrets.choice(alphabet) for _ in range(length))


def hash_ip_address(ip: str, salt: str = "") -> str:
    """Create a hash of an IP address for anonymous tracking."""
    return sha256(f"{ip}:{salt}".encode()).hexdigest()[:16]


async def create_vote_tokens(
    db: AsyncSession,
    vote_session_id: str,
    count: int = 1,
    label_prefix: str | None = None,
    max_uses: int | None = None,
    expires_at: datetime | None = None,
) -> list[VoteToken]:
    """Create multiple vote tokens for a session.

    Args:
        db: Database session
        vote_session_id: ID of the vote session
        count: Number of tokens to create
        label_prefix: Optional prefix for token labels
        max_uses: Maximum uses per token (None for unlimited)
        expires_at: Token expiration time

    Returns:
        List of created VoteToken objects
    """
    tokens: list[VoteToken] = []

    for i in range(count):
        # Generate unique token
        token_value = generate_vote_token()

        # Ensure uniqueness
        while True:
            result = await db.execute(
                select(VoteToken).where(VoteToken.token == token_value)
            )
            if not result.scalar_one_or_none():
                break
            token_value = generate_vote_token()

        label = f"{label_prefix} {i + 1}" if label_prefix else None

        vote_token = VoteToken(
            vote_session_id=vote_session_id,
            token=token_value,
            label=label,
            max_uses=max_uses,
            expires_at=expires_at,
        )
        db.add(vote_token)
        tokens.append(vote_token)

    await db.commit()

    for token in tokens:
        await db.refresh(token)

    return tokens


async def validate_vote_token(
    db: AsyncSession,
    token: str,
    vote_session_id: str,
) -> VoteToken | None:
    """Validate a vote token.

    Args:
        db: Database session
        token: The token string to validate
        vote_session_id: Expected vote session ID

    Returns:
        The VoteToken if valid, None otherwise
    """
    result = await db.execute(
        select(VoteToken).where(
            VoteToken.token == token,
            VoteToken.vote_session_id == vote_session_id,
        )
    )
    vote_token = result.scalar_one_or_none()

    if not vote_token:
        return None

    if not vote_token.is_valid:
        return None

    return vote_token


async def cast_vote(
    db: AsyncSession,
    vote_session: VoteSession,
    movie_index: int,
    token: VoteToken | None = None,
    voter_identifier: str | None = None,
    user_agent: str | None = None,
    ip_hash: str | None = None,
) -> Vote:
    """Cast a vote in a vote session.

    Args:
        db: Database session
        vote_session: The vote session to vote in
        movie_index: Index of the movie being voted for
        token: Vote token used (if any)
        voter_identifier: Anonymous voter identifier
        user_agent: User agent string
        ip_hash: Hashed IP address

    Returns:
        The created Vote object

    Raises:
        ValueError: If voting conditions are not met
    """
    # Validate vote session is open
    if not vote_session.is_open:
        raise ValueError("Voting is not currently open")

    # Validate movie index
    if vote_session.movie_options is None:
        raise ValueError("No movie options available")

    if movie_index < 0 or movie_index >= len(vote_session.movie_options):
        raise ValueError(f"Invalid movie index: {movie_index}")

    # Check existing votes
    if token:
        # Check votes by token
        result = await db.execute(
            select(Vote).where(
                Vote.vote_session_id == vote_session.id,
                Vote.token_id == token.id,
            )
        )
        existing_votes = result.scalars().all()

        if existing_votes:
            if not vote_session.allow_multiple_votes:
                raise ValueError("You have already voted")

            if len(existing_votes) >= vote_session.max_votes_per_user:
                raise ValueError(
                    f"Maximum votes ({vote_session.max_votes_per_user}) reached"
                )

    elif voter_identifier:
        # Check votes by identifier
        result = await db.execute(
            select(Vote).where(
                Vote.vote_session_id == vote_session.id,
                Vote.voter_identifier == voter_identifier,
            )
        )
        existing_votes = result.scalars().all()

        if existing_votes:
            if not vote_session.allow_multiple_votes:
                raise ValueError("You have already voted")

            if len(existing_votes) >= vote_session.max_votes_per_user:
                raise ValueError(
                    f"Maximum votes ({vote_session.max_votes_per_user}) reached"
                )

    # Get movie ID if available
    movie_id = None
    if vote_session.movie_options and movie_index < len(vote_session.movie_options):
        movie_id = vote_session.movie_options[movie_index].get("movie_id")

    # Create vote
    vote = Vote(
        vote_session_id=vote_session.id,
        movie_index=movie_index,
        movie_id=movie_id,
        token_id=token.id if token else None,
        voter_identifier=voter_identifier,
        user_agent=user_agent[:500] if user_agent else None,
        ip_hash=ip_hash,
    )
    db.add(vote)

    # Update token usage
    if token:
        token.use_count += 1
        token.last_used_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(vote)

    return vote


async def close_voting(
    db: AsyncSession,
    vote_session: VoteSession,
    assign_winner: bool = True,
    auto_resolve_linked: bool = True,
) -> VoteSession:
    """Close a vote session and optionally determine the winner.

    Args:
        db: Database session
        vote_session: The vote session to close
        assign_winner: Whether to determine and assign the winner
        auto_resolve_linked: Whether to auto-resolve linked session movie

    Returns:
        Updated VoteSession
    """
    vote_session.status = VoteSessionStatus.CLOSED
    vote_session.closed_at = datetime.now(timezone.utc)

    if assign_winner:
        winner_index = vote_session.determine_winner()
        vote_session.winning_movie_index = winner_index

        # Get movie ID if available
        if (
            winner_index is not None
            and vote_session.movie_options
            and winner_index < len(vote_session.movie_options)
        ):
            movie_id = vote_session.movie_options[winner_index].get("movie_id")
            if movie_id:
                vote_session.winner_movie_id = movie_id

    await db.commit()
    await db.refresh(vote_session)

    # Auto-resolve linked session movie if enabled
    if assign_winner and auto_resolve_linked and vote_session.linked_session_id:
        from theatarr.models.session import Session
        from theatarr.services.movie_resolution import (
            resolve_vote_winner,
            MovieResolutionError,
        )

        result = await db.execute(
            select(Session).where(Session.id == vote_session.linked_session_id)
        )
        linked_session = result.scalar_one_or_none()

        if linked_session and not linked_session.movie_resolved:
            try:
                await resolve_vote_winner(db, linked_session, vote_session)
            except MovieResolutionError as e:
                # Log but don't fail the close operation
                import logging
                logging.getLogger(__name__).warning(
                    f"Failed to auto-resolve movie for session {linked_session.id}: {e}"
                )

    return vote_session


async def open_voting(
    db: AsyncSession,
    vote_session: VoteSession,
) -> VoteSession:
    """Open a vote session for voting.

    Args:
        db: Database session
        vote_session: The vote session to open

    Returns:
        Updated VoteSession
    """
    if vote_session.status not in [VoteSessionStatus.DRAFT, VoteSessionStatus.CLOSED]:
        raise ValueError(f"Cannot open session in {vote_session.status} status")

    vote_session.status = VoteSessionStatus.OPEN
    vote_session.closed_at = None
    vote_session.winning_movie_index = None
    vote_session.winner_movie_id = None

    await db.commit()
    await db.refresh(vote_session)

    return vote_session


async def get_vote_results(
    db: AsyncSession,
    vote_session: VoteSession,
) -> dict:
    """Get current vote results for a session.

    Args:
        db: Database session
        vote_session: The vote session

    Returns:
        Dictionary with vote counts and statistics
    """
    # Load votes if not loaded
    result = await db.execute(
        select(Vote).where(Vote.vote_session_id == vote_session.id)
    )
    votes = result.scalars().all()

    vote_counts: dict[int, int] = {}
    for vote in votes:
        vote_counts[vote.movie_index] = vote_counts.get(vote.movie_index, 0) + 1

    total_votes = len(votes)
    winner_index = max(vote_counts, key=lambda k: vote_counts[k]) if vote_counts else None

    return {
        "vote_session_id": vote_session.id,
        "total_votes": total_votes,
        "vote_counts": vote_counts,
        "winner_index": winner_index,
        "is_open": vote_session.is_open,
    }
