"""
gmail_oauth.py - Per-user Gmail OAuth2 management.

Handles:
  - Generating OAuth authorization URLs per user
  - Processing OAuth callbacks and storing tokens per user
  - Loading per-user Gmail credentials from DB
  - Building Gmail API service objects per user
  - Auto-refreshing expired tokens
"""
import json
import os
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db_models import GmailToken

load_dotenv()

logger = logging.getLogger(__name__)

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.compose",
    "https://www.googleapis.com/auth/gmail.labels",
]

CREDENTIALS_FILE = Path(__file__).parent / "gmail_credentials.json"

OAUTH_REDIRECT_URI = os.getenv("GMAIL_OAUTH_REDIRECT_URI", "http://localhost:8000/api/gmail/callback")


def _load_client_config() -> dict:
    """Load OAuth2 client config from gmail_credentials.json."""
    if not CREDENTIALS_FILE.exists():
        raise RuntimeError(
            f"Gmail credentials file not found at: {CREDENTIALS_FILE}\n"
            "Download OAuth2 Client JSON from Google Cloud Console."
        )
    data = json.loads(CREDENTIALS_FILE.read_text())
    if "installed" in data:
        return data["installed"]
    elif "web" in data:
        return data["web"]
    raise RuntimeError("Invalid gmail_credentials.json format")


def _build_flow():
    """Build an OAuth2 Flow using stored client credentials."""
    from google_auth_oauthlib.flow import Flow

    client_config = _load_client_config()

    return Flow.from_client_config(
        {
            "web": {
                "client_id": client_config["client_id"],
                "client_secret": client_config["client_secret"],
                "auth_uri": client_config.get("auth_uri", "https://accounts.google.com/o/oauth2/auth"),
                "token_uri": client_config.get("token_uri", "https://oauth2.googleapis.com/token"),
            }
        },
        scopes=SCOPES,
        redirect_uri=OAUTH_REDIRECT_URI,
    )


def generate_auth_url(user_id: str) -> str:
    """Generate Google OAuth2 authorization URL for a user."""
    flow = _build_flow()

    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        state=user_id,
    )
    return auth_url


async def exchange_code_for_token(code: str, user_id: str, db: AsyncSession) -> dict:
    """Exchange auth code for tokens and store in DB for the user."""
    from googleapiclient.discovery import build

    flow = _build_flow()
    flow.fetch_token(code=code)
    creds = flow.credentials

    service = build("gmail", "v1", credentials=creds)
    profile = service.users().getProfile(userId="me").execute()
    gmail_email = profile.get("emailAddress", "")

    token_expiry = None
    if creds.expiry:
        token_expiry = creds.expiry.replace(tzinfo=None) if creds.expiry.tzinfo else creds.expiry

    result = await db.execute(
        select(GmailToken).where(GmailToken.user_id == user_id)
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.gmail_email = gmail_email
        existing.access_token = creds.token
        existing.refresh_token = creds.refresh_token or existing.refresh_token
        existing.token_expiry = token_expiry
        existing.scopes = json.dumps(list(creds.scopes)) if creds.scopes else None
        existing.updated_at = datetime.utcnow()
    else:
        token_record = GmailToken(
            user_id=user_id,
            gmail_email=gmail_email,
            access_token=creds.token,
            refresh_token=creds.refresh_token,
            token_expiry=token_expiry,
            scopes=json.dumps(list(creds.scopes)) if creds.scopes else None,
        )
        db.add(token_record)

    await db.commit()

    logger.info("Gmail OAuth token stored for user %s (email: %s)", user_id, gmail_email)
    return {"email": gmail_email, "user_id": user_id}


async def get_user_gmail_status(user_id: str, db: AsyncSession) -> Optional[dict]:
    """Check if a user has linked Gmail. Returns token info or None."""
    result = await db.execute(
        select(GmailToken).where(GmailToken.user_id == user_id)
    )
    token = result.scalar_one_or_none()
    if token:
        return token.to_dict()
    return None


async def revoke_user_gmail(user_id: str, db: AsyncSession) -> bool:
    """Revoke/unlink Gmail for a user."""
    result = await db.execute(
        select(GmailToken).where(GmailToken.user_id == user_id)
    )
    token = result.scalar_one_or_none()
    if token:
        await db.delete(token)
        await db.commit()
        logger.info("Gmail token revoked for user %s", user_id)
        return True
    return False


def build_gmail_service_from_token(token_record: GmailToken):
    """Build a Gmail API service from a stored token record, auto-refreshing if needed."""
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build

    client_config = _load_client_config()

    creds = Credentials(
        token=token_record.access_token,
        refresh_token=token_record.refresh_token,
        token_uri=client_config.get("token_uri", "https://oauth2.googleapis.com/token"),
        client_id=client_config["client_id"],
        client_secret=client_config["client_secret"],
        scopes=SCOPES,
    )

    if creds.expired and creds.refresh_token:
        creds.refresh(Request())

    return build("gmail", "v1", credentials=creds), creds


async def get_user_gmail_service(user_id: str, db: AsyncSession):
    """
    Get Gmail API service for a specific user.
    Returns (service, email) tuple or raises RuntimeError if not authenticated.
    """
    result = await db.execute(
        select(GmailToken).where(GmailToken.user_id == user_id)
    )
    token_record = result.scalar_one_or_none()

    if not token_record:
        raise RuntimeError("Gmail not connected. Please authenticate via Settings > Connect Gmail.")

    service, refreshed_creds = build_gmail_service_from_token(token_record)

    if refreshed_creds.token != token_record.access_token:
        token_record.access_token = refreshed_creds.token
        if refreshed_creds.expiry:
            token_record.token_expiry = refreshed_creds.expiry.replace(tzinfo=None)
        token_record.updated_at = datetime.utcnow()
        await db.commit()
        logger.info("Gmail token refreshed for user %s", user_id)

    return service, token_record.gmail_email
