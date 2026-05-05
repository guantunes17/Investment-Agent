from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import async_session
from app.data.cache import CacheService
from app.data.providers.bcb import BCBProvider
from app.models.fixed_income import FixedIncomePosition
from app.yield_engine.calculator import YieldCalculator
from app.yield_engine.projections import ProjectionService
from app.yield_engine.rates import RateService


async def _get_rate_service() -> RateService:
    from app.api.deps import get_redis
    redis = await get_redis()
    cache = CacheService(redis)
    bcb = BCBProvider()
    return RateService(bcb, cache)


async def _get_calculator() -> YieldCalculator:
    rate_service = await _get_rate_service()
    return YieldCalculator(rate_service)


async def get_fixed_income_summary() -> dict:
    async with async_session() as db:
        result = await db.execute(select(FixedIncomePosition))
        positions = result.scalars().all()

    calculator = await _get_calculator()
    summary_items = []
    total_invested = Decimal("0")
    total_current = Decimal("0")

    for pos in positions:
        current_value = await calculator.calculate_current_value(pos)
        gross_profit = current_value - pos.invested_amount
        tax_info = calculator.calculate_tax(pos, gross_profit)
        days_to_maturity = (
            None if pos.maturity_date is None
            else (pos.maturity_date - date.today()).days
        )

        total_invested += pos.invested_amount
        total_current += current_value

        summary_items.append({
            "id": pos.id,
            "name": pos.name,
            "issuer": pos.issuer,
            "asset_subtype": pos.asset_subtype,
            "invested_amount": float(pos.invested_amount),
            "current_value": float(current_value),
            "gross_profit": float(gross_profit),
            "net_profit": float(tax_info["net_profit"]),
            "rate_type": pos.rate_type,
            "rate_value": float(pos.rate_value),
            "days_to_maturity": days_to_maturity,
            "is_tax_exempt": pos.is_tax_exempt,
        })

    return {
        "positions": summary_items,
        "total_invested": float(total_invested),
        "total_current_value": float(total_current),
        "total_profit": float(total_current - total_invested),
        "count": len(summary_items),
    }


async def compare_yields(position_ids: list[int]) -> dict:
    async with async_session() as db:
        result = await db.execute(
            select(FixedIncomePosition).where(FixedIncomePosition.id.in_(position_ids))
        )
        positions = result.scalars().all()

    calculator = await _get_calculator()
    comparisons = []

    for pos in positions:
        annual_rate = await calculator.calculate_effective_annual_rate(pos)
        current_value = await calculator.calculate_current_value(pos)
        maturity_value = await calculator.project_to_maturity(pos)
        gross_profit = current_value - pos.invested_amount
        tax_info = calculator.calculate_tax(pos, gross_profit)

        comparisons.append({
            "id": pos.id,
            "name": pos.name,
            "rate_type": pos.rate_type,
            "rate_value": float(pos.rate_value),
            "effective_annual_rate": annual_rate,
            "current_value": float(current_value),
            "projected_maturity_value": float(maturity_value),
            "gross_profit": float(gross_profit),
            "net_profit": float(tax_info["net_profit"]),
            "is_tax_exempt": pos.is_tax_exempt,
            "days_to_maturity": (
                None if pos.maturity_date is None
                else (pos.maturity_date - date.today()).days
            ),
        })

    comparisons.sort(key=lambda x: x["effective_annual_rate"], reverse=True)
    return {"comparisons": comparisons}


async def check_maturities(days_ahead: int = 30) -> dict:
    async with async_session() as db:
        cutoff = date.today() + timedelta(days=days_ahead)
        result = await db.execute(
            select(FixedIncomePosition).where(
                FixedIncomePosition.maturity_date.is_not(None),
                FixedIncomePosition.maturity_date <= cutoff,
            )
        )
        positions = result.scalars().all()

    calculator = await _get_calculator()
    maturing = []

    for pos in positions:
        days_to_maturity = (pos.maturity_date - date.today()).days
        projected_value = await calculator.project_to_maturity(pos)
        gross_profit = projected_value - pos.invested_amount
        tax_info = calculator.calculate_tax(pos, gross_profit)

        maturing.append({
            "id": pos.id,
            "name": pos.name,
            "issuer": pos.issuer,
            "maturity_date": pos.maturity_date.isoformat(),
            "days_to_maturity": days_to_maturity,
            "invested_amount": float(pos.invested_amount),
            "projected_value": float(projected_value),
            "net_profit": float(tax_info["net_profit"]),
            "is_tax_exempt": pos.is_tax_exempt,
        })

    maturing.sort(key=lambda x: x["days_to_maturity"])
    return {"maturing_positions": maturing, "days_ahead": days_ahead}


async def simulate_reinvestment(
    amount: float,
    rate_type: str,
    rate_value: float,
    months: int,
) -> dict:
    rate_service = await _get_rate_service()
    projection_service = ProjectionService(rate_service)

    scenarios = [{"rate_type": rate_type, "rate_value": rate_value, "name": f"{rate_type} {rate_value}"}]
    results = await projection_service.compare_scenarios(amount, months, scenarios)

    if results:
        result = results[0]
        days = int(months * 30.44)
        gross_profit = Decimal(str(result["gross_return"]))

        from app.models.fixed_income import FixedIncomePosition
        dummy = FixedIncomePosition(
            name="simulation",
            issuer="simulation",
            asset_subtype="CDB",
            invested_amount=Decimal(str(amount)),
            purchase_date=date.today(),
            maturity_date=date.today() + timedelta(days=days),
            rate_type=rate_type,
            rate_value=Decimal(str(rate_value)),
            is_tax_exempt=(rate_type in ("LCI", "LCA")),
        )
        calculator = await _get_calculator()
        tax_info = calculator.calculate_tax(dummy, gross_profit)

        return {
            "invested": amount,
            "rate_type": rate_type,
            "rate_value": rate_value,
            "months": months,
            "final_value": result["final_value"],
            "gross_return": result["gross_return"],
            "net_return": float(tax_info["net_profit"]),
            "effective_annual_rate": result["annual_rate"],
            "tax_info": {
                "ir": float(tax_info["ir"]),
                "iof": float(tax_info["iof"]),
                "exempt": tax_info["exempt"],
            },
        }

    return {"error": "Could not compute simulation"}


async def get_current_rates() -> dict:
    rate_service = await _get_rate_service()
    return await rate_service.get_all_rates()
