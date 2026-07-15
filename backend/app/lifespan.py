"""Application lifespan hooks (startup / shutdown)."""
import asyncio
import logging
from contextlib import asynccontextmanager

from app.db.config import AsyncSessionLocal, init_db

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app):
    await init_db()
    logger.info("PostgreSQL database initialized via SQLAlchemy.")

    async def _expiry_loop():
        """Background task that checks for expired subscriptions every 6 hours."""
        from app.core.plan_guard import check_and_downgrade_expired_users

        while True:
            try:
                await asyncio.sleep(6 * 3600)
                async with AsyncSessionLocal() as db:
                    count = await check_and_downgrade_expired_users(db)
                    if count:
                        logger.info("Expiry check: downgraded %d user(s)", count)
            except asyncio.CancelledError:
                break
            except Exception:
                logger.exception("Expiry check failed")

    task = asyncio.create_task(_expiry_loop())
    yield
    task.cancel()
    logger.info("Shutting down.")
