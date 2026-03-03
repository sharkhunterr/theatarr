"""Add movie and palette fields to sessions.

Revision ID: 003
Revises: 002
Create Date: 2025-01-01 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add movie info and color palette fields to sessions table."""
    with op.batch_alter_table("sessions", schema=None) as batch_op:
        batch_op.add_column(sa.Column("movie_title", sa.String(500), nullable=True))
        batch_op.add_column(sa.Column("movie_poster_url", sa.String(1000), nullable=True))
        batch_op.add_column(sa.Column("movie_source_id", sa.String(100), nullable=True))
        batch_op.add_column(sa.Column("movie_source", sa.String(50), nullable=True))
        batch_op.add_column(sa.Column("color_palette", sa.JSON(), nullable=True))


def downgrade() -> None:
    """Remove movie info and color palette fields from sessions table."""
    with op.batch_alter_table("sessions", schema=None) as batch_op:
        batch_op.drop_column("color_palette")
        batch_op.drop_column("movie_source")
        batch_op.drop_column("movie_source_id")
        batch_op.drop_column("movie_poster_url")
        batch_op.drop_column("movie_title")
