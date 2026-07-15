"""User registration endpoint."""
import logging

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.auth_database import create_user, email_exists, username_exists
from app.core.auth_models import AuthResponse, SignupRequest
from app.core.auth_utils import create_access_token, hash_password
from app.db.config import get_db

from .router import router

logger = logging.getLogger(__name__)


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
