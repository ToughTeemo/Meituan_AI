import json
from collections.abc import Callable
from typing import Any, Protocol
from urllib.parse import urlencode
from urllib.request import urlopen

from app.schemas.plan import Constraints
from app.services.mvp_models import ShanghaiPlace

SHANGHAI_SEED_PLACES: tuple[ShanghaiPlace, ...] = (
    ShanghaiPlace(
        place_id="sh_psa",
        name="上海当代艺术博物馆",
        district="黄浦区",
        address="花园港路200号",
        category="展览",
        latitude=31.2051,
        longitude=121.4897,
        rating=4.7,
        price_per_person=60,
        queue_minutes=15,
        hours_label="11:00-19:00",
        map_x=48,
        map_y=56,
        tags={"friends", "couple", "indoor", "photo", "subway"},
        is_indoor=True,
        recommendation_reason="室内展览稳定，适合周末半日游，雨天也不影响体验。",
    ),
    ShanghaiPlace(
        place_id="sh_natural_history",
        name="上海自然博物馆",
        district="静安区",
        address="北京西路510号",
        category="亲子展馆",
        latitude=31.2354,
        longitude=121.4622,
        rating=4.8,
        price_per_person=30,
        queue_minutes=25,
        hours_label="09:00-17:00",
        map_x=41,
        map_y=42,
        tags={"parent_child", "indoor", "education", "subway"},
        is_child_friendly=True,
        is_indoor=True,
        recommendation_reason="亲子友好、地铁方便，适合作为周末城市玩耍的主活动。",
    ),
    ShanghaiPlace(
        place_id="sh_century_park",
        name="世纪公园",
        district="浦东新区",
        address="锦绣路1001号",
        category="公园",
        latitude=31.2166,
        longitude=121.5517,
        rating=4.6,
        price_per_person=10,
        queue_minutes=10,
        hours_label="05:00-21:00",
        map_x=70,
        map_y=50,
        tags={"parent_child", "outdoor", "relaxed", "subway"},
        is_child_friendly=True,
        recommendation_reason="空间大、节奏轻松，适合天气好时安排户外放电。",
    ),
    ShanghaiPlace(
        place_id="sh_west_bund",
        name="西岸美术馆",
        district="徐汇区",
        address="龙腾大道2600号",
        category="展览",
        latitude=31.1687,
        longitude=121.4618,
        rating=4.7,
        price_per_person=80,
        queue_minutes=15,
        hours_label="10:00-17:00",
        map_x=38,
        map_y=70,
        tags={"friends", "couple", "indoor", "photo"},
        is_indoor=True,
        recommendation_reason="展览密度高，适合朋友或情侣周末逛展拍照。",
    ),
    ShanghaiPlace(
        place_id="sh_tianzifang",
        name="田子坊",
        district="黄浦区",
        address="泰康路210弄",
        category="街区",
        latitude=31.2091,
        longitude=121.4698,
        rating=4.3,
        price_per_person=50,
        queue_minutes=20,
        hours_label="10:00-22:00",
        map_x=45,
        map_y=58,
        tags={"friends", "couple", "photo", "food"},
        recommendation_reason="小店和餐饮集中，适合把活动和晚餐自然衔接起来。",
    ),
    ShanghaiPlace(
        place_id="sh_xintiandi",
        name="新天地",
        district="黄浦区",
        address="太仓路181弄",
        category="街区餐饮",
        latitude=31.2197,
        longitude=121.4758,
        rating=4.5,
        price_per_person=120,
        queue_minutes=20,
        hours_label="10:00-23:00",
        map_x=48,
        map_y=53,
        tags={"friends", "couple", "food", "subway"},
        recommendation_reason="餐饮选择多，地铁方便，适合做路线后半段的吃饭落点。",
    ),
    ShanghaiPlace(
        place_id="sh_kerry_family",
        name="浦东嘉里城",
        district="浦东新区",
        address="花木路1378号",
        category="亲子商场",
        latitude=31.2113,
        longitude=121.5638,
        rating=4.5,
        price_per_person=100,
        queue_minutes=12,
        hours_label="10:00-22:00",
        map_x=74,
        map_y=52,
        tags={"parent_child", "indoor", "food", "subway"},
        is_child_friendly=True,
        is_indoor=True,
        recommendation_reason="餐饮和亲子配套集中，适合作为雨天或疲劳时的稳定替代点。",
    ),
    ShanghaiPlace(
        place_id="sh_columbia_circle",
        name="上生新所",
        district="长宁区",
        address="延安西路1262号",
        category="城市更新街区",
        latitude=31.2118,
        longitude=121.4242,
        rating=4.6,
        price_per_person=90,
        queue_minutes=15,
        hours_label="10:00-22:00",
        map_x=29,
        map_y=55,
        tags={"friends", "couple", "photo", "food", "relaxed"},
        recommendation_reason="街区轻松、咖啡餐饮多，适合不想太累的城市漫游。",
    ),
)


class PoiService(Protocol):
    def search(self, constraints: Constraints, limit: int = 8) -> list[ShanghaiPlace]:
        ...


class ShanghaiSeedPoiService:
    def search(self, constraints: Constraints, limit: int = 8) -> list[ShanghaiPlace]:
        tags = self._tags_from_constraints(constraints)
        places = sorted(
            SHANGHAI_SEED_PLACES,
            key=lambda place: self._score_place(place, tags, constraints),
            reverse=True,
        )
        return places[:limit]

    def _tags_from_constraints(self, constraints: Constraints) -> set[str]:
        text = f"{constraints.goal} {' '.join(constraints.preference_tags)}"
        tags: set[str] = {"subway"}
        if any(word in text for word in ["孩子", "亲子", "小朋友", "儿童"]):
            tags.add("parent_child")
        if any(word in text for word in ["朋友", "逛展", "拍照"]):
            tags.update({"friends", "photo"})
        if any(word in text for word in ["情侣", "约会", "夜景"]):
            tags.add("couple")
        if any(word in text for word in ["室内", "下雨", "雨天"]):
            tags.add("indoor")
        if any(word in text for word in ["轻松", "别太累", "少走"]):
            tags.add("relaxed")
        return tags

    def _score_place(
        self,
        place: ShanghaiPlace,
        tags: set[str],
        constraints: Constraints,
    ) -> float:
        score = place.rating * 10
        score += len(place.tags & tags) * 8
        if constraints.budget and place.price_per_person <= max(80, constraints.budget // 4):
            score += 5
        if place.queue_minutes <= 15:
            score += 4
        return score


class AmapPoiService:
    def __init__(
        self,
        api_key: str,
        fallback: PoiService | None = None,
        fetch_json: Callable[[str, float], Any] | None = None,
        timeout_seconds: float = 4,
    ) -> None:
        self.api_key = api_key
        self.fallback = fallback or ShanghaiSeedPoiService()
        self.fetch_json = fetch_json or self._fetch_json
        self.timeout_seconds = timeout_seconds

    def search(self, constraints: Constraints, limit: int = 8) -> list[ShanghaiPlace]:
        if not self.api_key.strip():
            return self.fallback.search(constraints, limit)

        keyword = self._keyword_for_constraints(constraints)
        query = urlencode(
            {
                "key": self.api_key,
                "keywords": keyword,
                "city": "上海",
                "offset": str(limit),
                "page": "1",
                "extensions": "all",
            }
        )
        url = f"https://restapi.amap.com/v3/place/text?{query}"
        try:
            payload = self.fetch_json(url, self.timeout_seconds)
        except (OSError, TimeoutError, json.JSONDecodeError):
            return self.fallback.search(constraints, limit)

        if not isinstance(payload, dict):
            return self.fallback.search(constraints, limit)

        if payload.get("status") not in {"1", 1, None}:
            return self.fallback.search(constraints, limit)

        pois = payload.get("pois") or []
        if not isinstance(pois, list):
            return self.fallback.search(constraints, limit)

        places = [
            place
            for item in pois
            if isinstance(item, dict)
            if (place := self._place_from_amap_item(item)) is not None
        ]
        return places[:limit] or self.fallback.search(constraints, limit)

    def _fetch_json(self, url: str, timeout_seconds: float) -> dict[str, Any]:
        with urlopen(url, timeout=timeout_seconds) as response:
            payload = json.loads(response.read().decode("utf-8"))
        if not isinstance(payload, dict):
            return {}
        return payload

    def _keyword_for_constraints(self, constraints: Constraints) -> str:
        text = f"{constraints.goal} {' '.join(constraints.preference_tags)}"
        if any(word in text for word in ["孩子", "亲子", "儿童"]):
            return "亲子"
        if any(word in text for word in ["吃", "餐厅", "咖啡"]):
            return "餐厅"
        if any(word in text for word in ["展", "拍照", "朋友"]):
            return "展览"
        return "周末休闲"

    def _place_from_amap_item(self, item: dict) -> ShanghaiPlace | None:
        location = item.get("location")
        if not isinstance(location, str) or "," not in location:
            return None
        lng_text, lat_text = location.split(",", 1)
        try:
            longitude = float(lng_text)
            latitude = float(lat_text)
        except ValueError:
            return None
        if not self._is_in_shanghai(latitude, longitude):
            return None

        biz_ext = item.get("biz_ext") if isinstance(item.get("biz_ext"), dict) else {}
        rating = self._float_or_default(biz_ext.get("rating"), 4.3)
        cost = round(self._float_or_default(biz_ext.get("cost"), 80))
        category = str(item.get("type") or "上海 POI").split(";")[0]
        name = str(item.get("name") or "上海地点")
        district = str(item.get("adname") or "上海")
        address = self._string_or_default(item.get("address"), district)
        tags = self._tags_from_category(category, name)

        return ShanghaiPlace(
            place_id=f"amap_{self._string_or_default(item.get('id'), name)}",
            name=name,
            district=district,
            address=address,
            category=category,
            latitude=latitude,
            longitude=longitude,
            rating=rating,
            price_per_person=max(0, cost),
            queue_minutes=18,
            hours_label="以商户实时信息为准",
            map_x=self._map_x(longitude),
            map_y=self._map_y(latitude),
            tags=tags,
            is_child_friendly="亲子" in name or "儿童" in name or "parent_child" in tags,
            is_indoor="indoor" in tags,
            recommendation_reason="来自高德 POI 搜索结果，已纳入上海市内路线候选。",
        )

    def _tags_from_category(self, category: str, name: str) -> set[str]:
        text = f"{category} {name}"
        tags: set[str] = {"subway"}
        if any(word in text for word in ["餐饮", "餐厅", "咖啡"]):
            tags.add("food")
        if any(word in text for word in ["博物馆", "展览", "文化"]):
            tags.update({"indoor", "friends", "photo"})
        if any(word in text for word in ["儿童", "亲子", "乐园"]):
            tags.update({"parent_child", "indoor"})
        return tags

    def _float_or_default(self, value: object, default: float) -> float:
        try:
            return float(value)
        except (TypeError, ValueError):
            return default

    def _string_or_default(self, value: object, default: str) -> str:
        if isinstance(value, str) and value.strip():
            return value.strip()
        if isinstance(value, list):
            text = " ".join(str(item).strip() for item in value if str(item).strip())
            return text or default
        return default

    def _is_in_shanghai(self, latitude: float, longitude: float) -> bool:
        return 30.65 <= latitude <= 31.9 and 120.8 <= longitude <= 122.2

    def _map_x(self, longitude: float) -> float:
        return min(90, max(10, (longitude - 121.35) / 0.28 * 80 + 10))

    def _map_y(self, latitude: float) -> float:
        return min(90, max(10, 90 - (latitude - 31.1) / 0.25 * 80))
