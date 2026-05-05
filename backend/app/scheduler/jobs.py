import logging
from datetime import date, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select

from app.api.deps import async_session, get_redis
from app.data.cache import CacheService
from app.data.providers.bcb import BCBProvider
from app.models.fixed_income import FixedIncomePosition
from app.yield_engine.calculator import YieldCalculator
from app.yield_engine.rates import RateService

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


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


def setup_scheduler():
    """Configure and return the scheduler with all jobs.

    Only zero-cost internal jobs run on a schedule:
    - BCB rates: free public API, once daily
    - Fixed-income recalc: internal math, no external calls
    - Maturity alerts: internal DB check

    Stock/FII quotes are fetched on-demand when the user opens the app.
    """
    scheduler.add_job(
        fetch_bcb_rates,
        CronTrigger(hour=12, minute=0),  # 09:00 BRT = 12:00 UTC
        id="fetch_bcb_rates",
        replace_existing=True,
    )

    scheduler.add_job(
        recalculate_fixed_income,
        CronTrigger(hour=12, minute=30),
        id="recalculate_fixed_income",
        replace_existing=True,
    )

    scheduler.add_job(
        check_maturity_alerts,
        CronTrigger(hour=13, minute=0),  # 10:00 BRT
        id="check_maturity_alerts",
        replace_existing=True,
    )

    return scheduler
