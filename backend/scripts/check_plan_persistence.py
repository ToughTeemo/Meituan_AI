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

from sqlmodel import Session

from app.core.database import create_db_and_tables, engine
from app.repositories.plan_repository import PlanRepository
from app.services.plan_context_builder import PlanContextBuilder
from app.services.plan_response_adapter import PlanResponseAdapter
from app.services.rule_based_planner import RuleBasedPlanner


def main() -> None:
    create_db_and_tables()
    prompt = "周末带孩子在上海玩半天，预算不要太高，优先室内"
    plan_context = PlanContextBuilder().build(prompt, limit=8)
    planner_result = RuleBasedPlanner().plan(plan_context)
    before_save = PlanResponseAdapter().to_plan_response(
        planner_result,
        plan_context=plan_context,
        session_id="check_persistence_session",
        user_id="check_user",
        city="上海",
    )

    with Session(engine) as session:
        repository = PlanRepository(session)
        repository.create(before_save)
        after_load = repository.get(before_save.plan_id)

    if after_load is None:
        raise RuntimeError("Plan was not loaded after save.")

    diff_result = compare_plan(before_save.model_dump(mode="json"), after_load.model_dump(mode="json"))

    print("before save:")
    print(json.dumps(snapshot(before_save.model_dump(mode="json")), ensure_ascii=False, indent=2))
    print("\nafter load:")
    print(json.dumps(snapshot(after_load.model_dump(mode="json")), ensure_ascii=False, indent=2))
    print("\ndiff result:")
    print(json.dumps(diff_result, ensure_ascii=False, indent=2))

    if not all(diff_result.values()):
        raise RuntimeError("Plan persistence check failed.")


def snapshot(plan: dict[str, Any]) -> dict[str, Any]:
    return {
        "summary": plan["summary"],
        "cards": [
            {
                "card_id": card["card_id"],
                "label": card["label"],
                "risk_note": card.get("risk_note"),
                "recommendation_reason": (card.get("poi") or {}).get(
                    "recommendation_reason"
                ),
            }
            for card in plan["cards"]
        ],
    }


def compare_plan(before: dict[str, Any], after: dict[str, Any]) -> dict[str, bool]:
    before_cards = before["cards"]
    after_cards = after["cards"]
    return {
        "summary_equal": before["summary"] == after["summary"],
        "cards_equal": before_cards == after_cards,
        "risk_note_equal": [
            card.get("risk_note") for card in before_cards
        ]
        == [card.get("risk_note") for card in after_cards],
        "recommendation_reason_equal": [
            (card.get("poi") or {}).get("recommendation_reason") for card in before_cards
        ]
        == [
            (card.get("poi") or {}).get("recommendation_reason") for card in after_cards
        ],
    }


if __name__ == "__main__":
    main()
