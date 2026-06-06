from __future__ import annotations

from copy import deepcopy
from dataclasses import asdict, dataclass
from typing import Any

from app.services.provider_catalog import ProviderCatalog

ReplanRecord = dict[str, Any]


@dataclass(frozen=True)
class ReplanProposal:
    replanned: bool
    strategy: str
    risk_type: str
    reason: str
    proposal_summary: str
    old_poi: dict[str, Any]
    new_poi: dict[str, Any]
    requires_user_confirmation: bool
    old_card_id: str | None
    old_poi_id: str | None


class RuleBasedReplanner:
    QUEUE_WAIT_THRESHOLD_MINUTES = 60

    def __init__(self, catalog: ProviderCatalog | None = None) -> None:
        self.catalog = catalog or ProviderCatalog()

    def propose(self, replan_context: ReplanRecord) -> ReplanRecord:
        strategy = self._text(replan_context.get("strategy"), "CONTINUE")
        risk_type = self._text(replan_context.get("risk_type"), "NONE")
        if not bool(replan_context.get("need_replan")):
            return asdict(
                self._empty_proposal(
                    replan_context,
                    risk_type=risk_type,
                    reason="当前决策不需要重规划",
                )
            )

        current_card = self._current_card(replan_context)
        old_card_id = self._text(
            current_card.get("card_id"),
            self._text(replan_context.get("current_card_id"), ""),
        )
        old_poi = self._dict(current_card.get("poi"))
        old_poi_id = self._text(old_poi.get("poi_id"), "")

        candidates = self._candidate_contexts(old_poi_id)
        filtered = [
            candidate
            for candidate in candidates
            if self._matches_strategy(candidate, old_poi, risk_type, strategy, replan_context)
        ]
        if not filtered:
            return asdict(
                self._empty_proposal(
                    replan_context,
                    risk_type=risk_type,
                    old_card_id=old_card_id or None,
                    old_poi_id=old_poi_id or None,
                    old_poi=old_poi,
                    reason="没有找到合适替代候选",
                )
            )

        selected = max(
            filtered,
            key=lambda candidate: self._candidate_score(candidate, replan_context, old_poi),
        )
        new_poi = self._proposal_poi(selected)
        new_name = self._text(new_poi.get("name"), "替代地点")
        old_name = self._text(old_poi.get("name"), "当前地点")

        return asdict(
            ReplanProposal(
                replanned=True,
                strategy=strategy,
                risk_type=risk_type,
                reason=self._proposal_reason(risk_type, strategy),
                old_card_id=old_card_id or None,
                old_poi_id=old_poi_id or None,
                new_poi=new_poi,
                old_poi=deepcopy(old_poi),
                proposal_summary=f"建议将 {old_name} 替换为 {new_name}",
                requires_user_confirmation=True,
            )
        )

    def _candidate_contexts(self, old_poi_id: str) -> list[ReplanRecord]:
        candidates: list[ReplanRecord] = []
        for poi in self.catalog.list_pois():
            poi_id = self._text(poi.get("poi_id"), "")
            if not poi_id or poi_id == old_poi_id:
                continue
            candidates.append(
                {
                    "poi": poi,
                    "hours": self.catalog.get_hours(poi_id),
                    "price": self.catalog.get_price(poi_id),
                    "queue": self.catalog.get_queue(poi_id),
                    "booking": self.catalog.get_booking(poi_id),
                }
            )
        return candidates

    def _matches_strategy(
        self,
        candidate: ReplanRecord,
        old_poi: ReplanRecord,
        risk_type: str,
        strategy: str,
        replan_context: ReplanRecord,
    ) -> bool:
        poi = self._dict(candidate.get("poi"))
        price = self._dict(candidate.get("price"))
        queue = self._dict(candidate.get("queue"))
        booking = self._dict(candidate.get("booking"))
        if risk_type == "WEATHER_RISK" and strategy == "INDOOR_FALLBACK":
            return self._is_indoor_candidate(poi)
        if risk_type == "CLOSED_RISK" and strategy == "ALTERNATIVE_POI":
            return self._same_or_similar_category(old_poi, poi)
        if risk_type == "BOOKING_RISK" and strategy == "ALTERNATIVE_POI":
            return self._text(booking.get("status"), "unknown").lower() != "unavailable"
        if risk_type == "QUEUE_RISK" and strategy == "SHORTER_WAIT":
            return self._is_shorter_wait_candidate(queue)
        if risk_type == "PRICE_RISK" and strategy == "BUDGET_FRIENDLY":
            constraints = self._dict(
                self._dict(replan_context.get("execution_context")).get("constraints")
            )
            return self._is_budget_friendly_candidate(price, poi, constraints)
        return False

    def _candidate_score(
        self,
        candidate: ReplanRecord,
        replan_context: ReplanRecord,
        old_poi: ReplanRecord,
    ) -> float:
        poi = self._dict(candidate.get("poi"))
        hours = self._dict(candidate.get("hours"))
        queue = self._dict(candidate.get("queue"))
        price = self._dict(candidate.get("price"))
        booking = self._dict(candidate.get("booking"))
        constraints = self._dict(
            self._dict(replan_context.get("execution_context")).get("constraints")
        )
        budget = self._number(constraints.get("budget"), 0)
        strategy = self._text(replan_context.get("strategy"), "CONTINUE")

        score = self._number(poi.get("rating"), 4.0) * 10
        score += self._hours_score(hours)
        score += self._queue_score(queue)
        score += self._price_score(price, poi, constraints, budget)
        if strategy == "INDOOR_FALLBACK":
            score += 80 if self._is_indoor_like(poi) else -40
        elif strategy == "SHORTER_WAIT":
            score += self._shorter_wait_bonus(queue)
        elif strategy == "BUDGET_FRIENDLY":
            score += self._budget_friendly_bonus(price, poi, constraints, budget)
        else:
            score += self._category_score(old_poi, poi)
        if self._text(booking.get("status"), "unknown").lower() != "unavailable":
            score += 8
        return score

    def _hours_score(self, hours: ReplanRecord) -> float:
        is_open = hours.get("is_open_at_arrival")
        if is_open is True:
            return 28
        if is_open is False:
            return -80
        return 0

    def _queue_score(self, queue: ReplanRecord) -> float:
        level = self._queue_level(queue)
        if level == "low":
            return 20
        if level == "medium":
            return 8
        if level == "high":
            return -18
        return -4

    def _price_score(
        self,
        price: ReplanRecord,
        poi: ReplanRecord,
        constraints: ReplanRecord,
        budget: float,
    ) -> float:
        total = self._family_total(price, poi, constraints)
        if budget <= 0:
            return 0
        if total <= max(120, budget * 0.5):
            return 18
        if total <= budget:
            return 8
        return -12

    def _is_shorter_wait_candidate(self, queue: ReplanRecord) -> bool:
        level = self._queue_level(queue)
        wait_minutes = self._wait_minutes(queue)
        if level == "high":
            return False
        if wait_minutes is None:
            return level in {"low", "medium"}
        return wait_minutes <= self.QUEUE_WAIT_THRESHOLD_MINUTES

    def _is_budget_friendly_candidate(
        self,
        price: ReplanRecord,
        poi: ReplanRecord,
        constraints: ReplanRecord,
    ) -> bool:
        budget = self._number(constraints.get("budget"), 0)
        if budget <= 0:
            return True
        return self._family_total(price, poi, constraints) <= budget

    def _shorter_wait_bonus(self, queue: ReplanRecord) -> float:
        wait_minutes = self._wait_minutes(queue)
        if wait_minutes is None:
            return 20 if self._queue_level(queue) in {"low", "medium"} else -30
        return max(-40.0, 90.0 - wait_minutes)

    def _budget_friendly_bonus(
        self,
        price: ReplanRecord,
        poi: ReplanRecord,
        constraints: ReplanRecord,
        budget: float,
    ) -> float:
        total = self._family_total(price, poi, constraints)
        if budget <= 0:
            return 0
        if total <= max(120, budget * 0.5):
            return 90
        if total <= budget:
            return 50
        return -50

    def _category_score(self, old_poi: ReplanRecord, poi: ReplanRecord) -> float:
        if self._same_category(old_poi, poi):
            return 18
        if self._same_or_similar_category(old_poi, poi):
            return 10
        return 0

    def _is_indoor_candidate(self, poi: ReplanRecord) -> bool:
        if self._is_indoor_like(poi):
            return True
        text = self._poi_text(poi)
        return any(keyword in text for keyword in ["parent_child", "亲子"])

    def _is_indoor_like(self, poi: ReplanRecord) -> bool:
        if bool(poi.get("is_indoor")):
            return True
        text = self._poi_text(poi)
        return any(
            keyword in text
            for keyword in [
                "indoor",
                "museum",
                "mall",
                "exhibition",
                "室内",
                "商场",
                "博物馆",
                "展览",
            ]
        )

    def _same_category(self, old_poi: ReplanRecord, poi: ReplanRecord) -> bool:
        return self._normalized_category(old_poi) == self._normalized_category(poi)

    def _same_or_similar_category(self, old_poi: ReplanRecord, poi: ReplanRecord) -> bool:
        old_category = self._normalized_category(old_poi)
        new_category = self._normalized_category(poi)
        if old_category == new_category:
            return True
        groups = [
            {"museum", "exhibition", "gallery", "art", "culture"},
            {"shopping_mall", "mall", "restaurant", "cafe", "food"},
            {"park", "street", "landmark", "outdoor"},
            {"kids", "family", "parent_child"},
            {"nightlife", "entertainment", "theater"},
        ]
        return any(old_category in group and new_category in group for group in groups)

    def _normalized_category(self, poi: ReplanRecord) -> str:
        category = self._text(poi.get("category"), "").lower()
        text = self._poi_text(poi)
        if "museum" in text or "博物馆" in text:
            return "museum"
        if "mall" in text or "商场" in text:
            return "mall"
        if "park" in text or "公园" in text:
            return "park"
        if "restaurant" in text or "cafe" in text or "餐" in text or "咖啡" in text:
            return "restaurant"
        if "exhibition" in text or "gallery" in text or "展" in text or "艺术" in text:
            return "exhibition"
        if "landmark" in text or "street" in text or "街区" in text:
            return "landmark"
        return category

    def _proposal_poi(self, candidate: ReplanRecord) -> ReplanRecord:
        poi = deepcopy(self._dict(candidate.get("poi")))
        hours = self._dict(candidate.get("hours"))
        price = self._dict(candidate.get("price"))
        queue = self._dict(candidate.get("queue"))
        booking = self._dict(candidate.get("booking"))
        poi["hours_label"] = self._text(hours.get("hours_label"), self._text(poi.get("hours_label"), ""))
        poi["is_open_at_arrival"] = hours.get("is_open_at_arrival")
        poi["queue_level"] = self._queue_level(queue)
        poi["estimated_wait_minutes"] = self._number_or_none(
            queue.get("waiting_minutes"),
            queue.get("wait_minutes"),
            queue.get("estimated_wait_minutes")
        )
        current_price = self._number_or_none(price.get("current_price"))
        if current_price is not None:
            poi["current_price"] = current_price
        poi["estimated_total_for_family"] = self._family_total(price, poi, {})
        poi["booking_status"] = self._text(booking.get("status"), "unknown")
        return poi

    def _empty_proposal(
        self,
        replan_context: ReplanRecord,
        risk_type: str,
        reason: str,
        old_card_id: str | None = None,
        old_poi_id: str | None = None,
        old_poi: ReplanRecord | None = None,
    ) -> ReplanProposal:
        current_card = self._current_card(replan_context)
        resolved_old_card_id = (
            old_card_id
            or self._text(current_card.get("card_id"), "")
            or self._text(replan_context.get("current_card_id"), "")
            or None
        )
        resolved_old_poi = deepcopy(old_poi) if isinstance(old_poi, dict) else {}
        if not resolved_old_poi:
            resolved_old_poi = deepcopy(self._dict(current_card.get("poi")))
        resolved_old_poi_id = (
            old_poi_id or self._text(resolved_old_poi.get("poi_id"), "") or None
        )
        return ReplanProposal(
            replanned=False,
            strategy=self._text(replan_context.get("strategy"), "CONTINUE"),
            risk_type=risk_type,
            reason=reason,
            proposal_summary=reason,
            old_poi=resolved_old_poi,
            new_poi={},
            requires_user_confirmation=True,
            old_card_id=resolved_old_card_id,
            old_poi_id=resolved_old_poi_id,
        )

    def _current_card(self, replan_context: ReplanRecord) -> ReplanRecord:
        execution_context = self._dict(replan_context.get("execution_context"))
        cards = self._list(execution_context.get("cards"))
        current_card_id = self._text(replan_context.get("current_card_id"), "")
        risk_poi_id = self._risk_poi_id(replan_context)

        if risk_poi_id:
            for card in cards:
                if self._text(self._dict(card).get("poi", {}).get("poi_id"), "") == risk_poi_id:
                    return self._dict(card)
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

    def _risk_poi_id(self, replan_context: ReplanRecord) -> str:
        risk_flags = self._list(replan_context.get("risk_flags"))
        risk_type = self._text(replan_context.get("risk_type"), "")
        for risk in risk_flags:
            if not isinstance(risk, dict) or risk.get("type") != risk_type:
                continue
            poi_id = self._text(risk.get("poi_id"), "")
            if poi_id:
                return poi_id
        return ""

    def _proposal_reason(self, risk_type: str, strategy: str) -> str:
        if risk_type == "WEATHER_RISK" and strategy == "INDOOR_FALLBACK":
            return "天气风险较高，优先推荐室内替代地点"
        if risk_type == "CLOSED_RISK":
            return "预计到达时未营业，推荐同类替代地点"
        if risk_type == "QUEUE_RISK" and strategy == "SHORTER_WAIT":
            return "Queue risk is high, recommend a shorter-wait alternative."
        if risk_type == "PRICE_RISK" and strategy == "BUDGET_FRIENDLY":
            return "Price is above budget, recommend a budget-friendly alternative."
        if risk_type == "BOOKING_RISK":
            return "当前不可预约，推荐无需该时段预约冲突的替代地点"
        return "根据执行风险生成替代候选"

    def _queue_level(self, queue: ReplanRecord) -> str:
        level = self._text(
            queue.get("status"),
            self._text(queue.get("queue_level"), ""),
        ).lower()
        if level in {"low", "medium", "high", "unknown"}:
            return level
        wait_minutes = self._wait_minutes(queue)
        if wait_minutes is None:
            return "unknown"
        if wait_minutes <= 10:
            return "low"
        if wait_minutes <= 25:
            return "medium"
        return "high"

    def _wait_minutes(self, queue: ReplanRecord) -> float | None:
        return self._number_or_none(
            queue.get("waiting_minutes"),
            queue.get("wait_minutes"),
            queue.get("estimated_wait_minutes"),
        )

    def _family_total(
        self,
        price: ReplanRecord,
        poi: ReplanRecord,
        constraints: ReplanRecord,
    ) -> float:
        total = self._number_or_none(
            price.get("current_price"),
            price.get("estimated_total_for_family"),
        )
        if total is not None:
            return max(0.0, total)
        party_size = max(
            1,
            round(
                self._number(constraints.get("adults"), 2)
                + self._number(constraints.get("children"), 1)
            ),
        )
        avg_price = self._number_or_none(price.get("avg_price"))
        if avg_price is None:
            avg_price = self._number_or_none(poi.get("price_per_person"))
        return max(0.0, (avg_price or 0.0) * party_size)

    def _poi_text(self, poi: ReplanRecord) -> str:
        tags = " ".join(str(tag) for tag in self._list(poi.get("tags")))
        return " ".join(
            [
                self._text(poi.get("name"), ""),
                self._text(poi.get("category"), ""),
                tags,
            ]
        ).lower()

    def _dict(self, value: Any) -> ReplanRecord:
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

    def _number_or_none(self, *values: Any) -> float | None:
        for value in values:
            try:
                return float(value)
            except (TypeError, ValueError):
                continue
        return None
