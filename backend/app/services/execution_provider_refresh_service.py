from __future__ import annotations

from copy import deepcopy
from typing import Any

from app.providers.factory import ProviderFactory

ExecutionRecord = dict[str, Any]


class ExecutionProviderRefreshService:
    async def refresh(self, execution_context: ExecutionRecord) -> ExecutionRecord:
        refreshed = deepcopy(execution_context)
        snapshot = refreshed.setdefault("provider_snapshot", {})
        snapshot["weather"] = await self._refresh_weather(snapshot.get("weather"))

        cards = self._cards(refreshed)
        constraints = self._dict(refreshed.get("constraints"))
        snapshot["hours"] = await self._refresh_hours(snapshot.get("hours"), cards)
        snapshot["price"] = await self._refresh_price(
            snapshot.get("price"),
            cards,
            constraints,
        )
        return refreshed

    async def _refresh_weather(self, current: Any) -> ExecutionRecord:
        current_snapshot = self._dict(current)
        try:
            provider = ProviderFactory.create("weather")
            result = await provider.get()
        except Exception as exc:
            return self._fallback_snapshot(
                current_snapshot,
                provider="weather",
                fallback_reason=f"weather_refresh_error:{type(exc).__name__}",
            )

        normalized = self._normalize_snapshot(
            result,
            provider="weather",
            fallback_reason="weather_provider_returned_unknown",
        )
        return normalized

    async def _refresh_hours(self, current: Any, cards: list[ExecutionRecord]) -> ExecutionRecord:
        current_snapshots = self._dict(current)
        refreshed: dict[str, ExecutionRecord] = {}
        provider = None
        try:
            provider = ProviderFactory.create("hours")
        except Exception:
            provider = None

        for card in cards:
            poi = self._dict(card.get("poi"))
            poi_id = self._text(poi.get("poi_id"), "")
            if not poi_id:
                continue
            current_snapshot = self._dict(current_snapshots.get(poi_id))
            if provider is None:
                refreshed[poi_id] = self._fallback_snapshot(
                    current_snapshot,
                    provider="hours",
                    poi=poi,
                    fallback_reason="hours_provider_unavailable",
                )
                continue

            try:
                result = await provider.get(poi, planned_arrival_at=None)
            except Exception as exc:
                refreshed[poi_id] = self._fallback_snapshot(
                    current_snapshot,
                    provider="hours",
                    poi=poi,
                    fallback_reason=f"hours_refresh_error:{type(exc).__name__}",
                )
                continue

            normalized = self._normalize_snapshot(
                result,
                provider="hours",
                poi=poi,
                fallback_reason="hours_provider_returned_unknown",
            )
            refreshed[poi_id] = normalized
        return refreshed

    async def _refresh_price(
        self,
        current: Any,
        cards: list[ExecutionRecord],
        constraints: ExecutionRecord,
    ) -> ExecutionRecord:
        current_snapshots = self._dict(current)
        refreshed: dict[str, ExecutionRecord] = {}
        adults = max(0, round(self._number(constraints.get("adults"), 2)))
        children = max(0, round(self._number(constraints.get("children"), 1)))

        try:
            provider = ProviderFactory.create("price")
        except Exception:
            provider = None

        for card in cards:
            poi = self._dict(card.get("poi"))
            poi_id = self._text(poi.get("poi_id"), "")
            if not poi_id:
                continue
            current_snapshot = self._dict(current_snapshots.get(poi_id))
            if provider is None:
                refreshed[poi_id] = self._fallback_snapshot(
                    current_snapshot,
                    provider="price",
                    poi=poi,
                    fallback_reason="price_provider_unavailable",
                )
                continue

            try:
                result = await provider.get(poi, adults=adults, children=children)
            except Exception as exc:
                refreshed[poi_id] = self._fallback_snapshot(
                    current_snapshot,
                    provider="price",
                    poi=poi,
                    fallback_reason=f"price_refresh_error:{type(exc).__name__}",
                )
                continue

            normalized = self._normalize_snapshot(
                result,
                provider="price",
                poi=poi,
                fallback_reason="price_provider_returned_unknown",
            )
            if "price_per_person" in normalized and "avg_price" not in normalized:
                normalized["avg_price"] = normalized["price_per_person"]
            if "family_total" in normalized and "estimated_total_for_family" not in normalized:
                normalized["estimated_total_for_family"] = normalized["family_total"]
            refreshed[poi_id] = normalized
        return refreshed

    def _normalize_snapshot(
        self,
        value: Any,
        provider: str,
        fallback_reason: str,
        poi: ExecutionRecord | None = None,
    ) -> ExecutionRecord:
        snapshot = deepcopy(value) if isinstance(value, dict) else {}
        snapshot["provider"] = provider
        snapshot["source"] = self._text(snapshot.get("source"), "unknown")
        snapshot["confidence"] = self._normalize_confidence(snapshot.get("confidence"))
        snapshot.setdefault("fallback_reason", None)
        if poi is not None:
            snapshot.setdefault("poi_id", self._text(poi.get("poi_id"), ""))
            snapshot.setdefault("name", self._text(poi.get("name"), ""))
        if self._is_unknown(snapshot):
            snapshot["fallback_reason"] = snapshot.get("fallback_reason") or fallback_reason
        return snapshot

    def _fallback_snapshot(
        self,
        current: ExecutionRecord,
        provider: str,
        fallback_reason: str,
        poi: ExecutionRecord | None = None,
    ) -> ExecutionRecord:
        snapshot = deepcopy(current)
        snapshot.setdefault("provider", provider)
        snapshot["source"] = self._text(snapshot.get("source"), "unknown")
        snapshot["confidence"] = self._normalize_confidence(snapshot.get("confidence"))
        snapshot["fallback_reason"] = fallback_reason
        if poi is not None:
            snapshot.setdefault("poi_id", self._text(poi.get("poi_id"), ""))
            snapshot.setdefault("name", self._text(poi.get("name"), ""))
        return snapshot

    def _is_unknown(self, snapshot: ExecutionRecord) -> bool:
        return (
            snapshot.get("source") in {"unknown", "not_refreshed"}
            or snapshot.get("confidence") == "unknown"
        )

    def _cards(self, context: ExecutionRecord) -> list[ExecutionRecord]:
        cards = context.get("cards")
        return cards if isinstance(cards, list) else []

    def _dict(self, value: Any) -> ExecutionRecord:
        return value if isinstance(value, dict) else {}

    def _text(self, value: Any, default: str) -> str:
        if isinstance(value, str) and value.strip():
            return value.strip()
        return default

    def _number(self, value: Any, default: float) -> float:
        try:
            return float(value)
        except (TypeError, ValueError):
            return default

    def _normalize_confidence(self, value: Any) -> str | float:
        if isinstance(value, (int, float)):
            return round(max(0.0, min(1.0, float(value))), 2)
        text = self._text(value, "unknown")
        return text
