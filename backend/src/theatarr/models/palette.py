"""Color palette model for Theatarr."""

from sqlalchemy import String, ForeignKey
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from theatarr.database import Base
from theatarr.models.base import TimestampMixin, UUIDMixin


class ColorPalette(UUIDMixin, TimestampMixin, Base):
    """Color palette extracted from movie artwork.

    Used for dynamic theming of wallmount display based on
    the movie poster or backdrop.
    """

    __tablename__ = "color_palettes"

    # Source
    movie_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("movies.id", ondelete="CASCADE"),
        index=True,
    )
    source_url: Mapped[str | None] = mapped_column(String(1000))
    source_type: Mapped[str] = mapped_column(
        String(20),
        default="poster",  # poster, backdrop
    )

    # Primary colors (hex format)
    primary: Mapped[str] = mapped_column(String(7), default="#000000")
    secondary: Mapped[str | None] = mapped_column(String(7))
    accent: Mapped[str | None] = mapped_column(String(7))
    background: Mapped[str | None] = mapped_column(String(7))
    text: Mapped[str | None] = mapped_column(String(7))
    muted: Mapped[str | None] = mapped_column(String(7))

    # Full palette data (for advanced theming)
    vibrant: Mapped[str | None] = mapped_column(String(7))
    vibrant_light: Mapped[str | None] = mapped_column(String(7))
    vibrant_dark: Mapped[str | None] = mapped_column(String(7))
    muted_color: Mapped[str | None] = mapped_column(String(7))
    muted_light: Mapped[str | None] = mapped_column(String(7))
    muted_dark: Mapped[str | None] = mapped_column(String(7))

    # Raw palette data (all extracted colors)
    raw_palette: Mapped[dict | None] = mapped_column(JSON)

    # Relationship
    movie = relationship("Movie", backref="palettes")

    def to_css_vars(self) -> dict[str, str]:
        """Convert palette to CSS variables."""
        return {
            "--palette-primary": self.primary,
            "--palette-secondary": self.secondary or self.primary,
            "--palette-accent": self.accent or self.vibrant or self.primary,
            "--palette-background": self.background or "#0a0a0f",
            "--palette-text": self.text or "#ffffff",
            "--palette-muted": self.muted or "#888888",
            "--palette-vibrant": self.vibrant or self.primary,
            "--palette-vibrant-light": self.vibrant_light or self.vibrant or self.primary,
            "--palette-vibrant-dark": self.vibrant_dark or self.primary,
        }

    def __repr__(self) -> str:
        return f"<ColorPalette(id={self.id}, primary='{self.primary}')>"
