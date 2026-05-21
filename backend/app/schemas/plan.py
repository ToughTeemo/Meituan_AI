from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

CardType = Literal["transit", "activity", "dining", "buffer"]
CardStatus = Literal["done", "active", "upcoming", "pending", "risk", "skipped"]
RiskKind = Literal["queue", "time", "budget", "closure", "weather", "fatigue"]
MachineState = Literal[
    "IDLE",
    "EXECUTING",
    "RISK_DETECTED",
    "REPLANNING",
    "COMPLETED",
    "CONFIRMED",
]


class CreatePlanRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=2000)
    city: str = "上海"
    timezone: str = "Asia/Shanghai"
    session_id: str | None = Field(default=None, max_length=128)
    user_id: str | None = Field(default=None, max_length=128)


class MapPosition(BaseModel):
    x: float
    y: float


class POI(BaseModel):
    poi_id: str
    name: str
    rating: float
    price_per_person: int
    queue_minutes: int
    category: str
    map_position: MapPosition
    is_child_friendly: bool
    hours_label: str | None = None
    address: str | None = None
    district: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    recommendation_reason: str | None = None
    risk_labels: list[str] = Field(default_factory=list)


class Card(BaseModel):
    card_id: str
    type: CardType
    status: CardStatus
    label: str
    emoji: str
    start_minute: int
    duration_minutes: int
    is_flexible: bool
    is_new: bool | None = None
    poi: POI | None = None
    risk_note: str | None = None
    alternatives: list[POI] | None = None


class Constraints(BaseModel):
    goal: str
    time_start: str
    time_end: str
    adults: int
    children: int
    children_age: int
    budget: int
    departure: str
    transport_mode: Literal["地铁", "驾车", "步行"]
    pace: Literal["轻松", "紧凑"]
    preference_tags: list[str]


class CardHeightMap(BaseModel):
    transit: int
    activity: int
    dining: int
    buffer: int


class TimelineConfig(BaseModel):
    pixels_per_minute: int
    min_card_width: int
    card_height_map: CardHeightMap


class RiskSignal(BaseModel):
    risk_id: str
    type: RiskKind
    severity: Literal["medium", "high"]
    title: str
    description: str
    affected_card_ids: list[str]


class AgentLogEntry(BaseModel):
    id: str
    created_at: int
    message: str


class PlanSummary(BaseModel):
    title: str
    subtitle: str


class PlanResponse(BaseModel):
    plan_id: str
    session_id: str
    user_id: str | None = None
    city: str = "上海"
    source: str = "api"
    status: MachineState
    version: int
    constraints: Constraints
    timeline: TimelineConfig
    cards: list[Card]
    active_risk: RiskSignal | None = None
    agent_logs: list[AgentLogEntry]
    summary: PlanSummary
    created_at: datetime
    updated_at: datetime


class PlanVersionResponse(BaseModel):
    version_id: str
    plan_id: str
    session_id: str
    user_id: str | None = None
    city: str = "上海"
    source: str = "api"
    version: int
    event_type: str
    status: MachineState
    constraints: Constraints
    timeline: TimelineConfig
    cards: list[Card]
    active_risk: RiskSignal | None = None
    agent_logs: list[AgentLogEntry]
    created_at: datetime


class PlanVersionCompareResponse(BaseModel):
    plan_id: str
    base_version_id: str
    target_version_id: str
    base_version: int
    target_version: int
    base_status: MachineState
    target_status: MachineState
    added_card_ids: list[str]
    removed_card_ids: list[str]
    changed_card_ids: list[str]
    unchanged_card_ids: list[str]
