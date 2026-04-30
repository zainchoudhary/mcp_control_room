"""
agent.py - LangGraph ReAct agent factory with streaming and MCP tool injection.
"""
import os
import json
import logging
from typing import AsyncIterator, List

from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, BaseMessage
from langgraph.prebuilt import create_react_agent

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an intelligent AI assistant with access to external tools via MCP (Model Context Protocol) servers.

Your capabilities depend on which MCP tools the user has connected. Always:
1. Use available tools when they can help answer the question more accurately
2. Clearly explain what tools you're using and why
3. Present results in a clean, readable format
4. If no tools are available, answer from your knowledge and suggest the user connects relevant MCP servers

Be concise, accurate, and proactive in using the tools at your disposal."""


def build_llm() -> ChatGroq:
    """Instantiate the Groq LLM."""
    if not os.getenv("GROQ_API_KEY"):
        raise EnvironmentError("GROQ_API_KEY environment variable not set.")
    return ChatGroq(
        model="llama-3.3-70b-versatile",
        temperature=0.3,
        max_tokens=4096,
        streaming=True,
    )


def build_history(raw_messages: list) -> List[BaseMessage]:
    """Convert DB message rows to LangChain message objects."""
    mapping = {"user": HumanMessage, "assistant": AIMessage}
    messages = [SystemMessage(content=SYSTEM_PROMPT)]
    for m in raw_messages:
        cls = mapping.get(m["role"])
        if cls:
            messages.append(cls(content=m["content"]))
    return messages


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
    messages = build_history(history)
    messages.append(HumanMessage(content=user_message))

    if tools:
        agent = create_react_agent(llm, tools)
    else:
        # No tools – plain LLM streaming
        agent = create_react_agent(llm, [])

    full_response = ""

    try:
        async for event in agent.astream_events(
            {"messages": messages},
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

                # Handle list content from Groq/LangChain streaming chunks.
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
                tool_input = event["data"].get("input", {})
                payload = json.dumps({"type": "tool_use", "tool": tool_name, "input": tool_input})
                yield f"data: {payload}\n\n"

            # ── Tool result ───────────────────────────────────────────
            elif kind == "on_tool_end":
                tool_name = event.get("name", "unknown_tool")
                output = event["data"].get("output", "")
                content = str(output) if not isinstance(output, str) else output
                payload = json.dumps({"type": "tool_result", "tool": tool_name, "content": content[:2000]})
                yield f"data: {payload}\n\n"

    except Exception as exc:
        logger.error("Agent stream error: %s", exc, exc_info=True)
        payload = json.dumps({"type": "error", "content": str(exc)})
        yield f"data: {payload}\n\n"

    # Signal completion
    yield f"data: {json.dumps({'type': 'done', 'content': full_response})}\n\n"
