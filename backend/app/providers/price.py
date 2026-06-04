import json
from pathlib import Path
from typing import Any

from app.providers.base import BaseProvider


class PriceProvider(BaseProvider):
    MOCK_PATH = Path(__file__).resolve().parents[2] / "docs" / "mock" / "price_mock.json"

    async def get(
        self,
        poi: Any,
        adults: int = 2,
        children: int = 1,
    ) -> dict:
        raw_cost = self._number_or_none(
            self._get_nested_value(poi, ("biz_ext", "cost")),
            self._get_value(poi, "raw_cost"),
            self._get_value(poi, "cost"),
        )
        if raw_cost is not None:
            return self._result(raw_cost, adults, children, "amap", 0.9)

        mock_result = self._mock_result(poi, adults, children)
        if mock_result is not None:
            return mock_result

        category = self._first_text(self._get_value(poi, "category"), self._get_value(poi, "type"))
        estimated_price = self._estimate_by_category(category)
        return self._result(estimated_price, adults, children, "estimated", 0.5)

    def _result(
        self,
        price_per_person: float,
        adults: int,
        children: int,
        source: str,
        confidence: float,
    ) -> dict:
        normalized_price = max(0, round(price_per_person))
        family_size = max(1, adults + children)
        return {
            "price_per_person": normalized_price,
            "family_total": normalized_price * family_size,
            "currency": "CNY",
            "source": source,
            "confidence": confidence,
        }

    def _mock_result(self, poi: Any, adults: int, children: int) -> dict | None:
        poi_id = self._first_text(self._get_value(poi, "poi_id"), self._get_value(poi, "id"))
        name = self._first_text(self._get_value(poi, "name"))
        for item in self._load_mock_items():
            if poi_id and item.get("poi_id") == poi_id:
                return self._mock_item_result(item, adults, children)
            if name and item.get("name") == name:
                return self._mock_item_result(item, adults, children)
        return None

    def _mock_item_result(self, item: dict, adults: int, children: int) -> dict:
        price = self._number_or_none(item.get("avg_price")) or 0
        result = self._result(
            price,
            adults,
            children,
            str(item.get("source") or "seed"),
            self._confidence_score(item.get("confidence"), 0.65),
        )
        if "estimated_total_for_family" in item and adults == 2 and children == 1:
            family_total = self._family_total(item["estimated_total_for_family"])
            if family_total is not None:
                result["family_total"] = family_total
        return result

    def _load_mock_items(self) -> list[dict]:
        try:
            with self.MOCK_PATH.open(encoding="utf-8") as file:
                data = json.load(file)
        except (OSError, json.JSONDecodeError):
            return []
        if not isinstance(data, list):
            return []
        return [item for item in data if isinstance(item, dict)]

    def _estimate_by_category(self, category: str | None) -> int:
        text = category or ""
        if any(word in text for word in ["博物馆", "展馆", "展览", "文化"]):
            return 60
        if any(word in text for word in ["餐饮", "餐厅", "咖啡"]):
            return 100
        if any(word in text for word in ["公园", "景区"]):
            return 20
        if any(word in text for word in ["商场", "街区", "购物"]):
            return 80
        return 80

    def _get_nested_value(self, value: Any, path: tuple[str, ...]) -> Any:
        current = value
        for key in path:
            current = self._get_value(current, key)
            if current is None:
                return None
        return current

    def _get_value(self, value: Any, key: str) -> Any:
        if isinstance(value, dict):
            return value.get(key)
        return getattr(value, key, None)

    def _first_text(self, *values: Any) -> str | None:
        for value in values:
            if isinstance(value, str) and value.strip():
                return value.strip()
            if value is not None and not isinstance(value, (dict, list, tuple, set)):
                return str(value).strip()
        return None

    def _number_or_none(self, *values: Any) -> float | None:
        for value in values:
            try:
                return float(value)
            except (TypeError, ValueError):
                continue
        return None

    def _family_total(self, value: Any) -> int | None:
        if isinstance(value, dict):
            preferred = self._number_or_none(value.get("2_adults_1_child"))
            if preferred is not None:
                return max(0, round(preferred))
            for item in value.values():
                parsed = self._number_or_none(item)
                if parsed is not None:
                    return max(0, round(parsed))
            return None

        parsed = self._number_or_none(value)
        return max(0, round(parsed)) if parsed is not None else None

    def _confidence_score(self, value: Any, default: float) -> float:
        if isinstance(value, (int, float)):
            return float(value)
        return {
            "high": 0.9,
            "medium": 0.65,
            "low": 0.4,
            "unknown": default,
        }.get(str(value), default)
