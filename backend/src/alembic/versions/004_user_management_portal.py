"""User management and portal features.

Revision ID: 004
Revises: 003
Create Date: 2025-01-15 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add user management fields and participant tables."""
    # Add new fields to users table
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(sa.Column("first_name", sa.String(100), nullable=True))
        batch_op.add_column(sa.Column("last_name", sa.String(100), nullable=True))
        batch_op.add_column(
            sa.Column("email", sa.String(255), nullable=True, unique=True)
        )
        # Add role column with default 'user' for new users
        batch_op.add_column(
            sa.Column("role", sa.String(20), nullable=False, server_default="user")
        )
        batch_op.create_index("idx_users_email", ["email"])

    # Update existing 'admin' user to have admin role
    op.execute("UPDATE users SET role = 'admin' WHERE username = 'admin'")

    # Create session_participants table
    op.create_table(
        "session_participants",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "session_id",
            sa.String(36),
            sa.ForeignKey("sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "invitation_status",
            sa.String(20),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("invited_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "idx_session_participants_session_id",
        "session_participants",
        ["session_id"],
    )
    op.create_index(
        "idx_session_participants_user_id",
        "session_participants",
        ["user_id"],
    )
    op.create_index(
        "idx_session_participants_unique",
        "session_participants",
        ["session_id", "user_id"],
        unique=True,
    )

    # Create vote_session_participants table
    op.create_table(
        "vote_session_participants",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "vote_session_id",
            sa.String(36),
            sa.ForeignKey("vote_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("has_voted", sa.Boolean, nullable=False, server_default="0"),
        sa.Column("invited_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("voted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "idx_vote_session_participants_vote_session_id",
        "vote_session_participants",
        ["vote_session_id"],
    )
    op.create_index(
        "idx_vote_session_participants_user_id",
        "vote_session_participants",
        ["user_id"],
    )
    op.create_index(
        "idx_vote_session_participants_unique",
        "vote_session_participants",
        ["vote_session_id", "user_id"],
        unique=True,
    )


def downgrade() -> None:
    """Remove user management fields and participant tables."""
    # Drop vote_session_participants table
    op.drop_index("idx_vote_session_participants_unique")
    op.drop_index("idx_vote_session_participants_user_id")
    op.drop_index("idx_vote_session_participants_vote_session_id")
    op.drop_table("vote_session_participants")

    # Drop session_participants table
    op.drop_index("idx_session_participants_unique")
    op.drop_index("idx_session_participants_user_id")
    op.drop_index("idx_session_participants_session_id")
    op.drop_table("session_participants")

    # Remove new fields from users table
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_index("idx_users_email")
        batch_op.drop_column("role")
        batch_op.drop_column("email")
        batch_op.drop_column("last_name")
        batch_op.drop_column("first_name")
