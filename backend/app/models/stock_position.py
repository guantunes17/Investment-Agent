import enum
from decimal import Decimal

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class AssetSubtype(str, enum.Enum):
    STOCK = "STOCK"
    FII = "FII"


class StockPosition(TimestampMixin, Base):
    __tablename__ = "stock_positions"

    id: Mapped[int] = mapped_column(primary_key=True)
    ticker: Mapped[str] = mapped_column(String(20), index=True)
    name: Mapped[str] = mapped_column(String(200))
    exchange: Mapped[str] = mapped_column(String(50))
    asset_subtype: Mapped[AssetSubtype] = mapped_column(String(10))
    quantity: Mapped[Decimal] = mapped_column()
    avg_price: Mapped[Decimal] = mapped_column()
