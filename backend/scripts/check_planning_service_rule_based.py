from __future__ import annotations

import json
import os
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

os.environ["PLANNING_PROVIDER"] = "rule_based"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from sqlmodel import Session

from app.core.database import create_db_and_tables, engine
from app.repositories.plan_repository import PlanRepository
from app.schemas.plan import CreatePlanRequest
from app.services.planning_service import PlanningService


def main() -> None:
    create_db_and_tables()
    request = CreatePlanRequest(
        prompt="周末带孩子在上海玩半天，预算不要太高，优先室内",
        city="上海",
        session_id="check_rule_based_session",
        user_id="check_user",
    )

    with Session(engine) as session:
        plan = PlanningService(PlanRepository(session)).create_plan(request)

    payload = plan.model_dump(mode="json", exclude_none=True)
    json.dumps(payload, ensure_ascii=False)
    print(json.dumps(payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
