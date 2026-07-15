"""Current user profile endpoint."""
from fastapi import Depends

from app.core.auth_models import UserResponse
from app.core.auth_utils import get_current_user

from .router import router


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return UserResponse(**current_user)
