"""Quiz Pydantic schemas for Theatarr."""

from datetime import datetime
from typing import Any

from pydantic import Field

from theatarr.schemas.base import BaseSchema


class QuizQuestion(BaseSchema):
    """A single quiz question."""

    text: str = Field(..., min_length=1)
    choices: list[str] = Field(..., min_length=2, max_length=6)
    correct_indices: list[int] = Field(..., min_length=1)
    allow_multiple: bool = False
    time_limit_seconds: int | None = Field(default=None, ge=5, le=300)
    hint: str | None = None
    image_url: str | None = None


class QuizConfig(BaseSchema):
    """Quiz configuration."""

    show_live_results: str = Field(default="anonymous")  # anonymous|named|disabled
    show_scores_live: bool = False
    auto_advance: bool = True
    default_time_limit_seconds: int = Field(default=30, ge=5, le=300)
    show_feedback: bool = True  # Show correct answers between questions
    feedback_delay_seconds: int = Field(default=5, ge=2, le=30)  # Feedback display duration


class QuizSessionCreate(BaseSchema):
    """Schema for creating a quiz session."""

    name: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    questions: list[QuizQuestion] = Field(..., min_length=1)
    config: QuizConfig = Field(default_factory=QuizConfig)
    template_id: str | None = None


class QuizSessionUpdate(BaseSchema):
    """Schema for updating a quiz session."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    questions: list[QuizQuestion] | None = None
    config: QuizConfig | None = None
    template_id: str | None = None


class QuizSessionResponse(BaseSchema):
    """Quiz session response for admin."""

    id: str
    name: str
    description: str | None
    status: str
    questions: list[dict[str, Any]] | None
    config: dict[str, Any] | None
    current_question_index: int
    question_count: int
    participant_count: int
    template_id: str | None = None
    template_name: str | None = None
    started_at: datetime | None
    ended_at: datetime | None
    created_at: datetime
    updated_at: datetime


class QuizDisplayState(BaseSchema):
    """Full quiz state for display/kiosk rendering."""

    quiz_session_id: str
    name: str
    status: str
    phase: str  # waiting | question | feedback | results | podium
    current_question_index: int
    total_questions: int
    current_question: dict[str, Any] | None = None
    correct_indices: list[int] | None = None
    time_remaining_seconds: float | None = None
    participants: list[dict[str, Any]] = Field(default_factory=list)
    scoreboard: list[dict[str, Any]] = Field(default_factory=list)
    answer_distribution: dict[str, int] | None = None
    join_url: str | None = None
    join_code: str | None = None


class QuizSessionListResponse(BaseSchema):
    """List of quiz sessions."""

    items: list[QuizSessionResponse]
    total: int


class QuizSessionPublicResponse(BaseSchema):
    """Public quiz session info (for participants). No correct answers."""

    id: str
    name: str
    description: str | None
    status: str
    question_count: int
    current_question_index: int
    current_question: dict[str, Any] | None = None  # text, choices, allow_multiple, time_limit — NO correct_indices
    time_remaining_seconds: int | None = None
    config: dict[str, Any] | None = None  # safe fields only
    participant_count: int = 0
    participant_name: str | None = None  # caller's name if joined
    my_score: int = 0


class QuizTokenCreate(BaseSchema):
    """Schema for creating quiz tokens."""

    count: int = Field(default=1, ge=1, le=100)
    label_prefix: str | None = Field(default=None, max_length=50)


class QuizTokenResponse(BaseSchema):
    """Quiz token response."""

    id: str
    token: str
    label: str | None
    participant_name: str | None
    is_active: bool
    joined_at: datetime | None
    quiz_url: str | None = None


class QuizTokenListResponse(BaseSchema):
    """List of quiz tokens."""

    items: list[QuizTokenResponse]
    total: int


class QuizJoin(BaseSchema):
    """Schema for joining a quiz."""

    participant_name: str = Field(..., min_length=1, max_length=100)


class QuizAnswerSubmit(BaseSchema):
    """Schema for submitting a quiz answer."""

    question_index: int = Field(..., ge=0)
    selected_indices: list[int] = Field(..., min_length=1)
    response_time_ms: int | None = None


class QuizAnswerResponse(BaseSchema):
    """Response after submitting an answer."""

    is_correct: bool
    correct_indices: list[int]
    score: int  # cumulative score so far


class QuizScoreboardEntry(BaseSchema):
    """A single entry in the scoreboard."""

    token_id: str
    participant_name: str
    score: int
    total_answered: int
    avg_response_time_ms: int | None


class QuizResultsResponse(BaseSchema):
    """Full quiz results."""

    quiz_session_id: str
    status: str
    question_count: int
    scoreboard: list[QuizScoreboardEntry]
    question_stats: list[dict[str, Any]]
