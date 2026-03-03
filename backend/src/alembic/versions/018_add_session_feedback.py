"""add session_feedback table

Revision ID: 018
Revises: 017
Create Date: 2026-02-15 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '018'
down_revision: Union[str, None] = '017'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'session_feedback',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('session_id', sa.String(36), sa.ForeignKey('sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('ratings', sa.JSON(), nullable=False),
        sa.Column('overall_rating', sa.Float(), nullable=False),
        sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('idx_session_feedback_session_id', 'session_feedback', ['session_id'])
    op.create_index('idx_session_feedback_user_id', 'session_feedback', ['user_id'])
    op.create_index('idx_session_feedback_unique', 'session_feedback', ['session_id', 'user_id'], unique=True)


def downgrade() -> None:
    op.drop_index('idx_session_feedback_unique', table_name='session_feedback')
    op.drop_index('idx_session_feedback_user_id', table_name='session_feedback')
    op.drop_index('idx_session_feedback_session_id', table_name='session_feedback')
    op.drop_table('session_feedback')
