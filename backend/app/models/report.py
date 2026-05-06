from datetime import datetime
from typing import Any

from sqlalchemy import JSON, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Report(Base):
    __tablename__ = "reports"
    __table_args__ = (
        UniqueConstraint("report_type", "period_key", name="uq_reports_type_period_key"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    report_type: Mapped[str] = mapped_column(String(20))
    # For scheduled reports idempotency (e.g., 2026-05-06 for daily, 2026-W19 for weekly)
    period_key: Mapped[str | None] = mapped_column(String(32), nullable=True, default=None)
    title: Mapped[str] = mapped_column(String(500))
    content_json: Mapped[dict[str, Any]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
