"""add_user_id_to_mcps

Revision ID: a1b2c3d4e5f6
Revises: 6e3f8de34a6c
Create Date: 2026-05-04 18:17:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '6e3f8de34a6c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('mcps', sa.Column('user_id', sa.String(length=36), nullable=True))

    op.execute("DELETE FROM mcps WHERE user_id IS NULL")

    op.alter_column('mcps', 'user_id', nullable=False)
    op.create_index(op.f('ix_mcps_user_id'), 'mcps', ['user_id'], unique=False)
    op.create_foreign_key('fk_mcps_user_id', 'mcps', 'users', ['user_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint('fk_mcps_user_id', 'mcps', type_='foreignkey')
    op.drop_index(op.f('ix_mcps_user_id'), table_name='mcps')
    op.drop_column('mcps', 'user_id')
