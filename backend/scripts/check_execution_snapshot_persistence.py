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
        session_id="check_execution_snapshot_session",
        user_id="check_user",
    )

    with Session(engine) as session:
        repository = PlanRepository(session)
        plan_response = PlanningService(repository).create_plan(request)
        pipeline_result = await ExecutionPipeline().run(plan_response)

        saved_snapshot = repository.save_execution_snapshot(
            plan_response.plan_id,
            plan_response.version,
            pipeline_result,
        )
        latest_snapshot = repository.get_latest_execution_snapshot(plan_response.plan_id)
        all_snapshots = repository.list_execution_snapshots(plan_response.plan_id)

    if latest_snapshot is None:
        raise RuntimeError("Execution snapshot was not loaded after save.")

    validation_result = validate_snapshot(
        pipeline_result,
        saved_snapshot,
        latest_snapshot,
        all_snapshots,
    )

    print("saved snapshot:")
    print(json.dumps(snapshot_view(saved_snapshot), ensure_ascii=False, indent=2))
    print("\nlatest snapshot:")
    print(json.dumps(snapshot_view(latest_snapshot), ensure_ascii=False, indent=2))
    print("\nvalidation result:")
    print(json.dumps(validation_result, ensure_ascii=False, indent=2))

    if not all(validation_result.values()):
        raise RuntimeError("Execution snapshot persistence check failed.")


def validate_snapshot(
    pipeline_result: dict[str, Any],
    saved_snapshot: dict[str, Any],
    latest_snapshot: dict[str, Any],
    all_snapshots: list[dict[str, Any]],
) -> dict[str, bool]:
    return {
        "saved_matches_latest": saved_snapshot == latest_snapshot,
        "list_contains_snapshot": len(all_snapshots) == 1
        and all_snapshots[0] == latest_snapshot,
        "status_equal": latest_snapshot["status"] == pipeline_result["status"],
        "summary_equal": latest_snapshot["summary"] == pipeline_result["summary"],
        "risk_flags_equal": latest_snapshot["risk_flags"] == pipeline_result["risk_flags"],
        "actions_equal": latest_snapshot["actions"] == pipeline_result["actions"],
        "execution_context_equal": latest_snapshot["execution_context"]
        == pipeline_result["execution_context"],
        "snapshot_serializable": is_json_serializable(latest_snapshot),
        "pipeline_serializable": is_json_serializable(pipeline_result),
        "no_action_executed": no_action_executed(latest_snapshot["actions"]),
        "no_replan_executed": no_replan_executed(latest_snapshot["actions"]),
    }


def snapshot_view(snapshot: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": snapshot["id"],
        "plan_id": snapshot["plan_id"],
        "version": snapshot["version"],
        "status": snapshot["status"],
        "summary": snapshot["summary"],
        "risk_flags": snapshot["risk_flags"],
        "actions": snapshot["actions"],
        "execution_context": {
            "plan_id": snapshot["execution_context"].get("plan_id"),
            "execution_status": snapshot["execution_context"].get("execution_status"),
            "current_card_id": snapshot["execution_context"].get("current_card_id"),
            "risk_count": len(snapshot["execution_context"].get("risk_flags", [])),
            "action_count": len(snapshot["execution_context"].get("actions", [])),
        },
        "created_at": snapshot["created_at"],
    }


def no_action_executed(actions: Any) -> bool:
    if not isinstance(actions, list):
        return False
    for action in actions:
        if not isinstance(action, dict):
            return False
        payload = action.get("payload")
        if isinstance(payload, dict) and payload.get("external_service_called") is True:
            return False
    return True


def no_replan_executed(actions: Any) -> bool:
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
