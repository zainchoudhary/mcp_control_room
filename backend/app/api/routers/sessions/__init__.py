"""Session API routers."""

from fastapi import APIRouter

from .attachments import router as attachments_router
from .crud import router as crud_router
from .export import router as export_router

router = APIRouter()
router.include_router(export_router)
router.include_router(crud_router)
router.include_router(attachments_router)

__all__ = ["router"]
