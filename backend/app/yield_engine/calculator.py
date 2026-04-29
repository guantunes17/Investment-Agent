from datetime import date, timedelta
from decimal import Decimal

from app.models.fixed_income import FixedIncomePosition, RateType
from app.yield_engine.rates import RateService

IOF_TABLE = [
    96, 93, 90, 86, 83, 80, 76, 73, 70, 66,
    63, 60, 56, 53, 50, 46, 43, 40, 36, 33,
    30, 26, 23, 20, 16, 13, 10, 6, 3, 0,
]

IR_TABLE = [
    (180, Decimal("0.225")),
    (360, Decimal("0.200")),
    (720, Decimal("0.175")),
    (999999, Decimal("0.150")),
]


class YieldCalculator:
    def __init__(self, rate_service: RateService):
        self._rate_service = rate_service

    async def calculate_current_value(self, position: FixedIncomePosition) -> Decimal:
        today = date.today()
        days_held = (today - position.purchase_date).days
        if days_held <= 0:
            return position.invested_amount

        invested = float(position.invested_amount)
        rate_value = float(position.rate_value)

        if position.rate_type == RateType.PRE:
            daily_rate = (1 + rate_value / 100) ** (1 / 252) - 1
            current_value = invested * (1 + daily_rate) ** min(days_held, self._business_days(position.purchase_date, today))
        elif position.rate_type == RateType.PCT_CDI:
            cdi_daily = await self._rate_service.get_latest_cdi()
            effective_daily = (cdi_daily / 100) * (rate_value / 100)
            business_days = self._business_days(position.purchase_date, today)
            current_value = invested * (1 + effective_daily) ** business_days
        elif position.rate_type == RateType.CDI_PLUS:
            cdi_daily = await self._rate_service.get_latest_cdi()
            annual_spread = rate_value / 100
            daily_spread = (1 + annual_spread) ** (1 / 252) - 1
            effective_daily = cdi_daily / 100 + daily_spread
            business_days = self._business_days(position.purchase_date, today)
            current_value = invested * (1 + effective_daily) ** business_days
        elif position.rate_type == RateType.IPCA_PLUS:
            ipca_monthly = await self._rate_service.get_latest_ipca()
            months_held = days_held / 30.44
            ipca_factor = (1 + ipca_monthly / 100) ** months_held
            annual_fixed = rate_value / 100
            fixed_factor = (1 + annual_fixed) ** (days_held / 365)
            current_value = invested * ipca_factor * fixed_factor
        elif position.rate_type == RateType.SELIC_PLUS:
            selic_daily_rate = await self._rate_service.get_latest_selic()
            annual_spread = rate_value / 100
            daily_spread = (1 + annual_spread) ** (1 / 252) - 1
            effective_daily = selic_daily_rate / 100 + daily_spread
            business_days = self._business_days(position.purchase_date, today)
            current_value = invested * (1 + effective_daily) ** business_days
        else:
            current_value = invested

        return Decimal(str(round(current_value, 2)))

    async def project_to_maturity(self, position: FixedIncomePosition) -> Decimal:
        today = date.today()
        total_days = (position.maturity_date - position.purchase_date).days
        if total_days <= 0:
            return position.invested_amount

        invested = float(position.invested_amount)
        rate_value = float(position.rate_value)

        if position.rate_type == RateType.PRE:
            business_days = self._business_days(position.purchase_date, position.maturity_date)
            daily_rate = (1 + rate_value / 100) ** (1 / 252) - 1
            final_value = invested * (1 + daily_rate) ** business_days
        elif position.rate_type == RateType.PCT_CDI:
            cdi_daily = await self._rate_service.get_latest_cdi()
            effective_daily = (cdi_daily / 100) * (rate_value / 100)
            business_days = self._business_days(position.purchase_date, position.maturity_date)
            final_value = invested * (1 + effective_daily) ** business_days
        elif position.rate_type == RateType.CDI_PLUS:
            cdi_daily = await self._rate_service.get_latest_cdi()
            annual_spread = rate_value / 100
            daily_spread = (1 + annual_spread) ** (1 / 252) - 1
            effective_daily = cdi_daily / 100 + daily_spread
            business_days = self._business_days(position.purchase_date, position.maturity_date)
            final_value = invested * (1 + effective_daily) ** business_days
        elif position.rate_type == RateType.IPCA_PLUS:
            ipca_monthly = await self._rate_service.get_latest_ipca()
            months = total_days / 30.44
            ipca_factor = (1 + ipca_monthly / 100) ** months
            annual_fixed = rate_value / 100
            fixed_factor = (1 + annual_fixed) ** (total_days / 365)
            final_value = invested * ipca_factor * fixed_factor
        elif position.rate_type == RateType.SELIC_PLUS:
            selic_daily = await self._rate_service.get_latest_selic()
            annual_spread = rate_value / 100
            daily_spread = (1 + annual_spread) ** (1 / 252) - 1
            effective_daily = selic_daily / 100 + daily_spread
            business_days = self._business_days(position.purchase_date, position.maturity_date)
            final_value = invested * (1 + effective_daily) ** business_days
        else:
            final_value = invested

        return Decimal(str(round(final_value, 2)))

    async def calculate_effective_annual_rate(self, position: FixedIncomePosition) -> float:
        current_value = await self.calculate_current_value(position)
        invested = float(position.invested_amount)
        if invested <= 0:
            return 0.0
        days_held = (date.today() - position.purchase_date).days
        if days_held <= 0:
            return 0.0
        total_return = float(current_value) / invested
        annual_rate = (total_return ** (365 / days_held) - 1) * 100
        return round(annual_rate, 2)

    def calculate_tax(self, position: FixedIncomePosition, gross_profit: Decimal) -> dict:
        if position.is_tax_exempt:
            return {
                "iof": Decimal("0"),
                "ir": Decimal("0"),
                "net_profit": gross_profit,
                "exempt": True,
            }

        days_held = (date.today() - position.purchase_date).days
        iof_amount = Decimal("0")
        if days_held < 30:
            iof_pct = IOF_TABLE[min(days_held, 29)] / 100
            iof_amount = gross_profit * Decimal(str(iof_pct))

        taxable_profit = gross_profit - iof_amount
        ir_rate = Decimal("0.15")
        for threshold, rate in IR_TABLE:
            if days_held <= threshold:
                ir_rate = rate
                break

        ir_amount = taxable_profit * ir_rate
        net_profit = gross_profit - iof_amount - ir_amount

        return {
            "iof": round(iof_amount, 2),
            "ir": round(ir_amount, 2),
            "ir_rate": float(ir_rate * 100),
            "net_profit": round(net_profit, 2),
            "exempt": False,
        }

    def _business_days(self, start: date, end: date) -> int:
        count = 0
        current = start
        while current < end:
            if current.weekday() < 5:
                count += 1
            current += timedelta(days=1)
        return count
