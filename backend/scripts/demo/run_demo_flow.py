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

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from demo._common import (
    apply_proposal,
    create_demo_plan,
    execution_check,
    first_proposal,
    get_plan,
    latest_execution,
    latest_proposal,
    print_json,
    proposal_list,
)


def main() -> None:
    plan = create_demo_plan(
        session_id="demo_weather_risk_run_demo_flow",
        prompt="Demo flow: weather risk to proposal apply",
    )
    plan_id = plan["plan_id"]
    execution = execution_check(plan_id)
    latest_exec = latest_execution(plan_id)
    latest = latest_proposal(plan_id)
    proposals = proposal_list(plan_id)
    proposal = latest.get("proposal") or first_proposal(proposals).get("proposal") or {}
    proposal_id = latest.get("proposal_id") or first_proposal(proposals).get("proposal_id")
    applied = apply_proposal(plan_id, proposal_id) if proposal_id else {}
    updated_plan = get_plan(plan_id) if proposal_id else {}

    print_json("Create Plan", plan)
    print_json("Execution Check", execution)
    print_json("Execution Latest", latest_exec)
    print_json("Latest Proposal", latest)
    print_json("Proposal List", proposals)
    print_json("Apply Proposal", applied)
    print_json("Updated Plan", updated_plan)

    if not proposal or proposal.get("replanned") is not True:
        raise RuntimeError("Demo flow did not generate a proposal.")


if __name__ == "__main__":
    main()
