from typing import Literal

from pydantic import BaseModel

from app.schemas.plan import AgentLogEntry, Card, RiskKind, RiskSignal


class RiskScanRequest(BaseModel):
    risk_types: list[RiskKind] = ["queue", "weather", "closure", "budget", "time", "fatigue"]


class RiskScanResponse(BaseModel):
    plan_id: str
    status: Literal["RISK_DETECTED", "EXECUTING"]
    risks: list[RiskSignal]
    agent_logs: list[AgentLogEntry]


class ReplanRequest(BaseModel):
    strategy: Literal["balanced", "cheaper", "faster", "lighter"] = "balanced"
    user_note: str | None = None
    base_version: int | None = None


class ReplanResponse(BaseModel):
    plan_id: str
    status: Literal["EXECUTING"]
    version: int
    cards: list[Card]
    inserted_card_ids: list[str]
    removed_card_ids: list[str]
    agent_message: str
    agent_logs: list[AgentLogEntry]


class IgnoreRiskResponse(BaseModel):
    plan_id: str
    status: Literal["EXECUTING"]
    agent_logs: list[AgentLogEntry]
