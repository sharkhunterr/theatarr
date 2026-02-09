"""Add vote_reveal_at to sessions.

Revision ID: 013
Revises: 012
Create Date: 2025-02-08
"""

from alembic import op
import sqlalchemy as sa

revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("sessions", sa.Column("vote_reveal_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("sessions", "vote_reveal_at")
