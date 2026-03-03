"""quiz template and session integration

Revision ID: 016
Revises: 015
Create Date: 2026-02-12 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '016'
down_revision: Union[str, None] = '015'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table: str, column: str) -> bool:
    """Check if a column exists in a table (SQLite)."""
    conn = op.get_bind()
    result = conn.execute(sa.text(f"PRAGMA table_info({table})"))
    return any(row[1] == column for row in result)


def upgrade() -> None:
    # Add template_id to quiz_sessions
    if not _column_exists('quiz_sessions', 'template_id'):
        with op.batch_alter_table('quiz_sessions') as batch_op:
            batch_op.add_column(
                sa.Column('template_id', sa.String(36), nullable=True),
            )

    # Add linked_quiz_session_id to sessions
    if not _column_exists('sessions', 'linked_quiz_session_id'):
        with op.batch_alter_table('sessions') as batch_op:
            batch_op.add_column(
                sa.Column('linked_quiz_session_id', sa.String(36), nullable=True),
            )


def downgrade() -> None:
    with op.batch_alter_table('sessions') as batch_op:
        batch_op.drop_column('linked_quiz_session_id')
    with op.batch_alter_table('quiz_sessions') as batch_op:
        batch_op.drop_column('template_id')
