"""Billing plans listing endpoint."""
from fastapi import APIRouter

from app.core.plan_guard import PLAN_LIMITS

from .deps import PLAN_PRICES

router = APIRouter(prefix="/api/billing", tags=["billing"])


@router.get("/plans")
async def get_plans():
    """Return available plans with their features and limits."""
    return {
        "plans": [
            {
                "id": "free",
                "name": "Free",
                "price": 0,
                "interval": "month",
                "features": [
                    f"Up to {PLAN_LIMITS['free']['mcps']} MCP servers",
                    f"{PLAN_LIMITS['free']['messages_per_day']} messages/day",
                    f"{PLAN_LIMITS['free']['sessions_per_month']} chat sessions/month",
                    "Basic AI agent",
                    "Community support",
                ],
                "limits": PLAN_LIMITS["free"],
                "popular": False,
            },
            {
                "id": "pro",
                "name": "Pro",
                "price": 10,
                "interval": "month",
                "stripe_price_id": PLAN_PRICES["pro"],
                "features": [
                    f"Up to {PLAN_LIMITS['pro']['mcps']} MCP servers",
                    f"{PLAN_LIMITS['pro']['messages_per_day']} messages/day",
                    f"{PLAN_LIMITS['pro']['sessions_per_month']} chat sessions/month",
                    "Advanced AI agent",
                    "Priority support",
                    "Tool execution history",
                ],
                "limits": PLAN_LIMITS["pro"],
                "popular": True,
            },
            {
                "id": "enterprise",
                "name": "Enterprise",
                "price": 30,
                "interval": "month",
                "stripe_price_id": PLAN_PRICES["enterprise"],
                "features": [
                    "Unlimited MCP servers",
                    "Unlimited messages",
                    "Unlimited chat sessions",
                    "Premium AI agent",
                    "Dedicated support",
                    "Custom integrations",
                    "API access",
                ],
                "limits": PLAN_LIMITS["enterprise"],
                "popular": False,
            },
        ]
    }
