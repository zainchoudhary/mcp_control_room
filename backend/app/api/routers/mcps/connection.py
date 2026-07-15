"""MCP connection management endpoints."""
import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_utils import get_current_user
from app.db.database import get_mcp, set_mcp_connection, set_mcp_requires_reauth
from app.db.config import get_db
from app.services.mcp_manager import probe_mcp
from app.core.plan_guard import check_mcp_connect_limit

from .helpers import mcp_base_url, revoke_mcp_auth

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/mcps", tags=["MCP Registry"])


@router.post("/{mcp_id}/connect")
async def connect_mcp(
    mcp_id: str,
    skip_auth: bool = False,
    user: dict = Depends(check_mcp_connect_limit),
    db: AsyncSession = Depends(get_db),
):
    mcp = await get_mcp(db, mcp_id, user["id"])
    if not mcp:
        raise HTTPException(status_code=404, detail="MCP not found.")

    probe_result = await probe_mcp(mcp["url"], mcp.get("transport", "sse"))
    if not probe_result["ok"]:
        raise HTTPException(
            status_code=422,
            detail="Server unreachable. Please ensure the MCP server is running.",
        )

    base = mcp_base_url(mcp["url"])
    force_fresh_auth = bool(mcp.get("requires_reauth"))

    if force_fresh_auth:
        await revoke_mcp_auth(base, user["id"])
        await set_mcp_requires_reauth(db, mcp_id, user["id"], False)

    try:
        async with httpx.AsyncClient(timeout=8) as client:
            if force_fresh_auth and not skip_auth:
                url_resp = await client.get(f"{base}/auth/url", params={"user_id": user["id"]})
                if url_resp.status_code == 200:
                    auth_data = url_resp.json()
                    return {
                        "id": mcp_id,
                        "connected": False,
                        "needs_auth": True,
                        "auth_url": auth_data.get("auth_url", ""),
                    }
                if url_resp.status_code not in (404, 405):
                    raise HTTPException(
                        status_code=422,
                        detail="Could not start authentication. Please try again.",
                    )

            resp = await client.get(f"{base}/auth/status", params={"user_id": user["id"]})
            if resp.status_code == 200:
                data = resp.json()
                if not data.get("authenticated"):
                    if skip_auth:
                        raise HTTPException(
                            status_code=422,
                            detail="Authentication was not completed. Please try connecting again.",
                        )
                    url_resp = await client.get(f"{base}/auth/url", params={"user_id": user["id"]})
                    if url_resp.status_code == 200:
                        auth_data = url_resp.json()
                        return {
                            "id": mcp_id,
                            "connected": False,
                            "needs_auth": True,
                            "auth_url": auth_data.get("auth_url", ""),
                        }
                    raise HTTPException(
                        status_code=422,
                        detail="Could not start authentication. Please try again.",
                    )
    except HTTPException:
        raise
    except httpx.RequestError:
        raise HTTPException(
            status_code=422,
            detail="Server unreachable. Please ensure the MCP server is running.",
        )
    except Exception as e:
        logging.warning("Auth check for MCP %s failed: %s", mcp_id, e)

    await set_mcp_connection(db, mcp_id, user["id"], True)
    return {"id": mcp_id, "connected": True}


@router.post("/{mcp_id}/disconnect")
async def disconnect_mcp(
    mcp_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    mcp = await get_mcp(db, mcp_id, user["id"])
    if not mcp:
        raise HTTPException(status_code=404, detail="MCP not found.")

    base = mcp_base_url(mcp["url"])
    await revoke_mcp_auth(base, user["id"])

    await set_mcp_connection(db, mcp_id, user["id"], False)
    await set_mcp_requires_reauth(db, mcp_id, user["id"], True)
    return {"id": mcp_id, "connected": False}


@router.post("/{mcp_id}/toggle")
async def toggle_mcp(
    mcp_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Toggle MCP connection on/off. Used by chat panel."""
    mcp = await get_mcp(db, mcp_id, user["id"])
    if not mcp:
        raise HTTPException(status_code=404, detail="MCP not found.")

    if mcp.get("connected"):
        base = mcp_base_url(mcp["url"])
        await revoke_mcp_auth(base, user["id"])
        await set_mcp_connection(db, mcp_id, user["id"], False)
        await set_mcp_requires_reauth(db, mcp_id, user["id"], True)
        return {"id": mcp_id, "connected": False}

    probe_result = await probe_mcp(mcp["url"], mcp.get("transport", "sse"))
    if not probe_result["ok"]:
        raise HTTPException(
            status_code=422,
            detail="Server unreachable. Please ensure the MCP server is running.",
        )

    if mcp.get("requires_reauth"):
        raise HTTPException(
            status_code=422,
            detail="Server was offline. Reconnect from MCP Servers to sign in again.",
        )

    await set_mcp_connection(db, mcp_id, user["id"], True)
    return {"id": mcp_id, "connected": True}
