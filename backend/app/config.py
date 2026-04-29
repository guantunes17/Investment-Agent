from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://stockagent:changeme@postgres:5432/stockagent"
    redis_url: str = "redis://redis:6379/0"

    openai_api_key: str = ""
    openai_model: str = "gpt-5.4-mini"

    alpha_vantage_api_key: str = ""
    brapi_token: str = ""

    secret_key: str = "change-this-to-a-random-secret"

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
