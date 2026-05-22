"""
auth_models.py - Pydantic request/response models with full validation.
"""
import re
from pydantic import BaseModel, field_validator


class SignupRequest(BaseModel):
    username: str
    email: str
    password: str
    confirm_password: str
    full_name: str | None = None

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Username must be at least 3 characters long.")
        if len(v) > 30:
            raise ValueError("Username must not exceed 30 characters.")
        if not re.match(r"^[a-zA-Z][a-zA-Z0-9._-]*$", v):
            raise ValueError(
                "Username must start with a letter and contain only letters, "
                "numbers, dots, hyphens, or underscores."
            )
        return v

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
        if not re.match(pattern, v):
            raise ValueError("Please enter a valid email address.")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        if len(v) > 128:
            raise ValueError("Password must not exceed 128 characters.")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter.")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter.")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit.")
        if not re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?~`]", v):
            raise ValueError("Password must contain at least one special character.")
        return v

    @field_validator("confirm_password")
    @classmethod
    def validate_confirm_password(cls, v: str, info) -> str:
        password = info.data.get("password")
        if password and v != password:
            raise ValueError("Passwords do not match.")
        return v

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if v and len(v) > 100:
            raise ValueError("Full name must not exceed 100 characters.")
        return v or None


class LoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not v:
            raise ValueError("Email is required.")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not v:
            raise ValueError("Password is required.")
        return v


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class ForgotPasswordRequest(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not v:
            raise ValueError("Email is required.")
        pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
        if not re.match(pattern, v):
            raise ValueError("Please enter a valid email address.")
        return v


class ResetPasswordRequest(BaseModel):
    token: str
    password: str
    confirm_password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        if len(v) > 128:
            raise ValueError("Password must not exceed 128 characters.")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter.")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter.")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit.")
        if not re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?~`]", v):
            raise ValueError("Password must contain at least one special character.")
        return v

    @field_validator("confirm_password")
    @classmethod
    def validate_confirm_password(cls, v: str, info) -> str:
        password = info.data.get("password")
        if password and v != password:
            raise ValueError("Passwords do not match.")
        return v


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str

    @field_validator("current_password")
    @classmethod
    def validate_current_password(cls, v: str) -> str:
        if not v:
            raise ValueError("Current password is required.")
        return v

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str, info) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        if len(v) > 128:
            raise ValueError("Password must not exceed 128 characters.")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter.")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter.")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit.")
        if not re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?~`]", v):
            raise ValueError("Password must contain at least one special character.")
        current = info.data.get("current_password")
        if current and v == current:
            raise ValueError("New password must be different from your current password.")
        return v

    @field_validator("confirm_password")
    @classmethod
    def validate_confirm_password(cls, v: str, info) -> str:
        password = info.data.get("new_password")
        if password and v != password:
            raise ValueError("Passwords do not match.")
        return v


class ChangeUsernameRequest(BaseModel):
    new_username: str

    @field_validator("new_username")
    @classmethod
    def validate_new_username(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Username must be at least 3 characters long.")
        if len(v) > 30:
            raise ValueError("Username must not exceed 30 characters.")
        if not re.match(r"^[a-zA-Z][a-zA-Z0-9._-]*$", v):
            raise ValueError(
                "Username must start with a letter and contain only letters, "
                "numbers, dots, hyphens, or underscores."
            )
        return v


class RegisterDeviceRequest(BaseModel):
    client_device_id: str
    label: str
    user_agent: str | None = None

    @field_validator("client_device_id")
    @classmethod
    def validate_client_device_id(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 8 or len(v) > 64:
            raise ValueError("Invalid device identifier.")
        return v

    @field_validator("label")
    @classmethod
    def validate_label(cls, v: str) -> str:
        v = v.strip()
        if not v or len(v) > 120:
            raise ValueError("Device label is required (max 120 characters).")
        return v


class DeleteAccountRequest(BaseModel):
    password: str


class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    full_name: str | None
    plan: str = "free"
    subscription_status: str = "inactive"
    subscription_end_date: str | None = None
    created_at: str
