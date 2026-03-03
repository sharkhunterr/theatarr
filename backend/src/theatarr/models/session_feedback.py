"""Session feedback model for user ratings of completed sessions."""

from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Index, String
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, backref, mapped_column, relationship

from theatarr.database import Base
from theatarr.models.base import TimestampMixin, UUIDMixin


class SessionFeedback(UUIDMixin, TimestampMixin, Base):
    """Individual feedback submission for a cinema session.

    Each row represents one user's complete feedback for one session.
    Ratings are stored as a JSON dict keyed by category slug:
    {"media": {"rating": 8, "comment": "Great film"}, "organisation": {"rating": 7, "comment": null}}
    """

    __tablename__ = "session_feedback"

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
    ratings: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
    )
    overall_rating: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    # Relationships
    session = relationship("Session", backref=backref("feedback_entries", cascade="all, delete-orphan"))
    user = relationship("User", backref="session_feedback")

    __table_args__ = (
        Index("idx_session_feedback_session_id", "session_id"),
        Index("idx_session_feedback_user_id", "user_id"),
        Index(
            "idx_session_feedback_unique",
            "session_id",
            "user_id",
            unique=True,
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<SessionFeedback(session_id={self.session_id!r}, "
            f"user_id={self.user_id!r}, overall={self.overall_rating})>"
        )
