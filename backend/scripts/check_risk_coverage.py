from __future__ import annotations

import json
import os
import sys
from copy import deepcopy
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
from app.schemas.plan import CreatePlanRequest
from app.services.execution_action_planner import ExecutionActionPlanner
from app.services.execution_context_builder import ExecutionContextBuilder
from app.services.execution_risk_scanner import ExecutionRiskScanner
from app.services.planning_service import PlanningService
from app.services.replan_context_builder import ReplanContextBuilder
from app.services.replan_decision_service import ReplanDecisionService
from app.services.rule_based_replanner import RuleBasedReplanner

PROPOSAL_SCHEMA_FIELDS = {
    "replanned",
    "strategy",
    "risk_type",
    "reason",
    "proposal_summary",
    "old_poi",
    "new_poi",
    "requires_user_confirmation",
    "old_card_id",
    "old_poi_id",
}
EXPECTED_STRATEGIES = {
    "WEATHER_RISK": "INDOOR_FALLBACK",
    "QUEUE_RISK": "SHORTER_WAIT",
    "PRICE_RISK": "BUDGET_FRIENDLY",
}


def main() -> None:
    create_db_and_tables()
    request = CreatePlanRequest(
        prompt=(
            "Shanghai weekend family half-day trip, budget friendly, prefer indoor "
            "and low-wait alternatives if execution risk appears."
        ),
        city="Shanghai",
        session_id="check_risk_coverage_session",
        user_id="check_user",
    )

    with Session(engine) as session:
        repository = PlanRepository(session)
        plan = PlanningService(repository).create_plan(request)

    base_context = normalized_execution_context(ExecutionContextBuilder().build(plan))
    proposals = {
        risk_type: generate_proposal_for_risk(plan, base_context, risk_type)
        for risk_type in EXPECTED_STRATEGIES
    }
    validation_result = validate_risk_coverage(proposals)

    print("risk types:")
    print(json.dumps(list(EXPECTED_STRATEGIES), ensure_ascii=False, indent=2))
    print("\ntrigger rules:")
    print(json.dumps(trigger_rules(), ensure_ascii=False, indent=2))
    print("\nproposal examples:")
    print(json.dumps(proposals, ensure_ascii=False, indent=2))
    print("\nvalidation result:")
    print(json.dumps(validation_result, ensure_ascii=False, indent=2))

    if not all(validation_result.values()):
        raise RuntimeError("Risk coverage validation failed.")


def normalized_execution_context(context: dict[str, Any]) -> dict[str, Any]:
    normalized = deepcopy(context)
    snapshot = dict_value(normalized.get("provider_snapshot"))
    budget = number_value(dict_value(normalized.get("constraints")).get("budget"), 500)

    weather = dict_value(snapshot.get("weather"))
    weather.update(
        {
            "provider": "weather",
            "rain_probability": 0.1,
            "prefers_indoor": False,
            "source": "test",
            "confidence": 0.9,
            "fallback_reason": None,
        }
    )
    snapshot["weather"] = weather

    for queue_snapshot in dict_entries(snapshot.get("queue")):
        queue_snapshot.update(
            {
                "provider": "queue",
                "status": "LOW",
                "queue_level": "low",
                "waiting_minutes": 5,
                "estimated_wait_minutes": 5,
                "source": "test",
                "confidence": 0.9,
                "fallback_reason": None,
            }
        )

    for price_snapshot in dict_entries(snapshot.get("price")):
        price_snapshot.update(
            {
                "provider": "price",
                "current_price": min(100, budget * 0.5),
                "estimated_total_for_family": min(100, budget * 0.5),
                "source": "test",
                "confidence": 0.9,
                "fallback_reason": None,
            }
        )

    for provider_name in ("hours", "booking"):
        for provider_snapshot in dict_entries(snapshot.get(provider_name)):
            provider_snapshot["source"] = "test"
            provider_snapshot["confidence"] = 0.9
            provider_snapshot["fallback_reason"] = None
            if provider_name == "hours":
                provider_snapshot["is_open_at_arrival"] = True
            if provider_name == "booking":
                provider_snapshot["status"] = "available"
                provider_snapshot["availability"] = "available"

    normalized["provider_snapshot"] = snapshot
    return normalized


def generate_proposal_for_risk(
    plan: Any,
    base_context: dict[str, Any],
    risk_type: str,
) -> dict[str, Any]:
    context = deepcopy(base_context)
    current_poi_id = current_poi_id_from_context(context)
    if not current_poi_id:
        raise RuntimeError("Current POI id could not be resolved.")

    if risk_type == "WEATHER_RISK":
        dict_value(context["provider_snapshot"].get("weather")).update(
            {
                "rain_probability": 0.9,
                "prefers_indoor": True,
                "summary": "test: rainy weather",
            }
        )
    elif risk_type == "QUEUE_RISK":
        queue = dict_value(context["provider_snapshot"].get("queue"))
        dict_value(queue.get(current_poi_id)).update(
            {
                "status": "HIGH",
                "queue_level": "high",
                "waiting_minutes": 75,
                "estimated_wait_minutes": 75,
            }
        )
    elif risk_type == "PRICE_RISK":
        budget = number_value(dict_value(context.get("constraints")).get("budget"), 500)
        price = dict_value(context["provider_snapshot"].get("price"))
        dict_value(price.get(current_poi_id)).update(
            {
                "current_price": budget + 200,
                "estimated_total_for_family": budget + 200,
            }
        )
    else:
        raise ValueError(f"Unsupported risk type: {risk_type}")

    scanned_context = ExecutionRiskScanner().scan(context)
    action_context = ExecutionActionPlanner().plan(scanned_context)
    pipeline_result = {
        "execution_context": action_context,
        "risk_flags": action_context.get("risk_flags", []),
        "actions": action_context.get("actions", []),
        "status": execution_status(action_context.get("risk_flags", [])),
        "summary": f"test: {risk_type}",
    }
    decision = ReplanDecisionService().decide(pipeline_result)
    replan_context = ReplanContextBuilder().build(plan, pipeline_result, decision)
    proposal = RuleBasedReplanner().propose(replan_context)
    return {
        "risk_flags": pipeline_result["risk_flags"],
        "decision": decision,
        "proposal": proposal,
    }


def validate_risk_coverage(results: dict[str, dict[str, Any]]) -> dict[str, bool]:
    validation: dict[str, bool] = {}
    for risk_type, expected_strategy in EXPECTED_STRATEGIES.items():
        result = dict_value(results.get(risk_type))
        proposal = dict_value(result.get("proposal"))
        decision = dict_value(result.get("decision"))
        risks = result.get("risk_flags")
        risk_flags = risks if isinstance(risks, list) else []
        validation[f"{risk_type.lower()}_risk_detected"] = any(
            isinstance(risk, dict)
            and risk.get("type") == risk_type
            and risk.get("can_replan") is True
            for risk in risk_flags
        )
        validation[f"{risk_type.lower()}_decision_strategy"] = (
            decision.get("need_replan") is True
            and decision.get("strategy") == expected_strategy
        )
        validation[f"{risk_type.lower()}_proposal_schema"] = is_standard_proposal(proposal)
        validation[f"{risk_type.lower()}_proposal_strategy"] = (
            proposal.get("risk_type") == risk_type
            and proposal.get("strategy") == expected_strategy
        )
        validation[f"{risk_type.lower()}_proposal_serializable"] = is_json_serializable(
            proposal
        )
    return validation


def is_standard_proposal(value: Any) -> bool:
    if not isinstance(value, dict):
        return False
    old_poi = value.get("old_poi")
    new_poi = value.get("new_poi")
    return (
        set(value.keys()) == PROPOSAL_SCHEMA_FIELDS
        and value.get("replanned") is True
        and is_non_empty_text(value.get("risk_type"))
        and is_non_empty_text(value.get("strategy"))
        and is_non_empty_text(value.get("reason"))
        and is_non_empty_text(value.get("proposal_summary"))
        and isinstance(old_poi, dict)
        and is_non_empty_text(old_poi.get("poi_id"))
        and isinstance(new_poi, dict)
        and is_non_empty_text(new_poi.get("poi_id"))
        and value.get("requires_user_confirmation") is True
        and is_non_empty_text(value.get("old_card_id"))
        and value.get("old_poi_id") == old_poi.get("poi_id")
        and value.get("old_poi_id") != new_poi.get("poi_id")
    )


def execution_status(risk_flags: Any) -> str:
    risks = risk_flags if isinstance(risk_flags, list) else []
    for risk in risks:
        if not isinstance(risk, dict):
            continue
        if risk.get("can_replan") is True and str(risk.get("severity")).lower() in {
            "critical",
            "high",
        }:
            return "NEEDS_REPLAN"
    return "READY"


def current_poi_id_from_context(context: dict[str, Any]) -> str:
    current_card_id = str(context.get("current_card_id") or "")
    for card in context.get("cards", []):
        if not isinstance(card, dict) or card.get("card_id") != current_card_id:
            continue
        poi = card.get("poi")
        if isinstance(poi, dict) and isinstance(poi.get("poi_id"), str):
            return poi["poi_id"]
    return ""


def trigger_rules() -> dict[str, str]:
    return {
        "WEATHER_RISK": "weather.rain_probability >= 0.6",
        "QUEUE_RISK": "queue.status == HIGH or waiting_minutes > 60",
        "PRICE_RISK": "price.current_price > constraints.budget",
    }


def dict_value(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def dict_entries(value: Any) -> list[dict[str, Any]]:
    payload = dict_value(value)
    return [item for item in payload.values() if isinstance(item, dict)]


def number_value(value: Any, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def is_non_empty_text(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def is_json_serializable(value: Any) -> bool:
    try:
        json.dumps(value, ensure_ascii=False)
    except TypeError:
        return False
    return True


if __name__ == "__main__":
    main()
