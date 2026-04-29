import json
from datetime import datetime

from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.prompts import SYSTEM_PROMPT, REPORT_DAILY_PROMPT, REPORT_WEEKLY_PROMPT
from app.config import get_settings
from app.services.portfolio import PortfolioService


class ReportGenerator:
    def __init__(self, db: AsyncSession):
        self._db = db
        settings = get_settings()
        self._client = AsyncOpenAI(api_key=settings.openai_api_key)
        self._model = settings.openai_model

    async def generate_daily_report(self) -> dict:
        service = PortfolioService(self._db)
        portfolio_summary = await service.get_summary()

        market_data = {}
        try:
            from app.agent.tools.fixed_income import get_current_rates
            rates = await get_current_rates()
            market_data["rates"] = rates
        except Exception:
            market_data["rates"] = {"error": "Could not fetch rates"}

        prompt = REPORT_DAILY_PROMPT.format(
            portfolio_summary=json.dumps(portfolio_summary, default=str),
            market_data=json.dumps(market_data, default=str),
        )

        response = await self._client.chat.completions.create(
            model=self._model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
        )

        content = response.choices[0].message.content
        try:
            result = json.loads(content)
        except json.JSONDecodeError:
            result = {"content": content}

        result["title"] = result.get("title", f"Daily Report - {datetime.now().strftime('%Y-%m-%d')}")
        result["generated_at"] = datetime.utcnow().isoformat()
        result["report_type"] = "daily"

        return result

    async def generate_weekly_report(self) -> dict:
        service = PortfolioService(self._db)
        portfolio_summary = await service.get_summary()

        weekly_data = {
            "portfolio_summary": portfolio_summary,
            "generated_at": datetime.utcnow().isoformat(),
        }

        try:
            from app.agent.tools.fixed_income import get_current_rates, check_maturities
            rates = await get_current_rates()
            weekly_data["current_rates"] = rates
            maturities = await check_maturities(days_ahead=7)
            weekly_data["upcoming_maturities"] = maturities
        except Exception:
            pass

        try:
            from app.agent.tools.rebalance import get_allocation_analysis
            allocation = await get_allocation_analysis()
            weekly_data["allocation_analysis"] = allocation
        except Exception:
            pass

        prompt = REPORT_WEEKLY_PROMPT.format(
            portfolio_summary=json.dumps(portfolio_summary, default=str),
            weekly_data=json.dumps(weekly_data, default=str),
        )

        response = await self._client.chat.completions.create(
            model=self._model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
        )

        content = response.choices[0].message.content
        try:
            result = json.loads(content)
        except json.JSONDecodeError:
            result = {"content": content}

        result["title"] = result.get("title", f"Weekly Report - {datetime.now().strftime('%Y-%m-%d')}")
        result["generated_at"] = datetime.utcnow().isoformat()
        result["report_type"] = "weekly"

        return result
