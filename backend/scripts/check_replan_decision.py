from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.replan_decision_service import ReplanDecisionService


def main() -> None:
    service = ReplanDecisionService()
    cases = {
        "WEATHER_RISK": (
            risk("WEATHER_RISK", "high", True, "预计降雨概率较高"),
            True,
            "INDOOR_FALLBACK",
        ),
        "CLOSED_RISK": (
            risk("CLOSED_RISK", "critical", True, "预计到达时商户未营业"),
            True,
            "ALTERNATIVE_POI",
        ),
        "BOOKING_RISK": (
            risk("BOOKING_RISK", "high", True, "当前时间段不可预约"),
            True,
            "ALTERNATIVE_POI",
        ),
        "QUEUE_RISK": (
            risk("QUEUE_RISK", "medium", False, "预计排队时间超过 60 分钟"),
            False,
            "CONTINUE",
        ),
        "DATA_UNKNOWN": (
            risk("DATA_UNKNOWN", "low", False, "当前数据可信度未知"),
            False,
            "CONTINUE",
        ),
    }

    decisions = {}
    validation = {}
    for name, (risk_flag, expected_need_replan, expected_strategy) in cases.items():
        decision = service.decide({"risk_flags": [risk_flag]})
        decisions[name] = decision
        validation[name] = (
            decision["need_replan"] is expected_need_replan
            and decision["strategy"] == expected_strategy
            and isinstance(decision["reason"], str)
            and bool(decision["reason"])
            and isinstance(decision["severity"], str)
            and bool(decision["severity"])
        )

    validation["json_serializable"] = is_json_serializable(decisions)

    print("decisions:")
    print(json.dumps(decisions, ensure_ascii=False, indent=2))
    print("\nvalidation result:")
    print(json.dumps(validation, ensure_ascii=False, indent=2))

    if not all(validation.values()):
        raise RuntimeError("Replan decision validation failed.")


def risk(
    risk_type: str,
    severity: str,
    can_replan: bool,
    message: str,
) -> dict[str, Any]:
    return {
        "type": risk_type,
        "severity": severity,
        "source": "check",
        "poi_id": "poi_check",
        "message": message,
        "can_replan": can_replan,
    }


def is_json_serializable(value: Any) -> bool:
    try:
        json.dumps(value, ensure_ascii=False)
    except TypeError:
        return False
    return True


if __name__ == "__main__":
    main()
