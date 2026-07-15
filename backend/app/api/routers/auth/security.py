"""Security settings: 2FA, recovery email, lock PIN."""
from fastapi import Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.auth_database import (
    disable_totp,
    enable_totp,
    get_security_settings,
    get_user_auth_by_id,
    set_lock_pin,
    set_recovery_email,
    set_totp_secret,
    verify_user_lock_pin,
)
from app.core.auth_models import (
    LockPinRemoveRequest,
    LockPinRequest,
    LockPinVerifyRequest,
    RecoveryEmailRequest,
    RemoveRecoveryEmailRequest,
    TotpDisableRequest,
    TotpEnableRequest,
)
from app.core.auth_utils import get_current_user
from app.db.config import get_db
from app.core.security import (
    generate_totp_secret,
    hash_pin,
    totp_provisioning_uri,
    verify_totp_code,
)

from .deps import verify_current_password
from .router import router


@router.get("/security")
async def get_security(current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Return security settings summary for the settings UI."""
    security = await get_security_settings(db, current_user["id"])
    if security is None:
        raise HTTPException(status_code=404, detail="User not found.")
    return {"security": security}


@router.put("/security/recovery-email")
async def update_recovery_email(
    body: RecoveryEmailRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_current_password(db, current_user["email"], body.password)
    if body.recovery_email == current_user["email"].lower():
        raise HTTPException(
            status_code=400,
            detail="Recovery email must be different from your account email.",
        )
    security = await set_recovery_email(db, current_user["id"], body.recovery_email)
    return {"message": "Recovery email saved.", "security": security}


@router.delete("/security/recovery-email")
async def remove_recovery_email(
    body: RemoveRecoveryEmailRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_current_password(db, current_user["email"], body.password)
    security = await set_recovery_email(db, current_user["id"], None)
    return {"message": "Recovery email removed.", "security": security}


@router.post("/security/2fa/setup")
async def setup_2fa(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a new TOTP secret (replaces any pending setup)."""
    security = await get_security_settings(db, current_user["id"])
    if security and security.get("totp_enabled"):
        raise HTTPException(status_code=400, detail="Two-factor authentication is already enabled.")

    secret = generate_totp_secret()
    await set_totp_secret(db, current_user["id"], secret)
    uri = totp_provisioning_uri(secret, current_user["email"])
    return {
        "secret": secret,
        "provisioning_uri": uri,
        "issuer": "ToolChain AI",
    }


@router.post("/security/2fa/enable")
async def enable_2fa(
    body: TotpEnableRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_current_password(db, current_user["email"], body.password)
    auth_user = await get_user_auth_by_id(db, current_user["id"])
    if not auth_user or not auth_user.get("totp_secret"):
        raise HTTPException(status_code=400, detail="Run 2FA setup first.")

    if not verify_totp_code(auth_user["totp_secret"], body.code):
        raise HTTPException(status_code=400, detail="Invalid verification code.")

    security = await enable_totp(db, current_user["id"])
    return {"message": "Two-factor authentication enabled.", "security": security}


@router.post("/security/2fa/disable")
async def disable_2fa(
    body: TotpDisableRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_current_password(db, current_user["email"], body.password)
    auth_user = await get_user_auth_by_id(db, current_user["id"])
    if not auth_user or not auth_user.get("totp_enabled"):
        raise HTTPException(status_code=400, detail="Two-factor authentication is not enabled.")

    if not verify_totp_code(auth_user["totp_secret"], body.code):
        raise HTTPException(status_code=400, detail="Invalid verification code.")

    security = await disable_totp(db, current_user["id"])
    return {"message": "Two-factor authentication disabled.", "security": security}


@router.put("/security/lock-pin")
async def update_lock_pin(
    body: LockPinRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_current_password(db, current_user["email"], body.password)
    pin_hash = hash_pin(body.pin)
    security = await set_lock_pin(db, current_user["id"], pin_hash)
    return {"message": "Website lock PIN saved.", "security": security}


@router.delete("/security/lock-pin")
async def remove_lock_pin(
    body: LockPinRemoveRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await verify_current_password(db, current_user["email"], body.password)
    security = await set_lock_pin(db, current_user["id"], None)
    return {"message": "Website lock PIN removed.", "security": security}


@router.post("/security/lock-pin/verify")
async def verify_lock_pin(
    body: LockPinVerifyRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ok = await verify_user_lock_pin(db, current_user["id"], body.pin)
    if not ok:
        raise HTTPException(status_code=400, detail="Incorrect PIN.")
    return {"verified": True}
