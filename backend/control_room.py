"""
control_room.py - Claude-style per-message routing (files vs MCP vs both)
plus Control Room phases (Planner / Tool Runner / Reviewer).
"""
import json
import logging
import re
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

logger = logging.getLogger(__name__)

INTENT_FILE_ONLY = "file_only"
INTENT_MCP_ONLY = "mcp_only"
INTENT_FILE_AND_MCP = "file_and_mcp"
INTENT_CHAT_ONLY = "chat_only"

INTENT_CLASSIFIER_SYSTEM = """You route ONE user message in a chat app (like Claude).
Reply with ONLY valid JSON, no markdown:
{"intent":"file_only"|"mcp_only"|"file_and_mcp"|"chat_only"}

Meanings:
- file_only: Answer from attached documents/images in this chat. No external MCP tools (Gmail, DB, APIs).
- mcp_only: User wants connected MCP tools (email search, account info, list tools, database, etc.). NOT asking about an uploaded document — even if a file was uploaded earlier in the chat.
- file_and_mcp: This message needs BOTH attached file content AND external MCP tools (e.g. summarize PDF and email results).
- chat_only: Greeting, thanks, general knowledge, or casual chat — no files and no MCP tools needed for this message.

Rules:
- New files attached THIS message + questions about them → file_only (unless they also clearly ask for Gmail/inbox/tools in the same message → file_and_mcp).
- Email/inbox/Gmail/tool-list requests with MCP connected → mcp_only (ignore old files in chat history).
- Follow-up about "this PDF", "question 2", "the attached quiz" without new upload → file_only.
- If MCP tools are not connected, never return mcp_only or file_and_mcp."""

PLANNER_SYSTEM = """You are the Planner agent in ToolChain Control Room.
Output ONLY a short numbered plan (2-5 steps). No greetings, no final answer.
Match the routing mode given. Use specific step labels. Never invent IDs."""

REVIEWER_SYSTEM = """You are the Reviewer agent in ToolChain Control Room.
Reply with EXACTLY one line starting with APPROVE or CHECK.
APPROVE = plan and approach look sound.
CHECK = brief reason if something is risky or missing (max 15 words)."""

_EXTERNAL_TOOL_MARKERS = (
    "gmail", "inbox", "my email", "e-mail", "emails", "email from",
    "search email", "search my", "mail from", "received from",
    "also check", "account info", "gmail account", "my gmail",
    "available tools", "list tools", "what tools", "which tools",
    "give me tools", "connected tools", "mcp tools", "show tools",
    "use mcp", "use the tool", "call the tool", "run the tool",
    "from my database", "stripe", "notion", "slack",
    "postgres", "mysql", "mcp server", "connected tool",
    "get_profile", "search_emails", "tool se", "mcp se",
)

_EMPTY_ATTACHMENT_CONTEXT: dict[str, Any] = {
    "text_prefix": "",
    "images": [],
    "use_vision": False,
    "attachments": [],
    "has_files": False,
    "is_current_turn": False,
}

INTENT_HINTS = {
    INTENT_FILE_ONLY: (
        "[Routing: FILE ONLY — Answer using the attached file sections/images in this message. "
        "Do NOT call any MCP/external tools.]"
    ),
    INTENT_MCP_ONLY: (
        "[Routing: MCP ONLY — Use connected MCP tools for this request. "
        "Do NOT use old uploaded files from earlier in the chat unless the user explicitly mentions them.]"
    ),
    INTENT_FILE_AND_MCP: (
        "[Routing: FILE + MCP — Use attached files AND call MCP tools as needed in your plan.]"
    ),
    INTENT_CHAT_ONLY: (
        "[Routing: CHAT — Normal assistant reply. Call tools only if the user clearly needs them.]"
    ),
}


def _empty_context() -> dict[str, Any]:
    return dict(_EMPTY_ATTACHMENT_CONTEXT)


def has_active_attachments(
    attachment_ids: list[str] | None,
    attachment_context: dict | None,
) -> bool:
    if attachment_ids:
        return True
    return bool((attachment_context or {}).get("has_files"))


def user_requests_external_tools(user_message: str) -> bool:
    lower = (user_message or "").lower()
    return any(marker in lower for marker in _EXTERNAL_TOOL_MARKERS)


def message_targets_mcp_tools(user_message: str, tools: list | None = None) -> bool:
    if user_requests_external_tools(user_message):
        return True
    lower = (user_message or "").lower()
    if re.search(r"\b(search|find|list|get|fetch)\b.*\b(email|mail|inbox)\b", lower):
        return True
    if re.search(r"\b(email|mail|inbox)\b.*\b(search|find|from)\b", lower):
        return True
    for t in tools or []:
        name = getattr(t, "name", str(t)).lower()
        if name in lower:
            return True
        spaced = name.replace("_", " ")
        if spaced in lower:
            return True
    return False


def _fallback_classify_intent(
    user_message: str,
    *,
    new_attachments: bool,
    session_has_files: bool,
    tools_connected: bool,
    tools: list | None = None,
) -> str:
    lower = (user_message or "").lower().strip()
    if not tools_connected:
        if new_attachments or session_has_files:
            return INTENT_FILE_ONLY
        return INTENT_CHAT_ONLY

    wants_mcp = message_targets_mcp_tools(user_message, tools)
    if new_attachments and wants_mcp:
        return INTENT_FILE_AND_MCP
    if new_attachments or (session_has_files and not wants_mcp):
        if wants_mcp:
            return INTENT_FILE_AND_MCP
        return INTENT_FILE_ONLY
    if wants_mcp:
        return INTENT_MCP_ONLY
    if session_has_files and re.search(
        r"\b(this|attached|uploaded|pdf|document|file|quiz|paper)\b", lower
    ):
        return INTENT_FILE_ONLY
    return INTENT_CHAT_ONLY


def _parse_intent_json(text: str) -> str | None:
    text = (text or "").strip()
    try:
        data = json.loads(text)
        intent = data.get("intent", "")
        if intent in (
            INTENT_FILE_ONLY,
            INTENT_MCP_ONLY,
            INTENT_FILE_AND_MCP,
            INTENT_CHAT_ONLY,
        ):
            return intent
    except json.JSONDecodeError:
        pass
    m = re.search(
        r'"(file_only|mcp_only|file_and_mcp|chat_only)"', text
    )
    if m:
        return m.group(1)
    return None


async def classify_turn_intent(
    llm,
    user_message: str,
    *,
    attachment_ids: list[str] | None,
    attachment_context: dict | None,
    tools: list,
) -> str:
    """
    Claude-style per-message routing: decide file vs MCP vs both vs chat.
    """
    new_attachments = bool(attachment_ids)
    session_has_files = bool((attachment_context or {}).get("has_files"))
    tools_connected = bool(tools)
    tool_names = ", ".join(t.name for t in tools[:40]) if tools else "none"

    if not tools_connected and not new_attachments and not session_has_files:
        return INTENT_CHAT_ONLY

    if not tools_connected:
        return INTENT_FILE_ONLY

    if not new_attachments and not session_has_files:
        if message_targets_mcp_tools(user_message, tools):
            return INTENT_MCP_ONLY
        return INTENT_CHAT_ONLY

    prompt = (
        f"New files attached on THIS message: {'yes' if new_attachments else 'no'}\n"
        f"Files from earlier in this chat (still relevant): "
        f"{'yes' if session_has_files else 'no'}\n"
        f"MCP tools connected: {'yes' if tools_connected else 'no'}\n"
        f"Tool names: {tool_names}\n\n"
        f"User message:\n{user_message[:3500]}"
    )
    try:
        resp = await llm.ainvoke([
            SystemMessage(content=INTENT_CLASSIFIER_SYSTEM),
            HumanMessage(content=prompt),
        ])
        raw = resp.content if isinstance(resp.content, str) else str(resp.content)
        intent = _parse_intent_json(raw)
        if intent:
            if not tools_connected and intent in (INTENT_MCP_ONLY, INTENT_FILE_AND_MCP):
                intent = INTENT_FILE_ONLY if session_has_files or new_attachments else INTENT_CHAT_ONLY
            logger.info("Turn intent (LLM): %s", intent)
            return intent
    except Exception as exc:
        logger.warning("Intent classifier failed: %s", exc)

    intent = _fallback_classify_intent(
        user_message,
        new_attachments=new_attachments,
        session_has_files=session_has_files,
        tools_connected=tools_connected,
        tools=tools,
    )
    logger.info("Turn intent (fallback): %s", intent)
    return intent


def filter_tools_for_user_message(user_message: str, tools: list) -> list:
    """
    Reduce Groq tool-call errors: only expose tools the user actually asked for.
    """
    if not tools:
        return tools

    lower = (user_message or "").lower()
    by_name = {getattr(t, "name", str(t)): t for t in tools}

    wants_profile = any(
        p in lower
        for p in (
            "profile", "account info", "my email", "gmail account",
            "account details", "who am i", "my address",
        )
    )
    wants_search = any(
        p in lower
        for p in (
            "search email", "search my", "find email", "emails from",
            "mail from", "inbox", "received from", "unread",
            "latest email", "recent email",
        )
    ) or bool(
        re.search(r"\b(search|find|list|fetch)\b.*\b(email|mail|inbox)\b", lower)
    )
    wants_list_tools = any(
        p in lower
        for p in (
            "available tools", "list tools", "what tools", "which tools",
            "show tools", "connected tools",
        )
    )

    allowed: list[str] = []
    if wants_profile and "get_profile" in by_name:
        allowed.append("get_profile")
    if wants_search and "search_emails" in by_name:
        allowed.append("search_emails")
    if wants_list_tools:
        for name in by_name:
            if "list" in name or "tool" in name:
                allowed.append(name)

    if wants_profile and not wants_search and "search_emails" in allowed:
        allowed = [n for n in allowed if n != "search_emails"]

    if allowed:
        picked = [by_name[n] for n in allowed if n in by_name]
        if picked:
            logger.info("Tool whitelist: %s", [t.name for t in picked])
            return picked

    return list(tools)


def apply_turn_routing(
    intent: str,
    tools: list,
    attachment_context: dict | None,
    attachment_ids: list[str] | None,
) -> tuple[list, dict[str, Any]]:
    """Return (agent_tools, agent_attachment_context) for this turn."""
    ctx = attachment_context or _empty_context()

    if intent == INTENT_FILE_ONLY:
        return [], ctx

    if intent == INTENT_MCP_ONLY:
        return list(tools), _empty_context()

    if intent == INTENT_FILE_AND_MCP:
        return list(tools), ctx

    # chat_only
    if attachment_ids:
        return list(tools), ctx
    return list(tools), _empty_context()


def intent_system_hint(intent: str) -> str:
    return INTENT_HINTS.get(intent, "")


def should_use_control_room_from_intent(
    intent: str,
    tools: list,
    attachment_ids: list[str] | None,
    agent_attachment_context: dict | None,
) -> tuple[bool, bool]:
    """Returns (document_mode, mcp_mode) for Control Room UI phases."""
    has_ctx_files = bool((agent_attachment_context or {}).get("has_files"))
    if intent == INTENT_FILE_ONLY:
        return True, False
    if intent == INTENT_MCP_ONLY:
        return False, bool(tools)
    if intent == INTENT_FILE_AND_MCP:
        return True, bool(tools)
    if intent == INTENT_CHAT_ONLY:
        return bool(attachment_ids) or has_ctx_files, bool(tools)
    return False, bool(tools)


# Backward-compatible wrappers used elsewhere
def resolve_tools_for_turn(
    tools: list,
    attachment_ids: list[str] | None,
    attachment_context: dict | None,
    user_message: str,
) -> list:
    intent = _fallback_classify_intent(
        user_message,
        new_attachments=bool(attachment_ids),
        session_has_files=bool((attachment_context or {}).get("has_files")),
        tools_connected=bool(tools),
        tools=tools,
    )
    agent_tools, _ = apply_turn_routing(intent, tools, attachment_context, attachment_ids)
    return agent_tools


def attachment_context_for_agent(
    attachment_context: dict | None,
    attachment_ids: list[str] | None,
    user_message: str,
    tools: list,
) -> dict:
    intent = _fallback_classify_intent(
        user_message,
        new_attachments=bool(attachment_ids),
        session_has_files=bool((attachment_context or {}).get("has_files")),
        tools_connected=bool(tools),
        tools=tools,
    )
    _, ctx = apply_turn_routing(intent, tools, attachment_context, attachment_ids)
    return ctx


def should_use_control_room(
    attachment_context: dict | None,
    attachment_ids: list[str] | None,
    tools: list,
    user_message: str = "",
    turn_intent: str | None = None,
) -> tuple[bool, bool]:
    if turn_intent:
        return should_use_control_room_from_intent(
            turn_intent, tools, attachment_ids, attachment_context
        )
    intent = _fallback_classify_intent(
        user_message,
        new_attachments=bool(attachment_ids),
        session_has_files=bool((attachment_context or {}).get("has_files")),
        tools_connected=bool(tools),
        tools=tools,
    )
    return should_use_control_room_from_intent(
        intent, tools, attachment_ids, attachment_context
    )


def phase_payload(role: str, status: str, detail: str = "") -> str:
    return json.dumps({
        "type": "phase",
        "role": role,
        "status": status,
        "detail": detail,
    })


def planner_chip_label(intent: str, plan: str = "") -> str:
    labels = {
        INTENT_FILE_ONLY: "Read attached files",
        INTENT_MCP_ONLY: "Run MCP tools",
        INTENT_FILE_AND_MCP: "Files + MCP",
        INTENT_CHAT_ONLY: "Planning",
    }
    base = labels.get(intent, "Planning")
    lines = [ln.strip() for ln in (plan or "").splitlines() if ln.strip()]
    if len(lines) <= 1:
        return base
    return f"{base} · {len(lines)} steps"


async def run_planner(
    llm,
    user_message: str,
    tools: list,
    attachment_context: dict | None,
    *,
    turn_intent: str = INTENT_CHAT_ONLY,
    files_this_message: bool = False,
) -> str:
    tool_names = ", ".join(t.name for t in tools) if tools else "none"
    has_files = bool((attachment_context or {}).get("has_files"))
    use_vision = bool((attachment_context or {}).get("use_vision"))

    mode_note = {
        INTENT_FILE_ONLY: "FILE ONLY — no MCP tools",
        INTENT_MCP_ONLY: "MCP ONLY — ignore old chat files",
        INTENT_FILE_AND_MCP: "FILES + MCP tools",
        INTENT_CHAT_ONLY: "normal chat",
    }.get(turn_intent, "normal chat")

    if turn_intent == INTENT_MCP_ONLY:
        file_note = "no"
    elif not has_files and not files_this_message:
        file_note = "no"
    elif use_vision:
        file_note = "yes (vision/PDF pages)"
    elif files_this_message:
        file_note = "yes (this message)"
    else:
        file_note = "yes (earlier in chat)"

    prompt = (
        f"Routing mode: {mode_note}\n"
        f"Tools available: {tool_names}\n"
        f"Files in context: {file_note}\n"
        f"User message:\n{user_message[:4000]}"
    )
    try:
        resp = await llm.ainvoke([
            SystemMessage(content=PLANNER_SYSTEM),
            HumanMessage(content=prompt),
        ])
        text = resp.content if isinstance(resp.content, str) else str(resp.content)
        return (text or "").strip()[:2000]
    except Exception as exc:
        logger.warning("Planner failed: %s", exc)
        if turn_intent == INTENT_MCP_ONLY:
            return "1. Call the right MCP tool\n2. Use real results\n3. Reply to user"
        if turn_intent == INTENT_FILE_ONLY:
            return "1. Read attached files\n2. Answer the question\n3. Cite the document"
        return "1. Understand the request\n2. Complete the task\n3. Reply clearly"


async def run_reviewer(
    llm,
    user_message: str,
    plan: str,
    tool_names_used: list[str],
    has_files: bool,
) -> str:
    tools_line = ", ".join(tool_names_used) if tool_names_used else "none"
    prompt = (
        f"Plan:\n{plan[:1500]}\n\n"
        f"Tools used: {tools_line}\n"
        f"Had file attachments: {has_files}\n"
        f"User message:\n{user_message[:2000]}"
    )
    try:
        resp = await llm.ainvoke([
            SystemMessage(content=REVIEWER_SYSTEM),
            HumanMessage(content=prompt),
        ])
        text = resp.content if isinstance(resp.content, str) else str(resp.content)
        return (text or "APPROVE").strip()[:200]
    except Exception as exc:
        logger.warning("Reviewer failed: %s", exc)
        return "APPROVE"


def planner_detail_from_plan(plan: str, turn_intent: str | None = None) -> str:
    if turn_intent:
        return planner_chip_label(turn_intent, plan)
    lines = [ln.strip() for ln in plan.splitlines() if ln.strip()]
    if not lines:
        return "Planning steps…"
    step_count = len(lines)
    combined = " ".join(lines).lower()
    if "attach" in combined or "file" in combined or "pdf" in combined:
        label = "Read attached files"
    elif "tool" in combined or "mcp" in combined or "gmail" in combined:
        label = "Run MCP tools"
    else:
        first = re.sub(r"^\d+[\.\)]\s*", "", lines[0])
        label = first[:48] + ("…" if len(first) > 48 else "")
    return label if step_count <= 1 else f"{label} · {step_count} steps"
