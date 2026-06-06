from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import get_risk_service
from app.schemas.risk import (
    IgnoreRiskResponse,
    ReplanRequest,
    ReplanResponse,
    RiskScanRequest,
    RiskScanResponse,
)
from app.services.risk_service import RiskService

router = APIRouter(tags=["risks"])
RiskServiceDep = Annotated[RiskService, Depends(get_risk_service)]


@router.post(
    "/plans/{plan_id}/risks/scan",
    response_model=RiskScanResponse,
    summary="Scan a plan for current risks",
)
async def scan_risks(
    plan_id: str,
    request: RiskScanRequest,
    service: RiskServiceDep,
) -> RiskScanResponse:
    return service.scan_risks(plan_id, request)


@router.post(
    "/plans/{plan_id}/risks/{risk_id}/replan",
    response_model=ReplanResponse,
    summary="Accept a risk suggestion and replan",
)
async def replan_for_risk(
    plan_id: str,
    risk_id: str,
    request: ReplanRequest,
    service: RiskServiceDep,
) -> ReplanResponse:
    return service.replan(plan_id, risk_id, request)


@router.post(
    "/plans/{plan_id}/risks/{risk_id}/ignore",
    response_model=IgnoreRiskResponse,
    summary="Ignore a detected risk",
)
async def ignore_risk(
    plan_id: str,
    risk_id: str,
    service: RiskServiceDep,
) -> IgnoreRiskResponse:
    return service.ignore_risk(plan_id, risk_id)
