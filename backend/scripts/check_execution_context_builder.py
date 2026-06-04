from __future__ import annotations

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
from app.services.plan_context_builder import PlanContextBuilder
from app.services.plan_response_adapter import PlanResponseAdapter
from app.services.rule_based_planner import RuleBasedPlanner


def main() -> None:
    prompt = "周末带孩子在上海玩半天，预算不要太高，优先室内"
    plan_context = PlanContextBuilder().build(prompt, limit=8)
    planner_result = RuleBasedPlanner().plan(plan_context)
    plan_response = PlanResponseAdapter().to_plan_response(
        planner_result,
        plan_context=plan_context,
        session_id="check_execution_context_session",
        user_id="check_user",
        city="上海",
    )

    execution_context = ExecutionContextBuilder().build(plan_response)
    json.dumps(execution_context, ensure_ascii=False)
    validation_result = validate_execution_context(execution_context)

    print("ExecutionContext:")
    print(json.dumps(execution_context, ensure_ascii=False, indent=2))
    print("\nvalidation result:")
    print(json.dumps(validation_result, ensure_ascii=False, indent=2))

    if not all(validation_result.values()):
        raise RuntimeError("ExecutionContext validation failed.")


def validate_execution_context(context: dict[str, Any]) -> dict[str, bool]:
    provider_snapshot = context.get("provider_snapshot")
    cards = context.get("cards")
    return {
        "plan_id": isinstance(context.get("plan_id"), str) and bool(context["plan_id"]),
        "session_id": isinstance(context.get("session_id"), str)
        and bool(context["session_id"]),
        "current_step": isinstance(context.get("current_step"), int),
        "execution_status": context.get("execution_status") == "READY",
        "cards": isinstance(cards, list) and bool(cards),
        "timeline": isinstance(context.get("timeline"), dict)
        and "card_height_map" in context["timeline"],
        "constraints": isinstance(context.get("constraints"), dict)
        and "goal" in context["constraints"],
        "provider_snapshot": validate_provider_snapshot(provider_snapshot),
        "risk_flags": isinstance(context.get("risk_flags"), list),
    }


def validate_provider_snapshot(value: Any) -> bool:
    if not isinstance(value, dict):
        return False
    required_keys = {"weather", "hours", "queue", "booking", "price"}
    if not required_keys.issubset(value):
        return False
    if not isinstance(value["weather"], dict):
        return False
    return all(isinstance(value[key], dict) for key in ["hours", "queue", "booking", "price"])


if __name__ == "__main__":
    main()
