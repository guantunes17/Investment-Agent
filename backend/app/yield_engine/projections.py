from datetime import date, timedelta
from decimal import Decimal

from app.models.fixed_income import FixedIncomePosition, RateType
from app.yield_engine.rates import RateService


class ProjectionService:
    def __init__(self, rate_service: RateService):
        self._rate_service = rate_service

    async def generate_projection(
        self,
        position: FixedIncomePosition,
        interval_days: int = 30,
    ) -> list[dict]:
        today = date.today()
        total_days = (position.maturity_date - position.purchase_date).days
        if total_days <= 0:
            return []

        invested = float(position.invested_amount)
        rate_value = float(position.rate_value)

        cdi_daily = await self._rate_service.get_latest_cdi()
        selic_daily = await self._rate_service.get_latest_selic()
        ipca_monthly = await self._rate_service.get_latest_ipca()

        projections = []
        current_date = position.purchase_date
        while current_date <= position.maturity_date:
            days_from_start = (current_date - position.purchase_date).days
            value = self._compute_value_at_day(
                invested, rate_value, position.rate_type,
                days_from_start, cdi_daily, selic_daily, ipca_monthly,
            )
            projections.append({
                "date": current_date.isoformat(),
                "value": round(value, 2),
                "days": days_from_start,
                "is_past": current_date <= today,
            })
            current_date += timedelta(days=interval_days)

        if projections[-1]["date"] != position.maturity_date.isoformat():
            days_from_start = total_days
            value = self._compute_value_at_day(
                invested, rate_value, position.rate_type,
                days_from_start, cdi_daily, selic_daily, ipca_monthly,
            )
            projections.append({
                "date": position.maturity_date.isoformat(),
                "value": round(value, 2),
                "days": days_from_start,
                "is_past": position.maturity_date <= today,
            })

        return projections

    async def compare_scenarios(
        self,
        invested_amount: float,
        months: int,
        scenarios: list[dict],
    ) -> list[dict]:
        cdi_daily = await self._rate_service.get_latest_cdi()
        selic_daily = await self._rate_service.get_latest_selic()
        ipca_monthly = await self._rate_service.get_latest_ipca()

        results = []
        days = int(months * 30.44)

        for scenario in scenarios:
            rate_type = scenario["rate_type"]
            rate_value = scenario["rate_value"]
            name = scenario.get("name", f"{rate_type} {rate_value}")

            final_value = self._compute_value_at_day(
                invested_amount, rate_value, rate_type,
                days, cdi_daily, selic_daily, ipca_monthly,
            )
            gross_return = final_value - invested_amount
            annual_rate = ((final_value / invested_amount) ** (365 / max(days, 1)) - 1) * 100

            results.append({
                "name": name,
                "rate_type": rate_type,
                "rate_value": rate_value,
                "final_value": round(final_value, 2),
                "gross_return": round(gross_return, 2),
                "annual_rate": round(annual_rate, 2),
            })

        return results

    def _compute_value_at_day(
        self,
        invested: float,
        rate_value: float,
        rate_type: str,
        days: int,
        cdi_daily: float,
        selic_daily: float,
        ipca_monthly: float,
    ) -> float:
        business_days = int(days * 252 / 365)

        if rate_type == RateType.PRE or rate_type == "PRE":
            daily_rate = (1 + rate_value / 100) ** (1 / 252) - 1
            return invested * (1 + daily_rate) ** business_days
        elif rate_type == RateType.PCT_CDI or rate_type == "PCT_CDI":
            effective_daily = (cdi_daily / 100) * (rate_value / 100)
            return invested * (1 + effective_daily) ** business_days
        elif rate_type == RateType.CDI_PLUS or rate_type == "CDI_PLUS":
            daily_spread = (1 + rate_value / 100) ** (1 / 252) - 1
            effective_daily = cdi_daily / 100 + daily_spread
            return invested * (1 + effective_daily) ** business_days
        elif rate_type == RateType.IPCA_PLUS or rate_type == "IPCA_PLUS":
            months = days / 30.44
            ipca_factor = (1 + ipca_monthly / 100) ** months
            fixed_factor = (1 + rate_value / 100) ** (days / 365)
            return invested * ipca_factor * fixed_factor
        elif rate_type == RateType.SELIC_PLUS or rate_type == "SELIC_PLUS":
            daily_spread = (1 + rate_value / 100) ** (1 / 252) - 1
            effective_daily = selic_daily / 100 + daily_spread
            return invested * (1 + effective_daily) ** business_days
        else:
            return invested
