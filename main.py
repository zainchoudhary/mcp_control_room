"""
main.py - FastAPI application for the ToolChain AI Dashboard.

Routes:
  GET  /                       → serve dashboard HTML
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
import os
import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl

from database import (
    init_db, register_mcp, list_mcps, get_mcp,
    set_mcp_connection, delete_mcp, get_connected_mcps,
    create_session, save_message, get_session_messages
)
from mcp_manager import get_mcp_tools, probe_mcp
from agent import stream_agent_response

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)


# ─── Lifespan ────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    logger.info("Database initialized.")
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

app.mount("/assets", StaticFiles(directory="frontend/dist/assets"), name="assets")


# ─── Pydantic Models ──────────────────────────────────────────────────────────

class MCPCreate(BaseModel):
    name: str
    url: str
    transport: str = "sse"
    description: Optional[str] = None


class ChatRequest(BaseModel):
    session_id: str
    message: str


# ─── Routes: Dashboard ───────────────────────────────────────────────────────

@app.get("/", include_in_schema=False)
async def serve_dashboard():
    return FileResponse("frontend/dist/index.html")


# ─── Routes: MCP Registry ────────────────────────────────────────────────────

@app.get("/api/mcps")
async def api_list_mcps():
    return await list_mcps()


@app.post("/api/mcps", status_code=201)
async def api_register_mcp(body: MCPCreate):
    existing = await list_mcps()
    if any(m["name"] == body.name for m in existing):
        raise HTTPException(status_code=409, detail=f"MCP with name '{body.name}' already exists.")
    url = body.url.rstrip("/")
    if body.transport == "sse" and not url.endswith("/sse"):
        url += "/sse"
    mcp = await register_mcp(body.name, url, body.transport, body.description)
    return mcp


@app.get("/api/mcps/{mcp_id}")
async def api_get_mcp(mcp_id: str):
    mcp = await get_mcp(mcp_id)
    if not mcp:
        raise HTTPException(status_code=404, detail="MCP not found.")
    return mcp


@app.delete("/api/mcps/{mcp_id}", status_code=204)
async def api_delete_mcp(mcp_id: str):
    mcp = await get_mcp(mcp_id)
    if not mcp:
        raise HTTPException(status_code=404, detail="MCP not found.")
    await delete_mcp(mcp_id)


@app.post("/api/mcps/{mcp_id}/connect")
async def api_connect_mcp(mcp_id: str):
    mcp = await get_mcp(mcp_id)
    if not mcp:
        raise HTTPException(status_code=404, detail="MCP not found.")
    await set_mcp_connection(mcp_id, True)
    return {"id": mcp_id, "connected": True}


@app.post("/api/mcps/{mcp_id}/disconnect")
async def api_disconnect_mcp(mcp_id: str):
    mcp = await get_mcp(mcp_id)
    if not mcp:
        raise HTTPException(status_code=404, detail="MCP not found.")
    await set_mcp_connection(mcp_id, False)
    return {"id": mcp_id, "connected": False}


@app.post("/api/mcps/{mcp_id}/probe")
async def api_probe_mcp(mcp_id: str):
    """Probe MCP endpoint to check reachability and list available tools."""
    mcp = await get_mcp(mcp_id)
    if not mcp:
        raise HTTPException(status_code=404, detail="MCP not found.")
    result = await probe_mcp(mcp["url"], mcp["transport"])
    return result


# ─── Routes: Sessions ────────────────────────────────────────────────────────

@app.post("/api/sessions", status_code=201)
async def api_create_session():
    session_id = await create_session()
    return {"session_id": session_id}


@app.get("/api/sessions/{session_id}/messages")
async def api_get_messages(session_id: str):
    messages = await get_session_messages(session_id)
    return messages


# ─── Routes: Chat (SSE streaming) ────────────────────────────────────────────

@app.post("/api/chat/stream")
async def api_chat_stream(body: ChatRequest):
    """
    SSE endpoint. Opens MCP connections, runs the LangGraph agent,
    and streams tokens back to the client.
    """
    # Validate session
    history = await get_session_messages(body.session_id)

    # Persist user message
    await save_message(body.session_id, "user", body.message)

    # Fetch connected MCPs
    connected_mcps = await get_connected_mcps()

    async def event_generator():
        full_response_parts = []

        async with get_mcp_tools(connected_mcps) as tools:
            async for sse_chunk in stream_agent_response(body.message, history, tools):
                yield sse_chunk

                # Track full response to persist at end
                if sse_chunk.startswith("data: "):
                    import json
                    try:
                        data = json.loads(sse_chunk[6:])
                        if data.get("type") == "token":
                            full_response_parts.append(data.get("content", ""))
                        elif data.get("type") == "done" and data.get("content"):
                            # done event has full assembled content
                            full_response_parts = [data.get("content", "")]
                    except Exception:
                        pass

        # Persist the full assistant response
        full_text = "".join(full_response_parts)
        if full_text.strip():
            await save_message(body.session_id, "assistant", full_text)

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
