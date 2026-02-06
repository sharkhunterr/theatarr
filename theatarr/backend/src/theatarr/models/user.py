"""User model for authentication."""

from datetime import datetime
from enum import Enum

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from theatarr.database import Base
from theatarr.models.base import TimestampMixin, UUIDMixin


class UserRole(str, Enum):
    """User role for access control."""

    ADMIN = "admin"
    USER = "user"


class User(UUIDMixin, TimestampMixin, Base):
    """User account for the application."""

    __tablename__ = "users"

    username: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
    )
    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    first_name: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    last_name: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    email: Mapped[str | None] = mapped_column(
        String(255),
        unique=True,
        nullable=True,
        index=True,
    )
    role: Mapped[str] = mapped_column(
        String(20),
        default=UserRole.USER.value,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    auto_accept_invitations: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    @property
    def is_admin(self) -> bool:
        """Check if user has admin role."""
        return self.role == UserRole.ADMIN.value

    @property
    def display_name(self) -> str:
        """Get display name (full name or username)."""
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        if self.first_name:
            return self.first_name
        return self.username

    def __repr__(self) -> str:
        return f"<User(username={self.username!r}, role={self.role!r}, is_active={self.is_active})>"
