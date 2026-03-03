"""add QR ticket fields to sessions and session_participants

Revision ID: 023
Revises: 022
Create Date: 2026-02-20 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '023'
down_revision: Union[str, None] = '022'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('sessions', sa.Column('qr_tickets_enabled', sa.Boolean, nullable=False, server_default='0'))
    op.add_column('session_participants', sa.Column('ticket_token', sa.String(36), nullable=True))
    op.add_column('session_participants', sa.Column('checked_in', sa.Boolean, nullable=False, server_default='0'))
    op.add_column('session_participants', sa.Column('checked_in_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index('idx_session_participants_ticket_token', 'session_participants', ['ticket_token'], unique=True)


def downgrade() -> None:
    op.drop_index('idx_session_participants_ticket_token', table_name='session_participants')
    op.drop_column('session_participants', 'checked_in_at')
    op.drop_column('session_participants', 'checked_in')
    op.drop_column('session_participants', 'ticket_token')
    op.drop_column('sessions', 'qr_tickets_enabled')
