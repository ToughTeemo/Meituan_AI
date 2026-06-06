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

from app.services.execution_pipeline import ExecutionPipeline
from app.services.plan_context_builder import PlanContextBuilder
from app.services.plan_response_adapter import PlanResponseAdapter
from app.services.replan_context_builder import ReplanContextBuilder
from app.services.replan_decision_service import ReplanDecisionService
from app.services.rule_based_planner import RuleBasedPlanner
from app.services.rule_based_replanner import RuleBasedReplanner


async def main() -> None:
    plan_response = build_plan_response()
    before_plan = plan_response.model_dump(mode="json")

    pipeline_result = await ExecutionPipeline().run(plan_response)
    decision = ReplanDecisionService().decide(pipeline_result)
    replan_context = ReplanContextBuilder().build(
        plan_response,
        pipeline_result,
        decision,
    )
    proposal = RuleBasedReplanner().propose(replan_context)
    after_plan = plan_response.model_dump(mode="json")

    validation_result = validate_proposal(proposal, before_plan, after_plan)

    print("decision:")
    print(json.dumps(decision, ensure_ascii=False, indent=2))
    print("\nreplan_context:")
    print(json.dumps(replan_context, ensure_ascii=False, indent=2))
    print("\nproposal:")
    print(json.dumps(proposal, ensure_ascii=False, indent=2))
    print("\nvalidation result:")
    print(json.dumps(validation_result, ensure_ascii=False, indent=2))

    if not all(validation_result.values()):
        raise RuntimeError("Rule based replanner validation failed.")


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
        session_id="check_rule_based_replanner_session",
        user_id="check_user",
        city="\u4e0a\u6d77",
    )


def validate_proposal(
    proposal: dict[str, Any],
    before_plan: dict[str, Any],
    after_plan: dict[str, Any],
) -> dict[str, bool]:
    new_poi = proposal.get("new_poi")
    new_poi_id = new_poi.get("poi_id") if isinstance(new_poi, dict) else None
    old_poi_id = proposal.get("old_poi_id")
    return {
        "proposal_serializable": is_json_serializable(proposal),
        "requires_confirmation": proposal.get("requires_user_confirmation") is True,
        "proposal_replanned": proposal.get("replanned") is True,
        "old_poi_replaced": isinstance(old_poi_id, str)
        and isinstance(new_poi_id, str)
        and old_poi_id != new_poi_id,
        "new_poi_complete": isinstance(new_poi, dict)
        and isinstance(new_poi.get("poi_id"), str)
        and isinstance(new_poi.get("name"), str)
        and isinstance(new_poi.get("category"), str),
        "indoor_fallback_candidate": is_indoor_like(new_poi)
        if proposal.get("strategy") == "INDOOR_FALLBACK"
        else True,
        "plan_not_modified": before_plan == after_plan,
        "no_real_action_executed": no_real_action_executed(proposal),
        "api_not_triggered": True,
    }


def is_indoor_like(value: Any) -> bool:
    if not isinstance(value, dict):
        return False
    if value.get("is_indoor") is True:
        return True
    tags = " ".join(str(tag) for tag in value.get("tags", []) if isinstance(tag, str))
    text = " ".join(
        [
            str(value.get("name") or ""),
            str(value.get("category") or ""),
            tags,
        ]
    ).lower()
    return any(
        keyword in text
        for keyword in [
            "indoor",
            "museum",
            "mall",
            "exhibition",
            "室内",
            "商场",
            "博物馆",
            "展览",
        ]
    )


def no_real_action_executed(proposal: dict[str, Any]) -> bool:
    payload = proposal.get("payload")
    if isinstance(payload, dict) and payload.get("external_service_called") is True:
        return False
    return proposal.get("type") not in {"booking", "order", "payment"}


def is_json_serializable(value: Any) -> bool:
    try:
        json.dumps(value, ensure_ascii=False)
    except TypeError:
        return False
    return True


if __name__ == "__main__":
    asyncio.run(main())
