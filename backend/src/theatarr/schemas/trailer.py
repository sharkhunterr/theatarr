"""Trailer Pydantic schemas for Theatarr."""

from datetime import datetime
from typing import Any

from pydantic import Field

from theatarr.schemas.base import BaseSchema


class TrailerBase(BaseSchema):
    """Base trailer fields."""

    movie_title: str
    movie_year: int | None = None
    movie_tmdb_id: str | None = None
    title: str
    description: str | None = None
    source_type: str = "youtube"
    source_url: str | None = None
    genres: list[str] | None = None
    tags: list[str] | None = None


class TrailerCreate(TrailerBase):
    """Schema for creating a trailer entry."""

    source_id: str | None = None


class TrailerUpdate(BaseSchema):
    """Schema for updating a trailer."""

    title: str | None = None
    description: str | None = None
    genres: list[str] | None = None
    tags: list[str] | None = None


class TrailerResponse(TrailerBase):
    """Trailer response schema."""

    id: str
    duration_seconds: int | None
    source_id: str | None
    file_path: str | None
    file_size_bytes: int | None
    file_size_mb: float | None
    quality: str
    format: str
    thumbnail_url: str | None
    status: str
    error_message: str | None
    download_progress: float
    rating: float | None
    play_count: int
    last_played_at: datetime | None
    is_ready: bool
    created_at: datetime
    updated_at: datetime


class TrailerListResponse(BaseSchema):
    """List of trailers response."""

    items: list[TrailerResponse]
    total: int
    total_size_bytes: int
    total_size_gb: float


class TrailerDownloadRequest(BaseSchema):
    """Request to download a trailer."""

    movie_title: str
    movie_year: int | None = None
    movie_tmdb_id: str | None = None
    source_url: str  # YouTube URL or TMDB trailer key
    preferred_quality: str = "1080p"


class TrailerRuleBase(BaseSchema):
    """Base trailer rule fields."""

    name: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    genres: list[str] | None = None
    min_year: int | None = None
    max_year: int | None = None
    min_rating: float | None = Field(default=None, ge=0, le=10)
    max_rating: float | None = Field(default=None, ge=0, le=10)
    preferred_quality: str = "1080p"
    min_quality: str = "720p"
    min_duration: int | None = Field(default=None, ge=0)
    max_duration: int | None = Field(default=None, ge=0)
    max_storage_gb: float = Field(default=10.0, ge=0.1, le=1000)
    max_trailer_count: int | None = Field(default=None, ge=1, le=1000)
    max_downloads_per_run: int = Field(default=5, ge=1, le=50)
    frequency: str = "weekly"
    rotation_enabled: bool = True
    rotation_keep_most_recent: int = Field(default=20, ge=0)
    rotation_keep_most_played: int = Field(default=10, ge=0)


class TrailerRuleCreate(TrailerRuleBase):
    """Schema for creating a trailer rule."""

    is_enabled: bool = True


class TrailerRuleUpdate(BaseSchema):
    """Schema for updating a trailer rule."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    is_enabled: bool | None = None
    genres: list[str] | None = None
    min_year: int | None = None
    max_year: int | None = None
    min_rating: float | None = Field(default=None, ge=0, le=10)
    max_rating: float | None = Field(default=None, ge=0, le=10)
    preferred_quality: str | None = None
    min_quality: str | None = None
    min_duration: int | None = None
    max_duration: int | None = None
    max_storage_gb: float | None = Field(default=None, ge=0.1, le=1000)
    max_trailer_count: int | None = None
    max_downloads_per_run: int | None = Field(default=None, ge=1, le=50)
    frequency: str | None = None
    rotation_enabled: bool | None = None
    rotation_keep_most_recent: int | None = None
    rotation_keep_most_played: int | None = None


class TrailerRuleResponse(TrailerRuleBase):
    """Trailer rule response schema."""

    id: str
    is_enabled: bool
    last_run_at: datetime | None
    next_run_at: datetime | None
    total_downloads: int
    total_storage_bytes: int
    storage_used_gb: float
    is_at_storage_limit: bool
    trailer_count: int
    created_at: datetime
    updated_at: datetime


class TrailerRuleListResponse(BaseSchema):
    """List of trailer rules response."""

    items: list[TrailerRuleResponse]
    total: int


class StorageStatsResponse(BaseSchema):
    """Storage statistics for trailers."""

    total_trailers: int
    ready_trailers: int
    pending_trailers: int
    error_trailers: int
    total_size_bytes: int
    total_size_gb: float
    total_duration_seconds: int
    total_duration_formatted: str
    by_quality: dict[str, int]
    by_genre: dict[str, int]
    by_status: dict[str, int]


class TrailerSearchResponse(BaseSchema):
    """TMDB trailer search result."""

    key: str  # YouTube video key
    name: str
    type: str  # Trailer, Teaser, Clip, etc.
    site: str  # YouTube, Vimeo, etc.
    size: int  # Video quality (1080, 720, etc.)
    official: bool
    published_at: datetime | None


class TrailerSearchResults(BaseSchema):
    """Multiple trailer search results."""

    movie_title: str
    movie_year: int | None
    movie_tmdb_id: str
    trailers: list[TrailerSearchResponse]
