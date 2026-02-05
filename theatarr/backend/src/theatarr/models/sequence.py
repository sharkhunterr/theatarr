"""Sequence model for session orchestration."""

from enum import Enum
from typing import TYPE_CHECKING, Any

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from theatarr.database import Base
from theatarr.models.base import TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from theatarr.models.action import Action
    from theatarr.models.session import Session


class DurationType(str, Enum):
    """Type of sequence duration."""

    FIXED = "fixed"  # Fixed duration in ms
    DYNAMIC = "dynamic"  # Duration based on media playback
    MANUAL = "manual"  # User manually advances


class Sequence(UUIDMixin, TimestampMixin, Base):
    """A sequence within a session containing actions."""

    __tablename__ = "sequences"

    session_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    order_index: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        index=True,
    )
    duration_type: Mapped[DurationType] = mapped_column(
        String(20),
        default=DurationType.FIXED,
        nullable=False,
    )
    duration_ms: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    duration_fallback_ms: Mapped[int] = mapped_column(
        Integer,
        default=60000,  # 1 minute default fallback
        nullable=False,
    )
    transition_ms: Mapped[int] = mapped_column(
        Integer,
        default=1000,  # 1 second default transition
        nullable=False,
    )
    node_editor_data: Mapped[dict[str, Any] | None] = mapped_column(
        JSON,
        nullable=True,
    )

    # Relationships
    session: Mapped["Session"] = relationship(
        "Session",
        back_populates="sequences",
    )
    actions: Mapped[list["Action"]] = relationship(
        "Action",
        back_populates="sequence",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    __table_args__ = (
        # Unique constraint: only one sequence per order_index in a session
        {"sqlite_autoincrement": True},
    )

    def __repr__(self) -> str:
        return f"<Sequence(id={self.id!r}, name={self.name!r}, order={self.order_index})>"

    @property
    def effective_duration_ms(self) -> int:
        """Get the effective duration considering type and fallback."""
        if self.duration_type == DurationType.FIXED and self.duration_ms:
            return self.duration_ms
        if self.duration_type == DurationType.MANUAL:
            return 0  # No automatic duration
        return self.duration_fallback_ms

    @property
    def total_actions(self) -> int:
        """Get the total number of actions."""
        return len(self.actions) if self.actions else 0
