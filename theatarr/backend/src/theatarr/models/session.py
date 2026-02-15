"""Session model for cinema orchestration."""

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.dialects.sqlite import JSON as SQLiteJSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from theatarr.database import Base
from theatarr.models.base import TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from theatarr.models.sequence import Sequence
    from theatarr.models.template import Template
    from theatarr.models.vote import VoteSession


class SessionStatus(str, Enum):
    """Status of a cinema session."""

    DRAFT = "draft"
    SCHEDULED = "scheduled"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    INTERRUPTED = "interrupted"


class MovieSelectionMode(str, Enum):
    """Mode for selecting the movie for a session."""

    FIXED = "fixed"      # Movie is directly selected (current behavior)
    VOTE = "vote"        # Movie is determined by vote session result
    MYSTERY = "mystery"  # Movie is revealed at a specific time


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
    pause_on_display_disconnect: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    workflow: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
    )

    # Movie info (denormalized for quick access and external sources)
    movie_title: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )
    movie_poster_url: Mapped[str | None] = mapped_column(
        String(1000),
        nullable=True,
    )
    movie_source_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    movie_source: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    # Color palette extracted from movie poster
    color_palette: Mapped[dict | None] = mapped_column(
        SQLiteJSON,
        nullable=True,
    )

    # Movie selection mode fields
    movie_selection_mode: Mapped[str] = mapped_column(
        String(20),
        default=MovieSelectionMode.FIXED.value,
        nullable=False,
    )
    linked_vote_session_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("vote_sessions.id", ondelete="SET NULL"),
        nullable=True,
    )
    linked_quiz_session_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("quiz_sessions.id", ondelete="SET NULL"),
        nullable=True,
    )
    mystery_reveal_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    mystery_config: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
    )
    vote_reveal_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    movie_resolved: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    movie_resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Enrichment options (stored so enrichment runs when movie is resolved)
    enrichment_options: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
    )

    # Feedback opened (set by session:open_feedback action or auto on complete)
    feedback_opened: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        server_default="0",
    )

    # Display code for pairing a browser to this session
    display_code: Mapped[str | None] = mapped_column(
        String(8),
        unique=True,
        index=True,
        nullable=True,
    )

    # Template override (if None, uses the globally active template)
    template_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("templates.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    sequences: Mapped[list["Sequence"]] = relationship(
        "Sequence",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="Sequence.order_index",
        lazy="selectin",
    )
    linked_vote_session: Mapped["VoteSession | None"] = relationship(
        "VoteSession",
        foreign_keys=[linked_vote_session_id],
        lazy="selectin",
    )
    template: Mapped["Template | None"] = relationship(
        "Template",
        foreign_keys=[template_id],
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
