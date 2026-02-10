"""add_pause_on_display_disconnect

Revision ID: 4ece5417c894
Revises: 014
Create Date: 2026-02-10 12:55:22.962363

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '4ece5417c894'
down_revision: Union[str, None] = '014'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('sessions', sa.Column('pause_on_display_disconnect', sa.Boolean(), nullable=False, server_default=sa.text('0')))


def downgrade() -> None:
    op.drop_column('sessions', 'pause_on_display_disconnect')
