"""
auth_utils.py - Password hashing, JWT creation / verification, email, and dependency injection.
"""
import os
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from db_config import get_db
from auth_database import get_user_by_id, user_device_is_registered

load_dotenv()

logger = logging.getLogger(__name__)

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "toolchain-ai-secret-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours
RESET_TOKEN_EXPIRE_MINUTES = 15

security = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def create_access_token(
    user_id: str,
    client_device_id: Optional[str] = None,
    expires_delta: Optional[timedelta] = None,
) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload = {"sub": user_id, "exp": expire, "iat": datetime.now(timezone.utc)}
    if client_device_id:
        payload["did"] = client_device_id
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> tuple[Optional[str], Optional[str]]:
    """Return (user_id, client_device_id) from token, or (None, None) if invalid/expired."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("purpose") == "password_reset":
            return None, None
        return payload.get("sub"), payload.get("did")
    except jwt.ExpiredSignatureError:
        return None, None
    except jwt.InvalidTokenError:
        return None, None


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """FastAPI dependency: extract and validate the Bearer token, return user dict."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id, client_device_id = decode_access_token(credentials.credentials)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = await get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer exists.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if client_device_id and not await user_device_is_registered(db, user_id, client_device_id):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This device was removed. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def create_reset_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": user_id,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "purpose": "password_reset",
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_reset_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("purpose") != "password_reset":
            return None
        return payload.get("sub")
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def send_reset_email(to_email: str, username: str, reset_token: str, frontend_url: str = "http://localhost:3000"):
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASS", "")

    if not smtp_user or not smtp_pass:
        logger.error("SMTP credentials not configured")
        raise RuntimeError("Email service not configured.")

    reset_link = f"{frontend_url}/reset-password?reset_token={reset_token}"

    html = f"""\
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="display: inline-block; background: linear-gradient(135deg, #10a37f, #0d8c6d); color: white; width: 48px; height: 48px; border-radius: 12px; line-height: 48px; font-size: 20px; font-weight: 700;">T</div>
        <h2 style="margin: 12px 0 0; color: #1a1a1a; font-size: 20px;">ToolChain AI</h2>
      </div>
      <h3 style="color: #1a1a1a; font-size: 18px; margin-bottom: 8px;">Reset your password</h3>
      <p style="color: #555; font-size: 14px; line-height: 1.6;">
        Hi <strong>{username}</strong>, we received a request to reset your password. Click the button below to create a new password. This link expires in {RESET_TOKEN_EXPIRE_MINUTES} minutes.
      </p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="{reset_link}" style="display: inline-block; background: linear-gradient(135deg, #10a37f, #0d8c6d); color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">Reset Password</a>
      </div>
      <p style="color: #888; font-size: 12px; line-height: 1.5;">
        If you didn't request this, you can safely ignore this email. Your password will remain unchanged.
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
      <p style="color: #aaa; font-size: 11px; text-align: center;">ToolChain AI &mdash; AI-Powered Tools Platform</p>
    </div>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Reset your ToolChain AI password"
    msg["From"] = smtp_user
    msg["To"] = to_email
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, to_email, msg.as_string())
        logger.info("Password reset email sent to %s", to_email)
    except Exception as exc:
        logger.error("Failed to send reset email: %s", exc)
        raise RuntimeError("Failed to send reset email. Please try again later.")


def send_contact_email(name: str, email: str, subject: str, category: str, message: str):
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASS", "")
    admin_email = os.getenv("CONTACT_EMAIL", smtp_user)

    if not smtp_user or not smtp_pass:
        logger.error("SMTP credentials not configured")
        raise RuntimeError("Email service not configured.")

    cat_colors = {"complaint": "#ef4444", "feedback": "#f59e0b", "query": "#3b82f6"}
    cat_color = cat_colors.get(category, "#6b7280")

    html = f"""\
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
      <div style="text-align: center; margin-bottom: 28px;">
        <div style="display: inline-block; background: linear-gradient(135deg, #10a37f, #0d8c6d); color: white; width: 48px; height: 48px; border-radius: 12px; line-height: 48px; font-size: 20px; font-weight: 700;">T</div>
        <h2 style="margin: 12px 0 0; color: #1a1a1a; font-size: 20px;">ToolChain AI — Contact</h2>
      </div>
      <div style="background: {cat_color}; color: white; display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px;">{category}</div>
      <h3 style="color: #1a1a1a; font-size: 17px; margin: 0 0 16px;">{subject}</h3>
      <table style="width: 100%; font-size: 13px; color: #444; border-collapse: collapse;">
        <tr><td style="padding: 6px 0; color: #888; width: 70px;">From</td><td style="padding: 6px 0; font-weight: 500;">{name}</td></tr>
        <tr><td style="padding: 6px 0; color: #888;">Email</td><td style="padding: 6px 0;"><a href="mailto:{email}" style="color: #10a37f; text-decoration: none;">{email}</a></td></tr>
      </table>
      <hr style="border: none; border-top: 1px solid #eee; margin: 18px 0;" />
      <div style="background: #f9fafb; border-radius: 8px; padding: 16px; font-size: 14px; color: #333; line-height: 1.7; white-space: pre-wrap;">{message}</div>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="color: #aaa; font-size: 11px; text-align: center;">ToolChain AI — Contact Form Submission</p>
    </div>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"[{category.upper()}] {subject}"
    msg["From"] = smtp_user
    msg["To"] = admin_email
    msg["Reply-To"] = email
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, admin_email, msg.as_string())
        logger.info("Contact form email sent from %s (%s)", name, email)
    except Exception as exc:
        logger.error("Failed to send contact email: %s", exc)
        raise RuntimeError("Failed to send your message. Please try again later.")
