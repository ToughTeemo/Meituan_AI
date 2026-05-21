from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.api.deps import get_planning_service
from app.schemas.plan import (
    CreatePlanRequest,
    PlanResponse,
    PlanVersionCompareResponse,
    PlanVersionResponse,
)
from app.services.planning_service import PlanningService

router = APIRouter(tags=["plans"])
PlanningServiceDep = Annotated[PlanningService, Depends(get_planning_service)]


@router.post(
    "/plans",
    response_model=PlanResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a local-life plan",
)
async def create_plan(
    request: CreatePlanRequest,
    service: PlanningServiceDep,
) -> PlanResponse:
    return service.create_plan(request)


@router.get(
    "/plans",
    response_model=list[PlanResponse],
    summary="List plans for an anonymous session or user session",
)
async def list_plans(
    session_id: str,
    service: PlanningServiceDep,
) -> list[PlanResponse]:
    return service.list_plans_for_session(session_id)


@router.get(
    "/plans/{plan_id}/versions/compare",
    response_model=PlanVersionCompareResponse,
    summary="Compare two plan version snapshots",
)
async def compare_plan_versions(
    plan_id: str,
    base_version_id: str,
    target_version_id: str,
    service: PlanningServiceDep,
) -> PlanVersionCompareResponse:
    return service.compare_plan_versions(plan_id, base_version_id, target_version_id)


@router.post(
    "/plans/{plan_id}/versions/{version_id}/restore",
    response_model=PlanResponse,
    summary="Restore a plan from a version snapshot",
)
async def restore_plan_version(
    plan_id: str,
    version_id: str,
    service: PlanningServiceDep,
) -> PlanResponse:
    return service.restore_plan_version(plan_id, version_id)


@router.get(
    "/plans/{plan_id}/versions",
    response_model=list[PlanVersionResponse],
    summary="List plan version snapshots",
)
async def list_plan_versions(
    plan_id: str,
    service: PlanningServiceDep,
) -> list[PlanVersionResponse]:
    return service.list_plan_versions(plan_id)


@router.get(
    "/plans/{plan_id}",
    response_model=PlanResponse,
    summary="Get the latest plan state",
)
async def get_plan(
    plan_id: str,
    service: PlanningServiceDep,
) -> PlanResponse:
    return service.get_plan(plan_id)
