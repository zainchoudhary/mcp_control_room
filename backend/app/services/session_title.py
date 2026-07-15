"""
session_title.py - Claude-style AI session titles from the first user message.
"""
from __future__ import annotations

import json
import logging
import os
import re

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_groq import ChatGroq

logger = logging.getLogger(__name__)

TITLE_MODEL = "llama-3.1-8b-instant"
MAX_TITLE_LEN = 80

GENERIC_FILE_ONLY = re.compile(
    r"^please review the attached file\(s\) and answer my questions about them\.?$",
    re.I,
)

SESSION_TITLE_SYSTEM = """Generate a concise, sentence-case title (3-7 words) that captures the main topic or goal of this chat. The title must be clear enough that the user recognizes the conversation when searching their history. Use sentence case: capitalize only the first word and proper nouns (names, brands, acronyms).

Return ONLY valid JSON with a single "title" field. No markdown, no explanation.

Good examples:
{"title": "Fix login button on mobile"}
{"title": "Summarize Q3 sales report"}
{"title": "Query connected database records"}
{"title": "Quiz answers from attached PDF"}
{"title": "Explain Python list comprehensions"}

Bad (too vague): {"title": "Code changes"}
Bad (too long): {"title": "Investigate and fix the issue where the login button does not respond on mobile devices"}
Bad (wrong case): {"title": "Fix Login Button On Mobile"}"""


def _clean_message(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip())


def _build_title_prompt(message: str, attachment_names: list[str] | None) -> str:
    msg = _clean_message(message)
    names = [n for n in (attachment_names or []) if n]
    parts: list[str] = []

    if msg and not GENERIC_FILE_ONLY.match(msg):
        parts.append(f"User message:\n{msg[:2000]}")
    elif msg:
        parts.append("User uploaded file(s) without a specific text question.")
    if names:
        parts.append("Attached files: " + ", ".join(names[:8]))
    if not parts:
        return "New chat"
    return "\n\n".join(parts)


def _normalize_title(title: str) -> str:
    t = re.sub(r"\s+", " ", (title or "").strip().strip('"').strip("'"))
    if not t:
        return ""
    if len(t) > MAX_TITLE_LEN:
        cut = t[: MAX_TITLE_LEN - 3]
        if " " in cut:
            cut = cut.rsplit(" ", 1)[0]
        t = cut + "..."
    return t


def _parse_title_json(raw: str) -> str | None:
    raw = (raw or "").strip()
    if not raw:
        return None
    try:
        data = json.loads(raw)
        if isinstance(data, dict) and data.get("title"):
            return _normalize_title(str(data["title"])) or None
    except json.JSONDecodeError:
        pass
    match = re.search(r'\{\s*"title"\s*:\s*"([^"]+)"\s*\}', raw)
    if match:
        return _normalize_title(match.group(1)) or None
    return None


def fallback_session_title(message: str, attachment_names: list[str] | None = None) -> str:
    """Readable title when the LLM is unavailable."""
    msg = _clean_message(message)
    names = [n for n in (attachment_names or []) if n]

    if msg and not GENERIC_FILE_ONLY.match(msg):
        if len(msg) <= MAX_TITLE_LEN:
            return msg
        cut = msg[: MAX_TITLE_LEN - 3]
        if " " in cut:
            cut = cut.rsplit(" ", 1)[0]
        return cut + "..."

    if len(names) == 1:
        stem = re.sub(r"\.[^.]+$", "", names[0]).replace("_", " ").replace("-", " ")
        return f"Questions about {stem}"[:MAX_TITLE_LEN]

    if names:
        return f"Review {len(names)} attached files"

    return "New conversation"


async def generate_session_title(
    message: str,
    attachment_names: list[str] | None = None,
) -> str:
    """Generate a short, meaningful session title (Claude-style)."""
    if not os.getenv("GROQ_API_KEY"):
        return fallback_session_title(message, attachment_names)

    llm = ChatGroq(
        model=TITLE_MODEL,
        temperature=0,
        max_tokens=48,
        streaming=False,
    )
    prompt = _build_title_prompt(message, attachment_names)

    try:
        resp = await llm.ainvoke([
            SystemMessage(content=SESSION_TITLE_SYSTEM),
            HumanMessage(content=prompt),
        ])
        raw = resp.content if isinstance(resp.content, str) else str(resp.content)
        title = _parse_title_json(raw)
        if title:
            logger.info("Generated session title: %s", title)
            return title
    except Exception as exc:
        logger.warning("Session title generation failed: %s", exc)

    return fallback_session_title(message, attachment_names)
