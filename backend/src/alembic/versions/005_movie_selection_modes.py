"""Movie selection modes for sessions.

Revision ID: 005
Revises: 004
Create Date: 2025-01-20 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add movie selection mode fields to sessions table."""
    with op.batch_alter_table("sessions", schema=None) as batch_op:
        # Movie selection mode: fixed, vote, mystery
        batch_op.add_column(
            sa.Column(
                "movie_selection_mode",
                sa.String(20),
                nullable=False,
                server_default="fixed",
            )
        )

        # Link to vote session for vote mode
        batch_op.add_column(
            sa.Column(
                "linked_vote_session_id",
                sa.String(36),
                sa.ForeignKey("vote_sessions.id", ondelete="SET NULL"),
                nullable=True,
            )
        )

        # Mystery mode: when to reveal the movie
        batch_op.add_column(
            sa.Column(
                "mystery_reveal_at",
                sa.DateTime(timezone=True),
                nullable=True,
            )
        )

        # Mystery mode config (JSON): source, filters, curated_movies
        batch_op.add_column(
            sa.Column(
                "mystery_config",
                sa.JSON,
                nullable=True,
            )
        )

        # Whether the movie has been resolved (for vote/mystery modes)
        batch_op.add_column(
            sa.Column(
                "movie_resolved",
                sa.Boolean,
                nullable=False,
                server_default="0",
            )
        )

        # When the movie was resolved
        batch_op.add_column(
            sa.Column(
                "movie_resolved_at",
                sa.DateTime(timezone=True),
                nullable=True,
            )
        )

        # Add indexes
        batch_op.create_index(
            "idx_sessions_linked_vote_session_id",
            ["linked_vote_session_id"],
        )
        batch_op.create_index(
            "idx_sessions_mystery_reveal_at",
            ["mystery_reveal_at"],
        )
        batch_op.create_index(
            "idx_sessions_movie_selection_mode",
            ["movie_selection_mode"],
        )

    # Add reverse link from vote_sessions to sessions
    with op.batch_alter_table("vote_sessions", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "linked_session_id",
                sa.String(36),
                sa.ForeignKey("sessions.id", ondelete="SET NULL"),
                nullable=True,
            )
        )
        batch_op.create_index(
            "idx_vote_sessions_linked_session_id",
            ["linked_session_id"],
        )


def downgrade() -> None:
    """Remove movie selection mode fields from sessions table."""
    # Remove reverse link from vote_sessions
    with op.batch_alter_table("vote_sessions", schema=None) as batch_op:
        batch_op.drop_index("idx_vote_sessions_linked_session_id")
        batch_op.drop_column("linked_session_id")

    # Remove fields from sessions table
    with op.batch_alter_table("sessions", schema=None) as batch_op:
        batch_op.drop_index("idx_sessions_movie_selection_mode")
        batch_op.drop_index("idx_sessions_mystery_reveal_at")
        batch_op.drop_index("idx_sessions_linked_vote_session_id")
        batch_op.drop_column("movie_resolved_at")
        batch_op.drop_column("movie_resolved")
        batch_op.drop_column("mystery_config")
        batch_op.drop_column("mystery_reveal_at")
        batch_op.drop_column("linked_vote_session_id")
        batch_op.drop_column("movie_selection_mode")
