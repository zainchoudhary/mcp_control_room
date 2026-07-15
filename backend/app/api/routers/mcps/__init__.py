"""MCP API routers."""

from fastapi import APIRouter

from .auth_proxy import router as auth_proxy_router
from .connection import router as connection_router
from .probe import router as probe_router
from .registry import router as registry_router
from .tools import router as tools_router

router = APIRouter()
router.include_router(registry_router)
router.include_router(connection_router)
router.include_router(probe_router)
router.include_router(auth_proxy_router)
router.include_router(tools_router)

__all__ = ["router"]
