"""Stripe billing shared dependencies."""
import os

import stripe
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import User

stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")
WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

PLAN_PRICES = {
    "pro": os.getenv("STRIPE_PRICE_PRO", ""),
    "enterprise": os.getenv("STRIPE_PRICE_ENTERPRISE", ""),
}


async def get_user_row(db: AsyncSession, user_id: str) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


async def ensure_stripe_customer(db: AsyncSession, user: User) -> str:
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
