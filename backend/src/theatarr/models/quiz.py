"""Quiz models for Theatarr - interactive quiz system."""

from datetime import datetime
from enum import Enum

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, Index
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from theatarr.database import Base
from theatarr.models.base import TimestampMixin, UUIDMixin


class QuizSessionStatus(str, Enum):
    """Quiz session status."""

    DRAFT = "draft"
    OPEN = "open"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class QuizSession(Base, UUIDMixin, TimestampMixin):
    """Quiz session model for interactive quizzes.

    An admin creates a quiz with multiple questions. Participants join
    via token or portal, then answer questions in real-time.
    """

    __tablename__ = "quiz_sessions"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[QuizSessionStatus] = mapped_column(
        String(20),
        default=QuizSessionStatus.DRAFT,
        nullable=False,
    )

    # Questions stored as JSON array of dicts:
    # { text, choices: str[], correct_indices: int[], allow_multiple: bool,
    #   time_limit_seconds: int|null, hint: str|null, image_url: str|null }
    questions: Mapped[list | None] = mapped_column(JSON, nullable=True)

    # Configuration JSON:
    # { show_live_results: "anonymous"|"named"|"disabled",
    #   show_scores_live: bool, auto_advance: bool,
    #   default_time_limit_seconds: int }
    config: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Quiz progression
    current_question_index: Mapped[int] = mapped_column(Integer, default=-1)
    current_question_started_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True
    )

    # Timing
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Display template associated with this quiz
    template_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("templates.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Owner
    created_by: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    tokens: Mapped[list["QuizToken"]] = relationship(
        "QuizToken",
        back_populates="quiz_session",
        cascade="all, delete-orphan",
    )
    answers: Mapped[list["QuizAnswer"]] = relationship(
        "QuizAnswer",
        back_populates="quiz_session",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("idx_quiz_sessions_status", "status"),
    )

    @property
    def question_count(self) -> int:
        """Get the number of questions."""
        return len(self.questions) if self.questions else 0

    @property
    def participant_count(self) -> int:
        """Get the number of participants who joined."""
        if not self.tokens:
            return 0
        return sum(1 for t in self.tokens if t.joined_at is not None)


class QuizToken(Base, UUIDMixin, TimestampMixin):
    """Token for accessing a quiz session."""

    __tablename__ = "quiz_tokens"

    quiz_session_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("quiz_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Token value (short code for sharing)
    token: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)

    # Optional label (e.g., "Guest 1")
    label: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Participant name (set when joining)
    participant_name: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Link to user if authenticated
    user_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    joined_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Relationships
    quiz_session: Mapped["QuizSession"] = relationship(
        "QuizSession",
        back_populates="tokens",
    )
    answers: Mapped[list["QuizAnswer"]] = relationship(
        "QuizAnswer",
        back_populates="token",
    )

    __table_args__ = (
        Index("idx_quiz_tokens_token", "token"),
        Index("idx_quiz_tokens_session_id", "quiz_session_id"),
        Index("idx_quiz_tokens_user_id", "user_id"),
    )

    @property
    def is_valid(self) -> bool:
        """Check if token is still valid."""
        return self.is_active


class QuizAnswer(Base, UUIDMixin, TimestampMixin):
    """Individual answer in a quiz session."""

    __tablename__ = "quiz_answers"

    quiz_session_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("quiz_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )

    token_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("quiz_tokens.id", ondelete="CASCADE"),
        nullable=False,
    )

    question_index: Mapped[int] = mapped_column(Integer, nullable=False)
    selected_indices: Mapped[list | None] = mapped_column(JSON, nullable=True)
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False)
    answered_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    response_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Relationships
    quiz_session: Mapped["QuizSession"] = relationship(
        "QuizSession",
        back_populates="answers",
    )
    token: Mapped["QuizToken"] = relationship(
        "QuizToken",
        back_populates="answers",
    )

    __table_args__ = (
        Index("idx_quiz_answers_session_id", "quiz_session_id"),
        Index("idx_quiz_answers_token_id", "token_id"),
        Index("idx_quiz_answers_question", "quiz_session_id", "question_index"),
    )
