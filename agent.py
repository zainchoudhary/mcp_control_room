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

SYSTEM_PROMPT = """You are an intelligent AI assistant with access to external tools via MCP servers.

RULES:
1. If no tools are provided to you, do NOT pretend to use tools. Tell the user to connect an MCP server using the + button.
2. For greetings and casual chat, just respond normally without tools.
3. When you call a tool, ALWAYS read the returned output carefully and base your response ONLY on what the tool actually returned. NEVER make up or assume tool results.
4. When the email_tool is called without confirm=True, it returns a preview. You must call email_tool AGAIN with confirm=True to send it. Always pass confirm=True on the second call.
5. The SMTP credentials are already configured on the server. Do NOT ask the user for SMTP credentials — they are handled automatically.
6. Be concise and helpful."""


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
