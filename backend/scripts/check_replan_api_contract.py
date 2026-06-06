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
from app.services.planning_service import PlanningService
from app.services.replan_context_builder import ReplanContextBuilder
from app.services.replan_decision_service import ReplanDecisionService
from app.services.rule_based_replanner import RuleBasedReplanner
from app.services.mvp_models import WeatherSnapshot


def main() -> None:
    create_db_and_tables()
    request = CreatePlanRequest(
        prompt=(
            "周末带孩子在上海玩半天，预算不要太高，优先室内，"
            "如果遇到天气风险就切换到可确认的重规划方案"
        ),
        city="上海",
        session_id="check_replan_api_contract_session",
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
        proposal = build_proposal(plan, pipeline_result)
        saved_proposal = repository.save_replan_proposal(
            plan.plan_id,
            execution_snapshot["id"],
            proposal,
        )

    with TestClient(create_app()) as client:
        latest_response = client.get(f"/api/plans/{plan.plan_id}/replan/latest")
        if latest_response.status_code != 200:
            raise RuntimeError(
                f"GET /api/plans/{plan.plan_id}/replan/latest failed: "
                f"{latest_response.status_code} {latest_response.text}"
            )
        latest_payload = latest_response.json()

        apply_response = client.post(
            f"/api/plans/{plan.plan_id}/replan/{saved_proposal['id']}/apply"
        )
        if apply_response.status_code != 200:
            raise RuntimeError(
                f"POST /api/plans/{plan.plan_id}/replan/{saved_proposal['id']}/apply failed: "
                f"{apply_response.status_code} {apply_response.text}"
            )
        apply_payload = apply_response.json()

    validation_result = validate_contract(
        latest_payload,
        apply_payload,
        proposal,
        saved_proposal,
    )

    print("GET /api/plans/{plan_id}/replan/latest response:")
    print(json.dumps(latest_payload, ensure_ascii=False, indent=2))
    print("\nPOST /api/plans/{plan_id}/replan/{proposal_id}/apply response:")
    print(json.dumps(apply_payload, ensure_ascii=False, indent=2))
    print("\nvalidation result:")
    print(json.dumps(validation_result, ensure_ascii=False, indent=2))

    if not all(validation_result.values()):
        raise RuntimeError("Replan API contract validation failed.")


def build_proposal(plan: Any, pipeline_result: dict[str, Any]) -> dict[str, Any]:
    decision = ReplanDecisionService().decide(pipeline_result)
    replan_context = ReplanContextBuilder().build(plan, pipeline_result, decision)
    return RuleBasedReplanner().propose(replan_context)


def validate_contract(
    latest_payload: dict[str, Any],
    apply_payload: dict[str, Any],
    generated_proposal: dict[str, Any],
    saved_proposal: dict[str, Any],
) -> dict[str, bool]:
    latest_expected = {
        "proposal_id",
        "plan_id",
        "execution_snapshot_id",
        "status",
        "strategy",
        "risk_type",
        "accepted",
        "accepted_at",
        "created_at",
        "proposal",
        "updated_plan",
    }
    apply_expected = latest_expected
    return {
        "latest_fields_complete": expected_fields(latest_payload, latest_expected),
        "apply_fields_complete": expected_fields(apply_payload, apply_expected),
        "latest_status_pending": latest_payload.get("status") == "PENDING",
        "apply_status_applied": apply_payload.get("status") == "APPLIED",
        "proposal_id_consistent": latest_payload.get("proposal_id")
        == apply_payload.get("proposal_id")
        == saved_proposal.get("id"),
        "proposal_equal": latest_payload.get("proposal") == apply_payload.get("proposal")
        == generated_proposal,
        "latest_accepted_false": latest_payload.get("accepted") is False,
        "latest_accepted_at_null": latest_payload.get("accepted_at") is None,
        "apply_accepted_true": apply_payload.get("accepted") is True,
        "apply_accepted_at_present": isinstance(apply_payload.get("accepted_at"), str)
        and bool(apply_payload["accepted_at"]),
        "latest_updated_plan_null": latest_payload.get("updated_plan") is None,
        "apply_updated_plan_present": isinstance(apply_payload.get("updated_plan"), dict),
        "response_serializable": is_json_serializable(latest_payload)
        and is_json_serializable(apply_payload),
    }


def expected_fields(payload: dict[str, Any], expected: set[str]) -> bool:
    return isinstance(payload, dict) and expected.issubset(payload.keys())
@contextmanager
def deterministic_weather() -> Any:
    original = weather_provider_module.OpenMeteoWeatherService.current_shanghai_weather

    def _rainy_weather(_self: Any) -> WeatherSnapshot:
        return WeatherSnapshot(
            condition="rain",
            temperature_c=21,
            rain_probability=100,
            summary="test: deterministic rainy weather for replan contract validation",
        )

    weather_provider_module.OpenMeteoWeatherService.current_shanghai_weather = _rainy_weather
    try:
        yield
    finally:
        weather_provider_module.OpenMeteoWeatherService.current_shanghai_weather = original


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
