"""SSE streaming chat endpoint."""
import asyncio
import base64
import json
import logging

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.agent import build_llm, stream_agent_response
from app.api.routers.mcps.helpers import disconnect_mcp_failures
from app.schemas.chat import ChatRequest
from app.services.attachments import (
    build_agent_attachment_context,
    format_stored_user_message,
    list_attachments,
    verify_session_owner,
)
from app.services.control_room import apply_turn_routing, classify_turn_intent
from app.db.database import get_connected_mcps, get_session, get_session_messages, save_message, update_session_title
from app.db.config import AsyncSessionLocal, get_db
from app.services.ghost_mode import is_ghost_session_title
from app.services.mcp_manager import load_mcp_tools
from app.core.plan_guard import check_daily_message_limit
from app.services.session_title import generate_session_title

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["Chat"])


@router.post("/stream")
async def chat_stream(
    body: ChatRequest,
    user: dict = Depends(check_daily_message_limit),
    db: AsyncSession = Depends(get_db),
):
    """
    SSE endpoint. Opens MCP connections, runs the LangGraph agent,
    and streams tokens back to the client. Enforces daily message limit.
    """
    await verify_session_owner(db, body.session_id, user["id"])
    session_row = await get_session(db, body.session_id, user["id"])
    is_ghost = body.ghost_mode or is_ghost_session_title(
        (session_row or {}).get("title")
    )
    if is_ghost:
        history = body.ghost_history or []
    else:
        history = await get_session_messages(db, body.session_id)
    current_user_id = str(user["id"])

    manifest = list_attachments(current_user_id, body.session_id)
    att_meta = manifest
    if body.attachment_ids:
        allowed_ids = set(body.attachment_ids)
        att_meta = [a for a in manifest if a["id"] in allowed_ids]

    stored_user = format_stored_user_message(body.message, att_meta)
    if not is_ghost:
        await save_message(db, body.session_id, "user", stored_user)

    is_first_message = not history and not is_ghost
    attachment_names = [a.get("name", "") for a in att_meta if a.get("name")]

    logging.info("Chat stream: user_id=%s type=%s", current_user_id, type(current_user_id).__name__)
    connected_mcps = await get_connected_mcps(db, current_user_id)
    if body.mcp_ids is not None:
        allowed = set(body.mcp_ids)
        connected_mcps = [m for m in connected_mcps if m["id"] in allowed]
    session_id = body.session_id
    user_message = body.message
    attachment_context = build_agent_attachment_context(
        current_user_id,
        session_id,
        body.attachment_ids,
        history=history,
        user_message=user_message,
    )

    async def event_generator():
        full_response_parts = []
        title_sent = False
        title_task = None

        if is_first_message and not is_ghost:

            async def _save_title():
                title = await generate_session_title(user_message, attachment_names)
                async with AsyncSessionLocal() as title_db:
                    await update_session_title(title_db, session_id, title)
                return title

            title_task = asyncio.create_task(_save_title())

        def _title_sse(title: str) -> str:
            return f'data: {json.dumps({"type": "session_title", "title": title})}\n\n'

        tools, load_failures = await load_mcp_tools(connected_mcps, user_id=current_user_id)
        disconnected = await disconnect_mcp_failures(current_user_id, load_failures)
        if disconnected:
            yield f'data: {json.dumps({"type": "mcp_disconnected", "servers": disconnected})}\n\n'

        router_llm = build_llm(vision=False)
        turn_intent = await classify_turn_intent(
            router_llm,
            user_message,
            attachment_ids=body.attachment_ids,
            attachment_context=attachment_context,
            tools=tools,
        )
        agent_tools, agent_attachment_context = apply_turn_routing(
            turn_intent,
            tools,
            attachment_context,
            body.attachment_ids,
        )
        async for sse_chunk in stream_agent_response(
            user_message,
            history,
            agent_tools,
            agent_attachment_context,
            attachment_ids=body.attachment_ids,
            turn_intent=turn_intent,
        ):
            if title_task and not title_sent and title_task.done():
                try:
                    generated_title = title_task.result()
                    if generated_title:
                        yield _title_sse(generated_title)
                        title_sent = True
                except Exception:
                    logger.exception("Session title task failed")

            yield sse_chunk

            if sse_chunk.startswith("data: "):
                try:
                    data = json.loads(sse_chunk[6:])
                    evt_type = data.get("type")
                    if evt_type == "token":
                        full_response_parts.append(data.get("content", ""))
                    elif evt_type == "tool_use":
                        line = f'Tool: {data["tool"]}({json.dumps(data.get("input", {}))})\n'
                        full_response_parts.append(line)
                    elif evt_type == "tool_result":
                        raw_content = data.get("content", "")
                        encoded = base64.b64encode(raw_content.encode("utf-8")).decode("ascii")
                        line = f'Result: {data["tool"]} -> @@JSON@@{encoded}@@END@@\n'
                        full_response_parts.append(line)
                    elif evt_type == "phase" and data.get("status") == "done":
                        detail = (data.get("detail") or "").replace("\n", " ")
                        line = (
                            f'Phase: {data.get("role", "")}|'
                            f'done|{detail}\n'
                        )
                        full_response_parts.append(line)
                except Exception:
                    pass

        if title_task and not title_sent:
            try:
                generated_title = await title_task
                if generated_title:
                    yield _title_sse(generated_title)
            except Exception:
                logger.exception("Session title task failed")

        full_text = "".join(full_response_parts)
        if full_text.strip() and not is_ghost:
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
