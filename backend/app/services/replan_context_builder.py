from __future__ import annotations

from copy import deepcopy
from typing import Any

from app.schemas.plan import PlanResponse

ReplanRecord = dict[str, Any]


class ReplanContextBuilder:
    def build(
        self,
        plan: PlanResponse,
        pipeline_result: ReplanRecord,
        replan_decision: ReplanRecord,
    ) -> ReplanRecord:
        execution_context = self._dict(pipeline_result.get("execution_context"))
        risk_flags = self._list(pipeline_result.get("risk_flags"))
        actions = self._list(pipeline_result.get("actions"))
        provider_snapshot = self._dict(execution_context.get("provider_snapshot"))
        current_step = self._current_step(plan, execution_context)
        primary_risk = self._primary_risk(risk_flags, replan_decision)

        return {
            "plan_id": plan.plan_id,
            "session_id": plan.session_id,
            "current_step": current_step,
            "risk_type": self._text(primary_risk.get("type"), "NONE"),
            "severity": self._text(
                replan_decision.get("severity"),
                self._text(primary_risk.get("severity"), "low"),
            ),
            "strategy": self._text(replan_decision.get("strategy"), "CONTINUE"),
            "need_replan": bool(replan_decision.get("need_replan")),
            "current_card_id": self._current_card_id(plan, execution_context, current_step),
            "risk_flags": deepcopy(risk_flags),
            "actions": deepcopy(actions),
            "execution_context": deepcopy(execution_context),
            "provider_snapshot": deepcopy(provider_snapshot),
        }

    def _primary_risk(
        self,
        risk_flags: list[Any],
        replan_decision: ReplanRecord,
    ) -> ReplanRecord:
        risks = [risk for risk in risk_flags if isinstance(risk, dict)]
        if not risks:
            return {}

        strategy = self._text(replan_decision.get("strategy"), "")
        strategy_types = {
            "INDOOR_FALLBACK": {"WEATHER_RISK"},
            "ALTERNATIVE_POI": {"CLOSED_RISK", "BOOKING_RISK"},
            "CONTINUE": {"QUEUE_RISK", "DATA_UNKNOWN"},
        }.get(strategy, set())
        for risk in sorted(risks, key=self._risk_priority):
            if risk.get("type") in strategy_types:
                return risk
        return sorted(risks, key=self._risk_priority)[0]

    def _current_step(self, plan: PlanResponse, execution_context: ReplanRecord) -> int:
        value = execution_context.get("current_step")
        if isinstance(value, int) and value >= 0:
            return value
        return 0 if plan.cards else -1

    def _current_card_id(
        self,
        plan: PlanResponse,
        execution_context: ReplanRecord,
        current_step: int,
    ) -> str:
        value = self._text(execution_context.get("current_card_id"), "")
        if value:
            return value
        if 0 <= current_step < len(plan.cards):
            return plan.cards[current_step].card_id
        return ""

    def _risk_priority(self, risk: ReplanRecord) -> int:
        severity = self._text(risk.get("severity"), "low").lower()
        return {
            "critical": 0,
            "high": 1,
            "medium": 2,
            "low": 3,
        }.get(severity, 99)

    def _dict(self, value: Any) -> ReplanRecord:
        return value if isinstance(value, dict) else {}

    def _list(self, value: Any) -> list[Any]:
        return value if isinstance(value, list) else []

    def _text(self, value: Any, default: str) -> str:
        if isinstance(value, str) and value.strip():
            return value.strip()
        return default
