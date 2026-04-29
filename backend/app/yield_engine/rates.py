from datetime import date, timedelta
from typing import Optional

from app.data.cache import CacheService
from app.data.providers.bcb import BCBProvider


class RateService:
    def __init__(self, bcb_provider: BCBProvider, cache: CacheService):
        self._bcb = bcb_provider
        self._cache = cache

    async def get_latest_cdi(self) -> float:
        cached = await self._cache.get_bcb_latest("CDI")
        if cached:
            return cached["value"]
        data = await self._bcb.get_latest_rate("CDI")
        await self._cache.set_bcb_latest("CDI", data)
        return data["value"]

    async def get_latest_selic(self) -> float:
        cached = await self._cache.get_bcb_latest("SELIC")
        if cached:
            return cached["value"]
        data = await self._bcb.get_latest_rate("SELIC")
        await self._cache.set_bcb_latest("SELIC", data)
        return data["value"]

    async def get_latest_ipca(self) -> float:
        cached = await self._cache.get_bcb_latest("IPCA")
        if cached:
            return cached["value"]
        data = await self._bcb.get_latest_rate("IPCA")
        await self._cache.set_bcb_latest("IPCA", data)
        return data["value"]

    async def get_all_rates(self) -> dict:
        cdi = await self.get_latest_cdi()
        selic = await self.get_latest_selic()
        ipca = await self.get_latest_ipca()
        return {"cdi": cdi, "selic": selic, "ipca": ipca}

    async def get_cdi_history(
        self, start_date: Optional[date] = None, end_date: Optional[date] = None
    ) -> list[dict]:
        if not start_date:
            start_date = date.today() - timedelta(days=30)
        if not end_date:
            end_date = date.today()
        return await self._bcb.get_rate_history("CDI", start_date, end_date)

    async def get_accumulated_cdi(self, start_date: date, end_date: date) -> float:
        history = await self._bcb.get_rate_history("CDI", start_date, end_date)
        accumulated = 1.0
        for entry in history:
            daily_rate = entry["value"] / 100
            accumulated *= (1 + daily_rate)
        return (accumulated - 1) * 100
