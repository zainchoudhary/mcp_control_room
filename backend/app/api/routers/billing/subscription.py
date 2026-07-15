"""Subscription and usage endpoints."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_utils import get_current_user
from app.db.config import get_db
from app.core.plan_guard import get_limits, get_usage_stats

from .deps import get_user_row

router = APIRouter(prefix="/api/billing", tags=["billing"])


@router.get("/subscription")
async def get_subscription(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the current user's subscription status with usage data."""
    row = await get_user_row(db, user["id"])
    plan = row.plan or "free"
    usage = await get_usage_stats(db, user["id"], plan)
    return {
        "plan": plan,
        "status": row.subscription_status or "inactive",
        "subscription_id": row.subscription_id,
        "end_date": row.subscription_end_date.isoformat() if row.subscription_end_date else None,
        "limits": get_limits(plan),
        "usage": usage,
    }


@router.get("/usage")
async def get_usage(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return current usage stats for the authenticated user."""
    plan = user.get("plan", "free")
    usage = await get_usage_stats(db, user["id"], plan)
    return {"plan": plan, "usage": usage}
