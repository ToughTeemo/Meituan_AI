import re
from datetime import UTC, datetime
from uuid import uuid4

from app.schemas.plan import (
    POI,
    Card,
    Constraints,
    MapPosition,
    PlanResponse,
    PlanSummary,
)
from app.services.mock_data import default_timeline, new_log
from app.services.mvp_models import ShanghaiPlace, WeatherSnapshot
from app.services.poi_service import PoiService
from app.services.route_service import RouteService
from app.services.weather_service import WeatherService


class ShanghaiMvpPlannerService:
    def __init__(
        self,
        poi_service: PoiService,
        weather_service: WeatherService,
        route_service: RouteService,
    ) -> None:
        self.poi_service = poi_service
        self.weather_service = weather_service
        self.route_service = route_service

    def create_plan(
        self,
        prompt: str,
        session_id: str,
        user_id: str | None = None,
        city: str = "上海",
    ) -> PlanResponse:
        constraints = self._constraints_from_prompt(prompt)
        weather = self.weather_service.current_shanghai_weather()
        candidates = self.poi_service.search(constraints)
        places = self._select_route_places(candidates, constraints, weather)
        cards = self._cards_from_places(places, constraints, weather)
        now = datetime.now(UTC)

        return PlanResponse(
            plan_id=f"plan_{uuid4().hex[:10]}",
            session_id=session_id,
            user_id=user_id,
            city=city,
            source="api",
            status="EXECUTING",
            version=1,
            constraints=constraints,
            timeline=default_timeline(),
            cards=cards,
            active_risk=None,
            agent_logs=[
                new_log("已基于上海真实地点库、天气和路线时间生成周末城市玩耍方案。"),
                new_log(weather.summary),
            ],
            summary=PlanSummary(
                title="上海周末城市玩耍路线",
                subtitle="真实上海地点、路线时间、天气偏好和预算约束已纳入规划",
            ),
            created_at=now,
            updated_at=now,
        )

    def _constraints_from_prompt(self, prompt: str) -> Constraints:
        text = prompt.strip()
        budget = self._extract_budget(text)
        tags = self._extract_tags(text)
        return Constraints(
            goal=text or "周末在上海市区玩半天，预算 500，地铁方便，别太累",
            time_start="13:30" if "下午" in text or "半天" in text else "10:00",
            time_end="20:00" if "8" in text or "晚上" in text else "18:30",
            adults=2,
            children=1 if any(word in text for word in ["孩子", "亲子", "小朋友"]) else 0,
            children_age=5,
            budget=budget,
            departure=self._extract_departure(text),
            transport_mode="地铁",
            pace="轻松" if any(word in text for word in ["轻松", "别太累", "少走"]) else "紧凑",
            preference_tags=tags,
        )

    def _extract_budget(self, text: str) -> int:
        match = re.search(r"预算\s*(\d+)|(\d+)\s*元", text)
        if not match:
            return 500
        value = next(group for group in match.groups() if group)
        return max(100, int(value))

    def _extract_tags(self, text: str) -> list[str]:
        tags: list[str] = ["上海", "周末", "地铁方便"]
        if any(word in text for word in ["孩子", "亲子", "小朋友"]):
            tags.append("亲子")
        if any(word in text for word in ["朋友", "逛展"]):
            tags.append("朋友")
        if any(word in text for word in ["情侣", "约会"]):
            tags.append("情侣")
        if any(word in text for word in ["室内", "下雨", "雨天"]):
            tags.append("室内优先")
        if any(word in text for word in ["轻松", "别太累", "少走"]):
            tags.append("轻松")
        if any(word in text for word in ["少排队", "别排队", "不排队"]):
            tags.append("少排队")
        return tags

    def _extract_departure(self, text: str) -> str:
        known_areas = ["人民广场", "徐家汇", "陆家嘴", "静安寺", "五角场", "莘庄"]
        return next((area for area in known_areas if area in text), "人民广场")

    def _select_route_places(
        self,
        candidates: list[ShanghaiPlace],
        constraints: Constraints,
        weather: WeatherSnapshot,
    ) -> list[ShanghaiPlace]:
        if weather.prefers_indoor:
            indoor = [place for place in candidates if place.is_indoor]
            if len(indoor) >= 2:
                candidates = [*indoor, *[place for place in candidates if place not in indoor]]

        food_places = [place for place in candidates if "food" in place.tags]
        activity_places = [place for place in candidates if "food" not in place.tags]

        route = activity_places[:2]
        if not route and candidates:
            route = candidates[:1]
        if food_places:
            route.append(food_places[0])

        total_cost = sum(place.price_per_person for place in route)
        if total_cost > constraints.budget:
            cheaper = sorted(route, key=lambda place: place.price_per_person)
            route = cheaper[: max(2, min(3, len(cheaper)))]
        return route[:3]

    def _cards_from_places(
        self,
        places: list[ShanghaiPlace],
        constraints: Constraints,
        weather: WeatherSnapshot,
    ) -> list[Card]:
        origin = self._origin_place(constraints.departure)
        cards: list[Card] = []
        current = origin
        minute = 0

        for index, place in enumerate(places):
            leg = self.route_service.estimate_leg(current, place, constraints)
            cards.append(
                Card(
                    card_id=f"card_transit_{index + 1}",
                    type="transit",
                    status="done" if index == 0 else "pending",
                    label=leg.summary,
                    emoji="🚇",
                    start_minute=minute,
                    duration_minutes=leg.duration_minutes,
                    is_flexible=False,
                    poi=self._poi_from_place(current, weather, leg.summary),
                )
            )
            minute += leg.duration_minutes

            is_dining = "food" in place.tags or "餐" in place.category
            duration = 80 if is_dining else 90
            cards.append(
                Card(
                    card_id=f"card_{place.place_id}",
                    type="dining" if is_dining else "activity",
                    status="active" if index == 0 else "pending",
                    label=f"{place.name} · {place.category}",
                    emoji="🍽️" if is_dining else "📍",
                    start_minute=minute,
                    duration_minutes=duration,
                    is_flexible=not is_dining,
                    is_new=True,
                    poi=self._poi_from_place(place, weather),
                    alternatives=[
                        self._poi_from_place(item, weather)
                        for item in places
                        if item.place_id != place.place_id
                    ][:2],
                )
            )
            minute += duration
            current = place

        cards.append(
            Card(
                card_id="card_transit_back",
                type="transit",
                status="pending",
                label=f"{constraints.transport_mode}返回，可在 {constraints.time_end} 前结束",
                emoji="🚇",
                start_minute=minute,
                duration_minutes=25,
                is_flexible=False,
                poi=self._poi_from_place(current, weather, "返程时间已纳入估算。"),
            )
        )
        return cards

    def _poi_from_place(
        self,
        place: ShanghaiPlace,
        weather: WeatherSnapshot,
        reason_override: str | None = None,
    ) -> POI:
        risk_labels: list[str] = []
        if weather.prefers_indoor and not place.is_indoor:
            risk_labels.append("天气")
        if place.queue_minutes >= 25:
            risk_labels.append("热门")
        if place.price_per_person >= 100:
            risk_labels.append("预算")

        return POI(
            poi_id=place.place_id,
            name=place.name,
            rating=place.rating,
            price_per_person=place.price_per_person,
            queue_minutes=place.queue_minutes,
            category=place.category,
            map_position=MapPosition(x=place.map_x, y=place.map_y),
            is_child_friendly=place.is_child_friendly,
            hours_label=place.hours_label,
            address=place.address,
            district=place.district,
            latitude=place.latitude,
            longitude=place.longitude,
            recommendation_reason=reason_override or place.recommendation_reason,
            risk_labels=risk_labels,
        )

    def _origin_place(self, departure: str) -> ShanghaiPlace:
        origins = {
            "人民广场": (31.2304, 121.4737, 48, 48),
            "徐家汇": (31.1837, 121.4375, 35, 68),
            "陆家嘴": (31.2397, 121.4998, 59, 43),
            "静安寺": (31.2230, 121.4453, 37, 50),
            "五角场": (31.2989, 121.5145, 64, 25),
            "莘庄": (31.1113, 121.3850, 22, 82),
        }
        latitude, longitude, x, y = origins.get(departure, origins["人民广场"])
        return ShanghaiPlace(
            place_id="origin",
            name=departure,
            district="上海",
            address=f"{departure}附近",
            category="出发地",
            latitude=latitude,
            longitude=longitude,
            rating=4.0,
            price_per_person=0,
            queue_minutes=0,
            hours_label="按出发时间",
            map_x=x,
            map_y=y,
            tags={"origin"},
            recommendation_reason="作为本次上海城市路线的默认出发地。",
        )
