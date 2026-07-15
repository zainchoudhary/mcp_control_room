"""Shared auth route helpers."""
import re

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.auth_database import get_user_by_email
from app.core.auth_utils import verify_password

_USERNAME_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9._-]*$")


def validate_username_format(username: str) -> str | None:
    """Return error message if invalid, else None."""
    u = username.strip()
    if len(u) < 3:
        return "Username must be at least 3 characters."
    if len(u) > 30:
        return "Username must not exceed 30 characters."
    if not _USERNAME_RE.match(u):
        return "Must start with a letter; use letters, numbers, dots, hyphens, or underscores."
    return None


async def verify_current_password(db: AsyncSession, email: str, password: str) -> None:
    full_user = await get_user_by_email(db, email)
    if not full_user or not verify_password(password, full_user["password"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password is incorrect.",
        )
