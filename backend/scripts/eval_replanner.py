from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate the replanner against offline cases.")
    mode_group = parser.add_mutually_exclusive_group()
    mode_group.add_argument(
        "--mock",
        dest="mode",
        action="store_const",
        const="mock",
        help="Run deterministic offline mock evaluation. This is the default.",
    )
    mode_group.add_argument(
        "--real",
        dest="mode",
        action="store_const",
        const="real",
        help="Run live DeepSeek evaluation. Requires DEEPSEEK_API_KEY and is non-deterministic.",
    )
    parser.set_defaults(mode="mock")
    return parser.parse_args(argv)


def configure_mode(mode: str) -> None:
    if mode == "real":
        os.environ["LLM_REPLANNER_MOCK"] = "false"
        return
    os.environ["LLM_REPLANNER_MOCK"] = "true"


def main() -> None:
    args = parse_args(sys.argv[1:])
    mode = args.mode
    configure_mode(mode)

    from app.core.config import settings
    from app.evals.replan_evaluator import ReplanEvaluator

    if mode == "real" and not settings.deepseek_api_key:
        print(
            "ERROR: --real requires DEEPSEEK_API_KEY to be configured. "
            "Real evaluation will not fall back to mock mode.",
            file=sys.stderr,
        )
        raise SystemExit(2)

    evaluator = ReplanEvaluator()
    cases = evaluator.load_cases()
    results = evaluator.evaluate_cases(cases)

    total = len(results)
    passed = sum(1 for result in results if bool(result.get("pass")))
    failed = total - passed
    accuracy = round((passed / total) * 100, 1) if total else 0.0
    failed_cases = [result["case_id"] for result in results if not bool(result.get("pass"))]

    print("=================================")
    print()
    print(f"MODE: {mode}")
    if mode == "real":
        print("NOTE: real mode uses live DeepSeek responses and is non-deterministic.")
    print()
    print(f"TOTAL: {total}")
    print()
    print(f"PASS: {passed}")
    print(f"FAIL: {failed}")
    print()
    print(f"ACCURACY: {accuracy}%")
    print()
    print("---------------------------------")
    print()
    print("FAILED CASES")
    print()
    if failed_cases:
        for case_id in failed_cases:
            print(case_id)
    else:
        print("NONE")
    print()
    print("=================================")


if __name__ == "__main__":
    main()
