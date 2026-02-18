"""Vote session participant model for tracking invited users."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, backref, mapped_column, relationship

from theatarr.database import Base
from theatarr.models.base import TimestampMixin, UUIDMixin


class VoteSessionParticipant(UUIDMixin, TimestampMixin, Base):
    """Tracks users invited to a vote session."""

    __tablename__ = "vote_session_participants"

    vote_session_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("vote_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    has_voted: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    invited_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    voted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    vote_session = relationship(
        "VoteSession",
        backref=backref("participants", cascade="all, delete-orphan"),
    )
    user = relationship("User", backref="vote_session_participations")

    __table_args__ = (
        Index("idx_vote_session_participants_vote_session_id", "vote_session_id"),
        Index("idx_vote_session_participants_user_id", "user_id"),
        Index(
            "idx_vote_session_participants_unique",
            "vote_session_id",
            "user_id",
            unique=True,
        ),
    )

    def __repr__(self) -> str:
        return f"<VoteSessionParticipant(vote_session_id={self.vote_session_id!r}, user_id={self.user_id!r}, has_voted={self.has_voted})>"
