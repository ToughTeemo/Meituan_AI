from __future__ import annotations

import json
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.plan_context_builder import PlanContextBuilder
from app.services.plan_response_adapter import PlanResponseAdapter
from app.services.rule_based_planner import RuleBasedPlanner


def main() -> None:
    prompt = "周末带孩子在上海玩半天，预算不要太高，优先室内"
    constraints = {
        "goal": prompt,
        "time_start": "13:30",
        "time_end": "18:30",
        "adults": 2,
        "children": 1,
        "children_age": 6,
        "budget": 400,
        "departure": "人民广场",
        "transport_mode": "地铁",
        "pace": "轻松",
        "preference_tags": ["亲子", "室内优先", "预算友好"],
    }

    plan_context = PlanContextBuilder().build(
        prompt,
        constraints=constraints,
        limit=8,
    )
    planner_result = RuleBasedPlanner().plan(plan_context)
    plan_response = PlanResponseAdapter().to_plan_response(
        planner_result,
        plan_context=plan_context,
        city="上海",
    )

    payload = plan_response.model_dump(mode="json", exclude_none=True)
    json.dumps(payload, ensure_ascii=False)
    print(json.dumps(payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
