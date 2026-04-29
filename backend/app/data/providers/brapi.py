import httpx

from app.config import get_settings
from app.data.providers.base import BaseDataProvider

BASE_URL = "https://brapi.dev/api"


class BrapiProvider(BaseDataProvider):
    def __init__(self):
        self._token = get_settings().brapi_token

    def _params(self) -> dict:
        if self._token:
            return {"token": self._token}
        return {}

    async def get_quote(self, ticker: str) -> dict:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{BASE_URL}/quote/{ticker}",
                params=self._params(),
            )
            resp.raise_for_status()
            data = resp.json()["results"][0]
            return {
                "ticker": ticker,
                "price": data.get("regularMarketPrice", 0),
                "change": data.get("regularMarketChange", 0),
                "change_pct": data.get("regularMarketChangePercent", 0),
                "volume": data.get("regularMarketVolume", 0),
                "market_cap": data.get("marketCap", 0),
            }

    async def get_historical(self, ticker: str, period: str = "1mo") -> list[dict]:
        range_map = {
            "1d": "1d", "5d": "5d", "1mo": "1mo", "3mo": "3mo",
            "6mo": "6mo", "1y": "1y", "2y": "2y", "5y": "5y",
        }
        api_range = range_map.get(period, "1mo")
        params = {**self._params(), "range": api_range, "interval": "1d"}
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{BASE_URL}/quote/{ticker}",
                params=params,
            )
            resp.raise_for_status()
            data = resp.json()["results"][0]
            historical = data.get("historicalDataPrice", [])
            records = []
            for item in historical:
                records.append({
                    "date": item.get("date", ""),
                    "open": item.get("open"),
                    "high": item.get("high"),
                    "low": item.get("low"),
                    "close": item.get("close"),
                    "volume": item.get("volume"),
                })
            return records

    async def get_fundamentals(self, ticker: str) -> dict:
        params = {**self._params(), "fundamental": "true"}
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{BASE_URL}/quote/{ticker}",
                params=params,
            )
            resp.raise_for_status()
            data = resp.json()["results"][0]
            return {
                "pe_ratio": data.get("priceEarnings"),
                "eps": data.get("earningsPerShare"),
                "dividend_yield": data.get("dividendYield"),
                "revenue": data.get("revenue"),
                "market_cap": data.get("marketCap"),
                "debt_to_equity": data.get("debtToEquity"),
            }

    async def search(self, query: str) -> list[dict]:
        params = {**self._params(), "search": query}
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{BASE_URL}/available",
                params=params,
            )
            resp.raise_for_status()
            data = resp.json()
            stocks = data.get("stocks", [])
            results = []
            for s in stocks[:10]:
                results.append({
                    "ticker": s,
                    "name": s,
                    "exchange": "B3",
                    "type": "stock",
                })
            return results
