"""Chat session CRUD endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_utils import get_current_user
from app.db.database import (
    create_ghost_session,
    create_session,
    delete_all_user_sessions,
    delete_session,
    get_session_messages,
    list_user_sessions,
    update_session_title,
)
from app.db.config import get_db
from app.core.plan_guard import check_session_limit

router = APIRouter(prefix="/api/sessions", tags=["Sessions"])


@router.get("")
async def list_sessions(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all chat sessions for the current user."""
    return await list_user_sessions(db, user["id"])


@router.post("", status_code=201)
async def create_session_endpoint(
    user: dict = Depends(check_session_limit),
    db: AsyncSession = Depends(get_db),
):
    session = await create_session(db, user["id"])
    return session


@router.post("/ghost", status_code=201)
async def create_ghost_session_endpoint(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Ephemeral ghost chat session — not listed in sidebar, deleted when ghost mode ends."""
    session = await create_ghost_session(db, user["id"])
    return {**session, "ghost": True}


@router.delete("", status_code=200)
async def delete_all_sessions(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete all chat sessions and their messages for the current user."""
    count = await delete_all_user_sessions(db, user["id"])
    return {"deleted": count}


@router.patch("/{session_id}")
async def update_session(
    session_id: str,
    body: dict,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update session title."""
    title = body.get("title")
    if title:
        await update_session_title(db, session_id, title)
    return {"id": session_id, "title": title}


@router.delete("/{session_id}", status_code=204)
async def delete_session_endpoint(
    session_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a chat session and its messages."""
    deleted = await delete_session(db, session_id, user["id"])
    if not deleted:
        raise HTTPException(status_code=404, detail="Session not found.")


@router.get("/{session_id}/messages")
async def get_messages(
    session_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    messages = await get_session_messages(db, session_id)
    return messages
