from typing import Literal

from pydantic import BaseModel

from app.schemas.plan import AgentLogEntry

ActionType = Literal[
    "reserve_activity",
    "reserve_restaurant",
    "generate_route",
    "share_plan",
    "set_reminder",
]

ActionStatus = Literal["pending", "success", "failed"]


class ConfirmPlanRequest(BaseModel):
    confirmed_by: str = "current_user"


class NextAction(BaseModel):
    action_id: ActionType
    label: str
    enabled: bool = True


class ConfirmPlanResponse(BaseModel):
    plan_id: str
    status: Literal["CONFIRMED"]
    next_actions: list[NextAction]
    agent_logs: list[AgentLogEntry]


class PlanActionRequest(BaseModel):
    action_type: ActionType
    card_id: str | None = None
    payload: dict = {}


class PlanActionResponse(BaseModel):
    action_id: str
    action_type: ActionType
    status: ActionStatus
    message: str
    agent_logs: list[AgentLogEntry]
