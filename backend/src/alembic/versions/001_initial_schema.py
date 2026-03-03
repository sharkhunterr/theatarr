"""Initial schema - create all tables.

Revision ID: 001
Revises:
Create Date: 2026-02-05

Creates tables for:
- users (authentication)
- settings (key-value configuration)
- services (external service connections)
- sessions (cinema orchestration sessions)
- sequences (session sequences)
- actions (sequence actions)
- movies (movie metadata)
- color_palettes (dynamic theming)
- templates (wallmount display templates)
- vote_sessions (movie voting)
- votes (individual votes)
- vote_tokens (access tokens for voting)
- trailers (downloaded trailers)
- trailer_rules (auto-download rules)
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Users table
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("username", sa.String(100), unique=True, nullable=False, index=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), default=True, nullable=False),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
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

    # Settings table
    op.create_table(
        "settings",
        sa.Column("key", sa.String(100), primary_key=True, index=True),
        sa.Column("value", sa.JSON(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # Services table
    op.create_table(
        "services",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False, index=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("adapter_type", sa.String(100), nullable=False, index=True),
        sa.Column("category", sa.String(20), nullable=False, index=True),
        sa.Column("config", sa.JSON(), default=dict, nullable=False),
        sa.Column("is_enabled", sa.Boolean(), default=True, nullable=False),
        sa.Column("connection_status", sa.String(20), default="unknown", nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("capabilities", sa.JSON(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
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

    # Movies table
    op.create_table(
        "movies",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("original_title", sa.String(500), nullable=True),
        sa.Column("year", sa.Integer(), nullable=True),
        sa.Column("runtime_minutes", sa.Integer(), nullable=True),
        sa.Column("tmdb_id", sa.String(50), nullable=True, index=True),
        sa.Column("imdb_id", sa.String(20), nullable=True, index=True),
        sa.Column("plex_key", sa.String(100), nullable=True, index=True),
        sa.Column("jellyfin_id", sa.String(100), nullable=True, index=True),
        sa.Column("overview", sa.Text(), nullable=True),
        sa.Column("tagline", sa.String(500), nullable=True),
        sa.Column("poster_url", sa.String(1000), nullable=True),
        sa.Column("backdrop_url", sa.String(1000), nullable=True),
        sa.Column("poster_path", sa.String(500), nullable=True),
        sa.Column("backdrop_path", sa.String(500), nullable=True),
        sa.Column("rating", sa.Float(), nullable=True),
        sa.Column("vote_count", sa.Integer(), nullable=True),
        sa.Column("genres", sa.JSON(), default=list, nullable=True),
        sa.Column("directors", sa.JSON(), default=list, nullable=True),
        sa.Column("cast", sa.JSON(), default=list, nullable=True),
        sa.Column("studios", sa.JSON(), default=list, nullable=True),
        sa.Column("source", sa.String(50), nullable=True),
        sa.Column("source_updated_at", sa.String(50), nullable=True),
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

    # Sessions table
    op.create_table(
        "sessions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False, index=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "movie_id",
            sa.String(36),
            sa.ForeignKey("movies.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("status", sa.String(20), default="draft", nullable=False, index=True),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True, index=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("current_sequence_index", sa.Integer(), default=0, nullable=False),
        sa.Column("current_sequence_elapsed_ms", sa.Integer(), default=0, nullable=False),
        sa.Column("auto_resume_enabled", sa.Boolean(), default=True, nullable=False),
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

    # Sequences table
    op.create_table(
        "sequences",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "session_id",
            sa.String(36),
            sa.ForeignKey("sessions.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("order_index", sa.Integer(), nullable=False, index=True),
        sa.Column("duration_type", sa.String(20), default="fixed", nullable=False),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("duration_fallback_ms", sa.Integer(), default=60000, nullable=False),
        sa.Column("transition_ms", sa.Integer(), default=1000, nullable=False),
        sa.Column("node_editor_data", sa.JSON(), nullable=True),
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

    # Actions table
    op.create_table(
        "actions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "sequence_id",
            sa.String(36),
            sa.ForeignKey("sequences.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "service_id",
            sa.String(36),
            sa.ForeignKey("services.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("action_type", sa.String(20), nullable=False),
        sa.Column("command", sa.String(100), nullable=False),
        sa.Column("parameters", sa.JSON(), default=dict, nullable=False),
        sa.Column("delay_ms", sa.Integer(), default=0, nullable=False),
        sa.Column("on_failure", sa.String(10), default="warn", nullable=False),
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

    # Color Palettes table
    op.create_table(
        "color_palettes",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "movie_id",
            sa.String(36),
            sa.ForeignKey("movies.id", ondelete="CASCADE"),
            nullable=True,
            index=True,
        ),
        sa.Column("source_url", sa.String(1000), nullable=True),
        sa.Column("source_type", sa.String(20), default="poster"),
        sa.Column("primary", sa.String(7), default="#000000"),
        sa.Column("secondary", sa.String(7), nullable=True),
        sa.Column("accent", sa.String(7), nullable=True),
        sa.Column("background", sa.String(7), nullable=True),
        sa.Column("text", sa.String(7), nullable=True),
        sa.Column("muted", sa.String(7), nullable=True),
        sa.Column("vibrant", sa.String(7), nullable=True),
        sa.Column("vibrant_light", sa.String(7), nullable=True),
        sa.Column("vibrant_dark", sa.String(7), nullable=True),
        sa.Column("muted_color", sa.String(7), nullable=True),
        sa.Column("muted_light", sa.String(7), nullable=True),
        sa.Column("muted_dark", sa.String(7), nullable=True),
        sa.Column("raw_palette", sa.JSON(), nullable=True),
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

    # Templates table
    op.create_table(
        "templates",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("template_type", sa.String(50), default="custom"),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("styles", sa.Text(), nullable=True),
        sa.Column("script", sa.Text(), nullable=True),
        sa.Column("layout", sa.JSON(), nullable=True),
        sa.Column("config", sa.JSON(), default=dict, nullable=True),
        sa.Column("is_builtin", sa.Boolean(), default=False),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("preview_url", sa.String(500), nullable=True),
        sa.Column("thumbnail_url", sa.String(500), nullable=True),
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

    # Vote Sessions table
    op.create_table(
        "vote_sessions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), default="draft", nullable=False),
        sa.Column("movie_options", sa.JSON(), nullable=True),
        sa.Column("max_votes_per_user", sa.Integer(), default=1),
        sa.Column("allow_multiple_votes", sa.Boolean(), default=False),
        sa.Column("require_token", sa.Boolean(), default=True),
        sa.Column("show_results_during_voting", sa.Boolean(), default=False),
        sa.Column("anonymous_voting", sa.Boolean(), default=True),
        sa.Column("opens_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closes_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "winner_movie_id",
            sa.String(36),
            sa.ForeignKey("movies.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("winning_movie_index", sa.Integer(), nullable=True),
        sa.Column(
            "target_session_id",
            sa.String(36),
            sa.ForeignKey("sessions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_by",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
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
    op.create_index("idx_vote_sessions_status", "vote_sessions", ["status"])
    op.create_index("idx_vote_sessions_closes_at", "vote_sessions", ["closes_at"])

    # Vote Tokens table
    op.create_table(
        "vote_tokens",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "vote_session_id",
            sa.String(36),
            sa.ForeignKey("vote_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token", sa.String(32), unique=True, nullable=False),
        sa.Column("label", sa.String(100), nullable=True),
        sa.Column("max_uses", sa.Integer(), nullable=True),
        sa.Column("use_count", sa.Integer(), default=0),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
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
    op.create_index("idx_vote_tokens_token", "vote_tokens", ["token"])
    op.create_index("idx_vote_tokens_session_id", "vote_tokens", ["vote_session_id"])

    # Votes table
    op.create_table(
        "votes",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "vote_session_id",
            sa.String(36),
            sa.ForeignKey("vote_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("movie_index", sa.Integer(), nullable=False),
        sa.Column(
            "movie_id",
            sa.String(36),
            sa.ForeignKey("movies.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "token_id",
            sa.String(36),
            sa.ForeignKey("vote_tokens.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("voter_identifier", sa.String(100), nullable=True),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.Column("ip_hash", sa.String(64), nullable=True),
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
    op.create_index("idx_votes_session_id", "votes", ["vote_session_id"])
    op.create_index("idx_votes_token_id", "votes", ["token_id"])
    op.create_index("idx_votes_movie_index", "votes", ["movie_index"])

    # Trailer Rules table
    op.create_table(
        "trailer_rules",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_enabled", sa.Boolean(), default=True),
        sa.Column("genres", sa.JSON(), nullable=True),
        sa.Column("min_year", sa.Integer(), nullable=True),
        sa.Column("max_year", sa.Integer(), nullable=True),
        sa.Column("min_rating", sa.Float(), nullable=True),
        sa.Column("max_rating", sa.Float(), nullable=True),
        sa.Column("preferred_quality", sa.String(20), default="1080p"),
        sa.Column("min_quality", sa.String(20), default="720p"),
        sa.Column("min_duration", sa.Integer(), nullable=True),
        sa.Column("max_duration", sa.Integer(), nullable=True),
        sa.Column("max_storage_gb", sa.Float(), default=10.0),
        sa.Column("max_trailer_count", sa.Integer(), nullable=True),
        sa.Column("max_downloads_per_run", sa.Integer(), default=5),
        sa.Column("frequency", sa.String(20), default="weekly"),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rotation_enabled", sa.Boolean(), default=True),
        sa.Column("rotation_keep_most_recent", sa.Integer(), default=20),
        sa.Column("rotation_keep_most_played", sa.Integer(), default=10),
        sa.Column("criteria", sa.JSON(), nullable=True),
        sa.Column("total_downloads", sa.Integer(), default=0),
        sa.Column("total_storage_bytes", sa.Integer(), default=0),
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
    op.create_index("idx_trailer_rules_enabled", "trailer_rules", ["is_enabled"])
    op.create_index("idx_trailer_rules_next_run", "trailer_rules", ["next_run_at"])

    # Trailers table
    op.create_table(
        "trailers",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("movie_title", sa.String(500), nullable=False),
        sa.Column("movie_year", sa.Integer(), nullable=True),
        sa.Column("movie_tmdb_id", sa.String(50), nullable=True),
        sa.Column("movie_imdb_id", sa.String(20), nullable=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("source_type", sa.String(50), default="youtube"),
        sa.Column("source_url", sa.String(2000), nullable=True),
        sa.Column("source_id", sa.String(100), nullable=True),
        sa.Column("file_path", sa.String(1000), nullable=True),
        sa.Column("file_size_bytes", sa.Integer(), nullable=True),
        sa.Column("quality", sa.String(20), default="720p"),
        sa.Column("format", sa.String(20), default="mp4"),
        sa.Column("thumbnail_url", sa.String(2000), nullable=True),
        sa.Column("thumbnail_path", sa.String(1000), nullable=True),
        sa.Column("status", sa.String(20), default="pending", nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("download_progress", sa.Float(), default=0.0),
        sa.Column("genres", sa.JSON(), nullable=True),
        sa.Column("tags", sa.JSON(), nullable=True),
        sa.Column("rating", sa.Float(), nullable=True),
        sa.Column("play_count", sa.Integer(), default=0),
        sa.Column("last_played_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "rule_id",
            sa.String(36),
            sa.ForeignKey("trailer_rules.id", ondelete="SET NULL"),
            nullable=True,
        ),
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
    op.create_index("idx_trailers_status", "trailers", ["status"])
    op.create_index("idx_trailers_movie_tmdb_id", "trailers", ["movie_tmdb_id"])
    op.create_index("idx_trailers_play_count", "trailers", ["play_count"])


def downgrade() -> None:
    # Drop tables in reverse order of creation (respecting foreign keys)
    op.drop_table("trailers")
    op.drop_table("trailer_rules")
    op.drop_table("votes")
    op.drop_table("vote_tokens")
    op.drop_table("vote_sessions")
    op.drop_table("templates")
    op.drop_table("color_palettes")
    op.drop_table("actions")
    op.drop_table("sequences")
    op.drop_table("sessions")
    op.drop_table("movies")
    op.drop_table("services")
    op.drop_table("settings")
    op.drop_table("users")
