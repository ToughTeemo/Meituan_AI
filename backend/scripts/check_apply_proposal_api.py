from __future__ import annotations

import json
import os
import sys
from copy import deepcopy
from contextlib import contextmanager
from pathlib import Path
from typing import Any

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["PLANNING_PROVIDER"] = "rule_based"

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.database import create_db_and_tables, engine
from app.main import create_app
from app.repositories.plan_repository import PlanRepository
from app.schemas.plan import CreatePlanRequest
from app.services.apply_replan_service import ApplyReplanInput, ApplyReplanService
from app.services.execution_pipeline import ExecutionPipeline
from app.services.planning_service import PlanningService
from app.services.replan_context_builder import ReplanContextBuilder
from app.services.replan_decision_service import ReplanDecisionService
from app.services.mvp_models import WeatherSnapshot
from app.services.rule_based_replanner import RuleBasedReplanner
from app.providers import weather as weather_provider_module


async def run_execution_pipeline(plan: Any) -> dict[str, Any]:
    return await ExecutionPipeline().run(plan)


def main() -> None:
    create_db_and_tables()
    request = CreatePlanRequest(
        prompt=(
            "周末带孩子在上海玩半天，预算不要太高，优先室内，"
            "如果遇到天气风险就切换到可确认的重规划方案"
        ),
        city="上海",
        session_id="check_apply_proposal_api_session",
        user_id="check_user",
    )

    with Session(engine) as session:
        repository = PlanRepository(session)
        plan = PlanningService(repository).create_plan(request)
        plan_before_apply = deepcopy(plan.model_dump(mode="json"))
        with deterministic_weather():
            pipeline_result = asyncio_run(run_execution_pipeline(plan))
        execution_snapshot = repository.save_execution_snapshot(
            plan.plan_id,
            plan.version,
            pipeline_result,
        )
        proposal = build_proposal(plan, pipeline_result)
        saved_proposal = repository.save_replan_proposal(
            plan.plan_id,
            execution_snapshot["id"],
            proposal,
        )
        proposal_before_apply = repository.get_replan_proposal(saved_proposal["id"])
        local_apply_result = ApplyReplanService().apply(
            ApplyReplanInput(plan=plan, proposal=proposal)
        )

    if proposal_before_apply is None:
        raise RuntimeError("Proposal was not saved before apply.")

    with TestClient(create_app()) as client:
        response = client.post(
            f"/api/plans/{plan.plan_id}/replan/{saved_proposal['id']}/apply"
        )
        if response.status_code != 200:
            raise RuntimeError(
                f"POST /api/plans/{plan.plan_id}/replan/{saved_proposal['id']}/apply failed: "
                f"{response.status_code} {response.text}"
            )
        payload = response.json()

    with Session(engine) as session:
        repository = PlanRepository(session)
        applied_proposal = repository.get_replan_proposal(saved_proposal["id"])
        updated_plan = repository.get(plan.plan_id)

    if applied_proposal is None or updated_plan is None:
        raise RuntimeError("Applied proposal or updated plan could not be loaded.")

    validation_result = validate_apply_proposal_api(
        plan_before_apply,
        plan.model_dump(mode="json"),
        proposal,
        proposal_before_apply,
        applied_proposal,
        saved_proposal,
        payload,
        updated_plan.model_dump(mode="json"),
        local_apply_result,
    )

    print("POST /api/plans/{plan_id}/replan/{proposal_id}/apply response:")
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    print("\nvalidation result:")
    print(json.dumps(validation_result, ensure_ascii=False, indent=2))

    if not all(validation_result.values()):
        raise RuntimeError("Apply proposal API validation failed.")


def build_proposal(plan: Any, pipeline_result: dict[str, Any]) -> dict[str, Any]:
    decision = ReplanDecisionService().decide(pipeline_result)
    replan_context = ReplanContextBuilder().build(plan, pipeline_result, decision)
    return RuleBasedReplanner().propose(replan_context)


def validate_apply_proposal_api(
    plan_before_apply: dict[str, Any],
    plan_after_local_apply: dict[str, Any],
    generated_proposal: dict[str, Any],
    proposal_before_apply: dict[str, Any],
    applied_proposal: dict[str, Any],
    saved_proposal: dict[str, Any],
    payload: dict[str, Any],
    updated_plan: dict[str, Any],
    local_apply_result: dict[str, Any],
) -> dict[str, bool]:
    response_plan = payload.get("updated_plan")
    response_plan_without_snapshot = strip_provider_snapshot(response_plan)
    return {
        "applied_true": payload.get("applied") is True,
        "proposal_id_present": isinstance(payload.get("proposal_id"), str)
        and bool(payload["proposal_id"]),
        "updated_plan_present": isinstance(payload.get("updated_plan"), dict),
        "accepted_true": applied_proposal.get("accepted") is True,
        "accepted_at_present": isinstance(applied_proposal.get("accepted_at"), str)
        and bool(applied_proposal["accepted_at"]),
        "proposal_unmodified_before_apply": proposal_before_apply == saved_proposal,
        "proposal_json_unchanged": applied_proposal.get("proposal_json") == saved_proposal.get(
            "proposal_json"
        ),
        "updated_plan_matches_repo": response_plan_without_snapshot == updated_plan,
        "provider_snapshot_synced": provider_snapshot_synced(response_plan, generated_proposal),
        "updated_plan_serializable": is_json_serializable(response_plan),
        "response_serializable": is_json_serializable(payload),
        "original_plan_unchanged_by_service": plan_before_apply == plan_after_local_apply,
        "local_apply_returned_plan": isinstance(local_apply_result.get("updated_plan"), dict),
        "local_apply_applied": local_apply_result.get("applied") is True,
        "target_card_replaced": target_card_replaced(
            plan_before_apply,
            response_plan_without_snapshot,
            generated_proposal,
        ),
    }


@contextmanager
def deterministic_weather() -> Any:
    original = weather_provider_module.OpenMeteoWeatherService.current_shanghai_weather

    def _rainy_weather(_self: Any) -> WeatherSnapshot:
        return WeatherSnapshot(
            condition="rain",
            temperature_c=21,
            rain_probability=100,
            summary="test: deterministic rainy weather for proposal apply validation",
        )

    weather_provider_module.OpenMeteoWeatherService.current_shanghai_weather = _rainy_weather
    try:
        yield
    finally:
        weather_provider_module.OpenMeteoWeatherService.current_shanghai_weather = original


def target_card_replaced(
    before_plan: dict[str, Any],
    updated_plan: dict[str, Any],
    proposal: dict[str, Any],
) -> bool:
    target_before = find_target_card(before_plan, proposal)
    target_after = find_target_card(updated_plan, proposal)
    if target_before is None or target_after is None:
        return False
    return target_before.get("poi", {}).get("poi_id") != target_after.get("poi", {}).get("poi_id")


def provider_snapshot_synced(updated_plan: dict[str, Any], proposal: dict[str, Any]) -> bool:
    target = find_target_card(updated_plan, proposal)
    if target is None:
        return False
    snapshot = target.get("provider_snapshot")
    new_poi = proposal.get("new_poi")
    if not isinstance(snapshot, dict) or not isinstance(new_poi, dict):
        return False
    keys = [
        "poi_id",
        "name",
        "category",
        "is_indoor",
        "queue_level",
        "booking_status",
        "hours_label",
        "queue_minutes",
        "estimated_wait_minutes",
        "estimated_total_for_family",
        "price_per_person",
        "source",
        "confidence",
        "fallback_reason",
        "is_open_at_arrival",
        "rating",
        "address",
        "district",
        "latitude",
        "longitude",
        "tags",
    ]
    return all(snapshot.get(key) == new_poi.get(key) for key in keys if key in new_poi)


def strip_provider_snapshot(plan: Any) -> dict[str, Any]:
    if not isinstance(plan, dict):
        return {}
    stripped = deepcopy(plan)
    for card in stripped.get("cards", []):
        if isinstance(card, dict):
            card.pop("provider_snapshot", None)
    return stripped


def find_target_card(plan: dict[str, Any], proposal: dict[str, Any]) -> dict[str, Any] | None:
    old_card_id = proposal.get("old_card_id")
    old_poi_id = proposal.get("old_poi_id")
    for card in plan.get("cards", []):
        if not isinstance(card, dict):
            continue
        if old_card_id and card.get("card_id") == old_card_id:
            return card
        poi = card.get("poi") if isinstance(card.get("poi"), dict) else {}
        if old_poi_id and poi.get("poi_id") == old_poi_id:
            return card
    return None


def asyncio_run(awaitable: Any) -> Any:
    import asyncio

    return asyncio.run(awaitable)


def is_json_serializable(value: Any) -> bool:
    try:
        json.dumps(value, ensure_ascii=False)
    except TypeError:
        return False
    return True


if __name__ == "__main__":
    main()
