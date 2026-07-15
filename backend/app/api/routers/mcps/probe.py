"""MCP probe endpoint."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_utils import get_current_user
from app.db.database import get_mcp
from app.db.config import get_db
from app.services.mcp_manager import probe_mcp

router = APIRouter(prefix="/api/mcps", tags=["MCP Registry"])


@router.post("/{mcp_id}/probe")
async def probe_mcp_endpoint(
    mcp_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Probe MCP endpoint to check reachability and list available tools."""
    mcp = await get_mcp(db, mcp_id, user["id"])
    if not mcp:
        raise HTTPException(status_code=404, detail="MCP not found.")
    result = await probe_mcp(mcp["url"], mcp["transport"])
    return result
