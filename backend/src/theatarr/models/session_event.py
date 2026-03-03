"""Session event model for persistent audit logging."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column

from theatarr.database import Base
from theatarr.models.base import UUIDMixin


class SessionEvent(UUIDMixin, Base):
    """Persistent event log for cinema session execution.

    Each row captures one discrete event (session started, action executed,
    display connected, etc.) with a JSON data payload containing event-specific
    details.
    """

    __tablename__ = "session_events"

    session_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    event_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.now,
    )
    data: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
    )

    __table_args__ = (
        Index("idx_session_events_session_id", "session_id"),
        Index("idx_session_events_type", "event_type"),
        Index("idx_session_events_timestamp", "timestamp"),
    )

    def __repr__(self) -> str:
        return (
            f"<SessionEvent(session_id={self.session_id!r}, "
            f"type={self.event_type!r}, ts={self.timestamp})>"
        )
