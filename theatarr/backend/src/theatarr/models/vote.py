"""Vote models for Theatarr - movie voting system."""

from datetime import datetime, timezone
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, Index
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from theatarr.database import Base
from theatarr.models.base import TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from theatarr.models.movie import Movie
    from theatarr.models.session import Session


class VoteSessionStatus(str, Enum):
    """Vote session status."""

    DRAFT = "draft"
    OPEN = "open"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class VoteSession(Base, UUIDMixin, TimestampMixin):
    """Vote session model for collecting movie votes.

    A vote session allows users to vote on which movie to watch.
    Votes can be anonymous or require tokens.
    """

    __tablename__ = "vote_sessions"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[VoteSessionStatus] = mapped_column(
        String(20),
        default=VoteSessionStatus.DRAFT,
        nullable=False,
    )

    # Movie options (stored as JSON array of movie info)
    movie_options: Mapped[list | None] = mapped_column(JSON, nullable=True)

    # Voting configuration
    max_votes_per_user: Mapped[int] = mapped_column(Integer, default=1)
    allow_multiple_votes: Mapped[bool] = mapped_column(Boolean, default=False)
    require_token: Mapped[bool] = mapped_column(Boolean, default=True)
    show_results_during_voting: Mapped[bool] = mapped_column(Boolean, default=False)
    anonymous_voting: Mapped[bool] = mapped_column(Boolean, default=True)

    # Timing
    opens_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closes_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Results
    winner_movie_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("movies.id", ondelete="SET NULL"),
        nullable=True,
    )
    winning_movie_index: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Link to session that will use the winner (legacy field)
    target_session_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("sessions.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Bidirectional link to session using vote mode
    linked_session_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("sessions.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Owner
    created_by: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    votes: Mapped[list["Vote"]] = relationship(
        "Vote",
        back_populates="vote_session",
        cascade="all, delete-orphan",
    )
    tokens: Mapped[list["VoteToken"]] = relationship(
        "VoteToken",
        back_populates="vote_session",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("idx_vote_sessions_status", "status"),
        Index("idx_vote_sessions_closes_at", "closes_at"),
    )

    @property
    def is_open(self) -> bool:
        """Check if voting is currently open."""
        if self.status != VoteSessionStatus.OPEN:
            return False

        now = datetime.now(timezone.utc)

        # Handle timezone-naive datetimes by treating them as UTC
        if self.opens_at:
            opens_at = self.opens_at if self.opens_at.tzinfo else self.opens_at.replace(tzinfo=timezone.utc)
            if now < opens_at:
                return False

        if self.closes_at:
            closes_at = self.closes_at if self.closes_at.tzinfo else self.closes_at.replace(tzinfo=timezone.utc)
            if now > closes_at:
                return False

        return True

    @property
    def total_votes(self) -> int:
        """Get total number of votes cast."""
        return len(self.votes) if self.votes else 0

    def get_vote_counts(self) -> dict[int, int]:
        """Get vote counts per movie option index."""
        counts: dict[int, int] = {}
        if self.votes:
            for vote in self.votes:
                counts[vote.movie_index] = counts.get(vote.movie_index, 0) + 1
        return counts

    def determine_winner(self) -> int | None:
        """Determine the winning movie index based on votes."""
        counts = self.get_vote_counts()
        if not counts:
            return None

        return max(counts, key=lambda k: counts[k])


class Vote(Base, UUIDMixin, TimestampMixin):
    """Individual vote in a vote session."""

    __tablename__ = "votes"

    vote_session_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("vote_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Which movie was voted for (index into movie_options)
    movie_index: Mapped[int] = mapped_column(Integer, nullable=False)

    # Optional movie ID if movie exists in database
    movie_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("movies.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Token used (if any)
    token_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("vote_tokens.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Voter identification (anonymized or user ID)
    voter_identifier: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Metadata
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    ip_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # Relationships
    vote_session: Mapped["VoteSession"] = relationship(
        "VoteSession",
        back_populates="votes",
    )
    token: Mapped["VoteToken | None"] = relationship(
        "VoteToken",
        back_populates="votes",
    )

    __table_args__ = (
        Index("idx_votes_session_id", "vote_session_id"),
        Index("idx_votes_token_id", "token_id"),
        Index("idx_votes_movie_index", "movie_index"),
    )


class VoteToken(Base, UUIDMixin, TimestampMixin):
    """Token for accessing a vote session."""

    __tablename__ = "vote_tokens"

    vote_session_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("vote_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Token value (short code for sharing)
    token: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)

    # Optional label (e.g., "Living Room TV", "Guest 1")
    label: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Usage tracking
    max_uses: Mapped[int | None] = mapped_column(Integer, nullable=True)
    use_count: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Expiration
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Last used
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    vote_session: Mapped["VoteSession"] = relationship(
        "VoteSession",
        back_populates="tokens",
    )
    votes: Mapped[list["Vote"]] = relationship(
        "Vote",
        back_populates="token",
    )

    __table_args__ = (
        Index("idx_vote_tokens_token", "token"),
        Index("idx_vote_tokens_session_id", "vote_session_id"),
    )

    @property
    def is_valid(self) -> bool:
        """Check if token is still valid."""
        if not self.is_active:
            return False

        if self.max_uses and self.use_count >= self.max_uses:
            return False

        if self.expires_at and datetime.now(timezone.utc) > self.expires_at:
            return False

        return True
