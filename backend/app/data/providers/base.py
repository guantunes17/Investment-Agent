from abc import ABC, abstractmethod


class BaseDataProvider(ABC):
    @abstractmethod
    async def get_quote(self, ticker: str) -> dict:
        ...

    @abstractmethod
    async def get_historical(self, ticker: str, period: str = "1mo") -> list[dict]:
        ...

    @abstractmethod
    async def get_fundamentals(self, ticker: str) -> dict:
        ...

    @abstractmethod
    async def search(self, query: str) -> list[dict]:
        ...

    async def get_news(self, ticker: str) -> list[dict]:
        return []
