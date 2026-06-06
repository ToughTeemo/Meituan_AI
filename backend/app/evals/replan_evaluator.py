from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.core.config import settings
from app.services.llm_replanner import LlmReplanner
from app.services.prompt_registry import PromptRegistry

DEFAULT_CASE_DIR = Path(__file__).resolve().parents[2] / "evals" / "replan_cases"


@dataclass(frozen=True)
class ReplanEvalCase:
    case_id: str
    payload: dict[str, Any]


class ReplanEvaluator:
    def __init__(
        self,
        case_dir: Path | None = None,
        prompt_registry: PromptRegistry | None = None,
    ) -> None:
        self.case_dir = case_dir or DEFAULT_CASE_DIR
        self.prompt_registry = prompt_registry or PromptRegistry()

    def load_cases(self) -> list[ReplanEvalCase]:
        if not self.case_dir.exists():
            raise FileNotFoundError(f"Case directory does not exist: {self.case_dir}")

        cases: list[ReplanEvalCase] = []
        for case_path in sorted(self.case_dir.glob("*.json")):
            payload = json.loads(case_path.read_text(encoding="utf-8"))
            case_id = self._text(payload.get("case_id"), case_path.stem)
            self._validate_case(payload, case_path)
            cases.append(ReplanEvalCase(case_id=case_id, payload=payload))
        return cases

    def evaluate_case(self, case: ReplanEvalCase | dict[str, Any]) -> dict[str, Any]:
        payload = case.payload if isinstance(case, ReplanEvalCase) else case
        case_id = self._text(payload.get("case_id"), "unknown_case")
        try:
            prompt_spec = self.prompt_registry.get_replan_prompt()
            replanner = LlmReplanner(prompt_registry=self.prompt_registry)
            context = self._build_context(payload)
            proposal = replanner.propose(context)
            checks = self._build_checks(payload, proposal)
            passed = all(checks.values())
            score = round((sum(1 for value in checks.values() if value) / len(checks)) * 100, 1)
            return {
                "case_id": case_id,
                "pass": passed,
                "score": score,
                "checks": checks,
                "proposal": proposal,
                "prompt_version": prompt_spec.version,
                "llm_model": getattr(replanner, "last_llm_model", None),
                "fallback_reason": getattr(replanner, "last_fallback_reason", None),
            }
        except Exception as exc:
            checks = {
                "target_poi_id_hit": False,
                "strategy_non_empty": False,
                "reason_non_empty": False,
                "proposal_summary_non_empty": False,
                "target_from_candidates": False,
                "strategy_contains_expected_tokens": False,
            }
            return {
                "case_id": case_id,
                "pass": False,
                "score": 0.0,
                "checks": checks,
                "proposal": {},
                "prompt_version": settings.replan_prompt_version,
                "llm_model": getattr(replanner, "last_llm_model", None) if "replanner" in locals() else None,
                "fallback_reason": getattr(replanner, "last_fallback_reason", None) if "replanner" in locals() else None,
                "error": f"{type(exc).__name__}: {exc}",
            }

    def evaluate_cases(self, cases: list[ReplanEvalCase] | None = None) -> list[dict[str, Any]]:
        loaded_cases = cases if cases is not None else self.load_cases()
        return [self.evaluate_case(case) for case in loaded_cases]

    def _build_context(self, payload: dict[str, Any]) -> dict[str, Any]:
        current_plan = self._dict(payload.get("current_plan"))
        provider_candidates = self._list(payload.get("provider_candidates"))
        risk_flags = self._list(payload.get("risk_flags"))
        execution_context = {
            "cards": self._list(current_plan.get("cards")),
            "current_card_id": self._text(current_plan.get("current_card_id"), ""),
            "provider_snapshot": self._dict(current_plan.get("provider_snapshot")),
        }
        return {
            "plan_id": self._text(current_plan.get("plan_id"), self._text(payload.get("case_id"), "case")),
            "session_id": self._text(current_plan.get("session_id"), self._text(payload.get("case_id"), "case")),
            "current_plan": current_plan,
            "user_prompt": self._text(payload.get("user_prompt"), ""),
            "budget": self._number(payload.get("budget"), 0),
            "current_step": 0,
            "risk_type": self._text(self._dict(risk_flags[0]).get("type"), "NONE") if risk_flags else "NONE",
            "severity": self._text(self._dict(risk_flags[0]).get("severity"), "high") if risk_flags else "high",
            "strategy": self._strategy_hint(payload),
            "need_replan": True,
            "current_card_id": self._text(current_plan.get("current_card_id"), ""),
            "risk_flags": risk_flags,
            "actions": [],
            "execution_context": execution_context,
            "provider_candidates": provider_candidates,
        }

    def _build_checks(self, payload: dict[str, Any], proposal: dict[str, Any]) -> dict[str, bool]:
        expected = self._dict(payload.get("expected"))
        expected_target = self._text(expected.get("target_poi_id"), "")
        strategy_tokens = self._list(expected.get("strategy_contains"))
        target = self._text(self._dict(proposal.get("new_poi")).get("poi_id"), "")
        strategy = self._text(proposal.get("strategy"), "")
        reason = self._text(proposal.get("reason"), "")
        summary = self._text(proposal.get("proposal_summary"), "")
        candidate_ids = {
            self._text(candidate.get("poi_id"), "")
            for candidate in self._list(payload.get("provider_candidates"))
            if isinstance(candidate, dict)
        }
        return {
            "target_poi_id_hit": bool(expected_target) and target == expected_target,
            "strategy_non_empty": bool(strategy),
            "reason_non_empty": bool(reason),
            "proposal_summary_non_empty": bool(summary),
            "target_from_candidates": bool(target) and target in candidate_ids,
            "strategy_contains_expected_tokens": all(
                self._text(token, "").upper() in strategy.upper()
                for token in strategy_tokens
                if self._text(token, "")
            ),
        }

    def _validate_case(self, payload: dict[str, Any], case_path: Path) -> None:
        required_fields = {
            "case_id",
            "risk_flags",
            "current_plan",
            "provider_candidates",
            "budget",
            "user_prompt",
            "expected",
        }
        missing = required_fields - set(payload.keys())
        if missing:
            raise ValueError(f"{case_path.name} is missing fields: {sorted(missing)}")

    def _strategy_hint(self, payload: dict[str, Any]) -> str:
        case_id = self._text(payload.get("case_id"), "").lower()
        if "weather" in case_id:
            return "INDOOR_FALLBACK"
        if "queue" in case_id:
            return "SHORTER_WAIT"
        if "price" in case_id:
            return "BUDGET_FRIENDLY"
        if "closed" in case_id:
            return "ALTERNATIVE_POI"
        return "CONTINUE"

    def _dict(self, value: Any) -> dict[str, Any]:
        return value if isinstance(value, dict) else {}

    def _list(self, value: Any) -> list[Any]:
        return value if isinstance(value, list) else []

    def _text(self, value: Any, default: str) -> str:
        if isinstance(value, str) and value.strip():
            return value.strip()
        return default

    def _number(self, value: Any, default: float) -> float:
        try:
            return float(value)
        except (TypeError, ValueError):
            return default
