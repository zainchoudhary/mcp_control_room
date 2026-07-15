"""Dashboard weekly stats endpoint."""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import Date, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_utils import get_current_user
from app.db.config import get_db
from app.db.models import ChatSession, Message

router = APIRouter(prefix="/api/stats", tags=["Stats"])


@router.get("/weekly")
async def weekly_stats(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get daily chat/message counts for the last 7 days (real-time stats)."""
    today = datetime.utcnow().date()
    week_ago = today - timedelta(days=6)

    msg_result = await db.execute(
        select(
            cast(Message.created_at, Date).label("day"),
            func.count(Message.id).label("count"),
        )
        .join(ChatSession, Message.session_id == ChatSession.id)
        .where(
            ChatSession.user_id == user["id"],
            Message.role == "user",
            cast(Message.created_at, Date) >= week_ago,
        )
        .group_by(cast(Message.created_at, Date))
        .order_by(cast(Message.created_at, Date))
    )
    msg_rows = msg_result.all()

    sess_result = await db.execute(
        select(
            cast(ChatSession.created_at, Date).label("day"),
            func.count(ChatSession.id).label("count"),
        )
        .where(
            ChatSession.user_id == user["id"],
            cast(ChatSession.created_at, Date) >= week_ago,
        )
        .group_by(cast(ChatSession.created_at, Date))
        .order_by(cast(ChatSession.created_at, Date))
    )
    sess_rows = sess_result.all()

    msg_map = {str(row.day): row.count for row in msg_rows}
    sess_map = {str(row.day): row.count for row in sess_rows}

    days_data = []
    for i in range(7):
        d = week_ago + timedelta(days=i)
        day_str = str(d)
        day_label = d.strftime("%a")
        days_data.append({
            "day": day_label,
            "date": day_str,
            "messages": msg_map.get(day_str, 0),
            "sessions": sess_map.get(day_str, 0),
        })

    total_messages = sum(d["messages"] for d in days_data)
    total_sessions = sum(d["sessions"] for d in days_data)

    return {
        "days": days_data,
        "total_messages": total_messages,
        "total_sessions": total_sessions,
    }
