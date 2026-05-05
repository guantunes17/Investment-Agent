"""Computed fields for portfolio API responses (quotes, yield, statement overrides)."""

from datetime import date
from decimal import Decimal

from redis.asyncio import Redis

from app.data.cache import CacheService
from app.data.providers.bcb import BCBProvider
from app.data.providers.registry import DataProviderRegistry
from app.models.fixed_income import FixedIncomePosition
from app.models.stock_position import StockPosition
from app.yield_engine.calculator import YieldCalculator
from app.yield_engine.rates import RateService


async def build_yield_calculator(redis: Redis) -> YieldCalculator:
    cache = CacheService(redis)
    rate_service = RateService(BCBProvider(), cache)
    return YieldCalculator(rate_service)


async def enrich_stock_response(stock: StockPosition, registry: DataProviderRegistry) -> dict:
    qty = float(stock.quantity)
    cost = qty * float(stock.avg_price)
    quote_px = float(stock.avg_price)
    try:
        q = await registry.get_quote("stock", stock.ticker)
        quote_px = float(q.get("price", quote_px))
    except Exception:
        pass
    market_total = qty * quote_px
    if stock.reported_position_value is not None:
        effective_total = float(stock.reported_position_value)
    else:
        effective_total = market_total
    implied_px = effective_total / qty if qty else quote_px
    pnl = effective_total - cost
    pnl_pct = (pnl / cost * 100) if cost > 0 else 0.0

    return {
        "id": stock.id,
        "ticker": stock.ticker,
        "name": stock.name,
        "exchange": stock.exchange,
        "asset_subtype": getattr(stock.asset_subtype, "value", str(stock.asset_subtype)),
        "quantity": stock.quantity,
        "avg_price": stock.avg_price,
        "reported_position_value": stock.reported_position_value,
        "created_at": stock.created_at,
        "updated_at": stock.updated_at,
        "current_price": round(implied_px, 6),
        "profit_loss": round(pnl, 2),
        "profit_loss_pct": round(pnl_pct, 4),
    }


async def enrich_fixed_income_response(
    fi: FixedIncomePosition,
    calculator: YieldCalculator,
) -> dict:
    est = fi.current_estimated_value
    if est is None:
        est = await calculator.calculate_current_value(fi)
    est_f = float(est)

    if fi.reported_position_value is not None:
        eff = float(fi.reported_position_value)
    else:
        eff = est_f

    invested = float(fi.invested_amount)
    gross_dec = Decimal(str(round(eff - invested, 2)))
    tax_info = calculator.calculate_tax(fi, gross_dec)
    net_profit = tax_info["net_profit"]
    net_f = float(net_profit)

    if fi.maturity_date is not None:
        days_left: int | None = (fi.maturity_date - date.today()).days
    else:
        days_left = None

    return {
        "id": fi.id,
        "name": fi.name,
        "issuer": fi.issuer,
        "asset_subtype": getattr(fi.asset_subtype, "value", str(fi.asset_subtype)),
        "invested_amount": fi.invested_amount,
        "purchase_date": fi.purchase_date,
        "maturity_date": fi.maturity_date,
        "rate_type": getattr(fi.rate_type, "value", str(fi.rate_type)),
        "rate_value": fi.rate_value,
        "rate_ceiling_value": fi.rate_ceiling_value,
        "cdi_index_mode": getattr(fi.cdi_index_mode, "value", str(fi.cdi_index_mode)),
        "projection_cdi_percent": fi.projection_cdi_percent,
        "current_estimated_value": Decimal(str(round(est_f, 2))),
        "reported_position_value": fi.reported_position_value,
        "is_tax_exempt": fi.is_tax_exempt,
        "created_at": fi.created_at,
        "updated_at": fi.updated_at,
        "days_to_maturity": days_left,
        "gross_profit": float(gross_dec),
        "net_profit": round(net_f, 2),
    }
