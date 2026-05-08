"""
main.py - FastAPI application for the ToolChain AI Dashboard.

Routes:
  GET  /                       → serve dashboard HTML
  POST /api/auth/signup        → register new user
  POST /api/auth/login         → authenticate user
  GET  /api/auth/me            → current user profile
  GET  /api/mcps               → list all registered MCPs
  POST /api/mcps               → register a new MCP
  GET  /api/mcps/{id}          → get single MCP
  DELETE /api/mcps/{id}        → delete an MCP
  POST /api/mcps/{id}/connect  → mark MCP as connected
  POST /api/mcps/{id}/disconnect → disconnect MCP
  POST /api/mcps/{id}/probe    → probe MCP for tools
  POST /api/sessions           → create chat session
  GET  /api/sessions/{id}/messages → get session history
  POST /api/chat/stream        → SSE streaming chat endpoint
"""
import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from db_config import init_db, get_db, AsyncSessionLocal
from database import (
    register_mcp, list_mcps, get_mcp,
    set_mcp_connection, delete_mcp, get_connected_mcps,
    create_session, list_user_sessions, update_session_title,
    delete_session, save_message, get_session_messages,
)
from mcp_manager import get_mcp_tools, probe_mcp
from agent import stream_agent_response
from auth_routes import router as auth_router
from auth_utils import get_current_user
from gmail_oauth import (
    generate_auth_url,
    exchange_code_for_token,
    get_user_gmail_status,
    revoke_user_gmail,
    get_user_gmail_credentials,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)


# ─── Lifespan ────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    logger.info("PostgreSQL database initialized via SQLAlchemy.")
    yield
    logger.info("Shutting down.")


# ─── App ─────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="ToolChain AI Dashboard",
    description="Register MCP servers and chat with an AI agent that uses them as tools.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/assets", StaticFiles(directory="../frontend/dist/assets"), name="assets")
app.include_router(auth_router)


# ─── Pydantic Models ──────────────────────────────────────────────────────────

class MCPCreate(BaseModel):
    name: str
    url: str
    transport: str = "sse"
    description: Optional[str] = None
    icon: Optional[str] = None


class ChatRequest(BaseModel):
    session_id: str
    message: str
    mcp_ids: Optional[list[str]] = None


# ─── Routes: Dashboard ───────────────────────────────────────────────────────

@app.get("/", include_in_schema=False)
@app.get("/dashboard", include_in_schema=False)
@app.get("/mcp-servers", include_in_schema=False)
@app.get("/chat", include_in_schema=False)
@app.get("/login", include_in_schema=False)
@app.get("/signup", include_in_schema=False)
@app.get("/forgot-password", include_in_schema=False)
@app.get("/reset-password", include_in_schema=False)
async def serve_frontend():
    return FileResponse("../frontend/dist/index.html")


# ─── Routes: MCP Registry ────────────────────────────────────────────────────

@app.get("/api/mcps")
async def api_list_mcps(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await list_mcps(db, user["id"])


@app.post("/api/mcps", status_code=201)
async def api_register_mcp(
    body: MCPCreate,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await list_mcps(db, user["id"])
    if any(m["name"] == body.name for m in existing):
        raise HTTPException(status_code=409, detail=f"MCP with name '{body.name}' already exists.")
    url = body.url.rstrip("/")
    if body.transport == "sse" and not url.endswith("/sse"):
        url += "/sse"

    probe_result = await probe_mcp(url, body.transport)
    if not probe_result["ok"]:
        raise HTTPException(
            status_code=422,
            detail="Server unreachable. Please check the URL and ensure the server is running.",
        )

    mcp = await register_mcp(db, user["id"], body.name, url, body.transport, body.description, body.icon)
    return mcp


@app.get("/api/mcps/{mcp_id}")
async def api_get_mcp(
    mcp_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    mcp = await get_mcp(db, mcp_id, user["id"])
    if not mcp:
        raise HTTPException(status_code=404, detail="MCP not found.")
    return mcp


@app.delete("/api/mcps/{mcp_id}", status_code=204)
async def api_delete_mcp(
    mcp_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    mcp = await get_mcp(db, mcp_id, user["id"])
    if not mcp:
        raise HTTPException(status_code=404, detail="MCP not found.")
    await delete_mcp(db, mcp_id, user["id"])


@app.post("/api/mcps/{mcp_id}/connect")
async def api_connect_mcp(
    mcp_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    mcp = await get_mcp(db, mcp_id, user["id"])
    if not mcp:
        raise HTTPException(status_code=404, detail="MCP not found.")

    mcp_name = (mcp.get("name", "") or "").lower()
    mcp_url = (mcp.get("url", "") or "").lower()
    is_gmail = "gmail" in mcp_name or "9002" in mcp_url
    if is_gmail:
        gmail_status = await get_user_gmail_status(user["id"], db)
        if not gmail_status:
            auth_url = generate_auth_url(user["id"], mcp_id)
            return {"id": mcp_id, "connected": False, "needs_auth": True, "auth_url": auth_url}

    await set_mcp_connection(db, mcp_id, user["id"], True)
    return {"id": mcp_id, "connected": True}


@app.post("/api/mcps/{mcp_id}/disconnect")
async def api_disconnect_mcp(
    mcp_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    mcp = await get_mcp(db, mcp_id, user["id"])
    if not mcp:
        raise HTTPException(status_code=404, detail="MCP not found.")

    mcp_name = (mcp.get("name", "") or "").lower()
    mcp_url = (mcp.get("url", "") or "").lower()
    is_gmail = "gmail" in mcp_name or "9002" in mcp_url

    token_revoked = False
    if is_gmail:
        token_revoked = await revoke_user_gmail(user["id"], db)

    await set_mcp_connection(db, mcp_id, user["id"], False)
    return {"id": mcp_id, "connected": False, "token_revoked": token_revoked}


@app.post("/api/mcps/{mcp_id}/toggle")
async def api_toggle_mcp(
    mcp_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Toggle MCP connection on/off without revoking tokens. Used by chat panel."""
    mcp = await get_mcp(db, mcp_id, user["id"])
    if not mcp:
        raise HTTPException(status_code=404, detail="MCP not found.")

    new_state = not mcp.get("connected", False)

    if new_state:
        mcp_name = (mcp.get("name", "") or "").lower()
        mcp_url = (mcp.get("url", "") or "").lower()
        is_gmail = "gmail" in mcp_name or "9002" in mcp_url
        if is_gmail:
            gmail_status = await get_user_gmail_status(user["id"], db)
            if not gmail_status:
                auth_url = generate_auth_url(user["id"])
                return {"id": mcp_id, "connected": False, "needs_auth": True, "auth_url": auth_url}

    await set_mcp_connection(db, mcp_id, user["id"], new_state)
    return {"id": mcp_id, "connected": new_state}


@app.post("/api/mcps/{mcp_id}/probe")
async def api_probe_mcp(
    mcp_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Probe MCP endpoint to check reachability and list available tools."""
    mcp = await get_mcp(db, mcp_id, user["id"])
    if not mcp:
        raise HTTPException(status_code=404, detail="MCP not found.")
    result = await probe_mcp(mcp["url"], mcp["transport"])
    return result


# ─── Routes: Dashboard Stats ─────────────────────────────────────────────────

@app.get("/api/stats/weekly")
async def api_weekly_stats(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get daily chat/message counts for the last 7 days (real-time stats)."""
    from sqlalchemy import func, cast, Date, select
    from db_models import Message, ChatSession
    from datetime import datetime, timedelta

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


# ─── Routes: Gmail OAuth (Per-User) ──────────────────────────────────────────

@app.get("/api/gmail/auth-url")
async def api_gmail_auth_url(
    user: dict = Depends(get_current_user),
):
    """Generate Google OAuth URL for the current user to link their Gmail."""
    try:
        url = generate_auth_url(user["id"])
        return {"auth_url": url}
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/gmail/callback")
async def api_gmail_callback(
    code: str,
    state: str,
    db: AsyncSession = Depends(get_db),
):
    """
    OAuth2 callback from Google. Exchanges code for tokens and stores per-user.
    Auto-connects the MCP server, notifies the opener window, and closes the tab.
    """
    from fastapi.responses import HTMLResponse

    user_id = state
    mcp_id = None
    if ":" in state:
        user_id, mcp_id = state.split(":", 1)

    try:
        result = await exchange_code_for_token(code, user_id, db)

        if mcp_id:
            await set_mcp_connection(db, mcp_id, user_id, True)
            logger.info("Auto-connected MCP %s for user %s after Gmail OAuth", mcp_id, user_id)

        email = result.get("email", "")
        return HTMLResponse(f"""<!DOCTYPE html>
<html><head><title>Gmail Connected</title></head>
<body>
<script>
  if (window.opener) {{
    window.opener.postMessage({{ type: 'gmail_auth_complete', email: '{email}' }}, '*');
  }}
  window.close();
</script>
<p>Gmail connected successfully. This window will close automatically.</p>
</body></html>""")

    except Exception as e:
        logger.error("Gmail OAuth callback failed: %s", e)
        error_msg = str(e)[:100].replace("'", "\\'")
        return HTMLResponse(f"""<!DOCTYPE html>
<html><head><title>Gmail Auth Failed</title></head>
<body>
<script>
  if (window.opener) {{
    window.opener.postMessage({{ type: 'gmail_auth_error', error: '{error_msg}' }}, '*');
  }}
  setTimeout(function() {{ window.close(); }}, 3000);
</script>
<p>Gmail authentication failed: {error_msg}</p>
<p>This window will close in 3 seconds.</p>
</body></html>""")


@app.get("/api/gmail/status")
async def api_gmail_status(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check if the current user has linked their Gmail account."""
    status = await get_user_gmail_status(user["id"], db)
    if status:
        return {"linked": True, **status}
    return {"linked": False}


@app.post("/api/gmail/revoke")
async def api_gmail_revoke(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Unlink/revoke Gmail access for the current user."""
    revoked = await revoke_user_gmail(user["id"], db)
    if revoked:
        return {"message": "Gmail access revoked successfully"}
    raise HTTPException(status_code=404, detail="No Gmail account linked")


# ─── Routes: Sessions ────────────────────────────────────────────────────────

@app.get("/api/sessions")
async def api_list_sessions(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all chat sessions for the current user."""
    return await list_user_sessions(db, user["id"])


@app.post("/api/sessions", status_code=201)
async def api_create_session(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await create_session(db, user["id"])
    return session


@app.patch("/api/sessions/{session_id}")
async def api_update_session(
    session_id: str,
    body: dict,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update session title."""
    title = body.get("title")
    if title:
        await update_session_title(db, session_id, title)
    return {"id": session_id, "title": title}


@app.delete("/api/sessions/{session_id}", status_code=204)
async def api_delete_session(
    session_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a chat session and its messages."""
    deleted = await delete_session(db, session_id, user["id"])
    if not deleted:
        raise HTTPException(status_code=404, detail="Session not found.")


@app.get("/api/sessions/{session_id}/messages")
async def api_get_messages(
    session_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    messages = await get_session_messages(db, session_id)
    return messages


# ─── Routes: Chat (SSE streaming) ────────────────────────────────────────────

@app.post("/api/chat/stream")
async def api_chat_stream(
    body: ChatRequest,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    SSE endpoint. Opens MCP connections, runs the LangGraph agent,
    and streams tokens back to the client.
    """
    history = await get_session_messages(db, body.session_id)
    await save_message(db, body.session_id, "user", body.message)

    if not history:
        title = body.message[:80] + ("..." if len(body.message) > 80 else "")
        await update_session_title(db, body.session_id, title)

    current_user_id = user["id"]
    connected_mcps = await get_connected_mcps(db, current_user_id)
    if body.mcp_ids is not None:
        allowed = set(body.mcp_ids)
        connected_mcps = [m for m in connected_mcps if m["id"] in allowed]
    session_id = body.session_id
    user_message = body.message

    gmail_creds = await get_user_gmail_credentials(current_user_id, db) if connected_mcps else None

    async def event_generator():
        full_response_parts = []

        async with get_mcp_tools(connected_mcps, gmail_creds=gmail_creds) as tools:
            async for sse_chunk in stream_agent_response(user_message, history, tools):
                yield sse_chunk

                if sse_chunk.startswith("data: "):
                    import json
                    try:
                        data = json.loads(sse_chunk[6:])
                        if data.get("type") == "token":
                            full_response_parts.append(data.get("content", ""))
                        elif data.get("type") == "done" and data.get("content"):
                            full_response_parts = [data.get("content", "")]
                    except Exception:
                        pass

        full_text = "".join(full_response_parts)
        if full_text.strip():
            async with AsyncSessionLocal() as new_db:
                await save_message(new_db, session_id, "assistant", full_text)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ─── Entry point ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, log_level="info")
