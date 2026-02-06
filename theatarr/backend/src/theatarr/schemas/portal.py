"""Portal Pydantic schemas for Theatarr - User portal views."""

from datetime import datetime
from typing import Any

from pydantic import Field

from theatarr.schemas.base import BaseSchema


class PortalSessionSummary(BaseSchema):
    """Session summary for portal view."""

    id: str
    name: str
    movie_title: str | None
    movie_poster_url: str | None
    status: str
    scheduled_at: datetime | None
    invitation_status: str
    # Movie selection mode
    movie_selection_mode: str | None = None
    movie_resolved: bool = False
    linked_vote_session_id: str | None = None
    linked_vote_is_open: bool | None = None


class PortalSessionDetail(BaseSchema):
    """Detailed session info for portal."""

    id: str
    name: str
    description: str | None
    movie_title: str | None
    movie_poster_url: str | None
    movie_source: str | None
    color_palette: dict[str, Any] | None
    status: str
    scheduled_at: datetime | None
    started_at: datetime | None
    completed_at: datetime | None
    invitation_status: str
    responded_at: datetime | None
    # Movie selection mode
    movie_selection_mode: str | None = None
    movie_resolved: bool = False
    linked_vote_session_id: str | None = None
    linked_vote_is_open: bool | None = None


class PortalSessionListResponse(BaseSchema):
    """List of portal sessions."""

    items: list[PortalSessionSummary]
    total: int


class SessionRespondRequest(BaseSchema):
    """Request to respond to a session invitation."""

    accept: bool


class PortalVoteSessionSummary(BaseSchema):
    """Vote session summary for portal view."""

    id: str
    name: str
    description: str | None
    movie_options_preview: list[dict[str, Any]]  # First 3 movies with poster info
    has_voted: bool
    closes_at: datetime | None
    status: str


class PortalVoteSessionDetail(BaseSchema):
    """Detailed vote session info for portal."""

    id: str
    name: str
    description: str | None
    movie_options: list[dict[str, Any]]
    has_voted: bool
    my_vote_index: int | None
    show_results: bool
    results: dict[int, int] | None  # Only if show_results is True
    closes_at: datetime | None
    status: str
    is_open: bool


class PortalVoteListResponse(BaseSchema):
    """List of portal vote sessions."""

    items: list[PortalVoteSessionSummary]
    total: int


class PortalVoteCast(BaseSchema):
    """Request to cast a vote."""

    movie_index: int = Field(..., ge=0)


class PortalVoteResponse(BaseSchema):
    """Response after casting a vote."""

    success: bool
    movie_index: int
    vote_session_id: str


class PortalProfileResponse(BaseSchema):
    """User profile response for portal."""

    id: str
    username: str
    first_name: str | None
    last_name: str | None
    email: str | None
    role: str
    created_at: datetime


class PortalStatsResponse(BaseSchema):
    """User statistics for portal home."""

    pending_votes: int
    upcoming_sessions: int
    total_sessions_attended: int
    total_votes_cast: int


class PortalHistorySessionItem(BaseSchema):
    """History item for past sessions."""

    id: str
    name: str
    movie_title: str | None
    movie_poster_url: str | None
    scheduled_at: datetime | None
    completed_at: datetime | None
    invitation_status: str


class PortalHistoryVoteItem(BaseSchema):
    """History item for past votes."""

    id: str
    name: str
    voted_movie_title: str | None
    voted_movie_poster_url: str | None
    winner_movie_title: str | None
    winner_movie_poster_url: str | None
    voted_at: datetime | None
    closed_at: datetime | None
