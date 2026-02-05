"""Action model for sequence execution."""

from enum import Enum
from typing import TYPE_CHECKING, Any

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from theatarr.database import Base
from theatarr.models.base import TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from theatarr.models.sequence import Sequence


class ActionType(str, Enum):
    """Type of action to execute."""

    LIGHTING = "lighting"
    AUDIO = "audio"
    DISPLAY = "display"
    MEDIA = "media"
    ACTUATOR = "actuator"


class OnFailure(str, Enum):
    """Behavior when action fails."""

    WARN = "warn"  # Log warning and continue
    SKIP = "skip"  # Skip silently
    ABORT = "abort"  # Stop session execution


class Action(UUIDMixin, TimestampMixin, Base):
    """An atomic action within a sequence."""

    __tablename__ = "actions"

    sequence_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("sequences.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    service_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("services.id", ondelete="SET NULL"),
        nullable=True,
    )
    action_type: Mapped[ActionType] = mapped_column(
        String(20),
        nullable=False,
    )
    command: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    parameters: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
    )
    delay_ms: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    on_failure: Mapped[OnFailure] = mapped_column(
        String(10),
        default=OnFailure.WARN,
        nullable=False,
    )

    # Relationships
    sequence: Mapped["Sequence"] = relationship(
        "Sequence",
        back_populates="actions",
    )

    def __repr__(self) -> str:
        return f"<Action(id={self.id!r}, type={self.action_type}, command={self.command!r})>"

    @property
    def targets(self) -> list[str]:
        """Get the target identifiers from parameters."""
        return self.parameters.get("targets", [])

    def to_command(self) -> dict[str, Any]:
        """Convert action to command format for adapter execution."""
        return {
            "action": self.command,
            "parameters": self.parameters,
            "targets": self.targets,
        }
