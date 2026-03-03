"""Movie model for Theatarr."""

from sqlalchemy import String, Text, Integer, Float
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column

from theatarr.database import Base
from theatarr.models.base import TimestampMixin, UUIDMixin


class Movie(UUIDMixin, TimestampMixin, Base):
    """Movie metadata model.

    Stores movie information fetched from media sources for display
    on wallmount and in session details.
    """

    __tablename__ = "movies"

    # Basic info
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    original_title: Mapped[str | None] = mapped_column(String(500))
    year: Mapped[int | None] = mapped_column(Integer)
    runtime_minutes: Mapped[int | None] = mapped_column(Integer)

    # External IDs
    tmdb_id: Mapped[str | None] = mapped_column(String(50), index=True)
    imdb_id: Mapped[str | None] = mapped_column(String(20), index=True)
    plex_key: Mapped[str | None] = mapped_column(String(100), index=True)
    jellyfin_id: Mapped[str | None] = mapped_column(String(100), index=True)

    # Content
    overview: Mapped[str | None] = mapped_column(Text)
    tagline: Mapped[str | None] = mapped_column(String(500))

    # Media
    poster_url: Mapped[str | None] = mapped_column(String(1000))
    backdrop_url: Mapped[str | None] = mapped_column(String(1000))
    poster_path: Mapped[str | None] = mapped_column(String(500))
    backdrop_path: Mapped[str | None] = mapped_column(String(500))

    # Ratings
    rating: Mapped[float | None] = mapped_column(Float)
    vote_count: Mapped[int | None] = mapped_column(Integer)

    # Alternative images
    extra_backdrops: Mapped[list | None] = mapped_column(JSON, default=list)
    extra_posters: Mapped[list | None] = mapped_column(JSON, default=list)
    logos: Mapped[list | None] = mapped_column(JSON, default=list)

    # Metadata (genres, cast, crew, etc.)
    genres: Mapped[list | None] = mapped_column(JSON, default=list)
    directors: Mapped[list | None] = mapped_column(JSON, default=list)
    cast: Mapped[list | None] = mapped_column(JSON, default=list)
    studios: Mapped[list | None] = mapped_column(JSON, default=list)
    keywords: Mapped[list | None] = mapped_column(JSON, default=list)

    # Source tracking
    source: Mapped[str | None] = mapped_column(String(50))  # plex, jellyfin, tmdb
    source_updated_at: Mapped[str | None] = mapped_column(String(50))

    # Enrichment tracking
    enrichment_sources: Mapped[list | None] = mapped_column(JSON, default=list)

    def __repr__(self) -> str:
        return f"<Movie(id={self.id}, title='{self.title}', year={self.year})>"
