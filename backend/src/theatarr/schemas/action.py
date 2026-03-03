"""Pydantic schemas for Action validation."""

from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator


class ActionType(str, Enum):
    """Type of action."""

    LIGHTING = "lighting"
    AUDIO = "audio"
    DISPLAY = "display"
    MEDIA = "media"
    ACTUATOR = "actuator"


# ============================================================================
# Lighting Action Parameters
# ============================================================================


class LightingParameters(BaseModel):
    """Parameters for lighting actions."""

    color: str | None = Field(
        default=None,
        pattern=r"^#[0-9A-Fa-f]{6}$",
        description="Color in hex format (#RRGGBB)",
    )
    intensity: int | None = Field(
        default=None,
        ge=0,
        le=100,
        description="Light intensity (0-100%)",
    )
    effect: str | None = Field(
        default=None,
        description="Lighting effect (fade, pulse, etc.)",
    )
    transition_ms: int = Field(
        default=1000,
        ge=0,
        le=60000,
        description="Transition duration in ms",
    )
    targets: list[str] = Field(
        default_factory=list,
        description="Target lights or groups (e.g., 'group:living-room', 'light:lamp-1')",
    )


LIGHTING_COMMANDS = ["set_color", "set_effect", "power", "fade", "pulse"]


# ============================================================================
# Audio Action Parameters
# ============================================================================


class AudioSource(str, Enum):
    """Audio source type."""

    LOCAL = "local"
    URL = "url"
    STREAM = "stream"


class AudioParameters(BaseModel):
    """Parameters for audio actions."""

    source: AudioSource = AudioSource.LOCAL
    path: str | None = Field(
        default=None,
        description="Path to audio file (for local source)",
    )
    url: str | None = Field(
        default=None,
        description="URL to audio stream",
    )
    volume: int = Field(
        default=50,
        ge=0,
        le=100,
        description="Volume level (0-100%)",
    )
    fade_in_ms: int = Field(
        default=0,
        ge=0,
        description="Fade in duration in ms",
    )
    fade_out_ms: int = Field(
        default=0,
        ge=0,
        description="Fade out duration in ms",
    )
    loop: bool = Field(
        default=False,
        description="Loop audio playback",
    )

    @model_validator(mode="after")
    def validate_source_path(self) -> "AudioParameters":
        """Ensure path or url is provided based on source."""
        if self.source == AudioSource.LOCAL and not self.path:
            raise ValueError("path is required for local audio source")
        if self.source == AudioSource.URL and not self.url:
            raise ValueError("url is required for URL audio source")
        return self


AUDIO_COMMANDS = ["play", "pause", "stop", "set_volume", "fade_in", "fade_out"]


# ============================================================================
# Display Action Parameters
# ============================================================================


class DisplayMode(str, Enum):
    """Display mode."""

    WALLMOUNT = "wallmount"
    BLANK = "blank"
    IMAGE = "image"
    VIDEO = "video"


class DisplayParameters(BaseModel):
    """Parameters for display actions."""

    mode: DisplayMode = DisplayMode.WALLMOUNT
    template_id: str | None = Field(
        default=None,
        description="Template ID for wallmount mode",
    )
    content: str | None = Field(
        default=None,
        description="Content type (movie_info, countdown, etc.)",
    )
    image_url: str | None = Field(
        default=None,
        description="Image URL for image mode",
    )
    video_url: str | None = Field(
        default=None,
        description="Video URL for video mode",
    )


DISPLAY_COMMANDS = ["show", "hide", "set_template", "set_content"]


# ============================================================================
# Media Action Parameters
# ============================================================================


class MediaAction(str, Enum):
    """Media player action."""

    PLAY = "play"
    PAUSE = "pause"
    STOP = "stop"
    SEEK = "seek"


class MediaParameters(BaseModel):
    """Parameters for media actions."""

    action: MediaAction = MediaAction.PLAY
    media_id: str | None = Field(
        default=None,
        description="Media ID (e.g., plex://movie/12345)",
    )
    position_ms: int = Field(
        default=0,
        ge=0,
        description="Playback position in ms",
    )
    player_id: str | None = Field(
        default=None,
        description="Target player service ID",
    )


MEDIA_COMMANDS = ["play", "pause", "stop", "seek", "next", "previous"]


# ============================================================================
# Actuator Action Parameters
# ============================================================================


class ActuatorParameters(BaseModel):
    """Parameters for actuator actions."""

    device: str = Field(..., description="Device identifier")
    command: str = Field(..., description="Command to execute")
    value: Any = Field(default=None, description="Command value")


ACTUATOR_COMMANDS = ["power_on", "power_off", "toggle", "set_position", "execute"]


# ============================================================================
# Parameter Validation
# ============================================================================


def validate_action_parameters(
    action_type: ActionType,
    command: str,
    parameters: dict[str, Any],
) -> dict[str, Any]:
    """Validate and normalize action parameters based on type.

    Args:
        action_type: The type of action
        command: The command to execute
        parameters: Raw parameters dict

    Returns:
        Validated and normalized parameters

    Raises:
        ValueError: If parameters are invalid
    """
    # Validate command
    valid_commands = {
        ActionType.LIGHTING: LIGHTING_COMMANDS,
        ActionType.AUDIO: AUDIO_COMMANDS,
        ActionType.DISPLAY: DISPLAY_COMMANDS,
        ActionType.MEDIA: MEDIA_COMMANDS,
        ActionType.ACTUATOR: ACTUATOR_COMMANDS,
    }

    if command not in valid_commands.get(action_type, []):
        raise ValueError(
            f"Invalid command '{command}' for action type '{action_type}'. "
            f"Valid commands: {valid_commands.get(action_type, [])}"
        )

    # Validate parameters based on type
    param_models = {
        ActionType.LIGHTING: LightingParameters,
        ActionType.AUDIO: AudioParameters,
        ActionType.DISPLAY: DisplayParameters,
        ActionType.MEDIA: MediaParameters,
        ActionType.ACTUATOR: ActuatorParameters,
    }

    model = param_models.get(action_type)
    if model:
        validated = model(**parameters)
        return validated.model_dump(exclude_unset=True)

    return parameters


# ============================================================================
# Action Parameter Schemas (for OpenAPI docs)
# ============================================================================


class ActionParametersSchema(BaseModel):
    """Union of all action parameter types for documentation."""

    # Common
    targets: list[str] | None = None

    # Lighting
    color: str | None = None
    intensity: int | None = None
    effect: str | None = None
    transition_ms: int | None = None

    # Audio
    source: str | None = None
    path: str | None = None
    url: str | None = None
    volume: int | None = None
    fade_in_ms: int | None = None
    fade_out_ms: int | None = None
    loop: bool | None = None

    # Display
    mode: str | None = None
    template_id: str | None = None
    content: str | None = None
    image_url: str | None = None
    video_url: str | None = None

    # Media
    action: str | None = None
    media_id: str | None = None
    position_ms: int | None = None
    player_id: str | None = None

    # Actuator
    device: str | None = None
    command: str | None = None
    value: Any = None
