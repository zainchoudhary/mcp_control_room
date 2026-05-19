"""
plan_guard.py - Centralized plan enforcement, usage tracking, and subscription status checks.

Provides reusable FastAPI dependencies for:
  - Subscription status validation (blocks past_due / inactive paid users)
  - Daily message rate limiting
  - Monthly session count enforcement
  - MCP connection enforcement (post-downgrade)
  - Periodic subscription expiry check
"""
import logging
from datetime import datetime, timezone, date, timedelta

from fastapi import HTTPException, Depends
from sqlalchemy import select, func, cast, Date, extract
from sqlalchemy.ext.asyncio import AsyncSession

from db_config import get_db
from db_models import User, Message, ChatSession, MCP
from auth_utils import get_current_user

logger = logging.getLogger(__name__)

PLAN_LIMITS = {
    "free": {"mcps": 2, "messages_per_day": 25, "sessions_per_month": 5},
    "pro": {"mcps": 10, "messages_per_day": 500, "sessions_per_month": 50},
    "enterprise": {"mcps": -1, "messages_per_day": -1, "sessions_per_month": -1},
}

GRACE_PERIOD_DAYS = 3


def get_limits(plan: str) -> dict:
    return PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])


async def _get_user_row(db: AsyncSession, user_id: str) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def _effective_plan(user: User) -> str:
    """Determine the effective plan considering subscription status and expiry."""
    plan = user.plan or "free"
    if plan == "free":
        return "free"

    status = user.subscription_status or "inactive"
    if status in ("active", "trialing"):
        return plan

    if status == "past_due":
        return plan

    if status in ("inactive", "canceled", "unpaid"):
        if user.subscription_end_date:
            grace_end = user.subscription_end_date + timedelta(days=GRACE_PERIOD_DAYS)
            if datetime.now(timezone.utc) <= grace_end.replace(tzinfo=timezone.utc) if grace_end.tzinfo is None else grace_end:
                return plan
        return "free"

    return plan


async def require_active_subscription(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Dependency that checks subscription status.
    - Free users pass through.
    - Paid users with active/trialing status pass through.
    - past_due users get a warning header but still pass.
    - inactive/canceled users are downgraded to free limits.
    """
    plan = user.get("plan", "free")
    if plan == "free":
        user["effective_plan"] = "free"
        return user

    row = await _get_user_row(db, user["id"])
    eff = _effective_plan(row)

    if eff != plan and eff == "free":
        row.plan = "free"
        row.subscription_id = None
        row.subscription_status = "inactive"
        row.subscription_end_date = None
        await db.commit()
        user["plan"] = "free"
        user["effective_plan"] = "free"
        user["subscription_status"] = "inactive"
        logger.info("Auto-downgraded user=%s: subscription expired", user["id"])
    else:
        user["effective_plan"] = eff

    sub_status = user.get("subscription_status") or row.subscription_status
    if sub_status == "past_due":
        user["_past_due_warning"] = True

    return user


async def check_daily_message_limit(
    user: dict = Depends(require_active_subscription),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Dependency that checks if the user has exceeded their daily message limit."""
    plan = user.get("effective_plan", user.get("plan", "free"))
    limits = get_limits(plan)
    max_msgs = limits["messages_per_day"]

    if max_msgs == -1:
        return user

    today = date.today()

    result = await db.execute(
        select(func.count(Message.id))
        .join(ChatSession, Message.session_id == ChatSession.id)
        .where(
            ChatSession.user_id == user["id"],
            Message.role == "user",
            cast(Message.created_at, Date) == today,
        )
    )
    count = result.scalar() or 0

    user["_daily_messages_used"] = count
    user["_daily_messages_limit"] = max_msgs

    if count >= max_msgs:
        raise HTTPException(
            status_code=429,
            detail=f"Daily message limit reached ({max_msgs} messages/day on your {plan.title()} plan). Upgrade your plan for more messages.",
        )

    return user


def _current_month_start() -> datetime:
    """Return the first moment of the current month (UTC)."""
    now = datetime.now(timezone.utc)
    return datetime(now.year, now.month, 1, tzinfo=timezone.utc)


async def check_session_limit(
    user: dict = Depends(require_active_subscription),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Dependency that checks if the user can create a new session this month."""
    plan = user.get("effective_plan", user.get("plan", "free"))
    limits = get_limits(plan)
    max_sessions = limits["sessions_per_month"]

    if max_sessions == -1:
        return user

    month_start = _current_month_start()

    result = await db.execute(
        select(func.count(ChatSession.id))
        .where(
            ChatSession.user_id == user["id"],
            ChatSession.created_at >= month_start,
        )
    )
    count = result.scalar() or 0

    if count >= max_sessions:
        raise HTTPException(
            status_code=403,
            detail=f"Monthly session limit reached ({max_sessions} sessions/month on your {plan.title()} plan). Your limit resets next month, or upgrade your plan.",
        )

    return user


async def check_mcp_register_limit(
    user: dict = Depends(require_active_subscription),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Dependency that checks if the user can register a new MCP."""
    plan = user.get("effective_plan", user.get("plan", "free"))
    limits = get_limits(plan)
    max_mcps = limits["mcps"]

    if max_mcps == -1:
        return user

    result = await db.execute(
        select(func.count(MCP.id))
        .where(MCP.user_id == user["id"])
    )
    count = result.scalar() or 0

    if count >= max_mcps:
        raise HTTPException(
            status_code=403,
            detail=f"MCP server limit reached ({max_mcps} servers on your {plan.title()} plan). Upgrade your plan to add more.",
        )

    return user


async def check_mcp_connect_limit(
    user: dict = Depends(require_active_subscription),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Dependency that checks if a user can connect/use an MCP.
    Post-downgrade: only allows connecting up to the plan's MCP limit.
    """
    plan = user.get("effective_plan", user.get("plan", "free"))
    limits = get_limits(plan)
    max_mcps = limits["mcps"]

    if max_mcps == -1:
        return user

    result = await db.execute(
        select(func.count(MCP.id))
        .where(MCP.user_id == user["id"], MCP.connected == True)  # noqa: E712
    )
    connected_count = result.scalar() or 0

    if connected_count >= max_mcps:
        raise HTTPException(
            status_code=403,
            detail=f"You can only have {max_mcps} connected MCP servers on your {plan.title()} plan. Disconnect one or upgrade.",
        )

    return user


async def check_tool_execution_access(
    user: dict = Depends(require_active_subscription),
) -> dict:
    """Dependency that restricts direct tool execution to Pro+ users."""
    plan = user.get("effective_plan", user.get("plan", "free"))
    if plan == "free":
        raise HTTPException(
            status_code=403,
            detail="Tool Execution is available on Pro and Enterprise plans. Upgrade to access this feature.",
        )
    return user


async def get_usage_stats(db: AsyncSession, user_id: str, plan: str) -> dict:
    """Get current usage stats for a user (messages = today, sessions = this month)."""
    limits = get_limits(plan)
    today = date.today()
    month_start = _current_month_start()

    msg_result = await db.execute(
        select(func.count(Message.id))
        .join(ChatSession, Message.session_id == ChatSession.id)
        .where(
            ChatSession.user_id == user_id,
            Message.role == "user",
            cast(Message.created_at, Date) == today,
        )
    )
    messages_today = msg_result.scalar() or 0

    session_result = await db.execute(
        select(func.count(ChatSession.id))
        .where(
            ChatSession.user_id == user_id,
            ChatSession.created_at >= month_start,
        )
    )
    sessions_this_month = session_result.scalar() or 0

    mcp_result = await db.execute(
        select(func.count(MCP.id))
        .where(MCP.user_id == user_id)
    )
    total_mcps = mcp_result.scalar() or 0

    connected_result = await db.execute(
        select(func.count(MCP.id))
        .where(MCP.user_id == user_id, MCP.connected == True)  # noqa: E712
    )
    connected_mcps = connected_result.scalar() or 0

    max_msgs = limits["messages_per_day"]
    max_sess = limits["sessions_per_month"]
    max_mcps = limits["mcps"]

    now = datetime.now(timezone.utc)
    days_left_in_month = (datetime(now.year, now.month + 1, 1, tzinfo=timezone.utc) - now).days if now.month < 12 else (datetime(now.year + 1, 1, 1, tzinfo=timezone.utc) - now).days

    return {
        "messages": {
            "used": messages_today,
            "limit": max_msgs,
            "resets": "daily",
            "label": "Unlimited" if max_msgs == -1 else f"{messages_today}/{max_msgs}",
        },
        "sessions": {
            "used": sessions_this_month,
            "limit": max_sess,
            "resets": "monthly",
            "days_until_reset": days_left_in_month,
            "label": "Unlimited" if max_sess == -1 else f"{sessions_this_month}/{max_sess}",
        },
        "mcps": {
            "used": total_mcps,
            "connected": connected_mcps,
            "limit": max_mcps,
            "label": "Unlimited" if max_mcps == -1 else f"{total_mcps}/{max_mcps}",
        },
    }


async def check_and_downgrade_expired_users(db: AsyncSession) -> int:
    """
    Scan all paid users and downgrade those whose subscription has expired.
    Returns the number of users downgraded.
    """
    now = datetime.now(timezone.utc)
    grace = timedelta(days=GRACE_PERIOD_DAYS)

    result = await db.execute(
        select(User).where(
            User.plan != "free",
            User.subscription_end_date.isnot(None),
        )
    )
    users = result.scalars().all()
    downgraded = 0

    for u in users:
        end_dt = u.subscription_end_date
        if end_dt.tzinfo is None:
            end_dt = end_dt.replace(tzinfo=timezone.utc)

        if now > end_dt + grace:
            if u.subscription_status not in ("active", "trialing"):
                u.plan = "free"
                u.subscription_id = None
                u.subscription_status = "inactive"
                u.subscription_end_date = None
                downgraded += 1
                logger.info("Expiry downgrade: user=%s", u.id)

    if downgraded:
        await db.commit()

    return downgraded
