"""MCP registry CRUD endpoints."""
import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.mcp import MCPCreate
from app.core.auth_utils import get_current_user
from app.db.database import delete_mcp, get_mcp, list_mcps, register_mcp
from app.db.config import get_db
from app.services.mcp_manager import probe_mcp
from app.core.plan_guard import check_mcp_register_limit

from .helpers import attach_reachability, mcp_base_url, prune_unreachable_mcps

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/mcps", tags=["MCP Registry"])


@router.get("")
async def list_mcps_endpoint(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    mcps = await list_mcps(db, user["id"])
    mcps, _pruned = await prune_unreachable_mcps(db, user["id"], mcps)
    mcps = await attach_reachability(mcps)
    return mcps


@router.post("", status_code=201)
async def register_mcp_endpoint(
    body: MCPCreate,
    user: dict = Depends(check_mcp_register_limit),
    db: AsyncSession = Depends(get_db),
):
    existing = await list_mcps(db, user["id"])
    if any(m["name"] == body.name for m in existing):
        raise HTTPException(status_code=409, detail=f"MCP with name '{body.name}' already exists.")

    url = body.url.rstrip("/")
    if body.transport == "sse" and not url.endswith("/sse"):
        url += "/sse"

    probe_result = await probe_mcp(url, body.transport)
    if not probe_result["ok"]:
        raise HTTPException(
            status_code=422,
            detail="Server unreachable. Please check the URL and ensure the server is running.",
        )

    mcp = await register_mcp(db, user["id"], body.name, url, body.transport, body.description, body.icon)
    return mcp


@router.get("/{mcp_id}")
async def get_mcp_endpoint(
    mcp_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    mcp = await get_mcp(db, mcp_id, user["id"])
    if not mcp:
        raise HTTPException(status_code=404, detail="MCP not found.")
    return mcp


@router.delete("/{mcp_id}", status_code=204)
async def delete_mcp_endpoint(
    mcp_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    mcp = await get_mcp(db, mcp_id, user["id"])
    if not mcp:
        raise HTTPException(status_code=404, detail="MCP not found.")

    base = mcp_base_url(mcp["url"])
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            await client.post(f"{base}/auth/revoke", params={"user_id": user["id"]})
    except Exception:
        logger.debug("Auth revoke skipped for %s (server unreachable)", mcp.get("name", mcp_id))

    await delete_mcp(db, mcp_id, user["id"])
