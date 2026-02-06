"""Add workflow JSON column to sessions table.

Revision ID: 002
Revises: 001
Create Date: 2026-02-06

Adds workflow column for storing node-based workflow data (nodes, edges)
that defines session actions with parallel execution, conditions, etc.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "sessions",
        sa.Column("workflow", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("sessions", "workflow")
