"""
auth_routes.py - FastAPI router for user authentication (signup, login, me).
"""
import logging

from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from db_config import get_db
from auth_models import SignupRequest, LoginRequest, AuthResponse, UserResponse, ForgotPasswordRequest, ResetPasswordRequest
from auth_database import create_user, get_user_by_email, email_exists, username_exists, update_user_password
from auth_utils import (
    hash_password, verify_password, create_access_token, get_current_user,
    create_reset_token, decode_reset_token, send_reset_email,
)

logger = logging.getLogger(__name__)

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

    hashed = hash_password(body.password)
    await update_user_password(db, user_id, hashed)

    logger.info("Password reset successful for user: %s", user_id)
    return {"message": "Password has been reset successfully. You can now log in."}
