from datetime import UTC, datetime
from time import time
from uuid import uuid4

from app.schemas.plan import (
    POI,
    AgentLogEntry,
    Card,
    CardHeightMap,
    Constraints,
    MapPosition,
    PlanResponse,
    PlanSummary,
    RiskSignal,
    TimelineConfig,
)


def now_ms() -> int:
    return int(time() * 1000)


def new_log(message: str) -> AgentLogEntry:
    return AgentLogEntry(id=f"log_{uuid4().hex[:8]}", created_at=now_ms(), message=message)


def default_constraints(prompt: str) -> Constraints:
    return Constraints(
        goal=prompt.strip() or "今天下午带孩子出去玩，不想太累，预算500，最好少排队",
        time_start="14:00",
        time_end="20:00",
        adults=2,
        children=1,
        children_age=5,
        budget=500,
        departure="芍药居",
        transport_mode="地铁",
        pace="轻松",
        preference_tags=["亲子", "少排队", "预算内", "地铁可达"],
    )


def default_timeline() -> TimelineConfig:
    return TimelineConfig(
        pixels_per_minute=4,
        min_card_width=80,
        card_height_map=CardHeightMap(transit=56, activity=100, dining=100, buffer=56),
    )


def default_cards() -> list[Card]:
    return [
        Card(
            card_id="card_transit_out",
            type="transit",
            status="done",
            label="地铁 · 芍药居 -> 朝阳公园",
            emoji="🚇",
            start_minute=0,
            duration_minutes=20,
            is_flexible=False,
            poi=POI(
                poi_id="poi_metro_start",
                name="芍药居站",
                rating=4.2,
                price_per_person=4,
                queue_minutes=0,
                category="交通",
                map_position=MapPosition(x=12, y=42),
                is_child_friendly=False,
                hours_label="以当日运营为准",
            ),
            alternatives=[],
        ),
        Card(
            card_id="card_park",
            type="activity",
            status="active",
            label="朝阳公园 · 轻松游玩",
            emoji="🎡",
            start_minute=20,
            duration_minutes=90,
            is_flexible=True,
            is_new=True,
            poi=POI(
                poi_id="poi_park",
                name="朝阳公园 · 轻松游玩",
                rating=4.7,
                price_per_person=10,
                queue_minutes=25,
                category="亲子活动",
                map_position=MapPosition(x=38, y=28),
                is_child_friendly=True,
                hours_label="06:00-22:00",
            ),
            alternatives=[
                POI(
                    poi_id="poi_bookstore",
                    name="亲子书店 · 室内休息",
                    rating=4.6,
                    price_per_person=35,
                    queue_minutes=5,
                    category="室内休息",
                    map_position=MapPosition(x=58, y=42),
                    is_child_friendly=True,
                    hours_label="10:00-21:00",
                )
            ],
            risk_note="已优先选择低强度活动",
        ),
        Card(
            card_id="card_bookstore",
            type="activity",
            status="pending",
            label="亲子书店 · 室内休息",
            emoji="📚",
            start_minute=130,
            duration_minutes=60,
            is_flexible=True,
            is_new=True,
            poi=POI(
                poi_id="poi_bookstore",
                name="亲子书店 · 室内休息",
                rating=4.6,
                price_per_person=35,
                queue_minutes=5,
                category="室内休息",
                map_position=MapPosition(x=58, y=42),
                is_child_friendly=True,
                hours_label="10:00-21:00",
            ),
        ),
        Card(
            card_id="card_dinner",
            type="dining",
            status="pending",
            label="眉州东坡 · 亲子晚餐",
            emoji="🍜",
            start_minute=240,
            duration_minutes=80,
            is_flexible=False,
            poi=POI(
                poi_id="poi_dinner",
                name="眉州东坡 · 亲子晚餐",
                rating=4.6,
                price_per_person=80,
                queue_minutes=10,
                category="家庭餐厅",
                map_position=MapPosition(x=72, y=58),
                is_child_friendly=True,
                hours_label="10:00-22:00",
            ),
        ),
        Card(
            card_id="card_transit_back",
            type="transit",
            status="pending",
            label="地铁 · 返程回家",
            emoji="🚇",
            start_minute=345,
            duration_minutes=15,
            is_flexible=False,
            poi=POI(
                poi_id="poi_metro_back",
                name="地铁 · 返程回家",
                rating=4.0,
                price_per_person=4,
                queue_minutes=0,
                category="交通",
                map_position=MapPosition(x=88, y=44),
                is_child_friendly=False,
                hours_label="以当日运营为准",
            ),
        ),
    ]


def create_mock_plan(prompt: str) -> PlanResponse:
    now = datetime.now(UTC)
    return PlanResponse(
        plan_id=f"plan_{uuid4().hex[:10]}",
        session_id=f"anon_{uuid4().hex[:12]}",
        user_id=None,
        city="上海",
        source="mock",
        status="EXECUTING",
        version=1,
        constraints=default_constraints(prompt),
        timeline=default_timeline(),
        cards=default_cards(),
        active_risk=None,
        agent_logs=[new_log("方案已生成，正在关注排队、天气、预算和返程变化。")],
        summary=PlanSummary(title="周末下午亲子轻松路线", subtitle="少排队、预算内、20:00 前回家"),
        created_at=now,
        updated_at=now,
    )


def queue_risk_for(cards: list[Card]) -> RiskSignal:
    affected = [card.card_id for card in cards if card.type == "activity"][:1] or [
        cards[0].card_id
    ]
    return RiskSignal(
        risk_id=f"risk_queue_{uuid4().hex[:8]}",
        type="queue",
        severity="medium",
        title="排队变长了",
        description="儿童乐园预计等待 55 分钟，可能影响后续晚餐和返程。",
        affected_card_ids=affected,
    )


def weather_risk_for(cards: list[Card]) -> RiskSignal:
    affected = [card.card_id for card in cards if card.type == "activity"][:1] or [
        cards[0].card_id
    ]
    return RiskSignal(
        risk_id=f"risk_weather_{uuid4().hex[:8]}",
        type="weather",
        severity="medium",
        title="突然下雨",
        description="傍晚前后可能有阵雨，建议减少户外停留，切换到室内亲子地点。",
        affected_card_ids=affected,
    )


def fatigue_risk_for(cards: list[Card]) -> RiskSignal:
    affected = [card.card_id for card in cards if card.type == "activity"][:2] or [
        cards[0].card_id
    ]
    return RiskSignal(
        risk_id=f"risk_fatigue_{uuid4().hex[:8]}",
        type="fatigue",
        severity="medium",
        title="孩子有点累了",
        description="连续活动偏多，建议加入低等待室内休息点，让后半程更轻松。",
        affected_card_ids=affected,
    )


def risk_for_type(cards: list[Card], risk_type: str) -> RiskSignal | None:
    if risk_type == "queue":
        return queue_risk_for(cards)
    if risk_type == "weather":
        return weather_risk_for(cards)
    if risk_type == "fatigue":
        return fatigue_risk_for(cards)
    return None


def _legacy_replanned_cards(cards: list[Card]) -> tuple[list[Card], list[str], list[str]]:
    removed = {"card_park"}
    prefix = [card for card in cards if card.card_id == "card_transit_out"]
    suffix = [
        card
        for card in cards
        if card.card_id not in removed and card.card_id != "card_transit_out"
    ]
    new_cards = [
        Card(
            card_id="card_park_short",
            type="activity",
            status="active",
            label="朝阳公园 · 放慢节奏",
            emoji="🌿",
            start_minute=20,
            duration_minutes=80,
            is_flexible=True,
            is_new=True,
            risk_note="已缩短高排队活动",
            poi=POI(
                poi_id="poi_park_short",
                name="朝阳公园 · 放慢节奏",
                rating=4.5,
                price_per_person=10,
                queue_minutes=20,
                category="亲子活动",
                map_position=MapPosition(x=38, y=28),
                is_child_friendly=True,
                hours_label="06:00-22:00",
            ),
        ),
        Card(
            card_id="card_indoor_rest",
            type="activity",
            status="pending",
            label="亲子书店 · 低等待休息",
            emoji="📚",
            start_minute=130,
            duration_minutes=60,
            is_flexible=True,
            is_new=True,
            poi=POI(
                poi_id="poi_bookstore",
                name="亲子书店 · 低等待休息",
                rating=4.6,
                price_per_person=35,
                queue_minutes=5,
                category="室内休息",
                map_position=MapPosition(x=58, y=42),
                is_child_friendly=True,
                hours_label="10:00-21:00",
            ),
        ),
    ]
    suffix = [card for card in suffix if card.card_id != "card_bookstore"]
    return [*prefix, *new_cards, *suffix], [card.card_id for card in new_cards], ["card_park"]


def _middle_activity_bounds(cards: list[Card]) -> tuple[int, int] | None:
    start_index = next((index for index, card in enumerate(cards) if card.type == "activity"), -1)
    dining_index = next((index for index, card in enumerate(cards) if card.type == "dining"), -1)
    if start_index < 0 or dining_index < 0 or start_index >= dining_index:
        return None
    return start_index, dining_index


def _indoor_rest_card() -> Card:
    return Card(
        card_id="card_indoor_rest",
        type="activity",
        status="pending",
        label="亲子书店 · 低等待休息",
        emoji="📚",
        start_minute=130,
        duration_minutes=60,
        is_flexible=True,
        is_new=True,
        poi=POI(
            poi_id="poi_bookstore",
            name="亲子书店 · 低等待休息",
            rating=4.6,
            price_per_person=35,
            queue_minutes=5,
            category="室内休息",
            map_position=MapPosition(x=58, y=42),
            is_child_friendly=True,
            hours_label="10:00-21:00",
        ),
    )


def _replacement_activity_cards(risk_type: str) -> list[Card]:
    if risk_type == "weather":
        return [
            Card(
                card_id="card_rain_indoor",
                type="activity",
                status="active",
                label="室内亲子馆 · 避雨活动",
                emoji="☔",
                start_minute=20,
                duration_minutes=90,
                is_flexible=True,
                is_new=True,
                risk_note="已切换到室内备选，减少户外停留",
                poi=POI(
                    poi_id="poi_rain_indoor",
                    name="室内亲子馆 · 避雨活动",
                    rating=4.4,
                    price_per_person=60,
                    queue_minutes=8,
                    category="亲子室内",
                    map_position=MapPosition(x=44, y=34),
                    is_child_friendly=True,
                    hours_label="10:00-20:00",
                ),
            ),
            _indoor_rest_card(),
        ]

    if risk_type == "fatigue":
        return [
            Card(
                card_id="card_easy_park",
                type="activity",
                status="active",
                label="朝阳公园 · 放慢节奏",
                emoji="🌿",
                start_minute=20,
                duration_minutes=80,
                is_flexible=True,
                is_new=True,
                risk_note="已压缩活动强度，加入低等待休息点",
                poi=POI(
                    poi_id="poi_easy_park",
                    name="朝阳公园 · 放慢节奏",
                    rating=4.5,
                    price_per_person=10,
                    queue_minutes=20,
                    category="亲子活动",
                    map_position=MapPosition(x=38, y=28),
                    is_child_friendly=True,
                    hours_label="06:00-22:00",
                ),
            ),
            _indoor_rest_card(),
        ]

    return [
        Card(
            card_id="card_park_short",
            type="activity",
            status="active",
            label="朝阳公园 · 放慢节奏",
            emoji="🌿",
            start_minute=20,
            duration_minutes=80,
            is_flexible=True,
            is_new=True,
            risk_note="已缩短高排队活动",
            poi=POI(
                poi_id="poi_park_short",
                name="朝阳公园 · 放慢节奏",
                rating=4.5,
                price_per_person=10,
                queue_minutes=20,
                category="亲子活动",
                map_position=MapPosition(x=38, y=28),
                is_child_friendly=True,
                hours_label="06:00-22:00",
            ),
        ),
        _indoor_rest_card(),
    ]


def replanned_cards(
    cards: list[Card],
    risk_type: str = "queue",
) -> tuple[list[Card], list[str], list[str]]:
    bounds = _middle_activity_bounds(cards)
    if bounds is None:
        return cards, [], []

    start_index, dining_index = bounds
    prefix = cards[:start_index]
    middle = cards[start_index:dining_index]
    suffix = cards[dining_index:]
    new_cards = _replacement_activity_cards(risk_type)
    return (
        [*prefix, *new_cards, *suffix],
        [card.card_id for card in new_cards],
        [card.card_id for card in middle],
    )
