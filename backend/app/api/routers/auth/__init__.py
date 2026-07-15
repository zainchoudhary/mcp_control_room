"""Authentication router — aggregates all auth endpoint modules."""

from .router import router

from . import account, devices, login, password, profile, security, signup, username  # noqa: F401

__all__ = ["router"]
