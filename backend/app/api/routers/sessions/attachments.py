"""Session attachment upload and download endpoints."""
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_utils import get_current_user
from app.services.attachments import (
    delete_attachment,
    get_attachment_file,
    list_attachments,
    save_attachment,
    verify_session_owner,
)
from app.db.config import get_db

router = APIRouter(prefix="/api/sessions", tags=["Session Attachments"])


@router.get("/{session_id}/attachments")
async def list_session_attachments(
    session_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_session_owner(db, session_id, user["id"])
    return list_attachments(user["id"], session_id)


@router.post("/{session_id}/attachments")
async def upload_attachment(
    session_id: str,
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_session_owner(db, session_id, user["id"])
    return await save_attachment(user["id"], session_id, file)


@router.delete("/{session_id}/attachments/{attachment_id}", status_code=204)
async def delete_session_attachment(
    session_id: str,
    attachment_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_session_owner(db, session_id, user["id"])
    if not delete_attachment(user["id"], session_id, attachment_id):
        raise HTTPException(status_code=404, detail="Attachment not found.")


@router.get("/{session_id}/attachments/{attachment_id}/file")
async def download_attachment_file(
    session_id: str,
    attachment_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_session_owner(db, session_id, user["id"])
    path, mime = get_attachment_file(user["id"], session_id, attachment_id)
    return FileResponse(path, media_type=mime, filename=path.name.split("_", 1)[-1])
