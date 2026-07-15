"""MCP server helper utilities."""
import asyncio
import logging

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import disconnect_mcps, list_mcps
from app.db.config import AsyncSessionLocal
from app.services.mcp_manager import probe_mcp

logger = logging.getLogger(__name__)


def mcp_base_url(mcp_url: str) -> str:
    """Extract base URL from MCP SSE endpoint (strip /sse suffix)."""
    url = mcp_url.rstrip("/")
    if url.endswith("/sse"):
        url = url[:-4]
    return url


async def revoke_mcp_auth(base: str, user_id: str) -> None:
    """Revoke OAuth credentials on the MCP server (best-effort)."""
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            await client.post(f"{base}/auth/revoke", params={"user_id": user_id})
    except Exception:
        logger.debug("Auth revoke skipped for user %s (server unreachable)", user_id[:8])


async def prune_unreachable_mcps(
    db: AsyncSession,
    user_id: str,
    mcps: list,
    *,
    probe_timeout: float = 5.0,
) -> tuple[list, list[dict]]:
    """
    Probe connected MCP backends; auto-disconnect any that are down.
    Returns (updated_mcp_list, pruned_server_info).
    """
    connected = [m for m in mcps if m.get("connected")]
    if not connected:
        return mcps, []

    probe_results = await asyncio.gather(
        *[
            probe_mcp(m["url"], m.get("transport", "sse"), timeout=probe_timeout)
            for m in connected
        ],
        return_exceptions=True,
    )

    failed_ids: list[str] = []
    pruned: list[dict] = []
    for mcp, result in zip(connected, probe_results):
        ok = isinstance(result, dict) and result.get("ok")
        if ok:
            continue
        mcp_id = mcp.get("id")
        if not mcp_id:
            continue
        failed_ids.append(mcp_id)
        err = result.get("error") if isinstance(result, dict) else str(result)
        pruned.append({"id": mcp_id, "name": mcp.get("name", mcp_id), "error": err or "unreachable"})
        logger.info("Auto-disconnect MCP '%s' — backend unreachable", mcp.get("name", mcp_id))

    if failed_ids:
        await disconnect_mcps(db, user_id, failed_ids)
        mcps = await list_mcps(db, user_id)

    return mcps, pruned


async def attach_reachability(
    mcps: list,
    *,
    probe_timeout: float = 5.0,
) -> list:
    """Probe each MCP and add reachable=True/False to the response."""
    if not mcps:
        return mcps

    probe_results = await asyncio.gather(
        *[
            probe_mcp(m["url"], m.get("transport", "sse"), timeout=probe_timeout)
            for m in mcps
        ],
        return_exceptions=True,
    )

    enriched = []
    for mcp, result in zip(mcps, probe_results):
        entry = dict(mcp)
        entry["reachable"] = isinstance(result, dict) and result.get("ok", False)
        enriched.append(entry)
    return enriched


async def disconnect_mcp_failures(user_id: str, failures: list[dict]) -> list[dict]:
    """Disconnect MCPs that failed tool load; return disconnected server summaries."""
    ids = [f["id"] for f in failures if f.get("id")]
    if not ids:
        return []
    async with AsyncSessionLocal() as db:
        disconnected_ids = await disconnect_mcps(db, user_id, ids)
    if not disconnected_ids:
        return []
    disconnected_set = set(disconnected_ids)
    return [
        {"id": f["id"], "name": f.get("name", f["id"])}
        for f in failures
        if f.get("id") in disconnected_set
    ]
