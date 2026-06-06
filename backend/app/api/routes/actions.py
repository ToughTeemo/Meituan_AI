from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import get_action_service
from app.schemas.action import (
    ConfirmPlanRequest,
    ConfirmPlanResponse,
    PlanActionRequest,
    PlanActionResponse,
)
from app.services.action_service import ActionService

router = APIRouter(tags=["actions"])
ActionServiceDep = Annotated[ActionService, Depends(get_action_service)]


@router.post(
    "/plans/{plan_id}/confirm",
    response_model=ConfirmPlanResponse,
    summary="Confirm the current plan",
)
async def confirm_plan(
    plan_id: str,
    request: ConfirmPlanRequest,
    service: ActionServiceDep,
) -> ConfirmPlanResponse:
    return service.confirm_plan(plan_id, request)


@router.post(
    "/plans/{plan_id}/actions",
    response_model=PlanActionResponse,
    summary="Run a mock next action for the plan",
)
async def run_action(
    plan_id: str,
    request: PlanActionRequest,
    service: ActionServiceDep,
) -> PlanActionResponse:
    return service.run_action(plan_id, request)
