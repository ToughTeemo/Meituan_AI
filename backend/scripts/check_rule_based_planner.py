from __future__ import annotations

import json
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.plan_context_builder import PlanContextBuilder
from app.services.rule_based_planner import RuleBasedPlanner


def dump(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2)


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
    plan = RuleBasedPlanner().plan(plan_context)

    print(f"title: {plan['title']}")
    print(f"summary: {plan['summary']}")
    print(f"estimated_cost: {plan['estimated_cost']}")
    print(f"confidence: {plan['confidence']}")
    print("\ncards:")
    print(dump(plan["cards"]))


if __name__ == "__main__":
    main()
