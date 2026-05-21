import json
from urllib.parse import parse_qs, urlparse

from app.schemas.plan import Constraints
from app.services.mvp_models import ShanghaiPlace
from app.services.poi_service import AmapPoiService


class FallbackPoiService:
    def search(self, constraints: Constraints, limit: int = 8) -> list[ShanghaiPlace]:
        return [
            ShanghaiPlace(
                place_id="fallback_place",
                name="Fallback Shanghai Place",
                district="上海",
                address="fallback",
                category="fallback",
                latitude=31.2304,
                longitude=121.4737,
                rating=4.0,
                price_per_person=0,
                queue_minutes=0,
                hours_label="fallback",
                map_x=50,
                map_y=50,
            )
        ][:limit]


def constraints_for(prompt: str = "周末在上海逛展吃饭，地铁方便") -> Constraints:
    return Constraints(
        goal=prompt,
        time_start="13:30",
        time_end="20:00",
        adults=2,
        children=0,
        children_age=5,
        budget=500,
        departure="人民广场",
        transport_mode="地铁",
        pace="轻松",
        preference_tags=["上海", "周末", "地铁方便"],
    )


def test_amap_poi_service_maps_successful_response() -> None:
    captured_urls: list[str] = []

    def fetch_json(url: str, timeout_seconds: float) -> dict:
        captured_urls.append(url)
        assert timeout_seconds == 4
        return {
            "status": "1",
            "pois": [
                {
                    "id": "B001",
                    "name": "上海自然博物馆",
                    "type": "科教文化服务;博物馆",
                    "adname": "静安区",
                    "address": "北京西路510号",
                    "location": "121.4622,31.2354",
                    "biz_ext": {"rating": "4.8", "cost": "30"},
                }
            ],
        }

    service = AmapPoiService(
        "test-key",
        fallback=FallbackPoiService(),
        fetch_json=fetch_json,
    )

    places = service.search(constraints_for(), limit=3)

    assert len(places) == 1
    assert places[0].place_id == "amap_B001"
    assert places[0].name == "上海自然博物馆"
    assert places[0].district == "静安区"
    assert places[0].address == "北京西路510号"
    assert places[0].latitude == 31.2354
    assert places[0].longitude == 121.4622
    assert places[0].rating == 4.8
    assert places[0].price_per_person == 30
    assert places[0].is_indoor is True

    parsed = urlparse(captured_urls[0])
    query = parse_qs(parsed.query)
    assert query["key"] == ["test-key"]
    assert query["city"] == ["上海"]
    assert query["extensions"] == ["all"]


def test_amap_poi_service_falls_back_when_key_is_missing() -> None:
    service = AmapPoiService("", fallback=FallbackPoiService())

    places = service.search(constraints_for())

    assert places[0].place_id == "fallback_place"


def test_amap_poi_service_falls_back_on_provider_error_status() -> None:
    service = AmapPoiService(
        "test-key",
        fallback=FallbackPoiService(),
        fetch_json=lambda _url, _timeout: {"status": "0", "infocode": "10001", "pois": []},
    )

    places = service.search(constraints_for())

    assert places[0].place_id == "fallback_place"


def test_amap_poi_service_falls_back_on_transport_error() -> None:
    def fetch_json(_url: str, _timeout: float) -> dict:
        raise TimeoutError("provider timed out")

    service = AmapPoiService(
        "test-key",
        fallback=FallbackPoiService(),
        fetch_json=fetch_json,
    )

    places = service.search(constraints_for())

    assert places[0].place_id == "fallback_place"


def test_amap_poi_service_filters_bad_or_out_of_city_items() -> None:
    def fetch_json(_url: str, _timeout: float) -> dict:
        return {
            "status": "1",
            "pois": [
                {"name": "missing location"},
                {"name": "bad location", "location": "not-a-coordinate"},
                {
                    "id": "B002",
                    "name": "杭州地点",
                    "type": "风景名胜",
                    "adname": "杭州",
                    "address": "杭州",
                    "location": "120.15,30.28",
                },
            ],
        }

    service = AmapPoiService(
        "test-key",
        fallback=FallbackPoiService(),
        fetch_json=fetch_json,
    )

    places = service.search(constraints_for())

    assert places[0].place_id == "fallback_place"


def test_amap_poi_service_handles_missing_optional_fields() -> None:
    def fetch_json(_url: str, _timeout: float) -> dict:
        return {
            "status": "1",
            "pois": [
                {
                    "name": "上海周末地点",
                    "location": "121.48,31.22",
                    "address": ["黄浦区", "周末路"],
                    "biz_ext": {"rating": [], "cost": ""},
                }
            ],
        }

    service = AmapPoiService(
        "test-key",
        fallback=FallbackPoiService(),
        fetch_json=fetch_json,
    )

    places = service.search(constraints_for())

    assert places[0].name == "上海周末地点"
    assert places[0].address == "黄浦区 周末路"
    assert places[0].rating == 4.3
    assert places[0].price_per_person == 80


def test_amap_poi_service_falls_back_on_non_object_payload() -> None:
    def fetch_json(_url: str, _timeout: float) -> dict:
        return json.loads("[]")

    service = AmapPoiService(
        "test-key",
        fallback=FallbackPoiService(),
        fetch_json=fetch_json,
    )

    places = service.search(constraints_for())

    assert places[0].place_id == "fallback_place"
