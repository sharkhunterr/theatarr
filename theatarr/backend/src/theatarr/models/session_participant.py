"""Session participant model for tracking invited users."""

from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from theatarr.database import Base
from theatarr.models.base import TimestampMixin, UUIDMixin


class InvitationStatus(str, Enum):
    """Status of a session invitation."""

    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"


class SessionParticipant(UUIDMixin, TimestampMixin, Base):
    """Tracks users invited to a cinema session."""

    __tablename__ = "session_participants"

    session_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    invitation_status: Mapped[str] = mapped_column(
        String(20),
        default=InvitationStatus.PENDING.value,
        nullable=False,
    )
    invited_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    responded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    session = relationship("Session", backref="participants")
    user = relationship("User", backref="session_participations")

    __table_args__ = (
        Index("idx_session_participants_session_id", "session_id"),
        Index("idx_session_participants_user_id", "user_id"),
        Index(
            "idx_session_participants_unique",
            "session_id",
            "user_id",
            unique=True,
        ),
    )

    def __repr__(self) -> str:
        return f"<SessionParticipant(session_id={self.session_id!r}, user_id={self.user_id!r}, status={self.invitation_status!r})>"
