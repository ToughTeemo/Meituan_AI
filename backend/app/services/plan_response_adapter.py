from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from app.schemas.plan import (
    POI,
    Card,
    Constraints,
    MapPosition,
    PlanResponse,
    PlanSummary,
)
from app.services.mock_data import default_constraints, default_timeline, new_log

PlanRecord = dict[str, Any]


class PlanResponseAdapter:
    CONFIDENCE_VALUES = {
        "high": 1.0,
        "medium": 0.7,
        "low": 0.4,
        "unknown": 0.1,
    }

    def to_plan_response(
        self,
        planner_result: PlanRecord,
        plan_context: PlanRecord | None = None,
        session_id: str | None = None,
        user_id: str | None = None,
        city: str = "上海",
    ) -> PlanResponse:
        context = plan_context or {}
        constraints = self._constraints(context, planner_result)
        candidate_index = self._candidate_index(context)
        cards = self._cards(planner_result, candidate_index, constraints)
        now = datetime.now(UTC)

        estimated_cost = round(self._number(planner_result.get("estimated_cost"), 0))
        confidence = round(self._number(planner_result.get("confidence"), 0), 2)
        title = self._text(planner_result.get("title"), "上海周末半日方案")
        summary = self._text(
            planner_result.get("summary"),
            f"根据规则筛选出 {len(cards)} 个候选地点。",
        )

        return PlanResponse(
            plan_id=f"plan_{uuid4().hex[:10]}",
            session_id=self._session_id(session_id),
            user_id=user_id,
            city=self._text(city, "上海"),
            source="rule_based",
            status="EXECUTING",
            version=1,
            constraints=constraints,
            timeline=default_timeline(),
            cards=cards,
            active_risk=None,
            agent_logs=[
                new_log("RuleBasedPlanner 已基于 Provider 上下文生成前端可展示方案。"),
                new_log(f"预计总费用约 {estimated_cost} 元，平均置信度 {confidence:.2f}。"),
            ],
            summary=PlanSummary(
                title=title,
                subtitle=(
                    f"{summary} 预计总费用约 {estimated_cost} 元，"
                    f"平均置信度 {confidence:.2f}。"
                ),
            ),
            created_at=now,
            updated_at=now,
        )

    def _constraints(self, context: PlanRecord, planner_result: PlanRecord) -> Constraints:
        request = self._dict(context.get("request"))
        raw_constraints = request.get("constraints")
        if isinstance(raw_constraints, Constraints):
            return raw_constraints
        if isinstance(raw_constraints, dict):
            return Constraints(**raw_constraints)

        title = self._text(planner_result.get("title"), "上海周末半日方案")
        return default_constraints(title)

    def _candidate_index(self, context: PlanRecord) -> dict[str, PlanRecord]:
        index: dict[str, PlanRecord] = {}
        for candidate in self._list(context.get("candidates")):
            if not isinstance(candidate, dict):
                continue
            poi = self._dict(candidate.get("poi"))
            poi_id = self._text(poi.get("poi_id"), "")
            if poi_id:
                index[poi_id] = candidate
        return index

    def _cards(
        self,
        planner_result: PlanRecord,
        candidate_index: dict[str, PlanRecord],
        constraints: Constraints,
    ) -> list[Card]:
        raw_cards = self._list(planner_result.get("cards"))
        cards: list[Card] = []
        minute = 0
        for index, raw_card in enumerate(raw_cards):
            if not isinstance(raw_card, dict):
                continue
            poi_id = self._text(raw_card.get("poi_id"), f"unknown_{index + 1}")
            candidate = candidate_index.get(poi_id, {})
            card_type = self._card_type(raw_card, candidate)
            duration = 80 if card_type == "dining" else 75
            detail_note = self._detail_note(raw_card, candidate)
            cards.append(
                Card(
                    card_id=f"card_{poi_id}",
                    type=card_type,
                    status="active" if index == 0 else "pending",
                    label=self._label(raw_card),
                    emoji=self._emoji(raw_card, card_type),
                    start_minute=minute,
                    duration_minutes=duration,
                    is_flexible=card_type != "dining",
                    is_new=True,
                    poi=self._poi(raw_card, candidate, constraints, detail_note),
                    risk_note=detail_note,
                    alternatives=[],
                )
            )
            minute += duration
        return cards

    def _poi(
        self,
        card: PlanRecord,
        candidate: PlanRecord,
        constraints: Constraints,
        detail_note: str,
    ) -> POI:
        source_poi = self._dict(candidate.get("poi"))
        source_queue = self._dict(candidate.get("queue"))
        source_price = self._dict(candidate.get("price"))
        map_position = self._dict(source_poi.get("map_position"))

        estimated_cost = round(self._estimated_cost(card))
        party_size = max(1, constraints.adults + constraints.children)
        price_per_person = self._number_or_none(source_price.get("avg_price"))
        if price_per_person is None and estimated_cost > 0:
            price_per_person = estimated_cost / party_size
        if price_per_person is None:
            price_per_person = self._number(source_poi.get("price_per_person"), 0)

        queue_minutes = self._number_or_none(source_queue.get("estimated_wait_minutes"))
        if queue_minutes is None:
            queue_minutes = self._number(source_poi.get("queue_minutes"), 0)

        return POI(
            poi_id=self._text(card.get("poi_id"), self._text(source_poi.get("poi_id"), "unknown")),
            name=self._text(card.get("name"), self._text(source_poi.get("name"), "未知地点")),
            rating=self._number(source_poi.get("rating"), 4.0),
            price_per_person=max(0, round(price_per_person)),
            queue_minutes=max(0, round(queue_minutes)),
            category=self._text(
                card.get("category"),
                self._text(source_poi.get("category"), "未知类型"),
            ),
            map_position=MapPosition(
                x=self._number(map_position.get("x"), 50),
                y=self._number(map_position.get("y"), 50),
            ),
            is_child_friendly=bool(source_poi.get("is_child_friendly"))
            or constraints.children > 0,
            hours_label=self._text(
                card.get("hours_label"),
                self._text(source_poi.get("hours_label"), "营业时间未知"),
            ),
            address=self._text(source_poi.get("address"), "地址待确认"),
            district=self._text(source_poi.get("district"), "上海"),
            latitude=self._number(source_poi.get("latitude"), 0),
            longitude=self._number(source_poi.get("longitude"), 0),
            recommendation_reason=detail_note,
            risk_labels=self._risk_labels(card, candidate),
        )

    def _card_type(self, card: PlanRecord, candidate: PlanRecord) -> str:
        poi = self._dict(candidate.get("poi"))
        text = " ".join(
            [
                self._text(card.get("name"), ""),
                self._text(card.get("category"), ""),
                self._text(poi.get("category"), ""),
                " ".join(str(tag) for tag in self._list(poi.get("tags"))),
            ]
        )
        if any(word in text for word in ["餐", "饭", "咖啡", "food", "dining"]):
            return "dining"
        return "activity"

    def _label(self, card: PlanRecord) -> str:
        name = self._text(card.get("name"), "未知地点")
        category = self._text(card.get("category"), "未知类型")
        return f"{name} · {category}"

    def _emoji(self, card: PlanRecord, card_type: str) -> str:
        if card_type == "dining":
            return "🍽️"
        text = f"{self._text(card.get('name'), '')} {self._text(card.get('category'), '')}"
        if any(word in text for word in ["公园", "户外"]):
            return "🌿"
        if any(word in text for word in ["馆", "展"]):
            return "🏛️"
        if any(word in text for word in ["街区", "商场"]):
            return "📍"
        return "📍"

    def _detail_note(self, card: PlanRecord, candidate: PlanRecord) -> str:
        reason = self._text(card.get("reason"), "根据规则筛选出的候选地点")
        return (
            f"{reason}；estimated_cost={round(self._estimated_cost(card))}；"
            f"confidence={self._confidence(card, candidate):.2f}"
        )

    def _risk_labels(self, card: PlanRecord, candidate: PlanRecord) -> list[str]:
        labels: list[str] = []
        queue_label = self._text(card.get("queue_label"), "")
        booking_status = self._text(card.get("booking_status"), "unknown")
        if "较长" in queue_label or "未知" in queue_label:
            labels.append("排队")
        if booking_status in {"unknown", "pending_user_action", "not_supported"}:
            labels.append("需确认")
        if self._confidence(card, candidate) < 0.5:
            labels.append("低置信")
        return labels

    def _estimated_cost(self, card: PlanRecord) -> float:
        price_label = self._text(card.get("price_label"), "")
        numbers = "".join(char if char.isdigit() else " " for char in price_label).split()
        if numbers:
            return float(numbers[0])
        return self._number(card.get("estimated_cost"), 0)

    def _confidence(self, card: PlanRecord, candidate: PlanRecord) -> float:
        explicit = self._number_or_none(card.get("confidence"))
        if explicit is not None:
            return max(0.0, min(1.0, explicit))

        snapshots = [
            self._dict(candidate.get("poi")),
            self._dict(candidate.get("hours")),
            self._dict(candidate.get("price")),
            self._dict(candidate.get("queue")),
            self._dict(candidate.get("booking")),
        ]
        values = [self._confidence_value(snapshot.get("confidence")) for snapshot in snapshots]
        if not values:
            return 0.0
        return round(sum(values) / len(values), 2)

    def _confidence_value(self, value: Any) -> float:
        if isinstance(value, (int, float)):
            return max(0.0, min(1.0, float(value)))
        return self.CONFIDENCE_VALUES.get(self._text(value, "unknown"), 0.1)

    def _session_id(self, value: str | None) -> str:
        cleaned = self._text(value, "")
        return cleaned or f"anon_{uuid4().hex[:16]}"

    def _dict(self, value: Any) -> PlanRecord:
        return value if isinstance(value, dict) else {}

    def _list(self, value: Any) -> list[Any]:
        return value if isinstance(value, list) else []

    def _text(self, value: Any, default: str) -> str:
        if isinstance(value, str) and value.strip():
            return value.strip()
        return default

    def _number(self, value: Any, default: float) -> float:
        parsed = self._number_or_none(value)
        return default if parsed is None else parsed

    def _number_or_none(self, value: Any) -> float | None:
        try:
            return float(value)
        except (TypeError, ValueError):
            return None
