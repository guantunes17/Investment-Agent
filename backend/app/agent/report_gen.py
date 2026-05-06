import json
from datetime import datetime
from typing import Any

from openai import AsyncOpenAI
from openai import BadRequestError
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

    async def _generate_json_response(self, prompt: str) -> dict:
        """
        Request a JSON object from the model with a compatibility fallback.
        Some OpenAI configurations require explicit 'json' mention in messages when
        response_format=json_object is used.
        """
        system_msg = f"{SYSTEM_PROMPT}\n\nReturn ONLY valid JSON."
        user_msg = (
            f"{prompt}\n\n"
            "Important: respond as a JSON object only (no markdown, no prose)."
        )
        try:
            response = await self._client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": system_msg},
                    {"role": "user", "content": user_msg},
                ],
                response_format={"type": "json_object"},
                temperature=0.3,
            )
        except BadRequestError:
            # Fallback for gateways/models that reject response_format constraints.
            response = await self._client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": system_msg},
                    {"role": "user", "content": user_msg},
                ],
                temperature=0.3,
            )

        content = response.choices[0].message.content
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            return {"content": content}

    def _pretty_text(self, value: Any, level: int = 0) -> str:
        indent = "  " * level
        if isinstance(value, dict):
            parts: list[str] = []
            for k, v in value.items():
                label = str(k).replace("_", " ").capitalize()
                if isinstance(v, (dict, list)):
                    parts.append(f"{indent}{label}:")
                    parts.append(self._pretty_text(v, level + 1))
                else:
                    parts.append(f"{indent}- {label}: {v}")
            return "\n".join(parts)
        if isinstance(value, list):
            items: list[str] = []
            for item in value:
                if isinstance(item, (dict, list)):
                    items.append(f"{indent}-")
                    items.append(self._pretty_text(item, level + 1))
                else:
                    items.append(f"{indent}- {item}")
            return "\n".join(items)
        return f"{indent}{value}"

    def _normalize_scorecards(self, value: Any) -> list[dict[str, str]]:
        if not isinstance(value, list):
            return []

        normalized: list[dict[str, str]] = []
        for idx, item in enumerate(value):
            if not isinstance(item, dict):
                normalized.append(
                    {
                        "id": f"card_{idx + 1}",
                        "label": f"Indicador {idx + 1}",
                        "value": str(item),
                        "status": "neutral",
                        "reason": "",
                    }
                )
                continue

            status = str(item.get("status") or "neutral").lower()
            if status not in {"positive", "neutral", "warning", "negative"}:
                status = "neutral"

            normalized.append(
                {
                    "id": str(item.get("id") or f"card_{idx + 1}"),
                    "label": str(item.get("label") or f"Indicador {idx + 1}"),
                    "value": str(item.get("value") or ""),
                    "status": status,
                    "reason": str(item.get("reason") or ""),
                }
            )
        return normalized

    def _normalize_action_items(self, value: Any) -> list[str]:
        if not isinstance(value, list):
            return []
        out: list[str] = []
        for item in value:
            text = str(item).strip()
            if text:
                out.append(text)
        return out

    def _normalize_confidence(self, value: Any) -> dict[str, str]:
        default_conf = {
            "level": "medium",
            "reason": "Confiança moderada com base nos dados atualmente disponíveis.",
        }
        if not isinstance(value, dict):
            return default_conf

        level = str(value.get("level") or "medium").lower()
        if level not in {"high", "medium", "low"}:
            level = "medium"

        reason = str(value.get("reason") or default_conf["reason"])
        return {"level": level, "reason": reason}

    def _normalize_limitations(self, value: Any) -> list[str]:
        if isinstance(value, list):
            items = [str(v).strip() for v in value if str(v).strip()]
            return items
        if isinstance(value, str) and value.strip():
            return [value.strip()]
        return []

    def _coerce_report_shape(self, result: dict, report_type: str) -> dict:
        # Ensure frontend receives a stable, human-readable structure.
        if isinstance(result.get("sections"), list):
            clean_sections: list[dict[str, Any]] = []
            for idx, s in enumerate(result["sections"]):
                if not isinstance(s, dict):
                    clean_sections.append(
                        {"title": f"Seção {idx + 1}", "content": str(s)}
                    )
                    continue
                title = str(s.get("title") or f"Seção {idx + 1}")
                content = s.get("content", "")
                if not isinstance(content, str):
                    content = self._pretty_text(content)
                clean_sections.append(
                    {
                        "title": title,
                        "content": str(content),
                        "recommendations": s.get("recommendations"),
                    }
                )
            result["sections"] = clean_sections
        else:
            # Fallback if model returned keyed object instead of sections list.
            sections: list[dict[str, Any]] = []
            for k, v in result.items():
                if k in {"title", "summary", "generated_at", "report_type"}:
                    continue
                title = k.replace("_", " ").title()
                content = v if isinstance(v, str) else self._pretty_text(v)
                sections.append({"title": title, "content": str(content)})
            result["sections"] = sections

        if not isinstance(result.get("summary"), str) or not result.get("summary", "").strip():
            result["summary"] = (
                "Relatório gerado pelo modelo com base nos dados disponíveis do portfólio."
            )
        if not isinstance(result.get("title"), str) or not result.get("title", "").strip():
            prefix = "Relatório Diário" if report_type == "daily" else "Relatório Semanal"
            result["title"] = f"{prefix} — {datetime.now().strftime('%Y-%m-%d')}"

        result["scorecards"] = self._normalize_scorecards(result.get("scorecards"))
        if not result["scorecards"]:
            result["scorecards"] = [
                {
                    "id": "portfolio_snapshot",
                    "label": "Panorama da Carteira",
                    "value": "Dados insuficientes para scorecard detalhado.",
                    "status": "neutral",
                    "reason": "O modelo não retornou scorecards estruturados.",
                }
            ]

        result["action_items"] = self._normalize_action_items(result.get("action_items"))
        if not result["action_items"]:
            result["action_items"] = [
                "Revisar alocação atual por classe de ativos.",
                "Checar concentração e vencimentos próximos.",
                "Confirmar próximos aportes/rebalanceamento da semana.",
            ]

        result["confidence"] = self._normalize_confidence(result.get("confidence"))

        result["data_limitations"] = self._normalize_limitations(result.get("data_limitations"))
        if not result["data_limitations"]:
            result["data_limitations"] = [
                "Algumas análises dependem de dados agregados e podem não refletir ativos individuais.",
            ]
        return result

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

        prompt = (
            REPORT_DAILY_PROMPT
            .replace("{portfolio_summary}", json.dumps(portfolio_summary, default=str))
            .replace("{market_data}", json.dumps(market_data, default=str))
        )

        result = await self._generate_json_response(prompt)

        result = self._coerce_report_shape(result, "daily")
        result["title"] = result.get("title", f"Relatório Diário — {datetime.now().strftime('%Y-%m-%d')}")
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

        prompt = (
            REPORT_WEEKLY_PROMPT
            .replace("{portfolio_summary}", json.dumps(portfolio_summary, default=str))
            .replace("{weekly_data}", json.dumps(weekly_data, default=str))
        )

        result = await self._generate_json_response(prompt)

        result = self._coerce_report_shape(result, "weekly")
        result["title"] = result.get("title", f"Relatório Semanal — {datetime.now().strftime('%Y-%m-%d')}")
        result["generated_at"] = datetime.utcnow().isoformat()
        result["report_type"] = "weekly"

        return result
