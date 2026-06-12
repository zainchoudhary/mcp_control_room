"""
database.py - MCP registry, sessions, and messages persistence layer (SQLAlchemy + PostgreSQL).
"""
from typing import Optional
from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from db_models import MCP, ChatSession, Message
from ghost_mode import GHOST_SESSION_TITLE


async def register_mcp(
    db: AsyncSession,
    user_id: str,
    name: str,
    url: str,
    transport: str,
    description: Optional[str] = None,
    icon: Optional[str] = None,
) -> dict:
    """Register a new MCP server for a user."""
    mcp = MCP(user_id=user_id, name=name, url=url, transport=transport, description=description, icon=icon)
    db.add(mcp)
    await db.commit()
    await db.refresh(mcp)
    return mcp.to_dict()


async def list_mcps(db: AsyncSession, user_id: str) -> list:
    """List all registered MCPs for a user."""
    result = await db.execute(
        select(MCP).where(MCP.user_id == user_id).order_by(MCP.created_at.desc())
    )
    return [row.to_dict() for row in result.scalars().all()]


async def get_mcp(db: AsyncSession, mcp_id: str, user_id: str) -> Optional[dict]:
    """Get a single MCP by ID, scoped to user."""
    result = await db.execute(select(MCP).where(MCP.id == mcp_id, MCP.user_id == user_id))
    mcp = result.scalar_one_or_none()
    return mcp.to_dict() if mcp else None


async def set_mcp_connection(db: AsyncSession, mcp_id: str, user_id: str, connected: bool):
    """Toggle MCP connection status (only if owned by user)."""
    result = await db.execute(select(MCP).where(MCP.id == mcp_id, MCP.user_id == user_id))
    mcp = result.scalar_one_or_none()
    if mcp:
        mcp.connected = connected
        if connected:
            mcp.requires_reauth = False
        await db.commit()


async def set_mcp_requires_reauth(
    db: AsyncSession,
    mcp_id: str,
    user_id: str,
    requires_reauth: bool,
):
    """Flag MCP as needing OAuth re-authentication (manual disconnect or server went offline)."""
    result = await db.execute(select(MCP).where(MCP.id == mcp_id, MCP.user_id == user_id))
    mcp = result.scalar_one_or_none()
    if mcp:
        mcp.requires_reauth = requires_reauth
        await db.commit()


async def disconnect_mcps(db: AsyncSession, user_id: str, mcp_ids: list[str]) -> list[str]:
    """Mark MCPs as disconnected (e.g. unreachable backend) and require re-auth on reconnect."""
    if not mcp_ids:
        return []
    disconnected: list[str] = []
    for mcp_id in mcp_ids:
        result = await db.execute(
            select(MCP).where(
                MCP.id == mcp_id,
                MCP.user_id == user_id,
                MCP.connected == True,  # noqa: E712
            )
        )
        mcp = result.scalar_one_or_none()
        if mcp:
            mcp.connected = False
            mcp.requires_reauth = True
            disconnected.append(mcp_id)
    if disconnected:
        await db.commit()
    return disconnected


async def delete_mcp(db: AsyncSession, mcp_id: str, user_id: str):
    """Delete an MCP by ID (only if owned by user)."""
    result = await db.execute(select(MCP).where(MCP.id == mcp_id, MCP.user_id == user_id))
    mcp = result.scalar_one_or_none()
    if mcp:
        await db.delete(mcp)
        await db.commit()


async def get_connected_mcps(db: AsyncSession, user_id: str) -> list:
    """Get all connected MCPs for a user."""
    result = await db.execute(
        select(MCP).where(MCP.user_id == user_id, MCP.connected == True)  # noqa: E712
    )
    return [row.to_dict() for row in result.scalars().all()]


async def create_session(db: AsyncSession, user_id: str, title: Optional[str] = None) -> dict:
    """Create a new chat session for a user."""
    session = ChatSession(user_id=user_id, title=title)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session.to_dict()


async def get_session(db: AsyncSession, session_id: str, user_id: str) -> Optional[dict]:
    """Get a chat session by ID, scoped to user."""
    result = await db.execute(
        select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == user_id)
    )
    session = result.scalar_one_or_none()
    return session.to_dict() if session else None


async def create_ghost_session(db: AsyncSession, user_id: str) -> dict:
    """Ephemeral session — hidden from sidebar, wiped when ghost mode ends."""
    session = ChatSession(user_id=user_id, title=GHOST_SESSION_TITLE)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session.to_dict()


async def list_user_sessions(db: AsyncSession, user_id: str) -> list:
    """List all chat sessions for a user, newest first (excludes ghost sessions)."""
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.user_id == user_id)
        .where(ChatSession.title != GHOST_SESSION_TITLE)
        .order_by(ChatSession.created_at.desc())
    )
    return [row.to_dict() for row in result.scalars().all()]


async def update_session_title(db: AsyncSession, session_id: str, title: str):
    """Update a session's title."""
    await db.execute(
        update(ChatSession)
        .where(ChatSession.id == session_id)
        .values(title=title)
    )
    await db.commit()


async def delete_session(db: AsyncSession, session_id: str, user_id: str):
    """Delete a session and its messages (only if owned by user)."""
    result = await db.execute(
        select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == user_id)
    )
    session = result.scalar_one_or_none()
    if session:
        from chat_attachments import clear_session_attachments
        clear_session_attachments(user_id, session_id)
        await db.delete(session)
        await db.commit()
        return True
    return False


async def save_message(db: AsyncSession, session_id: str, role: str, content: str):
    """Persist a chat message."""
    msg = Message(session_id=session_id, role=role, content=content)
    db.add(msg)
    await db.commit()


async def get_session_messages(db: AsyncSession, session_id: str) -> list:
    """Retrieve all messages for a session."""
    result = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at)
    )
    return [row.to_dict() for row in result.scalars().all()]


async def get_all_user_sessions_with_messages(db: AsyncSession, user_id: str) -> list:
    """Fetch all sessions with their messages for export."""
    result = await db.execute(
        select(ChatSession)
        .options(selectinload(ChatSession.messages))
        .where(ChatSession.user_id == user_id)
        .where(ChatSession.title != GHOST_SESSION_TITLE)
        .order_by(ChatSession.created_at.desc())
    )
    sessions = result.scalars().all()
    out = []
    for s in sessions:
        msgs = sorted(s.messages, key=lambda m: m.created_at)
        out.append({
            **s.to_dict(),
            "messages": [m.to_dict() for m in msgs],
        })
    return out


async def delete_all_user_sessions(db: AsyncSession, user_id: str) -> int:
    """Bulk delete all sessions (and cascaded messages) for a user. Returns count deleted."""
    result = await db.execute(
        select(ChatSession).where(ChatSession.user_id == user_id)
    )
    sessions = result.scalars().all()
    count = len(sessions)
    for s in sessions:
        await db.delete(s)
    await db.commit()
    return count
