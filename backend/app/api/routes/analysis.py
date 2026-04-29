from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_redis
from app.api.schemas import AnalysisResponse, AnalysisTriggerRequest, RatesResponse
from app.data.cache import CacheService
from app.data.providers.bcb import BCBProvider
from app.models.analysis import AnalysisResult
from app.yield_engine.rates import RateService

router = APIRouter()


@router.get("/rates", response_model=RatesResponse)
async def get_current_rates():
    from redis.asyncio import Redis
    redis = await get_redis()
    cache = CacheService(redis)
    bcb = BCBProvider()
    rate_service = RateService(bcb, cache)
    rates = await rate_service.get_all_rates()
    return RatesResponse(**rates)


@router.get("/{asset_type}/{identifier}", response_model=AnalysisResponse)
async def get_latest_analysis(
    asset_type: str,
    identifier: str,
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(AnalysisResult)
        .where(AnalysisResult.asset_type == asset_type)
        .where(AnalysisResult.asset_identifier == identifier)
        .order_by(AnalysisResult.created_at.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="No analysis found for this asset")
    return AnalysisResponse.model_validate(analysis)


@router.post("/{asset_type}/{identifier}", response_model=AnalysisResponse)
async def trigger_analysis(
    asset_type: str,
    identifier: str,
    request: AnalysisTriggerRequest = AnalysisTriggerRequest(),
    db: AsyncSession = Depends(get_db),
):
    from app.agent.core import AgentService
    agent = AgentService()
    result = await agent.analyze_asset(asset_type, identifier)

    analysis = AnalysisResult(
        asset_identifier=identifier,
        asset_type=asset_type,
        analysis_type=request.analysis_type,
        result_json=result,
        recommendation=result.get("recommendation", "HOLD"),
        confidence=result.get("confidence"),
    )
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)
    return AnalysisResponse.model_validate(analysis)
