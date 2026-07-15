"""Generic MCP OAuth auth proxy endpoints."""
import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_utils import get_current_user
from app.db.database import get_mcp
from app.db.config import get_db

from .helpers import mcp_base_url

router = APIRouter(prefix="/api/mcps", tags=["MCP Auth"])


@router.get("/{mcp_id}/auth/url")
async def mcp_auth_url(
    mcp_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get OAuth URL from MCP server. Passes user_id so the MCP can track per-user tokens."""
    mcp = await get_mcp(db, mcp_id, user["id"])
    if not mcp:
        raise HTTPException(status_code=404, detail="MCP not found.")

    base = mcp_base_url(mcp["url"])
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{base}/auth/url", params={"user_id": user["id"]})
            if resp.status_code != 200:
                raise HTTPException(status_code=502, detail="MCP server auth endpoint unreachable.")
            return resp.json()
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Cannot reach MCP auth: {e}")


@router.get("/{mcp_id}/auth/status")
async def mcp_auth_status(
    mcp_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check if the current user is authenticated on this MCP server."""
    mcp = await get_mcp(db, mcp_id, user["id"])
    if not mcp:
        raise HTTPException(status_code=404, detail="MCP not found.")

    base = mcp_base_url(mcp["url"])
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{base}/auth/status", params={"user_id": user["id"]})
            if resp.status_code != 200:
                return {"authenticated": False, "email": None}
            return resp.json()
    except httpx.RequestError:
        return {"authenticated": False, "email": None}


@router.post("/{mcp_id}/auth/revoke")
async def mcp_auth_revoke(
    mcp_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke auth for the current user on this MCP server."""
    mcp = await get_mcp(db, mcp_id, user["id"])
    if not mcp:
        raise HTTPException(status_code=404, detail="MCP not found.")

    base = mcp_base_url(mcp["url"])
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(f"{base}/auth/revoke", params={"user_id": user["id"]})
            return resp.json()
    except httpx.RequestError:
        return {"revoked": False}
