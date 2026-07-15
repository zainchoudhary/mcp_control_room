"""Billing API routers."""

from fastapi import APIRouter

from .checkout import router as checkout_router
from .plans import router as plans_router
from .subscription import router as subscription_router
from .webhooks import router as webhooks_router

router = APIRouter()
router.include_router(plans_router)
router.include_router(subscription_router)
router.include_router(checkout_router)
router.include_router(webhooks_router)

__all__ = ["router"]
