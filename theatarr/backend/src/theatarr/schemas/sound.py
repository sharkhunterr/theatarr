"""Sound Pydantic schemas for Theatarr."""

from datetime import datetime

from pydantic import Field

from theatarr.schemas.base import BaseSchema


class SoundCreate(BaseSchema):
    """Schema for creating a sound entry."""

    name: str = Field(..., min_length=1, max_length=500)
    tags: list[str] | None = None
    source_url: str | None = None


class SoundUpdate(BaseSchema):
    """Schema for updating a sound."""

    name: str | None = Field(default=None, min_length=1, max_length=500)
    tags: list[str] | None = None


class SoundResponse(BaseSchema):
    """Sound response schema."""

    id: str
    name: str
    tags: list[str] | None
    source_url: str | None
    source_type: str
    file_path: str | None
    file_size_bytes: int | None
    file_size_mb: float | None
    format: str
    bitrate: int | None
    duration_seconds: int | None
    status: str
    error_message: str | None
    download_progress: float
    chapter_title: str | None
    chapter_index: int | None
    parent_source_url: str | None
    play_count: int
    last_played_at: datetime | None
    is_ready: bool
    created_at: datetime
    updated_at: datetime


class SoundListResponse(BaseSchema):
    """List of sounds response."""

    items: list[SoundResponse]
    total: int
    total_size_bytes: int
    total_size_gb: float


class SoundDownloadRequest(BaseSchema):
    """Request to download sound(s) from a URL."""

    source_url: str
    name: str | None = None
    selected_chapters: list[int] | None = None  # Chapter indices to download
    selected_entries: list[int] | None = None  # Playlist entry indices to download


class ChapterInfo(BaseSchema):
    """Chapter information from a YouTube video."""

    title: str
    start_time: float
    end_time: float


class EntryInfo(BaseSchema):
    """Playlist entry information."""

    index: int
    id: str
    title: str
    duration: float | None = None


class SoundInfoResponse(BaseSchema):
    """Response from analyzing a YouTube URL."""

    title: str
    duration: float | None = None
    is_playlist: bool = False
    chapters: list[ChapterInfo] = []
    entries: list[EntryInfo] = []
