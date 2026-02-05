"""Session model for cinema orchestration."""

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from theatarr.database import Base
from theatarr.models.base import TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from theatarr.models.sequence import Sequence


class SessionStatus(str, Enum):
    """Status of a cinema session."""

    DRAFT = "draft"
    SCHEDULED = "scheduled"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    INTERRUPTED = "interrupted"


class Session(UUIDMixin, TimestampMixin, Base):
    """A cinema session containing ordered sequences."""

    __tablename__ = "sessions"

    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    movie_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("movies.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[SessionStatus] = mapped_column(
        String(20),
        default=SessionStatus.DRAFT,
        nullable=False,
        index=True,
    )
    scheduled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    current_sequence_index: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    current_sequence_elapsed_ms: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    auto_resume_enabled: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    # Relationships
    sequences: Mapped[list["Sequence"]] = relationship(
        "Sequence",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="Sequence.order_index",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<Session(id={self.id!r}, name={self.name!r}, status={self.status})>"

    @property
    def total_sequences(self) -> int:
        """Get the total number of sequences."""
        return len(self.sequences) if self.sequences else 0

    @property
    def current_sequence(self) -> "Sequence | None":
        """Get the current sequence being executed."""
        if not self.sequences or self.current_sequence_index >= len(self.sequences):
            return None
        return self.sequences[self.current_sequence_index]

    @property
    def is_active(self) -> bool:
        """Check if session is currently active (running or paused)."""
        return self.status in (SessionStatus.RUNNING, SessionStatus.PAUSED)

    @property
    def can_start(self) -> bool:
        """Check if session can be started."""
        return self.status in (
            SessionStatus.DRAFT,
            SessionStatus.SCHEDULED,
            SessionStatus.INTERRUPTED,
        )

    @property
    def can_pause(self) -> bool:
        """Check if session can be paused."""
        return self.status == SessionStatus.RUNNING

    @property
    def can_resume(self) -> bool:
        """Check if session can be resumed."""
        return self.status == SessionStatus.PAUSED
