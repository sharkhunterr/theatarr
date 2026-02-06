"""Add template_id to sessions.

Revision ID: 006
Revises: 005
Create Date: 2026-02-06
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # SQLite doesn't support adding FK constraints, so just add the column
    op.add_column(
        "sessions",
        sa.Column("template_id", sa.String(36), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("sessions", "template_id")
