"""add_mcp_requires_reauth

Revision ID: e1f2a3b4c5d6
Revises: d0e1f2a3b4c5
Create Date: 2026-06-09 16:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e1f2a3b4c5d6'
down_revision: Union[str, Sequence[str], None] = 'd0e1f2a3b4c5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'mcps',
        sa.Column('requires_reauth', sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.alter_column('mcps', 'requires_reauth', server_default=None)


def downgrade() -> None:
    op.drop_column('mcps', 'requires_reauth')
