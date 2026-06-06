"""create plan records

Revision ID: 20260521_0001
Revises:
Create Date: 2026-05-21
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260521_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "planrecord",
        sa.Column("plan_id", sa.String(), nullable=False),
        sa.Column("session_id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=True),
        sa.Column("city", sa.String(), nullable=False, server_default="上海"),
        sa.Column("source", sa.String(), nullable=False, server_default="api"),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("constraints_json", sa.String(), nullable=False),
        sa.Column("timeline_json", sa.String(), nullable=False),
        sa.Column("cards_json", sa.String(), nullable=False),
        sa.Column("active_risk_json", sa.String(), nullable=True),
        sa.Column("agent_logs_json", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("plan_id"),
    )
    op.create_index("ix_planrecord_plan_id", "planrecord", ["plan_id"], unique=False)
    op.create_index("ix_planrecord_session_id", "planrecord", ["session_id"], unique=False)
    op.create_index("ix_planrecord_user_id", "planrecord", ["user_id"], unique=False)
    op.create_index("ix_planrecord_city", "planrecord", ["city"], unique=False)
    op.create_index("ix_planrecord_source", "planrecord", ["source"], unique=False)
    op.create_index("ix_planrecord_status", "planrecord", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_planrecord_status", table_name="planrecord")
    op.drop_index("ix_planrecord_source", table_name="planrecord")
    op.drop_index("ix_planrecord_city", table_name="planrecord")
    op.drop_index("ix_planrecord_user_id", table_name="planrecord")
    op.drop_index("ix_planrecord_session_id", table_name="planrecord")
    op.drop_index("ix_planrecord_plan_id", table_name="planrecord")
    op.drop_table("planrecord")
