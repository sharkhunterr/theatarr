"""add quiz system

Revision ID: 015
Revises: 4ece5417c894
Create Date: 2026-02-12 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '015'
down_revision: Union[str, None] = '4ece5417c894'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'quiz_sessions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='draft'),
        sa.Column('questions', sa.JSON(), nullable=True),
        sa.Column('config', sa.JSON(), nullable=True),
        sa.Column('current_question_index', sa.Integer(), nullable=False, server_default='-1'),
        sa.Column('current_question_started_at', sa.DateTime(), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('ended_at', sa.DateTime(), nullable=True),
        sa.Column('created_by', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('idx_quiz_sessions_status', 'quiz_sessions', ['status'])

    op.create_table(
        'quiz_tokens',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('quiz_session_id', sa.String(36), sa.ForeignKey('quiz_sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('token', sa.String(32), unique=True, nullable=False),
        sa.Column('label', sa.String(100), nullable=True),
        sa.Column('participant_name', sa.String(100), nullable=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('joined_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('idx_quiz_tokens_token', 'quiz_tokens', ['token'])
    op.create_index('idx_quiz_tokens_session_id', 'quiz_tokens', ['quiz_session_id'])
    op.create_index('idx_quiz_tokens_user_id', 'quiz_tokens', ['user_id'])

    op.create_table(
        'quiz_answers',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('quiz_session_id', sa.String(36), sa.ForeignKey('quiz_sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('token_id', sa.String(36), sa.ForeignKey('quiz_tokens.id', ondelete='CASCADE'), nullable=False),
        sa.Column('question_index', sa.Integer(), nullable=False),
        sa.Column('selected_indices', sa.JSON(), nullable=True),
        sa.Column('is_correct', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('answered_at', sa.DateTime(), nullable=False),
        sa.Column('response_time_ms', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('idx_quiz_answers_session_id', 'quiz_answers', ['quiz_session_id'])
    op.create_index('idx_quiz_answers_token_id', 'quiz_answers', ['token_id'])
    op.create_index('idx_quiz_answers_question', 'quiz_answers', ['quiz_session_id', 'question_index'])


def downgrade() -> None:
    op.drop_table('quiz_answers')
    op.drop_table('quiz_tokens')
    op.drop_table('quiz_sessions')
