"""Add keywords to movies.

Revision ID: 011
Revises: 010
Create Date: 2025-02-07
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import sqlite

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("movies", sa.Column("keywords", sqlite.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("movies", "keywords")
