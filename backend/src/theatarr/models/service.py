"""Service model for external service connections."""

from datetime import datetime
from enum import Enum
from typing import Any

from sqlalchemy import Boolean, DateTime, String, Text
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column

from theatarr.database import Base
from theatarr.models.base import TimestampMixin, UUIDMixin


class ServiceCategory(str, Enum):
    """Category of service."""

    LIGHTING = "lighting"
    PLAYER = "player"
    MEDIA_SOURCE = "media_source"
    ACTUATOR = "actuator"
    METADATA = "metadata"


class ConnectionStatus(str, Enum):
    """Connection status of a service."""

    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"
    UNKNOWN = "unknown"


class Service(UUIDMixin, TimestampMixin, Base):
    """External service configuration."""

    __tablename__ = "services"

    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    adapter_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )
    category: Mapped[ServiceCategory] = mapped_column(
        String(20),
        nullable=False,
        index=True,
    )
    config: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
    )
    is_enabled: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    connection_status: Mapped[ConnectionStatus] = mapped_column(
        String(20),
        default=ConnectionStatus.UNKNOWN,
        nullable=False,
    )
    last_seen_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    capabilities: Mapped[dict[str, Any] | None] = mapped_column(
        JSON,
        nullable=True,
    )
    error_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    def __repr__(self) -> str:
        return f"<Service(id={self.id!r}, name={self.name!r}, type={self.adapter_type})>"

    @property
    def is_connected(self) -> bool:
        """Check if service is currently connected."""
        return self.connection_status == ConnectionStatus.CONNECTED

    @property
    def has_error(self) -> bool:
        """Check if service has an error."""
        return self.connection_status == ConnectionStatus.ERROR
