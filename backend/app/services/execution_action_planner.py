from __future__ import annotations

from copy import deepcopy
from dataclasses import asdict, dataclass
from typing import Any

ExecutionRecord = dict[str, Any]


@dataclass(frozen=True)
class ExecutionAction:
    type: str
    priority: str
    risk_type: str | None
    poi_id: str | None
    label: str
    message: str
    requires_user_confirmation: bool
    payload: dict[str, Any]


class ExecutionActionPlanner:
    PRIORITY_ORDER = {
        "critical": 0,
        "high": 1,
        "medium": 2,
        "low": 3,
    }

    def plan(self, execution_context: ExecutionRecord) -> ExecutionRecord:
        planned = deepcopy(execution_context)
        risk_flags = self._list(planned.get("risk_flags"))

        actions: list[ExecutionAction] = []
        seen: set[tuple[str, str | None]] = set()
        for risk in risk_flags:
            if not isinstance(risk, dict):
                continue
            action = self._action_for_risk(risk)
            if action is None:
                continue
            self._add_action(actions, seen, action)

        if not self._has_high_or_critical_risk(risk_flags):
            navigation_action = self._navigation_action(planned)
            if navigation_action is not None:
                self._add_action(actions, seen, navigation_action)

        planned["actions"] = [
            asdict(action)
            for action in sorted(
                actions,
                key=lambda item: self.PRIORITY_ORDER.get(item.priority, 99),
            )
        ]
        return planned

    def _action_for_risk(self, risk: ExecutionRecord) -> ExecutionAction | None:
        risk_type = self._text(risk.get("type"), "")
        severity = self._priority(risk.get("severity"))
        poi_id = self._poi_id(risk)

        if risk_type == "WEATHER_RISK" and severity == "high":
            return self._suggest_replan(
                risk,
                poi_id,
                "天气风险较高，建议切换室内备选方案",
            )
        if risk_type == "CLOSED_RISK" and severity == "critical":
            return self._suggest_replan(
                risk,
                poi_id,
                "预计到达时未营业，建议更换地点",
            )
        if risk_type == "QUEUE_RISK" and severity == "medium":
            return ExecutionAction(
                type="wait_or_continue",
                priority="medium",
                risk_type=risk_type,
                poi_id=poi_id,
                label="等待或继续",
                message="预计排队较久，可继续等待或稍后调整",
                requires_user_confirmation=True,
                payload=self._risk_payload(risk),
            )
        if risk_type == "BOOKING_RISK" and severity == "high":
            return self._suggest_replan(
                risk,
                poi_id,
                "当前不可预约，建议更换地点或改时间",
            )
        if risk_type == "DATA_UNKNOWN" and severity == "low":
            return ExecutionAction(
                type="confirm",
                priority="low",
                risk_type=risk_type,
                poi_id=poi_id,
                label="确认后继续",
                message="部分数据未知，建议用户确认后继续",
                requires_user_confirmation=True,
                payload=self._risk_payload(risk),
            )
        if severity == "low":
            return ExecutionAction(
                type="notify",
                priority="low",
                risk_type=risk_type or None,
                poi_id=poi_id,
                label="风险提示",
                message=self._text(risk.get("message"), "当前存在低优先级提示"),
                requires_user_confirmation=True,
                payload=self._risk_payload(risk),
            )
        return None

    def _suggest_replan(
        self,
        risk: ExecutionRecord,
        poi_id: str | None,
        message: str,
    ) -> ExecutionAction:
        return ExecutionAction(
            type="suggest_replan",
            priority=self._priority(risk.get("severity")),
            risk_type=self._text(risk.get("type"), None),
            poi_id=poi_id,
            label="建议调整方案",
            message=message,
            requires_user_confirmation=True,
            payload={
                **self._risk_payload(risk),
                "can_replan": bool(risk.get("can_replan")),
            },
        )

    def _navigation_action(self, context: ExecutionRecord) -> ExecutionAction | None:
        card = self._current_card(context)
        if not card:
            return None

        poi = self._dict(card.get("poi"))
        poi_id = self._text(poi.get("poi_id"), "")
        if not poi_id:
            return None

        card_id = self._text(card.get("card_id"), self._text(context.get("current_card_id"), ""))
        name = self._text(poi.get("name"), "当前地点")
        return ExecutionAction(
            type="open_navigation",
            priority="low",
            risk_type=None,
            poi_id=poi_id,
            label="打开导航",
            message=f"当前无高优先级风险，可打开前往 {name} 的导航占位",
            requires_user_confirmation=True,
            payload={
                "card_id": card_id,
                "poi_id": poi_id,
                "name": name,
                "provider": "navigation_placeholder",
                "external_service_called": False,
            },
        )

    def _current_card(self, context: ExecutionRecord) -> ExecutionRecord:
        cards = self._list(context.get("cards"))
        current_card_id = self._text(context.get("current_card_id"), "")
        for card in cards:
            if isinstance(card, dict) and card.get("card_id") == current_card_id:
                return card
        for card in cards:
            if isinstance(card, dict) and card.get("status") == "active":
                return card
        for card in cards:
            if isinstance(card, dict):
                return card
        return {}

    def _has_high_or_critical_risk(self, risks: list[Any]) -> bool:
        for risk in risks:
            if not isinstance(risk, dict):
                continue
            if self._priority(risk.get("severity")) in {"critical", "high"}:
                return True
        return False

    def _add_action(
        self,
        actions: list[ExecutionAction],
        seen: set[tuple[str, str | None]],
        action: ExecutionAction,
    ) -> None:
        key = (action.type, action.poi_id)
        if key in seen:
            return
        seen.add(key)
        actions.append(action)

    def _risk_payload(self, risk: ExecutionRecord) -> dict[str, Any]:
        return {
            "risk_type": self._text(risk.get("type"), ""),
            "risk_source": self._text(risk.get("source"), ""),
            "risk_severity": self._priority(risk.get("severity")),
            "risk_message": self._text(risk.get("message"), ""),
            "can_replan": bool(risk.get("can_replan")),
        }

    def _priority(self, value: Any) -> str:
        priority = self._text(value, "low").lower()
        return priority if priority in self.PRIORITY_ORDER else "low"

    def _poi_id(self, risk: ExecutionRecord) -> str | None:
        poi_id = risk.get("poi_id")
        return poi_id.strip() if isinstance(poi_id, str) and poi_id.strip() else None

    def _dict(self, value: Any) -> ExecutionRecord:
        return value if isinstance(value, dict) else {}

    def _list(self, value: Any) -> list[Any]:
        return value if isinstance(value, list) else []

    def _text(self, value: Any, default: str | None) -> str:
        if isinstance(value, str) and value.strip():
            return value.strip()
        return default or ""
