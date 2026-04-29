from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.watchlist import WatchlistItem


class WatchlistService:
    def __init__(self, db: AsyncSession):
        self._db = db

    async def list_all(self) -> list[WatchlistItem]:
        result = await self._db.execute(select(WatchlistItem))
        return list(result.scalars().all())

    async def get(self, item_id: int) -> Optional[WatchlistItem]:
        return await self._db.get(WatchlistItem, item_id)

    async def create(self, data: dict) -> WatchlistItem:
        item = WatchlistItem(**data)
        self._db.add(item)
        await self._db.commit()
        await self._db.refresh(item)
        return item

    async def delete(self, item_id: int) -> bool:
        item = await self._db.get(WatchlistItem, item_id)
        if not item:
            return False
        await self._db.delete(item)
        await self._db.commit()
        return True
