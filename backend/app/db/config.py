"""
db_config.py - SQLAlchemy async engine + session factory for PostgreSQL (Neon).
"""
import os
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://neondb_owner:npg_XwLWA9Omu4jF@ep-lively-waterfall-ani227tu-pooler.c-6.us-east-1.aws.neon.tech/neondb?ssl=require",
)

engine = create_async_engine(DATABASE_URL, echo=False, pool_pre_ping=True, pool_size=5)

AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def init_db():
    """Create all tables in PostgreSQL."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db() -> AsyncSession:
    """FastAPI dependency - yields a session then closes it."""
    async with AsyncSessionLocal() as session:
        yield session
