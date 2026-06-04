from __future__ import annotations

from typing import Any

from app.schemas.plan import PlanResponse
from app.services.execution_action_planner import ExecutionActionPlanner
from app.services.execution_context_builder import ExecutionContextBuilder
from app.services.execution_provider_refresh_service import ExecutionProviderRefreshService
from app.services.execution_risk_scanner import ExecutionRiskScanner

ExecutionRecord = dict[str, Any]


class ExecutionPipeline:
    async def run(self, plan: PlanResponse) -> ExecutionRecord:
        execution_context = ExecutionContextBuilder().build(plan)
        refreshed_context = await ExecutionProviderRefreshService().refresh(execution_context)
        scanned_context = ExecutionRiskScanner().scan(refreshed_context)
        action_context = ExecutionActionPlanner().plan(scanned_context)

        risk_flags = self._list(action_context.get("risk_flags"))
        actions = self._list(action_context.get("actions"))
        status = self._status(risk_flags, actions)
        summary = self._summary(status)

        action_context["execution_status"] = status
        return {
            "execution_context": action_context,
            "risk_flags": risk_flags,
            "actions": actions,
            "status": status,
            "summary": summary,
        }

    def result_view(self, pipeline_result: ExecutionRecord) -> ExecutionRecord:
        return {
            "status": pipeline_result.get("status"),
            "summary": pipeline_result.get("summary"),
            "risk_flags": self._list(pipeline_result.get("risk_flags")),
            "actions": self._list(pipeline_result.get("actions")),
        }

    def snapshot_view(self, snapshot: ExecutionRecord) -> ExecutionRecord:
        return {
            "snapshot_id": snapshot.get("id"),
            "status": snapshot.get("status"),
            "summary": snapshot.get("summary"),
            "risk_flags": self._list(snapshot.get("risk_flags")),
            "actions": self._list(snapshot.get("actions")),
            "created_at": snapshot.get("created_at"),
        }

    def _status(self, risk_flags: list[Any], actions: list[Any]) -> str:
        if self._needs_replan(risk_flags):
            return "NEEDS_REPLAN"
        if self._needs_confirmation(risk_flags, actions):
            return "NEEDS_CONFIRMATION"
        return "READY"

    def _needs_replan(self, risk_flags: list[Any]) -> bool:
        for risk in risk_flags:
            if not isinstance(risk, dict):
                continue
            severity = self._text(risk.get("severity"), "").lower()
            if severity in {"critical", "high"} and risk.get("can_replan") is True:
                return True
        return False

    def _needs_confirmation(self, risk_flags: list[Any], actions: list[Any]) -> bool:
        for risk in risk_flags:
            if isinstance(risk, dict) and risk.get("type") == "DATA_UNKNOWN":
                return True
        for action in actions:
            if isinstance(action, dict) and action.get("type") == "confirm":
                return True
        return False

    def _summary(self, status: str) -> str:
        if status == "NEEDS_REPLAN":
            return "\u5b58\u5728\u5929\u6c14/\u8425\u4e1a\u98ce\u9669\uff0c\u5efa\u8bae\u91cd\u89c4\u5212"
        if status == "NEEDS_CONFIRMATION":
            return "\u90e8\u5206\u6570\u636e\u672a\u77e5\uff0c\u5efa\u8bae\u7528\u6237\u786e\u8ba4\u540e\u7ee7\u7eed"
        return "\u5f53\u524d\u8ba1\u5212\u53ef\u7ee7\u7eed\u6267\u884c"

    def _list(self, value: Any) -> list[Any]:
        return value if isinstance(value, list) else []

    def _text(self, value: Any, default: str) -> str:
        if isinstance(value, str) and value.strip():
            return value.strip()
        return default
