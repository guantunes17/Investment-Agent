import json
from typing import Any, Optional

from redis.asyncio import Redis

TTL_MAP = {
    "quote": 300,
    "bcb_latest": 3600,
    "fundamentals": 86400,
}


class CacheService:
    def __init__(self, redis: Redis):
        self._redis = redis

    async def get(self, key: str) -> Optional[Any]:
        value = await self._redis.get(key)
        if value is None:
            return None
        return json.loads(value)

    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        serialized = json.dumps(value, default=str)
        if ttl:
            await self._redis.setex(key, ttl, serialized)
        else:
            await self._redis.set(key, serialized)

    async def delete(self, key: str) -> None:
        await self._redis.delete(key)

    async def get_quote(self, ticker: str) -> Optional[dict]:
        return await self.get(f"quote:{ticker}")

    async def set_quote(self, ticker: str, data: dict) -> None:
        await self.set(f"quote:{ticker}", data, TTL_MAP["quote"])

    async def get_bcb_latest(self, rate_type: str) -> Optional[dict]:
        return await self.get(f"bcb:{rate_type}:latest")

    async def set_bcb_latest(self, rate_type: str, data: dict) -> None:
        await self.set(f"bcb:{rate_type}:latest", data, TTL_MAP["bcb_latest"])

    async def get_fundamentals(self, ticker: str) -> Optional[dict]:
        return await self.get(f"fundamentals:{ticker}")

    async def set_fundamentals(self, ticker: str, data: dict) -> None:
        await self.set(f"fundamentals:{ticker}", data, TTL_MAP["fundamentals"])
