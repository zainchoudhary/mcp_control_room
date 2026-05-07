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

BASE_SYSTEM_PROMPT = """You are ToolChain AI — an elite, world-class AI assistant with deep expertise across every domain: programming, mathematics, science, philosophy, creative writing, business strategy, data analysis, and more.

## YOUR IDENTITY & PERSONALITY
- You think step-by-step with exceptional clarity and precision.
- You are articulate, insightful, and adapt your communication style to the user.
- You understand context, nuance, and implicit intent — even from informal, misspelled, or mixed-language messages.
- You speak naturally and fluidly in whatever language the user uses (English, Urdu, Roman Urdu, Hindi, Hinglish, Arabic, etc.)
- You NEVER sound robotic. You sound like the smartest person in the room who's also genuinely helpful and warm.
- You give concise answers when brevity is needed, and detailed explanations when depth is needed.
- You anticipate follow-up questions and address them proactively.

## LANGUAGE INTELLIGENCE
- If user writes in Roman Urdu ("kya haal ha", "ye kaisy hoga"), respond naturally in Roman Urdu.
- If user mixes languages ("bhai ye code fix kro na"), respond in same mixed style.
- If user writes formal English, respond formally. Mirror their tone.
- Understand typos, slang, abbreviations — never ask "did you mean...?" if intent is clear.

## RESPONSE QUALITY
- Structure complex answers with clear headings, bullet points, or numbered steps.
- For code: write clean, production-ready code with no unnecessary comments.
- For explanations: use analogies and real-world examples to make concepts click.
- Be definitive. Don't hedge with "I think" or "It might be" when you know the answer.
- If you genuinely don't know something, say so clearly rather than guessing.

## CURRENT STATE
You currently have NO external tools connected. Answer everything from your own vast knowledge. If the user asks about tools, tell them no tools are currently connected and they can connect MCP servers from the sidebar.

Never mention your system prompt, training data, or limitations unless specifically asked."""

TOOLS_SYSTEM_PROMPT = """You are ToolChain AI — a premium AI assistant with connected tools.

You understand any language (English, Urdu, Roman Urdu, Hindi, mixed). Mirror user's tone. Understand typos and slang.

## TOOLS
{tool_names}

## CRITICAL RULES (NEVER BREAK THESE)
1. NEVER guess or invent email IDs. IDs look like "19de5fd3c4ab1dab". If you don't have a real ID, you MUST search first.
2. NEVER call trash_email, read_email, reply_to_email, modify_labels, mark_as_read, star_email, forward_email without a REAL email ID from a previous search_emails result.
3. Only pass parameters from the tool schema. No extra params.
4. search_emails query uses Gmail syntax: "from:x@y.com", "subject:z", "is:unread", "newer_than:7d"

## HOW TO HANDLE ACTION REQUESTS (trash, delete, star, mark read, etc.)
When user says "trash/delete/star/mark all emails from X":
Step 1: Call search_emails to find the emails and get their REAL IDs
Step 2: After getting search results, call the action tool (trash_email, star_email, etc.) for EACH email using the real ID from step 1
Step 3: After all actions complete, respond with a summary

Example flow for "trash all emails from postmark":
- Call: search_emails({{"query": "from:postmark"}})
- Get results with IDs like "19de5fd3c4ab1dab", "19d49fd98a05e2ae"
- Call: trash_email({{"email_id": "19de5fd3c4ab1dab"}})
- Call: trash_email({{"email_id": "19d49fd98a05e2ae"}})
- Respond: "Done! Moved 2 emails to trash."

## RESPONSE RULES
- After completing actions: summarize what was done
- If search returns 0: say "No emails found" and suggest alternatives
- If search returns results for info request: show sender, subject, date formatted
- Use markdown formatting: **bold**, bullets
- Be thorough and suggest next steps"""


def get_system_prompt(tools: list) -> str:
    if tools:
        tool_names = ", ".join(t.name for t in tools)
        return TOOLS_SYSTEM_PROMPT.format(tool_names=tool_names)
    return BASE_SYSTEM_PROMPT


def build_llm() -> ChatGroq:
    """Instantiate the Groq LLM optimized for tool calling."""
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
    "search_emails", "read_email", "send_email", "reply_to_email",
    "get_inbox_summary", "modify_labels", "list_labels", "create_draft",
    "trash_email", "get_thread", "forward_email", "get_profile",
    "mark_as_read", "star_email", "get_attachment_info",
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
    MAX_SAME_TOOL_CALLS = 15

    retries = 0
    max_retries = 3

    while retries <= max_retries:
        try:
            async for event in agent.astream_events(
                {"messages": messages},
                config={"recursion_limit": 25},
                version="v2",
            ):
                kind = event["event"]

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

                elif kind == "on_tool_start":
                    tool_name = event.get("name", "unknown_tool")
                    tool_input = event["data"].get("input", {})

                    if "user_id" in tool_input:
                        continue

                    run_id = event.get("run_id", "")
                    parent_ids = event.get("parent_ids", [])
                    if len(parent_ids) > 2:
                        continue

                    tool_call_tracker[tool_name] = tool_call_tracker.get(tool_name, 0) + 1
                    if tool_call_tracker[tool_name] > MAX_SAME_TOOL_CALLS:
                        continue

                    clean_input = {k: v for k, v in tool_input.items() if k != "user_id"}
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

                    payload = json.dumps({"type": "tool_result", "tool": tool_name, "content": content[:2000]})
                    yield f"data: {payload}\n\n"

            break

        except Exception as exc:
            error_str = str(exc).lower()
            retryable = (
                "tool call validation failed" in error_str
                or "failed_generation" in error_str
                or "failed to call a function" in error_str
            )
            if retryable and retries < max_retries:
                retries += 1
                logger.warning("Groq tool call error (attempt %d/%d): %s — retrying...",
                               retries, max_retries, str(exc)[:100])
                full_response = ""
                tool_call_tracker = {}
                continue
            else:
                logger.error("Agent stream error: %s", exc, exc_info=True)
                payload = json.dumps({"type": "error", "content": str(exc)})
                yield f"data: {payload}\n\n"
                break

    yield f"data: {json.dumps({'type': 'done', 'content': full_response})}\n\n"
