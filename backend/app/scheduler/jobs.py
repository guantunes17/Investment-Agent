import logging
from datetime import date, datetime, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from zoneinfo import ZoneInfo

from app.api.deps import async_session, get_redis
from app.config import get_settings
from app.data.cache import CacheService
from app.data.providers.bcb import BCBProvider
from app.models.fixed_income import FixedIncomePosition
from app.models.report import Report
from app.yield_engine.calculator import YieldCalculator
from app.yield_engine.rates import RateService

logger = logging.getLogger(__name__)

_settings = get_settings()
_tz = ZoneInfo(_settings.scheduler_timezone)
scheduler = AsyncIOScheduler(timezone=_tz)
REPORT_DAILY_ENABLED_KEY = "scheduler:reports:daily_enabled"
REPORT_WEEKLY_ENABLED_KEY = "scheduler:reports:weekly_enabled"
REPORT_WEEKLY_DAY_KEY = "scheduler:reports:weekly_day"
_WDAY_TOKENS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")


async def _configured_weekly_report_day() -> str:
    """Weekday token mon..sun; Redis override or env WEEKLY_REPORT_DAY."""
    allowed = set(_WDAY_TOKENS)
    try:
        redis = await get_redis()
        raw = await redis.get(REPORT_WEEKLY_DAY_KEY)
        if raw:
            low = raw.strip().lower()[:3]
            if low in allowed:
                return low
    except Exception:
        pass
    d = str(_settings.weekly_report_day).strip().lower()[:3]
    return d if d in allowed else "mon"


async def _is_report_schedule_enabled(kind: str) -> bool:
    key = REPORT_DAILY_ENABLED_KEY if kind == "daily" else REPORT_WEEKLY_ENABLED_KEY
    try:
        redis = await get_redis()
        value = await redis.get(key)
        return value != "false"
    except Exception:
        # Fail-open so scheduler keeps operating even if Redis read fails transiently.
        return True


async def fetch_bcb_rates():
    """Fetch BCB rates daily at 09:00 BRT (12:00 UTC)."""
    logger.info("Fetching BCB rates...")
    try:
        redis = await get_redis()
        cache = CacheService(redis)
        bcb = BCBProvider()
        rate_service = RateService(bcb, cache)

        rates = await rate_service.get_all_rates()
        logger.info(f"BCB rates updated: CDI={rates['cdi']}, Selic={rates['selic']}, IPCA={rates['ipca']}")
    except Exception as e:
        logger.error(f"Error in fetch_bcb_rates: {e}")


async def recalculate_fixed_income():
    """Recalculate current values for all fixed-income positions daily."""
    logger.info("Recalculating fixed income positions...")
    try:
        redis = await get_redis()
        cache = CacheService(redis)
        bcb = BCBProvider()
        rate_service = RateService(bcb, cache)
        calculator = YieldCalculator(rate_service)

        async with async_session() as db:
            result = await db.execute(select(FixedIncomePosition))
            positions = result.scalars().all()

            for pos in positions:
                try:
                    new_value = await calculator.calculate_current_value(pos)
                    pos.current_estimated_value = new_value
                except Exception as e:
                    logger.warning(f"Failed to recalculate position {pos.id}: {e}")
                    continue

            await db.commit()

        logger.info(f"Recalculated {len(positions)} fixed-income positions")
    except Exception as e:
        logger.error(f"Error in recalculate_fixed_income: {e}")


async def check_maturity_alerts():
    """Check for positions maturing within 7/30/60 days and create notifications."""
    logger.info("Checking maturity alerts...")
    try:
        from app.services.notification import NotificationService

        async with async_session() as db:
            today = date.today()
            thresholds = [
                (7, "urgent"),
                (30, "warning"),
                (60, "info"),
            ]

            for days, severity in thresholds:
                cutoff = today + timedelta(days=days)
                result = await db.execute(
                    select(FixedIncomePosition).where(
                        FixedIncomePosition.maturity_date.is_not(None),
                        FixedIncomePosition.maturity_date <= cutoff,
                        FixedIncomePosition.maturity_date > today,
                    )
                )
                positions = result.scalars().all()

                notif_service = NotificationService(db)
                for pos in positions:
                    days_left = (pos.maturity_date - today).days
                    if days_left <= days:
                        await notif_service.create_notification(
                            title=f"Maturity Alert: {pos.name}",
                            body=f"{pos.name} ({pos.issuer}) matures in {days_left} days on {pos.maturity_date.isoformat()}. Invested: R${pos.invested_amount:,.2f}",
                            notification_type=f"maturity_{severity}",
                            metadata={
                                "position_id": pos.id,
                                "days_to_maturity": days_left,
                                "maturity_date": pos.maturity_date.isoformat(),
                            },
                        )

        logger.info("Maturity alerts checked")
    except Exception as e:
        logger.error(f"Error in check_maturity_alerts: {e}")


async def generate_daily_report_job():
    """Generate one daily report per local configured day."""
    logger.info("Generating scheduled daily report...")
    try:
        if not await _is_report_schedule_enabled("daily"):
            logger.info("Daily scheduled report is disabled; skipping")
            return
        from app.agent.report_gen import ReportGenerator

        async with async_session() as db:
            today = datetime.now(_tz).date()
            period_key = today.isoformat()
            existing = await db.execute(
                select(Report).where(
                    Report.report_type == "daily",
                    Report.period_key == period_key,
                )
            )
            if existing.scalars().first():
                logger.info("Daily report already exists for today; skipping")
                return

            generator = ReportGenerator(db)
            content = await generator.generate_daily_report()
            report = Report(
                report_type="daily",
                period_key=period_key,
                title=content.get("title", f"Relatório Diário — {today.isoformat()}"),
                content_json=content,
            )
            db.add(report)
            try:
                await db.commit()
            except IntegrityError:
                await db.rollback()
                logger.info("Daily report already created by another runner; skipping")
                return
        logger.info("Scheduled daily report generated")
    except Exception as e:
        logger.error(f"Error in scheduled daily report generation: {e}")


async def generate_weekly_report_job():
    """Generate one weekly report per ISO week on the configured weekday."""
    logger.info("Generating scheduled weekly report...")
    try:
        if not await _is_report_schedule_enabled("weekly"):
            logger.info("Weekly scheduled report is disabled; skipping")
            return
        now = datetime.now(_tz)
        today_wd = _WDAY_TOKENS[now.weekday()]
        target_wd = await _configured_weekly_report_day()
        if today_wd != target_wd:
            logger.info(
                "Weekly report weekday is %s (today is %s); skipping",
                target_wd,
                today_wd,
            )
            return
        from app.agent.report_gen import ReportGenerator

        async with async_session() as db:
            # One weekly report per ISO week.
            iso = now.isocalendar()
            period_key = f"{iso.year}-W{iso.week:02d}"
            existing = await db.execute(
                select(Report).where(
                    Report.report_type == "weekly",
                    Report.period_key == period_key,
                )
            )
            if existing.scalars().first():
                logger.info("Weekly report already exists for this week; skipping")
                return

            generator = ReportGenerator(db)
            content = await generator.generate_weekly_report()
            report = Report(
                report_type="weekly",
                period_key=period_key,
                title=content.get("title", f"Relatório Semanal — {now.date().isoformat()}"),
                content_json=content,
            )
            db.add(report)
            try:
                await db.commit()
            except IntegrityError:
                await db.rollback()
                logger.info("Weekly report already created by another runner; skipping")
                return
        logger.info("Scheduled weekly report generated")
    except Exception as e:
        logger.error(f"Error in scheduled weekly report generation: {e}")


def setup_scheduler():
    """Configure and return the scheduler with all jobs.

    Only zero-cost internal jobs run on a schedule:
    - BCB rates: free public API, once daily
    - Fixed-income recalc: internal math, no external calls
    - Maturity alerts: internal DB check

    Stock/FII quotes are fetched on-demand when the user opens the app.
    """
    settings = get_settings()
    scheduler.add_job(
        fetch_bcb_rates,
        CronTrigger(hour=9, minute=0, timezone=_tz),
        id="fetch_bcb_rates",
        replace_existing=True,
    )

    scheduler.add_job(
        recalculate_fixed_income,
        CronTrigger(hour=9, minute=30, timezone=_tz),
        id="recalculate_fixed_income",
        replace_existing=True,
    )

    scheduler.add_job(
        check_maturity_alerts,
        CronTrigger(hour=10, minute=0, timezone=_tz),
        id="check_maturity_alerts",
        replace_existing=True,
    )

    # Report generation jobs (configured timezone, default BRT):
    # - Daily report at DAILY_REPORT_HOUR:DAILY_REPORT_MINUTE
    # - Weekly report at WEEKLY_REPORT_DAY WEEKLY_REPORT_HOUR:WEEKLY_REPORT_MINUTE
    scheduler.add_job(
        generate_daily_report_job,
        CronTrigger(
            hour=settings.daily_report_hour,
            minute=settings.daily_report_minute,
            timezone=_tz,
        ),
        id="generate_daily_report_job",
        replace_existing=True,
    )
    # Weekly job fires every day at the configured time; weekday is enforced
    # inside the job via Redis/env so the UI can change day without restarting.
    scheduler.add_job(
        generate_weekly_report_job,
        CronTrigger(
            hour=settings.weekly_report_hour,
            minute=settings.weekly_report_minute,
            timezone=_tz,
        ),
        id="generate_weekly_report_job",
        replace_existing=True,
    )

    return scheduler
