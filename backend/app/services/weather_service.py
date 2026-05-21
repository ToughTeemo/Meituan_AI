import json
from typing import Protocol
from urllib.error import URLError
from urllib.request import urlopen

from app.services.mvp_models import WeatherSnapshot

SHANGHAI_LATITUDE = 31.2304
SHANGHAI_LONGITUDE = 121.4737


class WeatherService(Protocol):
    def current_shanghai_weather(self) -> WeatherSnapshot:
        ...


class SeedWeatherService:
    def current_shanghai_weather(self) -> WeatherSnapshot:
        return WeatherSnapshot(
            condition="cloudy",
            temperature_c=24,
            rain_probability=20,
            summary="上海周末天气以多云为主，适合城市内轻量出行。",
        )


class OpenMeteoWeatherService:
    def current_shanghai_weather(self) -> WeatherSnapshot:
        url = (
            "https://api.open-meteo.com/v1/forecast"
            f"?latitude={SHANGHAI_LATITUDE}"
            f"&longitude={SHANGHAI_LONGITUDE}"
            "&current=temperature_2m,precipitation,rain"
            "&forecast_days=1"
        )
        try:
            with urlopen(url, timeout=3) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except (OSError, URLError, TimeoutError, json.JSONDecodeError):
            return SeedWeatherService().current_shanghai_weather()

        current = payload.get("current") or {}
        rain = float(current.get("rain") or current.get("precipitation") or 0)
        temperature = round(float(current.get("temperature_2m") or 24))
        rain_probability = 70 if rain > 0 else 20
        condition = "rain" if rain > 0 else "cloudy"
        summary = (
            "上海当前有降雨，建议优先选择室内和地铁可达地点。"
            if rain > 0
            else "上海当前无明显降雨，室内外路线都可作为候选。"
        )
        return WeatherSnapshot(
            condition=condition,
            temperature_c=temperature,
            rain_probability=rain_probability,
            summary=summary,
        )
