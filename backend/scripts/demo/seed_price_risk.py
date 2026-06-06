from __future__ import annotations

import json
import os
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("PLANNING_PROVIDER", "rule_based")

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from demo._common import create_demo_plan, print_json


def main() -> None:
    plan = create_demo_plan(
        session_id="demo_price_risk",
        prompt="Demo seed: price risk scenario",
    )
    print_json("price risk demo plan:", plan)
    print("\nplan_id:", plan["plan_id"])


if __name__ == "__main__":
    main()
