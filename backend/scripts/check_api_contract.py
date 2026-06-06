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

from fastapi.testclient import TestClient

from app.main import create_app


def main() -> None:
    with TestClient(create_app()) as client:
        create_response = client.post(
            "/api/plans",
            json={
                "prompt": "周末带孩子在上海玩半天，预算不要太高，优先室内",
                "city": "上海",
                "session_id": "check_api_contract_session",
                "user_id": "check_user",
            },
        )
        if create_response.status_code != 201:
            raise RuntimeError(
                f"POST /api/plans failed: {create_response.status_code} "
                f"{create_response.text}"
            )
        before_save_response = create_response.json()

        plan_id = before_save_response["plan_id"]
        get_response = client.get(f"/api/plans/{plan_id}")
        if get_response.status_code != 200:
            raise RuntimeError(
                f"GET /api/plans/{plan_id} failed: {get_response.status_code} "
                f"{get_response.text}"
            )
        after_load_response = get_response.json()

    validation_result = validate_contract(before_save_response, after_load_response)

    print("before save response:")
    print(json.dumps(before_save_response, ensure_ascii=False, indent=2))
    print("\nafter load response:")
    print(json.dumps(after_load_response, ensure_ascii=False, indent=2))
    print("\ncontract validation result:")
    print(json.dumps(validation_result, ensure_ascii=False, indent=2))

    if not all(validation_result.values()):
        raise RuntimeError("API contract validation failed.")


def validate_contract(before: dict[str, Any], after: dict[str, Any]) -> dict[str, bool]:
    before_structure = validate_plan_structure(before)
    after_structure = validate_plan_structure(after)
    return {
        "post_structure_valid": all(before_structure.values()),
        "get_structure_valid": all(after_structure.values()),
        "summary_equal": before.get("summary") == after.get("summary"),
        "cards_equal": before.get("cards") == after.get("cards"),
        "risk_note_equal": risk_notes(before) == risk_notes(after),
        "recommendation_reason_equal": recommendation_reasons(before)
        == recommendation_reasons(after),
        "timeline_equal": before.get("timeline") == after.get("timeline"),
        "constraints_equal": before.get("constraints") == after.get("constraints"),
        "status_equal": before.get("status") == after.get("status"),
        "version_equal": before.get("version") == after.get("version"),
    }


def validate_plan_structure(plan: dict[str, Any]) -> dict[str, bool]:
    cards = plan.get("cards")
    constraints = plan.get("constraints")
    timeline = plan.get("timeline")
    summary = plan.get("summary")

    return {
        "summary": is_dict_with_strings(summary, ["title", "subtitle"]),
        "cards": isinstance(cards, list)
        and bool(cards)
        and all(validate_card(card) for card in cards),
        "timeline": validate_timeline(timeline),
        "constraints": is_dict_with_keys(
            constraints,
            [
                "goal",
                "time_start",
                "time_end",
                "adults",
                "children",
                "budget",
                "departure",
                "transport_mode",
                "pace",
                "preference_tags",
            ],
        ),
        "status": isinstance(plan.get("status"), str) and bool(plan.get("status")),
        "version": isinstance(plan.get("version"), int),
    }


def validate_card(card: Any) -> bool:
    if not isinstance(card, dict):
        return False

    poi = card.get("poi")
    if not isinstance(poi, dict):
        return False

    return all(
        [
            isinstance(card.get("card_id"), str) and bool(card["card_id"]),
            isinstance(card.get("type"), str) and bool(card["type"]),
            isinstance(card.get("status"), str) and bool(card["status"]),
            isinstance(card.get("label"), str) and bool(card["label"]),
            isinstance(card.get("start_minute"), int),
            isinstance(card.get("duration_minutes"), int),
            isinstance(card.get("is_flexible"), bool),
            isinstance(card.get("risk_note"), str) and bool(card["risk_note"]),
            is_dict_with_strings(poi, ["poi_id", "name", "category"]),
            isinstance(poi.get("recommendation_reason"), str)
            and bool(poi["recommendation_reason"]),
        ]
    )


def validate_timeline(value: Any) -> bool:
    if not is_dict_with_keys(
        value,
        ["pixels_per_minute", "min_card_width", "card_height_map"],
    ):
        return False
    card_height_map = value["card_height_map"]
    return is_dict_with_keys(card_height_map, ["transit", "activity", "dining", "buffer"])


def risk_notes(plan: dict[str, Any]) -> list[str | None]:
    return [card.get("risk_note") for card in plan.get("cards", [])]


def recommendation_reasons(plan: dict[str, Any]) -> list[str | None]:
    return [
        (card.get("poi") or {}).get("recommendation_reason")
        for card in plan.get("cards", [])
    ]


def is_dict_with_keys(value: Any, keys: list[str]) -> bool:
    return isinstance(value, dict) and all(key in value for key in keys)


def is_dict_with_strings(value: Any, keys: list[str]) -> bool:
    return is_dict_with_keys(value, keys) and all(
        isinstance(value[key], str) and bool(value[key]) for key in keys
    )


if __name__ == "__main__":
    main()
