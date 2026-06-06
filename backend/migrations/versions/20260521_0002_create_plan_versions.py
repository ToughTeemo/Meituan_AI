"""create plan versions

Revision ID: 20260521_0002
Revises: 20260521_0001
Create Date: 2026-05-21
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260521_0002"
down_revision: str | None = "20260521_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "planversionrecord",
        sa.Column("version_id", sa.String(), nullable=False),
        sa.Column("plan_id", sa.String(), nullable=False),
        sa.Column("session_id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=True),
        sa.Column("city", sa.String(), nullable=False, server_default="上海"),
        sa.Column("source", sa.String(), nullable=False, server_default="api"),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(), nullable=False, server_default="snapshot"),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("constraints_json", sa.String(), nullable=False),
        sa.Column("timeline_json", sa.String(), nullable=False),
        sa.Column("cards_json", sa.String(), nullable=False),
        sa.Column("active_risk_json", sa.String(), nullable=True),
        sa.Column("agent_logs_json", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("version_id"),
    )
    op.create_index(
        "ix_planversionrecord_version_id",
        "planversionrecord",
        ["version_id"],
        unique=False,
    )
    op.create_index("ix_planversionrecord_plan_id", "planversionrecord", ["plan_id"])
    op.create_index("ix_planversionrecord_session_id", "planversionrecord", ["session_id"])
    op.create_index("ix_planversionrecord_user_id", "planversionrecord", ["user_id"])
    op.create_index("ix_planversionrecord_city", "planversionrecord", ["city"])
    op.create_index("ix_planversionrecord_source", "planversionrecord", ["source"])
    op.create_index("ix_planversionrecord_version", "planversionrecord", ["version"])
    op.create_index("ix_planversionrecord_event_type", "planversionrecord", ["event_type"])
    op.create_index("ix_planversionrecord_status", "planversionrecord", ["status"])
    op.create_index("ix_planversionrecord_created_at", "planversionrecord", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_planversionrecord_created_at", table_name="planversionrecord")
    op.drop_index("ix_planversionrecord_status", table_name="planversionrecord")
    op.drop_index("ix_planversionrecord_event_type", table_name="planversionrecord")
    op.drop_index("ix_planversionrecord_version", table_name="planversionrecord")
    op.drop_index("ix_planversionrecord_source", table_name="planversionrecord")
    op.drop_index("ix_planversionrecord_city", table_name="planversionrecord")
    op.drop_index("ix_planversionrecord_user_id", table_name="planversionrecord")
    op.drop_index("ix_planversionrecord_session_id", table_name="planversionrecord")
    op.drop_index("ix_planversionrecord_plan_id", table_name="planversionrecord")
    op.drop_index("ix_planversionrecord_version_id", table_name="planversionrecord")
    op.drop_table("planversionrecord")
