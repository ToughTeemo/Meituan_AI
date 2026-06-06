from __future__ import annotations

from statistics import mean
from typing import Any

PlanRecord = dict[str, Any]


class RuleBasedPlanner:
    CONFIDENCE_VALUES = {
        "high": 1.0,
        "medium": 0.7,
        "low": 0.4,
        "unknown": 0.1,
    }
    QUEUE_BONUS = {
        "low": 14.0,
        "medium": 7.0,
        "high": -6.0,
        "unknown": -12.0,
    }

    def plan(self, plan_context: PlanRecord, max_cards: int = 5) -> PlanRecord:
        request = self._dict(plan_context.get("request"))
        constraints = self._dict(request.get("constraints"))
        weather = self._dict(plan_context.get("weather"))
        candidates = [
            self._candidate_score(candidate, constraints, weather)
            for candidate in self._list(plan_context.get("candidates"))
            if isinstance(candidate, dict)
        ]

        ranked = sorted(
            candidates,
            key=lambda candidate: self._sort_key(candidate, constraints, request),
        )
        selected = ranked[:max_cards]
        cards = [candidate["card"] for candidate in selected]
        estimated_cost = round(sum(candidate["family_total"] for candidate in selected))
        confidence = (
            round(mean(candidate["confidence"] for candidate in selected), 2)
            if selected
            else 0.0
        )

        return {
            "title": self._title(request),
            "summary": (
                f"根据天气、营业时间、预算和排队情况，筛选出 {len(cards)} 个候选地点。"
            ),
            "cards": cards,
            "estimated_cost": estimated_cost,
            "confidence": confidence,
        }

    def _candidate_score(
        self,
        candidate: PlanRecord,
        constraints: PlanRecord,
        weather: PlanRecord,
    ) -> PlanRecord:
        poi = self._dict(candidate.get("poi"))
        hours = self._dict(candidate.get("hours"))
        price = self._dict(candidate.get("price"))
        queue = self._dict(candidate.get("queue"))
        booking = self._dict(candidate.get("booking"))

        budget = self._number(constraints.get("budget"), 0)
        family_total = self._family_total(candidate, constraints)
        rating = self._number(poi.get("rating"), 4.0)
        queue_level = self._queue_level(queue)
        score = rating * 10
        score += self._weather_bonus(poi, weather)
        score += self._hours_bonus(hours)
        score += self.QUEUE_BONUS.get(queue_level, self.QUEUE_BONUS["unknown"])
        score += self._price_bonus(family_total, budget)

        confidence = self._candidate_confidence(poi, hours, price, queue, booking)
        card = {
            "poi_id": self._text(poi.get("poi_id"), "unknown"),
            "name": self._text(poi.get("name"), "未知地点"),
            "category": self._text(poi.get("category"), "未知类型"),
            "hours_label": self._hours_label(poi, hours),
            "price_label": self._price_label(family_total, price),
            "queue_label": self._queue_label(queue),
            "booking_status": self._text(booking.get("status"), "unknown"),
            "reason": self._reason(poi, hours, queue, family_total, budget, weather),
            "score": round(score, 2),
        }

        return {
            "card": card,
            "score": score,
            "family_total": family_total,
            "popularity": self._popularity_score(poi, queue),
            "confidence": confidence,
        }

    def _sort_key(
        self,
        candidate: PlanRecord,
        constraints: PlanRecord,
        request: PlanRecord,
    ) -> tuple[float, float, float]:
        tier = self._budget_tier(constraints, request)
        if tier == "low":
            return (candidate["family_total"], -candidate["score"], -candidate["popularity"])
        if tier == "high":
            return (-candidate["popularity"], -candidate["score"], candidate["family_total"])
        return (-candidate["score"], candidate["family_total"], -candidate["popularity"])

    def _budget_tier(self, constraints: PlanRecord, request: PlanRecord) -> str:
        budget = self._number(constraints.get("budget"), 0)
        text = " ".join(
            [
                self._text(request.get("prompt"), ""),
                self._text(constraints.get("goal"), ""),
                " ".join(str(tag) for tag in self._list(constraints.get("preference_tags"))),
            ]
        )
        if budget >= 1000 or any(word in text for word in ["高预算", "热门优先", "品质"]):
            return "high"
        if budget <= 500 or any(
            word in text for word in ["预算不要太高", "预算友好", "省", "便宜", "低预算"]
        ):
            return "low"
        return "medium"

    def _family_total(self, candidate: PlanRecord, constraints: PlanRecord) -> float:
        poi = self._dict(candidate.get("poi"))
        price = self._dict(candidate.get("price"))
        total = self._number_or_none(price.get("estimated_total_for_family"))
        if total is None:
            total = self._number_or_none(price.get("estimated_total"))
        if total is not None:
            return max(0.0, total)

        party_size = max(
            1,
            round(
                self._number(constraints.get("adults"), 2)
                + self._number(constraints.get("children"), 0)
            ),
        )
        avg_price = self._number_or_none(price.get("avg_price"))
        if avg_price is None:
            avg_price = self._number_or_none(poi.get("price_per_person"))
        return max(0.0, (avg_price or 0.0) * party_size)

    def _weather_bonus(self, poi: PlanRecord, weather: PlanRecord) -> float:
        prefers_indoor = bool(weather.get("prefers_indoor"))
        if prefers_indoor:
            return 22.0 if self._is_indoor_poi(poi) else -8.0
        return 12.0 if self._is_outdoor_poi(poi) else 0.0

    def _hours_bonus(self, hours: PlanRecord) -> float:
        is_open = hours.get("is_open_at_arrival")
        if is_open is True:
            return 12.0
        if is_open is False:
            return -18.0
        return 0.0

    def _price_bonus(self, family_total: float, budget: float) -> float:
        if budget <= 0:
            return 0.0
        if family_total <= budget * 0.35:
            return 12.0
        if family_total <= budget * 0.65:
            return 6.0
        if family_total <= budget:
            return 1.0
        return -10.0

    def _popularity_score(self, poi: PlanRecord, queue: PlanRecord) -> float:
        rating = self._number(poi.get("rating"), 4.0)
        wait_minutes = self._number(queue.get("estimated_wait_minutes"), 0)
        return rating * 10 + min(wait_minutes, 30) / 6

    def _queue_level(self, queue: PlanRecord) -> str:
        level = self._text(queue.get("queue_level"), "unknown").lower()
        if level in self.QUEUE_BONUS:
            return level

        wait_minutes = self._number_or_none(queue.get("estimated_wait_minutes"))
        if wait_minutes is None:
            return "unknown"
        if wait_minutes <= 10:
            return "low"
        if wait_minutes <= 25:
            return "medium"
        return "high"

    def _candidate_confidence(self, *snapshots: PlanRecord) -> float:
        values = [self._confidence_value(snapshot.get("confidence")) for snapshot in snapshots]
        return round(mean(values), 2) if values else 0.0

    def _confidence_value(self, value: Any) -> float:
        if isinstance(value, (int, float)):
            return max(0.0, min(1.0, float(value)))
        return self.CONFIDENCE_VALUES.get(self._text(value, "unknown"), 0.1)

    def _title(self, request: PlanRecord) -> str:
        prompt = self._text(request.get("prompt"), "")
        if "孩子" in prompt or "亲子" in prompt:
            return "上海周末亲子半日候选方案"
        return "上海周末半日候选方案"

    def _hours_label(self, poi: PlanRecord, hours: PlanRecord) -> str:
        return self._text(
            hours.get("hours_label"),
            self._text(poi.get("hours_label"), "营业时间未知"),
        )

    def _price_label(self, family_total: float, price: PlanRecord) -> str:
        if price.get("avg_price") is None and family_total <= 0:
            return "价格未知，建议确认"
        if family_total <= 0:
            return "家庭预计免费"
        return f"家庭预计约 {round(family_total)} 元"

    def _queue_label(self, queue: PlanRecord) -> str:
        level = self._queue_level(queue)
        wait_minutes = self._number_or_none(queue.get("estimated_wait_minutes"))
        label_by_level = {
            "low": "较短",
            "medium": "中等",
            "high": "较长",
            "unknown": "未知",
        }
        label = label_by_level[level]
        if wait_minutes is None:
            return f"预计排队{label}，建议现场确认"
        return f"预计排队{label}，约 {round(wait_minutes)} 分钟"

    def _reason(
        self,
        poi: PlanRecord,
        hours: PlanRecord,
        queue: PlanRecord,
        family_total: float,
        budget: float,
        weather: PlanRecord,
    ) -> str:
        reasons: list[str] = []
        if bool(weather.get("prefers_indoor")) and self._is_indoor_poi(poi):
            reasons.append("室内场馆，适合阴雨天气")
        elif not bool(weather.get("prefers_indoor")) and self._is_outdoor_poi(poi):
            reasons.append("户外或街区体验，适合当前天气")

        if budget <= 0 or family_total <= max(120, budget * 0.5):
            reasons.append("预算友好，家庭总价较低")

        queue_level = self._queue_level(queue)
        if queue_level == "low":
            reasons.append("当前预计排队时间较短")
        elif queue_level == "medium":
            reasons.append("预计排队时间中等")
        elif queue_level == "high":
            reasons.append("排队偏长，建议预留缓冲")
        else:
            reasons.append("排队信息未知，建议现场确认")

        is_open = hours.get("is_open_at_arrival")
        if is_open is True:
            reasons.append("到达时预计营业")
        elif is_open is False:
            reasons.append("到达时可能不营业，已降权")
        else:
            reasons.append("营业状态未知，建议出发前确认")

        return "；".join(reasons)

    def _is_indoor_poi(self, poi: PlanRecord) -> bool:
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
                "博物馆",
                "美术馆",
                "展",
                "馆",
                "商场",
                "室内",
            ]
        )

    def _is_outdoor_poi(self, poi: PlanRecord) -> bool:
        text = self._poi_text(poi)
        return any(
            keyword in text
            for keyword in ["outdoor", "park", "street", "公园", "街区", "外滩", "户外"]
        )

    def _poi_text(self, poi: PlanRecord) -> str:
        tags = " ".join(str(tag) for tag in self._list(poi.get("tags")))
        return " ".join(
            [
                self._text(poi.get("name"), ""),
                self._text(poi.get("category"), ""),
                tags,
            ]
        ).lower()

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
