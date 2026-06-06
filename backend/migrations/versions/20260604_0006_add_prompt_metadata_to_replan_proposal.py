"""add prompt metadata to replan proposal snapshot

Revision ID: 20260604_0006
Revises: 20260604_0005
Create Date: 2026-06-04
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260604_0006"
down_revision: str | None = "20260604_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "replanproposalsnapshot",
        sa.Column("prompt_version", sa.String(), nullable=True),
    )
    op.add_column(
        "replanproposalsnapshot",
        sa.Column("llm_model", sa.String(), nullable=True),
    )
    op.create_index(
        "ix_replanproposalsnapshot_prompt_version",
        "replanproposalsnapshot",
        ["prompt_version"],
    )
    op.create_index(
        "ix_replanproposalsnapshot_llm_model",
        "replanproposalsnapshot",
        ["llm_model"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_replanproposalsnapshot_llm_model",
        table_name="replanproposalsnapshot",
    )
    op.drop_index(
        "ix_replanproposalsnapshot_prompt_version",
        table_name="replanproposalsnapshot",
    )
    op.drop_column("replanproposalsnapshot", "llm_model")
    op.drop_column("replanproposalsnapshot", "prompt_version")
