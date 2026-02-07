"""Add close_when_all_voted to vote_sessions.

Revision ID: 008
Revises: 007
Create Date: 2024-01-01 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add close_when_all_voted column to vote_sessions table."""
    op.add_column(
        "vote_sessions",
        sa.Column("close_when_all_voted", sa.Boolean(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    """Remove close_when_all_voted column from vote_sessions table."""
    op.drop_column("vote_sessions", "close_when_all_voted")
