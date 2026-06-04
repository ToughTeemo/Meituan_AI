from __future__ import annotations

import json
import os
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("PLANNING_PROVIDER", "rule_based")
os.environ.setdefault("DEMO_MODE", "true")
os.environ.setdefault("LLM_REPLANNER_MOCK", "true")

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.database import create_db_and_tables
from app.main import create_app
from app.services.llm_replanner import LlmReplanner
from app.services.replanner_factory import get_replanner
from app.services.rule_based_replanner import RuleBasedReplanner


def main() -> None:
    create_db_and_tables()
    original_provider = settings.replanner_provider
    original_mock = settings.llm_replanner_mock
    try:
        settings.llm_replanner_mock = True
        settings.replanner_provider = "rule"
        rule_replanner = get_replanner()
        settings.replanner_provider = "llm"
        llm_replanner = get_replanner()

        with TestClient(create_app()) as client:
            plan_payload = create_plan(client)
            plan_id = plan_payload["plan_id"]

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

        validation_result = {
            "provider_switch_rule": isinstance(rule_replanner, RuleBasedReplanner),
            "provider_switch_llm": isinstance(llm_replanner, LlmReplanner),
            "llm_prompt_template_present": is_non_empty_text(LlmReplanner.PROMPT_TEMPLATE),
            "execution_check_weather_risk": any(
                isinstance(item, dict) and item.get("type") == "WEATHER_RISK"
                for item in execution_payload.get("risk_flags", [])
            ),
            "proposal_persisted": is_non_empty_text(latest_payload.get("proposal_id")),
            "schema_compatible": is_standard_proposal(latest_payload.get("proposal"))
            and is_standard_proposal(first_list_item(list_payload).get("proposal"))
            and is_standard_proposal(apply_payload.get("proposal")),
            "latest_list_apply_compatible": latest_payload.get("proposal")
            == first_list_item(list_payload).get("proposal")
            == apply_payload.get("proposal"),
            "apply_updated_plan": isinstance(apply_payload.get("updated_plan"), dict),
            "responses_serializable": all(
                is_json_serializable(payload)
                for payload in [
                    plan_payload,
                    execution_payload,
                    latest_payload,
                    list_payload,
                    apply_payload,
                ]
            ),
        }

        print("provider switch:")
        print(
            json.dumps(
                {
                    "rule": type(rule_replanner).__name__,
                    "llm": type(llm_replanner).__name__,
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        print("\nLLM prompt template:")
        print(LlmReplanner.PROMPT_TEMPLATE)
        print("\nexecution check response:")
        print(json.dumps(execution_payload, ensure_ascii=False, indent=2))
        print("\nlatest proposal response:")
        print(json.dumps(latest_payload, ensure_ascii=False, indent=2))
        print("\nproposal list response:")
        print(json.dumps(list_payload, ensure_ascii=False, indent=2))
        print("\napply response:")
        print(json.dumps(apply_payload, ensure_ascii=False, indent=2))
        print("\nvalidation result:")
        print(json.dumps(validation_result, ensure_ascii=False, indent=2))

        if not all(validation_result.values()):
            raise RuntimeError("LLM replanner validation failed.")
    finally:
        settings.replanner_provider = original_provider
        settings.llm_replanner_mock = original_mock


def create_plan(client: TestClient) -> dict[str, object]:
    response = client.post(
        "/api/plans",
        json={
            "prompt": "LLM demo replanner validation for weather risk",
            "city": "Shanghai",
            "session_id": "llm_replanner_weather_risk",
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
