from __future__ import annotations

import json
import os
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

os.environ["LLM_REPLANNER_MOCK"] = "true"
os.environ.setdefault("REPLAN_PROMPT_VERSION", "v1")

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.evals.replan_evaluator import ReplanEvaluator


def main() -> None:
    evaluator = ReplanEvaluator()
    cases = evaluator.load_cases()
    results = evaluator.evaluate_cases(cases)
    validation_result = {
        "case_loadable": bool(cases),
        "evaluator_executable": bool(results),
        "mock_mode_passed": all(bool(result.get("pass")) for result in results),
        "responses_serializable": is_json_serializable(results),
    }

    print(json.dumps({"results": results, "validation_result": validation_result}, ensure_ascii=False, indent=2))

    if not all(validation_result.values()):
        raise RuntimeError("Eval framework validation failed.")


def is_json_serializable(value: object) -> bool:
    try:
        json.dumps(value, ensure_ascii=False)
    except TypeError:
        return False
    return True


if __name__ == "__main__":
    main()
