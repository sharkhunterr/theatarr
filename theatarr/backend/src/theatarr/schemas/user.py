"""User Pydantic schemas for Theatarr."""

from datetime import datetime

from pydantic import EmailStr, Field

from theatarr.schemas.base import BaseSchema


class UserCreate(BaseSchema):
    """Schema for creating a user."""

    username: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=6, max_length=128)
    first_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    email: EmailStr | None = None
    role: str = Field(default="user", pattern="^(admin|user)$")


class UserUpdate(BaseSchema):
    """Schema for updating a user."""

    first_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    email: EmailStr | None = None
    is_active: bool | None = None
    role: str | None = Field(default=None, pattern="^(admin|user)$")


class UserPasswordChange(BaseSchema):
    """Schema for changing a user's password (admin)."""

    new_password: str = Field(..., min_length=6, max_length=128)


class UserResponse(BaseSchema):
    """User response schema."""

    id: str
    username: str
    first_name: str | None
    last_name: str | None
    email: str | None
    role: str
    is_active: bool
    last_login_at: datetime | None
    created_at: datetime
    updated_at: datetime

    @property
    def display_name(self) -> str:
        """Get display name."""
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        if self.first_name:
            return self.first_name
        return self.username


class UserListResponse(BaseSchema):
    """List of users response."""

    items: list[UserResponse]
    total: int


class UserSelfUpdate(BaseSchema):
    """Schema for a user updating their own profile."""

    first_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    email: EmailStr | None = None


class PasswordChangeRequest(BaseSchema):
    """Schema for changing own password."""

    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=6, max_length=128)
