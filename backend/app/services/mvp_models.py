from dataclasses import dataclass, field


@dataclass(frozen=True)
class ShanghaiPlace:
    place_id: str
    name: str
    district: str
    address: str
    category: str
    latitude: float
    longitude: float
    rating: float
    price_per_person: int
    queue_minutes: int
    hours_label: str
    map_x: float
    map_y: float
    tags: set[str] = field(default_factory=set)
    is_child_friendly: bool = False
    is_indoor: bool = False
    recommendation_reason: str = ""


@dataclass(frozen=True)
class WeatherSnapshot:
    condition: str
    temperature_c: int
    rain_probability: int
    summary: str

    @property
    def prefers_indoor(self) -> bool:
        return self.rain_probability >= 45 or self.condition in {"rain", "storm"}


@dataclass(frozen=True)
class RouteLeg:
    distance_km: float
    duration_minutes: int
    mode: str
    summary: str
