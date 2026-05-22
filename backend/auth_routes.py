"""
auth_routes.py - FastAPI router for user authentication (signup, login, me).
"""
import logging
import re

from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db_config import get_db
from db_models import UserDevice
from auth_models import (
    SignupRequest, LoginRequest, AuthResponse, UserResponse,
    ForgotPasswordRequest, ResetPasswordRequest,
    ChangePasswordRequest, ChangeUsernameRequest, DeleteAccountRequest,
    RegisterDeviceRequest,
)
from auth_database import (
    create_user, get_user_by_email, get_user_by_id,
    email_exists, username_exists,
    update_user_password, update_user_username, delete_user_account,
    list_user_devices, register_user_device,
)

from auth_utils import (
    hash_password, verify_password, create_access_token, get_current_user,
    create_reset_token, decode_reset_token, send_reset_email,
)

logger = logging.getLogger(__name__)

_USERNAME_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9._-]*$")

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/signup", response_model=AuthResponse, status_code=201)
async def signup(body: SignupRequest, db: AsyncSession = Depends(get_db)):
    """Register a new user account."""
    if await email_exists(db, body.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    if await username_exists(db, body.username):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This username is already taken.",
        )

    hashed = hash_password(body.password)
    user = await create_user(
        db,
        username=body.username,
        email=body.email,
        hashed_password=hashed,
        full_name=body.full_name,
    )

    token = create_access_token(user["id"])
    logger.info("New user registered: %s (%s)", user["username"], user["email"])

    return AuthResponse(access_token=token, user=user)


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate with email and password."""
    user = await get_user_by_email(db, body.email)

    if user is None or not verify_password(body.password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    token = create_access_token(user["id"])
    logger.info("User logged in: %s", user["email"])

    safe_user = {k: v for k, v in user.items() if k != "password"}
    return AuthResponse(access_token=token, user=safe_user)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return UserResponse(**current_user)


def _validate_username_format(username: str) -> str | None:
    """Return error message if invalid, else None."""
    u = username.strip()
    if len(u) < 3:
        return "Username must be at least 3 characters."
    if len(u) > 30:
        return "Username must not exceed 30 characters."
    if not _USERNAME_RE.match(u):
        return "Must start with a letter; use letters, numbers, dots, hyphens, or underscores."
    return None


@router.get("/username/check")
async def check_username_availability(
    username: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check if a username is valid and available (for settings checker)."""
    u = username.strip()
    fmt_err = _validate_username_format(u)
    if fmt_err:
        return {
            "username": u,
            "valid": False,
            "available": False,
            "message": fmt_err,
        }
    if u == current_user.get("username"):
        return {
            "username": u,
            "valid": True,
            "available": True,
            "is_current": True,
            "message": "This is your current username.",
        }
    taken = await username_exists(db, u)
    return {
        "username": u,
        "valid": True,
        "available": not taken,
        "is_current": False,
        "message": "Username is available." if not taken else "This username is already taken.",
    }


@router.get("/account/devices")
async def account_devices(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List devices that have signed in to this account."""
    devices = await list_user_devices(db, current_user["id"])
    return {"devices": devices}


@router.post("/account/devices", status_code=200)
async def register_device(
    body: RegisterDeviceRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Register or refresh the current browser/device for this account."""
    device = await register_user_device(
        db,
        current_user["id"],
        body.client_device_id,
        body.label,
        body.user_agent,
    )
    token = create_access_token(current_user["id"], body.client_device_id)
    return {"device": device, "access_token": token, "token_type": "bearer"}


@router.delete("/account/devices/{device_id}")
async def remove_device(
    device_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a registered device; tokens bound to that device will be rejected."""
    result = await db.execute(
        select(UserDevice).where(
            UserDevice.id == device_id,
            UserDevice.user_id == current_user["id"],
        )
    )
    device_row = result.scalar_one_or_none()
    if not device_row:
        raise HTTPException(status_code=404, detail="Device not found.")
    revoked_client_id = device_row.client_device_id
    await db.delete(device_row)
    await db.commit()
    return {
        "message": "Device removed. That device has been signed out.",
        "revoked_client_device_id": revoked_client_id,
    }


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Send a password reset email. Returns 404 if email not registered."""
    user = await get_user_by_email(db, body.email)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="This email is not registered. Please sign up first.",
        )

    token = create_reset_token(user["id"])
    try:
        send_reset_email(user["email"], user.get("username", "User"), token)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    logger.info("Password reset requested for: %s", body.email)
    return {"message": "A password reset link has been sent to your email."}


@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Reset password using a valid reset token."""
    user_id = decode_reset_token(body.token)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset link. Please request a new one.",
        )

    user = await get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")

    full_user = await get_user_by_email(db, user["email"])
    if full_user and verify_password(body.password, full_user["password"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password cannot be the same as your current password.",
        )

    hashed = hash_password(body.password)
    await update_user_password(db, user_id, hashed)

    logger.info("Password reset successful for user: %s", user_id)
    return {"message": "Password has been reset successfully. You can now log in."}


@router.put("/password")
async def change_password(
    body: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change password for the authenticated user."""
    user = await get_user_by_id(db, current_user["id"])
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")

    full_user = await get_user_by_email(db, user["email"])
    if not verify_password(body.current_password, full_user["password"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    hashed = hash_password(body.new_password)
    await update_user_password(db, current_user["id"], hashed)

    logger.info("Password changed for user: %s", current_user["id"])
    return {"message": "Password updated successfully."}


@router.put("/username")
async def change_username(
    body: ChangeUsernameRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change username for the authenticated user."""
    if body.new_username == current_user.get("username"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New username is the same as your current username.",
        )

    if await username_exists(db, body.new_username):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This username is already taken.",
        )

    updated_user = await update_user_username(db, current_user["id"], body.new_username)
    if updated_user is None:
        raise HTTPException(status_code=404, detail="User not found.")

    logger.info("Username changed for user %s: %s → %s", current_user["id"], current_user.get("username"), body.new_username)
    return {"message": "Username updated successfully.", "user": updated_user}


@router.delete("/account")
async def delete_account(
    body: DeleteAccountRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete the authenticated user's account and all data."""
    full_user = await get_user_by_email(db, current_user["email"])
    if not full_user or not verify_password(body.password, full_user["password"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password is incorrect.",
        )

    await delete_user_account(db, current_user["id"])
    logger.info("Account deleted: %s (%s)", current_user.get("username"), current_user["email"])
    return {"message": "Account deleted successfully."}
