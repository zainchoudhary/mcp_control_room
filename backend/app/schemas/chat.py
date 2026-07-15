from typing import Optional

from pydantic import BaseModel


class ChatRequest(BaseModel):
    session_id: str
    message: str
    mcp_ids: Optional[list[str]] = None
    attachment_ids: Optional[list[str]] = None
    ghost_mode: bool = False
    ghost_history: Optional[list[dict]] = None
