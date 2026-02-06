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
    "poster_focus": {
        "name": "Affiche Plein Ecran",
        "description": "Affiche en plein ecran avec compte a rebours discret en bas",
        "template_type": TemplateType.COUNTDOWN,
        "is_builtin": True,
        "layout": {
            "style": "poster-fullscreen",
            "components": [
                {"type": "poster", "position": "fullscreen"},
                {"type": "gradient_overlay", "position": "bottom", "height": "30%"},
                {"type": "title", "position": "bottom-center", "size": "xlarge"},
                {"type": "countdown", "position": "bottom-center", "size": "large"},
            ]
        },
        "config": {
            "show_seconds": True,
            "animate_numbers": True,
        },
    },
    "split_horizontal": {
        "name": "Ecran Divise",
        "description": "Affiche a gauche, informations detaillees a droite (realisateur, genres, resume, note, votes)",
        "template_type": TemplateType.MOVIE_INFO,
        "is_builtin": True,
        "layout": {
            "style": "split-horizontal",
            "components": [
                {"type": "poster", "position": "left", "size": "40%"},
                {"type": "info_panel", "position": "right"},
                {"type": "title", "size": "xlarge"},
                {"type": "tagline", "style": "italic"},
                {"type": "genres"},
                {"type": "directors"},
                {"type": "cast", "limit": 4},
                {"type": "overview", "max_lines": 4},
                {"type": "metadata", "fields": ["year", "runtime", "rating", "votes"]},
                {"type": "countdown", "size": "large", "style": "prominent"},
                {"type": "session_info", "fields": ["name", "scheduled_at"]},
            ]
        },
        "config": {
            "show_seconds": True,
            "show_rating": True,
            "show_votes": True,
            "show_genres": True,
            "show_director": True,
            "show_overview": True,
            "use_palette_colors": True,
        },
    },
    "cinema_classic": {
        "name": "Cinema Classique",
        "description": "Style cinema retro avec texte defilant et effets lumineux",
        "template_type": TemplateType.MOVIE_INFO,
        "is_builtin": True,
        "layout": {
            "style": "cinema-marquee",
            "components": [
                {"type": "backdrop", "opacity": 0.2, "blur": 20},
                {"type": "marquee", "position": "top", "text": "title", "speed": "slow"},
                {"type": "poster", "position": "center", "size": "large"},
                {"type": "blink", "position": "corners", "text": "countdown_short"},
                {"type": "marquee", "position": "bottom", "text": "session_name", "speed": "medium"},
            ]
        },
        "config": {
            "enable_glow_effects": True,
            "blink_interval": 800,
            "marquee_speed": 40,
        },
    },
    "minimal_countdown": {
        "name": "Compte a Rebours Minimal",
        "description": "Design minimaliste centre sur le compte a rebours",
        "template_type": TemplateType.COUNTDOWN,
        "is_builtin": True,
        "layout": {
            "style": "minimal-center",
            "components": [
                {"type": "backdrop", "opacity": 0.1, "blur": 50},
                {"type": "session_info", "position": "top-center", "fields": ["name"]},
                {"type": "countdown", "position": "center", "size": "giant"},
                {"type": "title", "position": "bottom-center", "size": "medium"},
                {"type": "poster", "position": "bottom-right", "size": "thumbnail"},
            ]
        },
        "config": {
            "show_seconds": True,
            "animate_numbers": True,
        },
    },
    "modern_gradient": {
        "name": "Moderne Degrade",
        "description": "Design moderne avec degrade et typographie elegante",
        "template_type": TemplateType.MOVIE_INFO,
        "is_builtin": True,
        "layout": {
            "style": "modern-gradient",
            "components": [
                {"type": "backdrop", "opacity": 0.5, "gradient": "left-to-right"},
                {"type": "poster", "position": "right", "size": "full-height", "shadow": True},
                {"type": "title", "position": "left", "size": "xlarge", "weight": "bold"},
                {"type": "tagline", "style": "italic"},
                {"type": "metadata", "fields": ["year", "runtime", "rating"]},
                {"type": "countdown", "size": "large"},
                {"type": "session_info", "position": "top-left", "fields": ["name", "scheduled_at"]},
            ]
        },
        "config": {
            "gradient_direction": "to-right",
            "gradient_opacity": 0.8,
            "use_palette_colors": True,
            "font_family": "modern",
            "text_shadow": True,
            "card_style": "glass",
            "show_logo": True,
        },
    },
}
