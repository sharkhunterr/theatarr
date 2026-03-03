"""Feedback Pydantic schemas for Theatarr."""

from datetime import datetime
from typing import Any

from pydantic import Field, field_validator

from theatarr.schemas.base import BaseSchema


# ---------------------------------------------------------------------------
# Category definitions
# ---------------------------------------------------------------------------

FEEDBACK_CATEGORY_MAP: dict[str, dict[str, str]] = {
    "media": {
        "label_fr": "Film",
        "label_en": "Film",
        "icon": "film",
    },
    "lighting": {
        "label_fr": "Ambiance lumineuse",
        "label_en": "Lighting ambiance",
        "icon": "lightbulb",
    },
    "audio": {
        "label_fr": "Audio / Son",
        "label_en": "Audio / Sound",
        "icon": "volume-2",
    },
    "display": {
        "label_fr": "Affichages visuels",
        "label_en": "Visual displays",
        "icon": "monitor",
    },
    "actuator": {
        "label_fr": "Automatisation / Effets",
        "label_en": "Automation / Effects",
        "icon": "zap",
    },
    "organisation": {
        "label_fr": "Organisation generale",
        "label_en": "Overall organization",
        "icon": "clipboard-check",
    },
}

VALID_CATEGORY_SLUGS = set(FEEDBACK_CATEGORY_MAP.keys())


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class FeedbackRatingItem(BaseSchema):
    """A single category rating within a feedback submission."""

    rating: int = Field(..., ge=1, le=10)
    comment: str | None = Field(default=None, max_length=1000)


class FeedbackSubmit(BaseSchema):
    """Schema for submitting session feedback from the portal."""

    ratings: dict[str, FeedbackRatingItem] = Field(
        ...,
        description="Ratings keyed by category slug",
    )

    @field_validator("ratings")
    @classmethod
    def validate_categories(
        cls, v: dict[str, FeedbackRatingItem],
    ) -> dict[str, FeedbackRatingItem]:
        if not v:
            raise ValueError("At least one rating is required")
        for key in v:
            if key not in VALID_CATEGORY_SLUGS:
                raise ValueError(
                    f"Invalid category: {key}. "
                    f"Valid: {', '.join(sorted(VALID_CATEGORY_SLUGS))}"
                )
        if "organisation" not in v:
            raise ValueError("'organisation' category rating is required")
        return v


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class FeedbackCategoryInfo(BaseSchema):
    """Category definition returned to the frontend."""

    slug: str
    label_fr: str
    label_en: str
    icon: str


class FeedbackCategoriesResponse(BaseSchema):
    """Response listing applicable categories for a session."""

    session_id: str
    categories: list[FeedbackCategoryInfo]
    has_submitted: bool
    session_name: str
    movie_title: str | None = None
    movie_poster_url: str | None = None
    scheduled_at: datetime | None = None
    completed_at: datetime | None = None


class FeedbackEntryResponse(BaseSchema):
    """Individual feedback entry (for admin view)."""

    id: str
    user_id: str
    username: str
    ratings: dict[str, dict[str, Any]]
    overall_rating: float
    submitted_at: datetime


class FeedbackCategoryAverage(BaseSchema):
    """Average rating for a single category."""

    slug: str
    label_fr: str
    label_en: str
    average: float
    count: int


class FeedbackSummaryResponse(BaseSchema):
    """Aggregated feedback summary for admin view."""

    session_id: str
    total_submissions: int
    overall_average: float
    category_averages: list[FeedbackCategoryAverage]
    entries: list[FeedbackEntryResponse]


class FeedbackStatusResponse(BaseSchema):
    """Lightweight feedback status for session list badges."""

    has_submitted: bool
    feedback_count: int
    overall_average: float | None = None
