from __future__ import annotations

import argparse
import os
import sys
from dataclasses import dataclass
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

os.environ["LLM_REPLANNER_MOCK"] = "true"
os.environ.setdefault("REPLAN_PROMPT_VERSION", "v1")

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import settings
from app.evals.replan_evaluator import ReplanEvalCase, ReplanEvaluator
from app.services.prompt_registry import PromptRegistry, PromptSpec


class BenchmarkPromptRegistry(PromptRegistry):
    def __init__(self) -> None:
        super().__init__()
        self._replan_prompts = {
            "v1": "replan_v1.txt",
            "v2": "replan_v2.txt",
            "v3": "replan_v3.txt",
        }


@dataclass(frozen=True)
class PromptBenchmarkResult:
    version: str
    total: int
    passed: int
    failed: int
    accuracy: float


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Benchmark replanner prompt versions offline.")
    parser.add_argument(
        "--versions",
        default="v1,v2,v3",
        help="Comma-separated prompt versions to benchmark, for example: v1,v2,v3.",
    )
    return parser.parse_args(argv)


def parse_versions(raw_versions: str) -> list[str]:
    versions = []
    seen = set()
    for raw_version in raw_versions.split(","):
        version = raw_version.strip().lower()
        if not version or version in seen:
            continue
        versions.append(version)
        seen.add(version)
    if not versions:
        raise ValueError("--versions must include at least one prompt version.")
    return versions


def load_prompt_specs(registry: PromptRegistry, versions: list[str]) -> dict[str, PromptSpec]:
    return {version: registry.get_replan_prompt(version) for version in versions}


def benchmark_version(
    version: str,
    evaluator: ReplanEvaluator,
    cases: list[ReplanEvalCase],
) -> PromptBenchmarkResult:
    settings.replan_prompt_version = version
    results = evaluator.evaluate_cases(cases)
    total = len(results)
    passed = sum(1 for result in results if bool(result.get("pass")))
    failed = total - passed
    accuracy = round((passed / total) * 100, 1) if total else 0.0
    return PromptBenchmarkResult(
        version=version,
        total=total,
        passed=passed,
        failed=failed,
        accuracy=accuracy,
    )


def choose_best(results: list[PromptBenchmarkResult]) -> PromptBenchmarkResult:
    if not results:
        raise ValueError("No benchmark results to rank.")
    best = results[0]
    for result in results[1:]:
        if (result.accuracy, result.passed) > (best.accuracy, best.passed):
            best = result
    return best


def main() -> None:
    args = parse_args(sys.argv[1:])
    versions = parse_versions(args.versions)
    registry = BenchmarkPromptRegistry()
    prompt_specs = load_prompt_specs(registry, versions)

    original_prompt_version = settings.replan_prompt_version
    original_mock = settings.llm_replanner_mock
    try:
        settings.llm_replanner_mock = True
        evaluator = ReplanEvaluator(prompt_registry=registry)
        cases = evaluator.load_cases()
        benchmark_results = [
            benchmark_version(prompt_specs[version].version, evaluator, cases)
            for version in versions
        ]
    finally:
        settings.replan_prompt_version = original_prompt_version
        settings.llm_replanner_mock = original_mock

    best = choose_best(benchmark_results)

    print("=================================")
    print()
    print("MODE: mock")
    print(f"VERSIONS: {','.join(versions)}")
    print()
    for result in benchmark_results:
        print("---------------------------------")
        print(f"PROMPT_VERSION: {result.version}")
        print(f"TOTAL: {result.total}")
        print(f"PASS: {result.passed}")
        print(f"FAIL: {result.failed}")
        print(f"ACCURACY: {result.accuracy}%")
        print()
    print("=================================")
    print(f"BEST_PROMPT_VERSION: {best.version}")
    print("=================================")


if __name__ == "__main__":
    main()
