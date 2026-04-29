from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class MarketSnapshot(Base):
    __tablename__ = "market_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True)
    identifier: Mapped[str] = mapped_column(String(100), index=True)
    asset_type: Mapped[str] = mapped_column(String(20))
    timestamp: Mapped[datetime] = mapped_column(index=True)
    open: Mapped[Optional[Decimal]] = mapped_column(nullable=True)
    high: Mapped[Optional[Decimal]] = mapped_column(nullable=True)
    low: Mapped[Optional[Decimal]] = mapped_column(nullable=True)
    close: Mapped[Decimal] = mapped_column()
    volume: Mapped[Optional[Decimal]] = mapped_column(nullable=True)


class BCBRateHistory(Base):
    __tablename__ = "bcb_rate_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    rate_type: Mapped[str] = mapped_column(String(20))
    rate_date: Mapped[date] = mapped_column(index=True)
    value: Mapped[Decimal] = mapped_column()
