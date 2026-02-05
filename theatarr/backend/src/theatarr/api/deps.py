"""API dependencies for Theatarr."""

from typing import Annotated

from fastapi import Depends, HTTPException, Query, status
from jose import JWTError, jwt

from theatarr.config import settings
from theatarr.database import DbSession
from theatarr.models.user import User
from theatarr.services.auth import CurrentUser, get_current_user, oauth2_scheme


async def get_optional_current_user(
    token: Annotated[str | None, Depends(oauth2_scheme)],
    db: DbSession,
) -> User | None:
    """Get current user if authenticated, None otherwise."""
    if token is None:
        return None

    try:
        from theatarr.services.auth import get_current_user

        return await get_current_user(token, db)
    except HTTPException:
        return None


OptionalUser = Annotated[User | None, Depends(get_optional_current_user)]


def require_admin(user: CurrentUser) -> User:
    """Dependency that requires admin authentication."""
    # For now, all authenticated users are admins
    # Future: add role-based access control
    return user


AdminUser = Annotated[User, Depends(require_admin)]


async def verify_wallmount_access(
    wallmount: Annotated[bool | None, Query()] = None,
    token: Annotated[str | None, Query()] = None,
) -> None:
    """Verify access for wallmount page based on settings."""
    if not settings.wallmount_requires_token:
        # Wallmount is public
        return

    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Wallmount requires authentication",
        )

    try:
        jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.jwt_algorithm],
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )


async def verify_vote_token(
    vote_token: Annotated[str, Query()],
) -> str:
    """Verify and return a vote token."""
    # Vote tokens are validated against the database in the vote service
    # Here we just ensure the token is provided
    if not vote_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Vote token required",
        )
    return vote_token


VoteToken = Annotated[str, Depends(verify_vote_token)]
