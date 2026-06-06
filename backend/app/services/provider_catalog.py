from __future__ import annotations

from copy import deepcopy
from typing import Any

from app.schemas.plan import Constraints
from app.services.mock_dataset_loader import MockDatasetLoader
from app.services.mvp_models import ShanghaiPlace
from app.services.poi_service import SHANGHAI_SEED_PLACES, ShanghaiSeedPoiService

CatalogRecord = dict[str, Any]


class ProviderCatalog:
    def __init__(self, mock_loader: MockDatasetLoader | None = None) -> None:
        self.mock_loader = mock_loader or MockDatasetLoader()
        self.seed_poi_service = ShanghaiSeedPoiService()
        self._seed_poi_index = {
            place.place_id: self._catalog_poi_from_place(place)
            for place in SHANGHAI_SEED_PLACES
        }
        mock_pois = self.mock_loader.list_pois()
        self._uses_mock_pois = bool(mock_pois)
        self._poi_index = (
            self._mock_poi_index(mock_pois)
            if self._uses_mock_pois
            else deepcopy(self._seed_poi_index)
        )

    def list_pois(self) -> list[CatalogRecord]:
        return deepcopy(list(self._poi_index.values()))

    def list_candidates(
        self,
        constraints: Constraints | None = None,
        limit: int | None = None,
    ) -> list[CatalogRecord]:
        if constraints is None:
            pois = self.list_pois()
            return pois[:limit] if limit is not None else pois
        return self.search_pois(constraints, limit if limit is not None else 8)

    def get_poi(self, poi_id: str) -> CatalogRecord | None:
        poi = self._poi_index.get(poi_id)
        return deepcopy(poi) if poi is not None else None

    def search_pois(self, constraints: Constraints, limit: int = 8) -> list[CatalogRecord]:
        if self._uses_mock_pois:
            pois = sorted(
                self.list_pois(),
                key=lambda poi: self._score_mock_poi(poi, constraints),
                reverse=True,
            )
            return pois[:limit]

        places = self.seed_poi_service.search(constraints, limit)
        pois: list[CatalogRecord] = []
        for place in places:
            poi = self._poi_index.get(place.place_id)
            pois.append(deepcopy(poi) if poi is not None else self._catalog_poi_from_place(place))
        return pois

    def get_hours(self, poi_id: str) -> CatalogRecord:
        mock = self.mock_loader.get_hours(poi_id)
        return self._hours_from_mock(mock) if mock else self._fallback_hours(poi_id)

    def get_price(self, poi_id: str) -> CatalogRecord:
        mock = self.mock_loader.get_price(poi_id)
        return self._price_from_mock(mock) if mock else self._fallback_price(poi_id)

    def get_queue(self, poi_id: str) -> CatalogRecord:
        mock = self.mock_loader.get_queue(poi_id)
        return self._queue_from_mock(mock) if mock else self._unknown_queue(poi_id)

    def get_booking(self, poi_id: str) -> CatalogRecord:
        mock = self.mock_loader.get_booking(poi_id)
        return self._booking_from_mock(mock) if mock else self._unknown_booking(poi_id)

    def get_actions(self, poi_id: str) -> CatalogRecord:
        mock = self.mock_loader.get_actions(poi_id)
        return self._actions_from_mock(mock) if mock else self._unknown_actions(poi_id)

    def get_context_for_poi(self, poi_id: str) -> CatalogRecord:
        return {
            "poi": self.get_poi(poi_id),
            "hours": self.get_hours(poi_id),
            "price": self.get_price(poi_id),
            "queue": self.get_queue(poi_id),
            "booking": self.get_booking(poi_id),
            "action": self.get_actions(poi_id),
        }

    def _catalog_poi_from_place(self, place: ShanghaiPlace) -> CatalogRecord:
        return {
            "provider": "poi",
            "poi_id": place.place_id,
            "name": place.name,
            "district": place.district,
            "address": place.address,
            "category": place.category,
            "latitude": place.latitude,
            "longitude": place.longitude,
            "rating": place.rating,
            "price_per_person": place.price_per_person,
            "queue_minutes": place.queue_minutes,
            "hours_label": place.hours_label,
            "map_position": {"x": place.map_x, "y": place.map_y},
            "tags": sorted(place.tags),
            "is_child_friendly": place.is_child_friendly,
            "is_indoor": place.is_indoor,
            "recommendation_reason": place.recommendation_reason,
            "source": "seed",
            "confidence": "medium",
            "fallback_reason": None,
        }

    def _mock_poi_index(self, records: list[CatalogRecord]) -> dict[str, CatalogRecord]:
        pois: dict[str, CatalogRecord] = {}
        for record in records:
            poi_id = self._text(record.get("poi_id"), "")
            if poi_id:
                pois[poi_id] = self._catalog_poi_from_mock(record)
        return pois

    def _catalog_poi_from_mock(self, record: CatalogRecord) -> CatalogRecord:
        poi_id = self._text(record.get("poi_id"), "")
        hours = self.mock_loader.get_hours(poi_id) if poi_id else None
        price = self.mock_loader.get_price(poi_id) if poi_id else None
        queue = self.mock_loader.get_queue(poi_id) if poi_id else None
        latitude = self._number(record.get("latitude"), 0)
        longitude = self._number(record.get("longitude"), 0)
        tags = self._mock_tags(record)

        return {
            "provider": "poi",
            "poi_id": poi_id,
            "name": self._text(record.get("name"), "unknown"),
            "district": self._text(record.get("district"), ""),
            "address": self._text(record.get("address"), ""),
            "category": self._text(record.get("category"), self._text(record.get("type"), "poi")),
            "latitude": latitude,
            "longitude": longitude,
            "rating": self._number(record.get("rating"), 4.0),
            "price_per_person": self._mock_avg_price(price, record),
            "queue_minutes": self._mock_queue_minutes(queue, record),
            "hours_label": self._text(
                hours.get("hours_label") if isinstance(hours, dict) else None,
                self._text(record.get("hours_label"), ""),
            ),
            "map_position": {
                "x": self._map_x(longitude),
                "y": self._map_y(latitude),
            },
            "tags": sorted(tags),
            "is_child_friendly": "parent_child" in tags,
            "is_indoor": "indoor" in tags,
            "recommendation_reason": self._recommendation_reason(record),
            "source": self._source_label(record.get("source"), "mock"),
            "confidence": self._confidence_label(record.get("confidence"), "medium"),
            "fallback_reason": None,
        }

    def _hours_from_mock(self, record: CatalogRecord) -> CatalogRecord:
        poi_id = self._text(record.get("poi_id"), "")
        poi = self.get_poi(poi_id)
        return {
            **deepcopy(record),
            "provider": "hours",
            "poi_id": poi_id,
            "name": self._poi_name(poi),
            "hours_label": self._text(record.get("hours_label"), ""),
            "is_open_at_arrival": record.get("is_open_at_arrival"),
            "open_intervals": record.get("open_intervals") if isinstance(record.get("open_intervals"), list) else [],
            "source": self._source_label(record.get("source"), "mock"),
            "confidence": self._confidence_label(record.get("confidence"), "medium"),
            "fallback_reason": record.get("fallback_reason"),
        }

    def _price_from_mock(self, record: CatalogRecord) -> CatalogRecord:
        poi_id = self._text(record.get("poi_id"), "")
        poi = self.get_poi(poi_id)
        family_total = self._family_total(record)
        return {
            **deepcopy(record),
            "provider": "price",
            "poi_id": poi_id,
            "name": self._poi_name(poi),
            "avg_price": self._mock_avg_price(record, {}),
            "currency": self._text(record.get("currency"), "CNY"),
            "estimated_total_for_family": family_total,
            "source": self._source_label(record.get("source"), "mock"),
            "confidence": self._confidence_label(record.get("confidence"), "medium"),
            "fallback_reason": record.get("fallback_reason"),
        }

    def _queue_from_mock(self, record: CatalogRecord) -> CatalogRecord:
        poi_id = self._text(record.get("poi_id"), "")
        poi = self.get_poi(poi_id)
        queue_level = self._text(
            record.get("queue_level"),
            self._text(record.get("default_queue_level"), "unknown"),
        )
        wait_minutes = self._number_or_none(record.get("estimated_wait_minutes"))
        if wait_minutes is None:
            wait_minutes = self._number_or_none(record.get("default_wait_minutes"))
        return {
            **deepcopy(record),
            "provider": "queue",
            "poi_id": poi_id,
            "name": self._poi_name(poi),
            "queue_level": queue_level,
            "estimated_wait_minutes": round(wait_minutes) if wait_minutes is not None else None,
            "source": self._source_label(record.get("source"), "mock"),
            "confidence": self._confidence_label(record.get("confidence"), "medium"),
            "fallback_reason": record.get("fallback_reason"),
        }

    def _booking_from_mock(self, record: CatalogRecord) -> CatalogRecord:
        poi_id = self._text(record.get("poi_id"), "")
        poi = self.get_poi(poi_id)
        supported = record.get("supported")
        if supported is None:
            supported = record.get("booking_supported_by_system", False)
        return {
            **deepcopy(record),
            "provider": "booking",
            "poi_id": poi_id,
            "name": self._poi_name(poi),
            "status": self._text(record.get("status"), "unknown"),
            "supported": bool(supported),
            "required_user_action": self._text(record.get("required_user_action"), ""),
            "source": self._source_label(record.get("source"), "mock"),
            "confidence": self._confidence_label(record.get("confidence"), "medium"),
            "fallback_reason": record.get("fallback_reason"),
        }

    def _actions_from_mock(self, record: CatalogRecord) -> CatalogRecord:
        poi_id = self._text(record.get("poi_id"), "")
        poi = self.get_poi(poi_id)
        actions = record.get("actions") if isinstance(record.get("actions"), list) else []
        normalized_actions: list[CatalogRecord] = []
        for action in actions:
            if not isinstance(action, dict):
                continue
            normalized = deepcopy(action)
            normalized.setdefault("type", normalized.get("action_type", "action"))
            normalized.setdefault("requires_user_confirmation", True)
            normalized_actions.append(normalized)
        return {
            **deepcopy(record),
            "provider": "action",
            "poi_id": poi_id,
            "name": self._poi_name(poi),
            "actions": normalized_actions,
            "source": self._source_label(record.get("source"), "mock"),
            "confidence": self._confidence_label(record.get("confidence"), "medium"),
            "fallback_reason": record.get("fallback_reason"),
        }

    def _score_mock_poi(self, poi: CatalogRecord, constraints: Constraints) -> float:
        tags = self._tags_from_constraints(constraints)
        poi_tags = {str(tag).lower() for tag in poi.get("tags", []) if isinstance(tag, str)}
        score = self._number(poi.get("rating"), 4.0) * 10
        score += len(poi_tags & tags) * 8
        if constraints.budget and self._number(poi.get("price_per_person"), 0) <= max(
            80,
            constraints.budget // 4,
        ):
            score += 5
        if self._number(poi.get("queue_minutes"), 99) <= 15:
            score += 4
        if constraints.children > 0 and poi.get("is_child_friendly"):
            score += 10
        return score

    def _tags_from_constraints(self, constraints: Constraints) -> set[str]:
        text = " ".join(
            [
                str(constraints.goal or ""),
                " ".join(str(tag) for tag in constraints.preference_tags),
            ]
        )
        tags: set[str] = {"subway"}
        if any(word in text for word in ["kids", "family", "\u5b69\u5b50", "\u4eb2\u5b50"]):
            tags.add("parent_child")
        if any(word in text for word in ["indoor", "\u5ba4\u5185", "\u4e0b\u96e8", "\u96e8\u5929"]):
            tags.add("indoor")
        if any(word in text for word in ["outdoor", "\u6237\u5916", "\u516c\u56ed"]):
            tags.add("outdoor")
        if any(word in text for word in ["food", "\u5403", "\u9910\u5385", "\u5496\u5561"]):
            tags.add("food")
        return tags

    def _fallback_hours(self, poi_id: str) -> CatalogRecord:
        poi = self.get_poi(poi_id)
        return {
            "provider": "hours",
            "poi_id": poi_id,
            "name": self._poi_name(poi),
            "hours_label": poi.get("hours_label") if poi else None,
            "is_open_at_arrival": None,
            "open_intervals": [],
            "source": "seed" if poi else "unknown",
            "confidence": "low" if poi else "unknown",
            "fallback_reason": "mock_not_found",
        }

    def _fallback_price(self, poi_id: str) -> CatalogRecord:
        poi = self.get_poi(poi_id)
        return {
            "provider": "price",
            "poi_id": poi_id,
            "name": self._poi_name(poi),
            "avg_price": poi.get("price_per_person") if poi else None,
            "currency": "CNY",
            "estimated_total_for_family": None,
            "source": "seed" if poi else "unknown",
            "confidence": "low" if poi else "unknown",
            "fallback_reason": "mock_not_found",
        }

    def _unknown_queue(self, poi_id: str) -> CatalogRecord:
        return {
            "provider": "queue",
            "poi_id": poi_id,
            "name": self._poi_name(self.get_poi(poi_id)),
            "queue_level": "unknown",
            "estimated_wait_minutes": None,
            "source": "unknown",
            "confidence": "unknown",
            "fallback_reason": "mock_not_found",
        }

    def _unknown_booking(self, poi_id: str) -> CatalogRecord:
        return {
            "provider": "booking",
            "poi_id": poi_id,
            "name": self._poi_name(self.get_poi(poi_id)),
            "status": "unknown",
            "supported": False,
            "required_user_action": "请用户自行确认",
            "source": "unknown",
            "confidence": "unknown",
            "fallback_reason": "mock_not_found",
        }

    def _unknown_actions(self, poi_id: str) -> CatalogRecord:
        return {
            "provider": "action",
            "poi_id": poi_id,
            "name": self._poi_name(self.get_poi(poi_id)),
            "actions": [],
            "source": "unknown",
            "confidence": "unknown",
            "fallback_reason": "mock_not_found",
        }

    def _mock_tags(self, record: CatalogRecord) -> set[str]:
        raw_values: list[Any] = []
        for key in ("tags", "suitable_for"):
            value = record.get(key)
            if isinstance(value, list):
                raw_values.extend(value)
        for key in ("category", "type"):
            value = record.get(key)
            if value is not None:
                raw_values.append(value)

        tags = {str(value).strip().lower() for value in raw_values if str(value).strip()}
        text = " ".join(tags)
        category = self._text(record.get("category"), "").lower()

        if any(token in text for token in ["family", "kids", "parent", "\u4eb2\u5b50"]):
            tags.add("parent_child")
        if category in {"museum", "mall", "exhibition", "theater", "restaurant"} or any(
            token in text for token in ["indoor", "rainy_day", "\u5ba4\u5185"]
        ):
            tags.add("indoor")
        if category in {"park", "street", "landmark"} or any(
            token in text for token in ["outdoor", "\u6237\u5916", "\u516c\u56ed"]
        ):
            tags.add("outdoor")
        if category in {"restaurant", "cafe"} or any(
            token in text for token in ["food", "dining", "\u9910", "\u5496\u5561"]
        ):
            tags.add("food")
        return tags

    def _mock_avg_price(
        self,
        price_record: CatalogRecord | None,
        poi_record: CatalogRecord,
    ) -> int:
        if isinstance(price_record, dict):
            for key in ("avg_price", "adult_price", "price_per_person"):
                value = self._number_or_none(price_record.get(key))
                if value is not None:
                    return max(0, round(value))

        amap = poi_record.get("amap") if isinstance(poi_record.get("amap"), dict) else {}
        value = self._number_or_none(poi_record.get("price_per_person"), amap.get("cost"))
        return max(0, round(value or 0))

    def _family_total(self, price_record: CatalogRecord) -> int | None:
        value = price_record.get("estimated_total_for_family")
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

    def _mock_queue_minutes(
        self,
        queue_record: CatalogRecord | None,
        poi_record: CatalogRecord,
    ) -> int:
        if isinstance(queue_record, dict):
            value = self._number_or_none(
                queue_record.get("estimated_wait_minutes"),
                queue_record.get("default_wait_minutes"),
            )
            if value is not None:
                return max(0, round(value))
        return max(0, round(self._number(poi_record.get("queue_minutes"), 0)))

    def _recommendation_reason(self, record: CatalogRecord) -> str:
        explicit = self._text(record.get("recommendation_reason"), "")
        if explicit:
            return explicit
        tags = ", ".join(str(tag) for tag in record.get("tags", []) if isinstance(tag, str))
        return f"Mock POI candidate from synced dataset. Tags: {tags}".strip()

    def _source_label(self, value: Any, default: str) -> str:
        if isinstance(value, str) and value.strip():
            return value.strip()
        if isinstance(value, dict):
            source_type = self._text(value.get("source_type"), "")
            provider = self._text(value.get("provider"), "")
            if provider and source_type:
                return f"{provider}_{source_type}"
            return source_type or provider or default
        return default

    def _confidence_label(self, value: Any, default: str) -> str:
        if isinstance(value, str) and value.strip():
            return value.strip()
        parsed = self._number_or_none(value)
        if parsed is None:
            return default
        if parsed >= 0.8:
            return "high"
        if parsed >= 0.5:
            return "medium"
        return "low"

    def _map_x(self, longitude: float) -> float:
        if longitude <= 0:
            return 50
        return round(min(90, max(10, (longitude - 121.35) / 0.28 * 80 + 10)), 2)

    def _map_y(self, latitude: float) -> float:
        if latitude <= 0:
            return 50
        return round(min(90, max(10, 90 - (latitude - 31.1) / 0.25 * 80)), 2)

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

    def _poi_name(self, poi: CatalogRecord | None) -> str | None:
        if poi is None:
            return None
        name = poi.get("name")
        return name if isinstance(name, str) else None
