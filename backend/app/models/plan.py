from datetime import UTC, datetime

from sqlmodel import Field, SQLModel


def now_utc() -> datetime:
    return datetime.now(UTC)


class PlanRecord(SQLModel, table=True):
    plan_id: str = Field(primary_key=True, index=True)
    session_id: str = Field(index=True)
    user_id: str | None = Field(default=None, index=True)
    city: str = Field(default="上海", index=True)
    source: str = Field(default="api", index=True)
    status: str = Field(default="EXECUTING", index=True)
    version: int = Field(default=1)
    constraints_json: str
    timeline_json: str
    cards_json: str
    active_risk_json: str | None = None
    agent_logs_json: str
    summary_json: str
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)


class PlanVersionRecord(SQLModel, table=True):
    version_id: str = Field(primary_key=True, index=True)
    plan_id: str = Field(index=True)
    session_id: str = Field(index=True)
    user_id: str | None = Field(default=None, index=True)
    city: str = Field(default="上海", index=True)
    source: str = Field(default="api", index=True)
    version: int = Field(index=True)
    event_type: str = Field(default="snapshot", index=True)
    status: str = Field(index=True)
    constraints_json: str
    timeline_json: str
    cards_json: str
    active_risk_json: str | None = None
    agent_logs_json: str
    summary_json: str
    created_at: datetime = Field(default_factory=now_utc, index=True)


class ExecutionSnapshotRecord(SQLModel, table=True):
    id: str = Field(primary_key=True, index=True)
    plan_id: str = Field(index=True)
    version: int = Field(index=True)
    status: str = Field(index=True)
    summary_json: str
    execution_context_json: str
    risk_flags_json: str
    actions_json: str
    created_at: datetime = Field(default_factory=now_utc, index=True)


class ReplanProposalSnapshot(SQLModel, table=True):
    id: str = Field(primary_key=True, index=True)
    plan_id: str = Field(index=True)
    execution_snapshot_id: str = Field(index=True)
    strategy: str = Field(index=True)
    risk_type: str = Field(index=True)
    proposal_json: str
    prompt_version: str | None = Field(default=None, index=True)
    llm_model: str | None = Field(default=None, index=True)
    accepted: bool = Field(default=False, index=True)
    accepted_at: datetime | None = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=now_utc, index=True)
