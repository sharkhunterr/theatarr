"""Base model mixins for Theatarr."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, func
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column


class UUIDMixin:
    """Mixin that adds a UUID primary key."""

    id: Mapped[str] = mapped_column(
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True,
    )


class TimestampMixin:
    """Mixin that adds created_at and updated_at timestamps."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class JSONColumn:
    """Helper for JSON columns with SQLite compatibility."""

    @staticmethod
    def column(default: Any = None, nullable: bool = True) -> Mapped[Any]:
        """Create a JSON column with proper default handling."""
        return mapped_column(
            JSON,
            default=default if default is not None else dict,
            nullable=nullable,
        )
