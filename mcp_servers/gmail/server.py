#!/usr/bin/env python3
"""
Gmail MCP Server — Standalone, Anthropic MCP-standard compliant.

This server is completely independent — no database, no external app dependencies.
OAuth credentials (access_token, refresh_token, client_id, client_secret) are passed
into each tool call. The calling application is responsible for storing and managing tokens.

Run:
  python server.py                        # default port 9002
  python server.py --port 9005            # custom port
  MCP_PORT=9005 python server.py          # via env var

Protocol: MCP over SSE (Server-Sent Events)
"""

import argparse
import base64
import json
import os
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from mcp.server.fastmcp import FastMCP

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("gmail-mcp")

DEFAULT_PORT = int(os.getenv("MCP_PORT", "9002"))

mcp = FastMCP("Gmail-MCP", host="127.0.0.1", port=DEFAULT_PORT)


# ─── Credential Helpers ──────────────────────────────────────────────────────

def _build_gmail_service(
    access_token: str,
    refresh_token: str,
    client_id: str,
    client_secret: str,
    token_uri: str = "https://oauth2.googleapis.com/token",
):
    """
    Build an authenticated Gmail API service from raw OAuth credentials.
    Auto-refreshes if the access_token is expired.
    Returns (service, refreshed_access_token).
    """
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build

    creds = Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri=token_uri,
        client_id=client_id,
        client_secret=client_secret,
        scopes=[
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/gmail.modify",
            "https://www.googleapis.com/auth/gmail.compose",
            "https://www.googleapis.com/auth/gmail.labels",
        ],
    )

    if creds.expired and creds.refresh_token:
        creds.refresh(Request())

    service = build("gmail", "v1", credentials=creds)
    return service, creds.token


def _get_header(headers: list, name: str) -> str:
    for h in headers:
        if h.get("name", "").lower() == name.lower():
            return h.get("value", "")
    return ""


def _decode_body(payload) -> str:
    """Recursively extract text body from email payload."""
    if payload.get("body", {}).get("data"):
        return base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", errors="replace")

    parts = payload.get("parts", [])
    for part in parts:
        if part.get("mimeType") == "text/plain":
            data = part.get("body", {}).get("data", "")
            if data:
                return base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
    for part in parts:
        if part.get("mimeType") == "text/html":
            data = part.get("body", {}).get("data", "")
            if data:
                return base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
    for part in parts:
        if part.get("parts"):
            result = _decode_body(part)
            if result:
                return result
    return ""


# ─── Tools ────────────────────────────────────────────────────────────────────

@mcp.tool()
def search_emails(
    access_token: str, refresh_token: str, client_id: str, client_secret: str,
    query: str, max_results: int = 10,
) -> str:
    """
    Search emails using Gmail search syntax.
    Examples: 'from:someone@gmail.com', 'subject:meeting', 'is:unread', 'has:attachment',
    'after:2024/01/01', 'label:important', 'in:inbox newer_than:7d'
    """
    try:
        service, _ = _build_gmail_service(access_token, refresh_token, client_id, client_secret)
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
                metadataHeaders=["From", "To", "Subject", "Date"],
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


@mcp.tool()
def read_email(
    access_token: str, refresh_token: str, client_id: str, client_secret: str,
    email_id: str,
) -> str:
    """Read the full content of an email by its ID. Get IDs from search_emails."""
    try:
        service, _ = _build_gmail_service(access_token, refresh_token, client_id, client_secret)
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


@mcp.tool()
def send_email(
    access_token: str, refresh_token: str, client_id: str, client_secret: str,
    to: str, subject: str, body: str, cc: str = "", bcc: str = "",
) -> str:
    """
    Send an email from the user's Gmail account.
    - to: recipient email (comma-separated for multiple)
    - subject: email subject
    - body: email body text
    """
    try:
        service, _ = _build_gmail_service(access_token, refresh_token, client_id, client_secret)
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


@mcp.tool()
def reply_to_email(
    access_token: str, refresh_token: str, client_id: str, client_secret: str,
    email_id: str, body: str,
) -> str:
    """Reply to an existing email thread. Maintains the thread context."""
    try:
        service, _ = _build_gmail_service(access_token, refresh_token, client_id, client_secret)
        original = service.users().messages().get(
            userId="me", id=email_id, format="metadata",
            metadataHeaders=["From", "To", "Subject", "Message-ID"],
        ).execute()
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
            userId="me", body={"raw": raw, "threadId": thread_id},
        ).execute()

        return json.dumps({
            "success": True,
            "message": f"Reply sent to {reply_to}",
            "id": sent.get("id", ""),
            "thread_id": sent.get("threadId", ""),
        })
    except Exception as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
def get_inbox_summary(
    access_token: str, refresh_token: str, client_id: str, client_secret: str,
    max_results: int = 15,
) -> str:
    """Get a summary of the most recent inbox emails with unread count."""
    try:
        service, _ = _build_gmail_service(access_token, refresh_token, client_id, client_secret)

        unread = service.users().messages().list(
            userId="me", q="is:unread in:inbox", maxResults=1,
        ).execute()
        unread_count = unread.get("resultSizeEstimate", 0)

        results = service.users().messages().list(
            userId="me", q="in:inbox", maxResults=min(max_results, 30),
        ).execute()
        messages = results.get("messages", [])

        emails = []
        for msg in messages:
            detail = service.users().messages().get(
                userId="me", id=msg["id"], format="metadata",
                metadataHeaders=["From", "Subject", "Date"],
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


@mcp.tool()
def modify_labels(
    access_token: str, refresh_token: str, client_id: str, client_secret: str,
    email_id: str, add_labels: str = "", remove_labels: str = "",
) -> str:
    """
    Add or remove labels from an email.
    Common labels: INBOX, UNREAD, STARRED, IMPORTANT, SPAM, TRASH
    """
    try:
        service, _ = _build_gmail_service(access_token, refresh_token, client_id, client_secret)
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


@mcp.tool()
def list_labels(
    access_token: str, refresh_token: str, client_id: str, client_secret: str,
) -> str:
    """List all available Gmail labels (system + custom)."""
    try:
        service, _ = _build_gmail_service(access_token, refresh_token, client_id, client_secret)
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


@mcp.tool()
def create_draft(
    access_token: str, refresh_token: str, client_id: str, client_secret: str,
    to: str, subject: str, body: str, cc: str = "",
) -> str:
    """Create an email draft (saved but not sent)."""
    try:
        service, _ = _build_gmail_service(access_token, refresh_token, client_id, client_secret)
        message = MIMEMultipart()
        message["to"] = to
        message["subject"] = subject
        if cc:
            message["cc"] = cc
        message.attach(MIMEText(body, "plain"))

        raw = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")
        draft = service.users().drafts().create(
            userId="me", body={"message": {"raw": raw}},
        ).execute()

        return json.dumps({
            "success": True,
            "message": f"Draft created for {to}",
            "draft_id": draft.get("id", ""),
        })
    except Exception as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
def trash_email(
    access_token: str, refresh_token: str, client_id: str, client_secret: str,
    email_id: str,
) -> str:
    """Move an email to trash. Can be recovered within 30 days."""
    try:
        service, _ = _build_gmail_service(access_token, refresh_token, client_id, client_secret)
        service.users().messages().trash(userId="me", id=email_id).execute()
        return json.dumps({
            "success": True,
            "message": f"Email {email_id} moved to trash",
        })
    except Exception as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
def get_thread(
    access_token: str, refresh_token: str, client_id: str, client_secret: str,
    thread_id: str,
) -> str:
    """Get all messages in an email thread/conversation."""
    try:
        service, _ = _build_gmail_service(access_token, refresh_token, client_id, client_secret)
        thread = service.users().threads().get(
            userId="me", id=thread_id, format="metadata",
            metadataHeaders=["From", "To", "Subject", "Date"],
        ).execute()
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


@mcp.tool()
def forward_email(
    access_token: str, refresh_token: str, client_id: str, client_secret: str,
    email_id: str, to: str, additional_message: str = "",
) -> str:
    """Forward an email to another recipient with optional additional message."""
    try:
        service, _ = _build_gmail_service(access_token, refresh_token, client_id, client_secret)
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
        forward_body += f"From: {orig_from}\nDate: {orig_date}\n"
        forward_body += f"Subject: {orig_subject}\nTo: {orig_to}\n\n"
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


@mcp.tool()
def get_profile(
    access_token: str, refresh_token: str, client_id: str, client_secret: str,
) -> str:
    """Get the authenticated Gmail user's profile information."""
    try:
        service, _ = _build_gmail_service(access_token, refresh_token, client_id, client_secret)
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


@mcp.tool()
def mark_as_read(
    access_token: str, refresh_token: str, client_id: str, client_secret: str,
    email_id: str, mark_read: bool = True,
) -> str:
    """Mark an email as read or unread."""
    try:
        service, _ = _build_gmail_service(access_token, refresh_token, client_id, client_secret)
        if mark_read:
            body = {"removeLabelIds": ["UNREAD"]}
        else:
            body = {"addLabelIds": ["UNREAD"]}

        service.users().messages().modify(userId="me", id=email_id, body=body).execute()
        status = "read" if mark_read else "unread"
        return json.dumps({"success": True, "message": f"Email marked as {status}"})
    except Exception as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
def star_email(
    access_token: str, refresh_token: str, client_id: str, client_secret: str,
    email_id: str, star: bool = True,
) -> str:
    """Star or unstar an email."""
    try:
        service, _ = _build_gmail_service(access_token, refresh_token, client_id, client_secret)
        if star:
            body = {"addLabelIds": ["STARRED"]}
        else:
            body = {"removeLabelIds": ["STARRED"]}

        service.users().messages().modify(userId="me", id=email_id, body=body).execute()
        status = "starred" if star else "unstarred"
        return json.dumps({"success": True, "message": f"Email {status}"})
    except Exception as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
def get_attachment_info(
    access_token: str, refresh_token: str, client_id: str, client_secret: str,
    email_id: str,
) -> str:
    """List all attachments in an email with their details."""
    try:
        service, _ = _build_gmail_service(access_token, refresh_token, client_id, client_secret)
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
            return json.dumps({"success": True, "message": "No attachments found", "attachments": []})

        return json.dumps({
            "success": True,
            "email_id": email_id,
            "attachments": attachments,
            "count": len(attachments),
        })
    except Exception as e:
        return json.dumps({"error": str(e)})


# ─── Entry Point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Gmail MCP Server (Standalone)")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="Port to run on")
    args = parser.parse_args()

    mcp.settings.port = args.port

    print("=" * 55)
    print("  Gmail MCP Server (Standalone)")
    print("=" * 55)
    print(f"  Port     : {args.port}")
    print(f"  Transport: SSE")
    print(f"  Database : NONE (fully standalone)")
    print()
    print("  Credentials are passed per-tool-call by the client.")
    print("  This server has ZERO external dependencies on any app.")
    print()
    print("  Tools (15):")
    tools = [
        "search_emails", "read_email", "send_email", "reply_to_email",
        "get_inbox_summary", "modify_labels", "list_labels", "create_draft",
        "trash_email", "get_thread", "forward_email", "get_profile",
        "mark_as_read", "star_email", "get_attachment_info",
    ]
    for i, t in enumerate(tools, 1):
        print(f"    {i:2d}. {t}")
    print()
    print("  Starting server...")
    print("=" * 55)

    mcp.run(transport="sse")
