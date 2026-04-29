import json
from typing import Any

from openai import AsyncOpenAI

from app.agent.prompts import SYSTEM_PROMPT, ANALYSIS_PROMPT
from app.config import get_settings

TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "get_stock_fundamentals",
            "description": "Get fundamental analysis data for a stock (P/E, EPS, dividend yield, revenue, market cap, debt-to-equity)",
            "parameters": {
                "type": "object",
                "properties": {
                    "ticker": {"type": "string", "description": "Stock ticker symbol (e.g., PETR4.SA, AAPL)"}
                },
                "required": ["ticker"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_fii_metrics",
            "description": "Get FII (Fundo Imobiliário) metrics: P/VP, dividend yield, vacancy rate",
            "parameters": {
                "type": "object",
                "properties": {
                    "ticker": {"type": "string", "description": "FII ticker (e.g., HGLG11, XPML11)"}
                },
                "required": ["ticker"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_technical_indicators",
            "description": "Get technical analysis indicators: RSI, MACD, Bollinger Bands, moving averages, trend signals",
            "parameters": {
                "type": "object",
                "properties": {
                    "ticker": {"type": "string", "description": "Ticker symbol"},
                    "period": {"type": "string", "description": "Analysis period (1mo, 3mo, 6mo, 1y)", "default": "3mo"},
                },
                "required": ["ticker"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_sentiment_score",
            "description": "Get market sentiment analysis for a ticker based on news and market conditions",
            "parameters": {
                "type": "object",
                "properties": {
                    "ticker": {"type": "string", "description": "Ticker or asset name"}
                },
                "required": ["ticker"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_fixed_income_summary",
            "description": "Get summary of all fixed-income positions with current values and yields",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "compare_yields",
            "description": "Compare yields between fixed-income positions side by side",
            "parameters": {
                "type": "object",
                "properties": {
                    "position_ids": {"type": "array", "items": {"type": "integer"}, "description": "List of position IDs to compare"}
                },
                "required": ["position_ids"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_maturities",
            "description": "Check for fixed-income positions maturing within a given number of days",
            "parameters": {
                "type": "object",
                "properties": {
                    "days_ahead": {"type": "integer", "description": "Number of days to look ahead", "default": 30}
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "simulate_reinvestment",
            "description": "Simulate reinvestment returns for a given amount, rate type, and period",
            "parameters": {
                "type": "object",
                "properties": {
                    "amount": {"type": "number", "description": "Investment amount in BRL"},
                    "rate_type": {"type": "string", "description": "Rate type: PCT_CDI, CDI_PLUS, IPCA_PLUS, PRE, SELIC_PLUS"},
                    "rate_value": {"type": "number", "description": "Rate value (e.g., 100 for 100% CDI, 5.5 for IPCA+5.5%)"},
                    "months": {"type": "integer", "description": "Investment period in months"},
                },
                "required": ["amount", "rate_type", "rate_value", "months"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_current_rates",
            "description": "Get current BCB rates: CDI, Selic, and IPCA",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_portfolio_summary",
            "description": "Get complete portfolio summary with net worth and allocation breakdown",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_allocation_analysis",
            "description": "Analyze current portfolio allocation vs recommended ranges",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "suggest_rebalancing",
            "description": "Get actionable portfolio rebalancing suggestions based on target allocation",
            "parameters": {"type": "object", "properties": {}},
        },
    },
]


class AgentService:
    def __init__(self):
        settings = get_settings()
        self._client = AsyncOpenAI(api_key=settings.openai_api_key)
        self._model = settings.openai_model

    async def _execute_tool(self, name: str, arguments: dict) -> Any:
        from app.agent.tools import fundamental, technical, sentiment, fixed_income, rebalance

        tool_map = {
            "get_stock_fundamentals": fundamental.get_stock_fundamentals,
            "get_fii_metrics": fundamental.get_fii_metrics,
            "get_technical_indicators": technical.get_technical_indicators,
            "get_sentiment_score": sentiment.get_sentiment_score,
            "get_fixed_income_summary": fixed_income.get_fixed_income_summary,
            "compare_yields": fixed_income.compare_yields,
            "check_maturities": fixed_income.check_maturities,
            "simulate_reinvestment": fixed_income.simulate_reinvestment,
            "get_current_rates": fixed_income.get_current_rates,
            "get_portfolio_summary": rebalance.get_portfolio_summary,
            "get_allocation_analysis": rebalance.get_allocation_analysis,
            "suggest_rebalancing": rebalance.suggest_rebalancing,
        }

        func = tool_map.get(name)
        if not func:
            return {"error": f"Unknown tool: {name}"}

        try:
            result = await func(**arguments)
            return result
        except Exception as e:
            return {"error": str(e)}

    async def chat(self, message: str, history: list = None) -> str:
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]

        if history:
            for msg in history[-20:]:
                role = msg.role if hasattr(msg, "role") else msg.get("role", "user")
                content = msg.content if hasattr(msg, "content") else msg.get("content", "")
                messages.append({"role": role, "content": content})

        messages.append({"role": "user", "content": message})

        max_iterations = 10
        for _ in range(max_iterations):
            response = await self._client.chat.completions.create(
                model=self._model,
                messages=messages,
                tools=TOOL_DEFINITIONS,
                tool_choice="auto",
            )

            choice = response.choices[0]

            if choice.finish_reason == "stop" or not choice.message.tool_calls:
                return choice.message.content or ""

            messages.append(choice.message)

            for tool_call in choice.message.tool_calls:
                fn_name = tool_call.function.name
                fn_args = json.loads(tool_call.function.arguments)
                result = await self._execute_tool(fn_name, fn_args)
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(result, default=str),
                })

        return messages[-1].get("content", "I was unable to complete the analysis. Please try again.")

    async def analyze_asset(self, asset_type: str, identifier: str) -> dict:
        data_context_parts = []

        try:
            if asset_type in ("stock", "fii"):
                from app.agent.tools.fundamental import get_stock_fundamentals, get_fii_metrics
                from app.agent.tools.technical import get_technical_indicators

                if asset_type == "fii":
                    fundamentals = await get_fii_metrics(identifier)
                else:
                    fundamentals = await get_stock_fundamentals(identifier)
                data_context_parts.append(f"Fundamentals: {json.dumps(fundamentals, default=str)}")

                technical = await get_technical_indicators(identifier)
                data_context_parts.append(f"Technical Indicators: {json.dumps(technical, default=str)}")

        except Exception as e:
            data_context_parts.append(f"Error fetching data: {str(e)}")

        data_context = "\n".join(data_context_parts)
        prompt = ANALYSIS_PROMPT.format(
            asset_type=asset_type,
            identifier=identifier,
            data_context=data_context,
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
            result = {
                "summary": content,
                "recommendation": "HOLD",
                "confidence": 50,
            }

        if "recommendation" not in result:
            result["recommendation"] = "HOLD"
        if "confidence" not in result:
            result["confidence"] = 50

        return result

    async def generate_report(self, report_type: str = "daily") -> dict:
        from app.agent.report_gen import ReportGenerator
        from app.api.deps import async_session

        async with async_session() as db:
            generator = ReportGenerator(db)
            if report_type == "weekly":
                return await generator.generate_weekly_report()
            return await generator.generate_daily_report()
