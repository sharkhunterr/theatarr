"""Add alternative images fields to movies.

Revision ID: 009
Revises: 008
Create Date: 2024-01-01 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add extra_backdrops, extra_posters, logos columns to movies table."""
    op.add_column("movies", sa.Column("extra_backdrops", sa.JSON(), nullable=True))
    op.add_column("movies", sa.Column("extra_posters", sa.JSON(), nullable=True))
    op.add_column("movies", sa.Column("logos", sa.JSON(), nullable=True))


def downgrade() -> None:
    """Remove alternative images columns from movies table."""
    op.drop_column("movies", "logos")
    op.drop_column("movies", "extra_posters")
    op.drop_column("movies", "extra_backdrops")
