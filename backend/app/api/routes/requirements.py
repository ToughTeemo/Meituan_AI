from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import get_requirement_service
from app.schemas.requirement import RequirementRequest, RequirementResponse
from app.services.requirement_service import RequirementService

router = APIRouter(tags=["requirements"])
RequirementServiceDep = Annotated[RequirementService, Depends(get_requirement_service)]


@router.post(
    "/plans/{plan_id}/requirements",
    response_model=RequirementResponse,
    summary="Submit an updated user requirement",
)
async def submit_requirement(
    plan_id: str,
    request: RequirementRequest,
    service: RequirementServiceDep,
) -> RequirementResponse:
    return service.submit_requirement(plan_id, request)
