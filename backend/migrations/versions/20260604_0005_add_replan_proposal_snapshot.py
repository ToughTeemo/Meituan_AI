"""add replan proposal snapshot

Revision ID: 20260604_0005
Revises: 20260603_0004
Create Date: 2026-06-04
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260604_0005"
down_revision: str | None = "20260603_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "replanproposalsnapshot",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("plan_id", sa.String(), nullable=False),
        sa.Column("execution_snapshot_id", sa.String(), nullable=False),
        sa.Column("strategy", sa.String(), nullable=False),
        sa.Column("risk_type", sa.String(), nullable=False),
        sa.Column("proposal_json", sa.String(), nullable=False),
        sa.Column("accepted", sa.Boolean(), nullable=False),
        sa.Column("accepted_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_replanproposalsnapshot_id", "replanproposalsnapshot", ["id"])
    op.create_index(
        "ix_replanproposalsnapshot_plan_id",
        "replanproposalsnapshot",
        ["plan_id"],
    )
    op.create_index(
        "ix_replanproposalsnapshot_execution_snapshot_id",
        "replanproposalsnapshot",
        ["execution_snapshot_id"],
    )
    op.create_index(
        "ix_replanproposalsnapshot_strategy",
        "replanproposalsnapshot",
        ["strategy"],
    )
    op.create_index(
        "ix_replanproposalsnapshot_risk_type",
        "replanproposalsnapshot",
        ["risk_type"],
    )
    op.create_index(
        "ix_replanproposalsnapshot_accepted",
        "replanproposalsnapshot",
        ["accepted"],
    )
    op.create_index(
        "ix_replanproposalsnapshot_accepted_at",
        "replanproposalsnapshot",
        ["accepted_at"],
    )
    op.create_index(
        "ix_replanproposalsnapshot_created_at",
        "replanproposalsnapshot",
        ["created_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_replanproposalsnapshot_created_at",
        table_name="replanproposalsnapshot",
    )
    op.drop_index(
        "ix_replanproposalsnapshot_accepted_at",
        table_name="replanproposalsnapshot",
    )
    op.drop_index(
        "ix_replanproposalsnapshot_accepted",
        table_name="replanproposalsnapshot",
    )
    op.drop_index(
        "ix_replanproposalsnapshot_risk_type",
        table_name="replanproposalsnapshot",
    )
    op.drop_index(
        "ix_replanproposalsnapshot_strategy",
        table_name="replanproposalsnapshot",
    )
    op.drop_index(
        "ix_replanproposalsnapshot_execution_snapshot_id",
        table_name="replanproposalsnapshot",
    )
    op.drop_index(
        "ix_replanproposalsnapshot_plan_id",
        table_name="replanproposalsnapshot",
    )
    op.drop_index("ix_replanproposalsnapshot_id", table_name="replanproposalsnapshot")
    op.drop_table("replanproposalsnapshot")
