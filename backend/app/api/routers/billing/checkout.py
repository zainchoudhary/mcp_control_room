"""Stripe checkout, portal, and invoice endpoints."""
import logging
from datetime import datetime, timezone

import stripe
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_utils import get_current_user
from app.db.config import get_db

from .deps import FRONTEND_URL, PLAN_PRICES, ensure_stripe_customer, get_user_row

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/billing", tags=["billing"])


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

    row = await get_user_row(db, user["id"])
    customer_id = await ensure_stripe_customer(db, row)

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


@router.get("/invoices")
async def list_invoices(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return recent Stripe invoices for the authenticated user."""
    row = await get_user_row(db, user["id"])
    if not row.stripe_customer_id:
        return {"invoices": []}

    try:
        invoices = stripe.Invoice.list(customer=row.stripe_customer_id, limit=12)
        items = []
        for inv in invoices.data:
            inv_dict = inv.to_dict() if hasattr(inv, "to_dict") else dict(inv)
            created = inv_dict.get("created")
            items.append({
                "id": inv_dict.get("id", ""),
                "amount": (inv_dict.get("amount_paid") or 0) / 100,
                "currency": (inv_dict.get("currency") or "usd").upper(),
                "status": inv_dict.get("status", "unknown"),
                "date": datetime.fromtimestamp(created, tz=timezone.utc).isoformat() if created else None,
                "pdf_url": inv_dict.get("invoice_pdf"),
                "hosted_url": inv_dict.get("hosted_invoice_url"),
            })
        return {"invoices": items}
    except stripe.StripeError as e:
        logger.error("Stripe invoice list error: %s", e)
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/portal")
async def create_portal_session(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a Stripe Customer Portal session for managing subscription."""
    row = await get_user_row(db, user["id"])
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
