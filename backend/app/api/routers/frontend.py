"""Frontend SPA static file serving."""
from fastapi import APIRouter
from fastapi.responses import FileResponse

router = APIRouter(include_in_schema=False)


@router.get("/")
@router.get("/dashboard")
@router.get("/mcp-servers")
@router.get("/tool-execution")
@router.get("/chat")
@router.get("/pricing")
@router.get("/settings")
@router.get("/login")
@router.get("/signup")
@router.get("/forgot-password")
@router.get("/reset-password")
async def serve_frontend():
    return FileResponse("../frontend/dist/index.html")
