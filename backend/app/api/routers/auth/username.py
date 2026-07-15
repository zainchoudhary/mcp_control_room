"""Username availability check endpoint."""
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.auth_database import username_exists
from app.core.auth_utils import get_current_user
from app.db.config import get_db

from .deps import validate_username_format
from .router import router


@router.get("/username/check")
async def check_username_availability(
    username: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check if a username is valid and available (for settings checker)."""
    u = username.strip()
    fmt_err = validate_username_format(u)
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
