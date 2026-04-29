from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.api.schemas import WatchlistItemCreate, WatchlistItemResponse, AnalysisResponse
from app.services.watchlist import WatchlistService

router = APIRouter()


def _get_service(db: AsyncSession = Depends(get_db)) -> WatchlistService:
    return WatchlistService(db)


@router.get("/", response_model=list[WatchlistItemResponse])
async def list_watchlist(service: WatchlistService = Depends(_get_service)):
    items = await service.list_all()
    return [WatchlistItemResponse.model_validate(item) for item in items]


@router.post("/", response_model=WatchlistItemResponse, status_code=201)
async def add_watchlist_item(
    data: WatchlistItemCreate,
    service: WatchlistService = Depends(_get_service),
):
    item = await service.create(data.model_dump())
    return WatchlistItemResponse.model_validate(item)


@router.delete("/{item_id}", status_code=204)
async def remove_watchlist_item(
    item_id: int,
    service: WatchlistService = Depends(_get_service),
):
    deleted = await service.delete(item_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Watchlist item not found")


@router.get("/{item_id}/analysis")
async def get_watchlist_analysis(
    item_id: int,
    service: WatchlistService = Depends(_get_service),
    db: AsyncSession = Depends(get_db),
):
    item = await service.get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Watchlist item not found")

    from app.agent.core import AgentService
    agent = AgentService()
    result = await agent.analyze_asset(item.asset_type, item.identifier)
    return {"item": WatchlistItemResponse.model_validate(item), "analysis": result}
