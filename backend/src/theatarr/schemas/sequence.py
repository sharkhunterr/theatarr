"""Pydantic schemas for Sequence API."""

from enum import Enum
from typing import Any

from pydantic import Field

from theatarr.schemas.base import BaseSchema, IDTimestampSchema


class DurationType(str, Enum):
    """Type of sequence duration."""

    FIXED = "fixed"
    DYNAMIC = "dynamic"
    MANUAL = "manual"


class ActionType(str, Enum):
    """Type of action."""

    LIGHTING = "lighting"
    AUDIO = "audio"
    DISPLAY = "display"
    MEDIA = "media"
    ACTUATOR = "actuator"


class OnFailure(str, Enum):
    """Behavior when action fails."""

    WARN = "warn"
    SKIP = "skip"
    ABORT = "abort"


# ============================================================================
# Action Schemas
# ============================================================================


class ActionBase(BaseSchema):
    """Base action fields."""

    action_type: ActionType
    command: str = Field(..., min_length=1, max_length=100)
    parameters: dict[str, Any] = Field(default_factory=dict)
    delay_ms: int = Field(default=0, ge=0)
    on_failure: OnFailure = OnFailure.WARN
    service_id: str | None = None


class ActionCreate(ActionBase):
    """Schema for creating an action."""

    pass


class ActionUpdate(BaseSchema):
    """Schema for updating an action."""

    action_type: ActionType | None = None
    command: str | None = Field(default=None, min_length=1, max_length=100)
    parameters: dict[str, Any] | None = None
    delay_ms: int | None = Field(default=None, ge=0)
    on_failure: OnFailure | None = None
    service_id: str | None = None


class ActionResponse(ActionBase, IDTimestampSchema):
    """Action response."""

    sequence_id: str


# ============================================================================
# Sequence Schemas
# ============================================================================


class SequenceBase(BaseSchema):
    """Base sequence fields."""

    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    duration_type: DurationType = DurationType.FIXED
    duration_ms: int | None = Field(default=None, ge=0)
    duration_fallback_ms: int = Field(default=60000, ge=1000)
    transition_ms: int = Field(default=1000, ge=0, le=30000)


class SequenceCreate(SequenceBase):
    """Schema for creating a sequence."""

    order_index: int | None = None  # Auto-assigned if not provided
    actions: list[ActionCreate] = Field(default_factory=list)


class SequenceUpdate(BaseSchema):
    """Schema for updating a sequence."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    duration_type: DurationType | None = None
    duration_ms: int | None = None
    duration_fallback_ms: int | None = Field(default=None, ge=1000)
    transition_ms: int | None = Field(default=None, ge=0, le=30000)
    node_editor_data: dict[str, Any] | None = None


class SequenceResponse(SequenceBase, IDTimestampSchema):
    """Sequence response."""

    session_id: str
    order_index: int
    node_editor_data: dict[str, Any] | None = None
    total_actions: int = 0


class SequenceDetailResponse(SequenceResponse):
    """Sequence response with actions included."""

    actions: list[ActionResponse] = []


class SequenceListResponse(BaseSchema):
    """List of sequences response."""

    items: list[SequenceResponse]
    total: int


# ============================================================================
# Sequence Reorder
# ============================================================================


class SequenceReorderItem(BaseSchema):
    """Item in sequence reorder request."""

    id: str
    order_index: int


class SequenceReorderRequest(BaseSchema):
    """Request to reorder sequences."""

    sequences: list[SequenceReorderItem]


class SequenceDuplicateRequest(BaseSchema):
    """Request to duplicate a sequence."""

    new_name: str | None = None
    include_actions: bool = True
