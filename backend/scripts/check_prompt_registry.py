from __future__ import annotations

import json
import os
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("PLANNING_PROVIDER", "rule_based")
os.environ.setdefault("REPLANNER_PROVIDER", "llm")
os.environ.setdefault("LLM_REPLANNER_MOCK", "true")
os.environ.setdefault("REPLAN_PROMPT_VERSION", "v1")
os.environ.setdefault("DEMO_MODE", "true")

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.core.database import create_db_and_tables, engine
from app.main import create_app
from app.repositories.plan_repository import PlanRepository
from app.services.llm_replanner import LlmReplanner
from app.services.replan_context_builder import ReplanContextBuilder
from app.services.replan_decision_service import ReplanDecisionService
from app.services.prompt_builder import PromptBuilder
from app.services.prompt_registry import PromptRegistry


def main() -> None:
    create_db_and_tables()
    original_provider = settings.replanner_provider
    original_mock = settings.llm_replanner_mock
    original_prompt_version = settings.replan_prompt_version
    try:
        settings.replanner_provider = "llm"
        settings.llm_replanner_mock = True
        settings.replan_prompt_version = "v1"

        registry = PromptRegistry()
        prompt_spec = registry.get_replan_prompt()
        rendered_prompt = PromptBuilder().render(
            prompt_spec.text,
            {
                "current_plan": {"plan_id": "plan_demo"},
                "risk_flags": [{"type": "WEATHER_RISK"}],
                "execution_snapshot": {"id": "es_demo"},
                "provider_candidates": [{"poi_id": "poi_demo"}],
                "budget": 300,
                "user_prompt": "prompt registry check",
            },
        )

        with TestClient(create_app()) as client:
            plan_payload = create_plan(client)
            plan_id = plan_payload["plan_id"]
            execution_response = client.post(f"/api/plans/{plan_id}/execution/check")
            ensure_status(execution_response.status_code, 200, execution_response.text)
            execution_payload = execution_response.json()

            with Session(engine) as session:
                repository = PlanRepository(session)
                plan = repository.get(plan_id)
                if plan is None:
                    raise RuntimeError("Failed to load plan for prompt registry validation.")

                execution_snapshot = repository.get_latest_execution_snapshot(plan_id)
                if execution_snapshot is None:
                    raise RuntimeError("Failed to load execution snapshot for prompt registry validation.")

                pipeline_result = {
                    "risk_flags": execution_snapshot.get("risk_flags", []),
                    "actions": execution_snapshot.get("actions", []),
                    "execution_context": execution_snapshot.get("execution_context", {}),
                    "summary": execution_snapshot.get("summary", {}),
                }
                decision = ReplanDecisionService().decide(pipeline_result)
                replan_context = ReplanContextBuilder().build(plan, pipeline_result, decision)
                replan_context["need_replan"] = True
                replan_context["strategy"] = "INDOOR_FALLBACK"
                risk_flags = pipeline_result.get("risk_flags", [])
                if isinstance(risk_flags, list) and risk_flags:
                    first_risk = risk_flags[0] if isinstance(risk_flags[0], dict) else {}
                    replan_context["risk_type"] = first_risk.get("type", "WEATHER_RISK")
                else:
                    replan_context["risk_type"] = "WEATHER_RISK"

                replanner = LlmReplanner()
                proposal = replanner.propose(replan_context)
                if not proposal.get("replanned"):
                    raise RuntimeError("Prompt registry validation did not generate a proposal.")

                repository.save_replan_proposal(
                    plan.plan_id,
                    execution_snapshot["id"],
                    proposal,
                    prompt_version=replanner.last_prompt_version,
                    llm_model=replanner.last_llm_model,
                )

            latest_response = client.get(f"/api/plans/{plan_id}/replan/latest")
            ensure_status(latest_response.status_code, 200, latest_response.text)
            latest_payload = latest_response.json()

            list_response = client.get(f"/api/plans/{plan_id}/replans")
            ensure_status(list_response.status_code, 200, list_response.text)
            list_payload = list_response.json()

            apply_response = client.post(
                f"/api/plans/{plan_id}/replan/{latest_payload['proposal_id']}/apply"
            )
            ensure_status(apply_response.status_code, 200, apply_response.text)
            apply_payload = apply_response.json()

        with Session(engine) as session:
            persisted = PlanRepository(session).get_latest_replan_proposal(plan_id)

        latest_proposal = latest_payload.get("proposal")
        list_proposal = first_list_item(list_payload).get("proposal")
        apply_proposal = apply_payload.get("proposal")
        validation_result = {
            "prompt_loaded": prompt_spec.version == "v1" and is_non_empty_text(prompt_spec.text),
            "prompt_rendered": is_non_empty_text(rendered_prompt)
            and "$current_plan" not in rendered_prompt
            and "$provider_candidates" not in rendered_prompt,
            "proposal_schema_unchanged": is_standard_proposal(latest_proposal)
            and is_standard_proposal(list_proposal)
            and is_standard_proposal(apply_proposal),
            "response_contract_unchanged": is_latest_contract(latest_payload)
            and is_list_contract(list_payload)
            and is_apply_contract(apply_payload),
            "proposal_metadata_recorded": isinstance(persisted, dict)
            and persisted.get("prompt_version") == "v1"
            and persisted.get("llm_model") == "mock",
            "latest_list_apply_consistent": latest_proposal == list_proposal == apply_proposal,
            "responses_serializable": all(
                is_json_serializable(payload)
                for payload in [
                    plan_payload,
                    execution_payload,
                    execution_snapshot,
                    latest_payload,
                    list_payload,
                    apply_payload,
                ]
            ),
        }

        print("prompt registry:")
        print(
            json.dumps(
                {
                    "version": prompt_spec.version,
                    "prompt_preview": rendered_prompt[:400],
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        print("\nexecution response:")
        print(json.dumps(execution_payload, ensure_ascii=False, indent=2))
        print("\nprompt-derived execution snapshot:")
        print(json.dumps(execution_snapshot, ensure_ascii=False, indent=2))
        print("\nlatest response:")
        print(json.dumps(latest_payload, ensure_ascii=False, indent=2))
        print("\nlist response:")
        print(json.dumps(list_payload, ensure_ascii=False, indent=2))
        print("\napply response:")
        print(json.dumps(apply_payload, ensure_ascii=False, indent=2))
        print("\npersisted proposal metadata:")
        print(json.dumps(persisted, ensure_ascii=False, indent=2))
        print("\nvalidation result:")
        print(json.dumps(validation_result, ensure_ascii=False, indent=2))

        if not all(validation_result.values()):
            raise RuntimeError("Prompt registry validation failed.")
    finally:
        settings.replanner_provider = original_provider
        settings.llm_replanner_mock = original_mock
        settings.replan_prompt_version = original_prompt_version


def create_plan(client: TestClient) -> dict[str, object]:
    response = client.post(
        "/api/plans",
        json={
            "prompt": "Prompt registry validation for weather risk",
            "city": "Shanghai",
            "session_id": "prompt_registry_check",
            "user_id": "check_user",
        },
    )
    ensure_status(response.status_code, 201, response.text)
    return response.json()


def ensure_status(status_code: int, expected: int, body: str) -> None:
    if status_code != expected:
        raise RuntimeError(f"request failed: {status_code} {body}")


def first_list_item(payload: dict[str, object]) -> dict[str, object]:
    proposals = payload.get("proposals")
    if isinstance(proposals, list) and proposals and isinstance(proposals[0], dict):
        return proposals[0]
    return {}


def is_latest_contract(payload: dict[str, object]) -> bool:
    expected = {
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
    return set(payload.keys()) == expected and payload.get("updated_plan") is None


def is_list_contract(payload: dict[str, object]) -> bool:
    expected = {"plan_id", "proposals"}
    if set(payload.keys()) != expected:
        return False
    proposals = payload.get("proposals")
    return isinstance(proposals, list) and all(
        isinstance(item, dict)
        and set(item.keys())
        == {
            "proposal_id",
            "status",
            "strategy",
            "risk_type",
            "accepted",
            "accepted_at",
            "created_at",
            "proposal",
        }
        for item in proposals
    )


def is_apply_contract(payload: dict[str, object]) -> bool:
    expected = {
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
    return set(payload.keys()) == expected and payload.get("status") == "APPLIED"


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


def is_non_empty_text(value: object) -> bool:
    return isinstance(value, str) and bool(value.strip())


def is_json_serializable(value: object) -> bool:
    try:
        json.dumps(value, ensure_ascii=False)
    except TypeError:
        return False
    return True


if __name__ == "__main__":
    main()
