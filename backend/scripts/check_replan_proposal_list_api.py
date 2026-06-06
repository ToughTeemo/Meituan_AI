from __future__ import annotations

import json
import os
import sys
import time
from contextlib import contextmanager
from copy import deepcopy
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
from app.providers import weather as weather_provider_module
from app.repositories.plan_repository import PlanRepository
from app.schemas.plan import CreatePlanRequest
from app.services.execution_pipeline import ExecutionPipeline
from app.services.mvp_models import WeatherSnapshot
from app.services.planning_service import PlanningService
from app.services.replan_context_builder import ReplanContextBuilder
from app.services.replan_decision_service import ReplanDecisionService
from app.services.rule_based_replanner import RuleBasedReplanner

REQUIRED_PROPOSAL_FIELDS = {
    "proposal_id",
    "status",
    "strategy",
    "risk_type",
    "accepted",
    "accepted_at",
    "created_at",
    "proposal",
}


def main() -> None:
    create_db_and_tables()
    request = CreatePlanRequest(
        prompt=(
            "Shanghai weekend family half-day trip, budget friendly, prefer indoor "
            "fallback if execution check finds weather risk."
        ),
        city="Shanghai",
        session_id="check_replan_proposal_list_api_session",
        user_id="check_user",
    )

    with Session(engine) as session:
        repository = PlanRepository(session)
        plan = PlanningService(repository).create_plan(request)
        with deterministic_weather():
            pipeline_result = asyncio_run(ExecutionPipeline().run(plan))

        execution_snapshot = repository.save_execution_snapshot(
            plan.plan_id,
            plan.version,
            pipeline_result,
        )
        first_proposal = build_replan_proposal(plan, pipeline_result)
        saved_first = repository.save_replan_proposal(
            plan.plan_id,
            execution_snapshot["id"],
            first_proposal,
        )

        time.sleep(0.01)
        second_proposal = proposal_variant(first_proposal, suffix="second")
        saved_second = repository.save_replan_proposal(
            plan.plan_id,
            execution_snapshot["id"],
            second_proposal,
        )

        accepted_first = repository.accept_replan_proposal(saved_first["id"])
        if accepted_first is None:
            raise RuntimeError("First proposal could not be accepted for status validation.")

        expected_proposals = [saved_second, accepted_first]
        before_plan = dump_model(repository.get(plan.plan_id))
        before_versions = dump_models(repository.list_versions(plan.plan_id))

    with TestClient(create_app()) as client:
        response = client.get(f"/api/plans/{plan.plan_id}/replans")
        if response.status_code != 200:
            raise RuntimeError(
                f"GET /api/plans/{plan.plan_id}/replans failed: "
                f"{response.status_code} {response.text}"
            )
        payload = response.json()

    with Session(engine) as session:
        repository = PlanRepository(session)
        after_plan = dump_model(repository.get(plan.plan_id))
        after_versions = dump_models(repository.list_versions(plan.plan_id))

    if before_plan is None or after_plan is None:
        raise RuntimeError("Plan was not available for comparison.")

    validation_result = validate_replan_proposal_list_api(
        plan.plan_id,
        expected_proposals,
        payload,
        before_plan,
        after_plan,
        before_versions,
        after_versions,
    )

    print("GET /api/plans/{plan_id}/replans response:")
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    print("\nvalidation result:")
    print(json.dumps(validation_result, ensure_ascii=False, indent=2))

    if not all(validation_result.values()):
        raise RuntimeError("Replan proposal list API validation failed.")


def build_replan_proposal(plan: Any, pipeline_result: dict[str, Any]) -> dict[str, Any]:
    decision = ReplanDecisionService().decide(pipeline_result)
    replan_context = ReplanContextBuilder().build(plan, pipeline_result, decision)
    return RuleBasedReplanner().propose(replan_context)


def proposal_variant(proposal: dict[str, Any], suffix: str) -> dict[str, Any]:
    variant = deepcopy(proposal)
    summary = variant.get("proposal_summary")
    if isinstance(summary, str) and summary:
        variant["proposal_summary"] = f"{summary} ({suffix})"
    else:
        variant["proposal_summary"] = suffix
    return variant


def validate_replan_proposal_list_api(
    plan_id: str,
    expected_proposals: list[dict[str, Any]],
    payload: dict[str, Any],
    before_plan: dict[str, Any],
    after_plan: dict[str, Any],
    before_versions: list[Any],
    after_versions: list[Any],
) -> dict[str, bool]:
    proposals = payload.get("proposals")
    response_proposals = proposals if isinstance(proposals, list) else []
    expected_by_id = {proposal["id"]: proposal for proposal in expected_proposals}
    response_ids = [item.get("proposal_id") for item in response_proposals]
    created_at_values = [
        item.get("created_at")
        for item in response_proposals
        if isinstance(item.get("created_at"), str)
    ]

    return {
        "top_level_shape": set(payload.keys()) == {"plan_id", "proposals"},
        "plan_id_matches": payload.get("plan_id") == plan_id,
        "proposal_count_correct": len(response_proposals) == len(expected_proposals),
        "proposal_ids_correct": response_ids
        == [proposal["id"] for proposal in expected_proposals],
        "created_at_desc": created_at_values == sorted(created_at_values, reverse=True)
        and len(created_at_values) == len(response_proposals),
        "fields_complete": all(
            isinstance(item, dict) and set(item.keys()) == REQUIRED_PROPOSAL_FIELDS
            for item in response_proposals
        ),
        "no_updated_plan_returned": "updated_plan" not in payload
        and all("updated_plan" not in item for item in response_proposals),
        "status_values_valid": all(
            item.get("status") in {"PENDING", "APPLIED"} for item in response_proposals
        ),
        "status_correct": all(
            item.get("status") == status_for(expected_by_id.get(str(item.get("proposal_id"))))
            for item in response_proposals
        ),
        "accepted_fields_correct": all(
            accepted_fields_match(item, expected_by_id.get(str(item.get("proposal_id"))))
            for item in response_proposals
        ),
        "proposal_payloads_match": all(
            item.get("proposal")
            == expected_by_id.get(str(item.get("proposal_id")), {}).get("proposal")
            for item in response_proposals
        ),
        "plan_unchanged": before_plan == after_plan,
        "plan_version_unchanged": before_plan.get("version") == after_plan.get("version"),
        "versions_unchanged": before_versions == after_versions,
        "response_serializable": is_json_serializable(payload),
    }


def status_for(proposal: dict[str, Any] | None) -> str:
    if not proposal:
        return ""
    return "APPLIED" if proposal.get("accepted") is True else "PENDING"


def accepted_fields_match(
    response_item: dict[str, Any],
    expected: dict[str, Any] | None,
) -> bool:
    if expected is None:
        return False
    return (
        response_item.get("accepted") == expected.get("accepted")
        and response_item.get("accepted_at") == expected.get("accepted_at")
    )


@contextmanager
def deterministic_weather() -> Any:
    original = weather_provider_module.OpenMeteoWeatherService.current_shanghai_weather

    def _rainy_weather(_self: Any) -> WeatherSnapshot:
        return WeatherSnapshot(
            condition="rain",
            temperature_c=21,
            rain_probability=100,
            summary="test: deterministic rainy weather for proposal list validation",
        )

    weather_provider_module.OpenMeteoWeatherService.current_shanghai_weather = _rainy_weather
    try:
        yield
    finally:
        weather_provider_module.OpenMeteoWeatherService.current_shanghai_weather = original


def asyncio_run(awaitable: Any) -> Any:
    import asyncio

    return asyncio.run(awaitable)


def dump_model(value: Any) -> Any:
    if value is None:
        return None
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    return value


def dump_models(values: list[Any]) -> list[Any]:
    return [dump_model(value) for value in values]


def is_json_serializable(value: Any) -> bool:
    try:
        json.dumps(value, ensure_ascii=False)
    except TypeError:
        return False
    return True


if __name__ == "__main__":
    main()
