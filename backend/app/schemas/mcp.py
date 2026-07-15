from typing import Optional

from pydantic import BaseModel


class MCPCreate(BaseModel):
    name: str
    url: str
    transport: str = "sse"
    description: Optional[str] = None
    icon: Optional[str] = None


class ToolExecuteRequest(BaseModel):
    args: dict = {}
