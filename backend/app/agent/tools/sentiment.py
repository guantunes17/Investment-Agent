from openai import AsyncOpenAI

from app.config import get_settings


async def get_sentiment_score(ticker: str) -> dict:
    settings = get_settings()
    client = AsyncOpenAI(api_key=settings.openai_api_key)

    prompt = f"""Analyze the current market sentiment for the ticker/asset "{ticker}".
Consider:
- Recent news and market events
- Sector trends
- Market positioning
- Analyst consensus

Provide a structured response with:
- sentiment_score: integer from -100 (extremely bearish) to +100 (extremely bullish)
- sentiment_label: one of "very_bearish", "bearish", "neutral", "bullish", "very_bullish"
- key_factors: list of 3-5 key factors influencing sentiment
- summary: one paragraph summary

Respond in JSON format only."""

    response = await client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": "You are a financial sentiment analyst. Respond only in valid JSON."},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.3,
    )

    import json
    content = response.choices[0].message.content
    result = json.loads(content)

    return {
        "ticker": ticker,
        "sentiment_score": result.get("sentiment_score", 0),
        "sentiment_label": result.get("sentiment_label", "neutral"),
        "key_factors": result.get("key_factors", []),
        "summary": result.get("summary", ""),
    }
