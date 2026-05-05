from decimal import Decimal
from typing import Optional

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.stock_position import StockPosition
from app.models.fixed_income import (
    CDIIndexMode,
    FixedIncomePosition,
    FixedIncomeSubtype,
    RateType,
)
from app.data.providers.registry import DataProviderRegistry
from app.yield_engine.calculator import YieldCalculator


class PortfolioService:
    def __init__(
        self,
        db: AsyncSession,
        registry: Optional[DataProviderRegistry] = None,
        yield_calculator: Optional[YieldCalculator] = None,
    ):
        self._db = db
        self._registry = registry or DataProviderRegistry()
        self._yield_calculator = yield_calculator

    # --- Stocks ---

    async def list_stocks(self) -> list[StockPosition]:
        result = await self._db.execute(select(StockPosition))
        return list(result.scalars().all())

    async def get_stock(self, stock_id: int) -> Optional[StockPosition]:
        return await self._db.get(StockPosition, stock_id)

    async def create_stock(self, data: dict) -> StockPosition:
        position = StockPosition(**data)
        self._db.add(position)
        await self._db.commit()
        await self._db.refresh(position)
        return position

    async def update_stock(self, stock_id: int, data: dict) -> Optional[StockPosition]:
        position = await self._db.get(StockPosition, stock_id)
        if not position:
            return None
        for key, value in data.items():
            setattr(position, key, value)
        await self._db.commit()
        await self._db.refresh(position)
        return position

    async def delete_stock(self, stock_id: int) -> bool:
        position = await self._db.get(StockPosition, stock_id)
        if not position:
            return False
        await self._db.delete(position)
        await self._db.commit()
        return True

    # --- Fixed Income ---

    async def list_fixed_income(self) -> list[FixedIncomePosition]:
        result = await self._db.execute(select(FixedIncomePosition))
        return list(result.scalars().all())

    async def get_fixed_income(self, fi_id: int) -> Optional[FixedIncomePosition]:
        return await self._db.get(FixedIncomePosition, fi_id)

    async def create_fixed_income(self, data: dict) -> FixedIncomePosition:
        payload = dict(data)
        payload["rate_type"] = RateType(str(payload["rate_type"]))
        payload["asset_subtype"] = FixedIncomeSubtype(str(payload["asset_subtype"]))
        payload["cdi_index_mode"] = CDIIndexMode(str(payload.get("cdi_index_mode", "FIXED")))
        position = FixedIncomePosition(**payload)
        self._db.add(position)
        await self._db.commit()
        await self._db.refresh(position)
        return position

    async def update_fixed_income(self, fi_id: int, data: dict) -> Optional[FixedIncomePosition]:
        position = await self._db.get(FixedIncomePosition, fi_id)
        if not position:
            return None
        for key, value in data.items():
            if key == "rate_type" and value is not None:
                value = RateType(str(value))
            elif key == "asset_subtype" and value is not None:
                value = FixedIncomeSubtype(str(value))
            elif key == "cdi_index_mode" and value is not None:
                value = CDIIndexMode(str(value))
            setattr(position, key, value)
        await self._db.commit()
        await self._db.refresh(position)
        return position

    async def delete_fixed_income(self, fi_id: int) -> bool:
        position = await self._db.get(FixedIncomePosition, fi_id)
        if not position:
            return False
        await self._db.delete(position)
        await self._db.commit()
        return True

    # --- Summary ---

    async def get_summary(self) -> dict:
        stocks = await self.list_stocks()
        fixed_income = await self.list_fixed_income()

        stock_total_invested = sum(
            float(s.quantity * s.avg_price) for s in stocks
        )
        stock_total_value = 0.0
        for s in stocks:
            qty = float(s.quantity)
            px = float(s.avg_price)
            try:
                quote = await self._registry.get_quote("stock", s.ticker)
                px = float(quote.get("price", px))
            except Exception:
                pass
            market = qty * px
            eff = float(s.reported_position_value) if s.reported_position_value is not None else market
            stock_total_value += eff

        fi_total_invested = sum(float(fi.invested_amount) for fi in fixed_income)
        fi_total_value = 0.0
        for fi in fixed_income:
            base = float(fi.current_estimated_value or fi.invested_amount)
            eff = (
                float(fi.reported_position_value)
                if fi.reported_position_value is not None
                else base
            )
            fi_total_value += eff

        total_invested = stock_total_invested + fi_total_invested
        total_value = stock_total_value + fi_total_value
        total_pl = total_value - total_invested
        total_pl_pct = (total_pl / total_invested * 100) if total_invested > 0 else 0

        breakdown = []
        for label, invested, value, count in [
            ("stocks", stock_total_invested, stock_total_value, len(stocks)),
            ("fixed_income", fi_total_invested, fi_total_value, len(fixed_income)),
        ]:
            pl = value - invested
            pl_pct = (pl / invested * 100) if invested > 0 else 0
            alloc = (value / total_value * 100) if total_value > 0 else 0
            breakdown.append({
                "asset_class": label,
                "total_value": round(value, 2),
                "total_invested": round(invested, 2),
                "profit_loss": round(pl, 2),
                "profit_loss_pct": round(pl_pct, 2),
                "count": count,
                "allocation_pct": round(alloc, 2),
            })

        return {
            "total_net_worth": round(total_value, 2),
            "total_invested": round(total_invested, 2),
            "total_profit_loss": round(total_pl, 2),
            "total_profit_loss_pct": round(total_pl_pct, 2),
            "breakdown": breakdown,
        }
