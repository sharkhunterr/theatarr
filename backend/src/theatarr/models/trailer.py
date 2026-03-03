"""Trailer models for Theatarr - trailer library management."""

from datetime import datetime, timezone
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, Index
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from theatarr.database import Base
from theatarr.models.base import TimestampMixin, UUIDMixin


class TrailerQuality(str, Enum):
    """Video quality options."""

    SD = "480p"
    HD = "720p"
    FHD = "1080p"
    UHD = "2160p"


class TrailerStatus(str, Enum):
    """Trailer download/processing status."""

    PENDING = "pending"
    DOWNLOADING = "downloading"
    PROCESSING = "processing"
    READY = "ready"
    ERROR = "error"
    DELETED = "deleted"


class Trailer(Base, UUIDMixin, TimestampMixin):
    """Trailer model for managing downloaded trailers.

    Trailers can be downloaded from various sources (YouTube, TMDB, etc.)
    and stored locally for playback during sessions.
    """

    __tablename__ = "trailers"

    # Movie information
    movie_title: Mapped[str] = mapped_column(String(500), nullable=False)
    movie_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    movie_tmdb_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    movie_imdb_id: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Trailer metadata
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Source information
    source_type: Mapped[str] = mapped_column(String(50), default="youtube")  # youtube, tmdb, etc.
    source_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    source_id: Mapped[str | None] = mapped_column(String(100), nullable=True)  # YouTube video ID

    # File information
    file_path: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    file_size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    quality: Mapped[str] = mapped_column(String(20), default=TrailerQuality.HD.value)
    format: Mapped[str] = mapped_column(String(20), default="mp4")

    # Thumbnail
    thumbnail_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    thumbnail_path: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    # Status
    status: Mapped[TrailerStatus] = mapped_column(
        String(20),
        default=TrailerStatus.PENDING,
        nullable=False,
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    download_progress: Mapped[float] = mapped_column(Float, default=0.0)

    # Categorization
    genres: Mapped[list | None] = mapped_column(JSON, nullable=True)
    tags: Mapped[list | None] = mapped_column(JSON, nullable=True)
    rating: Mapped[float | None] = mapped_column(Float, nullable=True)  # Movie rating

    # Usage tracking
    play_count: Mapped[int] = mapped_column(Integer, default=0)
    last_played_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Rule that triggered download
    rule_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("trailer_rules.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    rule: Mapped["TrailerRule | None"] = relationship(
        "TrailerRule",
        back_populates="trailers",
    )

    __table_args__ = (
        Index("idx_trailers_status", "status"),
        Index("idx_trailers_movie_tmdb_id", "movie_tmdb_id"),
        Index("idx_trailers_play_count", "play_count"),
    )

    @property
    def file_size_mb(self) -> float | None:
        """Get file size in megabytes."""
        if self.file_size_bytes:
            return self.file_size_bytes / (1024 * 1024)
        return None

    @property
    def is_ready(self) -> bool:
        """Check if trailer is ready for playback."""
        return self.status == TrailerStatus.READY and self.file_path is not None


class TrailerRuleFrequency(str, Enum):
    """How often to run the rule."""

    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    MANUAL = "manual"


class TrailerRule(Base, UUIDMixin, TimestampMixin):
    """Rule for automatically downloading trailers.

    Rules define criteria for finding and downloading trailers,
    with storage limits and rotation policies.
    """

    __tablename__ = "trailer_rules"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    # Genre filters (download trailers for movies in these genres)
    genres: Mapped[list | None] = mapped_column(JSON, nullable=True)

    # Year filters
    min_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_year: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Rating filters
    min_rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_rating: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Quality preference
    preferred_quality: Mapped[str] = mapped_column(
        String(20),
        default=TrailerQuality.FHD.value,
    )
    min_quality: Mapped[str] = mapped_column(
        String(20),
        default=TrailerQuality.HD.value,
    )

    # Duration limits (in seconds)
    min_duration: Mapped[int | None] = mapped_column(Integer, nullable=True)  # e.g., 60
    max_duration: Mapped[int | None] = mapped_column(Integer, nullable=True)  # e.g., 180

    # Storage limits
    max_storage_gb: Mapped[float] = mapped_column(Float, default=10.0)
    max_trailer_count: Mapped[int | None] = mapped_column(Integer, nullable=True)  # e.g., 50

    # Download limits
    max_downloads_per_run: Mapped[int] = mapped_column(Integer, default=5)

    # Scheduling
    frequency: Mapped[str] = mapped_column(
        String(20),
        default=TrailerRuleFrequency.WEEKLY.value,
    )
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Rotation policy
    rotation_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    rotation_keep_most_recent: Mapped[int] = mapped_column(Integer, default=20)  # Keep N most recent
    rotation_keep_most_played: Mapped[int] = mapped_column(Integer, default=10)  # Keep N most played

    # Additional criteria
    criteria: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Stats
    total_downloads: Mapped[int] = mapped_column(Integer, default=0)
    total_storage_bytes: Mapped[int] = mapped_column(Integer, default=0)

    # Relationships
    trailers: Mapped[list["Trailer"]] = relationship(
        "Trailer",
        back_populates="rule",
    )

    __table_args__ = (
        Index("idx_trailer_rules_enabled", "is_enabled"),
        Index("idx_trailer_rules_next_run", "next_run_at"),
    )

    @property
    def storage_used_gb(self) -> float:
        """Get current storage usage in GB."""
        return self.total_storage_bytes / (1024 * 1024 * 1024)

    @property
    def is_at_storage_limit(self) -> bool:
        """Check if rule has reached storage limit."""
        return self.storage_used_gb >= self.max_storage_gb

    def matches_movie(
        self,
        genres: list[str] | None = None,
        year: int | None = None,
        rating: float | None = None,
    ) -> bool:
        """Check if a movie matches this rule's criteria.

        Args:
            genres: Movie genres
            year: Release year
            rating: Movie rating

        Returns:
            True if movie matches all criteria
        """
        # Check genres
        if self.genres:
            if not genres or not any(g in self.genres for g in genres):
                return False

        # Check year
        if self.min_year and (not year or year < self.min_year):
            return False
        if self.max_year and (not year or year > self.max_year):
            return False

        # Check rating
        if self.min_rating and (not rating or rating < self.min_rating):
            return False
        if self.max_rating and (not rating or rating > self.max_rating):
            return False

        return True
