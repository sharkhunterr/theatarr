"""add session_events table

Revision ID: 021
Revises: 020
Create Date: 2026-02-16 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '021'
down_revision: Union[str, None] = '020'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'session_events',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('session_id', sa.String(36), sa.ForeignKey('sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('event_type', sa.String(50), nullable=False),
        sa.Column('timestamp', sa.DateTime, nullable=False),
        sa.Column('data', sa.JSON, nullable=True),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('idx_session_events_session_id', 'session_events', ['session_id'])
    op.create_index('idx_session_events_type', 'session_events', ['event_type'])
    op.create_index('idx_session_events_timestamp', 'session_events', ['timestamp'])


def downgrade() -> None:
    op.drop_index('idx_session_events_timestamp')
    op.drop_index('idx_session_events_type')
    op.drop_index('idx_session_events_session_id')
    op.drop_table('session_events')
