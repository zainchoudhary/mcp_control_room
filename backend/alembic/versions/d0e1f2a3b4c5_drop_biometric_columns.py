"""drop_biometric_columns

Revision ID: d0e1f2a3b4c5
Revises: c9d0e1f2a3b4
Create Date: 2026-05-25 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = 'd0e1f2a3b4c5'
down_revision: Union[str, Sequence[str], None] = 'c9d0e1f2a3b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    existing = {c['name'] for c in inspect(bind).get_columns('users')}
    if 'biometric_enabled' in existing:
        op.drop_column('users', 'biometric_enabled')
    if 'biometric_credential_id' in existing:
        op.drop_column('users', 'biometric_credential_id')


def downgrade() -> None:
    op.add_column('users', sa.Column('biometric_credential_id', sa.String(length=512), nullable=True))
    op.add_column('users', sa.Column('biometric_enabled', sa.Boolean(), nullable=False, server_default='false'))
