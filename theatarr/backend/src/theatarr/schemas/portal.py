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
    mystery_reveal_at: datetime | None = None
    vote_reveal_at: datetime | None = None
    linked_vote_session_id: str | None = None
    linked_vote_is_open: bool | None = None
    vote_movie_posters: list[str] | None = None
    # Feedback
    feedback_available: bool = False
    has_submitted_feedback: bool = False
    feedback_count: int = 0
    feedback_average: float | None = None


class PortalSequenceSummary(BaseSchema):
    """Sequence summary for portal timeline."""

    id: str
    name: str
    order_index: int
    duration_type: str
    duration_ms: int | None
    duration_fallback_ms: int = 60000
    actions_count: int = 0
    action_types: list[str] = []
    expected_duration_ms: int | None = None


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
    mystery_reveal_at: datetime | None = None
    vote_reveal_at: datetime | None = None
    linked_vote_session_id: str | None = None
    linked_vote_is_open: bool | None = None
    vote_movie_posters: list[str] | None = None
    # Timeline data
    sequences: list[PortalSequenceSummary] = []
    current_sequence_index: int = 0
    current_sequence_elapsed_ms: int = 0
    total_sequences: int = 0
    movie_runtime_minutes: int | None = None
    # Feedback
    feedback_available: bool = False
    has_submitted_feedback: bool = False
    feedback_count: int = 0
    feedback_average: float | None = None


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
    auto_accept_invitations: bool
    created_at: datetime


class PortalStatsResponse(BaseSchema):
    """User statistics for portal home."""

    pending_votes: int
    pending_quiz: int = 0
    pending_invitations: int
    pending_feedback: int = 0
    upcoming_sessions: int
    total_sessions_attended: int
    total_votes_cast: int


class PortalQuizSessionSummary(BaseSchema):
    """Quiz session summary for portal view."""

    id: str
    name: str
    description: str | None
    status: str
    question_count: int
    has_joined: bool
    my_score: int = 0


class PortalQuizListResponse(BaseSchema):
    """List of portal quiz sessions."""

    items: list[PortalQuizSessionSummary]
    total: int


class PortalQuizAnswer(BaseSchema):
    """Request to submit a quiz answer from portal."""

    question_index: int = Field(..., ge=0)
    selected_indices: list[int] = Field(..., min_length=1)
    response_time_ms: int | None = None


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
