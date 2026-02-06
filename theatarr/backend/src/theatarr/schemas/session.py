"""Pydantic schemas for Session API."""

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field

from theatarr.schemas.base import BaseSchema, IDTimestampSchema


class SessionStatus(str, Enum):
    """Status of a cinema session."""

    DRAFT = "draft"
    SCHEDULED = "scheduled"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    INTERRUPTED = "interrupted"


class MovieSelectionMode(str, Enum):
    """Mode for selecting the movie for a session."""

    FIXED = "fixed"      # Movie is directly selected (current behavior)
    VOTE = "vote"        # Movie is determined by vote session result
    MYSTERY = "mystery"  # Movie is revealed at a specific time


class MysterySource(str, Enum):
    """Source for mystery movie selection."""

    RANDOM = "random"       # Random from library
    FILTERED = "filtered"   # Filtered by genre, year, rating
    CURATED = "curated"     # From a curated list


class SessionControlAction(str, Enum):
    """Control actions for a session."""

    PLAY = "play"
    PAUSE = "pause"
    STOP = "stop"
    SKIP = "skip"
    RESTART = "restart"


# ============================================================================
# Mystery Mode Config
# ============================================================================


class MysteryFilters(BaseSchema):
    """Filters for mystery movie selection."""

    genres: list[str] | None = None
    year_min: int | None = None
    year_max: int | None = None
    rating_min: float | None = None


class MysteryMovieOption(BaseSchema):
    """Movie option for curated mystery list."""

    title: str
    year: int | None = None
    poster_url: str | None = None
    movie_id: str | None = None
    source: str | None = None
    source_id: str | None = None


class MysteryConfig(BaseSchema):
    """Configuration for mystery movie selection."""

    source: MysterySource = MysterySource.RANDOM
    filters: MysteryFilters | None = None
    curated_movies: list[MysteryMovieOption] | None = None


# ============================================================================
# Vote Session Summary (for embedding in Session)
# ============================================================================


class VoteSessionSummary(BaseSchema):
    """Summary of a linked vote session."""

    id: str
    name: str
    status: str
    total_votes: int
    is_open: bool
    winning_movie_index: int | None = None
    movie_options: list[dict[str, Any]] | None = None


# ============================================================================
# Sequence Summary (for embedding in Session)
# ============================================================================


class SequenceSummary(BaseSchema):
    """Summary of a sequence for session views."""

    id: str
    name: str
    order_index: int
    duration_type: str
    duration_ms: int | None
    transition_ms: int


class ActionInput(BaseSchema):
    """Schema for action input in sequence."""

    id: str | None = None
    action_type: str
    command: str
    parameters: dict = Field(default_factory=dict)
    delay_ms: int = 0
    on_failure: str = "warn"
    service_id: str | None = None


class SequenceInput(BaseSchema):
    """Schema for sequence input when creating/updating sessions."""

    id: str | None = None
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    duration_type: str = "fixed"
    duration_ms: int | None = None
    duration_fallback_ms: int = 30000
    transition_ms: int = 1000
    actions: list[ActionInput] = Field(default_factory=list)


# ============================================================================
# Session Base & Create
# ============================================================================


class SessionBase(BaseSchema):
    """Base session fields."""

    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    movie_id: str | None = None
    movie_title: str | None = None
    movie_poster_url: str | None = None
    movie_source_id: str | None = None
    movie_source: str | None = None
    scheduled_at: datetime | None = None
    auto_resume_enabled: bool = True
    color_palette: dict | None = None


class SessionCreate(SessionBase):
    """Schema for creating a session."""

    sequences: list[SequenceInput] = Field(default_factory=list)
    workflow: dict | None = None  # JSON workflow data (nodes, edges)

    # Movie selection mode
    movie_selection_mode: MovieSelectionMode = MovieSelectionMode.FIXED

    # For VOTE mode: create inline or link existing
    vote_session_config: dict | None = None  # VoteSessionCreate fields
    linked_vote_session_id: str | None = None

    # For MYSTERY mode
    mystery_reveal_at: datetime | None = None
    mystery_config: MysteryConfig | None = None

    # Template override (if None, uses globally active template)
    template_id: str | None = None


class SessionUpdate(BaseSchema):
    """Schema for updating a session."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    movie_id: str | None = None
    movie_title: str | None = None
    movie_poster_url: str | None = None
    movie_source_id: str | None = None
    movie_source: str | None = None
    scheduled_at: datetime | None = None
    auto_resume_enabled: bool | None = None
    sequences: list[SequenceInput] | None = None
    workflow: dict | None = None  # JSON workflow data (nodes, edges)
    color_palette: dict | None = None

    # Movie selection mode
    movie_selection_mode: MovieSelectionMode | None = None

    # For VOTE mode
    vote_session_config: dict | None = None
    linked_vote_session_id: str | None = None

    # For MYSTERY mode
    mystery_reveal_at: datetime | None = None
    mystery_config: MysteryConfig | None = None

    # Template override (if None, uses globally active template)
    template_id: str | None = None


# ============================================================================
# Session Response
# ============================================================================


class TemplateSummary(BaseSchema):
    """Summary of a template for embedding in session."""

    id: str
    name: str
    template_type: str


class SessionResponse(SessionBase, IDTimestampSchema):
    """Session response with full details."""

    status: SessionStatus
    started_at: datetime | None
    completed_at: datetime | None
    current_sequence_index: int
    current_sequence_elapsed_ms: int
    total_sequences: int = 0

    # Movie selection mode fields
    movie_selection_mode: MovieSelectionMode = MovieSelectionMode.FIXED
    movie_resolved: bool = False
    movie_resolved_at: datetime | None = None
    linked_vote_session_id: str | None = None
    mystery_reveal_at: datetime | None = None
    mystery_config: MysteryConfig | None = None

    # Template override
    template_id: str | None = None
    template: TemplateSummary | None = None

    # List view enriched fields
    linked_vote_session: VoteSessionSummary | None = None
    participants_accepted: int = 0
    participants_total: int = 0
    actions_count: int = 0


class SessionDetailResponse(SessionResponse):
    """Session response with sequences included."""

    sequences: list[SequenceSummary] = []
    current_sequence: SequenceSummary | None = None
    workflow: dict | None = None
    linked_vote_session: VoteSessionSummary | None = None


class SessionListResponse(BaseSchema):
    """List of sessions response."""

    items: list[SessionResponse]
    total: int


# ============================================================================
# Session State (for WebSocket)
# ============================================================================


class SessionState(BaseSchema):
    """Real-time session state for WebSocket updates."""

    session_id: str
    status: SessionStatus
    current_sequence_index: int
    current_sequence_elapsed_ms: int
    total_sequences: int
    current_sequence: SequenceSummary | None = None


class SequenceTransition(BaseSchema):
    """Sequence transition event."""

    session_id: str
    from_sequence: SequenceSummary | None
    to_sequence: SequenceSummary | None
    transition_ms: int


# ============================================================================
# Session Control
# ============================================================================


class SessionControlRequest(BaseSchema):
    """Request to control a session."""

    action: SessionControlAction


class SessionControlResponse(BaseSchema):
    """Response from session control action."""

    success: bool
    action: SessionControlAction
    session_id: str
    new_state: SessionState | None = None
    message: str | None = None
