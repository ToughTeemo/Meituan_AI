from __future__ import annotations

import json
import os
import sys
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
from app.providers import weather as weather_provider_module
from app.repositories.plan_repository import PlanRepository
from app.schemas.plan import CreatePlanRequest
from app.services.execution_pipeline import ExecutionPipeline
from app.services.mvp_models import WeatherSnapshot
from app.services.planning_service import PlanningService
from app.services.replan_context_builder import ReplanContextBuilder
from app.services.replan_decision_service import ReplanDecisionService
from app.services.rule_based_replanner import RuleBasedReplanner

PROPOSAL_CORE_FIELDS = {
    "replanned",
    "strategy",
    "risk_type",
    "reason",
    "proposal_summary",
    "old_poi",
    "new_poi",
    "requires_user_confirmation",
}
PROPOSAL_COMPATIBILITY_FIELDS = {"old_card_id", "old_poi_id"}
PROPOSAL_SCHEMA_FIELDS = PROPOSAL_CORE_FIELDS | PROPOSAL_COMPATIBILITY_FIELDS


def main() -> None:
    create_db_and_tables()
    request = CreatePlanRequest(
        prompt=(
            "Shanghai weekend family half-day trip, budget friendly, prefer indoor "
            "fallback if execution check finds weather risk."
        ),
        city="Shanghai",
        session_id="check_proposal_schema_session",
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
        generated_proposal = build_replan_proposal(plan, pipeline_result)
        saved_proposal = repository.save_replan_proposal(
            plan.plan_id,
            execution_snapshot["id"],
            generated_proposal,
        )
        plan_before_reads = dump_model(repository.get(plan.plan_id))
        versions_before_reads = dump_models(repository.list_versions(plan.plan_id))

    with TestClient(create_app()) as client:
        latest_response = client.get(f"/api/plans/{plan.plan_id}/replan/latest")
        if latest_response.status_code != 200:
            raise RuntimeError(
                f"GET /api/plans/{plan.plan_id}/replan/latest failed: "
                f"{latest_response.status_code} {latest_response.text}"
            )
        latest_payload = latest_response.json()

        list_response = client.get(f"/api/plans/{plan.plan_id}/replans")
        if list_response.status_code != 200:
            raise RuntimeError(
                f"GET /api/plans/{plan.plan_id}/replans failed: "
                f"{list_response.status_code} {list_response.text}"
            )
        list_payload = list_response.json()

    with Session(engine) as session:
        repository = PlanRepository(session)
        plan_after_reads = dump_model(repository.get(plan.plan_id))
        versions_after_reads = dump_models(repository.list_versions(plan.plan_id))

    with TestClient(create_app()) as client:
        apply_response = client.post(
            f"/api/plans/{plan.plan_id}/replan/{saved_proposal['id']}/apply"
        )
        if apply_response.status_code != 200:
            raise RuntimeError(
                f"POST /api/plans/{plan.plan_id}/replan/{saved_proposal['id']}/apply failed: "
                f"{apply_response.status_code} {apply_response.text}"
            )
        apply_payload = apply_response.json()

        list_after_apply_response = client.get(f"/api/plans/{plan.plan_id}/replans")
        if list_after_apply_response.status_code != 200:
            raise RuntimeError(
                f"GET /api/plans/{plan.plan_id}/replans after apply failed: "
                f"{list_after_apply_response.status_code} {list_after_apply_response.text}"
            )
        list_after_apply_payload = list_after_apply_response.json()

    validation_result = validate_proposal_schema(
        generated_proposal=generated_proposal,
        saved_proposal=saved_proposal,
        latest_payload=latest_payload,
        list_payload=list_payload,
        apply_payload=apply_payload,
        list_after_apply_payload=list_after_apply_payload,
        plan_before_reads=plan_before_reads,
        plan_after_reads=plan_after_reads,
        versions_before_reads=versions_before_reads,
        versions_after_reads=versions_after_reads,
    )

    print("proposal schema fields:")
    print(json.dumps(sorted(PROPOSAL_SCHEMA_FIELDS), ensure_ascii=False, indent=2))
    print("\nGET /api/plans/{plan_id}/replan/latest response:")
    print(json.dumps(latest_payload, ensure_ascii=False, indent=2))
    print("\nGET /api/plans/{plan_id}/replans response:")
    print(json.dumps(list_payload, ensure_ascii=False, indent=2))
    print("\nPOST /api/plans/{plan_id}/replan/{proposal_id}/apply response:")
    print(json.dumps(apply_payload, ensure_ascii=False, indent=2))
    print("\nvalidation result:")
    print(json.dumps(validation_result, ensure_ascii=False, indent=2))

    if not all(validation_result.values()):
        raise RuntimeError("Proposal schema validation failed.")


def build_replan_proposal(plan: Any, pipeline_result: dict[str, Any]) -> dict[str, Any]:
    decision = ReplanDecisionService().decide(pipeline_result)
    replan_context = ReplanContextBuilder().build(plan, pipeline_result, decision)
    return RuleBasedReplanner().propose(replan_context)


def validate_proposal_schema(
    generated_proposal: dict[str, Any],
    saved_proposal: dict[str, Any],
    latest_payload: dict[str, Any],
    list_payload: dict[str, Any],
    apply_payload: dict[str, Any],
    list_after_apply_payload: dict[str, Any],
    plan_before_reads: dict[str, Any] | None,
    plan_after_reads: dict[str, Any] | None,
    versions_before_reads: list[Any],
    versions_after_reads: list[Any],
) -> dict[str, bool]:
    list_item = first_list_item(list_payload)
    list_after_apply_item = first_list_item(list_after_apply_payload)
    latest_proposal = dict_value(latest_payload.get("proposal"))
    list_proposal = dict_value(list_item.get("proposal"))
    apply_proposal = dict_value(apply_payload.get("proposal"))
    list_after_apply_proposal = dict_value(list_after_apply_item.get("proposal"))

    return {
        "generated_schema_standard": is_standard_proposal(generated_proposal),
        "saved_proposal_schema_standard": is_standard_proposal(saved_proposal.get("proposal")),
        "latest_schema_standard": is_standard_proposal(latest_proposal),
        "list_schema_standard": is_standard_proposal(list_proposal),
        "apply_schema_standard": is_standard_proposal(apply_proposal),
        "list_after_apply_schema_standard": is_standard_proposal(list_after_apply_proposal),
        "latest_list_apply_proposal_equal": latest_proposal
        == list_proposal
        == apply_proposal
        == list_after_apply_proposal,
        "risk_type_synced_latest": latest_payload.get("risk_type")
        == latest_proposal.get("risk_type"),
        "risk_type_synced_list": list_item.get("risk_type") == list_proposal.get("risk_type"),
        "risk_type_synced_apply": apply_payload.get("risk_type")
        == apply_proposal.get("risk_type"),
        "pending_status_before_apply": latest_payload.get("status") == "PENDING"
        and list_item.get("status") == "PENDING",
        "applied_status_after_apply": apply_payload.get("status") == "APPLIED"
        and list_after_apply_item.get("status") == "APPLIED",
        "read_endpoints_do_not_modify_plan": plan_before_reads == plan_after_reads
        and versions_before_reads == versions_after_reads,
        "apply_returns_updated_plan": isinstance(apply_payload.get("updated_plan"), dict),
        "responses_serializable": all(
            is_json_serializable(payload)
            for payload in [
                latest_payload,
                list_payload,
                apply_payload,
                list_after_apply_payload,
            ]
        ),
    }


def is_standard_proposal(value: Any) -> bool:
    if not isinstance(value, dict):
        return False
    old_poi = value.get("old_poi")
    new_poi = value.get("new_poi")
    return (
        set(value.keys()) == PROPOSAL_SCHEMA_FIELDS
        and value.get("replanned") is True
        and is_non_empty_text(value.get("strategy"))
        and is_non_empty_text(value.get("risk_type"))
        and is_non_empty_text(value.get("reason"))
        and is_non_empty_text(value.get("proposal_summary"))
        and isinstance(old_poi, dict)
        and is_non_empty_text(old_poi.get("poi_id"))
        and isinstance(new_poi, dict)
        and is_non_empty_text(new_poi.get("poi_id"))
        and value.get("requires_user_confirmation") is True
        and is_non_empty_text(value.get("old_card_id"))
        and value.get("old_poi_id") == old_poi.get("poi_id")
        and value.get("old_poi_id") != new_poi.get("poi_id")
    )


def first_list_item(payload: dict[str, Any]) -> dict[str, Any]:
    proposals = payload.get("proposals")
    if isinstance(proposals, list) and proposals and isinstance(proposals[0], dict):
        return proposals[0]
    return {}


def dict_value(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def is_non_empty_text(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


@contextmanager
def deterministic_weather() -> Any:
    original = weather_provider_module.OpenMeteoWeatherService.current_shanghai_weather

    def _rainy_weather(_self: Any) -> WeatherSnapshot:
        return WeatherSnapshot(
            condition="rain",
            temperature_c=21,
            rain_probability=100,
            summary="test: deterministic rainy weather for proposal schema validation",
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
