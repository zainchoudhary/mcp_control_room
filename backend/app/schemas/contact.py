from pydantic import BaseModel


class ContactRequest(BaseModel):
    name: str
    email: str
    subject: str
    category: str
    message: str
