"""
security_utils.py - TOTP and PIN helpers.
"""
import pyotp

from app.core.auth_utils import hash_password, verify_password

APP_NAME = "ToolChain AI"


def generate_totp_secret() -> str:
    return pyotp.random_base32()


def totp_provisioning_uri(secret: str, email: str) -> str:
    return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name=APP_NAME)


def verify_totp_code(secret: str, code: str) -> bool:
    if not secret or not code:
        return False
    cleaned = "".join(c for c in code.strip() if c.isdigit())
    if len(cleaned) != 6:
        return False
    return pyotp.TOTP(secret).verify(cleaned, valid_window=1)


def hash_pin(pin: str) -> str:
    return hash_password(pin)


def verify_pin(plain_pin: str, pin_hash: str) -> bool:
    return verify_password(plain_pin, pin_hash)
