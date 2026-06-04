from __future__ import annotations

import asyncio
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
from app.schemas.plan import CreatePlanRequest
from app.services.execution_pipeline import ExecutionPipeline
from app.services.planning_service import PlanningService
from app.services.replan_context_builder import ReplanContextBuilder
from app.services.replan_decision_service import ReplanDecisionService
from app.services.rule_based_replanner import RuleBasedReplanner


async def main() -> None:
    create_db_and_tables()
    request = CreatePlanRequest(
        prompt=(
            "周末带孩子在上海玩半天，预算不要太高，优先室内，"
            "执行检查后生成可确认的重规划建议"
        ),
        city="上海",
        session_id="check_replan_proposal_session",
        user_id="check_user",
    )

    with Session(engine) as session:
        repository = PlanRepository(session)
        plan = PlanningService(repository).create_plan(request)
        pipeline_result = await ExecutionPipeline().run(plan)
        execution_snapshot = repository.save_execution_snapshot(
            plan.plan_id,
            plan.version,
            pipeline_result,
        )
        decision = ReplanDecisionService().decide(pipeline_result)
        replan_context = ReplanContextBuilder().build(plan, pipeline_result, decision)
        proposal = RuleBasedReplanner().propose(replan_context)

        saved_proposal = repository.save_replan_proposal(
            plan.plan_id,
            execution_snapshot["id"],
            proposal,
        )
        loaded_proposal = repository.get_replan_proposal(saved_proposal["id"])
        latest_proposal = repository.get_latest_replan_proposal(plan.plan_id)
        all_proposals = repository.list_replan_proposals(plan.plan_id)

    if loaded_proposal is None or latest_proposal is None:
        raise RuntimeError("Replan proposal was not loaded after save.")

    validation_result = validate_replan_proposal(
        proposal,
        saved_proposal,
        loaded_proposal,
        latest_proposal,
        all_proposals,
    )

    print("proposal:")
    print(json.dumps(proposal, ensure_ascii=False, indent=2))
    print("\nsaved proposal:")
    print(json.dumps(saved_proposal, ensure_ascii=False, indent=2))
    print("\nloaded proposal:")
    print(json.dumps(loaded_proposal, ensure_ascii=False, indent=2))
    print("\nlatest proposal:")
    print(json.dumps(latest_proposal, ensure_ascii=False, indent=2))
    print("\nvalidation result:")
    print(json.dumps(validation_result, ensure_ascii=False, indent=2))

    if not all(validation_result.values()):
        raise RuntimeError("Replan proposal persistence check failed.")


def validate_replan_proposal(
    proposal: dict[str, Any],
    saved_proposal: dict[str, Any],
    loaded_proposal: dict[str, Any],
    latest_proposal: dict[str, Any],
    all_proposals: list[dict[str, Any]],
) -> dict[str, bool]:
    proposal_json = json.dumps(proposal, ensure_ascii=False)
    return {
        "saved_matches_loaded": saved_proposal == loaded_proposal,
        "latest_matches_loaded": latest_proposal == loaded_proposal,
        "list_contains_proposal": len(all_proposals) == 1 and all_proposals[0] == loaded_proposal,
        "proposal_json_equal": loaded_proposal.get("proposal_json") == proposal_json,
        "proposal_parsed_equal": loaded_proposal.get("proposal") == proposal,
        "risk_type_recorded": loaded_proposal.get("risk_type") not in {None, "", "NONE"},
        "accepted_false": loaded_proposal.get("accepted") is False,
        "proposal_json_serializable": is_json_serializable(loaded_proposal.get("proposal_json")),
        "loaded_serializable": is_json_serializable(loaded_proposal),
    }


def is_json_serializable(value: Any) -> bool:
    try:
        json.dumps(value, ensure_ascii=False)
    except TypeError:
        return False
    return True


if __name__ == "__main__":
    asyncio.run(main())
