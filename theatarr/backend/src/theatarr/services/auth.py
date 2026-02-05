"""Authentication service for Theatarr."""

from datetime import datetime, timedelta, timezone
from typing import Annotated

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from theatarr.config import settings
from theatarr.database import get_db
from theatarr.models.user import User

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


class Token(BaseModel):
    """JWT token response."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int


class TokenData(BaseModel):
    """Data extracted from JWT token."""

    user_id: str
    username: str


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return bcrypt.checkpw(
        plain_password.encode('utf-8'),
        hashed_password.encode('utf-8')
    )


def hash_password(password: str) -> str:
    """Hash a password for storage."""
    return bcrypt.hashpw(
        password.encode('utf-8'),
        bcrypt.gensalt()
    ).decode('utf-8')


def create_access_token(user: User) -> Token:
    """Create a JWT access token for a user."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)

    payload = {
        "sub": user.id,
        "username": user.username,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }

    token = jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)

    return Token(
        access_token=token,
        expires_in=settings.access_token_expire_minutes * 60,
    )


async def authenticate_user(
    db: AsyncSession,
    username: str,
    password: str,
) -> User | None:
    """Authenticate a user by username and password."""
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()

    if user is None:
        return None

    if not verify_password(password, user.password_hash):
        return None

    if not user.is_active:
        return None

    # Update last login timestamp
    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()

    return user


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Get the current authenticated user from JWT token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled",
        )

    return user


# Type alias for dependency injection
CurrentUser = Annotated[User, Depends(get_current_user)]


async def create_user(
    db: AsyncSession,
    username: str,
    password: str,
) -> User:
    """Create a new user account."""
    # Check if username already exists
    result = await db.execute(select(User).where(User.username == username))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists",
        )

    user = User(
        username=username,
        password_hash=hash_password(password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return user
