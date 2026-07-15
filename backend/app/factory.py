"""FastAPI application factory."""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routers import api_router
from app.lifespan import lifespan

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")


def create_app() -> FastAPI:
    """Build and configure the FastAPI application."""
    app = FastAPI(
        title="ToolChain AI Dashboard",
        description="Register MCP servers and chat with an AI agent that uses them as tools.",
        version="1.0.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.mount("/assets", StaticFiles(directory="../frontend/dist/assets"), name="assets")
    app.include_router(api_router)

    return app
