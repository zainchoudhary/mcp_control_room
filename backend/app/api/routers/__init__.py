"""API router aggregation — mounts all domain routers."""

from fastapi import APIRouter

from app.api.routers.auth import router as auth_router
from app.api.routers.billing import router as billing_router
from app.api.routers.chat import router as chat_router
from app.api.routers.contact import router as contact_router
from app.api.routers.frontend import router as frontend_router
from app.api.routers.mcps import router as mcps_router
from app.api.routers.sessions import router as sessions_router
from app.api.routers.stats import router as stats_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(billing_router)
api_router.include_router(mcps_router)
api_router.include_router(sessions_router)
api_router.include_router(chat_router)
api_router.include_router(stats_router)
api_router.include_router(contact_router)
api_router.include_router(frontend_router)

__all__ = ["api_router"]
