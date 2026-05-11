"""
auth_database.py - User authentication persistence layer (SQLAlchemy + MySQL).
"""
from typing import Optional
from sqlalchemy import select, delete, text
from sqlalchemy.ext.asyncio import AsyncSession

from db_models import User, MCP, ChatSession, Message


async def create_user(
    db: AsyncSession,
    username: str,
    email: str,
    hashed_password: str,
    full_name: Optional[str] = None,
) -> dict:
    """Insert a new user and return its data (without password)."""
    user = User(
        username=username,
        email=email.lower(),
        password=hashed_password,
        full_name=full_name,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user.to_dict()


async def get_user_by_email(db: AsyncSession, email: str) -> Optional[dict]:
    """Fetch a user by email (includes hashed password for verification)."""
    result = await db.execute(select(User).where(User.email == email.lower()))
    user = result.scalar_one_or_none()
    return user.to_dict(include_password=True) if user else None


async def get_user_by_username(db: AsyncSession, username: str) -> Optional[dict]:
    """Fetch a user by username."""
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    return user.to_dict(include_password=True) if user else None


async def get_user_by_id(db: AsyncSession, user_id: str) -> Optional[dict]:
    """Fetch a user by id (excludes password)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    return user.to_dict() if user else None


async def email_exists(db: AsyncSession, email: str) -> bool:
    result = await db.execute(select(User.id).where(User.email == email.lower()))
    return result.scalar_one_or_none() is not None


async def username_exists(db: AsyncSession, username: str) -> bool:
    result = await db.execute(select(User.id).where(User.username == username))
    return result.scalar_one_or_none() is not None


async def update_user_password(db: AsyncSession, user_id: str, hashed_password: str):
    """Update a user's password."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user:
        user.password = hashed_password
        await db.commit()


async def update_user_username(db: AsyncSession, user_id: str, new_username: str) -> dict:
    """Update a user's username and return updated user dict."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user:
        user.username = new_username
        await db.commit()
        await db.refresh(user)
        return user.to_dict()
    return None


async def delete_user_account(db: AsyncSession, user_id: str):
    """Permanently delete a user and all their data (sessions, messages, MCPs, legacy tables)."""
    sessions = await db.execute(select(ChatSession.id).where(ChatSession.user_id == user_id))
    session_ids = [row[0] for row in sessions.fetchall()]

    if session_ids:
        await db.execute(delete(Message).where(Message.session_id.in_(session_ids)))

    await db.execute(delete(ChatSession).where(ChatSession.user_id == user_id))
    await db.execute(delete(MCP).where(MCP.user_id == user_id))

    legacy_tables = ["gmail_tokens"]
    for table_name in legacy_tables:
        try:
            await db.execute(text(f"DELETE FROM {table_name} WHERE user_id = :uid"), {"uid": user_id})
        except Exception:
            pass

    await db.execute(delete(User).where(User.id == user_id))
    await db.commit()
