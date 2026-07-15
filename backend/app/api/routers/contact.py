"""Public contact form endpoint."""
from fastapi import APIRouter, HTTPException

from app.schemas.contact import ContactRequest
from app.core.auth_utils import send_contact_email

router = APIRouter(tags=["Public"])


@router.post("/api/contact")
async def contact(body: ContactRequest):
    """Public contact form — sends email to admin."""
    if not body.name.strip() or not body.email.strip() or not body.subject.strip() or not body.message.strip():
        raise HTTPException(status_code=400, detail="All fields are required.")
    if body.category not in ("complaint", "feedback", "query"):
        raise HTTPException(status_code=400, detail="Invalid category.")
    try:
        send_contact_email(
            name=body.name.strip(),
            email=body.email.strip(),
            subject=body.subject.strip(),
            category=body.category,
            message=body.message.strip(),
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return {"message": "Your message has been sent. We'll get back to you soon!"}
