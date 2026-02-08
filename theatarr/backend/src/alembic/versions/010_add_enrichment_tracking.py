"""Add enrichment tracking to movies.

Revision ID: 010
Revises: 009
Create Date: 2024-01-01 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add enrichment_sources column to movies table."""
    op.add_column("movies", sa.Column("enrichment_sources", sa.JSON(), nullable=True))


def downgrade() -> None:
    """Remove enrichment_sources column from movies table."""
    op.drop_column("movies", "enrichment_sources")
