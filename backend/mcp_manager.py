"""
mcp_manager.py - Manages live MCP client connections and tool resolution.
Uses langchain-mcp-adapters MultiServerMCPClient for SSE/stdio transports.

Supports per-user tool injection: Gmail tools get user_id auto-injected.
"""
import asyncio
import logging
import re
from typing import Optional
from contextlib import asynccontextmanager
from functools import partial

from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_core.tools import StructuredTool

logger = logging.getLogger(__name__)

GMAIL_TOOL_NAMES = {
    "search_emails", "read_email", "send_email", "reply_to_email",
    "get_inbox_summary", "modify_labels", "list_labels", "create_draft",
    "trash_email", "get_thread", "forward_email", "get_profile",
    "mark_as_read", "star_email", "get_attachment_info",
}


def build_server_config(mcps: list) -> dict:
    """
    Convert DB MCP rows into MultiServerMCPClient config dict.
    Supports 'sse' and 'streamable_http' transports.
    """
    config = {}
    for mcp in mcps:
        transport = mcp.get("transport", "sse")
        entry: dict = {"url": mcp["url"], "transport": transport}
        config[mcp["name"]] = entry
    return config


def _sanitize_tool_name(name: str) -> str:
    """Ensure tool name contains only valid characters for Groq/OpenAI function calling."""
    sanitized = re.sub(r'[^a-zA-Z0-9_-]', '_', name)
    return sanitized[:64]


def _sanitize_tools(tools: list) -> list:
    """Clean up tool names and descriptions to avoid Groq parsing issues."""
    for tool in tools:
        if hasattr(tool, 'name'):
            tool.name = _sanitize_tool_name(tool.name)
        if hasattr(tool, 'description') and tool.description:
            tool.description = tool.description[:200]
    return tools


def _wrap_gmail_tool_with_user_id(tool, user_id: str):
    """
    Wrap a Gmail MCP tool so that user_id is automatically injected.
    The LLM never sees or provides user_id — it's hidden from the schema.
    Handles both dict-based schemas (from MCP adapters) and Pydantic models.
    """
    from pydantic import create_model, Field
    from typing import Optional as Opt

    schema = tool.args_schema
    new_schema = None

    if isinstance(schema, dict):
        properties = schema.get("properties", {})
        required_fields = schema.get("required", [])
        fields = {}
        type_map = {"string": str, "integer": int, "boolean": bool, "number": float}

        for field_name, field_def in properties.items():
            if field_name == "user_id":
                continue
            py_type = type_map.get(field_def.get("type", "string"), str)
            title = field_def.get("title", field_name)

            if "default" in field_def:
                fields[field_name] = (py_type, Field(default=field_def["default"], description=title))
            elif field_name in required_fields:
                fields[field_name] = (py_type, Field(description=title))
            else:
                fields[field_name] = (py_type, Field(default="", description=title))

        new_schema = create_model(f"{tool.name}_Args", **fields)

    elif schema and hasattr(schema, "model_fields"):
        fields = {}
        for field_name, field_info in schema.model_fields.items():
            if field_name == "user_id":
                continue
            annotation = field_info.annotation
            if hasattr(annotation, "__origin__"):
                annotation = str
            if field_info.is_required():
                fields[field_name] = (annotation, Field(description=field_info.description or ""))
            else:
                fields[field_name] = (annotation, Field(default=field_info.default or "", description=field_info.description or ""))
        new_schema = create_model(f"{tool.name}_Args", **fields)

    async def wrapped_async(**kwargs):
        kwargs["user_id"] = user_id
        return await tool.ainvoke(kwargs)

    def wrapped_sync(**kwargs):
        kwargs["user_id"] = user_id
        return asyncio.get_event_loop().run_until_complete(tool.ainvoke(kwargs))

    wrapped_tool = StructuredTool(
        name=tool.name,
        description=tool.description,
        func=wrapped_sync,
        coroutine=wrapped_async,
        args_schema=new_schema,
    )
    return wrapped_tool


def _inject_user_id_into_gmail_tools(tools: list, user_id: str) -> list:
    """
    For any Gmail tool in the list, wrap it to auto-inject user_id.
    Non-Gmail tools pass through unchanged.
    """
    result = []
    for tool in tools:
        if tool.name in GMAIL_TOOL_NAMES:
            wrapped = _wrap_gmail_tool_with_user_id(tool, user_id)
            result.append(wrapped)
            logger.info("  Wrapped Gmail tool '%s' with user_id injection", tool.name)
        else:
            result.append(tool)
    return result


@asynccontextmanager
async def get_mcp_tools(mcps: list, user_id: str = None):
    """
    Async context manager that yields a list of LangChain-compatible tools
    loaded from the given MCP servers.

    If user_id is provided, Gmail tools will be wrapped to auto-inject it.

    Usage:
        async with get_mcp_tools(connected_mcps, user_id="...") as tools:
            # use tools in agent
    """
    if not mcps:
        yield []
        return

    server_config = build_server_config(mcps)
    logger.info("Connecting to MCP servers: %s", list(server_config.keys()))

    tools = []
    try:
        client = MultiServerMCPClient(server_config)
        tools = await client.get_tools()
        tools = _sanitize_tools(tools)
        logger.info("Loaded %d tools from %d MCP server(s)", len(tools), len(mcps))
        for t in tools:
            logger.info("  Tool: %s", t.name)

        if user_id:
            tools = _inject_user_id_into_gmail_tools(tools, user_id)
            for t in tools:
                if t.name in GMAIL_TOOL_NAMES:
                    schema_fields = list(t.args_schema.model_fields.keys()) if t.args_schema else []
                    logger.info("  AFTER WRAP - Tool '%s' schema fields: %s", t.name, schema_fields)

    except Exception as exc:
        logger.error("Failed to load MCP tools: %s", exc)
    yield tools


async def probe_mcp(url: str, transport: str = "sse", timeout: float = 8.0) -> dict:
    """
    Probe an MCP endpoint to verify it's reachable and fetch its tool list.
    Returns {"ok": bool, "tools": [...], "error": str|None}
    """
    dummy_name = "_probe_"
    config = {dummy_name: {"url": url, "transport": transport}}
    try:
        async with asyncio.timeout(timeout):
            client = MultiServerMCPClient(config)
            tools = await client.get_tools()
            tool_names = [t.name for t in tools]
            return {"ok": True, "tools": tool_names, "error": None}
    except asyncio.TimeoutError:
        return {"ok": False, "tools": [], "error": f"Connection timed out after {timeout}s"}
    except Exception as exc:
        return {"ok": False, "tools": [], "error": str(exc)}
