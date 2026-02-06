"""Authentication API router for Theatarr."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field

from theatarr.database import DbSession
from theatarr.services.auth import (
    CurrentUser,
    Token,
    authenticate_user,
    create_access_token,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


class UserResponse(BaseModel):
    """User information response."""

    id: str
    username: str
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    role: str
    is_active: bool

    class Config:
        from_attributes = True


class RefreshRequest(BaseModel):
    """Token refresh request (for future use with refresh tokens)."""

    pass


@router.post(
    "/login",
    response_model=Token,
    summary="Login",
    description="Authenticate with username and password to get an access token.",
)
async def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: DbSession,
) -> Token:
    """Login endpoint using OAuth2 password flow."""
    user = await authenticate_user(db, form_data.username, form_data.password)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return create_access_token(user)


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get Current User",
    description="Get information about the currently authenticated user.",
)
async def get_me(current_user: CurrentUser) -> UserResponse:
    """Get current user information."""
    return UserResponse.model_validate(current_user)


@router.post(
    "/refresh",
    response_model=Token,
    summary="Refresh Token",
    description="Refresh the access token (requires valid existing token).",
)
async def refresh_token(current_user: CurrentUser) -> Token:
    """Refresh access token using current valid token."""
    return create_access_token(current_user)
