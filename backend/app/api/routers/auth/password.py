"""Password reset and change endpoints."""
import logging

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.auth_database import get_user_by_email, get_user_by_id, update_user_password
from app.core.auth_models import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)
from app.core.auth_utils import (
    create_reset_token,
    decode_reset_token,
    get_current_user,
    hash_password,
    send_reset_email,
    verify_password,
)
from app.db.config import get_db

from .router import router

logger = logging.getLogger(__name__)


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
