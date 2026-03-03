"""Add enrichment_options to sessions.

Revision ID: 012
Revises: 011
Create Date: 2025-02-08
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import sqlite

revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("sessions", sa.Column("enrichment_options", sqlite.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("sessions", "enrichment_options")
