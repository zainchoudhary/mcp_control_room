"""
db_models.py - SQLAlchemy ORM models for PostgreSQL (Neon).
"""
import uuid
from datetime import datetime

from sqlalchemy import String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.config import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    username: Mapped[str] = mapped_column(String(30), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    stripe_customer_id: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True)
    subscription_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    subscription_status: Mapped[str] = mapped_column(String(30), nullable=False, default="inactive")
    plan: Mapped[str] = mapped_column(String(30), nullable=False, default="free")
    subscription_end_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    recovery_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    totp_secret: Mapped[str | None] = mapped_column(String(64), nullable=True)
    totp_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    lock_pin_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)

    devices: Mapped[list["UserDevice"]] = relationship(back_populates="user", cascade="all, delete-orphan")

    def security_summary(self) -> dict:
        return {
            "recovery_email": self.recovery_email,
            "totp_enabled": bool(self.totp_enabled),
            "lock_pin_set": bool(self.lock_pin_hash),
        }

    def to_dict(self, include_password: bool = False) -> dict:
        d = {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "full_name": self.full_name,
            "plan": self.plan or "free",
            "subscription_status": self.subscription_status or "inactive",
            "subscription_end_date": self.subscription_end_date.isoformat() if self.subscription_end_date else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "security": self.security_summary(),
        }
        if include_password:
            d["password"] = self.password
            d["totp_secret"] = self.totp_secret
            d["totp_enabled"] = bool(self.totp_enabled)
        return d


class UserDevice(Base):
    __tablename__ = "user_devices"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    client_device_id: Mapped[str] = mapped_column(String(64), nullable=False)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    user: Mapped["User"] = relationship(back_populates="devices")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "client_device_id": self.client_device_id,
            "label": self.label,
            "user_agent": self.user_agent,
            "last_seen_at": self.last_seen_at.isoformat() if self.last_seen_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class MCP(Base):
    __tablename__ = "mcps"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    transport: Mapped[str] = mapped_column(String(50), nullable=False, default="sse")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    icon: Mapped[str | None] = mapped_column(String(500), nullable=True)
    connected: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    requires_reauth: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    user: Mapped["User"] = relationship(backref="mcps")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.name,
            "url": self.url,
            "transport": self.transport,
            "description": self.description,
            "icon": self.icon,
            "connected": self.connected,
            "requires_reauth": self.requires_reauth,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    user: Mapped["User"] = relationship(backref="sessions")
    messages: Mapped[list["Message"]] = relationship(back_populates="session", cascade="all, delete-orphan")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "title": self.title,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("chat_sessions.id"), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    session: Mapped["ChatSession"] = relationship(back_populates="messages")

    def to_dict(self) -> dict:
        return {"role": self.role, "content": self.content}
