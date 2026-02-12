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
    WAITING_SCREEN = "waiting_screen"
    QUIZ = "quiz"
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
    "responsive_badge": {
        "name": "Responsive avec Badge",
        "description": "Design responsive qui s'adapte a toutes les resolutions avec badge anime Prochainement",
        "template_type": TemplateType.MOVIE_INFO,
        "is_builtin": True,
        "layout": {
            "style": "responsive-badge",
            "components": [
                {"type": "backdrop", "opacity": 0.3, "blur": 30},
                {"type": "badge", "text": "Prochainement", "position": "top-right", "style": "pulse"},
                {"type": "poster", "position": "left", "size": "responsive"},
                {"type": "info_panel", "position": "right"},
                {"type": "title", "size": "responsive"},
                {"type": "tagline", "style": "italic"},
                {"type": "genres"},
                {"type": "directors"},
                {"type": "cast", "limit": 4},
                {"type": "overview", "max_lines": 4},
                {"type": "metadata", "fields": ["year", "runtime", "rating", "votes"]},
                {"type": "countdown", "size": "responsive", "style": "prominent"},
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
            "badge_style": "modern",
            "badge_animation": "pulse-glow",
            "responsive_breakpoints": {
                "sm": 640,
                "md": 768,
                "lg": 1024,
                "xl": 1280,
                "2xl": 1536,
            },
        },
    },
    # ============================================================
    # NOUVEAUX TEMPLATES AVEC PROPS DYNAMIQUES
    # ============================================================
    # Props dynamiques disponibles:
    # - badge.text: Texte fixe ou variable ({{countdown_short}}, {{session.name}}, {{date}})
    # - badge.show_when: "always", "scheduled", "running", "countdown_under_24h"
    # - badge.style: "pulse", "glow", "shimmer", "neon", "solid", "outline", "gradient"
    # - badge.position: "top-left", "top-right", "bottom-left", "bottom-right", "top-center"
    # - badge.color: Couleur fixe (#hex) ou "palette.vibrant", "palette.accent", "palette.primary"
    # - custom_texts[]: Textes personnalises avec position et style
    # - overlay.type: "gradient", "vignette", "spotlight", "none"
    # - theme: "dark", "light", "neon", "elegant", "retro"
    # ============================================================
    "neon_retro": {
        "name": "Neon Retro",
        "description": "Style annees 80 avec effets neon lumineux et grille retro",
        "template_type": TemplateType.MOVIE_INFO,
        "is_builtin": True,
        "layout": {
            "style": "neon-retro",
            "components": [
                {"type": "backdrop", "opacity": 0.15, "blur": 5},
                {"type": "grid_overlay"},
                {"type": "badge", "text": "{{countdown_short}}", "position": "top-right", "style": "neon"},
                {"type": "poster", "position": "center", "size": "medium", "effect": "neon-border"},
                {"type": "title", "size": "xlarge", "style": "neon-glow"},
                {"type": "custom_text", "text": "SEANCE CINEMA", "position": "top-center", "style": "retro-subtitle"},
                {"type": "metadata", "fields": ["year", "runtime", "rating"]},
                {"type": "countdown", "size": "large", "style": "digital"},
            ]
        },
        "config": {
            "theme": "neon",
            "neon_color": "#ff00ff",
            "secondary_neon": "#00ffff",
            "show_grid": True,
            "grid_color": "rgba(255, 0, 255, 0.1)",
            "scanlines": True,
            "badge": {
                "text": "{{countdown_short}}",
                "show_when": "always",
                "style": "neon",
                "color": "#00ffff",
            },
            "custom_texts": [
                {"text": "SEANCE CINEMA", "position": "top-center", "style": "neon-subtitle"},
                {"text": "{{session.name}}", "position": "bottom-center", "style": "neon-name"},
            ],
        },
    },
    "elegant_premium": {
        "name": "Elegant Premium",
        "description": "Design luxueux avec accents dores et typographie raffinee",
        "template_type": TemplateType.MOVIE_INFO,
        "is_builtin": True,
        "layout": {
            "style": "elegant-premium",
            "components": [
                {"type": "backdrop", "opacity": 0.4, "blur": 20, "overlay": "vignette"},
                {"type": "decorative_frame", "style": "gold-corners"},
                {"type": "badge", "text": "Avant-Premiere", "position": "top-center", "style": "gold-ribbon"},
                {"type": "poster", "position": "left", "size": "large", "frame": "gold"},
                {"type": "title", "size": "xlarge", "font": "serif", "color": "#d4af37"},
                {"type": "tagline", "style": "elegant-italic"},
                {"type": "divider", "style": "gold-line"},
                {"type": "directors", "label": "Un film de"},
                {"type": "cast", "limit": 3, "label": "Avec"},
                {"type": "metadata", "fields": ["year", "runtime", "rating"], "style": "elegant"},
                {"type": "countdown", "size": "medium", "style": "elegant"},
                {"type": "custom_text", "text": "{{date_full}}", "position": "bottom-right", "style": "date-elegant"},
            ]
        },
        "config": {
            "theme": "elegant",
            "accent_color": "#d4af37",
            "background_color": "#0a0a0f",
            "text_color": "#f5f5f5",
            "font_title": "Playfair Display",
            "font_body": "Cormorant Garamond",
            "show_decorations": True,
            "badge": {
                "text": "Avant-Premiere",
                "show_when": "scheduled",
                "style": "gold-ribbon",
                "color": "#d4af37",
            },
            "custom_texts": [
                {"text": "Projection Exclusive", "position": "top-left", "style": "elegant-label"},
            ],
        },
    },
    "spotlight_dramatic": {
        "name": "Projecteur Dramatique",
        "description": "Effet projecteur cinematographique avec mise en valeur de l'affiche",
        "template_type": TemplateType.MOVIE_INFO,
        "is_builtin": True,
        "layout": {
            "style": "spotlight-dramatic",
            "components": [
                {"type": "backdrop", "opacity": 0.1, "blur": 30},
                {"type": "spotlight_effect", "position": "center", "intensity": 0.8},
                {"type": "particles", "type": "dust", "density": "low"},
                {"type": "poster", "position": "center", "size": "large", "effect": "spotlight"},
                {"type": "title", "size": "xlarge", "position": "bottom", "style": "shadow-strong"},
                {"type": "badge", "text": "Ce Soir", "position": "top-right", "style": "spotlight-badge"},
                {"type": "metadata", "fields": ["year", "runtime"], "position": "bottom"},
                {"type": "countdown", "size": "large", "style": "cinematic"},
            ]
        },
        "config": {
            "theme": "dramatic",
            "spotlight_color": "#ffffff",
            "ambient_color": "#1a1a2e",
            "show_particles": True,
            "particle_color": "rgba(255, 255, 255, 0.3)",
            "badge": {
                "text": "Ce Soir",
                "show_when": "countdown_under_24h",
                "fallback_text": "Prochainement",
                "style": "glow",
                "color": "palette.accent",
            },
        },
    },
    "social_vertical": {
        "name": "Format Vertical Social",
        "description": "Format vertical type Story/TikTok pour affichage portrait",
        "template_type": TemplateType.MOVIE_INFO,
        "is_builtin": True,
        "layout": {
            "style": "social-vertical",
            "components": [
                {"type": "poster", "position": "background", "size": "cover"},
                {"type": "gradient_overlay", "direction": "to-top", "opacity": 0.9},
                {"type": "badge", "text": "BIENTOT", "position": "top-left", "style": "pill-animated"},
                {"type": "logo", "position": "top-right", "size": "small"},
                {"type": "title", "size": "xlarge", "position": "center", "style": "bold-shadow"},
                {"type": "genres", "style": "pills", "limit": 3},
                {"type": "rating_stars", "position": "center"},
                {"type": "countdown", "size": "xlarge", "style": "modern-stack"},
                {"type": "custom_text", "text": "Swipe pour plus d'infos", "position": "bottom", "style": "cta"},
                {"type": "session_info", "fields": ["name"], "position": "bottom"},
            ]
        },
        "config": {
            "theme": "social",
            "aspect_ratio": "9:16",
            "gradient_colors": ["transparent", "rgba(0,0,0,0.8)", "rgba(0,0,0,0.95)"],
            "badge": {
                "text": "BIENTOT",
                "show_when": "always",
                "style": "pill-animated",
                "color": "palette.vibrant",
            },
            "custom_texts": [
                {"text": "Reservez vos places", "position": "bottom", "style": "cta-button"},
            ],
            "animations": {
                "title_entrance": "slide-up",
                "badge_pulse": True,
            },
        },
    },
    "event_board": {
        "name": "Panneau Cinema",
        "description": "Style panneau d'affichage de cinema avec lettres changantes",
        "template_type": TemplateType.MOVIE_INFO,
        "is_builtin": True,
        "layout": {
            "style": "event-board",
            "components": [
                {"type": "board_background"},
                {"type": "board_header", "text": "A L'AFFICHE"},
                {"type": "title", "style": "board-letters", "size": "xlarge"},
                {"type": "board_row", "label": "SEANCE", "value": "{{session.name}}"},
                {"type": "board_row", "label": "HORAIRE", "value": "{{time}}"},
                {"type": "board_row", "label": "DUREE", "value": "{{runtime}}"},
                {"type": "board_row", "label": "NOTE", "value": "{{rating}}/10"},
                {"type": "divider", "style": "board-dots"},
                {"type": "countdown", "style": "flip-clock", "size": "large"},
                {"type": "poster", "position": "right", "size": "medium", "frame": "none"},
            ]
        },
        "config": {
            "theme": "board",
            "board_color": "#1a1a1a",
            "letter_color": "#ffcc00",
            "letter_style": "split-flap",
            "show_frame": True,
            "frame_color": "#333333",
            "badge": {
                "show_when": "never",
            },
            "custom_texts": [
                {"text": "BIENVENUE", "position": "header", "style": "board-welcome"},
            ],
            "animations": {
                "letter_flip": True,
                "flip_duration": 300,
            },
        },
    },
    "glassmorphism": {
        "name": "Verre Moderne",
        "description": "Design glassmorphism avec effets de flou et transparence",
        "template_type": TemplateType.MOVIE_INFO,
        "is_builtin": True,
        "layout": {
            "style": "glassmorphism",
            "components": [
                {"type": "backdrop", "opacity": 1, "blur": 0},
                {"type": "glass_panel", "position": "right", "width": "50%"},
                {"type": "badge", "text": "Nouveau", "position": "top-right", "style": "glass-pill"},
                {"type": "poster", "position": "left", "size": "large", "effect": "float-shadow"},
                {"type": "title", "size": "xlarge", "style": "glass-text"},
                {"type": "tagline", "style": "glass-subtitle"},
                {"type": "genres", "style": "glass-tags"},
                {"type": "metadata", "fields": ["year", "runtime", "rating"], "style": "glass-meta"},
                {"type": "directors"},
                {"type": "overview", "max_lines": 3},
                {"type": "countdown", "size": "large", "style": "glass-countdown"},
            ]
        },
        "config": {
            "theme": "glass",
            "glass_blur": 20,
            "glass_opacity": 0.15,
            "glass_border": "rgba(255, 255, 255, 0.2)",
            "accent_color": "palette.vibrant",
            "badge": {
                "text": "Nouveau",
                "show_when": "always",
                "style": "glass-pill",
                "color": "palette.accent",
            },
            "animations": {
                "float_poster": True,
                "shimmer_glass": True,
            },
        },
    },
    "cinema_tickets": {
        "name": "Ticket de Cinema",
        "description": "Design inspire des tickets de cinema vintage",
        "template_type": TemplateType.MOVIE_INFO,
        "is_builtin": True,
        "layout": {
            "style": "cinema-tickets",
            "components": [
                {"type": "backdrop", "opacity": 0.2, "blur": 10},
                {"type": "ticket_shape", "position": "center"},
                {"type": "ticket_header", "text": "ADMIT ONE"},
                {"type": "poster", "position": "ticket-left", "size": "medium"},
                {"type": "title", "size": "large", "style": "ticket-title"},
                {"type": "ticket_info", "label": "DATE", "value": "{{date}}"},
                {"type": "ticket_info", "label": "HEURE", "value": "{{time}}"},
                {"type": "ticket_info", "label": "SALLE", "value": "{{session.name}}"},
                {"type": "ticket_barcode"},
                {"type": "ticket_number", "text": "#{{session.id_short}}"},
                {"type": "countdown", "style": "ticket", "size": "medium"},
                {"type": "badge", "text": "VIP", "position": "corner", "style": "stamp"},
            ]
        },
        "config": {
            "theme": "ticket",
            "ticket_color": "#f5e6c8",
            "text_color": "#2d2d2d",
            "accent_color": "#c41e3a",
            "show_perforations": True,
            "badge": {
                "text": "VIP",
                "show_when": "always",
                "style": "stamp",
                "color": "#c41e3a",
                "rotation": -15,
            },
            "custom_texts": [
                {"text": "Gardez ce ticket", "position": "bottom", "style": "ticket-note"},
            ],
        },
    },
    "minimal_focus": {
        "name": "Focus Minimal",
        "description": "Design ultra-minimaliste centre sur l'essentiel",
        "template_type": TemplateType.COUNTDOWN,
        "is_builtin": True,
        "layout": {
            "style": "minimal-focus",
            "components": [
                {"type": "color_background", "color": "#000000"},
                {"type": "title", "size": "giant", "position": "center", "style": "minimal"},
                {"type": "countdown", "size": "xlarge", "style": "minimal-digits"},
                {"type": "custom_text", "text": "{{session.name}}", "position": "bottom", "style": "minimal-label"},
            ]
        },
        "config": {
            "theme": "minimal",
            "background_color": "#000000",
            "text_color": "#ffffff",
            "accent_color": "#ffffff",
            "badge": {
                "show_when": "never",
            },
            "show_poster": False,
            "show_metadata": False,
            "typography": "mono",
        },
    },
    "cinematic_immersive": {
        "name": "Cinema Immersif",
        "description": "Fond alternatif plein ecran avec effet Ken Burns, logo HD et infos minimalistes",
        "template_type": TemplateType.MOVIE_INFO,
        "is_builtin": True,
        "layout": {
            "style": "cinematic-immersive",
            "components": [
                {"type": "backdrop", "opacity": 1, "blur": 0},
                {"type": "logo", "position": "bottom-left", "size": "large"},
                {"type": "title", "size": "xlarge"},
                {"type": "metadata", "fields": ["year", "runtime", "rating"]},
                {"type": "countdown", "size": "xl"},
            ]
        },
        "config": {
            "theme": "dark",
            "use_palette_colors": True,
            "use_logo_image": True,
            "rotate_backdrops": True,
            "rotate_interval": 25,
            "badge": {
                "text": "{{status_text}}",
                "show_when": "always",
                "style": "glass-pill",
                "color": "palette.vibrant",
                "dynamic_texts": {
                    "vote_open": "Vote en cours",
                    "vote_closed": "Film choisi",
                    "scheduled": "Prochainement",
                    "running": "En cours",
                    "default": "A venir",
                },
            },
        },
    },
    "showcase_enriched": {
        "name": "Showcase Enrichi",
        "description": "Template premium exploitant les donnees TMDB et Fanart.tv : logo HD, backdrops en rotation, casting, studios, synopsis",
        "template_type": TemplateType.MOVIE_INFO,
        "is_builtin": True,
        "layout": {
            "style": "showcase-enriched",
            "components": [
                {"type": "backdrop", "opacity": 1, "blur": 0},
                {"type": "logo", "position": "top-left", "size": "xlarge"},
                {"type": "glass_panel", "position": "right", "width": "45%"},
                {"type": "overview", "max_lines": 5},
                {"type": "cast", "limit": 8, "style": "horizontal-scroll"},
                {"type": "directors"},
                {"type": "studios"},
                {"type": "genres", "style": "pills"},
                {"type": "metadata", "fields": ["year", "runtime", "rating"]},
                {"type": "countdown", "size": "large"},
                {"type": "poster", "position": "bottom-right", "size": "small"},
                {"type": "enrichment_badge"},
            ]
        },
        "config": {
            "theme": "showcase",
            "use_palette_colors": True,
            "use_logo_image": True,
            "rotate_backdrops": True,
            "rotate_interval": 20,
            "rotate_posters": True,
            "poster_rotate_interval": 15,
            "show_enrichment_sources": True,
            "show_studios": True,
            "show_original_title": True,
            "show_overview": True,
            "cast_scroll": True,
        },
    },
    "panorama_slide": {
        "name": "Panorama Glissant",
        "description": "Les arriere-plans glissent horizontalement avec logo HD et infos minimalistes",
        "template_type": TemplateType.MOVIE_INFO,
        "is_builtin": True,
        "layout": {
            "style": "panorama-slide",
            "components": [],
        },
        "config": {
            "rotate_backdrops": True,
            "rotate_interval": 10,
            "use_logo_image": True,
            "use_palette_colors": True,
        },
    },
    "modern_enriched": {
        "name": "Moderne Enrichi",
        "description": "Design moderne avec fondu des backdrops, logo HD, genres, casting, note, description et badges animes",
        "template_type": TemplateType.MOVIE_INFO,
        "is_builtin": True,
        "layout": {
            "style": "modern-enriched",
            "components": [],
        },
        "config": {
            "rotate_backdrops": True,
            "rotate_interval": 15,
            "use_logo_image": True,
            "use_palette_colors": True,
            "show_overview": True,
            "show_studios": True,
            "show_enrichment_sources": True,
            "cast_scroll": True,
            "badge": {
                "text": "{{status_text}}",
                "show_when": "always",
                "style": "gradient-border",
                "colors": {
                    "vote_open": "#f59e0b",
                    "vote_closed": "#22c55e",
                    "scheduled": "#6366f1",
                    "running": "#ef4444",
                    "default": "#6b7280",
                },
            },
        },
    },
    "fanart_gallery": {
        "name": "Galerie Fanart",
        "description": "Diaporama plein ecran des arriere-plans Fanart.tv avec infos minimalistes en surimpression",
        "template_type": TemplateType.MOVIE_INFO,
        "is_builtin": True,
        "layout": {
            "style": "fanart-gallery",
            "components": [],
        },
        "config": {
            "rotate_backdrops": True,
            "rotate_interval": 12,
            "use_logo_image": True,
            "use_palette_colors": True,
        },
    },
    "debug_tmdb": {
        "name": "Debug TMDB",
        "description": "Template de test affichant toutes les donnees TMDB explicitement",
        "template_type": TemplateType.MOVIE_INFO,
        "is_builtin": True,
        "layout": {
            "style": "debug-tmdb",
            "components": [],
        },
        "config": {},
    },
    "dynamic_info": {
        "name": "Infos Dynamiques",
        "description": "Affichage avec informations qui changent selon le contexte (vote en cours, film choisi, etc.)",
        "template_type": TemplateType.MOVIE_INFO,
        "is_builtin": True,
        "layout": {
            "style": "dynamic-info",
            "components": [
                {"type": "backdrop", "opacity": 0.3, "blur": 20},
                {"type": "badge", "text": "{{status_text}}", "position": "top-right", "style": "dynamic"},
                {"type": "poster", "position": "left", "size": "large"},
                {"type": "title", "size": "xlarge"},
                {"type": "dynamic_status", "show_vote_progress": True, "show_participants": True},
                {"type": "tagline"},
                {"type": "metadata", "fields": ["year", "runtime", "rating"]},
                {"type": "genres"},
                {"type": "countdown", "size": "large"},
                {"type": "participant_avatars", "position": "bottom-left"},
            ]
        },
        "config": {
            "theme": "dynamic",
            "badge": {
                "text": "{{status_text}}",
                "dynamic_texts": {
                    "vote_open": "Vote en cours",
                    "vote_closed": "Film choisi",
                    "scheduled": "Prochainement",
                    "running": "En cours",
                    "default": "A venir",
                },
                "show_when": "always",
                "style": "status-badge",
                "colors": {
                    "vote_open": "#f59e0b",
                    "vote_closed": "#22c55e",
                    "scheduled": "#6366f1",
                    "running": "#ef4444",
                    "default": "#6b7280",
                },
            },
            "show_vote_info": True,
            "show_participant_count": True,
        },
    },
    "cinematic_mystery": {
        "name": "Cinema Mystere",
        "description": "Template immersif pour sessions mystere : affiche un '?' anime avec countdown de revelation, puis revele le film avec effet spectaculaire",
        "template_type": TemplateType.MOVIE_INFO,
        "is_builtin": True,
        "layout": {
            "style": "cinematic-mystery",
            "components": [
                {"type": "backdrop", "opacity": 1, "blur": 0},
                {"type": "mystery_countdown"},
                {"type": "logo", "position": "bottom-left", "size": "large"},
                {"type": "title", "size": "xlarge"},
                {"type": "metadata", "fields": ["year", "runtime", "rating"]},
                {"type": "countdown", "size": "xl"},
            ]
        },
        "config": {
            "theme": "dark",
            "use_palette_colors": True,
            "use_logo_image": True,
            "rotate_backdrops": True,
            "rotate_interval": 25,
            "badge": {
                "text": "{{mystery_status}}",
                "show_when": "always",
                "style": "glass-pill",
                "color": "palette.accent",
                "colors": {
                    "mystery": "#8b5cf6",
                    "mystery_revealed": "#22c55e",
                    "vote_open": "#f59e0b",
                    "vote_closed": "#22c55e",
                    "scheduled": "#6366f1",
                    "running": "#ef4444",
                    "default": "#6b7280",
                },
            },
        },
    },
    "cinematic_vote": {
        "name": "Cinema Vote",
        "description": "Template immersif pour sessions vote : affiche le vote en cours avec countdown de cloture, puis revele le film gagnant avec effet spectaculaire",
        "template_type": TemplateType.MOVIE_INFO,
        "is_builtin": True,
        "layout": {
            "style": "cinematic-vote",
            "components": [
                {"type": "backdrop", "opacity": 1, "blur": 0},
                {"type": "vote_countdown"},
                {"type": "logo", "position": "bottom-left", "size": "large"},
                {"type": "title", "size": "xlarge"},
                {"type": "metadata", "fields": ["year", "runtime", "rating"]},
                {"type": "countdown", "size": "xl"},
            ]
        },
        "config": {
            "theme": "dark",
            "use_palette_colors": True,
            "use_logo_image": True,
            "rotate_backdrops": True,
            "rotate_interval": 25,
            "badge": {
                "text": "{{vote_status}}",
                "show_when": "always",
                "style": "glass-pill",
                "color": "#3b82f6",
                "colors": {
                    "vote_open": "#3b82f6",
                    "vote_closed": "#22c55e",
                    "scheduled": "#6366f1",
                    "running": "#ef4444",
                    "default": "#6b7280",
                },
            },
        },
    },
    "cinematic_vote_podium": {
        "name": "Cinema Vote Podium",
        "description": "Template vote avec affichage des films en lice et podium anime apres resolution du vote",
        "template_type": TemplateType.MOVIE_INFO,
        "is_builtin": True,
        "layout": {
            "style": "cinematic-vote-podium",
            "components": [
                {"type": "backdrop", "opacity": 0.3, "blur": 20},
                {"type": "vote_options_grid"},
                {"type": "vote_podium"},
                {"type": "title", "size": "xlarge"},
                {"type": "countdown", "size": "xl"},
            ]
        },
        "config": {
            "theme": "dark",
            "badge": {
                "text": "{{vote_status}}",
                "show_when": "always",
                "style": "glass-pill",
                "color": "#3b82f6",
                "colors": {
                    "vote_open": "#3b82f6",
                    "vote_closed": "#22c55e",
                    "scheduled": "#6366f1",
                    "running": "#ef4444",
                    "default": "#6b7280",
                },
            },
        },
    },
    # ============================================================
    # WAITING SCREEN TEMPLATES (Display/Kiosk mode)
    # ============================================================
    "waiting_poster_centered": {
        "name": "Attente Affiche Centree",
        "description": "Fond noir avec affiche centree grand format, titre en bas et badge A venir pulse",
        "template_type": TemplateType.WAITING_SCREEN,
        "is_builtin": True,
        "layout": {
            "style": "waiting-poster-centered",
            "components": [
                {"type": "backdrop", "opacity": 0.15, "blur": 10},
                {"type": "session_info", "position": "top-center", "fields": ["name"]},
                {"type": "poster", "position": "center", "size": "large"},
                {"type": "title", "position": "bottom-center", "size": "xlarge"},
                {"type": "badge", "text": "A venir", "position": "top-right", "style": "pulse"},
            ]
        },
        "config": {
            "theme": "dark",
            "background_color": "#000000",
            "use_palette_colors": True,
            "badge": {
                "text": "A venir",
                "show_when": "always",
                "style": "pulse",
                "color": "palette.accent",
            },
        },
    },
    "waiting_ambient": {
        "name": "Attente Ambiance",
        "description": "Backdrop plein ecran floute avec affiche a gauche et informations detaillees a droite, ambiance cinema immersive",
        "template_type": TemplateType.WAITING_SCREEN,
        "is_builtin": True,
        "layout": {
            "style": "waiting-ambient",
            "components": [
                {"type": "backdrop", "opacity": 0.4, "blur": 20},
                {"type": "poster", "position": "left", "size": "large"},
                {"type": "title", "size": "xlarge"},
                {"type": "tagline", "style": "italic"},
                {"type": "genres", "style": "pills"},
                {"type": "metadata", "fields": ["year", "runtime", "rating"]},
                {"type": "session_info", "position": "bottom", "fields": ["name"]},
            ]
        },
        "config": {
            "theme": "dark",
            "use_palette_colors": True,
            "show_genres": True,
            "show_rating": True,
        },
    },
    "waiting_minimal": {
        "name": "Attente Minimale",
        "description": "Fond noir uni avec titre geant centre et nom de session, design ultra sobre pour ambiance cinema",
        "template_type": TemplateType.WAITING_SCREEN,
        "is_builtin": True,
        "layout": {
            "style": "waiting-minimal",
            "components": [
                {"type": "color_background", "color": "#000000"},
                {"type": "title", "size": "giant", "position": "center", "style": "minimal"},
                {"type": "session_info", "position": "center", "fields": ["name"]},
                {"type": "custom_text", "text": "La seance va bientot commencer", "position": "bottom-center", "style": "minimal-label"},
            ]
        },
        "config": {
            "theme": "minimal",
            "background_color": "#000000",
            "text_color": "#ffffff",
            "show_poster": False,
            "show_metadata": False,
            "typography": "mono",
        },
    },
    "waiting_cinema": {
        "name": "Salle de Cinema",
        "description": "Ambiance salle de cinema, fond sombre anime avec bandes decoratives, pas de contenu film",
        "template_type": TemplateType.WAITING_SCREEN,
        "is_builtin": True,
        "layout": {
            "style": "waiting-cinema",
            "components": [
                {"type": "session_info", "position": "center", "fields": ["name"]},
                {"type": "custom_text", "text": "La seance va bientot commencer", "position": "center", "style": "cinema-label"},
            ]
        },
        "config": {
            "theme": "cinema",
        },
    },
    "waiting_annonce": {
        "name": "Annonces",
        "description": "Ecran d'annonces et messages avant la seance, carte glass-morphism",
        "template_type": TemplateType.WAITING_SCREEN,
        "is_builtin": True,
        "layout": {
            "style": "waiting-annonce",
            "components": [
                {"type": "badge", "text": "Prochainement", "position": "top-center", "style": "glass-pill"},
                {"type": "custom_text", "text": "Bienvenue ! La seance debute dans quelques instants.", "position": "center", "style": "glass-card"},
                {"type": "session_info", "position": "bottom-center", "fields": ["name"]},
            ]
        },
        "config": {
            "theme": "glass",
        },
    },
    "waiting_spotlight": {
        "name": "Spotlight",
        "description": "Focus sur l'affiche avec effet projecteur et halo lumineux",
        "template_type": TemplateType.WAITING_SCREEN,
        "is_builtin": True,
        "layout": {
            "style": "waiting-spotlight",
            "components": [
                {"type": "poster", "position": "center", "size": "xlarge"},
                {"type": "title", "size": "xlarge"},
                {"type": "genres", "style": "pills"},
                {"type": "session_info", "position": "top-right", "fields": ["name"]},
            ]
        },
        "config": {
            "theme": "dark",
            "use_palette_colors": True,
        },
    },
    "waiting_panoramic": {
        "name": "Panoramique",
        "description": "Mise en page splitscreen avec affiche et details complets du film",
        "template_type": TemplateType.WAITING_SCREEN,
        "is_builtin": True,
        "layout": {
            "style": "waiting-panoramic",
            "components": [
                {"type": "backdrop", "opacity": 0.3, "blur": 20},
                {"type": "poster", "position": "left", "size": "full-height"},
                {"type": "title", "size": "xlarge"},
                {"type": "tagline", "style": "italic"},
                {"type": "genres", "style": "pills"},
                {"type": "metadata", "fields": ["year", "runtime", "rating"]},
                {"type": "overview", "max_lines": 4},
                {"type": "session_info", "position": "bottom-right", "fields": ["name"]},
            ]
        },
        "config": {
            "theme": "dark",
            "use_palette_colors": True,
            "use_logo_image": True,
        },
    },
    "waiting_teaser": {
        "name": "Teaser",
        "description": "Impact visuel maximum avec backdrops rotatifs et logo centre lumineux",
        "template_type": TemplateType.WAITING_SCREEN,
        "is_builtin": True,
        "layout": {
            "style": "waiting-teaser",
            "components": [
                {"type": "backdrop", "opacity": 1, "blur": 0},
                {"type": "logo", "position": "center", "size": "large"},
                {"type": "genres", "style": "pills"},
                {"type": "session_info", "position": "bottom-center", "fields": ["name"]},
            ]
        },
        "config": {
            "theme": "dark",
            "use_palette_colors": True,
            "use_logo_image": True,
            "rotate_backdrops": True,
            "rotate_interval": 20,
        },
    },
    # ============================================================
    # TRAILER ANNOUNCEMENT TEMPLATES (generiques, sans contenu film)
    # ============================================================
    "waiting_trailers": {
        "name": "Bandes-Annonces",
        "description": "Annonce des bandes-annonces avec visuel cinema, bobine et projecteur",
        "template_type": TemplateType.WAITING_SCREEN,
        "is_builtin": True,
        "layout": {
            "style": "waiting-trailers",
            "components": [
                {"type": "badge", "text": "Bandes-Annonces", "position": "top-center", "style": "glass-pill"},
                {"type": "session_info", "position": "bottom-center", "fields": ["name"]},
            ]
        },
        "config": {
            "theme": "cinema",
        },
    },
    "waiting_trailers_retro": {
        "name": "Bandes-Annonces Retro",
        "description": "Annonce retro des bandes-annonces avec decompte pellicule et style vintage",
        "template_type": TemplateType.WAITING_SCREEN,
        "is_builtin": True,
        "layout": {
            "style": "waiting-trailers-retro",
            "components": [
                {"type": "badge", "text": "Bandes-Annonces", "position": "top-center", "style": "vintage"},
                {"type": "session_info", "position": "bottom-center", "fields": ["name"]},
            ]
        },
        "config": {
            "theme": "retro",
        },
    },
    # ============================================================
    # INTERMISSION TEMPLATES (pause avec compte a rebours)
    # ============================================================
    "waiting_intermission": {
        "name": "Entracte",
        "description": "Ecran d'entracte elegant avec compte a rebours de la duree de la sequence",
        "template_type": TemplateType.WAITING_SCREEN,
        "is_builtin": True,
        "layout": {
            "style": "waiting-intermission",
            "components": [
                {"type": "custom_text", "text": "Entracte", "position": "center", "style": "elegant-title"},
                {"type": "session_info", "position": "bottom-center", "fields": ["name"]},
            ]
        },
        "config": {
            "theme": "elegant",
            "show_countdown": True,
        },
    },
    "waiting_intermission_fun": {
        "name": "Pause Detente",
        "description": "Pause ludique avec icones popcorn, boissons et WC, animations dynamiques et compte a rebours",
        "template_type": TemplateType.WAITING_SCREEN,
        "is_builtin": True,
        "layout": {
            "style": "waiting-intermission-fun",
            "components": [
                {"type": "custom_text", "text": "Pause", "position": "center", "style": "fun-title"},
                {"type": "session_info", "position": "bottom-center", "fields": ["name"]},
            ]
        },
        "config": {
            "theme": "fun",
            "show_countdown": True,
        },
    },
    "waiting_intermission_minimal": {
        "name": "Pause Minimale",
        "description": "Ecran de pause ultra-minimaliste avec compte a rebours grand format",
        "template_type": TemplateType.WAITING_SCREEN,
        "is_builtin": True,
        "layout": {
            "style": "waiting-intermission-minimal",
            "components": [
                {"type": "custom_text", "text": "Pause", "position": "center", "style": "minimal-title"},
                {"type": "session_info", "position": "bottom-center", "fields": ["name"]},
            ]
        },
        "config": {
            "theme": "minimal",
            "show_countdown": True,
        },
    },
    # ============================================================
    # QUIZ TEMPLATES (interactive quiz display)
    # ============================================================
    "quiz_classic": {
        "name": "Quiz Classique",
        "description": "Affichage quiz structure avec question, choix, timer, classement et QR code pour rejoindre",
        "template_type": TemplateType.QUIZ,
        "is_builtin": True,
        "layout": {
            "style": "quiz-classic",
            "components": [
                {"type": "quiz_header"},
                {"type": "quiz_question"},
                {"type": "quiz_choices"},
                {"type": "quiz_timer"},
                {"type": "quiz_scoreboard", "position": "right", "limit": 10},
                {"type": "quiz_qrcode", "position": "bottom-right"},
                {"type": "quiz_feedback"},
                {"type": "quiz_podium"},
                {"type": "quiz_participant_count", "position": "top-right"},
                {"type": "quiz_join_message"},
            ],
        },
        "config": {
            "theme": "dark",
            "accent_color": "#6366f1",
            "show_scoreboard_during_question": True,
            "show_qr_during_waiting": True,
            "show_answer_distribution": True,
            "feedback_duration_seconds": 5,
            "podium_animation": True,
        },
    },
    "quiz_gameshow": {
        "name": "Quiz Gameshow",
        "description": "Style emission TV avec effets visuels spectaculaires, couleurs vives et animations",
        "template_type": TemplateType.QUIZ,
        "is_builtin": True,
        "layout": {
            "style": "quiz-gameshow",
            "components": [
                {"type": "quiz_header"},
                {"type": "quiz_question"},
                {"type": "quiz_choices"},
                {"type": "quiz_timer", "style": "circular"},
                {"type": "quiz_scoreboard", "position": "right", "limit": 5},
                {"type": "quiz_qrcode", "position": "bottom-right"},
                {"type": "quiz_feedback"},
                {"type": "quiz_podium"},
                {"type": "quiz_participant_count"},
                {"type": "quiz_join_message"},
            ],
        },
        "config": {
            "theme": "gameshow",
            "accent_color": "#f59e0b",
            "secondary_color": "#8b5cf6",
            "show_scoreboard_during_question": True,
            "show_qr_during_waiting": True,
            "show_answer_distribution": True,
            "feedback_duration_seconds": 5,
            "podium_animation": True,
            "choice_colors": ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899"],
        },
    },
    "quiz_minimal": {
        "name": "Quiz Minimal",
        "description": "Design minimaliste centre sur la question et les choix, ideal pour un affichage propre",
        "template_type": TemplateType.QUIZ,
        "is_builtin": True,
        "layout": {
            "style": "quiz-minimal",
            "components": [
                {"type": "quiz_header"},
                {"type": "quiz_question"},
                {"type": "quiz_choices"},
                {"type": "quiz_timer", "style": "bar"},
                {"type": "quiz_feedback"},
                {"type": "quiz_podium"},
                {"type": "quiz_join_message"},
            ],
        },
        "config": {
            "theme": "minimal",
            "background_color": "#000000",
            "text_color": "#ffffff",
            "accent_color": "#ffffff",
            "show_scoreboard_during_question": False,
            "show_qr_during_waiting": True,
            "show_answer_distribution": False,
            "feedback_duration_seconds": 3,
            "podium_animation": True,
        },
    },
}
