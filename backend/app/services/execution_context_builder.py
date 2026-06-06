from __future__ import annotations

from typing import Any

from app.schemas.plan import Card, PlanResponse

ExecutionRecord = dict[str, Any]


class ExecutionContextBuilder:
    def build(self, plan: PlanResponse) -> ExecutionRecord:
        current_step = self._current_step(plan.cards)
        current_card_id = (
            plan.cards[current_step].card_id if 0 <= current_step < len(plan.cards) else ""
        )

        return {
            "plan_id": plan.plan_id,
            "session_id": plan.session_id,
            "current_step": current_step,
            "current_card_id": current_card_id,
            "execution_status": "READY",
            "constraints": plan.constraints.model_dump(mode="json"),
            "timeline": plan.timeline.model_dump(mode="json"),
            "cards": [
                card.model_dump(mode="json", exclude_none=True) for card in plan.cards
            ],
            "provider_snapshot": self._provider_snapshot(plan),
            "risk_flags": self._risk_flags(plan),
        }

    def _current_step(self, cards: list[Card]) -> int:
        for index, card in enumerate(cards):
            if card.status == "active":
                return index
        for index, card in enumerate(cards):
            if card.status in {"pending", "upcoming"}:
                return index
        return 0

    def _provider_snapshot(self, plan: PlanResponse) -> ExecutionRecord:
        weather = {
            "provider": "weather",
            "source": "not_refreshed",
            "confidence": "unknown",
            "fallback_reason": "execution_context_initialization",
        }
        hours: dict[str, ExecutionRecord] = {}
        queue: dict[str, ExecutionRecord] = {}
        booking: dict[str, ExecutionRecord] = {}
        price: dict[str, ExecutionRecord] = {}

        for card in plan.cards:
            poi = card.poi
            if poi is None:
                continue

            hours[poi.poi_id] = {
                "provider": "hours",
                "poi_id": poi.poi_id,
                "name": poi.name,
                "hours_label": poi.hours_label or "unknown",
                "is_open_at_arrival": "unknown",
                "source": "plan_response",
                "confidence": "unknown",
                "fallback_reason": "execution_context_not_refreshed",
            }
            queue[poi.poi_id] = {
                "provider": "queue",
                "poi_id": poi.poi_id,
                "name": poi.name,
                "queue_level": self._queue_level(poi.queue_minutes),
                "estimated_wait_minutes": poi.queue_minutes,
                "source": "plan_response",
                "confidence": "unknown",
                "fallback_reason": "execution_context_not_refreshed",
            }
            booking[poi.poi_id] = {
                "provider": "booking",
                "poi_id": poi.poi_id,
                "name": poi.name,
                "status": "unknown",
                "supported": False,
                "required_user_action": "执行前确认预约或购票状态",
                "source": "not_refreshed",
                "confidence": "unknown",
                "fallback_reason": "execution_context_initialization",
            }
            price[poi.poi_id] = {
                "provider": "price",
                "poi_id": poi.poi_id,
                "name": poi.name,
                "avg_price": poi.price_per_person,
                "currency": "CNY",
                "source": "plan_response",
                "confidence": "unknown",
                "fallback_reason": "execution_context_not_refreshed",
            }

        return {
            "weather": weather,
            "hours": hours,
            "queue": queue,
            "booking": booking,
            "price": price,
        }

    def _risk_flags(self, plan: PlanResponse) -> list[ExecutionRecord]:
        flags: list[ExecutionRecord] = []
        if plan.active_risk is not None:
            active_risk = plan.active_risk.model_dump(mode="json")
            active_risk["source"] = "active_risk"
            flags.append(active_risk)

        for card in plan.cards:
            if card.poi is None:
                continue
            for label in card.poi.risk_labels:
                flags.append(
                    {
                        "type": self._risk_type(label),
                        "label": label,
                        "card_id": card.card_id,
                        "poi_id": card.poi.poi_id,
                        "source": "plan_card",
                    }
                )
        return flags

    def _queue_level(self, queue_minutes: int) -> str:
        if queue_minutes <= 10:
            return "low"
        if queue_minutes <= 25:
            return "medium"
        return "high"

    def _risk_type(self, label: str) -> str:
        mapping = {
            "排队": "queue",
            "热门": "queue",
            "预算": "budget",
            "天气": "weather",
            "需确认": "confirmation",
            "低置信": "provider_confidence",
        }
        return mapping.get(label, "note")
