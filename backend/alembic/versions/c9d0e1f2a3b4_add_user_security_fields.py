"""add_user_security_fields

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-05-22 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = 'c9d0e1f2a3b4'
down_revision: Union[str, Sequence[str], None] = 'b8c9d0e1f2a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_SECURITY_COLUMNS = (
    ('recovery_email', sa.String(length=255), True, None),
    ('totp_secret', sa.String(length=64), True, None),
    ('totp_enabled', sa.Boolean(), False, 'false'),
    ('lock_pin_hash', sa.String(length=255), True, None),
)


def upgrade() -> None:
    bind = op.get_bind()
    existing = {c['name'] for c in inspect(bind).get_columns('users')}
    for name, col_type, nullable, server_default in _SECURITY_COLUMNS:
        if name in existing:
            continue
        op.add_column(
            'users',
            sa.Column(name, col_type, nullable=nullable, server_default=server_default),
        )


def downgrade() -> None:
    op.drop_column('users', 'lock_pin_hash')
    op.drop_column('users', 'totp_enabled')
    op.drop_column('users', 'totp_secret')
    op.drop_column('users', 'recovery_email')
