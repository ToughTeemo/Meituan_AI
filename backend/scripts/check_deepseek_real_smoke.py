from __future__ import annotations

import asyncio
import json
import os
import sys
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Callable

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ["PLANNING_PROVIDER"] = "rule_based"
os.environ["REPLANNER_PROVIDER"] = "llm"
os.environ["LLM_REPLANNER_MOCK"] = "false"
os.environ["DEMO_MODE"] = "true"
os.environ.setdefault("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
os.environ.setdefault("DEEPSEEK_MODEL", "deepseek-chat")

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.core.database import create_db_and_tables, engine
from app.main import create_app
from app.repositories.plan_repository import PlanRepository
from app.schemas.plan import CreatePlanRequest
from app.services.execution_pipeline import ExecutionPipeline
from app.services.llm_replanner import LlmReplanner
from app.services.replan_context_builder import ReplanContextBuilder
from app.services.replan_decision_service import ReplanDecisionService


def main() -> None:
    create_db_and_tables()

    original_provider = settings.replanner_provider
    original_mock = settings.llm_replanner_mock
    original_api_key = settings.deepseek_api_key
    original_base_url = settings.deepseek_base_url
    original_model = settings.deepseek_model
    try:
        settings.replanner_provider = "llm"
        settings.llm_replanner_mock = False

        env_report = masked_env_report()
        print("environment:")
        print(json.dumps(env_report, ensure_ascii=False, indent=2))
        print(f"deepseek_model={settings.deepseek_model}")

        with record_urlopen_calls() as urlopen_stats:
            with TestClient(create_app()) as client:
                create_payload = create_plan(client)
                plan_id = create_payload["plan_id"]

                execution_payload = client.post(
                    f"/api/plans/{plan_id}/execution/check"
                ).json()
                latest_payload = client.get(f"/api/plans/{plan_id}/replan/latest").json()
                list_payload = client.get(f"/api/plans/{plan_id}/replans").json()

            direct_context = build_replan_context(plan_id)
            direct_replanner = LlmReplanner()
            direct_proposal = direct_replanner.propose(direct_context)

            with TestClient(create_app()) as client:
                apply_payload = client.post(
                    f"/api/plans/{plan_id}/replan/{latest_payload['proposal_id']}/apply"
                ).json()

        proposal = latest_payload.get("proposal", {})
        validation_result = {
            "real_deepseek_called": urlopen_stats["count"] > 0,
            "proposal_schema_valid": is_standard_proposal(proposal),
            "latest_readable": is_latest_payload_valid(latest_payload),
            "list_readable": is_list_payload_valid(list_payload),
            "apply_success": apply_payload.get("status") == "APPLIED"
            and isinstance(apply_payload.get("updated_plan"), dict),
            "proposal_persisted": is_non_empty_text(latest_payload.get("proposal_id")),
            "target_from_candidates": proposal_target_in_candidates(direct_context, proposal),
            "direct_call_schema_valid": is_standard_proposal(direct_proposal),
            "direct_call_no_fallback": direct_replanner.last_fallback_reason is None,
            "responses_serializable": all(
                is_json_serializable(value)
                for value in [
                    create_payload,
                    execution_payload,
                    latest_payload,
                    list_payload,
                    apply_payload,
                    direct_proposal,
                ]
            ),
        }

        print("\ncreate response:")
        print(json.dumps(create_payload, ensure_ascii=False, indent=2))
        print("\nexecution response:")
        print(json.dumps(execution_payload, ensure_ascii=False, indent=2))
        print("\nlatest response:")
        print(json.dumps(latest_payload, ensure_ascii=False, indent=2))
        print("\nlist response:")
        print(json.dumps(list_payload, ensure_ascii=False, indent=2))
        print("\napply response:")
        print(json.dumps(apply_payload, ensure_ascii=False, indent=2))
        print("\ndirect replanner result:")
        print(json.dumps(direct_proposal, ensure_ascii=False, indent=2))
        print("\nvalidation result:")
        print(json.dumps(validation_result, ensure_ascii=False, indent=2))
        print("\nsmoke summary:")
        print(
            json.dumps(
                {
                    "real_deepseek_called": urlopen_stats["count"] > 0,
                    "deepseek_model": settings.deepseek_model,
                    "proposal_strategy": proposal.get("strategy"),
                    "proposal_reason": proposal.get("reason"),
                    "proposal_summary": proposal.get("proposal_summary"),
                    "proposal_target_poi_id": proposal.get("new_poi", {}).get("poi_id"),
                    "fallback_reason": direct_replanner.last_fallback_reason,
                    "latest_readable": is_latest_payload_valid(latest_payload),
                    "list_readable": is_list_payload_valid(list_payload),
                    "apply_success": apply_payload.get("status") == "APPLIED",
                },
                ensure_ascii=False,
                indent=2,
            )
        )

        if not all(validation_result.values()):
            raise RuntimeError("DeepSeek real smoke test failed.")
    finally:
        settings.replanner_provider = original_provider
        settings.llm_replanner_mock = original_mock
        settings.deepseek_api_key = original_api_key
        settings.deepseek_base_url = original_base_url
        settings.deepseek_model = original_model


def create_plan(client: TestClient) -> dict[str, object]:
    response = client.post(
        "/api/plans",
        json=CreatePlanRequest(
            prompt=(
                "Real DeepSeek smoke test. Prefer indoor fallback when weather risk "
                "requires replan."
            ),
            city="Shanghai",
            session_id="p27_real_deepseek_weather_risk",
            user_id="smoke_user",
        ).model_dump(mode="json"),
    )
    ensure_status(response.status_code, 201, response.text)
    return response.json()


def build_replan_context(plan_id: str) -> dict[str, Any]:
    with Session(engine) as session:
        repository = PlanRepository(session)
        plan = repository.get(plan_id)
        if plan is None:
            raise RuntimeError("Failed to load plan for smoke test.")
        pipeline_result = asyncio.run(ExecutionPipeline().run(plan))
        decision = ReplanDecisionService().decide(pipeline_result)
        return ReplanContextBuilder().build(plan, pipeline_result, decision)


@contextmanager
def record_urlopen_calls() -> Any:
    import app.services.llm_client as llm_client_module

    original_urlopen: Callable[..., Any] = llm_client_module.urlopen
    stats = {"count": 0}

    def _wrapped_urlopen(*args: Any, **kwargs: Any) -> Any:
        stats["count"] += 1
        return original_urlopen(*args, **kwargs)

    llm_client_module.urlopen = _wrapped_urlopen  # type: ignore[assignment]
    try:
        yield stats
    finally:
        llm_client_module.urlopen = original_urlopen  # type: ignore[assignment]


def masked_env_report() -> dict[str, str]:
    return {
        "REPLANNER_PROVIDER": masked_value("REPLANNER_PROVIDER"),
        "LLM_REPLANNER_MOCK": masked_value("LLM_REPLANNER_MOCK"),
        "DEEPSEEK_API_KEY": masked_key("DEEPSEEK_API_KEY"),
        "DEEPSEEK_BASE_URL": masked_value("DEEPSEEK_BASE_URL"),
        "DEEPSEEK_MODEL": masked_value("DEEPSEEK_MODEL"),
        "DEMO_MODE": masked_value("DEMO_MODE"),
    }


def masked_value(name: str) -> str:
    value = os.getenv(name)
    if value is None or value == "":
        return "ABSENT"
    return f"present:{value}"


def masked_key(name: str) -> str:
    value = settings.deepseek_api_key if name == "DEEPSEEK_API_KEY" else os.getenv(name)
    if not isinstance(value, str) or not value:
        return "ABSENT"
    if len(value) >= 8:
        return f"present:{value[:4]}***{value[-4:]}"
    return "present:***"


def proposal_target_in_candidates(context: dict[str, Any], proposal: dict[str, Any]) -> bool:
    target = proposal.get("new_poi", {}).get("poi_id")
    if not isinstance(target, str) or not target.strip():
        return False
    from app.services.llm_replanner import LlmReplanner

    candidate_ids = {
        candidate.get("poi_id")
        for candidate in LlmReplanner()._provider_candidates(context)  # type: ignore[attr-defined]
        if isinstance(candidate, dict)
    }
    return target in candidate_ids


def is_latest_payload_valid(payload: dict[str, Any]) -> bool:
    return (
        isinstance(payload.get("proposal_id"), str)
        and isinstance(payload.get("proposal"), dict)
        and payload.get("updated_plan") is None
    )


def is_list_payload_valid(payload: dict[str, Any]) -> bool:
    proposals = payload.get("proposals")
    return isinstance(payload.get("plan_id"), str) and isinstance(proposals, list)


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
    return (
        set(value.keys()) == required
        and value.get("replanned") is True
        and is_non_empty_text(value.get("strategy"))
        and is_non_empty_text(value.get("risk_type"))
        and is_non_empty_text(value.get("reason"))
        and is_non_empty_text(value.get("proposal_summary"))
        and isinstance(value.get("old_poi"), dict)
        and isinstance(value.get("new_poi"), dict)
        and is_non_empty_text(value.get("new_poi", {}).get("poi_id"))
        and value.get("requires_user_confirmation") is True
    )


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
