"""Configuration management for Theatarr."""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Database
    database_url: str = Field(
        default="sqlite+aiosqlite:///./data/theatarr.db",
        description="Database connection URL",
    )

    # Security
    secret_key: str = Field(
        ...,
        description="Secret key for JWT signing",
        min_length=32,
    )
    jwt_algorithm: Literal["HS256", "HS384", "HS512"] = Field(
        default="HS256",
        description="JWT signing algorithm",
    )
    access_token_expire_minutes: int = Field(
        default=60,
        ge=5,
        le=10080,  # Max 1 week
        description="Access token expiration in minutes",
    )

    # External Services
    tmdb_api_key: str | None = Field(
        default=None,
        description="TMDB API key for movie metadata",
    )

    # Storage
    data_path: Path = Field(
        default=Path("/data"),
        description="Base data directory",
    )
    trailer_path: Path = Field(
        default=Path("/data/trailers"),
        description="Trailer storage directory",
    )
    sound_path: Path = Field(
        default=Path("/data/sounds"),
        description="Sound storage directory",
    )

    # Server
    host: str = Field(default="0.0.0.0", description="Server host")
    port: int = Field(default=8080, ge=1, le=65535, description="Server port")
    debug: bool = Field(default=False, description="Debug mode")

    # Features
    wallmount_requires_token: bool = Field(
        default=False,
        description="Require authentication for wallmount page",
    )
    vote_token_expiry_hours: int = Field(
        default=24,
        ge=1,
        le=168,  # Max 1 week
        description="Vote token expiration in hours",
    )
    auto_resume_sessions: bool = Field(
        default=True,
        description="Auto-resume sessions after system restart",
    )

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        """Ensure SQLite URLs use aiosqlite driver."""
        if v.startswith("sqlite:///"):
            return v.replace("sqlite:///", "sqlite+aiosqlite:///")
        return v

    @field_validator("data_path", "trailer_path", "sound_path", mode="after")
    @classmethod
    def ensure_path_exists(cls, v: Path) -> Path:
        """Create directories if they don't exist."""
        v.mkdir(parents=True, exist_ok=True)
        return v


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Convenience alias
settings = get_settings()
