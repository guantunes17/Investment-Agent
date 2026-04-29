import asyncio
from concurrent.futures import ThreadPoolExecutor

import yfinance as yf

from app.data.providers.base import BaseDataProvider

_executor = ThreadPoolExecutor(max_workers=4)


class YahooProvider(BaseDataProvider):
    async def get_quote(self, ticker: str) -> dict:
        def _fetch():
            t = yf.Ticker(ticker)
            info = t.info
            price = info.get("currentPrice") or info.get("regularMarketPrice", 0)
            prev_close = info.get("previousClose", price)
            change = price - prev_close
            change_pct = (change / prev_close * 100) if prev_close else 0
            return {
                "ticker": ticker,
                "price": price,
                "change": round(change, 2),
                "change_pct": round(change_pct, 2),
                "volume": info.get("volume", 0),
                "market_cap": info.get("marketCap", 0),
            }

        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(_executor, _fetch)

    async def get_historical(self, ticker: str, period: str = "1mo") -> list[dict]:
        def _fetch():
            t = yf.Ticker(ticker)
            df = t.history(period=period)
            records = []
            for idx, row in df.iterrows():
                records.append({
                    "date": idx.isoformat(),
                    "open": round(float(row["Open"]), 4),
                    "high": round(float(row["High"]), 4),
                    "low": round(float(row["Low"]), 4),
                    "close": round(float(row["Close"]), 4),
                    "volume": int(row["Volume"]),
                })
            return records

        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(_executor, _fetch)

    async def get_fundamentals(self, ticker: str) -> dict:
        def _fetch():
            t = yf.Ticker(ticker)
            info = t.info
            return {
                "pe_ratio": info.get("trailingPE"),
                "eps": info.get("trailingEps"),
                "dividend_yield": info.get("dividendYield"),
                "revenue": info.get("totalRevenue"),
                "market_cap": info.get("marketCap"),
                "debt_to_equity": info.get("debtToEquity"),
            }

        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(_executor, _fetch)

    async def search(self, query: str) -> list[dict]:
        def _fetch():
            results = []
            search_result = yf.Ticker(query)
            info = search_result.info
            if info.get("symbol"):
                results.append({
                    "ticker": info["symbol"],
                    "name": info.get("longName", info.get("shortName", "")),
                    "exchange": info.get("exchange", ""),
                    "type": info.get("quoteType", ""),
                })
            return results

        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(_executor, _fetch)
