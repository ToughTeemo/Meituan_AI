import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any

from app.providers.base import BaseProvider


class HoursProvider(BaseProvider):
    MOCK_PATH = Path(__file__).resolve().parents[2] / "docs" / "mock" / "hours_mock.json"

    async def get(
        self,
        poi: Any,
        planned_arrival_at: str | None = None,
    ) -> dict:
        open_time = self._first_text(
            self._get_value(poi, "open_time"),
            self._get_nested_value(poi, ("biz_ext", "open_time")),
        )
        if open_time:
            return self._result(open_time, planned_arrival_at, "amap", 0.9)

        mock_result = self._mock_result(poi)
        if mock_result is not None:
            return mock_result

        category = self._first_text(self._get_value(poi, "category"), self._get_value(poi, "type"))
        estimated_label = self._estimate_by_category(category)
        return self._result(estimated_label, planned_arrival_at, "estimated", 0.5)

    def _result(
        self,
        hours_label: str,
        planned_arrival_at: str | None,
        source: str,
        confidence: float,
    ) -> dict:
        open_intervals = self._open_intervals(hours_label)
        return {
            "hours_label": hours_label,
            "is_open_at_arrival": self._is_open_at_arrival(open_intervals, planned_arrival_at),
            "open_intervals": open_intervals,
            "source": source,
            "confidence": confidence,
        }

    def _mock_result(self, poi: Any) -> dict | None:
        poi_id = self._first_text(self._get_value(poi, "poi_id"), self._get_value(poi, "id"))
        name = self._first_text(self._get_value(poi, "name"))
        for item in self._load_mock_items():
            if poi_id and item.get("poi_id") == poi_id:
                return self._mock_item_result(item)
            if name and item.get("name") == name:
                return self._mock_item_result(item)
        return None

    def _mock_item_result(self, item: dict) -> dict:
        return {
            "hours_label": item.get("hours_label", "以商户实时信息为准"),
            "is_open_at_arrival": bool(item.get("is_open_at_arrival", True)),
            "open_intervals": item.get("open_intervals", []),
            "source": item.get("source", "seed"),
            "confidence": self._confidence_score(item.get("confidence"), 0.65),
        }

    def _load_mock_items(self) -> list[dict]:
        try:
            with self.MOCK_PATH.open(encoding="utf-8") as file:
                data = json.load(file)
        except (OSError, json.JSONDecodeError):
            return []
        if not isinstance(data, list):
            return []
        return [item for item in data if isinstance(item, dict)]

    def _estimate_by_category(self, category: str | None) -> str:
        text = category or ""
        if any(word in text for word in ["博物馆", "展馆", "展览", "文化"]):
            return "09:00-17:00"
        if any(word in text for word in ["餐饮", "餐厅", "咖啡"]):
            return "11:00-22:00"
        if any(word in text for word in ["公园", "景区"]):
            return "05:00-21:00"
        if any(word in text for word in ["商场", "街区", "购物"]):
            return "10:00-22:00"
        return "以商户实时信息为准"

    def _open_intervals(self, hours_label: str) -> list[dict]:
        if "全天" in hours_label:
            return [{"start": "00:00", "end": "23:59"}]
        match = re.search(r"(\d{1,2}:\d{2})\s*[-~至]\s*(\d{1,2}:\d{2})", hours_label)
        if match is None:
            return []
        return [{"start": match.group(1), "end": match.group(2)}]

    def _is_open_at_arrival(
        self,
        open_intervals: list[dict],
        planned_arrival_at: str | None,
    ) -> bool:
        if not open_intervals:
            return True
        if not planned_arrival_at:
            return True
        try:
            arrival_time = datetime.fromisoformat(planned_arrival_at).time()
        except ValueError:
            return True
        for interval in open_intervals:
            try:
                start = datetime.strptime(interval["start"], "%H:%M").time()
                end = datetime.strptime(interval["end"], "%H:%M").time()
            except (KeyError, ValueError):
                continue
            if start <= arrival_time <= end:
                return True
        return False

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

    def _confidence_score(self, value: Any, default: float) -> float:
        if isinstance(value, (int, float)):
            return float(value)
        return {
            "high": 0.9,
            "medium": 0.65,
            "low": 0.4,
            "unknown": default,
        }.get(str(value), default)
