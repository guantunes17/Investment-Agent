import httpx

from app.config import get_settings
from app.data.providers.base import BaseDataProvider

BASE_URL = "https://www.alphavantage.co/query"


class AlphaVantageProvider(BaseDataProvider):
    def __init__(self):
        self._api_key = get_settings().alpha_vantage_api_key

    async def get_quote(self, ticker: str) -> dict:
        params = {
            "function": "GLOBAL_QUOTE",
            "symbol": ticker,
            "apikey": self._api_key,
        }
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(BASE_URL, params=params)
            resp.raise_for_status()
            data = resp.json().get("Global Quote", {})
            price = float(data.get("05. price", 0))
            change = float(data.get("09. change", 0))
            change_pct_raw = data.get("10. change percent", "0%")
            change_pct = float(change_pct_raw.replace("%", "")) if change_pct_raw else 0
            return {
                "ticker": ticker,
                "price": price,
                "change": round(change, 2),
                "change_pct": round(change_pct, 2),
                "volume": int(data.get("06. volume", 0)),
                "market_cap": None,
            }

    async def get_historical(self, ticker: str, period: str = "1mo") -> list[dict]:
        params = {
            "function": "TIME_SERIES_DAILY",
            "symbol": ticker,
            "outputsize": "compact" if period in ("1mo", "1d", "5d") else "full",
            "apikey": self._api_key,
        }
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(BASE_URL, params=params)
            resp.raise_for_status()
            time_series = resp.json().get("Time Series (Daily)", {})
            records = []
            for date_str, values in sorted(time_series.items()):
                records.append({
                    "date": date_str,
                    "open": float(values["1. open"]),
                    "high": float(values["2. high"]),
                    "low": float(values["3. low"]),
                    "close": float(values["4. close"]),
                    "volume": int(values["5. volume"]),
                })
            return records

    async def get_fundamentals(self, ticker: str) -> dict:
        params = {
            "function": "OVERVIEW",
            "symbol": ticker,
            "apikey": self._api_key,
        }
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(BASE_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
            pe = data.get("TrailingPE")
            eps = data.get("EPS")
            div_yield = data.get("DividendYield")
            return {
                "pe_ratio": float(pe) if pe else None,
                "eps": float(eps) if eps else None,
                "dividend_yield": float(div_yield) if div_yield else None,
                "revenue": float(data["RevenueTTM"]) if data.get("RevenueTTM") else None,
                "market_cap": float(data["MarketCapitalization"]) if data.get("MarketCapitalization") else None,
                "debt_to_equity": float(data["DebtToEquity"]) if data.get("DebtToEquity") else None,
            }

    async def search(self, query: str) -> list[dict]:
        params = {
            "function": "SYMBOL_SEARCH",
            "keywords": query,
            "apikey": self._api_key,
        }
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(BASE_URL, params=params)
            resp.raise_for_status()
            matches = resp.json().get("bestMatches", [])
            results = []
            for m in matches[:10]:
                results.append({
                    "ticker": m.get("1. symbol", ""),
                    "name": m.get("2. name", ""),
                    "exchange": m.get("4. region", ""),
                    "type": m.get("3. type", ""),
                })
            return results
