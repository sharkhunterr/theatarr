"""Add display_code to sessions.

Revision ID: 014
Revises: 013
"""

import secrets
import string

import sqlalchemy as sa
from alembic import op

revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None

_CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def _generate_code() -> str:
    return "".join(secrets.choice(_CODE_CHARS) for _ in range(6))


def upgrade() -> None:
    op.add_column(
        "sessions",
        sa.Column("display_code", sa.String(8), nullable=True),
    )
    op.create_index("ix_sessions_display_code", "sessions", ["display_code"], unique=True)

    # Generate codes for existing sessions
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id FROM sessions")).fetchall()
    used_codes: set[str] = set()
    for row in rows:
        code = _generate_code()
        while code in used_codes:
            code = _generate_code()
        used_codes.add(code)
        conn.execute(
            sa.text("UPDATE sessions SET display_code = :code WHERE id = :id"),
            {"code": code, "id": row[0]},
        )


def downgrade() -> None:
    op.drop_index("ix_sessions_display_code", table_name="sessions")
    op.drop_column("sessions", "display_code")
