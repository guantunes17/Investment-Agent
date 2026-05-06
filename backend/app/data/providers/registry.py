from app.data.providers.yahoo import YahooProvider
from app.data.providers.brapi import BrapiProvider
from app.data.providers.alpha_vantage import AlphaVantageProvider
from app.data.providers.bcb import BCBProvider
from app.data.providers.base import BaseDataProvider

BR_SUFFIXES = (".SA", "11", "3", "4", "5", "6")


class DataProviderRegistry:
    def __init__(self):
        self._yahoo = YahooProvider()
        self._brapi = BrapiProvider()
        self._alpha_vantage = AlphaVantageProvider()
        self._bcb = BCBProvider()

    def _is_brazilian(self, ticker: str) -> bool:
        if ticker.upper().endswith(".SA"):
            return True
        clean = ticker.replace(".SA", "").upper()
        if clean[-2:].isdigit() and len(clean) >= 5:
            return True
        return False

    def get_stock_provider(self, ticker: str) -> BaseDataProvider:
        if self._is_brazilian(ticker):
            return self._brapi
        return self._yahoo

    def get_bcb_provider(self) -> BCBProvider:
        return self._bcb

    def get_fundamentals_provider(self, ticker: str) -> BaseDataProvider:
        if self._is_brazilian(ticker):
            return self._brapi
        return self._alpha_vantage

    async def get_quote(self, asset_type: str, identifier: str) -> dict:
        provider = self.get_stock_provider(identifier)
        try:
            quote = await provider.get_quote(identifier)
            if quote and float(quote.get("price", 0) or 0) > 0:
                return quote
        except Exception:
            pass

        # Fallback chain: if BR first choice failed, try Yahoo; if non-BR failed, try BRAPI.
        alt = self._yahoo if provider is self._brapi else self._brapi
        return await alt.get_quote(identifier)

    async def get_historical(self, asset_type: str, identifier: str, period: str = "1mo") -> list[dict]:
        provider = self.get_stock_provider(identifier)
        return await provider.get_historical(identifier, period)

    async def get_fundamentals(self, identifier: str) -> dict:
        provider = self.get_fundamentals_provider(identifier)
        return await provider.get_fundamentals(identifier)
