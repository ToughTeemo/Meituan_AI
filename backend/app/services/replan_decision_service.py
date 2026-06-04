from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

ExecutionRecord = dict[str, Any]


@dataclass(frozen=True)
class ReplanDecision:
    need_replan: bool
    reason: str
    strategy: str
    severity: str


class ReplanDecisionService:
    def decide(self, pipeline_result: ExecutionRecord) -> ExecutionRecord:
        risk_flags = self._list(pipeline_result.get("risk_flags"))
        for risk in sorted(risk_flags, key=self._risk_priority):
            if not isinstance(risk, dict):
                continue
            decision = self._decision_for_risk(risk)
            if decision.need_replan:
                return asdict(decision)

        return asdict(
            ReplanDecision(
                need_replan=False,
                reason="当前风险不需要重规划",
                strategy="CONTINUE",
                severity=self._highest_severity(risk_flags),
            )
        )

    def _decision_for_risk(self, risk: ExecutionRecord) -> ReplanDecision:
        risk_type = self._text(risk.get("type"), "")
        severity = self._text(risk.get("severity"), "low").lower()
        message = self._text(risk.get("message"), "发现执行阶段风险")

        if risk_type == "WEATHER_RISK" and severity == "high":
            return ReplanDecision(
                need_replan=True,
                reason=message,
                strategy="INDOOR_FALLBACK",
                severity="high",
            )
        if risk_type == "CLOSED_RISK" and severity == "critical":
            return ReplanDecision(
                need_replan=True,
                reason=message,
                strategy="ALTERNATIVE_POI",
                severity="critical",
            )
        if risk_type == "BOOKING_RISK" and severity == "high":
            return ReplanDecision(
                need_replan=True,
                reason=message,
                strategy="ALTERNATIVE_POI",
                severity="high",
            )

        return ReplanDecision(
            need_replan=False,
            reason=message,
            strategy="CONTINUE",
            severity=severity,
        )

    def _highest_severity(self, risk_flags: list[Any]) -> str:
        severities = [
            self._text(risk.get("severity"), "low").lower()
            for risk in risk_flags
            if isinstance(risk, dict)
        ]
        for severity in ("critical", "high", "medium", "low"):
            if severity in severities:
                return severity
        return "low"

    def _risk_priority(self, risk: Any) -> int:
        if not isinstance(risk, dict):
            return 99
        severity = self._text(risk.get("severity"), "low").lower()
        return {
            "critical": 0,
            "high": 1,
            "medium": 2,
            "low": 3,
        }.get(severity, 99)

    def _list(self, value: Any) -> list[Any]:
        return value if isinstance(value, list) else []

    def _text(self, value: Any, default: str) -> str:
        if isinstance(value, str) and value.strip():
            return value.strip()
        return default
