from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import verify_password, create_access_token, get_password_hash
from app.core.auth_deps import get_current_user, require_role
from app.models.user import User, UserRole
from app.schemas.auth import LoginRequest, TokenResponse, UserResponse, RegisterRequest

router = APIRouter()


# ── Public endpoints ───────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse,
             summary="Login and get JWT token")
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Authenticate with email + password. Returns a Bearer JWT token.

    Use this token in the `Authorization: Bearer <token>` header for all protected endpoints.
    """
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Contact your administrator.",
        )
    token = create_access_token({"sub": user.id, "role": user.role.value})
    return TokenResponse(access_token=token)


# ── Admin-only: register new users ────────────────────────────────────────────

@router.post("/register", response_model=UserResponse, status_code=201,
             summary="Register a new user (admin only)")
async def register(
    payload: RegisterRequest,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
):
    """
    Create a new MP / staff user account.

    **Requires admin role.** Self-registration is disabled — only an admin can
    create accounts for MPs and their office staff.

    Roles:
    - `mp`    — full dashboard read access + ward/project management
    - `staff` — dashboard read access + submission management
    - `admin` — full access including user management
    """
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        id=str(uuid.uuid4()),
        email=payload.email,
        name=payload.name,
        hashed_password=get_password_hash(payload.password),
        role=UserRole(payload.role) if payload.role in UserRole.__members__ else UserRole.staff,
        constituency=payload.constituency,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


# ── Authenticated endpoints ────────────────────────────────────────────────────

@router.get("/me", response_model=UserResponse,
            summary="Get current user profile")
async def get_me(current_user: User = Depends(get_current_user)):
    """Return the profile of the currently authenticated user."""
    return current_user


@router.post("/change-password", status_code=204,
             summary="Change own password")
async def change_password(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Change the authenticated user's own password.

    Body: `{ "current_password": "...", "new_password": "..." }`
    """
    current_pw = payload.get("current_password", "")
    new_pw = payload.get("new_password", "")

    if not verify_password(current_pw, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(new_pw) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")

    result = await db.execute(select(User).where(User.id == current_user.id))
    user = result.scalar_one()
    user.hashed_password = get_password_hash(new_pw)
    await db.commit()


# ── Admin-only: user management ───────────────────────────────────────────────

@router.get("/users", response_model=list[UserResponse],
            summary="List all users (admin only)")
async def list_users(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
):
    """Return all registered users. Requires admin role."""
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return result.scalars().all()


@router.get("/users/{user_id}", response_model=UserResponse,
            summary="Get a user by ID (admin only)")
async def get_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
):
    """Return a single user by ID. Requires admin role."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch("/users/{user_id}", response_model=UserResponse,
              summary="Update a user (admin only)")
async def update_user(
    user_id: str,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
):
    """
    Update a user's name, role, constituency, or active status.
    Requires admin role. Cannot change a user's password here — use /change-password.

    Body: `{ "name": "...", "role": "mp|staff|admin", "is_active": true|false, "constituency": "..." }`
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if "name" in payload:
        user.name = payload["name"]
    if "role" in payload and payload["role"] in UserRole.__members__:
        user.role = UserRole(payload["role"])
    if "is_active" in payload:
        user.is_active = bool(payload["is_active"])
    if "constituency" in payload:
        user.constituency = payload["constituency"]

    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=204,
               summary="Deactivate a user (admin only)")
async def deactivate_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role("admin")),
):
    """
    Deactivate (soft-delete) a user account. The user can no longer log in.
    Requires admin role. Admins cannot deactivate themselves.
    """
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = False
    await db.commit()
