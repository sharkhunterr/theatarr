"""Users API router for Theatarr - Admin user management."""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from theatarr.api.deps import AdminUser
from theatarr.api.errors import NotFoundError
from theatarr.database import DbSession
from theatarr.models.user import User, UserRole
from theatarr.schemas.user import (
    UserCreate,
    UserListResponse,
    UserPasswordChange,
    UserResponse,
    UserUpdate,
)
from theatarr.services.auth import hash_password

router = APIRouter(prefix="/users", tags=["Users"])


def _user_to_response(user: User) -> UserResponse:
    """Convert User model to response schema."""
    return UserResponse(
        id=user.id,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        last_login_at=user.last_login_at,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


@router.get(
    "",
    response_model=UserListResponse,
    summary="List Users",
)
async def list_users(
    db: DbSession,
    admin: AdminUser,
    skip: int = 0,
    limit: int = 50,
    is_active: bool | None = None,
    role: str | None = None,
    search: str | None = None,
) -> UserListResponse:
    """List all users (admin only)."""
    query = select(User)

    if is_active is not None:
        query = query.where(User.is_active == is_active)

    if role:
        query = query.where(User.role == role)

    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            (User.username.ilike(search_pattern))
            | (User.first_name.ilike(search_pattern))
            | (User.last_name.ilike(search_pattern))
            | (User.email.ilike(search_pattern))
        )

    query = query.order_by(User.created_at.desc()).offset(skip).limit(limit)

    result = await db.execute(query)
    users = result.scalars().all()

    # Get total count
    count_query = select(func.count(User.id))
    if is_active is not None:
        count_query = count_query.where(User.is_active == is_active)
    if role:
        count_query = count_query.where(User.role == role)
    if search:
        search_pattern = f"%{search}%"
        count_query = count_query.where(
            (User.username.ilike(search_pattern))
            | (User.first_name.ilike(search_pattern))
            | (User.last_name.ilike(search_pattern))
            | (User.email.ilike(search_pattern))
        )
    total = await db.execute(count_query)

    return UserListResponse(
        items=[_user_to_response(u) for u in users],
        total=total.scalar() or 0,
    )


@router.post(
    "",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create User",
)
async def create_user(
    db: DbSession,
    admin: AdminUser,
    data: UserCreate,
) -> UserResponse:
    """Create a new user (admin only)."""
    # Check if username already exists
    result = await db.execute(select(User).where(User.username == data.username))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists",
        )

    # Check if email already exists (if provided)
    if data.email:
        result = await db.execute(select(User).where(User.email == data.email))
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already in use",
            )

    user = User(
        username=data.username,
        password_hash=hash_password(data.password),
        first_name=data.first_name,
        last_name=data.last_name,
        email=data.email,
        role=data.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return _user_to_response(user)


@router.get(
    "/{user_id}",
    response_model=UserResponse,
    summary="Get User",
)
async def get_user(
    db: DbSession,
    admin: AdminUser,
    user_id: str,
) -> UserResponse:
    """Get a user by ID (admin only)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise NotFoundError("User", user_id)

    return _user_to_response(user)


@router.patch(
    "/{user_id}",
    response_model=UserResponse,
    summary="Update User",
)
async def update_user(
    db: DbSession,
    admin: AdminUser,
    user_id: str,
    data: UserUpdate,
) -> UserResponse:
    """Update a user (admin only)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise NotFoundError("User", user_id)

    # Check if email is being changed and if it's already in use
    if data.email is not None and data.email != user.email:
        result = await db.execute(
            select(User).where(User.email == data.email, User.id != user_id)
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already in use",
            )

    # Prevent demoting the last admin
    if data.role == UserRole.USER.value and user.role == UserRole.ADMIN.value:
        admin_count = await db.execute(
            select(func.count(User.id)).where(User.role == UserRole.ADMIN.value)
        )
        if admin_count.scalar() == 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot demote the last admin user",
            )

    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)

    await db.commit()
    await db.refresh(user)

    return _user_to_response(user)


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete User",
)
async def delete_user(
    db: DbSession,
    admin: AdminUser,
    user_id: str,
) -> None:
    """Delete a user (admin only)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise NotFoundError("User", user_id)

    # Prevent deleting yourself
    if user.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account",
        )

    # Prevent deleting the last admin
    if user.role == UserRole.ADMIN.value:
        admin_count = await db.execute(
            select(func.count(User.id)).where(User.role == UserRole.ADMIN.value)
        )
        if admin_count.scalar() == 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete the last admin user",
            )

    await db.delete(user)
    await db.commit()


@router.post(
    "/{user_id}/change-password",
    response_model=UserResponse,
    summary="Change User Password",
)
async def change_user_password(
    db: DbSession,
    admin: AdminUser,
    user_id: str,
    data: UserPasswordChange,
) -> UserResponse:
    """Change a user's password (admin only)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise NotFoundError("User", user_id)

    user.password_hash = hash_password(data.new_password)
    await db.commit()
    await db.refresh(user)

    return _user_to_response(user)
