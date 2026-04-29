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


class FixedIncomePosition(TimestampMixin, Base):
    __tablename__ = "fixed_income_positions"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    issuer: Mapped[str] = mapped_column(String(200))
    asset_subtype: Mapped[FixedIncomeSubtype] = mapped_column(String(20))
    invested_amount: Mapped[Decimal] = mapped_column()
    purchase_date: Mapped[date] = mapped_column()
    maturity_date: Mapped[date] = mapped_column()
    rate_type: Mapped[RateType] = mapped_column(String(20))
    rate_value: Mapped[Decimal] = mapped_column()
    current_estimated_value: Mapped[Optional[Decimal]] = mapped_column(nullable=True, default=None)
    is_tax_exempt: Mapped[bool] = mapped_column(default=False)
