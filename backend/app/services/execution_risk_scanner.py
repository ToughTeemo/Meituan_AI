from __future__ import annotations

from copy import deepcopy
from dataclasses import asdict, dataclass
from typing import Any

ExecutionRecord = dict[str, Any]
QUEUE_WAIT_THRESHOLD_MINUTES = 60
PRICE_BUDGET_MULTIPLIER = 1.0


@dataclass(frozen=True)
class RiskFlag:
    type: str
    severity: str
    source: str
    poi_id: str | None
    message: str
    can_replan: bool


class ExecutionRiskScanner:
    def scan(self, execution_context: ExecutionRecord) -> ExecutionRecord:
        scanned = deepcopy(execution_context)
        snapshot = self._dict(scanned.get("provider_snapshot"))

        flags: list[RiskFlag] = []
        seen: set[tuple[str, str]] = set()

        self._scan_weather(snapshot.get("weather"), flags, seen)
        self._scan_hours(snapshot.get("hours"), flags, seen)
        self._scan_queue(snapshot.get("queue"), flags, seen)
        self._scan_price(snapshot.get("price"), scanned.get("constraints"), flags, seen)
        self._scan_booking(snapshot.get("booking"), flags, seen)
        self._scan_data_unknown(snapshot, flags, seen)

        scanned["risk_flags"] = [asdict(flag) for flag in flags]
        return scanned

    def _scan_weather(
        self,
        weather: Any,
        flags: list[RiskFlag],
        seen: set[tuple[str, str]],
    ) -> None:
        snapshot = self._dict(weather)
        rain_probability = self._probability(snapshot.get("rain_probability"))
        if rain_probability is None or rain_probability < 0.6:
            return

        percent = round(rain_probability * 100)
        self._add_flag(
            flags,
            seen,
            RiskFlag(
                type="WEATHER_RISK",
                severity="high",
                source="weather",
                poi_id=None,
                message=(
                    f"\u9884\u8ba1\u964d\u96e8\u6982\u7387 {percent}%"
                    "\uff0c\u5efa\u8bae\u8003\u8651\u5ba4\u5185\u5907\u9009\u65b9\u6848"
                ),
                can_replan=True,
            ),
        )

    def _scan_hours(
        self,
        hours: Any,
        flags: list[RiskFlag],
        seen: set[tuple[str, str]],
    ) -> None:
        for poi_id, snapshot in self._provider_entries(hours, "hours"):
            if snapshot.get("is_open_at_arrival") is not False:
                continue
            self._add_flag(
                flags,
                seen,
                RiskFlag(
                    type="CLOSED_RISK",
                    severity="critical",
                    source="hours",
                    poi_id=poi_id,
                    message="\u9884\u8ba1\u5230\u8fbe\u65f6\u5546\u6237\u672a\u8425\u4e1a",
                    can_replan=True,
                ),
            )

    def _scan_queue(
        self,
        queue: Any,
        flags: list[RiskFlag],
        seen: set[tuple[str, str]],
    ) -> None:
        for poi_id, snapshot in self._provider_entries(queue, "queue"):
            queue_status = self._text(
                snapshot.get("status"),
                self._text(snapshot.get("queue_level"), ""),
            ).lower()
            wait_minutes = self._number_or_none(
                snapshot.get("waiting_minutes"),
                snapshot.get("wait_minutes"),
                snapshot.get("estimated_wait_minutes"),
            )
            high_status = queue_status == "high"
            high_wait = (
                wait_minutes is not None
                and wait_minutes > QUEUE_WAIT_THRESHOLD_MINUTES
            )
            if not high_status and not high_wait:
                continue
            message = "Queue status is HIGH"
            if wait_minutes is not None:
                message = (
                    f"Queue waiting time is {round(wait_minutes)} minutes, "
                    f"above {QUEUE_WAIT_THRESHOLD_MINUTES} minutes"
                )
            self._add_flag(
                flags,
                seen,
                RiskFlag(
                    type="QUEUE_RISK",
                    severity="high",
                    source="queue",
                    poi_id=poi_id,
                    message=message,
                    can_replan=True,
                ),
            )

    def _scan_price(
        self,
        price: Any,
        constraints: Any,
        flags: list[RiskFlag],
        seen: set[tuple[str, str]],
    ) -> None:
        budget = self._number_or_none(self._dict(constraints).get("budget"))
        if budget is None or budget <= 0:
            return

        threshold = budget * PRICE_BUDGET_MULTIPLIER
        for poi_id, snapshot in self._provider_entries(price, "price"):
            current_price = self._price_value(snapshot)
            if current_price is None or current_price <= threshold:
                continue
            self._add_flag(
                flags,
                seen,
                RiskFlag(
                    type="PRICE_RISK",
                    severity="high",
                    source="price",
                    poi_id=poi_id,
                    message=(
                        f"Current price is {round(current_price)} CNY, "
                        f"above budget threshold {round(threshold)} CNY"
                    ),
                    can_replan=True,
                ),
            )

    def _scan_booking(
        self,
        booking: Any,
        flags: list[RiskFlag],
        seen: set[tuple[str, str]],
    ) -> None:
        for poi_id, snapshot in self._provider_entries(booking, "booking"):
            availability = self._text(snapshot.get("availability"), "").lower()
            status = self._text(snapshot.get("status"), "").lower()
            if availability != "unavailable" and status != "unavailable":
                continue
            self._add_flag(
                flags,
                seen,
                RiskFlag(
                    type="BOOKING_RISK",
                    severity="high",
                    source="booking",
                    poi_id=poi_id,
                    message="\u5f53\u524d\u65f6\u95f4\u6bb5\u4e0d\u53ef\u9884\u7ea6",
                    can_replan=True,
                ),
            )

    def _scan_data_unknown(
        self,
        provider_snapshot: ExecutionRecord,
        flags: list[RiskFlag],
        seen: set[tuple[str, str]],
    ) -> None:
        for provider_name in ("weather", "hours", "price", "queue", "booking"):
            for poi_id, snapshot in self._provider_entries(
                provider_snapshot.get(provider_name),
                provider_name,
            ):
                if not self._is_data_unknown(snapshot):
                    continue
                self._add_flag(
                    flags,
                    seen,
                    RiskFlag(
                        type="DATA_UNKNOWN",
                        severity="low",
                        source=provider_name,
                        poi_id=poi_id,
                        message=(
                            f"{provider_name} "
                            "\u5f53\u524d\u6570\u636e\u53ef\u4fe1\u5ea6\u672a\u77e5"
                        ),
                        can_replan=False,
                    ),
                )

    def _provider_entries(self, value: Any, provider: str) -> list[tuple[str | None, ExecutionRecord]]:
        snapshot = self._dict(value)
        if not snapshot:
            return []

        if self._looks_like_provider_snapshot(snapshot, provider):
            return [(self._poi_id(snapshot), snapshot)]

        entries: list[tuple[str | None, ExecutionRecord]] = []
        for key, item in snapshot.items():
            if not isinstance(item, dict):
                continue
            entries.append((self._poi_id(item) or str(key), item))
        return entries

    def _looks_like_provider_snapshot(self, value: ExecutionRecord, provider: str) -> bool:
        if value.get("provider") == provider:
            return True
        return any(key in value for key in ("source", "confidence", "fallback_reason"))

    def _is_data_unknown(self, snapshot: ExecutionRecord) -> bool:
        return (
            self._text(snapshot.get("source"), "").lower() == "unknown"
            or self._text(snapshot.get("confidence"), "").lower() == "unknown"
        )

    def _add_flag(
        self,
        flags: list[RiskFlag],
        seen: set[tuple[str, str]],
        flag: RiskFlag,
    ) -> None:
        key = (flag.type, flag.source)
        if key in seen:
            return
        seen.add(key)
        flags.append(flag)

    def _poi_id(self, snapshot: ExecutionRecord) -> str | None:
        poi_id = snapshot.get("poi_id")
        return poi_id.strip() if isinstance(poi_id, str) and poi_id.strip() else None

    def _probability(self, value: Any) -> float | None:
        number = self._number_or_none(value)
        if number is None:
            return None
        if number > 1:
            return number / 100
        return number

    def _price_value(self, snapshot: ExecutionRecord) -> float | None:
        return self._number_or_none(
            snapshot.get("current_price"),
            snapshot.get("estimated_total_for_family"),
            snapshot.get("family_total"),
            snapshot.get("estimated_total"),
            snapshot.get("total_price"),
            snapshot.get("avg_price"),
            snapshot.get("price_per_person"),
        )

    def _dict(self, value: Any) -> ExecutionRecord:
        return value if isinstance(value, dict) else {}

    def _text(self, value: Any, default: str) -> str:
        if isinstance(value, str) and value.strip():
            return value.strip()
        return default

    def _number_or_none(self, *values: Any) -> float | None:
        for value in values:
            try:
                return float(value)
            except (TypeError, ValueError):
                continue
        return None
