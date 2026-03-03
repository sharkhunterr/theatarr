"""add sounds table

Revision ID: 017
Revises: 016
Create Date: 2026-02-07 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '017'
down_revision: Union[str, None] = '016'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'sounds',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(500), nullable=False),
        sa.Column('tags', sa.JSON(), nullable=True),
        sa.Column('source_url', sa.String(2000), nullable=True),
        sa.Column('source_type', sa.String(50), nullable=False, server_default='youtube'),
        sa.Column('file_path', sa.String(1000), nullable=True),
        sa.Column('file_size_bytes', sa.Integer(), nullable=True),
        sa.Column('format', sa.String(20), nullable=False, server_default='mp3'),
        sa.Column('bitrate', sa.Integer(), nullable=True),
        sa.Column('duration_seconds', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('download_progress', sa.Float(), nullable=False, server_default=sa.text('0.0')),
        sa.Column('chapter_title', sa.String(500), nullable=True),
        sa.Column('chapter_index', sa.Integer(), nullable=True),
        sa.Column('parent_source_url', sa.String(2000), nullable=True),
        sa.Column('play_count', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('last_played_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('idx_sounds_status', 'sounds', ['status'])
    op.create_index('idx_sounds_play_count', 'sounds', ['play_count'])


def downgrade() -> None:
    op.drop_index('idx_sounds_play_count', table_name='sounds')
    op.drop_index('idx_sounds_status', table_name='sounds')
    op.drop_table('sounds')
