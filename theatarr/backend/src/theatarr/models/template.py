"""Template model for Theatarr wallmount display."""

from enum import Enum

from sqlalchemy import String, Text, Boolean
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column

from theatarr.database import Base
from theatarr.models.base import TimestampMixin, UUIDMixin


class TemplateType(str, Enum):
    """Type of wallmount template."""

    COUNTDOWN = "countdown"
    MOVIE_INFO = "movie_info"
    SESSION_STATUS = "session_status"
    CUSTOM = "custom"


class Template(UUIDMixin, TimestampMixin, Base):
    """Wallmount display template.

    Templates define the layout and content displayed on the wallmount
    screen during different phases of a cinema session.
    """

    __tablename__ = "templates"

    # Basic info
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    template_type: Mapped[TemplateType] = mapped_column(
        String(50),
        default=TemplateType.CUSTOM,
    )

    # Template content (HTML/CSS/JS or structured data)
    content: Mapped[str | None] = mapped_column(Text)  # HTML template
    styles: Mapped[str | None] = mapped_column(Text)  # CSS styles
    script: Mapped[str | None] = mapped_column(Text)  # JavaScript

    # Structured layout (alternative to raw HTML)
    layout: Mapped[dict | None] = mapped_column(JSON)

    # Configuration
    config: Mapped[dict | None] = mapped_column(JSON, default=dict)

    # Flags
    is_builtin: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Preview
    preview_url: Mapped[str | None] = mapped_column(String(500))
    thumbnail_url: Mapped[str | None] = mapped_column(String(500))

    def render_context(self, data: dict) -> dict:
        """Prepare template context with data."""
        return {
            "template_id": self.id,
            "template_name": self.name,
            "template_type": self.template_type,
            "content": self.content,
            "styles": self.styles,
            "script": self.script,
            "layout": self.layout,
            "config": self.config or {},
            "data": data,
        }

    def __repr__(self) -> str:
        return f"<Template(id={self.id}, name='{self.name}', type={self.template_type})>"


# Built-in template configurations
BUILTIN_TEMPLATES = {
    "countdown": {
        "name": "Countdown Timer",
        "description": "Shows countdown until session starts with movie poster background",
        "template_type": TemplateType.COUNTDOWN,
        "is_builtin": True,
        "layout": {
            "components": [
                {"type": "backdrop", "opacity": 0.3},
                {"type": "poster", "position": "left", "size": "large"},
                {"type": "countdown", "position": "center", "format": "hh:mm:ss"},
                {"type": "title", "position": "bottom"},
            ]
        },
        "config": {
            "show_seconds": True,
            "animate_numbers": True,
            "use_palette_colors": True,
        },
    },
    "movie_info": {
        "name": "Movie Information",
        "description": "Displays detailed movie information with poster and metadata",
        "template_type": TemplateType.MOVIE_INFO,
        "is_builtin": True,
        "layout": {
            "components": [
                {"type": "backdrop", "opacity": 0.2, "blur": 20},
                {"type": "poster", "position": "left", "size": "medium"},
                {"type": "title", "position": "top-right"},
                {"type": "metadata", "fields": ["year", "runtime", "rating"]},
                {"type": "overview", "max_lines": 5},
                {"type": "cast", "limit": 5},
            ]
        },
        "config": {
            "show_rating": True,
            "show_genres": True,
            "animate_entry": True,
        },
    },
    "session_status": {
        "name": "Session Status",
        "description": "Shows current session progress and sequence information",
        "template_type": TemplateType.SESSION_STATUS,
        "is_builtin": True,
        "layout": {
            "components": [
                {"type": "session_progress"},
                {"type": "current_sequence"},
                {"type": "upcoming_sequences", "limit": 3},
            ]
        },
        "config": {
            "show_elapsed_time": True,
            "show_remaining_time": True,
        },
    },
}
