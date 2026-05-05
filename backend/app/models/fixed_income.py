import enum
from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class FixedIncomeSubtype(str, enum.Enum):
    CDB = "CDB"
    LCI = "LCI"
    LCA = "LCA"
    TESOURO_SELIC = "TESOURO_SELIC"
    TESOURO_IPCA = "TESOURO_IPCA"
    TESOURO_PRE = "TESOURO_PRE"
    INFRA = "INFRA"


class RateType(str, enum.Enum):
    PCT_CDI = "PCT_CDI"
    CDI_PLUS = "CDI_PLUS"
    IPCA_PLUS = "IPCA_PLUS"
    PRE = "PRE"
    SELIC_PLUS = "SELIC_PLUS"


class CDIIndexMode(str, enum.Enum):
    """How % of CDI is defined — fixed rate or a min/max band (e.g. 'até 113% do CDI')."""

    FIXED = "FIXED"
    RANGE = "RANGE"


class FixedIncomePosition(TimestampMixin, Base):
    __tablename__ = "fixed_income_positions"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    issuer: Mapped[str] = mapped_column(String(200))
    asset_subtype: Mapped[FixedIncomeSubtype] = mapped_column(String(20))
    invested_amount: Mapped[Decimal] = mapped_column()
    purchase_date: Mapped[date] = mapped_column()
    # None = open-ended / daily liquidity (no fixed maturity in the app)
    maturity_date: Mapped[Optional[date]] = mapped_column(nullable=True, default=None)
    rate_type: Mapped[RateType] = mapped_column(String(20))
    rate_value: Mapped[Decimal] = mapped_column()
    # When rate_type is PCT_CDI and cdi_index_mode is RANGE, ceiling % of CDI (e.g. 113)
    rate_ceiling_value: Mapped[Optional[Decimal]] = mapped_column(nullable=True, default=None)
    cdi_index_mode: Mapped[CDIIndexMode] = mapped_column(String(20), default=CDIIndexMode.FIXED)
    # Optional explicit multiplier within the band for projections (e.g. 105 between 100–113)
    projection_cdi_percent: Mapped[Optional[Decimal]] = mapped_column(nullable=True, default=None)
    current_estimated_value: Mapped[Optional[Decimal]] = mapped_column(nullable=True, default=None)
    # User-reported balance from bank/broker (never overwritten by the scheduler)
    reported_position_value: Mapped[Optional[Decimal]] = mapped_column(nullable=True, default=None)
    is_tax_exempt: Mapped[bool] = mapped_column(default=False)
