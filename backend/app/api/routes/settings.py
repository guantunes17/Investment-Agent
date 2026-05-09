import logging
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.models.settings import UserSettings

logger = logging.getLogger(__name__)

router = APIRouter()

_DEFAULT_NOTIFICATION_PREFS: dict[str, Any] = {
    "in_app_notifications": True,
    "notify_on_recommendation_change": True,
    "notify_on_rate_change": True,
    "price_alert_threshold": 5.0,
    "maturity_alert_days": 30,
}


async def _get_settings_value(key: str, db: AsyncSession) -> dict:
    stmt = select(UserSettings).where(UserSettings.key == key)
    result = await db.execute(stmt)
    row = result.scalar_one_or_none()
    return dict(row.value_json) if row else {}


async def _upsert_settings(key: str, value: dict, db: AsyncSession) -> None:
    stmt = select(UserSettings).where(UserSettings.key == key)
    result = await db.execute(stmt)
    row = result.scalar_one_or_none()
    if row:
        row.value_json = value
    else:
        db.add(UserSettings(key=key, value_json=value))
    await db.commit()


@router.get("/notifications")
async def get_notification_settings(db: AsyncSession = Depends(get_db)):
    stored = await _get_settings_value("notification_preferences", db)
    return {**_DEFAULT_NOTIFICATION_PREFS, **stored}


@router.put("/notifications")
async def update_notification_settings(
    prefs: dict[str, Any],
    db: AsyncSession = Depends(get_db),
):
    await _upsert_settings("notification_preferences", prefs, db)
    logger.info("Notification preferences updated")
    stored = await _get_settings_value("notification_preferences", db)
    return {**_DEFAULT_NOTIFICATION_PREFS, **stored}
