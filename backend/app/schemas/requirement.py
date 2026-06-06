from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.plan import AgentLogEntry, RiskSignal


class RequirementRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1000)
    source: Literal["user_input", "quick_chip", "voice"] = "user_input"


class RequirementResponse(BaseModel):
    plan_id: str
    requires_replan: bool
    risk: RiskSignal | None = None
    agent_logs: list[AgentLogEntry]
    message: str
