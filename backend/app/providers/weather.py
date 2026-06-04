from app.providers.base import BaseProvider
from app.services.weather_service import OpenMeteoWeatherService, SeedWeatherService


class WeatherProvider(BaseProvider):
    async def get(self) -> dict:
        try:
            snapshot = OpenMeteoWeatherService().current_shanghai_weather()
            seed_snapshot = SeedWeatherService().current_shanghai_weather()
            if snapshot == seed_snapshot:
                source = "seed"
                confidence = 0.6
            else:
                source = "openmeteo"
                confidence = 0.95
        except Exception:
            snapshot = SeedWeatherService().current_shanghai_weather()
            source = "seed"
            confidence = 0.6

        return {
            "condition": snapshot.condition,
            "temperature_c": snapshot.temperature_c,
            "rain_probability": round(snapshot.rain_probability / 100, 2),
            "prefers_indoor": snapshot.prefers_indoor,
            "summary": snapshot.summary,
            "source": source,
            "confidence": confidence,
        }
