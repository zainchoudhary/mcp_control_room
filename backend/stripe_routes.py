"""
stripe_routes.py - Stripe subscription management endpoints.
"""
import os
import logging
from datetime import datetime, timezone

import stripe
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db_config import get_db, AsyncSessionLocal
from db_models import User
from auth_utils import get_current_user
from plan_guard import PLAN_LIMITS, get_limits, get_usage_stats, check_and_downgrade_expired_users

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/billing", tags=["billing"])

stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")
WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

PLAN_PRICES = {
    "pro": os.getenv("STRIPE_PRICE_PRO", ""),
    "enterprise": os.getenv("STRIPE_PRICE_ENTERPRISE", ""),
}


async def _get_user_row(db: AsyncSession, user_id: str) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


async def _ensure_stripe_customer(db: AsyncSession, user: User) -> str:
    """Get or create a Stripe customer for the user."""
    if user.stripe_customer_id:
        return user.stripe_customer_id

    customer = stripe.Customer.create(
        email=user.email,
        name=user.full_name or user.username,
        metadata={"user_id": user.id},
    )
    user.stripe_customer_id = customer.id
    await db.commit()
    return customer.id


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


@router.get("/subscription")
async def get_subscription(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the current user's subscription status with usage data."""
    row = await _get_user_row(db, user["id"])
    plan = row.plan or "free"
    usage = await get_usage_stats(db, user["id"], plan)
    return {
        "plan": plan,
        "status": row.subscription_status or "inactive",
        "subscription_id": row.subscription_id,
        "end_date": row.subscription_end_date.isoformat() if row.subscription_end_date else None,
        "limits": get_limits(plan),
        "usage": usage,
    }


@router.get("/usage")
async def get_usage(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return current usage stats for the authenticated user."""
    plan = user.get("plan", "free")
    usage = await get_usage_stats(db, user["id"], plan)
    return {"plan": plan, "usage": usage}


@router.post("/checkout")
async def create_checkout_session(
    body: dict,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a Stripe Checkout Session for subscription."""
    plan_id = body.get("plan")
    if plan_id not in PLAN_PRICES or not PLAN_PRICES[plan_id]:
        raise HTTPException(status_code=400, detail="Invalid plan selected")

    row = await _get_user_row(db, user["id"])
    customer_id = await _ensure_stripe_customer(db, row)

    try:
        session = stripe.checkout.Session.create(
            customer=customer_id,
            mode="subscription",
            line_items=[{"price": PLAN_PRICES[plan_id], "quantity": 1}],
            success_url=f"{FRONTEND_URL}/dashboard?checkout=success",
            cancel_url=f"{FRONTEND_URL}/pricing?checkout=cancelled",
            metadata={"user_id": user["id"], "plan": plan_id},
            subscription_data={"metadata": {"user_id": user["id"], "plan": plan_id}},
        )
        return {"url": session.url}
    except stripe.StripeError as e:
        logger.error("Stripe checkout error: %s", e)
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/portal")
async def create_portal_session(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a Stripe Customer Portal session for managing subscription."""
    row = await _get_user_row(db, user["id"])
    if not row.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No active subscription to manage")

    try:
        session = stripe.billing_portal.Session.create(
            customer=row.stripe_customer_id,
            return_url=f"{FRONTEND_URL}/dashboard",
        )
        return {"url": session.url}
    except stripe.StripeError as e:
        logger.error("Stripe portal error: %s", e)
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, WEBHOOK_SECRET)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    event_type = event["type"]
    raw = event["data"]["object"]
    data = raw.to_dict() if hasattr(raw, "to_dict") else (dict(raw) if not isinstance(raw, dict) else raw)
    logger.info("Stripe webhook: %s", event_type)

    async with AsyncSessionLocal() as db:
        if event_type == "checkout.session.completed":
            await _handle_checkout_completed(db, data)

        elif event_type == "customer.subscription.updated":
            await _handle_subscription_updated(db, data)

        elif event_type == "customer.subscription.deleted":
            await _handle_subscription_deleted(db, data)

        elif event_type == "invoice.payment_failed":
            await _handle_payment_failed(db, data)

        elif event_type == "invoice.payment_succeeded":
            await _handle_payment_succeeded(db, data)

    return JSONResponse(content={"status": "ok"})


async def _handle_checkout_completed(db: AsyncSession, session_data: dict):
    """Activate subscription after successful checkout."""
    customer_id = session_data.get("customer")
    subscription_id = session_data.get("subscription")
    metadata = session_data.get("metadata", {})
    plan = metadata.get("plan", "pro")

    result = await db.execute(
        select(User).where(User.stripe_customer_id == customer_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        logger.warning("Checkout completed for unknown customer: %s", customer_id)
        return

    user.subscription_id = subscription_id
    user.subscription_status = "active"
    user.plan = plan

    if subscription_id:
        try:
            sub_obj = stripe.Subscription.retrieve(subscription_id)
            sub_dict = sub_obj.to_dict() if hasattr(sub_obj, "to_dict") else dict(sub_obj)
            cpe = sub_dict.get("current_period_end")
            if cpe:
                user.subscription_end_date = datetime.fromtimestamp(cpe, tz=timezone.utc)
        except Exception:
            pass

    await db.commit()
    logger.info("Subscription activated: user=%s plan=%s", user.id, plan)


async def _handle_subscription_updated(db: AsyncSession, sub_data: dict):
    """Handle subscription changes (upgrade, downgrade, renewal)."""
    sub_id = sub_data.get("id")
    status = sub_data.get("status", "active")
    customer_id = sub_data.get("customer")
    metadata = sub_data.get("metadata", {})
    plan = metadata.get("plan")

    current_period_end = sub_data.get("current_period_end")
    end_date = datetime.fromtimestamp(current_period_end, tz=timezone.utc) if current_period_end else None

    result = await db.execute(
        select(User).where(User.stripe_customer_id == customer_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        return

    user.subscription_id = sub_id
    user.subscription_status = status
    if plan:
        user.plan = plan
    if end_date:
        user.subscription_end_date = end_date
    await db.commit()
    logger.info("Subscription updated: user=%s status=%s plan=%s", user.id, status, plan)


async def _handle_subscription_deleted(db: AsyncSession, sub_data: dict):
    """Downgrade user to free when subscription is cancelled/expired."""
    customer_id = sub_data.get("customer")

    result = await db.execute(
        select(User).where(User.stripe_customer_id == customer_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        return

    user.subscription_id = None
    user.subscription_status = "inactive"
    user.plan = "free"
    user.subscription_end_date = None
    await db.commit()
    logger.info("Subscription cancelled: user=%s downgraded to free", user.id)


async def _handle_payment_failed(db: AsyncSession, invoice_data: dict):
    """Mark subscription as past_due on payment failure."""
    customer_id = invoice_data.get("customer")

    result = await db.execute(
        select(User).where(User.stripe_customer_id == customer_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        return

    user.subscription_status = "past_due"
    await db.commit()
    logger.info("Payment failed: user=%s marked as past_due", user.id)


async def _handle_payment_succeeded(db: AsyncSession, invoice_data: dict):
    """Restore subscription to active after a successful payment (recovers from past_due)."""
    customer_id = invoice_data.get("customer")
    subscription_id = invoice_data.get("subscription")

    result = await db.execute(
        select(User).where(User.stripe_customer_id == customer_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        return

    if user.subscription_status in ("past_due", "unpaid"):
        user.subscription_status = "active"
        logger.info("Payment succeeded: user=%s restored to active", user.id)

    if subscription_id:
        try:
            sub_obj = stripe.Subscription.retrieve(subscription_id)
            sub_dict = sub_obj.to_dict() if hasattr(sub_obj, "to_dict") else dict(sub_obj)
            cpe = sub_dict.get("current_period_end")
            if cpe:
                user.subscription_end_date = datetime.fromtimestamp(cpe, tz=timezone.utc)
        except Exception:
            pass

    await db.commit()


@router.post("/check-expiry")
async def check_expiry():
    """
    Cron-safe endpoint: scans all paid users and downgrades expired subscriptions.
    Can be called periodically by a scheduler or external cron service.
    """
    async with AsyncSessionLocal() as db:
        count = await check_and_downgrade_expired_users(db)
    return {"downgraded": count}


def get_user_limits(plan: str) -> dict:
    """Return the resource limits for a given plan."""
    return get_limits(plan)
