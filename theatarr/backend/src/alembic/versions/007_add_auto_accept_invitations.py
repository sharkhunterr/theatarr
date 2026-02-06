"""Add auto_accept_invitations to users.

Revision ID: 007
Revises: 006
Create Date: 2024-01-01 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add auto_accept_invitations column to users table."""
    op.add_column(
        "users",
        sa.Column("auto_accept_invitations", sa.Boolean(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    """Remove auto_accept_invitations column from users table."""
    op.drop_column("users", "auto_accept_invitations")
