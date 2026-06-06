from __future__ import annotations

import json
import os
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("PLANNING_PROVIDER", "rule_based")
os.environ["DEMO_MODE"] = "true"

SCRIPTS_ROOT = Path(__file__).resolve().parent
if str(SCRIPTS_ROOT) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_ROOT))

from demo._common import (
    apply_proposal,
    create_demo_plan,
    execution_check,
    first_proposal,
    get_plan,
    is_json_serializable,
    is_non_empty_text,
    latest_proposal,
    print_json,
    proposal_list,
)


def main() -> None:
    plan = create_demo_plan(
        session_id="demo_weather_risk_check_flow",
        prompt="Demo validation: weather risk to proposal apply",
    )
    plan_id = plan["plan_id"]

    execution = execution_check(plan_id)
    latest = latest_proposal(plan_id)
    proposals = proposal_list(plan_id)
    proposal_item = first_proposal(proposals)
    proposal_id = latest.get("proposal_id") or proposal_item.get("proposal_id")
    applied = apply_proposal(plan_id, proposal_id) if proposal_id else {}
    updated_plan = get_plan(plan_id) if proposal_id else {}

    latest_proposal_payload = latest.get("proposal") if isinstance(latest.get("proposal"), dict) else {}
    list_proposal_payload = proposal_item.get("proposal") if isinstance(proposal_item.get("proposal"), dict) else {}
    applied_proposal_payload = applied.get("proposal") if isinstance(applied.get("proposal"), dict) else {}

    validation_result = {
        "execution_check_weather_risk": any(
            isinstance(item, dict) and item.get("type") == "WEATHER_RISK"
            for item in execution.get("risk_flags", [])
        ),
        "proposal_auto_generated": latest.get("status") == "PENDING"
        and is_non_empty_text(latest.get("proposal_id"))
        and latest_proposal_payload.get("replanned") is True,
        "latest_readable": is_non_empty_text(latest.get("proposal_id"))
        and is_non_empty_text(latest.get("strategy")),
        "list_readable": isinstance(proposals.get("proposals"), list)
        and bool(proposals.get("proposals")),
        "apply_success": applied.get("status") == "APPLIED"
        and applied.get("accepted") is True
        and isinstance(applied.get("updated_plan"), dict),
        "latest_list_apply_match": latest_proposal_payload == list_proposal_payload == applied_proposal_payload,
        "updated_plan_readable": is_non_empty_text(updated_plan.get("plan_id"))
        and updated_plan.get("status") == "EXECUTING",
        "responses_serializable": all(
            is_json_serializable(payload)
            for payload in [plan, execution, latest, proposals, applied, updated_plan]
        ),
    }

    print_json("Create Plan", plan)
    print_json("Execution Check", execution)
    print_json("Latest Proposal", latest)
    print_json("Proposal List", proposals)
    print_json("Apply Proposal", applied)
    print_json("Updated Plan", updated_plan)
    print("\nvalidation result:")
    print(json.dumps(validation_result, ensure_ascii=False, indent=2))

    if not all(validation_result.values()):
        raise RuntimeError("Demo flow validation failed.")


if __name__ == "__main__":
    main()
