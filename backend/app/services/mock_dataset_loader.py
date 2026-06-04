from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any

MockRecord = dict[str, Any]


class MockDatasetError(ValueError):
    """Raised when a mock dataset file exists but cannot be loaded safely."""


class MockDatasetLoader:
    MOCK_FILES = {
        "poi": "pois_mock.json",
        "hours": "hours_mock.json",
        "price": "price_mock.json",
        "queue": "queue_mock.json",
        "booking": "booking_mock.json",
        "action": "action_mock.json",
    }

    def __init__(self, mock_dir: Path | None = None) -> None:
        self.mock_dir = mock_dir or self.default_mock_dir()
        self._datasets: dict[str, list[MockRecord]] = {}
        self._indexes: dict[str, dict[str, MockRecord]] = {}
        self.reload()

    @staticmethod
    def default_mock_dir() -> Path:
        backend_root = Path(__file__).resolve().parents[2]
        return backend_root / "docs" / "mock"

    def reload(self) -> None:
        datasets: dict[str, list[MockRecord]] = {}
        indexes: dict[str, dict[str, MockRecord]] = {}

        for kind, filename in self.MOCK_FILES.items():
            records = self._load_mock_file(kind, self.mock_dir / filename)
            datasets[kind] = records
            indexes[kind] = self._index_by_poi_id(kind, records)

        self._datasets = datasets
        self._indexes = indexes

    def list_records(self, kind: str) -> list[MockRecord]:
        self._ensure_known_kind(kind)
        return deepcopy(self._datasets[kind])

    def get(self, kind: str, poi_id: str) -> MockRecord | None:
        self._ensure_known_kind(kind)
        record = self._indexes[kind].get(poi_id)
        return deepcopy(record) if record is not None else None

    def list_pois(self) -> list[MockRecord]:
        return self.list_records("poi")

    def get_poi(self, poi_id: str) -> MockRecord | None:
        return self.get("poi", poi_id)

    def get_hours(self, poi_id: str) -> MockRecord | None:
        return self.get("hours", poi_id)

    def get_price(self, poi_id: str) -> MockRecord | None:
        return self.get("price", poi_id)

    def get_queue(self, poi_id: str) -> MockRecord | None:
        return self.get("queue", poi_id)

    def get_booking(self, poi_id: str) -> MockRecord | None:
        return self.get("booking", poi_id)

    def get_actions(self, poi_id: str) -> MockRecord | None:
        return self.get("action", poi_id)

    def _load_mock_file(self, kind: str, path: Path) -> list[MockRecord]:
        if not path.exists():
            return []

        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            message = (
                f"Invalid JSON in mock dataset '{path}' for '{kind}': "
                f"{exc.msg} at line {exc.lineno}, column {exc.colno}."
            )
            raise MockDatasetError(message) from exc

        if not isinstance(payload, list):
            raise MockDatasetError(
                f"Invalid mock dataset '{path}' for '{kind}': expected a JSON array."
            )

        records: list[MockRecord] = []
        for index, item in enumerate(payload):
            if not isinstance(item, dict):
                raise MockDatasetError(
                    f"Invalid mock dataset '{path}' for '{kind}': "
                    f"item {index} must be an object."
                )
            records.append(item)
        return records

    def _index_by_poi_id(
        self,
        kind: str,
        records: list[MockRecord],
    ) -> dict[str, MockRecord]:
        index: dict[str, MockRecord] = {}
        for row_index, record in enumerate(records):
            poi_id = record.get("poi_id")
            if not isinstance(poi_id, str) or not poi_id.strip():
                raise MockDatasetError(
                    f"Invalid '{kind}' mock row {row_index}: missing string poi_id."
                )
            index[poi_id] = record
        return index

    def _ensure_known_kind(self, kind: str) -> None:
        if kind not in self.MOCK_FILES:
            supported = ", ".join(sorted(self.MOCK_FILES))
            raise KeyError(f"Unknown mock dataset kind '{kind}'. Supported: {supported}.")
