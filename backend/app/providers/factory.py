from app.core.config import settings
from app.providers.base import BasePoiProvider
from app.providers.amap.poi import AmapPoiProvider


def get_poi_provider() -> BasePoiProvider:
    if settings.poi_provider == "amap":
        return AmapPoiProvider()

    raise ValueError(f"Unsupported POI_PROVIDER: {settings.poi_provider}")