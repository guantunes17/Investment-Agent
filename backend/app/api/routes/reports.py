from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis

from app.api.deps import get_db, get_redis
from app.api.schemas import (
    ReportResponse,
    ReportGenerateRequest,
    ReportSchedulerSettingsResponse,
    ReportSchedulerSettingsUpdate,
)
from app.config import get_settings
from app.models.report import Report

router = APIRouter()
REPORT_DAILY_ENABLED_KEY = "scheduler:reports:daily_enabled"
REPORT_WEEKLY_ENABLED_KEY = "scheduler:reports:weekly_enabled"
REPORT_WEEKLY_DAY_KEY = "scheduler:reports:weekly_day"


def _scheduler_settings_from_redis(daily: str | None, weekly: str | None, day: str | None):
    settings = get_settings()
    wday = (day or "").strip().lower()[:3] if day else ""
    allowed = {"mon", "tue", "wed", "thu", "fri", "sat", "sun"}
    if wday not in allowed:
        wday = str(settings.weekly_report_day).strip().lower()[:3]
    if wday not in allowed:
        wday = "mon"
    return ReportSchedulerSettingsResponse(
        daily_enabled=(daily != "false"),
        weekly_enabled=(weekly != "false"),
        weekly_day=wday,
        daily_hour=settings.daily_report_hour,
        daily_minute=settings.daily_report_minute,
        weekly_hour=settings.weekly_report_hour,
        weekly_minute=settings.weekly_report_minute,
        timezone=settings.scheduler_timezone,
    )


@router.get("/", response_model=list[ReportResponse])
async def list_reports(
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Report).order_by(Report.created_at.desc()).limit(limit)
    result = await db.execute(stmt)
    reports = result.scalars().all()
    return [ReportResponse.model_validate(r) for r in reports]


@router.get("/{report_id}", response_model=ReportResponse)
async def get_report(
    report_id: int,
    db: AsyncSession = Depends(get_db),
):
    report = await db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return ReportResponse.model_validate(report)


@router.post("/generate", response_model=ReportResponse, status_code=201)
async def generate_report(
    request: ReportGenerateRequest = ReportGenerateRequest(),
    db: AsyncSession = Depends(get_db),
):
    from app.agent.report_gen import ReportGenerator
    generator = ReportGenerator(db)

    if request.report_type == "weekly":
        content = await generator.generate_weekly_report()
    else:
        content = await generator.generate_daily_report()

    report = Report(
        report_type=request.report_type,
        title=content.get("title", f"{request.report_type.capitalize()} Report"),
        content_json=content,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return ReportResponse.model_validate(report)


@router.delete("/{report_id}", status_code=204)
async def delete_report(
    report_id: int,
    db: AsyncSession = Depends(get_db),
):
    report = await db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    await db.delete(report)
    await db.commit()


@router.get("/scheduler/settings", response_model=ReportSchedulerSettingsResponse)
async def get_scheduler_settings(
    redis: Redis = Depends(get_redis),
):
    daily = await redis.get(REPORT_DAILY_ENABLED_KEY)
    weekly = await redis.get(REPORT_WEEKLY_ENABLED_KEY)
    wday = await redis.get(REPORT_WEEKLY_DAY_KEY)
    return _scheduler_settings_from_redis(daily, weekly, wday)


@router.put("/scheduler/settings", response_model=ReportSchedulerSettingsResponse)
async def update_scheduler_settings(
    payload: ReportSchedulerSettingsUpdate,
    redis: Redis = Depends(get_redis),
):
    if payload.daily_enabled is not None:
        await redis.set(REPORT_DAILY_ENABLED_KEY, str(payload.daily_enabled).lower())
    if payload.weekly_enabled is not None:
        await redis.set(REPORT_WEEKLY_ENABLED_KEY, str(payload.weekly_enabled).lower())
    if payload.weekly_day is not None:
        await redis.set(REPORT_WEEKLY_DAY_KEY, payload.weekly_day)

    daily = await redis.get(REPORT_DAILY_ENABLED_KEY)
    weekly = await redis.get(REPORT_WEEKLY_ENABLED_KEY)
    wday = await redis.get(REPORT_WEEKLY_DAY_KEY)
    return _scheduler_settings_from_redis(daily, weekly, wday)
