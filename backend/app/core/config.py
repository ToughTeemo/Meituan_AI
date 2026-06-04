from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "local"
    app_version: str = "0.1.0"
    database_url: str = "sqlite:///./life_agent.db"
    database_auto_create: bool = True
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    # Provider Switch
    planning_provider: str = "rule_based"
    replanner_provider: str = "rule"
    llm_replanner_mock: bool = True
    replan_prompt_version: str = "v1"
    poi_provider: str = "seed"
    route_provider: str = "estimated"
    weather_provider: str = "seed"
    hours_provider: str = "hybrid"
    price_provider: str = "estimated"
    queue_provider: str = "estimated"
    booking_provider: str = "stub"
    action_provider: str = "amap_uri"

    # AMap
    amap_api_key: str | None = None

    # DeepSeek
    deepseek_api_key: str | None = None
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-chat"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
