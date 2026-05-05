"""
agent.py - LangGraph ReAct agent factory with streaming and MCP tool injection.
"""
import os
import json
import logging
from typing import AsyncIterator, List

from dotenv import load_dotenv
load_dotenv()

from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, BaseMessage
from langgraph.prebuilt import create_react_agent

logger = logging.getLogger(__name__)

BASE_SYSTEM_PROMPT = """You are a helpful AI assistant.

You are knowledgeable about programming, science, math, general knowledge, and more. Answer questions directly from your own knowledge.

CRITICAL: You currently have NO external tools connected. Do NOT mention, list, or reference any tools whatsoever. If the user asks about tools, tell them no tools are currently connected and they can connect MCP servers using the + button in the sidebar.

Respond in the same language the user writes in."""

TOOLS_SYSTEM_PROMPT = """You are a helpful AI assistant.

You are knowledgeable about programming, science, math, general knowledge, and more. You can answer most questions directly from your own knowledge WITHOUT using any tools.

## TOOL USAGE POLICY — READ CAREFULLY

You have access to the following external tools: {tool_names}

Follow these rules STRICTLY:

### WHEN TO USE TOOLS:
- ONLY call a tool when the user's question CANNOT be answered without it.
- "calculate" is ONLY for evaluating MATH EXPRESSIONS like "2+2" or "sin(45)". It is NOT for code, NOT for git commands, NOT for general questions.
- "email_tool" is ONLY for when the user explicitly says "send an email" or "email someone".
- "get_current_time" is ONLY for when the user asks "what time is it" or "what's today's date".
- "reverse_text", "count_words", "random_number", "convert_temperature" — only when the user explicitly asks for those specific operations.

### WHEN NOT TO USE TOOLS (answer directly instead):
- Greetings, casual conversation, thanks
- Programming/coding questions
- Git commands
- General knowledge, explanations, advice
- Opinions, translations, writing
- ANY question you can answer from your own knowledge

### OTHER RULES:
- NEVER fake tool calls or invent results.
- Read tool outputs carefully and report exactly what was returned.
- For email_tool: first call returns a preview (confirm=false). Call again with confirm=true to send. SMTP is pre-configured — never ask for credentials.
- Respond in the same language the user writes in."""


def get_system_prompt(tools: list) -> str:
    if tools:
        tool_names = ", ".join(t.name for t in tools)
        return TOOLS_SYSTEM_PROMPT.format(tool_names=tool_names)
    return BASE_SYSTEM_PROMPT


def build_llm() -> ChatGroq:
    """Instantiate the Groq LLM."""
    if not os.getenv("GROQ_API_KEY"):
        raise EnvironmentError("GROQ_API_KEY environment variable not set.")
    return ChatGroq(
        model="llama-3.3-70b-versatile",
        temperature=0.1,
        max_tokens=4096,
        streaming=True,
    )


KNOWN_TOOL_NAMES = [
    "calculate", "email_tool", "get_current_time",
    "reverse_text", "count_words", "random_number",
    "convert_temperature",
]

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
    if any(marker in lower for marker in TOOL_MENTION_MARKERS):
        return True
    tool_hits = sum(1 for name in KNOWN_TOOL_NAMES if name in lower)
    return tool_hits >= 2


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


async def stream_agent_response(
    user_message: str,
    history: list,
    tools: list,
) -> AsyncIterator[str]:
    """
    Stream agent tokens as Server-Sent Event data lines.
    Yields: "data: <json>\n\n" strings.

    JSON shapes:
      {"type": "token",   "content": "..."}
      {"type": "tool_use","tool": "...", "input": {...}}
      {"type": "tool_result", "tool": "...", "content": "..."}
      {"type": "done",    "content": ""}
      {"type": "error",   "content": "..."}
    """
    llm = build_llm()
    messages = build_history(history, tools)
    messages.append(HumanMessage(content=user_message))

    agent = create_react_agent(llm, tools if tools else [])

    full_response = ""
    tool_call_tracker: dict[str, int] = {}
    MAX_SAME_TOOL_CALLS = 3

    try:
        async for event in agent.astream_events(
            {"messages": messages},
            config={"recursion_limit": 10},
            version="v2",
        ):
            kind = event["event"]

            # ── LLM text tokens ──────────────────────────────────────
            if kind == "on_chat_model_stream":
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

            # ── Tool invocation ───────────────────────────────────────
            elif kind == "on_tool_start":
                tool_name = event.get("name", "unknown_tool")
                tool_call_tracker[tool_name] = tool_call_tracker.get(tool_name, 0) + 1

                if tool_call_tracker[tool_name] > MAX_SAME_TOOL_CALLS:
                    logger.warning("Tool '%s' called %d times — suppressing further calls",
                                   tool_name, tool_call_tracker[tool_name])
                    continue

                tool_input = event["data"].get("input", {})
                payload = json.dumps({"type": "tool_use", "tool": tool_name, "input": tool_input})
                yield f"data: {payload}\n\n"

            # ── Tool result ───────────────────────────────────────────
            elif kind == "on_tool_end":
                tool_name = event.get("name", "unknown_tool")
                if tool_call_tracker.get(tool_name, 0) > MAX_SAME_TOOL_CALLS:
                    continue

                output = event["data"].get("output", "")
                content = _extract_tool_result(output)
                payload = json.dumps({"type": "tool_result", "tool": tool_name, "content": content[:2000]})
                yield f"data: {payload}\n\n"

    except Exception as exc:
        logger.error("Agent stream error: %s", exc, exc_info=True)
        payload = json.dumps({"type": "error", "content": str(exc)})
        yield f"data: {payload}\n\n"

    yield f"data: {json.dumps({'type': 'done', 'content': full_response})}\n\n"
