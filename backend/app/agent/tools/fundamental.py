from app.data.providers.registry import DataProviderRegistry

_registry = DataProviderRegistry()


async def get_stock_fundamentals(ticker: str) -> dict:
    fundamentals = await _registry.get_fundamentals(ticker)
    quote = await _registry.get_quote("stock", ticker)

    return {
        "ticker": ticker,
        "current_price": quote.get("price"),
        "change_pct": quote.get("change_pct"),
        "volume": quote.get("volume"),
        "market_cap": quote.get("market_cap") or fundamentals.get("market_cap"),
        "pe_ratio": fundamentals.get("pe_ratio"),
        "eps": fundamentals.get("eps"),
        "dividend_yield": fundamentals.get("dividend_yield"),
        "revenue": fundamentals.get("revenue"),
        "debt_to_equity": fundamentals.get("debt_to_equity"),
    }


async def get_fii_metrics(ticker: str) -> dict:
    if not ticker.upper().endswith(".SA"):
        ticker = f"{ticker}.SA"

    fundamentals = await _registry.get_fundamentals(ticker)
    quote = await _registry.get_quote("stock", ticker)

    price = quote.get("price", 0)
    dividend_yield = fundamentals.get("dividend_yield")

    return {
        "ticker": ticker,
        "current_price": price,
        "change_pct": quote.get("change_pct"),
        "p_vp": fundamentals.get("pe_ratio"),
        "dividend_yield": dividend_yield,
        "volume": quote.get("volume"),
        "market_cap": quote.get("market_cap"),
    }
