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
    created_at: datetime = Field(default_factory=now_utc, index=True)
