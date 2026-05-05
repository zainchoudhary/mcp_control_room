"""
mcp_manager.py - Manages live MCP client connections and tool resolution.
Uses langchain-mcp-adapters MultiServerMCPClient for SSE/stdio transports.
"""
import asyncio
import logging
from typing import Optional
from contextlib import asynccontextmanager

from langchain_mcp_adapters.client import MultiServerMCPClient

logger = logging.getLogger(__name__)


def build_server_config(mcps: list) -> dict:
    """
    Convert DB MCP rows into MultiServerMCPClient config dict.
    Supports 'sse' and 'streamable_http' transports.
    """
    config = {}
    for mcp in mcps:
        transport = mcp.get("transport", "sse")
        entry: dict = {"url": mcp["url"], "transport": transport}
        # Pass extra headers / timeout if needed in future
        config[mcp["name"]] = entry
    return config


@asynccontextmanager
async def get_mcp_tools(mcps: list):
    """
    Async context manager that yields a list of LangChain-compatible tools
    loaded from the given MCP servers.

    Usage:
        async with get_mcp_tools(connected_mcps) as tools:
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
        logger.info("Loaded %d tools from %d MCP server(s)", len(tools), len(mcps))
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
