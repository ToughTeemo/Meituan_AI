import httpx

from app.core.config import settings
from app.providers.base import (
    BasePoiProvider,
    PoiResult,
    ProviderError,
)


class AmapPoiProvider(BasePoiProvider):

    BASE_URL = "https://restapi.amap.com/v3/place/text"

    async def search(
        self,
        keyword: str,
        city: str = "上海",
        limit: int = 10,
    ) -> list[PoiResult]:

        if not settings.amap_api_key:
            raise ProviderError("AMAP_API_KEY missing")

        params = {
            "key": settings.amap_api_key,
            "keywords": keyword,
            "city": city,
            "offset": limit,
            "extensions": "base",
        }

        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                self.BASE_URL,
                params=params,
            )

        data = resp.json()

        if data.get("status") != "1":
            raise ProviderError(
                f"Amap API error: {data}"
            )

        pois = []

        for item in data.get("pois", []):

            location = item.get("location", "")

            if "," not in location:
                continue

            lng, lat = location.split(",")

            pois.append(
                PoiResult(
                    provider="amap",
                    external_id=item.get("id", ""),
                    name=item.get("name", ""),
                    address=item.get("address"),
                    district=item.get("adname"),
                    lat=float(lat),
                    lng=float(lng),
                    category=item.get("type"),
                    confidence="high",
                    source_fields=item,
                )
            )

        return pois