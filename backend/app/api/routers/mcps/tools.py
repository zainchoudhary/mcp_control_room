"""Direct MCP tool execution endpoint."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.mcp import ToolExecuteRequest
from app.core.auth_utils import get_current_user
from app.db.database import get_mcp
from app.db.config import get_db
from app.services.mcp_manager import execute_tool
from app.core.plan_guard import check_tool_execution_access

router = APIRouter(prefix="/api/mcps", tags=["MCP Tools"])


@router.post("/{mcp_id}/tools/{tool_name}/execute")
async def execute_tool_endpoint(
    mcp_id: str,
    tool_name: str,
    body: ToolExecuteRequest,
    user: dict = Depends(check_tool_execution_access),
    db: AsyncSession = Depends(get_db),
):
    """Directly invoke a single tool on the MCP server (bypasses the agent). Pro+ only."""
    mcp = await get_mcp(db, mcp_id, user["id"])
    if not mcp:
        raise HTTPException(status_code=404, detail="MCP not found.")
    if not mcp.get("connected"):
        raise HTTPException(status_code=400, detail="MCP is not connected.")

    result = await execute_tool(mcp, tool_name, body.args, user_id=str(user["id"]))
    if not result["ok"]:
        raise HTTPException(status_code=422, detail=result["error"])
    return result
