"""PreRoll models for Theatarr - pre-roll video library management."""

from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, Float, Integer, String, Text, Index
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column

from theatarr.database import Base
from theatarr.models.base import TimestampMixin, UUIDMixin


class PreRollStatus(str, Enum):
    """Pre-roll download/processing status."""

    PENDING = "pending"
    DOWNLOADING = "downloading"
    PROCESSING = "processing"
    READY = "ready"
    ERROR = "error"
    DELETED = "deleted"


class PreRoll(Base, UUIDMixin, TimestampMixin):
    """Pre-roll video model.

    Pre-rolls are short intro videos (studio logos, custom intros, etc.)
    that can be played before the main feature in a session.
    """

    __tablename__ = "prerolls"

    # Metadata
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    tags: Mapped[list | None] = mapped_column(JSON, nullable=True)

    # Source information
    source_type: Mapped[str] = mapped_column(String(50), default="upload")  # "upload" | "youtube"
    source_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)

    # File information
    file_path: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    file_size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    format: Mapped[str] = mapped_column(String(20), default="mp4")
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Thumbnail
    thumbnail_path: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    # Status
    status: Mapped[PreRollStatus] = mapped_column(
        String(20),
        default=PreRollStatus.PENDING,
        nullable=False,
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    download_progress: Mapped[float] = mapped_column(Float, default=0.0)

    # Usage tracking
    play_count: Mapped[int] = mapped_column(Integer, default=0)
    last_played_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )

    __table_args__ = (
        Index("idx_prerolls_status", "status"),
        Index("idx_prerolls_play_count", "play_count"),
    )

    @property
    def file_size_mb(self) -> float | None:
        """Get file size in megabytes."""
        if self.file_size_bytes:
            return self.file_size_bytes / (1024 * 1024)
        return None

    @property
    def is_ready(self) -> bool:
        """Check if pre-roll is ready for playback."""
        return self.status == PreRollStatus.READY and self.file_path is not None
