"""Sound models for Theatarr - audio library management."""

from datetime import datetime
from enum import Enum

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text, Index
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column

from theatarr.database import Base
from theatarr.models.base import TimestampMixin, UUIDMixin


class SoundStatus(str, Enum):
    """Sound download/processing status."""

    PENDING = "pending"
    DOWNLOADING = "downloading"
    PROCESSING = "processing"
    READY = "ready"
    ERROR = "error"
    DELETED = "deleted"


class Sound(Base, UUIDMixin, TimestampMixin):
    """Sound model for managing downloaded audio files.

    Sounds can be extracted from YouTube videos (full, chapters, or playlist entries)
    and stored locally for playback during sessions.
    """

    __tablename__ = "sounds"

    # Metadata
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    tags: Mapped[list | None] = mapped_column(JSON, nullable=True)

    # Source information
    source_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    source_type: Mapped[str] = mapped_column(String(50), default="youtube")

    # File information
    file_path: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    file_size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    format: Mapped[str] = mapped_column(String(20), default="mp3")
    bitrate: Mapped[int | None] = mapped_column(Integer, nullable=True)  # kbps
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Status
    status: Mapped[SoundStatus] = mapped_column(
        String(20),
        default=SoundStatus.PENDING,
        nullable=False,
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    download_progress: Mapped[float] = mapped_column(Float, default=0.0)

    # Chapter/playlist origin
    chapter_title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    chapter_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    parent_source_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)

    # Usage tracking
    play_count: Mapped[int] = mapped_column(Integer, default=0)
    last_played_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    __table_args__ = (
        Index("idx_sounds_status", "status"),
        Index("idx_sounds_play_count", "play_count"),
    )

    @property
    def file_size_mb(self) -> float | None:
        """Get file size in megabytes."""
        if self.file_size_bytes:
            return self.file_size_bytes / (1024 * 1024)
        return None

    @property
    def is_ready(self) -> bool:
        """Check if sound is ready for playback."""
        return self.status == SoundStatus.READY and self.file_path is not None
