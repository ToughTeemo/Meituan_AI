import json
from datetime import UTC, datetime
from copy import deepcopy
from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.api.deps import get_planning_service
from app.core.errors import PlanNotFoundError, ReplanNotAvailableError
from app.schemas.plan import (
    CreatePlanRequest,
    PlanResponse,
    PlanVersionCompareResponse,
    PlanVersionResponse,
)
from app.services.apply_replan_service import ApplyReplanInput, ApplyReplanService
from app.services.execution_pipeline import ExecutionPipeline
from app.services.replan_context_builder import ReplanContextBuilder
from app.services.replan_decision_service import ReplanDecisionService
from app.services.replanner_factory import get_replanner
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


@router.post(
    "/plans/{plan_id}/execution/check",
    summary="Run execution check and persist an execution snapshot",
)
async def check_plan_execution(
    plan_id: str,
    service: PlanningServiceDep,
) -> dict:
    plan = service.get_plan(plan_id)
    pipeline = ExecutionPipeline()
    pipeline_result = await pipeline.run(plan)
    execution_snapshot = service.plan_repository.save_execution_snapshot(
        plan.plan_id,
        plan.version,
        pipeline_result,
    )
    _auto_generate_replan_proposal(
        plan=plan,
        pipeline_result=pipeline_result,
        execution_snapshot_id=execution_snapshot["id"],
        repository=service.plan_repository,
    )
    return pipeline.result_view(pipeline_result)


@router.get(
    "/plans/{plan_id}/execution/latest",
    summary="Get latest execution snapshot summary",
)
async def get_latest_plan_execution(
    plan_id: str,
    service: PlanningServiceDep,
) -> dict:
    service.get_plan(plan_id)
    snapshot = service.plan_repository.get_latest_execution_snapshot(plan_id)
    if snapshot is None:
        raise PlanNotFoundError("Execution snapshot does not exist.")
    return ExecutionPipeline().snapshot_view(snapshot)


@router.get(
    "/plans/{plan_id}/replan/latest",
    summary="Get the latest replan proposal",
)
async def get_latest_plan_replan(
    plan_id: str,
    service: PlanningServiceDep,
) -> dict:
    service.get_plan(plan_id)
    proposal = service.plan_repository.get_latest_replan_proposal(plan_id)
    if proposal is None:
        raise PlanNotFoundError("Replan proposal does not exist.")
    return _replan_response(proposal, status="PENDING", updated_plan=None)


@router.get(
    "/plans/{plan_id}/replans",
    summary="List replan proposals for a plan",
)
async def list_plan_replans(
    plan_id: str,
    service: PlanningServiceDep,
) -> dict:
    service.get_plan(plan_id)
    proposals = service.plan_repository.list_replan_proposals(plan_id)
    proposals_desc = sorted(
        proposals,
        key=lambda proposal: proposal["created_at"],
        reverse=True,
    )
    return {
        "plan_id": plan_id,
        "proposals": [_replan_list_item(proposal) for proposal in proposals_desc],
    }


@router.post(
    "/plans/{plan_id}/replan/{proposal_id}/apply",
    summary="Apply the latest replan proposal",
)
async def apply_plan_replan(
    plan_id: str,
    proposal_id: str,
    service: PlanningServiceDep,
) -> dict:
    plan = service.get_plan(plan_id)
    proposal = service.plan_repository.get_replan_proposal(proposal_id)
    if proposal is None or proposal["plan_id"] != plan_id:
        raise PlanNotFoundError("Replan proposal does not exist.")
    if proposal["accepted"] is True:
        raise ReplanNotAvailableError("Replan proposal has already been applied.")

    proposal_payload = json.loads(proposal["proposal_json"])
    plan_payload = plan.model_dump(mode="json")
    _seed_provider_snapshot(plan_payload, proposal_payload)
    apply_result = ApplyReplanService().apply(
        ApplyReplanInput(plan=plan_payload, proposal=proposal_payload)
    )
    if not apply_result.get("applied") or apply_result.get("updated_plan") is None:
        raise ReplanNotAvailableError("Replan proposal cannot be applied.")

    updated_plan = PlanResponse.model_validate(apply_result["updated_plan"]).model_copy(
        update={"updated_at": datetime.now(UTC)}
    )
    saved_plan = service.plan_repository.save(updated_plan)
    accepted_proposal = service.plan_repository.accept_replan_proposal(proposal_id)
    if accepted_proposal is None:
        raise PlanNotFoundError("Replan proposal does not exist.")

    response_plan = saved_plan.model_dump(mode="json")
    _merge_provider_snapshot(response_plan, apply_result["updated_plan"], proposal_payload)

    return _replan_response(
        proposal=accepted_proposal,
        status="APPLIED",
        updated_plan=response_plan,
    )


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


def _seed_provider_snapshot(plan_payload: dict, proposal_payload: dict) -> None:
    new_poi = proposal_payload.get("new_poi")
    if not isinstance(new_poi, dict) or not new_poi:
        return
    target_card = _find_target_card(plan_payload, proposal_payload)
    if target_card is None:
        return
    target_card["provider_snapshot"] = deepcopy(new_poi)


def _merge_provider_snapshot(
    response_plan: dict,
    applied_plan: dict,
    proposal_payload: dict,
) -> None:
    target_response = _find_target_card(response_plan, proposal_payload)
    target_applied = _find_target_card(applied_plan, proposal_payload)
    if target_response is None or target_applied is None:
        return
    provider_snapshot = target_applied.get("provider_snapshot")
    if isinstance(provider_snapshot, dict):
        target_response["provider_snapshot"] = deepcopy(provider_snapshot)


def _find_target_card(plan_payload: dict, proposal_payload: dict) -> dict | None:
    old_poi = proposal_payload.get("old_poi")
    old_poi_payload = old_poi if isinstance(old_poi, dict) else {}
    old_card_id = _text(proposal_payload.get("old_card_id"))
    old_poi_id = _text(proposal_payload.get("old_poi_id")) or _text(
        old_poi_payload.get("poi_id")
    )
    for card in plan_payload.get("cards", []):
        if not isinstance(card, dict):
            continue
        if old_card_id and _text(card.get("card_id")) == old_card_id:
            return card
        poi = card.get("poi")
        if isinstance(poi, dict) and old_poi_id and _text(poi.get("poi_id")) == old_poi_id:
            return card
    return None


def _text(value: object) -> str:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return ""


def _auto_generate_replan_proposal(
    plan,
    pipeline_result: dict,
    execution_snapshot_id: str,
    repository,
) -> dict | None:
    existing = repository.get_replan_proposal_by_execution_snapshot_id(execution_snapshot_id)
    if existing is not None:
        return existing

    decision = ReplanDecisionService().decide(pipeline_result)
    if not decision.get("need_replan"):
        return None

    replan_context = ReplanContextBuilder().build(plan, pipeline_result, decision)
    replanner = get_replanner()
    proposal = replanner.propose(replan_context)
    if not proposal.get("replanned"):
        return None

    return repository.save_replan_proposal(
        plan.plan_id,
        execution_snapshot_id,
        proposal,
        prompt_version=getattr(replanner, "last_prompt_version", None),
        llm_model=getattr(replanner, "last_llm_model", None),
    )


def _replan_response(
    proposal: dict,
    status: str,
    updated_plan: dict | None,
) -> dict:
    return {
        "proposal_id": proposal["id"],
        "plan_id": proposal["plan_id"],
        "execution_snapshot_id": proposal["execution_snapshot_id"],
        "status": status,
        "strategy": proposal["strategy"],
        "risk_type": proposal["risk_type"],
        "accepted": proposal["accepted"],
        "accepted_at": proposal["accepted_at"],
        "created_at": proposal["created_at"],
        "proposal": json.loads(proposal["proposal_json"]),
        "updated_plan": updated_plan,
    }


def _replan_list_item(proposal: dict) -> dict:
    return {
        "proposal_id": proposal["id"],
        "status": "APPLIED" if proposal["accepted"] else "PENDING",
        "strategy": proposal["strategy"],
        "risk_type": proposal["risk_type"],
        "accepted": proposal["accepted"],
        "accepted_at": proposal["accepted_at"],
        "created_at": proposal["created_at"],
        "proposal": proposal["proposal"],
    }
