from app.core.config import settings
from app.providers.base import BasePoiProvider, BaseProvider
from app.providers.amap.poi import AmapPoiProvider
from app.providers.hours import HoursProvider
from app.providers.price import PriceProvider
from app.providers.weather import WeatherProvider


class ProviderFactory:
    _providers: dict[str, type[BaseProvider]] = {
        "weather": WeatherProvider,
        "hours": HoursProvider,
        "price": PriceProvider,
    }

    @classmethod
    def create(cls, provider_name: str) -> BaseProvider:
        normalized_name = provider_name.strip().lower()
        provider_class = cls._providers.get(normalized_name)
        if provider_class is None:
            raise ValueError(f"Unsupported provider: {provider_name}")
        return provider_class()


def get_poi_provider() -> BasePoiProvider:
    if settings.poi_provider == "amap":
        return AmapPoiProvider()

    raise ValueError(f"Unsupported POI_PROVIDER: {settings.poi_provider}")
