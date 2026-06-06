"""add plan summary json

Revision ID: 20260603_0003
Revises: 20260521_0002
Create Date: 2026-06-03
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260603_0003"
down_revision: str | None = "20260521_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

DEFAULT_SUMMARY = (
    '{"title":"上海周末城市玩耍路线",'
    '"subtitle":"真实上海地点、路线时间、天气偏好和预算约束已纳入规划"}'
)


def upgrade() -> None:
    op.add_column(
        "planrecord",
        sa.Column(
            "summary_json",
            sa.String(),
            nullable=False,
            server_default=DEFAULT_SUMMARY,
        ),
    )
    op.add_column(
        "planversionrecord",
        sa.Column(
            "summary_json",
            sa.String(),
            nullable=False,
            server_default=DEFAULT_SUMMARY,
        ),
    )


def downgrade() -> None:
    op.drop_column("planversionrecord", "summary_json")
    op.drop_column("planrecord", "summary_json")
