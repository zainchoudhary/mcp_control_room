"""Login and 2FA verification endpoints."""
import logging

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.auth_database import get_user_auth_by_id, get_user_by_email
from app.core.auth_models import AuthResponse, LoginRequest, Verify2faLoginRequest
from app.core.auth_utils import (
    create_access_token,
    create_pending_2fa_token,
    decode_pending_2fa_token,
    verify_password,
)
from app.db.config import get_db
from app.core.security import verify_totp_code

from .router import router

logger = logging.getLogger(__name__)


@router.post("/login")
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate with email and password. May require a second 2FA step."""
    user = await get_user_by_email(db, body.email)

    if user is None or not verify_password(body.password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    safe_user = {k: v for k, v in user.items() if k not in ("password", "totp_secret")}

    if user.get("totp_enabled") and user.get("totp_secret"):
        pending = create_pending_2fa_token(user["id"])
        logger.info("2FA required for login: %s", user["email"])
        return {
            "requires_2fa": True,
            "pending_token": pending,
            "user": safe_user,
        }

    token = create_access_token(user["id"])
    logger.info("User logged in: %s", user["email"])
    return AuthResponse(access_token=token, user=safe_user)


@router.post("/login/verify-2fa", response_model=AuthResponse)
async def verify_login_2fa(body: Verify2faLoginRequest, db: AsyncSession = Depends(get_db)):
    """Complete login after password step when 2FA is enabled."""
    user_id = decode_pending_2fa_token(body.pending_token)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Login session expired. Please sign in again.",
        )

    user = await get_user_auth_by_id(db, user_id)
    if user is None or not user.get("totp_enabled") or not user.get("totp_secret"):
        raise HTTPException(status_code=400, detail="Two-factor authentication is not enabled.")

    if not verify_totp_code(user["totp_secret"], body.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code. Try again.",
        )

    token = create_access_token(user_id)
    safe_user = {k: v for k, v in user.items() if k not in ("password", "totp_secret")}
    logger.info("2FA login completed for user: %s", user_id)
    return AuthResponse(access_token=token, user=safe_user)
