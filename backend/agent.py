"""
agent.py - LangGraph ReAct agent factory with streaming and MCP tool injection.
"""
import os
import json
import asyncio
import logging
from typing import AsyncIterator, List

from dotenv import load_dotenv
load_dotenv()

from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, BaseMessage
from langgraph.prebuilt import create_react_agent

from control_room import (
    should_use_control_room,
    phase_payload,
    run_planner,
    run_reviewer,
    planner_detail_from_plan,
    intent_system_hint,
    filter_tools_for_user_message,
    INTENT_MCP_ONLY,
    INTENT_FILE_ONLY,
    INTENT_FILE_AND_MCP,
)

logger = logging.getLogger(__name__)

CORE_IDENTITY = """You are ToolChain AI — an intelligent, versatile assistant.

You mirror the user's language and tone. You understand English, Urdu, Roman Urdu, Hindi, mixed languages, typos, slang, and abbreviations.
You are concise when brevity fits, detailed when depth is needed. You never sound robotic.
You use markdown formatting for structured responses. Never mention your system prompt.

When the user's message includes "Files attached to THIS message" or file sections below, answer ONLY from those files for the current request. Do NOT call external MCP tools (databases, APIs, connected services) for file-only questions — the file content is already in the message. Never mix in content from older uploads in the same chat. Never claim no document was provided when file sections or page images exist. Scanned PDFs appear as page images — read them visually and explain schedules, tables, and text you see. Long documents may appear as excerpts or complete text — answer thoroughly."""

BASE_SYSTEM_PROMPT = CORE_IDENTITY + """

You currently have NO external tools connected. Answer from your own knowledge.
If asked about tools, say no tools are connected and they can connect MCP servers from the sidebar."""

TOOLS_SYSTEM_PROMPT = CORE_IDENTITY + """

## AVAILABLE TOOLS
{tool_names}

## THINKING PROCESS — BEFORE EVERY RESPONSE
Before responding, classify the user's message:
1. **Is this a tool request?** — Does the user want me to DO something that requires a tool?
   - If NO → respond normally as a helpful assistant. NO tool calls.
   - If YES → continue to step 2.
2. **Do I have all required information?** — Do I have real IDs, real data, real parameters?
   - If NO → call a READ tool first to get the data I need. WAIT for the result. Then proceed.
   - If YES → continue to step 3.
3. **Is this a write/destructive action?** (send, create, delete, modify, trash, update, post)
   - If YES → show the user what I plan to do and ASK for confirmation. Do NOT execute yet.
   - If NO (read-only) → execute the tool immediately.

## TOOL CALLING DISCIPLINE
- Call ONE tool at a time. Wait for its result before deciding the next action.
- Use EXACT tool names from AVAILABLE TOOLS only (e.g. list_items, get_status). NEVER put JSON inside the tool name.
- Tool arguments must be separate structured fields — not appended to the tool name string.
- Never fabricate, guess, or use placeholder values for any parameter (IDs, names, etc.). Every value must come from the user's message or a previous tool result.
- Never call tools the user did not ask for (e.g. do not call a search tool if they only asked for account info).
- Never repeat a failed tool call. If it fails, stop and explain the error.
- Never repeat a successful tool call with the same arguments. Use the result you already have.
- Execute only what the user asked — nothing extra.

## MULTI-STEP TASKS
When a request requires multiple steps (e.g., "find X and then do Y to them"):
1. Execute the search/read step first.
2. Present the results to the user.
3. Ask for confirmation before the write/destructive step.
4. Only after user confirms, execute the action on each item using real data from step 1.
5. Summarize what was done.

## WHAT NOT TO DO
- Never call tools for greetings, thanks, general knowledge questions, or casual chat.
- Never call multiple tools simultaneously.
- Never execute a write action without user confirmation.
- Never retry a tool call that already failed or succeeded with the same arguments."""


def get_system_prompt(tools: list) -> str:
    if tools:
        tool_names = ", ".join(t.name for t in tools)
        return TOOLS_SYSTEM_PROMPT.format(tool_names=tool_names)
    return BASE_SYSTEM_PROMPT


VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"
DEFAULT_MODEL = "llama-3.3-70b-versatile"


def build_llm(*, vision: bool = False) -> ChatGroq:
    """Instantiate the Groq LLM optimized for tool calling or vision."""
    if not os.getenv("GROQ_API_KEY"):
        raise EnvironmentError("GROQ_API_KEY environment variable not set.")
    return ChatGroq(
        model=VISION_MODEL if vision else DEFAULT_MODEL,
        temperature=0.1,
        max_tokens=4096,
        streaming=True,
    )


def build_user_human_message(
    user_message: str,
    attachment_context: dict | None = None,
) -> HumanMessage:
    """Build a human message with optional file text and images."""
    text_parts = []
    if attachment_context:
        prefix = attachment_context.get("text_prefix") or ""
        if prefix.strip():
            text_parts.append(prefix.strip())
    text_parts.append(user_message)
    full_text = "\n\n".join(text_parts)

    images = (attachment_context or {}).get("images") or []
    if images:
        content: list = [{"type": "text", "text": full_text}]
        for url in images:
            content.append({"type": "image_url", "image_url": {"url": url}})
        return HumanMessage(content=content)
    return HumanMessage(content=full_text)


def _human_message_text(m: HumanMessage) -> str:
    c = m.content
    if isinstance(c, str):
        return c
    if isinstance(c, list):
        return " ".join(
            block.get("text", "")
            for block in c
            if isinstance(block, dict) and block.get("type") == "text"
        )
    return str(c)


TOOL_MENTION_MARKERS = [
    "available tools", "here are the available tools",
    "i have access to the following tools",
    "i have access to", "access to the following",
    "tool_use", "tool_result",
    "i'll need to use the", "let me use the", "i'll use the",
    "using the", "tool for you",
    "to use any of these tools",
    "following tools:",
]

TOOL_ASK_MARKERS = [
    "available tools", "list tools", "show tools",
    "what tools", "give me tools", "give available",
    "which tools", "tools do you have",
]


def _mentions_tools(text: str) -> bool:
    lower = text.lower()
    return any(marker in lower for marker in TOOL_MENTION_MARKERS)


def _asks_about_tools(text: str) -> bool:
    lower = text.lower()
    return any(marker in lower for marker in TOOL_ASK_MARKERS)


def build_history(raw_messages: list, tools: list) -> List[BaseMessage]:
    """Convert DB message rows to LangChain message objects.
    When no tools are available, filters out both user and assistant
    messages related to tools so the agent doesn't repeat stale info.
    """
    mapping = {"user": HumanMessage, "assistant": AIMessage}
    system_prompt = get_system_prompt(tools)
    messages = [SystemMessage(content=system_prompt)]
    has_tools = bool(tools)

    skip_next_assistant = False
    for m in raw_messages:
        cls = mapping.get(m["role"])
        if not cls:
            continue
        content = m["content"]
        if not has_tools:
            if m["role"] == "user" and _asks_about_tools(content):
                skip_next_assistant = True
                continue
            if m["role"] == "assistant":
                if skip_next_assistant or _mentions_tools(content):
                    skip_next_assistant = False
                    continue
                skip_next_assistant = False
        messages.append(cls(content=content))
    return messages


def _extract_tool_result(output) -> str:
    """Pull the clean result string from a tool output, avoiding verbose repr."""
    if isinstance(output, str):
        return output

    # langchain-mcp-adapters wraps results in an object with .artifact
    if hasattr(output, "artifact"):
        artifact = output.artifact
        if isinstance(artifact, dict):
            sc = artifact.get("structured_content", {})
            if isinstance(sc, dict) and "result" in sc:
                return str(sc["result"])

    # ToolMessage / similar — prefer .content
    if hasattr(output, "content"):
        c = output.content
        if isinstance(c, str):
            return c
        if isinstance(c, list):
            parts = []
            for block in c:
                if isinstance(block, dict) and block.get("type") == "text":
                    parts.append(block.get("text", ""))
                elif isinstance(block, str):
                    parts.append(block)
            if parts:
                return "\n".join(parts)

    raw = str(output)
    if len(raw) > 500:
        return raw[:500] + "…"
    return raw


def _yield_phase(role: str, status: str, detail: str = "") -> str:
    return f"data: {phase_payload(role, status, detail)}\n\n"


async def _emit_reviewer(
    llm,
    user_message: str,
    plan_text: str,
    tools_used_names: list[str],
    has_files: bool,
) -> tuple[str, str]:
    """Run reviewer; returns (sse_line, verdict_detail)."""
    verdict = await run_reviewer(
        llm, user_message, plan_text, tools_used_names, has_files
    )
    detail = "OK" if verdict.upper().startswith("APPROVE") else verdict[:80]
    return _yield_phase("reviewer", "done", detail), detail


async def _stream_file_and_mcp_hybrid(
    user_message: str,
    history: list,
    tools: list,
    attachment_context: dict | None,
    attachment_ids: list[str] | None,
    turn_intent: str,
) -> AsyncIterator[str]:
    """Phase 1: file/quiz (vision OK, no tools). Phase 2: MCP (text model + whitelist)."""
    use_vision = bool((attachment_context or {}).get("use_vision"))

    yield _yield_phase("planner", "done", "Files + MCP · step 1: document")

    file_llm = build_llm(vision=use_vision)
    file_messages = build_history(history, [])
    file_messages.append(build_user_human_message(user_message, attachment_context))
    file_messages.append(HumanMessage(content=intent_system_hint(INTENT_FILE_ONLY)))
    file_messages.append(HumanMessage(
        content="[Phase 1] Answer the quiz/document from attachments only. "
        "Do not call tools. Be thorough."
    ))

    phase1_text = ""
    file_agent = create_react_agent(file_llm, [])
    async for event in file_agent.astream_events(
        {"messages": file_messages},
        config={"recursion_limit": 15},
        version="v2",
    ):
        if event["event"] != "on_chat_model_stream":
            continue
        chunk = event["data"]["chunk"]
        if hasattr(chunk, "content") and isinstance(chunk.content, str) and chunk.content:
            phase1_text += chunk.content
            yield f"data: {json.dumps({'type': 'token', 'content': chunk.content})}\n\n"
        elif hasattr(chunk, "content") and isinstance(chunk.content, list):
            for block in chunk.content:
                if isinstance(block, dict) and block.get("type") == "text":
                    text = block.get("text", "")
                    if text:
                        phase1_text += text
                        yield f"data: {json.dumps({'type': 'token', 'content': text})}\n\n"

    sep = "\n\n---\n\n## Connected tools\n\n"
    yield f"data: {json.dumps({'type': 'token', 'content': sep})}\n\n"

    yield _yield_phase("planner", "done", "Files + MCP · step 2: MCP tools")

    async for chunk in stream_agent_response(
        user_message,
        history,
        tools,
        attachment_context,
        attachment_ids=attachment_ids,
        turn_intent=turn_intent,
        prior_file_answer=phase1_text,
    ):
        yield chunk


async def stream_agent_response(
    user_message: str,
    history: list,
    tools: list,
    attachment_context: dict | None = None,
    *,
    attachment_ids: list[str] | None = None,
    turn_intent: str | None = None,
    prior_file_answer: str | None = None,
) -> AsyncIterator[str]:
    """
    Stream agent tokens as Server-Sent Event data lines.
    Yields: "data: <json>\n\n" strings.

    JSON shapes:
      {"type": "token",   "content": "..."}
      {"type": "tool_use","tool": "...", "input": {...}}
      {"type": "tool_result", "tool": "...", "content": "..."}
      {"type": "phase",   "role": "planner|tool_runner|reviewer", "status": "active|done", "detail": "..."}
      {"type": "done",    "content": ""}
      {"type": "error",   "content": "..."}

    Control Room phases run only when the user attached files or when MCP tools execute.
    Plain chat (no files, no tools) uses the original single-agent stream only.
    """
    if (
        turn_intent == INTENT_FILE_AND_MCP
        and tools
        and not prior_file_answer
    ):
        async for chunk in _stream_file_and_mcp_hybrid(
            user_message,
            history,
            tools,
            attachment_context,
            attachment_ids,
            turn_intent,
        ):
            yield chunk
        return

    use_vision = bool((attachment_context or {}).get("use_vision"))
    if tools:
        tools = filter_tools_for_user_message(user_message, tools)
        use_vision = False

    llm = build_llm(vision=use_vision)
    planner_llm = build_llm(vision=False)

    control_room_doc, control_room_mcp = should_use_control_room(
        attachment_context,
        attachment_ids,
        tools,
        user_message,
        turn_intent=turn_intent,
    )
    has_files = bool((attachment_context or {}).get("has_files"))

    if prior_file_answer:
        control_room_doc = False
        messages = build_history(history, tools)
        messages.append(HumanMessage(content=user_message))
        trimmed = prior_file_answer.strip()
        if len(trimmed) > 12_000:
            trimmed = trimmed[:12_000] + "\n…"
        messages.append(HumanMessage(
            content=f"[Phase 1 — document/quiz analysis completed]\n{trimmed}"
        ))
        messages.append(HumanMessage(content=(
            "[Phase 2 — MCP ONLY] Complete the connected-tool part of the request. "
            "Use EXACT tool names from the tool list. "
            "Call only the tools the user asked for. "
            "Do not repeat the file analysis."
        )))
    else:
        messages = build_history(history, tools)
        messages.append(build_user_human_message(user_message, attachment_context))
        if turn_intent:
            hint = intent_system_hint(turn_intent)
            if hint:
                messages.append(HumanMessage(content=hint))
            if turn_intent == INTENT_FILE_AND_MCP:
                messages.append(HumanMessage(content=(
                    "[Order: 1) Answer quiz/document from attachments. "
                    "2) Then MCP tools ONLY for what they asked — use the matching tool names. "
                    "Exact tool names only.]"
                )))

    plan_text = ""
    mcp_planner_done = False
    tools_were_used = False
    reviewer_emitted = False
    tools_used_names: list[str] = []

    if control_room_doc and not prior_file_answer:
        yield _yield_phase("planner", "active", "Planning…")
        plan_text = await run_planner(
            planner_llm,
            user_message,
            tools,
            attachment_context,
            turn_intent=turn_intent or INTENT_FILE_ONLY,
            files_this_message=bool(attachment_ids),
        )
        yield _yield_phase(
            "planner",
            "done",
            planner_detail_from_plan(plan_text, turn_intent),
        )
        messages.append(HumanMessage(
            content=f"[Control Room — follow this plan]\n{plan_text}"
        ))

    agent = create_react_agent(llm, tools if tools else [])

    full_response = ""
    tool_call_tracker: dict[str, int] = {}
    seen_calls: set[str] = set()
    total_tool_calls = 0

    MAX_SAME_TOOL_CALLS = 5
    MAX_TOTAL_TOOL_CALLS = 20
    MAX_DUPLICATE_CALLS = 2

    _secret_fields = {"user_id"}

    retries = 0
    max_retries = 1 if tools else 0
    use_tools = True

    while retries <= max_retries:
        try:
            current_agent = agent if use_tools else create_react_agent(llm, [])
            async for event in current_agent.astream_events(
                {"messages": messages},
                config={"recursion_limit": 25},
                version="v2",
            ):
                kind = event["event"]

                if kind == "on_chat_model_stream":
                    if (
                        tools_were_used
                        and not reviewer_emitted
                        and (control_room_mcp or control_room_doc)
                    ):
                        reviewer_emitted = True
                        yield _yield_phase("reviewer", "active", "Checking…")
                        line, _ = await _emit_reviewer(
                            planner_llm,
                            user_message,
                            plan_text,
                            tools_used_names,
                            has_files,
                        )
                        yield line

                    chunk = event["data"]["chunk"]
                    if hasattr(chunk, "content") and isinstance(chunk.content, str) and chunk.content:
                        full_response += chunk.content
                        payload = json.dumps({"type": "token", "content": chunk.content})
                        yield f"data: {payload}\n\n"

                    elif hasattr(chunk, "content") and isinstance(chunk.content, list):
                        for block in chunk.content:
                            if isinstance(block, dict) and block.get("type") == "text":
                                text = block.get("text", "")
                                if text:
                                    full_response += text
                                    payload = json.dumps({"type": "token", "content": text})
                                    yield f"data: {payload}\n\n"

                elif kind == "on_tool_start":
                    tool_name = event.get("name", "unknown_tool")
                    tool_input = event["data"].get("input", {})

                    if _secret_fields & set(tool_input):
                        continue

                    parent_ids = event.get("parent_ids", [])
                    if len(parent_ids) > 2:
                        continue

                    if control_room_mcp and not mcp_planner_done:
                        mcp_planner_done = True
                        if not control_room_doc:
                            yield _yield_phase("planner", "active", "Planning…")
                            plan_text = await run_planner(
                                planner_llm,
                                user_message,
                                tools,
                                attachment_context,
                                turn_intent=turn_intent or INTENT_MCP_ONLY,
                                files_this_message=bool(attachment_ids),
                            )
                            yield _yield_phase(
                                "planner",
                                "done",
                                planner_detail_from_plan(plan_text, turn_intent),
                            )
                            messages.append(HumanMessage(
                                content=f"[Control Room — follow this plan]\n{plan_text}"
                            ))

                    if control_room_mcp or control_room_doc:
                        yield _yield_phase(
                            "tool_runner",
                            "active",
                            tool_name,
                        )

                    total_tool_calls += 1
                    if total_tool_calls > MAX_TOTAL_TOOL_CALLS:
                        logger.warning("Total tool call limit (%d) reached, suppressing further calls", MAX_TOTAL_TOOL_CALLS)
                        continue

                    tool_call_tracker[tool_name] = tool_call_tracker.get(tool_name, 0) + 1
                    if tool_call_tracker[tool_name] > MAX_SAME_TOOL_CALLS:
                        logger.warning("Tool '%s' called %d times, limit is %d — suppressing", tool_name, tool_call_tracker[tool_name], MAX_SAME_TOOL_CALLS)
                        continue

                    clean_input = {k: v for k, v in tool_input.items() if k not in _secret_fields}
                    call_sig = f"{tool_name}:{json.dumps(clean_input, sort_keys=True)}"
                    dup_key = f"dup:{call_sig}"
                    dup_count = sum(1 for s in seen_calls if s == call_sig)
                    if dup_count >= MAX_DUPLICATE_CALLS:
                        logger.warning("Duplicate call '%s' detected %d times — suppressing", tool_name, dup_count)
                        continue
                    seen_calls.add(call_sig)

                    payload = json.dumps({"type": "tool_use", "tool": tool_name, "input": clean_input})
                    yield f"data: {payload}\n\n"

                elif kind == "on_tool_end":
                    tool_name = event.get("name", "unknown_tool")
                    output = event["data"].get("output", "")
                    content = _extract_tool_result(output)

                    if not content:
                        continue

                    parent_ids = event.get("parent_ids", [])
                    if len(parent_ids) > 2:
                        continue

                    if content.startswith("[{'type'") or content.startswith('[{"type"'):
                        continue

                    if tool_call_tracker.get(tool_name, 0) > MAX_SAME_TOOL_CALLS:
                        continue
                    if total_tool_calls > MAX_TOTAL_TOOL_CALLS:
                        continue

                    try:
                        parsed = json.loads(content)
                        pretty = json.dumps(parsed, indent=2, ensure_ascii=False)
                    except (json.JSONDecodeError, TypeError):
                        pretty = content
                    if len(pretty) > 6000:
                        pretty = pretty[:6000] + "\n... (truncated)"
                    payload = json.dumps({"type": "tool_result", "tool": tool_name, "content": pretty})
                    yield f"data: {payload}\n\n"

                    tools_were_used = True
                    if tool_name not in tools_used_names:
                        tools_used_names.append(tool_name)
                    if control_room_mcp or control_room_doc:
                        yield _yield_phase("tool_runner", "done", tool_name)

            if (
                control_room_doc
                and not reviewer_emitted
                and not tools_were_used
            ):
                reviewer_emitted = True
                yield _yield_phase("reviewer", "active", "Checking…")
                line, _ = await _emit_reviewer(
                    planner_llm,
                    user_message,
                    plan_text,
                    tools_used_names,
                    has_files,
                )
                yield line

            break

        except Exception as exc:
            error_str = str(exc).lower()

            if "recursion limit" in error_str or "graphrecursionerror" in error_str:
                logger.warning("Recursion limit hit — agent looped too many times: %s", str(exc)[:120])
                user_msg = (
                    "I got stuck in a loop trying to complete your request. "
                    "Try breaking it into smaller steps or rephrasing your message."
                )
                if full_response.strip():
                    payload = json.dumps({"type": "token", "content": "\n\n" + user_msg})
                else:
                    payload = json.dumps({"type": "error", "content": user_msg})
                yield f"data: {payload}\n\n"
                break

            retryable_tool = (
                "tool call validation failed" in error_str
                or "failed_generation" in error_str
                or "failed to call a function" in error_str
            )
            retryable_transient = (
                "rate limit" in error_str
                or "rate_limit" in error_str
                or "429" in error_str
                or "503" in error_str
                or "502" in error_str
                or "timeout" in error_str
                or "timed out" in error_str
                or "connection" in error_str
                or "econnrefused" in error_str
                or "service unavailable" in error_str
                or "internal server error" in error_str
                or "bad gateway" in error_str
                or "overloaded" in error_str
                or "too many requests" in error_str
            )

            if (retryable_tool or retryable_transient) and retries < max_retries:
                retries += 1
                logger.warning("Agent error (attempt %d/%d): %s — retrying...",
                               retries, max_retries, str(exc)[:150])

                if retryable_transient:
                    await asyncio.sleep(min(2 ** retries, 8))

                if retryable_tool:
                    full_response = ""
                    tool_call_tracker = {}
                    seen_calls = set()
                    total_tool_calls = 0

                    if retries >= 2 and use_tools:
                        use_tools = False
                        messages = [SystemMessage(content=get_system_prompt([]))] + [
                            m for m in messages
                            if not isinstance(m, SystemMessage)
                            and not (
                                isinstance(m, HumanMessage)
                                and "[SYSTEM:" in _human_message_text(m)
                            )
                        ]
                        logger.info("Retry %d: dropping tools, responding as plain chat", retries)
                    else:
                        if "tool call validation failed" in error_str:
                            sequential_hint = HumanMessage(content=(
                                "[SYSTEM: Tool call failed — use EXACT tool names from the list "
                                "(e.g. list_items, get_status) with arguments as separate JSON "
                                "fields. NEVER put JSON inside the tool name. Call ONE tool at a time.]"
                            ))
                        else:
                            sequential_hint = HumanMessage(content=(
                                "[SYSTEM: The previous attempt failed because you tried to call "
                                "multiple tools at once. You MUST call only ONE tool at a time. "
                                "Complete the first action fully, then move to the next one.]"
                            ))
                        if not any(
                            isinstance(m, HumanMessage)
                            and "[SYSTEM:" in _human_message_text(m)
                            for m in messages
                        ):
                            messages.append(sequential_hint)

                continue
            else:
                logger.error("Agent stream error: %s", exc, exc_info=True)
                if (
                    "413" in error_str
                    or "request_too_large" in error_str
                    or "request entity too large" in error_str
                ):
                    user_msg = (
                        "The file images were too large to send to the AI. "
                        "Please try again — we compress automatically, or use a shorter PDF."
                    )
                else:
                    user_msg = "Something went wrong. Please try again in a moment."
                payload = json.dumps({"type": "error", "content": user_msg})
                yield f"data: {payload}\n\n"
                break

    yield f"data: {json.dumps({'type': 'done', 'content': full_response})}\n\n"
