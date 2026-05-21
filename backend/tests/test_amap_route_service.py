from urllib.parse import parse_qs, urlparse

from app.schemas.plan import Constraints
from app.services.mvp_models import RouteLeg, ShanghaiPlace
from app.services.route_service import AmapRouteService


class FallbackRouteService:
    def estimate_leg(
        self,
        origin: ShanghaiPlace,
        destination: ShanghaiPlace,
        constraints: Constraints,
    ) -> RouteLeg:
        return RouteLeg(
            distance_km=1.2,
            duration_minutes=12,
            mode=constraints.transport_mode,
            summary="fallback route",
        )


def place(
    place_id: str,
    latitude: float,
    longitude: float,
) -> ShanghaiPlace:
    return ShanghaiPlace(
        place_id=place_id,
        name=place_id,
        district="上海",
        address="上海",
        category="test",
        latitude=latitude,
        longitude=longitude,
        rating=4.0,
        price_per_person=0,
        queue_minutes=0,
        hours_label="test",
        map_x=50,
        map_y=50,
    )


def constraints_for(mode: str = "驾车") -> Constraints:
    return Constraints(
        goal="周末上海路线",
        time_start="13:30",
        time_end="20:00",
        adults=2,
        children=0,
        children_age=5,
        budget=500,
        departure="人民广场",
        transport_mode=mode,  # type: ignore[arg-type]
        pace="轻松",
        preference_tags=["上海"],
    )


def test_amap_route_service_maps_driving_response() -> None:
    captured_urls: list[str] = []

    def fetch_json(url: str, timeout_seconds: float) -> dict:
        captured_urls.append(url)
        assert timeout_seconds == 4
        return {
            "status": "1",
            "route": {
                "paths": [
                    {
                        "distance": "5200",
                        "duration": "1260",
                    }
                ]
            },
        }

    service = AmapRouteService(
        "test-key",
        fallback=FallbackRouteService(),
        fetch_json=fetch_json,
    )

    leg = service.estimate_leg(
        place("origin", 31.2304, 121.4737),
        place("dest", 31.2166, 121.5517),
        constraints_for("驾车"),
    )

    assert leg.distance_km == 5.2
    assert leg.duration_minutes == 21
    assert leg.mode == "驾车"
    assert "驾车约 21 分钟" in leg.summary

    parsed = urlparse(captured_urls[0])
    query = parse_qs(parsed.query)
    assert parsed.path.endswith("/v3/direction/driving")
    assert query["key"] == ["test-key"]
    assert query["origin"] == ["121.473700,31.230400"]
    assert query["destination"] == ["121.551700,31.216600"]


def test_amap_route_service_maps_walking_response() -> None:
    service = AmapRouteService(
        "test-key",
        fallback=FallbackRouteService(),
        fetch_json=lambda _url, _timeout: {
            "status": "1",
            "route": {"paths": [{"distance": "900", "duration": "720"}]},
        },
    )

    leg = service.estimate_leg(
        place("origin", 31.2304, 121.4737),
        place("dest", 31.2310, 121.4810),
        constraints_for("步行"),
    )

    assert leg.distance_km == 0.9
    assert leg.duration_minutes == 12
    assert leg.mode == "步行"


def test_amap_route_service_falls_back_for_subway_mode() -> None:
    service = AmapRouteService(
        "test-key",
        fallback=FallbackRouteService(),
        fetch_json=lambda _url, _timeout: {
            "status": "1",
            "route": {"paths": [{"distance": "1000", "duration": "100"}]},
        },
    )

    leg = service.estimate_leg(
        place("origin", 31.2304, 121.4737),
        place("dest", 31.2166, 121.5517),
        constraints_for("地铁"),
    )

    assert leg.summary == "fallback route"
    assert leg.mode == "地铁"


def test_amap_route_service_falls_back_when_key_is_missing() -> None:
    service = AmapRouteService("", fallback=FallbackRouteService())

    leg = service.estimate_leg(
        place("origin", 31.2304, 121.4737),
        place("dest", 31.2166, 121.5517),
        constraints_for("驾车"),
    )

    assert leg.summary == "fallback route"


def test_amap_route_service_falls_back_on_provider_error_status() -> None:
    service = AmapRouteService(
        "test-key",
        fallback=FallbackRouteService(),
        fetch_json=lambda _url, _timeout: {"status": "0", "infocode": "10001"},
    )

    leg = service.estimate_leg(
        place("origin", 31.2304, 121.4737),
        place("dest", 31.2166, 121.5517),
        constraints_for("驾车"),
    )

    assert leg.summary == "fallback route"


def test_amap_route_service_falls_back_on_transport_error() -> None:
    def fetch_json(_url: str, _timeout: float) -> dict:
        raise TimeoutError("provider timed out")

    service = AmapRouteService(
        "test-key",
        fallback=FallbackRouteService(),
        fetch_json=fetch_json,
    )

    leg = service.estimate_leg(
        place("origin", 31.2304, 121.4737),
        place("dest", 31.2166, 121.5517),
        constraints_for("驾车"),
    )

    assert leg.summary == "fallback route"


def test_amap_route_service_falls_back_on_invalid_payload_shape() -> None:
    service = AmapRouteService(
        "test-key",
        fallback=FallbackRouteService(),
        fetch_json=lambda _url, _timeout: {"status": "1", "route": {"paths": []}},
    )

    leg = service.estimate_leg(
        place("origin", 31.2304, 121.4737),
        place("dest", 31.2166, 121.5517),
        constraints_for("驾车"),
    )

    assert leg.summary == "fallback route"


def test_amap_route_service_falls_back_on_invalid_distance_or_duration() -> None:
    service = AmapRouteService(
        "test-key",
        fallback=FallbackRouteService(),
        fetch_json=lambda _url, _timeout: {
            "status": "1",
            "route": {"paths": [{"distance": "-1", "duration": "0"}]},
        },
    )

    leg = service.estimate_leg(
        place("origin", 31.2304, 121.4737),
        place("dest", 31.2166, 121.5517),
        constraints_for("驾车"),
    )

    assert leg.summary == "fallback route"


def test_amap_route_service_falls_back_on_non_object_payload() -> None:
    service = AmapRouteService(
        "test-key",
        fallback=FallbackRouteService(),
        fetch_json=lambda _url, _timeout: [],
    )

    leg = service.estimate_leg(
        place("origin", 31.2304, 121.4737),
        place("dest", 31.2166, 121.5517),
        constraints_for("驾车"),
    )

    assert leg.summary == "fallback route"
