"""
database.py - MCP registry, sessions, and messages persistence layer (SQLAlchemy + MySQL).
"""
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db_models import MCP, ChatSession, Message


async def register_mcp(
    db: AsyncSession,
    name: str,
    url: str,
    transport: str,
    description: Optional[str] = None,
) -> dict:
    """Register a new MCP server."""
    mcp = MCP(name=name, url=url, transport=transport, description=description)
    db.add(mcp)
    await db.commit()
    await db.refresh(mcp)
    return mcp.to_dict()


async def list_mcps(db: AsyncSession) -> list:
    """List all registered MCPs."""
    result = await db.execute(select(MCP).order_by(MCP.created_at.desc()))
    return [row.to_dict() for row in result.scalars().all()]


async def get_mcp(db: AsyncSession, mcp_id: str) -> Optional[dict]:
    """Get a single MCP by ID."""
    result = await db.execute(select(MCP).where(MCP.id == mcp_id))
    mcp = result.scalar_one_or_none()
    return mcp.to_dict() if mcp else None


async def set_mcp_connection(db: AsyncSession, mcp_id: str, connected: bool):
    """Toggle MCP connection status."""
    result = await db.execute(select(MCP).where(MCP.id == mcp_id))
    mcp = result.scalar_one_or_none()
    if mcp:
        mcp.connected = connected
        await db.commit()


async def delete_mcp(db: AsyncSession, mcp_id: str):
    """Delete an MCP by ID."""
    result = await db.execute(select(MCP).where(MCP.id == mcp_id))
    mcp = result.scalar_one_or_none()
    if mcp:
        await db.delete(mcp)
        await db.commit()


async def get_connected_mcps(db: AsyncSession) -> list:
    """Get all connected MCPs."""
    result = await db.execute(select(MCP).where(MCP.connected == True))  # noqa: E712
    return [row.to_dict() for row in result.scalars().all()]


async def create_session(db: AsyncSession) -> str:
    """Create a new chat session."""
    session = ChatSession()
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session.id


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
