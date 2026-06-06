from __future__ import annotations

import asyncio
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
os.environ["DEMO_MODE"] = "true"

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.api.routes.plans import _auto_generate_replan_proposal
from app.core.config import settings
from app.core.database import create_db_and_tables, engine
from app.main import create_app
from app.repositories.plan_repository import PlanRepository
from app.schemas.plan import CreatePlanRequest
from app.services.execution_pipeline import ExecutionPipeline
from app.services.llm_client import DeepSeekClient
from app.services.llm_replanner import LlmReplanner
from app.services.replan_context_builder import ReplanContextBuilder
from app.services.replan_decision_service import ReplanDecisionService


def main() -> None:
    create_db_and_tables()
    original_provider = settings.replanner_provider
    original_mock = settings.llm_replanner_mock
    original_api_key = settings.deepseek_api_key
    try:
        settings.replanner_provider = "llm"

        mock_route_payload = run_route_flow(
            session_id="deepseek_mock_weather_risk",
            llm_mock=True,
            deepseek_api_key=None,
        )
        missing_key_route_payload = run_route_flow(
            session_id="deepseek_missing_key_weather_risk",
            llm_mock=False,
            deepseek_api_key="",
        )

        direct_context = build_replan_context("deepseek_direct_weather_risk")

        missing_key_direct_result = run_direct_fallback(
            direct_context,
            llm_mock=False,
            deepseek_api_key="",
            patch_return_value=None,
        )
        invalid_json_result = run_direct_fallback(
            direct_context,
            llm_mock=False,
            deepseek_api_key="test-key",
            patch_return_value="not json",
        )
        invalid_target_result = run_direct_fallback(
            direct_context,
            llm_mock=False,
            deepseek_api_key="test-key",
            patch_return_value=json.dumps(
                {
                    "strategy": "INDOOR_FALLBACK",
                    "reason": "invalid target",
                    "proposal_summary": "invalid target",
                    "target_poi_id": "poi_not_a_candidate",
                },
                ensure_ascii=False,
            ),
        )

        validation_result = {
            "mock_mode_still_works": is_route_flow_compatible(mock_route_payload),
            "missing_api_key_fallback": (
                missing_key_direct_result["fallback_reason"] == "deepseek_missing_api_key"
                and is_standard_proposal(missing_key_direct_result["proposal"])
            ),
            "invalid_json_fallback": (
                invalid_json_result["fallback_reason"] == "deepseek_invalid_json"
                and is_standard_proposal(invalid_json_result["proposal"])
            ),
            "invalid_target_fallback": (
                invalid_target_result["fallback_reason"] == "deepseek_invalid_target_poi_id"
                and is_standard_proposal(invalid_target_result["proposal"])
            ),
            "schema_compatible": all(
                is_standard_proposal(item)
                for item in [
                    mock_route_payload["latest"].get("proposal"),
                    missing_key_route_payload["latest"].get("proposal"),
                    mock_route_payload["apply"].get("proposal"),
                    missing_key_route_payload["apply"].get("proposal"),
                ]
            ),
            "proposal_persistence": (
                is_non_empty_text(mock_route_payload["latest"].get("proposal_id"))
                and is_non_empty_text(missing_key_route_payload["latest"].get("proposal_id"))
            ),
            "latest_list_apply_compatibility": (
                is_route_flow_compatible(mock_route_payload)
                and is_route_flow_compatible(missing_key_route_payload)
            ),
            "responses_serializable": all(
                is_json_serializable(value)
                for value in [
                    mock_route_payload["create"],
                    mock_route_payload["execution"],
                    mock_route_payload["latest"],
                    mock_route_payload["list"],
                    mock_route_payload["apply"],
                    missing_key_route_payload["create"],
                    missing_key_route_payload["execution"],
                    missing_key_route_payload["latest"],
                    missing_key_route_payload["list"],
                    missing_key_route_payload["apply"],
                ]
            ),
        }

        print("mock route payload:")
        print(json.dumps(mock_route_payload, ensure_ascii=False, indent=2))
        print("\nmissing-key route payload:")
        print(json.dumps(missing_key_route_payload, ensure_ascii=False, indent=2))
        print("\ninvalid-json fallback result:")
        print(json.dumps(invalid_json_result, ensure_ascii=False, indent=2))
        print("\ninvalid-target fallback result:")
        print(json.dumps(invalid_target_result, ensure_ascii=False, indent=2))
        print("\nvalidation result:")
        print(json.dumps(validation_result, ensure_ascii=False, indent=2))

        if not all(validation_result.values()):
            raise RuntimeError("DeepSeek replanner validation failed.")
    finally:
        settings.replanner_provider = original_provider
        settings.llm_replanner_mock = original_mock
        settings.deepseek_api_key = original_api_key


def run_route_flow(
    session_id: str,
    llm_mock: bool,
    deepseek_api_key: str | None,
) -> dict[str, Any]:
    original_mock = settings.llm_replanner_mock
    original_api_key = settings.deepseek_api_key
    try:
        settings.llm_replanner_mock = llm_mock
        settings.deepseek_api_key = deepseek_api_key

        with TestClient(create_app()) as client:
            create_response = client.post(
                "/api/plans",
                json=CreatePlanRequest(
                    prompt=(
                        "DeepSeek replanner validation for weather risk. "
                        "Prefer indoor fallback when replan is required."
                    ),
                    city="Shanghai",
                    session_id=session_id,
                    user_id="deepseek_check_user",
                ).model_dump(mode="json"),
            )
            ensure_status(create_response.status_code, 201, create_response.text)
            create_payload = create_response.json()
            plan_id = create_payload["plan_id"]

            execution_response = client.post(f"/api/plans/{plan_id}/execution/check")
            ensure_status(execution_response.status_code, 200, execution_response.text)
            execution_payload = execution_response.json()

            latest_response = client.get(f"/api/plans/{plan_id}/replan/latest")
            ensure_status(latest_response.status_code, 200, latest_response.text)
            latest_payload = latest_response.json()

            list_response = client.get(f"/api/plans/{plan_id}/replans")
            ensure_status(list_response.status_code, 200, list_response.text)
            list_payload = list_response.json()

            proposal_id = latest_payload.get("proposal_id")
            apply_response = client.post(
                f"/api/plans/{plan_id}/replan/{proposal_id}/apply"
            )
            ensure_status(apply_response.status_code, 200, apply_response.text)
            apply_payload = apply_response.json()

        return {
            "create": create_payload,
            "execution": execution_payload,
            "latest": latest_payload,
            "list": list_payload,
            "apply": apply_payload,
        }
    finally:
        settings.llm_replanner_mock = original_mock
        settings.deepseek_api_key = original_api_key


def build_replan_context(session_id: str) -> dict[str, Any]:
    create_db_and_tables()
    with TestClient(create_app()) as client:
        create_response = client.post(
            "/api/plans",
            json=CreatePlanRequest(
                prompt="Build context for DeepSeek replanner validation.",
                city="Shanghai",
                session_id=session_id,
                user_id="deepseek_context_user",
            ).model_dump(mode="json"),
        )
        ensure_status(create_response.status_code, 201, create_response.text)
        plan_id = create_response.json()["plan_id"]

    with Session(engine) as session:
        repository = PlanRepository(session)
        plan = repository.get(plan_id)
        if plan is None:
            raise RuntimeError("Failed to load plan for DeepSeek context build.")

    pipeline_result = asyncio.run(ExecutionPipeline().run(plan))
    decision = ReplanDecisionService().decide(pipeline_result)
    return ReplanContextBuilder().build(plan, pipeline_result, decision)


def run_direct_fallback(
    context: dict[str, Any],
    llm_mock: bool,
    deepseek_api_key: str | None,
    patch_return_value: str | None,
) -> dict[str, Any]:
    original_mock = settings.llm_replanner_mock
    original_api_key = settings.deepseek_api_key
    original_method = DeepSeekClient.complete_json
    try:
        settings.llm_replanner_mock = llm_mock
        settings.deepseek_api_key = deepseek_api_key

        if patch_return_value is not None:
            def _patched_complete_json(
                self: DeepSeekClient,
                system_prompt: str,
                user_prompt: str,
            ) -> str:
                return patch_return_value

            DeepSeekClient.complete_json = _patched_complete_json  # type: ignore[assignment]
        replanner = LlmReplanner()
        proposal = replanner.propose(context)
        return {
            "fallback_reason": replanner.last_fallback_reason,
            "proposal": proposal,
        }
    finally:
        DeepSeekClient.complete_json = original_method  # type: ignore[assignment]
        settings.llm_replanner_mock = original_mock
        settings.deepseek_api_key = original_api_key


def is_route_flow_compatible(payload: dict[str, Any]) -> bool:
    latest = payload.get("latest", {})
    list_payload = payload.get("list", {})
    apply_payload = payload.get("apply", {})
    return (
        is_non_empty_text(latest.get("proposal_id"))
        and is_standard_proposal(latest.get("proposal"))
        and latest.get("proposal") == first_list_item(list_payload).get("proposal") == apply_payload.get("proposal")
        and isinstance(apply_payload.get("updated_plan"), dict)
    )


def is_standard_proposal(value: object) -> bool:
    if not isinstance(value, dict):
        return False
    required = {
        "replanned",
        "strategy",
        "risk_type",
        "reason",
        "proposal_summary",
        "old_poi",
        "new_poi",
        "requires_user_confirmation",
        "old_card_id",
        "old_poi_id",
    }
    old_poi = value.get("old_poi")
    new_poi = value.get("new_poi")
    return (
        set(value.keys()) == required
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
    )


def first_list_item(payload: dict[str, Any]) -> dict[str, Any]:
    proposals = payload.get("proposals")
    if isinstance(proposals, list) and proposals and isinstance(proposals[0], dict):
        return proposals[0]
    return {}


def ensure_status(status_code: int, expected: int, body: str) -> None:
    if status_code != expected:
        raise RuntimeError(f"request failed: {status_code} {body}")


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
