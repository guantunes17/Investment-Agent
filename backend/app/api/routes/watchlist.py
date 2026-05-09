import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.api.schemas import WatchlistItemCreate, WatchlistItemResponse, AnalysisResponse
from app.data.providers.registry import DataProviderRegistry
from app.services.watchlist import WatchlistService

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_service(db: AsyncSession = Depends(get_db)) -> WatchlistService:
    return WatchlistService(db)


async def _enrich_item(item, registry: DataProviderRegistry) -> dict:
    base = {
        "id": item.id,
        "asset_type": item.asset_type,
        "identifier": item.identifier,
        "name": item.name,
        "created_at": item.created_at,
        "current_price": None,
        "change": None,
        "change_pct": None,
        "price_history": [],
    }
    try:
        quote = await registry.get_quote(item.asset_type, item.identifier)
        base["current_price"] = quote.get("price")
        base["change"] = quote.get("change")
        base["change_pct"] = quote.get("change_pct")
        logger.info("Enriched watchlist item %s: price=%s", item.identifier, base["current_price"])
    except Exception as e:
        logger.warning("Failed to fetch quote for watchlist item %s: %s", item.identifier, e)
    return base


@router.get("/")
async def list_watchlist(
    service: WatchlistService = Depends(_get_service),
):
    items = await service.list_all()
    if not items:
        return []

    registry = DataProviderRegistry()
    tasks = [_enrich_item(item, registry) for item in items]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    enriched = []
    for r in results:
        if isinstance(r, Exception):
            logger.warning("Watchlist enrichment error: %s", r)
            continue
        enriched.append(r)
    return enriched


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


@router.get("/search")
async def search_assets(q: str = Query(..., min_length=1)):
    registry = DataProviderRegistry()
    try:
        results = await registry.get_stock_provider(q).search(q)
        return results
    except Exception as e:
        logger.warning("Search failed for query '%s': %s", q, e)
        return []


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
