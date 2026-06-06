from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path
from typing import Any

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.execution_action_planner import ExecutionActionPlanner
from app.services.execution_context_builder import ExecutionContextBuilder
from app.services.execution_provider_refresh_service import ExecutionProviderRefreshService
from app.services.execution_risk_scanner import ExecutionRiskScanner
from app.services.plan_context_builder import PlanContextBuilder
from app.services.plan_response_adapter import PlanResponseAdapter
from app.services.rule_based_planner import RuleBasedPlanner


async def main() -> None:
    prompt = (
        "\u5468\u672b\u5e26\u5b69\u5b50\u5728\u4e0a\u6d77\u73a9\u534a\u5929"
        "\uff0c\u9884\u7b97\u4e0d\u8981\u592a\u9ad8\uff0c\u4f18\u5148\u5ba4\u5185"
    )
    plan_context = PlanContextBuilder().build(prompt, limit=8)
    planner_result = RuleBasedPlanner().plan(plan_context)
    plan_response = PlanResponseAdapter().to_plan_response(
        planner_result,
        plan_context=plan_context,
        session_id="check_execution_action_session",
        user_id="check_user",
        city="\u4e0a\u6d77",
    )

    execution_context = ExecutionContextBuilder().build(plan_response)
    refreshed_context = await ExecutionProviderRefreshService().refresh(execution_context)
    scanned_context = ExecutionRiskScanner().scan(refreshed_context)
    action_context = ExecutionActionPlanner().plan(scanned_context)

    risk_flags = action_context.get("risk_flags")
    actions = action_context.get("actions")
    validation_result = validate_actions(action_context)

    print("risk_flags:")
    print(json.dumps(risk_flags, ensure_ascii=False, indent=2))
    print("\nactions:")
    print(json.dumps(actions, ensure_ascii=False, indent=2))
    print("\nJSON serialization result:")
    print(json.dumps({"actions": actions}, ensure_ascii=False, indent=2))
    print("\nvalidation result:")
    print(json.dumps(validation_result, ensure_ascii=False, indent=2))

    if not all(validation_result.values()):
        raise RuntimeError("Execution action planner validation failed.")


def validate_actions(context: dict[str, Any]) -> dict[str, bool]:
    actions = context.get("actions")
    return {
        "actions_non_empty": isinstance(actions, list) and bool(actions),
        "fields_complete": fields_complete(actions),
        "all_require_confirmation": all_require_confirmation(actions),
        "serializable": is_json_serializable(context),
    }


def fields_complete(value: Any) -> bool:
    if not isinstance(value, list) or not value:
        return False

    required = {
        "type",
        "priority",
        "risk_type",
        "poi_id",
        "label",
        "message",
        "requires_user_confirmation",
        "payload",
    }
    for item in value:
        if not isinstance(item, dict) or not required.issubset(item):
            return False
        for key in ("type", "priority", "label", "message"):
            if not isinstance(item.get(key), str) or not item[key].strip():
                return False
        if item["risk_type"] is not None and not isinstance(item["risk_type"], str):
            return False
        if item["poi_id"] is not None and not isinstance(item["poi_id"], str):
            return False
        if not isinstance(item["payload"], dict):
            return False
    return True


def all_require_confirmation(value: Any) -> bool:
    if not isinstance(value, list) or not value:
        return False
    return all(
        isinstance(item, dict) and item.get("requires_user_confirmation") is True
        for item in value
    )


def is_json_serializable(value: Any) -> bool:
    try:
        json.dumps(value, ensure_ascii=False)
    except TypeError:
        return False
    return True


if __name__ == "__main__":
    asyncio.run(main())
