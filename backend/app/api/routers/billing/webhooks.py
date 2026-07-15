"""Stripe webhook handlers and subscription expiry check."""
import logging
from datetime import datetime, timezone

import stripe
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.config import AsyncSessionLocal
from app.db.models import User
from app.core.plan_guard import check_and_downgrade_expired_users

from .deps import WEBHOOK_SECRET

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/billing", tags=["billing"])


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


@router.post("/check-expiry")
async def check_expiry():
    """
    Cron-safe endpoint: scans all paid users and downgrades expired subscriptions.
    Can be called periodically by a scheduler or external cron service.
    """
    async with AsyncSessionLocal() as db:
        count = await check_and_downgrade_expired_users(db)
    return {"downgraded": count}


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
