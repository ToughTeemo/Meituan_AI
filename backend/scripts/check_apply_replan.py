from __future__ import annotations

import asyncio
import json
import sys
from copy import deepcopy
from pathlib import Path
from typing import Any

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.apply_replan_service import ApplyReplanInput, ApplyReplanService
from app.services.execution_pipeline import ExecutionPipeline
from app.services.plan_context_builder import PlanContextBuilder
from app.services.plan_response_adapter import PlanResponseAdapter
from app.services.replan_context_builder import ReplanContextBuilder
from app.services.replan_decision_service import ReplanDecisionService
from app.services.rule_based_planner import RuleBasedPlanner
from app.services.rule_based_replanner import RuleBasedReplanner


async def main() -> None:
    plan_response = build_plan_response()
    base_plan = plan_response.model_dump(mode="json")
    base_plan_before = deepcopy(base_plan)

    pipeline_result = await ExecutionPipeline().run(plan_response)
    decision = ReplanDecisionService().decide(pipeline_result)
    replan_context = ReplanContextBuilder().build(
        plan_response,
        pipeline_result,
        decision,
    )
    proposal = RuleBasedReplanner().propose(replan_context)

    apply_service = ApplyReplanService()

    apply_input_plan = deepcopy(base_plan)
    apply_input_before = deepcopy(apply_input_plan)
    apply_result = apply_service.apply(
        ApplyReplanInput(plan=apply_input_plan, proposal=proposal)
    )

    snapshot_input_plan = deepcopy(base_plan)
    snapshot_target_index = find_target_card_index(snapshot_input_plan, proposal)
    if snapshot_target_index is not None:
        snapshot_input_plan["cards"][snapshot_target_index]["provider_snapshot"] = build_provider_snapshot(
            snapshot_input_plan["cards"][snapshot_target_index]
        )
    snapshot_input_before = deepcopy(snapshot_input_plan)
    snapshot_result = apply_service.apply(
        ApplyReplanInput(plan=snapshot_input_plan, proposal=proposal)
    )

    validation_result = validate_apply_replan(
        base_plan_before,
        plan_response.model_dump(mode="json"),
        apply_input_before,
        apply_input_plan,
        apply_result,
        proposal,
        snapshot_input_before,
        snapshot_result,
    )

    print("decision:")
    print(json.dumps(decision, ensure_ascii=False, indent=2))
    print("\nreplan_context:")
    print(json.dumps(replan_context, ensure_ascii=False, indent=2))
    print("\nproposal:")
    print(json.dumps(proposal, ensure_ascii=False, indent=2))
    print("\napply_result:")
    print(json.dumps(apply_result, ensure_ascii=False, indent=2))
    print("\nvalidation result:")
    print(json.dumps(validation_result, ensure_ascii=False, indent=2))

    if not all(validation_result.values()):
        raise RuntimeError("Apply replan validation failed.")


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
        session_id="check_apply_replan_session",
        user_id="check_user",
        city="\u4e0a\u6d77",
    )


def validate_apply_replan(
    base_plan_before: dict[str, Any],
    base_plan_after: dict[str, Any],
    apply_input_before: dict[str, Any],
    apply_input_after: dict[str, Any],
    apply_result: dict[str, Any],
    proposal: dict[str, Any],
    snapshot_input_before: dict[str, Any],
    snapshot_result: dict[str, Any],
) -> dict[str, bool]:
    updated_plan = apply_result.get("updated_plan")
    return {
        "original_plan_unchanged": base_plan_before == base_plan_after,
        "apply_input_not_mutated": apply_input_before == apply_input_after,
        "applied_true": apply_result.get("applied") is True,
        "old_poi_replaced": validate_old_new_ids(apply_result),
        "only_target_card_changed": only_target_card_changed(
            base_plan_before,
            updated_plan,
            apply_result,
            proposal,
        ),
        "provider_snapshot_synced": provider_snapshot_synced(
            snapshot_input_before,
            snapshot_result,
            proposal,
        ),
        "updated_plan_serializable": is_json_serializable(updated_plan),
    }


def validate_old_new_ids(apply_result: dict[str, Any]) -> bool:
    old_poi_id = apply_result.get("old_poi_id")
    new_poi_id = apply_result.get("new_poi_id")
    if not isinstance(old_poi_id, str) or not isinstance(new_poi_id, str):
        return False
    return bool(old_poi_id) and bool(new_poi_id) and old_poi_id != new_poi_id


def only_target_card_changed(
    base_plan: dict[str, Any],
    updated_plan: Any,
    apply_result: dict[str, Any],
    proposal: dict[str, Any],
) -> bool:
    if not isinstance(updated_plan, dict):
        return False
    base_cards = base_plan.get("cards")
    updated_cards = updated_plan.get("cards")
    if not isinstance(base_cards, list) or not isinstance(updated_cards, list):
        return False
    if len(base_cards) != len(updated_cards):
        return False

    old_poi_id = apply_result.get("old_poi_id")
    new_poi_id = apply_result.get("new_poi_id")
    target_index = find_card_index_by_poi_id(base_cards, old_poi_id)
    if target_index is None:
        target_index = find_card_index_by_card_id(base_cards, proposal.get("old_card_id"))
    if target_index is None:
        return False

    for index, (base_card, updated_card) in enumerate(zip(base_cards, updated_cards, strict=True)):
        if index == target_index:
            if base_card == updated_card:
                return False
            updated_poi = updated_card.get("poi") if isinstance(updated_card, dict) else {}
            if not isinstance(updated_poi, dict):
                return False
            if updated_poi.get("poi_id") != new_poi_id:
                return False
            continue
        if base_card != updated_card:
            return False
    return True


def provider_snapshot_synced(
    snapshot_input_before: dict[str, Any],
    snapshot_result: dict[str, Any],
    proposal: dict[str, Any],
) -> bool:
    if not isinstance(snapshot_result, dict):
        return False
    updated_plan = snapshot_result.get("updated_plan")
    if not isinstance(updated_plan, dict):
        return False

    target_index = find_target_card_index(snapshot_input_before, proposal)
    if target_index is None:
        return False

    updated_cards = updated_plan.get("cards")
    if not isinstance(updated_cards, list) or target_index >= len(updated_cards):
        return False

    updated_card = updated_cards[target_index]
    if not isinstance(updated_card, dict):
        return False
    provider_snapshot = updated_card.get("provider_snapshot")
    if not isinstance(provider_snapshot, dict):
        return False

    updated_poi = updated_card.get("poi")
    if not isinstance(updated_poi, dict):
        return False

    expected_pairs = {
        "poi_id": updated_poi.get("poi_id"),
        "name": updated_poi.get("name"),
        "category": updated_poi.get("category"),
        "queue_level": updated_poi.get("queue_level"),
        "booking_status": updated_poi.get("booking_status"),
        "hours_label": updated_poi.get("hours_label"),
        "is_open_at_arrival": updated_poi.get("is_open_at_arrival"),
    }
    for key, expected in expected_pairs.items():
        if provider_snapshot.get(key) != expected:
            return False
    return True


def build_provider_snapshot(card: dict[str, Any]) -> dict[str, Any]:
    poi = card.get("poi") if isinstance(card.get("poi"), dict) else {}
    return {
        "provider": "poi",
        "poi_id": poi.get("poi_id"),
        "name": poi.get("name"),
        "category": poi.get("category"),
        "is_indoor": poi.get("is_indoor"),
        "queue_level": poi.get("queue_level"),
        "booking_status": poi.get("booking_status"),
        "hours_label": poi.get("hours_label"),
        "queue_minutes": poi.get("queue_minutes"),
        "estimated_wait_minutes": poi.get("estimated_wait_minutes"),
        "estimated_total_for_family": poi.get("estimated_total_for_family"),
        "price_per_person": poi.get("price_per_person"),
        "source": "not_refreshed",
        "confidence": "unknown",
        "fallback_reason": "execution_context_initialization",
        "is_open_at_arrival": poi.get("is_open_at_arrival"),
        "rating": poi.get("rating"),
        "address": poi.get("address"),
        "district": poi.get("district"),
        "latitude": poi.get("latitude"),
        "longitude": poi.get("longitude"),
        "tags": poi.get("tags", []),
    }


def find_target_card_index(plan_payload: dict[str, Any], proposal: dict[str, Any]) -> int | None:
    cards = plan_payload.get("cards")
    if not isinstance(cards, list):
        return None
    old_card_id = proposal.get("old_card_id")
    old_poi_id = proposal.get("old_poi_id")
    if isinstance(old_card_id, str) and old_card_id:
        index = find_card_index_by_card_id(cards, old_card_id)
        if index is not None:
            return index
    if isinstance(old_poi_id, str) and old_poi_id:
        return find_card_index_by_poi_id(cards, old_poi_id)
    return None


def find_card_index_by_card_id(cards: list[Any], card_id: Any) -> int | None:
    if not isinstance(card_id, str) or not card_id:
        return None
    for index, card in enumerate(cards):
        if isinstance(card, dict) and card.get("card_id") == card_id:
            return index
    return None


def find_card_index_by_poi_id(cards: list[Any], poi_id: Any) -> int | None:
    if not isinstance(poi_id, str) or not poi_id:
        return None
    for index, card in enumerate(cards):
        if not isinstance(card, dict):
            continue
        poi = card.get("poi")
        if isinstance(poi, dict) and poi.get("poi_id") == poi_id:
            return index
    return None


def is_json_serializable(value: Any) -> bool:
    try:
        json.dumps(value, ensure_ascii=False)
    except TypeError:
        return False
    return True


if __name__ == "__main__":
    asyncio.run(main())
