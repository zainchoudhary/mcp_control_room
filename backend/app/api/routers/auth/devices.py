"""Device registration and management endpoints."""
import logging

from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.auth_database import list_user_devices, register_user_device
from app.core.auth_models import RegisterDeviceRequest
from app.core.auth_utils import create_access_token, get_current_user
from app.db.config import get_db
from app.db.models import UserDevice

from .router import router

logger = logging.getLogger(__name__)


@router.get("/account/devices")
async def account_devices(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List devices that have signed in to this account."""
    devices = await list_user_devices(db, current_user["id"])
    return {"devices": devices}


@router.post("/account/devices", status_code=200)
async def register_device(
    body: RegisterDeviceRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Register or refresh the current browser/device for this account."""
    device = await register_user_device(
        db,
        current_user["id"],
        body.client_device_id,
        body.label,
        body.user_agent,
    )
    token = create_access_token(current_user["id"], body.client_device_id)
    return {"device": device, "access_token": token, "token_type": "bearer"}


@router.delete("/account/devices/{device_id}")
async def remove_device(
    device_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a registered device; tokens bound to that device will be rejected."""
    result = await db.execute(
        select(UserDevice).where(
            UserDevice.id == device_id,
            UserDevice.user_id == current_user["id"],
        )
    )
    device_row = result.scalar_one_or_none()
    if not device_row:
        raise HTTPException(status_code=404, detail="Device not found.")
    revoked_client_id = device_row.client_device_id
    await db.delete(device_row)
    await db.commit()
    return {
        "message": "Device removed. That device has been signed out.",
        "revoked_client_device_id": revoked_client_id,
    }
