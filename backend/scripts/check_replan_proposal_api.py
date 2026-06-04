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
from sqlmodel import Session

from app.core.database import create_db_and_tables, engine
from app.repositories.plan_repository import PlanRepository
from app.schemas.plan import CreatePlanRequest
from app.services.execution_pipeline import ExecutionPipeline
from app.services.planning_service import PlanningService
from app.services.replan_context_builder import ReplanContextBuilder
from app.services.replan_decision_service import ReplanDecisionService
from app.services.rule_based_replanner import RuleBasedReplanner
from app.main import create_app


def main() -> None:
    create_db_and_tables()

    request = CreatePlanRequest(
        prompt=(
            "周末带孩子在上海玩半天，预算不要太高，优先室内，"
            "执行检查后生成可确认的重规划建议"
        ),
        city="上海",
        session_id="check_replan_proposal_api_session",
        user_id="check_user",
    )

    with Session(engine) as session:
        repository = PlanRepository(session)
        plan = PlanningService(repository).create_plan(request)
        pipeline_result = get_execution_pipeline_result(plan)
        execution_snapshot = repository.save_execution_snapshot(
            plan.plan_id,
            plan.version,
            pipeline_result,
        )
        proposal = build_replan_proposal(plan, pipeline_result)
        saved_proposal = repository.save_replan_proposal(
            plan.plan_id,
            execution_snapshot["id"],
            proposal,
        )
        before_plan = dump_model(repository.get(plan.plan_id))
        before_versions = dump_models(repository.list_versions(plan.plan_id))

    with TestClient(create_app()) as client:
        response = client.get(f"/api/plans/{plan.plan_id}/replan/latest")
        if response.status_code != 200:
            raise RuntimeError(
                f"GET /api/plans/{plan.plan_id}/replan/latest failed: "
                f"{response.status_code} {response.text}"
            )
        payload = response.json()

    with Session(engine) as session:
        repository = PlanRepository(session)
        after_plan = dump_model(repository.get(plan.plan_id))
        after_versions = dump_models(repository.list_versions(plan.plan_id))

    if before_plan is None or after_plan is None:
        raise RuntimeError("Plan was not available for comparison.")

    validation_result = validate_replan_proposal_api(
        plan.plan_id,
        proposal,
        saved_proposal,
        payload,
        before_plan,
        after_plan,
        before_versions,
        after_versions,
    )

    print("GET /api/plans/{plan_id}/replan/latest response:")
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    print("\nvalidation result:")
    print(json.dumps(validation_result, ensure_ascii=False, indent=2))

    if not all(validation_result.values()):
        raise RuntimeError("Replan proposal API validation failed.")


def get_execution_pipeline_result(plan: Any) -> dict[str, Any]:
    return asyncio_run(ExecutionPipeline().run(plan))


def build_replan_proposal(plan: Any, pipeline_result: dict[str, Any]) -> dict[str, Any]:
    decision = ReplanDecisionService().decide(pipeline_result)
    replan_context = ReplanContextBuilder().build(plan, pipeline_result, decision)
    return RuleBasedReplanner().propose(replan_context)


def validate_replan_proposal_api(
    plan_id: str,
    proposal: dict[str, Any],
    saved_proposal: dict[str, Any],
    payload: dict[str, Any],
    before_plan: dict[str, Any],
    after_plan: dict[str, Any],
    before_versions: list[Any],
    after_versions: list[Any],
) -> dict[str, bool]:
    return {
        "proposal_id_present": isinstance(payload.get("proposal_id"), str)
        and bool(payload["proposal_id"]),
        "plan_id_matches": payload.get("plan_id") == plan_id,
        "execution_snapshot_id_present": isinstance(payload.get("execution_snapshot_id"), str)
        and bool(payload["execution_snapshot_id"]),
        "strategy_present": isinstance(payload.get("strategy"), str)
        and bool(payload["strategy"]),
        "risk_type_present": isinstance(payload.get("risk_type"), str)
        and bool(payload["risk_type"]),
        "accepted_false": payload.get("accepted") is False,
        "accepted_at_null": payload.get("accepted_at") is None,
        "proposal_matches_saved": payload.get("proposal") == saved_proposal.get("proposal"),
        "proposal_matches_generated": payload.get("proposal") == proposal,
        "proposal_json_round_trip": json.dumps(payload.get("proposal"), ensure_ascii=False)
        == json.dumps(proposal, ensure_ascii=False),
        "plan_unchanged": before_plan == after_plan,
        "plan_version_unchanged": before_plan.get("version") == after_plan.get("version"),
        "versions_unchanged": before_versions == after_versions,
        "no_apply_executed": after_plan.get("version") == before_plan.get("version")
        and len(after_versions) == len(before_versions),
        "response_serializable": is_json_serializable(payload),
    }


def asyncio_run(awaitable: Any) -> Any:
    import asyncio

    return asyncio.run(awaitable)


def dump_model(value: Any) -> Any:
    if value is None:
        return None
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    return value


def dump_models(values: list[Any]) -> list[Any]:
    return [dump_model(value) for value in values]


def is_json_serializable(value: Any) -> bool:
    try:
        json.dumps(value, ensure_ascii=False)
    except TypeError:
        return False
    return True


if __name__ == "__main__":
    main()
