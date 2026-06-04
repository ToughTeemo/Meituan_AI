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

from app.api.routes.plans import _auto_generate_replan_proposal
from app.core.database import create_db_and_tables, engine
from app.main import create_app
from app.providers import weather as weather_provider_module
from app.repositories.plan_repository import PlanRepository
from app.schemas.plan import CreatePlanRequest
from app.services.mvp_models import WeatherSnapshot


def main() -> None:
    create_db_and_tables()
    request = CreatePlanRequest(
        prompt=(
            "Shanghai weekend family half-day trip, prefer indoor fallback when "
            "execution check detects weather, booking, queue, or budget risk."
        ),
        city="Shanghai",
        session_id="check_auto_replan_generation_session",
        user_id="check_user",
    )

    with TestClient(create_app()) as client:
        create_response = client.post("/api/plans", json=request.model_dump(mode="json"))
        if create_response.status_code != 201:
            raise RuntimeError(
                f"POST /api/plans failed: {create_response.status_code} {create_response.text}"
            )
        plan_payload = create_response.json()
        plan_id = plan_payload["plan_id"]

        with deterministic_weather():
            execution_response = client.post(f"/api/plans/{plan_id}/execution/check")
        if execution_response.status_code != 200:
            raise RuntimeError(
                f"POST /api/plans/{plan_id}/execution/check failed: "
                f"{execution_response.status_code} {execution_response.text}"
            )
        execution_payload = execution_response.json()

        latest_execution_response = client.get(f"/api/plans/{plan_id}/execution/latest")
        if latest_execution_response.status_code != 200:
            raise RuntimeError(
                f"GET /api/plans/{plan_id}/execution/latest failed: "
                f"{latest_execution_response.status_code} {latest_execution_response.text}"
            )
        latest_execution_payload = latest_execution_response.json()

        latest_replan_response = client.get(f"/api/plans/{plan_id}/replan/latest")
        if latest_replan_response.status_code != 200:
            raise RuntimeError(
                f"GET /api/plans/{plan_id}/replan/latest failed: "
                f"{latest_replan_response.status_code} {latest_replan_response.text}"
            )
        latest_replan_payload = latest_replan_response.json()

        list_replan_response = client.get(f"/api/plans/{plan_id}/replans")
        if list_replan_response.status_code != 200:
            raise RuntimeError(
                f"GET /api/plans/{plan_id}/replans failed: "
                f"{list_replan_response.status_code} {list_replan_response.text}"
            )
        list_replan_payload = list_replan_response.json()

    with Session(engine) as session:
        repository = PlanRepository(session)
        plan = repository.get(plan_id)
        latest_snapshot = repository.get_latest_execution_snapshot(plan_id)
        if plan is None or latest_snapshot is None:
            raise RuntimeError("Failed to load plan or execution snapshot from repository.")

        proposals_before = repository.list_replan_proposals(plan_id)
        duplicate_result = _auto_generate_replan_proposal(
            plan=plan,
            pipeline_result=latest_snapshot,
            execution_snapshot_id=latest_snapshot["id"],
            repository=repository,
        )
        proposals_after = repository.list_replan_proposals(plan_id)
        latest_replan_record = repository.get_latest_replan_proposal(plan_id)
        proposal_by_snapshot = repository.get_replan_proposal_by_execution_snapshot_id(
            latest_snapshot["id"]
        )

    validation_result = {
        "execution_check_returns_risk_flags": bool(execution_payload.get("risk_flags")),
        "proposal_persisted_after_execution_check": isinstance(proposal_by_snapshot, dict),
        "latest_replan_readable": is_non_empty_text(latest_replan_payload.get("proposal_id"))
        and is_non_empty_text(latest_replan_payload.get("strategy"))
        and latest_replan_payload.get("proposal", {}).get("replanned") is True,
        "list_replan_readable": is_list_payload_valid(list_replan_payload),
        "list_sorted_desc": is_sorted_desc(list_replan_payload),
        "latest_and_list_match": latest_replan_payload.get("proposal")
        == first_list_item(list_replan_payload).get("proposal"),
        "dedupe_same_snapshot": len(proposals_before) == len(proposals_after)
        and duplicate_result is not None
        and latest_replan_record is not None,
        "responses_serializable": all(
            is_json_serializable(payload)
            for payload in [
                plan_payload,
                execution_payload,
                latest_execution_payload,
                latest_replan_payload,
                list_replan_payload,
            ]
        ),
    }

    print("POST /api/plans response:")
    print(json.dumps(plan_payload, ensure_ascii=False, indent=2))
    print("\nPOST /api/plans/{plan_id}/execution/check response:")
    print(json.dumps(execution_payload, ensure_ascii=False, indent=2))
    print("\nGET /api/plans/{plan_id}/execution/latest response:")
    print(json.dumps(latest_execution_payload, ensure_ascii=False, indent=2))
    print("\nGET /api/plans/{plan_id}/replan/latest response:")
    print(json.dumps(latest_replan_payload, ensure_ascii=False, indent=2))
    print("\nGET /api/plans/{plan_id}/replans response:")
    print(json.dumps(list_replan_payload, ensure_ascii=False, indent=2))
    print("\nvalidation result:")
    print(json.dumps(validation_result, ensure_ascii=False, indent=2))

    if not all(validation_result.values()):
        raise RuntimeError("Auto replan generation validation failed.")


@contextmanager
def deterministic_weather() -> Any:
    original = weather_provider_module.OpenMeteoWeatherService.current_shanghai_weather

    def _rainy_weather(_self: Any) -> WeatherSnapshot:
        return WeatherSnapshot(
            condition="rain",
            temperature_c=21,
            rain_probability=100,
            summary="test: deterministic rainy weather for auto replan generation",
        )

    weather_provider_module.OpenMeteoWeatherService.current_shanghai_weather = _rainy_weather
    try:
        yield
    finally:
        weather_provider_module.OpenMeteoWeatherService.current_shanghai_weather = original


def is_list_payload_valid(payload: dict[str, Any]) -> bool:
    proposals = payload.get("proposals")
    return isinstance(payload.get("plan_id"), str) and isinstance(proposals, list)


def is_sorted_desc(payload: dict[str, Any]) -> bool:
    proposals = payload.get("proposals")
    if not isinstance(proposals, list):
        return False
    created_at_values = [
        item.get("created_at")
        for item in proposals
        if isinstance(item, dict) and isinstance(item.get("created_at"), str)
    ]
    return created_at_values == sorted(created_at_values, reverse=True)


def first_list_item(payload: dict[str, Any]) -> dict[str, Any]:
    proposals = payload.get("proposals")
    if isinstance(proposals, list) and proposals and isinstance(proposals[0], dict):
        return proposals[0]
    return {}


def is_non_empty_text(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def is_json_serializable(value: Any) -> bool:
    try:
        json.dumps(value, ensure_ascii=False)
    except TypeError:
        return False
    return True


if __name__ == "__main__":
    main()
