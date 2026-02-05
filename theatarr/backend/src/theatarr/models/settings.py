"""Settings model for persistent application configuration."""

from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column

from theatarr.database import Base


class Settings(Base):
    """Key-value store for application settings."""

    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(
        String(100),
        primary_key=True,
        index=True,
    )
    value: Mapped[Any] = mapped_column(JSON, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<Settings(key={self.key!r})>"


# Default settings values
DEFAULT_SETTINGS = {
    "vote_token_expiry_hours": 24,
    "wallmount_requires_token": False,
    "tmdb_cache_ttl_hours": 168,  # 7 days
    "trailer_storage_path": "/data/trailers",
    "auto_resume_sessions": True,
    "default_template_id": None,
}
