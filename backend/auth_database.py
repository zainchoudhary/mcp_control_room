"""
auth_database.py - User authentication persistence layer (SQLAlchemy + MySQL).
"""
from typing import Optional
from datetime import datetime

from sqlalchemy import select, delete, desc
from sqlalchemy.ext.asyncio import AsyncSession

from db_models import User, UserDevice, MCP, ChatSession, Message


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
    await db.execute(delete(UserDevice).where(UserDevice.user_id == user_id))

    await db.execute(delete(User).where(User.id == user_id))
    await db.commit()


async def list_user_devices(db: AsyncSession, user_id: str) -> list[dict]:
    result = await db.execute(
        select(UserDevice)
        .where(UserDevice.user_id == user_id)
        .order_by(desc(UserDevice.last_seen_at))
    )
    return [d.to_dict() for d in result.scalars().all()]


async def register_user_device(
    db: AsyncSession,
    user_id: str,
    client_device_id: str,
    label: str,
    user_agent: Optional[str] = None,
) -> dict:
    result = await db.execute(
        select(UserDevice).where(
            UserDevice.user_id == user_id,
            UserDevice.client_device_id == client_device_id,
        )
    )
    device = result.scalar_one_or_none()
    now = datetime.utcnow()
    if device:
        device.label = label
        device.user_agent = user_agent
        device.last_seen_at = now
    else:
        device = UserDevice(
            user_id=user_id,
            client_device_id=client_device_id,
            label=label,
            user_agent=user_agent,
            last_seen_at=now,
        )
        db.add(device)
    await db.commit()
    await db.refresh(device)
    return device.to_dict()


async def user_device_is_registered(
    db: AsyncSession, user_id: str, client_device_id: str
) -> bool:
    result = await db.execute(
        select(UserDevice.id).where(
            UserDevice.user_id == user_id,
            UserDevice.client_device_id == client_device_id,
        )
    )
    return result.scalar_one_or_none() is not None


async def delete_user_device(db: AsyncSession, user_id: str, device_id: str) -> bool:
    result = await db.execute(
        select(UserDevice).where(UserDevice.id == device_id, UserDevice.user_id == user_id)
    )
    device = result.scalar_one_or_none()
    if not device:
        return False
    await db.delete(device)
    await db.commit()
    return True
