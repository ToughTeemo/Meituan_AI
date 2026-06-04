"""add execution snapshot

Revision ID: 20260603_0004
Revises: 20260603_0003
Create Date: 2026-06-03
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260603_0004"
down_revision: str | None = "20260603_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "executionsnapshotrecord",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("plan_id", sa.String(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("summary_json", sa.String(), nullable=False),
        sa.Column("execution_context_json", sa.String(), nullable=False),
        sa.Column("risk_flags_json", sa.String(), nullable=False),
        sa.Column("actions_json", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_executionsnapshotrecord_id", "executionsnapshotrecord", ["id"])
    op.create_index(
        "ix_executionsnapshotrecord_plan_id",
        "executionsnapshotrecord",
        ["plan_id"],
    )
    op.create_index(
        "ix_executionsnapshotrecord_version",
        "executionsnapshotrecord",
        ["version"],
    )
    op.create_index(
        "ix_executionsnapshotrecord_status",
        "executionsnapshotrecord",
        ["status"],
    )
    op.create_index(
        "ix_executionsnapshotrecord_created_at",
        "executionsnapshotrecord",
        ["created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_executionsnapshotrecord_created_at", table_name="executionsnapshotrecord")
    op.drop_index("ix_executionsnapshotrecord_status", table_name="executionsnapshotrecord")
    op.drop_index("ix_executionsnapshotrecord_version", table_name="executionsnapshotrecord")
    op.drop_index("ix_executionsnapshotrecord_plan_id", table_name="executionsnapshotrecord")
    op.drop_index("ix_executionsnapshotrecord_id", table_name="executionsnapshotrecord")
    op.drop_table("executionsnapshotrecord")
