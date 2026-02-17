"""add prerolls table

Revision ID: 020
Revises: 019
Create Date: 2026-02-16 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '020'
down_revision: Union[str, None] = '019'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'prerolls',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('name', sa.String(500), nullable=False),
        sa.Column('tags', sa.JSON(), nullable=True),
        sa.Column('source_type', sa.String(50), server_default='upload', nullable=False),
        sa.Column('source_url', sa.String(2000), nullable=True),
        sa.Column('file_path', sa.String(1000), nullable=True),
        sa.Column('file_size_bytes', sa.Integer(), nullable=True),
        sa.Column('format', sa.String(20), server_default='mp4', nullable=False),
        sa.Column('duration_seconds', sa.Integer(), nullable=True),
        sa.Column('thumbnail_path', sa.String(1000), nullable=True),
        sa.Column('status', sa.String(20), server_default='pending', nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('download_progress', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('play_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('last_played_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('idx_prerolls_status', 'prerolls', ['status'])
    op.create_index('idx_prerolls_play_count', 'prerolls', ['play_count'])


def downgrade() -> None:
    op.drop_index('idx_prerolls_play_count', table_name='prerolls')
    op.drop_index('idx_prerolls_status', table_name='prerolls')
    op.drop_table('prerolls')
