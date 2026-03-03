"""PreRoll Pydantic schemas for Theatarr."""

from datetime import datetime

from pydantic import Field

from theatarr.schemas.base import BaseSchema


class PreRollUpdate(BaseSchema):
    """Schema for updating a pre-roll."""

    name: str | None = Field(default=None, min_length=1, max_length=500)
    tags: list[str] | None = None


class PreRollResponse(BaseSchema):
    """Pre-roll response schema."""

    id: str
    name: str
    tags: list[str] | None
    source_type: str
    source_url: str | None
    file_path: str | None
    file_size_bytes: int | None
    file_size_mb: float | None
    format: str
    duration_seconds: int | None
    thumbnail_path: str | None
    status: str
    error_message: str | None
    download_progress: float
    play_count: int
    last_played_at: datetime | None
    is_ready: bool
    created_at: datetime
    updated_at: datetime


class PreRollListResponse(BaseSchema):
    """List of pre-rolls response."""

    items: list[PreRollResponse]
    total: int
    total_size_bytes: int
    total_size_gb: float


class PreRollDownloadRequest(BaseSchema):
    """Request to download a pre-roll from YouTube."""

    source_url: str
    name: str | None = None
