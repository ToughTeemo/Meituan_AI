from __future__ import annotations

import json
import os
import sys
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

from app.main import create_app


def main() -> None:
    with TestClient(create_app()) as client:
        create_response = client.post(
            "/api/plans",
            json={
                "prompt": (
                    "\u5468\u672b\u5e26\u5b69\u5b50\u5728\u4e0a\u6d77\u73a9\u534a\u5929"
                    "\uff0c\u9884\u7b97\u4e0d\u8981\u592a\u9ad8\uff0c\u4f18\u5148\u5ba4\u5185"
                ),
                "city": "\u4e0a\u6d77",
                "session_id": "check_execution_api_session",
                "user_id": "check_user",
            },
        )
        if create_response.status_code != 201:
            raise RuntimeError(
                f"POST /api/plans failed: {create_response.status_code} "
                f"{create_response.text}"
            )
        plan = create_response.json()
        plan_id = plan["plan_id"]

        check_response = client.post(f"/api/plans/{plan_id}/execution/check")
        if check_response.status_code != 200:
            raise RuntimeError(
                f"POST /api/plans/{plan_id}/execution/check failed: "
                f"{check_response.status_code} {check_response.text}"
            )
        check_payload = check_response.json()

        latest_response = client.get(f"/api/plans/{plan_id}/execution/latest")
        if latest_response.status_code != 200:
            raise RuntimeError(
                f"GET /api/plans/{plan_id}/execution/latest failed: "
                f"{latest_response.status_code} {latest_response.text}"
            )
        latest_payload = latest_response.json()

    validation_result = validate_execution_api(check_payload, latest_payload)

    print("POST /api/plans/{plan_id}/execution/check response:")
    print(json.dumps(check_payload, ensure_ascii=False, indent=2))
    print("\nGET /api/plans/{plan_id}/execution/latest response:")
    print(json.dumps(latest_payload, ensure_ascii=False, indent=2))
    print("\nvalidation result:")
    print(json.dumps(validation_result, ensure_ascii=False, indent=2))

    if not all(validation_result.values()):
        raise RuntimeError("Execution API validation failed.")


def validate_execution_api(check_payload: dict[str, Any], latest_payload: dict[str, Any]) -> dict[str, bool]:
    return {
        "check_fields_complete": validate_check_payload(check_payload),
        "latest_fields_complete": validate_latest_payload(latest_payload),
        "snapshot_saved": isinstance(latest_payload.get("snapshot_id"), str)
        and bool(latest_payload["snapshot_id"]),
        "status_equal": check_payload.get("status") == latest_payload.get("status"),
        "summary_equal": check_payload.get("summary") == latest_payload.get("summary"),
        "risk_flags_equal": check_payload.get("risk_flags") == latest_payload.get("risk_flags"),
        "actions_equal": check_payload.get("actions") == latest_payload.get("actions"),
        "check_serializable": is_json_serializable(check_payload),
        "latest_serializable": is_json_serializable(latest_payload),
        "actions_require_confirmation": actions_require_confirmation(check_payload.get("actions")),
        "no_real_external_action": no_real_external_action(check_payload.get("actions")),
        "no_replan_executed": no_replan_executed(check_payload.get("actions")),
    }


def validate_check_payload(value: Any) -> bool:
    return (
        isinstance(value, dict)
        and isinstance(value.get("status"), str)
        and bool(value["status"])
        and isinstance(value.get("summary"), str)
        and bool(value["summary"])
        and isinstance(value.get("risk_flags"), list)
        and isinstance(value.get("actions"), list)
    )


def validate_latest_payload(value: Any) -> bool:
    return (
        validate_check_payload(value)
        and isinstance(value.get("snapshot_id"), str)
        and bool(value["snapshot_id"])
        and isinstance(value.get("created_at"), str)
        and bool(value["created_at"])
    )


def actions_require_confirmation(value: Any) -> bool:
    if not isinstance(value, list):
        return False
    return all(
        isinstance(action, dict)
        and action.get("requires_user_confirmation") is True
        for action in value
    )


def no_real_external_action(value: Any) -> bool:
    if not isinstance(value, list):
        return False
    for action in value:
        if not isinstance(action, dict):
            return False
        payload = action.get("payload")
        if isinstance(payload, dict) and payload.get("external_service_called") is True:
            return False
    return True


def no_replan_executed(value: Any) -> bool:
    if not isinstance(value, list):
        return False
    return all(
        isinstance(action, dict)
        and action.get("type") != "replan"
        and action.get("payload", {}).get("replan_executed") is not True
        for action in value
    )


def is_json_serializable(value: Any) -> bool:
    try:
        json.dumps(value, ensure_ascii=False)
    except TypeError:
        return False
    return True


if __name__ == "__main__":
    main()
