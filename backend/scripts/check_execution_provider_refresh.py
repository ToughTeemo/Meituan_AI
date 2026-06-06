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

from app.services.execution_context_builder import ExecutionContextBuilder
from app.services.execution_provider_refresh_service import ExecutionProviderRefreshService
from app.services.plan_context_builder import PlanContextBuilder
from app.services.plan_response_adapter import PlanResponseAdapter
from app.services.rule_based_planner import RuleBasedPlanner


async def main() -> None:
    prompt = "周末带孩子在上海玩半天，预算不要太高，优先室内"
    plan_context = PlanContextBuilder().build(prompt, limit=8)
    planner_result = RuleBasedPlanner().plan(plan_context)
    plan_response = PlanResponseAdapter().to_plan_response(
        planner_result,
        plan_context=plan_context,
        session_id="check_execution_refresh_session",
        user_id="check_user",
        city="上海",
    )
    execution_context = ExecutionContextBuilder().build(plan_response)
    before_snapshot = execution_context["provider_snapshot"]

    refreshed_context = await ExecutionProviderRefreshService().refresh(execution_context)
    after_snapshot = refreshed_context["provider_snapshot"]
    validation_result = validate_refresh(before_snapshot, after_snapshot)

    json.dumps(refreshed_context, ensure_ascii=False)
    print("before snapshot:")
    print(json.dumps(before_snapshot, ensure_ascii=False, indent=2))
    print("\nafter snapshot:")
    print(json.dumps(after_snapshot, ensure_ascii=False, indent=2))
    print("\nvalidation result:")
    print(json.dumps(validation_result, ensure_ascii=False, indent=2))

    if not all(validation_result.values()):
        raise RuntimeError("Execution provider refresh validation failed.")


def validate_refresh(before: dict[str, Any], after: dict[str, Any]) -> dict[str, bool]:
    return {
        "weather_refreshed": after["weather"].get("source") != before["weather"].get("source"),
        "hours_refreshed": all_refreshed(after.get("hours"), "plan_response"),
        "price_refreshed": all_refreshed(after.get("price"), "plan_response"),
        "queue_preserved": after.get("queue") == before.get("queue"),
        "booking_preserved": after.get("booking") == before.get("booking"),
        "serializable": is_json_serializable(after),
    }


def all_refreshed(value: Any, previous_source: str) -> bool:
    if not isinstance(value, dict) or not value:
        return False
    return all(
        isinstance(item, dict)
        and item.get("source") != previous_source
        and "fallback_reason" in item
        for item in value.values()
    )


def is_json_serializable(value: Any) -> bool:
    try:
        json.dumps(value, ensure_ascii=False)
    except TypeError:
        return False
    return True


if __name__ == "__main__":
    asyncio.run(main())
