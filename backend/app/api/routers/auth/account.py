"""Account management: username change and account deletion."""
import logging

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.auth_database import (
    delete_user_account,
    get_user_by_email,
    update_user_username,
    username_exists,
)
from app.core.auth_models import ChangeUsernameRequest, DeleteAccountRequest
from app.core.auth_utils import get_current_user, verify_password
from app.db.config import get_db

from .router import router

logger = logging.getLogger(__name__)


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

    logger.info(
        "Username changed for user %s: %s → %s",
        current_user["id"],
        current_user.get("username"),
        body.new_username,
    )
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
