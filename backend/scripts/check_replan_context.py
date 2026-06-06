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
from app.services.replan_context_builder import ReplanContextBuilder
from app.services.replan_decision_service import ReplanDecisionService
from app.services.rule_based_planner import RuleBasedPlanner


def main() -> None:
    plan_response = build_plan_response()
    execution_context = ExecutionContextBuilder().build(plan_response)
    risk_flags = [
        {
            "type": "WEATHER_RISK",
            "severity": "high",
            "source": "weather",
            "poi_id": None,
            "message": "\u9884\u8ba1\u964d\u96e8\u6982\u7387\u8f83\u9ad8",
            "can_replan": True,
        }
    ]
    actions = [
        {
            "type": "suggest_replan",
            "priority": "high",
            "risk_type": "WEATHER_RISK",
            "poi_id": None,
            "label": "\u5efa\u8bae\u8c03\u6574\u65b9\u6848",
            "message": "\u5929\u6c14\u98ce\u9669\u8f83\u9ad8\uff0c\u5efa\u8bae\u5207\u6362\u5ba4\u5185\u5907\u9009\u65b9\u6848",
            "requires_user_confirmation": True,
            "payload": {"can_replan": True},
        }
    ]
    execution_context["risk_flags"] = risk_flags
    execution_context["actions"] = actions
    execution_context["execution_status"] = "NEEDS_REPLAN"

    pipeline_result = {
        "execution_context": execution_context,
        "risk_flags": risk_flags,
        "actions": actions,
        "status": "NEEDS_REPLAN",
        "summary": "\u5b58\u5728\u5929\u6c14\u98ce\u9669\uff0c\u5efa\u8bae\u91cd\u89c4\u5212",
    }
    decision = ReplanDecisionService().decide(pipeline_result)
    replan_context = ReplanContextBuilder().build(
        plan_response,
        pipeline_result,
        decision,
    )
    validation_result = validate_context(replan_context)

    print("ReplanContext:")
    print(json.dumps(replan_context, ensure_ascii=False, indent=2))
    print("\nvalidation result:")
    print(json.dumps(validation_result, ensure_ascii=False, indent=2))

    if not all(validation_result.values()):
        raise RuntimeError("Replan context validation failed.")


def build_plan_response():
    prompt = (
        "\u5468\u672b\u5e26\u5b69\u5b50\u5728\u4e0a\u6d77\u73a9\u534a\u5929"
        "\uff0c\u9884\u7b97\u4e0d\u8981\u592a\u9ad8\uff0c\u4f18\u5148\u5ba4\u5185"
    )
    plan_context = PlanContextBuilder().build(prompt, limit=8)
    planner_result = RuleBasedPlanner().plan(plan_context)
    return PlanResponseAdapter().to_plan_response(
        planner_result,
        plan_context=plan_context,
        session_id="check_replan_context_session",
        user_id="check_user",
        city="\u4e0a\u6d77",
    )


def validate_context(context: dict[str, Any]) -> dict[str, bool]:
    required = {
        "plan_id",
        "session_id",
        "current_step",
        "risk_type",
        "severity",
        "strategy",
        "need_replan",
        "current_card_id",
        "risk_flags",
        "actions",
        "execution_context",
        "provider_snapshot",
    }
    return {
        "necessary_fields_exist": required.issubset(context),
        "risk_type_correct": context.get("risk_type") == "WEATHER_RISK",
        "strategy_correct": context.get("strategy") == "INDOOR_FALLBACK",
        "execution_context_exists": isinstance(context.get("execution_context"), dict)
        and bool(context["execution_context"]),
        "provider_snapshot_exists": isinstance(context.get("provider_snapshot"), dict)
        and bool(context["provider_snapshot"]),
        "json_serializable": is_json_serializable(context),
    }


def is_json_serializable(value: Any) -> bool:
    try:
        json.dumps(value, ensure_ascii=False)
    except TypeError:
        return False
    return True


if __name__ == "__main__":
    main()
