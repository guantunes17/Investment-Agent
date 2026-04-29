from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.api.schemas import ReportResponse, ReportGenerateRequest
from app.models.report import Report

router = APIRouter()


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
