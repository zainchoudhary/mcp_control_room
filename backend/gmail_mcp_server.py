#!/usr/bin/env python3
"""
Gmail MCP Server — Per-user Gmail integration with Google OAuth2.

Each tool accepts a `user_id` parameter to load that user's OAuth token from the database.
The backend injects user_id automatically — the LLM never needs to provide it.

Run with:
  python gmail_mcp_server.py

The server exposes Gmail tools over MCP on port 9002.
"""

import asyncio
import base64
import json
import os
import sys
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP

load_dotenv()

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.compose",
    "https://www.googleapis.com/auth/gmail.labels",
]

CREDENTIALS_FILE = Path(__file__).parent / "gmail_credentials.json"

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://neondb_owner:npg_XwLWA9Omu4jF@ep-lively-waterfall-ani227tu-pooler.c-6.us-east-1.aws.neon.tech/neondb?ssl=require",
)

SYNC_DATABASE_URL = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql+psycopg2://").replace("?ssl=require", "?sslmode=require")

mcp = FastMCP("Gmail-MCP", host="127.0.0.1", port=9002)


def _load_client_config() -> dict:
    if not CREDENTIALS_FILE.exists():
        raise RuntimeError(f"Gmail credentials file not found at: {CREDENTIALS_FILE}")
    data = json.loads(CREDENTIALS_FILE.read_text())
    if "installed" in data:
        return data["installed"]
    elif "web" in data:
        return data["web"]
    raise RuntimeError("Invalid gmail_credentials.json format")


def _get_gmail_service_for_user(user_id: str):
    """
    Load OAuth token for the given user from the database and build Gmail service.
    Auto-refreshes token if expired.
    """
    from sqlalchemy import create_engine, text
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build

    engine = create_engine(SYNC_DATABASE_URL, pool_pre_ping=True)

    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT access_token, refresh_token, token_expiry FROM gmail_tokens WHERE user_id = :uid"),
            {"uid": user_id},
        )
        row = result.fetchone()

    if not row:
        raise RuntimeError(
            "Gmail not authenticated for this user. "
            "Please connect your Gmail account from Settings or the MCP Servers page."
        )

    access_token, refresh_token, token_expiry = row
    client_config = _load_client_config()

    creds = Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri=client_config.get("token_uri", "https://oauth2.googleapis.com/token"),
        client_id=client_config["client_id"],
        client_secret=client_config["client_secret"],
        scopes=SCOPES,
    )

    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        with engine.connect() as conn:
            conn.execute(
                text(
                    "UPDATE gmail_tokens SET access_token = :token, "
                    "token_expiry = :expiry, updated_at = NOW() WHERE user_id = :uid"
                ),
                {
                    "token": creds.token,
                    "expiry": creds.expiry.replace(tzinfo=None) if creds.expiry else None,
                    "uid": user_id,
                },
            )
            conn.commit()

    engine.dispose()
    return build("gmail", "v1", credentials=creds)


def _decode_body(payload) -> str:
    """Recursively extract text body from email payload."""
    if payload.get("body", {}).get("data"):
        return base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", errors="replace")

    parts = payload.get("parts", [])
    for part in parts:
        mime = part.get("mimeType", "")
        if mime == "text/plain":
            data = part.get("body", {}).get("data", "")
            if data:
                return base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
    for part in parts:
        mime = part.get("mimeType", "")
        if mime == "text/html":
            data = part.get("body", {}).get("data", "")
            if data:
                return base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
    for part in parts:
        if part.get("parts"):
            result = _decode_body(part)
            if result:
                return result
    return ""


def _get_header(headers: list, name: str) -> str:
    for h in headers:
        if h.get("name", "").lower() == name.lower():
            return h.get("value", "")
    return ""


# ═══════════════════════════════════════════════════════
#  TOOL 1: Search Emails
# ═══════════════════════════════════════════════════════

@mcp.tool()
def search_emails(user_id: str, query: str, max_results: int = 10) -> str:
    """
    Search emails using Gmail search syntax.
    Examples: 'from:someone@gmail.com', 'subject:meeting', 'is:unread', 'has:attachment',
    'after:2024/01/01', 'label:important', 'in:inbox newer_than:7d'
    """
    try:
        service = _get_gmail_service_for_user(user_id)
        results = service.users().messages().list(
            userId="me", q=query, maxResults=min(max_results, 50)
        ).execute()

        messages = results.get("messages", [])
        if not messages:
            return json.dumps({"success": True, "query": query, "results": [], "count": 0})

        emails = []
        for msg in messages:
            detail = service.users().messages().get(
                userId="me", id=msg["id"], format="metadata",
                metadataHeaders=["From", "To", "Subject", "Date"]
            ).execute()
            headers = detail.get("payload", {}).get("headers", [])
            emails.append({
                "id": msg["id"],
                "thread_id": detail.get("threadId", ""),
                "from": _get_header(headers, "From"),
                "to": _get_header(headers, "To"),
                "subject": _get_header(headers, "Subject"),
                "date": _get_header(headers, "Date"),
                "snippet": detail.get("snippet", ""),
                "labels": detail.get("labelIds", []),
            })

        return json.dumps({"success": True, "query": query, "results": emails, "count": len(emails)})
    except Exception as e:
        return json.dumps({"error": str(e)})


# ═══════════════════════════════════════════════════════
#  TOOL 2: Read Email
# ═══════════════════════════════════════════════════════

@mcp.tool()
def read_email(user_id: str, email_id: str) -> str:
    """Read the full content of an email by its ID. Get IDs from search_emails."""
    try:
        service = _get_gmail_service_for_user(user_id)
        msg = service.users().messages().get(userId="me", id=email_id, format="full").execute()

        headers = msg.get("payload", {}).get("headers", [])
        body = _decode_body(msg.get("payload", {}))

        attachments = []
        for part in msg.get("payload", {}).get("parts", []):
            filename = part.get("filename")
            if filename:
                attachments.append({
                    "filename": filename,
                    "mimeType": part.get("mimeType", ""),
                    "size": part.get("body", {}).get("size", 0),
                    "attachmentId": part.get("body", {}).get("attachmentId", ""),
                })

        return json.dumps({
            "success": True,
            "id": email_id,
            "thread_id": msg.get("threadId", ""),
            "from": _get_header(headers, "From"),
            "to": _get_header(headers, "To"),
            "cc": _get_header(headers, "Cc"),
            "subject": _get_header(headers, "Subject"),
            "date": _get_header(headers, "Date"),
            "body": body[:5000],
            "labels": msg.get("labelIds", []),
            "attachments": attachments,
        })
    except Exception as e:
        return json.dumps({"error": str(e)})


# ═══════════════════════════════════════════════════════
#  TOOL 3: Send Email
# ═══════════════════════════════════════════════════════

@mcp.tool()
def send_email(user_id: str, to: str, subject: str, body: str, cc: str = "", bcc: str = "") -> str:
    """
    Send an email from the user's Gmail account.
    - to: recipient email (comma-separated for multiple)
    - subject: email subject
    - body: email body text
    """
    try:
        service = _get_gmail_service_for_user(user_id)
        message = MIMEMultipart()
        message["to"] = to
        message["subject"] = subject
        if cc:
            message["cc"] = cc
        if bcc:
            message["bcc"] = bcc
        message.attach(MIMEText(body, "plain"))

        raw = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")
        sent = service.users().messages().send(userId="me", body={"raw": raw}).execute()

        return json.dumps({
            "success": True,
            "message": f"Email sent successfully to {to}",
            "id": sent.get("id", ""),
            "thread_id": sent.get("threadId", ""),
        })
    except Exception as e:
        return json.dumps({"error": str(e)})


# ═══════════════════════════════════════════════════════
#  TOOL 4: Reply to Email
# ═══════════════════════════════════════════════════════

@mcp.tool()
def reply_to_email(user_id: str, email_id: str, body: str) -> str:
    """Reply to an existing email thread. Maintains the thread context."""
    try:
        service = _get_gmail_service_for_user(user_id)
        original = service.users().messages().get(userId="me", id=email_id, format="metadata",
                                                   metadataHeaders=["From", "To", "Subject", "Message-ID"]).execute()
        headers = original.get("payload", {}).get("headers", [])
        reply_to = _get_header(headers, "From")
        subject = _get_header(headers, "Subject")
        message_id = _get_header(headers, "Message-ID")
        thread_id = original.get("threadId", "")

        if not subject.lower().startswith("re:"):
            subject = f"Re: {subject}"

        message = MIMEMultipart()
        message["to"] = reply_to
        message["subject"] = subject
        message["In-Reply-To"] = message_id
        message["References"] = message_id
        message.attach(MIMEText(body, "plain"))

        raw = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")
        sent = service.users().messages().send(
            userId="me", body={"raw": raw, "threadId": thread_id}
        ).execute()

        return json.dumps({
            "success": True,
            "message": f"Reply sent to {reply_to}",
            "id": sent.get("id", ""),
            "thread_id": sent.get("threadId", ""),
        })
    except Exception as e:
        return json.dumps({"error": str(e)})


# ═══════════════════════════════════════════════════════
#  TOOL 5: Get Inbox Summary
# ═══════════════════════════════════════════════════════

@mcp.tool()
def get_inbox_summary(user_id: str, max_results: int = 15) -> str:
    """Get a summary of the most recent inbox emails with unread count."""
    try:
        service = _get_gmail_service_for_user(user_id)

        unread = service.users().messages().list(
            userId="me", q="is:unread in:inbox", maxResults=1
        ).execute()
        unread_count = unread.get("resultSizeEstimate", 0)

        results = service.users().messages().list(
            userId="me", q="in:inbox", maxResults=min(max_results, 30)
        ).execute()
        messages = results.get("messages", [])

        emails = []
        for msg in messages:
            detail = service.users().messages().get(
                userId="me", id=msg["id"], format="metadata",
                metadataHeaders=["From", "Subject", "Date"]
            ).execute()
            headers = detail.get("payload", {}).get("headers", [])
            is_unread = "UNREAD" in detail.get("labelIds", [])
            emails.append({
                "id": msg["id"],
                "from": _get_header(headers, "From"),
                "subject": _get_header(headers, "Subject"),
                "date": _get_header(headers, "Date"),
                "snippet": detail.get("snippet", ""),
                "unread": is_unread,
            })

        return json.dumps({
            "success": True,
            "unread_count": unread_count,
            "total_shown": len(emails),
            "emails": emails,
        })
    except Exception as e:
        return json.dumps({"error": str(e)})


# ═══════════════════════════════════════════════════════
#  TOOL 6: Manage Labels (Add/Remove)
# ═══════════════════════════════════════════════════════

@mcp.tool()
def modify_labels(user_id: str, email_id: str, add_labels: str = "", remove_labels: str = "") -> str:
    """
    Add or remove labels from an email.
    Common labels: INBOX, UNREAD, STARRED, IMPORTANT, SPAM, TRASH
    """
    try:
        service = _get_gmail_service_for_user(user_id)
        body = {}
        if add_labels:
            body["addLabelIds"] = [l.strip() for l in add_labels.split(",")]
        if remove_labels:
            body["removeLabelIds"] = [l.strip() for l in remove_labels.split(",")]

        result = service.users().messages().modify(userId="me", id=email_id, body=body).execute()

        return json.dumps({
            "success": True,
            "message": f"Labels updated for email {email_id}",
            "current_labels": result.get("labelIds", []),
        })
    except Exception as e:
        return json.dumps({"error": str(e)})


# ═══════════════════════════════════════════════════════
#  TOOL 7: List Labels
# ═══════════════════════════════════════════════════════

@mcp.tool()
def list_labels(user_id: str) -> str:
    """List all available Gmail labels (system + custom)."""
    try:
        service = _get_gmail_service_for_user(user_id)
        results = service.users().labels().list(userId="me").execute()
        labels = results.get("labels", [])

        formatted = []
        for label in labels:
            formatted.append({
                "id": label.get("id", ""),
                "name": label.get("name", ""),
                "type": label.get("type", ""),
            })

        return json.dumps({"success": True, "labels": formatted, "count": len(formatted)})
    except Exception as e:
        return json.dumps({"error": str(e)})


# ═══════════════════════════════════════════════════════
#  TOOL 8: Create Draft
# ═══════════════════════════════════════════════════════

@mcp.tool()
def create_draft(user_id: str, to: str, subject: str, body: str, cc: str = "") -> str:
    """Create an email draft (saved but not sent)."""
    try:
        service = _get_gmail_service_for_user(user_id)
        message = MIMEMultipart()
        message["to"] = to
        message["subject"] = subject
        if cc:
            message["cc"] = cc
        message.attach(MIMEText(body, "plain"))

        raw = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")
        draft = service.users().drafts().create(
            userId="me", body={"message": {"raw": raw}}
        ).execute()

        return json.dumps({
            "success": True,
            "message": f"Draft created for {to}",
            "draft_id": draft.get("id", ""),
        })
    except Exception as e:
        return json.dumps({"error": str(e)})


# ═══════════════════════════════════════════════════════
#  TOOL 9: Delete/Trash Email
# ═══════════════════════════════════════════════════════

@mcp.tool()
def trash_email(user_id: str, email_id: str) -> str:
    """Move an email to trash. Can be recovered within 30 days."""
    try:
        service = _get_gmail_service_for_user(user_id)
        service.users().messages().trash(userId="me", id=email_id).execute()
        return json.dumps({
            "success": True,
            "message": f"Email {email_id} moved to trash",
        })
    except Exception as e:
        return json.dumps({"error": str(e)})


# ═══════════════════════════════════════════════════════
#  TOOL 10: Get Thread (Conversation)
# ═══════════════════════════════════════════════════════

@mcp.tool()
def get_thread(user_id: str, thread_id: str) -> str:
    """Get all messages in an email thread/conversation."""
    try:
        service = _get_gmail_service_for_user(user_id)
        thread = service.users().threads().get(userId="me", id=thread_id, format="metadata",
                                                metadataHeaders=["From", "To", "Subject", "Date"]).execute()
        messages = thread.get("messages", [])

        conversation = []
        for msg in messages:
            headers = msg.get("payload", {}).get("headers", [])
            conversation.append({
                "id": msg.get("id", ""),
                "from": _get_header(headers, "From"),
                "to": _get_header(headers, "To"),
                "subject": _get_header(headers, "Subject"),
                "date": _get_header(headers, "Date"),
                "snippet": msg.get("snippet", ""),
                "labels": msg.get("labelIds", []),
            })

        return json.dumps({
            "success": True,
            "thread_id": thread_id,
            "message_count": len(conversation),
            "messages": conversation,
        })
    except Exception as e:
        return json.dumps({"error": str(e)})


# ═══════════════════════════════════════════════════════
#  TOOL 11: Forward Email
# ═══════════════════════════════════════════════════════

@mcp.tool()
def forward_email(user_id: str, email_id: str, to: str, additional_message: str = "") -> str:
    """Forward an email to another recipient with optional additional message."""
    try:
        service = _get_gmail_service_for_user(user_id)
        original = service.users().messages().get(userId="me", id=email_id, format="full").execute()

        headers = original.get("payload", {}).get("headers", [])
        orig_from = _get_header(headers, "From")
        orig_to = _get_header(headers, "To")
        orig_subject = _get_header(headers, "Subject")
        orig_date = _get_header(headers, "Date")
        orig_body = _decode_body(original.get("payload", {}))

        subject = f"Fwd: {orig_subject}" if not orig_subject.startswith("Fwd:") else orig_subject

        forward_body = ""
        if additional_message:
            forward_body += f"{additional_message}\n\n"
        forward_body += "---------- Forwarded message ----------\n"
        forward_body += f"From: {orig_from}\n"
        forward_body += f"Date: {orig_date}\n"
        forward_body += f"Subject: {orig_subject}\n"
        forward_body += f"To: {orig_to}\n\n"
        forward_body += orig_body[:3000]

        message = MIMEMultipart()
        message["to"] = to
        message["subject"] = subject
        message.attach(MIMEText(forward_body, "plain"))

        raw = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")
        sent = service.users().messages().send(userId="me", body={"raw": raw}).execute()

        return json.dumps({
            "success": True,
            "message": f"Email forwarded to {to}",
            "id": sent.get("id", ""),
        })
    except Exception as e:
        return json.dumps({"error": str(e)})


# ═══════════════════════════════════════════════════════
#  TOOL 12: Get Profile Info
# ═══════════════════════════════════════════════════════

@mcp.tool()
def get_profile(user_id: str) -> str:
    """Get the authenticated Gmail user's profile information."""
    try:
        service = _get_gmail_service_for_user(user_id)
        profile = service.users().getProfile(userId="me").execute()
        return json.dumps({
            "success": True,
            "email": profile.get("emailAddress", ""),
            "total_messages": profile.get("messagesTotal", 0),
            "total_threads": profile.get("threadsTotal", 0),
            "history_id": profile.get("historyId", ""),
        })
    except Exception as e:
        return json.dumps({"error": str(e)})


# ═══════════════════════════════════════════════════════
#  TOOL 13: Mark as Read / Unread
# ═══════════════════════════════════════════════════════

@mcp.tool()
def mark_as_read(user_id: str, email_id: str, mark_read: bool = True) -> str:
    """Mark an email as read or unread."""
    try:
        service = _get_gmail_service_for_user(user_id)
        if mark_read:
            body = {"removeLabelIds": ["UNREAD"]}
        else:
            body = {"addLabelIds": ["UNREAD"]}

        service.users().messages().modify(userId="me", id=email_id, body=body).execute()
        status = "read" if mark_read else "unread"
        return json.dumps({"success": True, "message": f"Email marked as {status}"})
    except Exception as e:
        return json.dumps({"error": str(e)})


# ═══════════════════════════════════════════════════════
#  TOOL 14: Star / Unstar Email
# ═══════════════════════════════════════════════════════

@mcp.tool()
def star_email(user_id: str, email_id: str, star: bool = True) -> str:
    """Star or unstar an email."""
    try:
        service = _get_gmail_service_for_user(user_id)
        if star:
            body = {"addLabelIds": ["STARRED"]}
        else:
            body = {"removeLabelIds": ["STARRED"]}

        service.users().messages().modify(userId="me", id=email_id, body=body).execute()
        status = "starred" if star else "unstarred"
        return json.dumps({"success": True, "message": f"Email {status}"})
    except Exception as e:
        return json.dumps({"error": str(e)})


# ═══════════════════════════════════════════════════════
#  TOOL 15: Get Attachment
# ═══════════════════════════════════════════════════════

@mcp.tool()
def get_attachment_info(user_id: str, email_id: str) -> str:
    """List all attachments in an email with their details."""
    try:
        service = _get_gmail_service_for_user(user_id)
        msg = service.users().messages().get(userId="me", id=email_id, format="full").execute()

        attachments = []
        parts = msg.get("payload", {}).get("parts", [])
        for part in parts:
            filename = part.get("filename")
            if filename:
                attachments.append({
                    "filename": filename,
                    "mimeType": part.get("mimeType", ""),
                    "size_bytes": part.get("body", {}).get("size", 0),
                    "attachment_id": part.get("body", {}).get("attachmentId", ""),
                })

        if not attachments:
            return json.dumps({"success": True, "message": "No attachments found in this email", "attachments": []})

        return json.dumps({
            "success": True,
            "email_id": email_id,
            "attachments": attachments,
            "count": len(attachments),
        })
    except Exception as e:
        return json.dumps({"error": str(e)})


# ═══════════════════════════════════════════════════════
#  Server Startup
# ═══════════════════════════════════════════════════════

if __name__ == "__main__":
    print("=" * 50)
    print("  Gmail MCP Server (Per-User OAuth)")
    print("=" * 50)
    print(f"  Port: 9002")
    print(f"  Credentials: {CREDENTIALS_FILE}")
    print(f"  Database: Connected (per-user tokens)")
    print()

    if not CREDENTIALS_FILE.exists():
        print("  WARNING: gmail_credentials.json not found!")
        print("  Follow setup instructions. Server will start but tools will fail.")
        print()

    print("  Tools available (all per-user authenticated):")
    print("    1.  search_emails       - Search with Gmail query syntax")
    print("    2.  read_email          - Read full email content")
    print("    3.  send_email          - Send new email")
    print("    4.  reply_to_email      - Reply to an email thread")
    print("    5.  get_inbox_summary   - Inbox overview with unread count")
    print("    6.  modify_labels       - Add/remove labels")
    print("    7.  list_labels         - List all labels")
    print("    8.  create_draft        - Create email draft")
    print("    9.  trash_email         - Move email to trash")
    print("    10. get_thread          - Get full conversation thread")
    print("    11. forward_email       - Forward email to someone")
    print("    12. get_profile         - Get account profile info")
    print("    13. mark_as_read        - Mark email read/unread")
    print("    14. star_email          - Star/unstar an email")
    print("    15. get_attachment_info  - List email attachments")
    print()
    print("  Starting server...")
    print("=" * 50)

    mcp.run(transport="sse")
