from __future__ import annotations

import os
from collections import Counter
from copy import deepcopy
from typing import Any

from app.schemas.plan import Constraints
from app.services.provider_catalog import ProviderCatalog
from app.services.weather_service import SeedWeatherService, WeatherService

ContextRecord = dict[str, Any]


class PlanContextBuilder:
    def __init__(
        self,
        catalog: ProviderCatalog | None = None,
        weather_service: WeatherService | None = None,
        planning_mode: str | None = None,
    ) -> None:
        self.catalog = catalog or ProviderCatalog()
        self.weather_service = weather_service or SeedWeatherService()
        self.planning_mode = (
            planning_mode or os.getenv("PLANNING_MODE") or "bounded"
        ).strip() or "bounded"

    def build(
        self,
        user_prompt: str,
        constraints: dict[str, Any] | Constraints | None = None,
        limit: int = 8,
    ) -> ContextRecord:
        constraints_model = self._normalize_constraints(user_prompt, constraints)
        weather = self._weather_context()

        source_summary: Counter[str] = Counter()
        unknown_counts = {
            "hours": 0,
            "price": 0,
            "queue": 0,
            "booking": 0,
            "actions_missing": 0,
        }

        self._count_source(source_summary, weather)

        candidates: list[ContextRecord] = []
        for index, raw_poi in enumerate(
            self.catalog.search_pois(constraints_model, limit=limit)
        ):
            poi = self._normalize_snapshot("poi", raw_poi)
            poi_id = self._poi_id(poi, index)

            hours = self._normalize_snapshot(
                "hours", self.catalog.get_hours(poi_id), poi_id=poi_id
            )
            price = self._normalize_snapshot(
                "price", self.catalog.get_price(poi_id), poi_id=poi_id
            )
            queue = self._normalize_snapshot(
                "queue", self.catalog.get_queue(poi_id), poi_id=poi_id
            )
            booking = self._normalize_snapshot(
                "booking", self.catalog.get_booking(poi_id), poi_id=poi_id
            )
            action_snapshot = self._normalize_snapshot(
                "action", self.catalog.get_actions(poi_id), poi_id=poi_id
            )
            actions = self._normalize_actions(action_snapshot)

            if self._unknown_hours(hours):
                unknown_counts["hours"] += 1
            if self._unknown_price(price):
                unknown_counts["price"] += 1
            if self._unknown_queue(queue):
                unknown_counts["queue"] += 1
            if self._unknown_booking(booking):
                unknown_counts["booking"] += 1
            if not actions:
                unknown_counts["actions_missing"] += 1

            for snapshot in (poi, hours, price, queue, booking, action_snapshot):
                self._count_source(source_summary, snapshot)

            candidates.append(
                {
                    "poi": poi,
                    "hours": hours,
                    "price": price,
                    "queue": queue,
                    "booking": booking,
                    "actions": actions,
                }
            )

        return {
            "request": {
                "prompt": user_prompt,
                "constraints": constraints_model.model_dump(),
                "planning_mode": self.planning_mode,
            },
            "weather": weather,
            "candidates": candidates,
            "metadata": {
                "candidate_count": len(candidates),
                "unknown_counts": unknown_counts,
                "source_summary": dict(source_summary),
            },
        }

    def _normalize_constraints(
        self,
        user_prompt: str,
        constraints: dict[str, Any] | Constraints | None,
    ) -> Constraints:
        payload: dict[str, Any] = {
            "goal": user_prompt,
            "time_start": "13:30",
            "time_end": "18:30",
            "adults": 2,
            "children": 1,
            "children_age": 6,
            "budget": 500,
            "departure": "人民广场",
            "transport_mode": "地铁",
            "pace": "轻松",
            "preference_tags": [],
        }

        if isinstance(constraints, Constraints):
            incoming = constraints.model_dump()
        elif isinstance(constraints, dict):
            incoming = constraints
        elif constraints is None:
            incoming = {}
        else:
            raise TypeError("constraints must be a dict, Constraints, or None.")

        payload.update({key: value for key, value in incoming.items() if value is not None})
        payload["goal"] = payload.get("goal") or user_prompt
        return Constraints(**payload)

    def _weather_context(self) -> ContextRecord:
        fallback_reason: str | None = None
        try:
            snapshot = self.weather_service.current_shanghai_weather()
            if isinstance(self.weather_service, SeedWeatherService):
                source = "seed"
                confidence = "medium"
            else:
                seed_snapshot = SeedWeatherService().current_shanghai_weather()
                if snapshot == seed_snapshot:
                    source = "seed"
                    confidence = "medium"
                    fallback_reason = "weather_service_fallback"
                else:
                    source = "open_meteo"
                    confidence = "high"
        except Exception:
            snapshot = SeedWeatherService().current_shanghai_weather()
            source = "seed"
            confidence = "low"
            fallback_reason = "weather_service_error"

        return {
            "provider": "weather",
            "condition": snapshot.condition,
            "temperature_c": snapshot.temperature_c,
            "rain_probability": snapshot.rain_probability,
            "prefers_indoor": snapshot.prefers_indoor,
            "summary": snapshot.summary,
            "source": source,
            "confidence": confidence,
            "fallback_reason": fallback_reason,
        }

    def _normalize_snapshot(
        self,
        provider: str,
        snapshot: ContextRecord | None,
        poi_id: str | None = None,
    ) -> ContextRecord:
        normalized = deepcopy(snapshot) if isinstance(snapshot, dict) else {}
        normalized.setdefault("provider", provider)
        if poi_id is not None:
            normalized.setdefault("poi_id", poi_id)
        normalized["source"] = self._non_empty_string(normalized.get("source"))
        normalized["confidence"] = self._non_empty_string(normalized.get("confidence"))
        normalized.setdefault("fallback_reason", None)
        return normalized

    def _normalize_actions(self, action_snapshot: ContextRecord) -> list[ContextRecord]:
        raw_actions = action_snapshot.get("actions")
        if not isinstance(raw_actions, list):
            return []

        actions: list[ContextRecord] = []
        for item in raw_actions:
            if not isinstance(item, dict):
                continue
            action = deepcopy(item)
            action.setdefault("provider", "action")
            action.setdefault("source", action_snapshot["source"])
            action.setdefault("confidence", action_snapshot["confidence"])
            action.setdefault("fallback_reason", action_snapshot.get("fallback_reason"))
            action.setdefault("requires_user_confirmation", True)
            actions.append(action)
        return actions

    def _poi_id(self, poi: ContextRecord, index: int) -> str:
        poi_id = poi.get("poi_id")
        if isinstance(poi_id, str) and poi_id.strip():
            return poi_id
        return f"unknown_poi_{index + 1}"

    def _count_source(self, counter: Counter[str], snapshot: ContextRecord) -> None:
        counter[self._non_empty_string(snapshot.get("source"))] += 1

    def _unknown_hours(self, hours: ContextRecord) -> bool:
        return self._unknown_snapshot(hours) or not hours.get("hours_label")

    def _unknown_price(self, price: ContextRecord) -> bool:
        return self._unknown_snapshot(price) or price.get("avg_price") is None

    def _unknown_queue(self, queue: ContextRecord) -> bool:
        return (
            self._unknown_snapshot(queue)
            or queue.get("queue_level") == "unknown"
            or queue.get("estimated_wait_minutes") is None
        )

    def _unknown_booking(self, booking: ContextRecord) -> bool:
        return self._unknown_snapshot(booking) or booking.get("status") == "unknown"

    def _unknown_snapshot(self, snapshot: ContextRecord) -> bool:
        return (
            snapshot.get("source") == "unknown"
            or snapshot.get("confidence") == "unknown"
        )

    def _non_empty_string(self, value: Any) -> str:
        if isinstance(value, str) and value.strip():
            return value.strip()
        return "unknown"
