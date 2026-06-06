from dataclasses import dataclass
from typing import Any, Literal, Protocol


Confidence = Literal["high", "medium", "low", "unknown"]


class ProviderError(Exception):
    pass


class BaseProvider(Protocol):
    async def get(self, *args: Any, **kwargs: Any) -> dict[str, Any]:
        ...


@dataclass
class PoiResult:
    provider: str
    external_id: str
    name: str
    address: str | None
    district: str | None
    lat: float
    lng: float
    category: str | None = None
    rating: float | None = None
    price_per_person: float | None = None
    opening_hours: str | None = None
    confidence: Confidence = "unknown"
    source_fields: dict | None = None


@dataclass
class RouteResult:
    provider: str
    mode: str
    origin_lat: float
    origin_lng: float
    destination_lat: float
    destination_lng: float
    distance_meters: int
    duration_minutes: int
    confidence: Confidence = "unknown"
    source_fields: dict | None = None


class BasePoiProvider(Protocol):
    async def search(
        self,
        keyword: str,
        city: str = "上海",
        limit: int = 10,
    ) -> list[PoiResult]:
        ...


class BaseRouteProvider(Protocol):
    async def route(
        self,
        origin_lat: float,
        origin_lng: float,
        destination_lat: float,
        destination_lng: float,
        mode: str = "walking",
    ) -> RouteResult:
        ...
