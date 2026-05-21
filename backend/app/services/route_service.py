import json
from collections.abc import Callable
from math import asin, cos, radians, sin, sqrt
from typing import Any, Protocol
from urllib.parse import urlencode
from urllib.request import urlopen

from app.schemas.plan import Constraints
from app.services.mvp_models import RouteLeg, ShanghaiPlace


class RouteService(Protocol):
    def estimate_leg(
        self,
        origin: ShanghaiPlace,
        destination: ShanghaiPlace,
        constraints: Constraints,
    ) -> RouteLeg:
        ...


class EstimatedShanghaiRouteService:
    def estimate_leg(
        self,
        origin: ShanghaiPlace,
        destination: ShanghaiPlace,
        constraints: Constraints,
    ) -> RouteLeg:
        distance = self._distance_km(origin, destination)
        mode = constraints.transport_mode
        if mode == "驾车":
            minutes = max(10, round(distance / 22 * 60) + 8)
        elif mode == "步行":
            minutes = max(8, round(distance / 4.5 * 60))
        else:
            minutes = max(12, round(distance / 18 * 60) + 10)

        return RouteLeg(
            distance_km=round(distance, 1),
            duration_minutes=minutes,
            mode=mode,
            summary=f"{mode}约 {minutes} 分钟，距离约 {distance:.1f} 公里",
        )

    def _distance_km(self, origin: ShanghaiPlace, destination: ShanghaiPlace) -> float:
        earth_radius_km = 6371.0
        lat1 = radians(origin.latitude)
        lat2 = radians(destination.latitude)
        delta_lat = radians(destination.latitude - origin.latitude)
        delta_lng = radians(destination.longitude - origin.longitude)
        value = (
            sin(delta_lat / 2) ** 2
            + cos(lat1) * cos(lat2) * sin(delta_lng / 2) ** 2
        )
        return 2 * earth_radius_km * asin(sqrt(value))


class AmapRouteService:
    def __init__(
        self,
        api_key: str,
        fallback: RouteService | None = None,
        fetch_json: Callable[[str, float], Any] | None = None,
        timeout_seconds: float = 4,
    ) -> None:
        self.api_key = api_key
        self.fallback = fallback or EstimatedShanghaiRouteService()
        self.fetch_json = fetch_json or self._fetch_json
        self.timeout_seconds = timeout_seconds

    def estimate_leg(
        self,
        origin: ShanghaiPlace,
        destination: ShanghaiPlace,
        constraints: Constraints,
    ) -> RouteLeg:
        if not self.api_key.strip():
            return self.fallback.estimate_leg(origin, destination, constraints)

        endpoint = self._endpoint_for_mode(constraints.transport_mode)
        if endpoint is None:
            return self.fallback.estimate_leg(origin, destination, constraints)

        query = urlencode(
            {
                "key": self.api_key,
                "origin": self._lng_lat(origin),
                "destination": self._lng_lat(destination),
                "extensions": "base",
            }
        )
        url = f"{endpoint}?{query}"
        try:
            payload = self.fetch_json(url, self.timeout_seconds)
        except (OSError, TimeoutError, json.JSONDecodeError):
            return self.fallback.estimate_leg(origin, destination, constraints)

        if not isinstance(payload, dict) or payload.get("status") not in {"1", 1, None}:
            return self.fallback.estimate_leg(origin, destination, constraints)

        leg = self._leg_from_payload(payload, constraints.transport_mode)
        if leg is None:
            return self.fallback.estimate_leg(origin, destination, constraints)
        return leg

    def _fetch_json(self, url: str, timeout_seconds: float) -> dict[str, Any]:
        with urlopen(url, timeout=timeout_seconds) as response:
            payload = json.loads(response.read().decode("utf-8"))
        if not isinstance(payload, dict):
            return {}
        return payload

    def _endpoint_for_mode(self, mode: str) -> str | None:
        if mode == "驾车":
            return "https://restapi.amap.com/v3/direction/driving"
        if mode == "步行":
            return "https://restapi.amap.com/v3/direction/walking"
        return None

    def _leg_from_payload(self, payload: dict[str, Any], mode: str) -> RouteLeg | None:
        route = payload.get("route")
        if not isinstance(route, dict):
            return None
        paths = route.get("paths")
        if not isinstance(paths, list) or not paths or not isinstance(paths[0], dict):
            return None

        first_path = paths[0]
        distance_m = self._float_or_none(first_path.get("distance"))
        duration_s = self._float_or_none(first_path.get("duration"))
        if distance_m is None or duration_s is None or distance_m < 0 or duration_s <= 0:
            return None

        duration_minutes = max(1, round(duration_s / 60))
        distance_km = round(distance_m / 1000, 1)
        return RouteLeg(
            distance_km=distance_km,
            duration_minutes=duration_minutes,
            mode=mode,
            summary=f"{mode}约 {duration_minutes} 分钟，距离约 {distance_km:.1f} 公里",
        )

    def _float_or_none(self, value: object) -> float | None:
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    def _lng_lat(self, place: ShanghaiPlace) -> str:
        return f"{place.longitude:.6f},{place.latitude:.6f}"
