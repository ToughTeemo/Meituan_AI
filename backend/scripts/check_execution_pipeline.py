from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Any

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

os.environ["PLANNING_PROVIDER"] = "rule_based"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from sqlmodel import Session

from app.core.database import create_db_and_tables, engine
from app.repositories.plan_repository import PlanRepository
from app.schemas.plan import CreatePlanRequest
from app.services.execution_pipeline import ExecutionPipeline
from app.services.planning_service import PlanningService


async def main() -> None:
    create_db_and_tables()
    request = CreatePlanRequest(
        prompt=(
            "\u5468\u672b\u5e26\u5b69\u5b50\u5728\u4e0a\u6d77\u73a9\u534a\u5929"
            "\uff0c\u9884\u7b97\u4e0d\u8981\u592a\u9ad8\uff0c\u4f18\u5148\u5ba4\u5185"
        ),
        city="\u4e0a\u6d77",
        session_id="check_execution_pipeline_session",
        user_id="check_user",
    )

    with Session(engine) as session:
        plan_response = PlanningService(PlanRepository(session)).create_plan(request)

    result = await ExecutionPipeline().run(plan_response)
    validation_result = validate_pipeline_result(result)

    print("execution_context:")
    print(json.dumps(result["execution_context"], ensure_ascii=False, indent=2))
    print("\nrisk_flags:")
    print(json.dumps(result["risk_flags"], ensure_ascii=False, indent=2))
    print("\nactions:")
    print(json.dumps(result["actions"], ensure_ascii=False, indent=2))
    print("\nstatus:")
    print(result["status"])
    print("\nsummary:")
    print(result["summary"])
    print("\nvalidation result:")
    print(json.dumps(validation_result, ensure_ascii=False, indent=2))

    if not all(validation_result.values()):
        raise RuntimeError("Execution pipeline validation failed.")


def validate_pipeline_result(result: dict[str, Any]) -> dict[str, bool]:
    return {
        "status_exists": result.get("status")
        in {"READY", "NEEDS_CONFIRMATION", "NEEDS_REPLAN"},
        "risk_flags_serializable": is_json_serializable(result.get("risk_flags")),
        "actions_serializable": is_json_serializable(result.get("actions")),
        "actions_require_confirmation": actions_require_confirmation(result.get("actions")),
        "no_real_external_action": no_real_external_action(result.get("actions")),
        "no_replan_executed": no_replan_executed(result),
    }


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


def no_replan_executed(result: dict[str, Any]) -> bool:
    actions = result.get("actions")
    if not isinstance(actions, list):
        return False
    return all(
        isinstance(action, dict)
        and action.get("type") != "replan"
        and action.get("payload", {}).get("replan_executed") is not True
        for action in actions
    )


def is_json_serializable(value: Any) -> bool:
    try:
        json.dumps(value, ensure_ascii=False)
    except TypeError:
        return False
    return True


if __name__ == "__main__":
    asyncio.run(main())
