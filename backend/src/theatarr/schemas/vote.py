"""Vote Pydantic schemas for Theatarr."""

from datetime import datetime
from typing import Any

from pydantic import Field

from theatarr.schemas.base import BaseSchema


class MovieOption(BaseSchema):
    """Movie option for voting."""

    title: str
    year: int | None = None
    poster_url: str | None = None
    backdrop_url: str | None = None
    overview: str | None = None
    rating: float | None = None
    genres: list[str] | None = None
    runtime_minutes: int | None = None
    directors: list[str] | None = None
    cast: list[str] | None = None
    tagline: str | None = None
    movie_id: str | None = None  # If linked to Movie model
    source: str | None = None
    source_id: str | None = None


class VoteSessionCreate(BaseSchema):
    """Schema for creating a vote session."""

    name: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    movie_options: list[MovieOption] = Field(..., min_length=2, max_length=10)
    max_votes_per_user: int = Field(default=1, ge=1, le=10)
    allow_multiple_votes: bool = False
    require_token: bool = True
    show_results_during_voting: bool = False
    anonymous_voting: bool = True
    open_immediately: bool = False
    close_when_all_voted: bool = False
    opens_at: datetime | None = None
    closes_at: datetime | None = None
    target_session_id: str | None = None


class VoteSessionUpdate(BaseSchema):
    """Schema for updating a vote session."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    movie_options: list[MovieOption] | None = None
    max_votes_per_user: int | None = Field(default=None, ge=1, le=10)
    allow_multiple_votes: bool | None = None
    require_token: bool | None = None
    show_results_during_voting: bool | None = None
    anonymous_voting: bool | None = None
    opens_at: datetime | None = None
    closes_at: datetime | None = None
    target_session_id: str | None = None


class VoteSessionResponse(BaseSchema):
    """Vote session response schema."""

    id: str
    name: str
    description: str | None
    status: str
    movie_options: list[dict[str, Any]] | None
    max_votes_per_user: int
    allow_multiple_votes: bool
    require_token: bool
    show_results_during_voting: bool
    anonymous_voting: bool
    close_when_all_voted: bool = False
    opens_at: datetime | None
    closes_at: datetime | None
    closed_at: datetime | None
    winner_movie_id: str | None
    winning_movie_index: int | None
    target_session_id: str | None
    total_votes: int
    is_open: bool
    created_at: datetime
    updated_at: datetime
    # Link to session (when created via session movie selection mode)
    linked_session_id: str | None = None
    linked_session_name: str | None = None


class VoteSessionListResponse(BaseSchema):
    """List of vote sessions response."""

    items: list[VoteSessionResponse]
    total: int


class VoteSessionPublicResponse(BaseSchema):
    """Public vote session info (for voters)."""

    id: str
    name: str
    description: str | None
    movie_options: list[dict[str, Any]] | None
    is_open: bool
    show_results_during_voting: bool
    allow_multiple_votes: bool
    max_votes_per_user: int
    closes_at: datetime | None
    results: dict[int, int] | None = None  # Only if show_results_during_voting


class VoteCast(BaseSchema):
    """Schema for casting a vote."""

    movie_index: int = Field(..., ge=0)
    token: str | None = None  # Required if session requires token


class VoteResponse(BaseSchema):
    """Vote response schema."""

    id: str
    movie_index: int
    created_at: datetime


class VoteResultsResponse(BaseSchema):
    """Vote results response."""

    vote_session_id: str
    total_votes: int
    vote_counts: dict[int, int]  # movie_index -> count
    winner_index: int | None
    is_open: bool


class VoteTokenCreate(BaseSchema):
    """Schema for creating vote tokens."""

    count: int = Field(default=1, ge=1, le=100)
    label_prefix: str | None = Field(default=None, max_length=50)
    max_uses: int | None = Field(default=None, ge=1)
    expires_at: datetime | None = None


class VoteTokenResponse(BaseSchema):
    """Vote token response schema."""

    id: str
    token: str
    label: str | None
    max_uses: int | None
    use_count: int
    is_active: bool
    is_valid: bool
    expires_at: datetime | None
    last_used_at: datetime | None
    vote_url: str | None = None  # Full URL for sharing


class VoteTokenListResponse(BaseSchema):
    """List of vote tokens response."""

    items: list[VoteTokenResponse]
    total: int
