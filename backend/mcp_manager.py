"""
mcp_manager.py - Manages live MCP client connections and tool resolution.
Uses langchain-mcp-adapters MultiServerMCPClient for SSE/stdio transports.

Fully generic — no MCP-specific logic. Works with any MCP server.
Injects user_id transparently into tool calls so MCP servers can
load per-user credentials without polluting the tool schema for the LLM.
"""
import asyncio
import logging
import re
from contextlib import asynccontextmanager

from langchain_mcp_adapters.client import MultiServerMCPClient

logger = logging.getLogger(__name__)

USER_ID_PARAM = "user_id"


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


def _inject_user_id(tools: list, user_id: str) -> list:
    """
    Monkey-patch MCP tools to inject user_id transparently.

    langchain-mcp-adapters tools are StructuredTool instances where
    args_schema is a plain dict (not a Pydantic class). We:
      1. Remove user_id from the schema so the LLM never sees it
      2. Patch the invoke/ainvoke methods to inject user_id at call time
    """
    if not user_id:
        return tools

    patched = []
    for tool in tools:
        args = getattr(tool, 'args', {})
        if USER_ID_PARAM not in args:
            patched.append(tool)
            continue

        logger.info("Patching tool '%s' to inject user_id=%s...", tool.name, user_id[:8])

        if isinstance(tool.args_schema, dict):
            tool.args_schema.get("properties", {}).pop(USER_ID_PARAM, None)
            req = tool.args_schema.get("required", [])
            if USER_ID_PARAM in req:
                req.remove(USER_ID_PARAM)

        original_coroutine = tool.coroutine
        original_func = tool.func

        def _make_patched_coroutine(orig_coro, uid):
            async def patched_ainvoke(**kwargs):
                kwargs[USER_ID_PARAM] = uid
                return await orig_coro(**kwargs)
            return patched_ainvoke

        def _make_patched_func(orig_fn, uid):
            def patched_invoke(**kwargs):
                kwargs[USER_ID_PARAM] = uid
                return orig_fn(**kwargs)
            return patched_invoke

        if original_coroutine:
            tool.coroutine = _make_patched_coroutine(original_coroutine, user_id)
        if original_func:
            tool.func = _make_patched_func(original_func, user_id)

        patched.append(tool)

    return patched


@asynccontextmanager
async def get_mcp_tools(mcps: list, user_id: str = ""):
    """
    Async context manager that yields a list of LangChain-compatible tools
    loaded from the given MCP servers.

    If user_id is provided, it is injected transparently into all tool calls
    that accept a user_id parameter (hidden from the LLM schema).

    Usage:
        async with get_mcp_tools(connected_mcps, user_id="abc") as tools:
            # use tools in agent
    """
    if not mcps:
        yield []
        return

    server_config = build_server_config(mcps)
    logger.info("Connecting to MCP servers: %s (user_id=%s)", list(server_config.keys()), user_id[:8] if user_id else "EMPTY")

    tools = []
    try:
        client = MultiServerMCPClient(server_config)
        tools = await client.get_tools()
        tools = _sanitize_tools(tools)
        tools = _inject_user_id(tools, user_id)
        logger.info("Loaded %d tools from %d MCP server(s)", len(tools), len(mcps))
        for t in tools:
            logger.info("  Tool: %s", t.name)

    except Exception as exc:
        logger.error("Failed to load MCP tools: %s", exc)
    yield tools


async def probe_mcp(url: str, transport: str = "sse", timeout: float = 8.0) -> dict:
    """
    Probe an MCP endpoint to verify it's reachable and fetch its tool list.
    Returns {"ok": bool, "tools": [...], "error": str|None}
    Tools include full metadata: name, description, and JSON-Schema parameters.
    """
    dummy_name = "_probe_"
    config = {dummy_name: {"url": url, "transport": transport}}
    try:
        async with asyncio.timeout(timeout):
            client = MultiServerMCPClient(config)
            tools = await client.get_tools()
            tool_defs = []
            for t in tools:
                name = _sanitize_tool_name(getattr(t, 'name', '') or '')
                desc = getattr(t, 'description', '') or ''
                raw = getattr(t, 'args_schema', None)
                if isinstance(raw, dict):
                    schema = raw
                elif raw is not None and hasattr(raw, 'model_json_schema'):
                    schema = raw.model_json_schema()
                elif raw is not None and hasattr(raw, 'schema') and callable(raw.schema):
                    schema = raw.schema()
                else:
                    schema = {}
                schema.pop("title", None)
                schema.pop("$defs", None)
                logger.info("Probe tool: name=%s desc=%s schema_keys=%s", name, desc[:50], list(schema.keys()))
                tool_defs.append({
                    "name": name,
                    "description": desc,
                    "parameters": schema,
                })
            return {"ok": True, "tools": tool_defs, "error": None}
    except asyncio.TimeoutError:
        return {"ok": False, "tools": [], "error": f"Connection timed out after {timeout}s"}
    except Exception as exc:
        return {"ok": False, "tools": [], "error": str(exc)}


async def execute_tool(
    mcp: dict, tool_name: str, args: dict, user_id: str = "", timeout: float = 30.0,
    max_retries: int = 2,
) -> dict:
    """
    Directly invoke a single tool on an MCP server and return the result.
    Bypasses the LLM agent entirely — useful for testing tools.
    Automatically retries on transient connection errors (SSL abort, connection reset, etc.).
    """
    server_config = build_server_config([mcp])
    last_err = None

    for attempt in range(1, max_retries + 1):
        try:
            async with asyncio.timeout(timeout):
                client = MultiServerMCPClient(server_config)
                tools = await client.get_tools()
                tools = _sanitize_tools(tools)

                target = None
                for t in tools:
                    if t.name == tool_name:
                        target = t
                        break
                if not target:
                    return {"ok": False, "result": None, "error": f"Tool '{tool_name}' not found"}

                call_args = {**args}
                if user_id:
                    call_args[USER_ID_PARAM] = user_id

                raw = await target.ainvoke(call_args)
                logger.info("execute_tool raw type=%s value=%s", type(raw).__name__, repr(raw)[:500])
                return {"ok": True, "result": raw, "error": None}
        except asyncio.TimeoutError:
            return {"ok": False, "result": None, "error": f"Tool execution timed out after {timeout}s"}
        except (ConnectionError, OSError) as exc:
            last_err = exc
            logger.warning("execute_tool attempt %d/%d failed (transient): %s", attempt, max_retries, exc)
            if attempt < max_retries:
                await asyncio.sleep(0.5)
        except Exception as exc:
            last_err = exc
            err_msg = str(exc).lower()
            is_transient = any(k in err_msg for k in ("connection abort", "connection reset", "ssl", "broken pipe", "eof"))
            if is_transient and attempt < max_retries:
                logger.warning("execute_tool attempt %d/%d failed (transient): %s", attempt, max_retries, exc)
                await asyncio.sleep(0.5)
            else:
                return {"ok": False, "result": None, "error": str(exc)}

    return {"ok": False, "result": None, "error": f"Failed after {max_retries} attempts: {last_err}"}
