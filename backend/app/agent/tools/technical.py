import pandas as pd
import pandas_ta as ta

from app.data.providers.registry import DataProviderRegistry

_registry = DataProviderRegistry()


async def get_technical_indicators(ticker: str, period: str = "3mo") -> dict:
    historical = await _registry.get_historical("stock", ticker, period)

    if not historical:
        return {"error": "No historical data available", "ticker": ticker}

    df = pd.DataFrame(historical)

    if "close" not in df.columns:
        return {"error": "Invalid data format", "ticker": ticker}

    df["close"] = pd.to_numeric(df["close"], errors="coerce")
    df["high"] = pd.to_numeric(df.get("high", df["close"]), errors="coerce")
    df["low"] = pd.to_numeric(df.get("low", df["close"]), errors="coerce")
    df["volume"] = pd.to_numeric(df.get("volume", 0), errors="coerce")
    df = df.dropna(subset=["close"])

    if len(df) < 14:
        return {"error": "Insufficient data for technical analysis", "ticker": ticker}

    rsi = ta.rsi(df["close"], length=14)
    macd_result = ta.macd(df["close"])
    bbands = ta.bbands(df["close"], length=20)
    sma_20 = ta.sma(df["close"], length=20)
    sma_50 = ta.sma(df["close"], length=min(50, len(df) - 1))
    ema_9 = ta.ema(df["close"], length=9)
    ema_21 = ta.ema(df["close"], length=min(21, len(df) - 1))

    current_price = float(df["close"].iloc[-1])
    current_rsi = float(rsi.iloc[-1]) if rsi is not None and len(rsi) > 0 else None

    macd_line = None
    macd_signal = None
    macd_histogram = None
    if macd_result is not None and len(macd_result.columns) >= 3:
        macd_line = float(macd_result.iloc[-1, 0])
        macd_signal = float(macd_result.iloc[-1, 2])
        macd_histogram = float(macd_result.iloc[-1, 1])

    bb_upper = None
    bb_middle = None
    bb_lower = None
    if bbands is not None and len(bbands.columns) >= 3:
        bb_lower = float(bbands.iloc[-1, 0])
        bb_middle = float(bbands.iloc[-1, 1])
        bb_upper = float(bbands.iloc[-1, 2])

    sma_20_val = float(sma_20.iloc[-1]) if sma_20 is not None and len(sma_20) > 0 else None
    sma_50_val = float(sma_50.iloc[-1]) if sma_50 is not None and len(sma_50) > 0 else None
    ema_9_val = float(ema_9.iloc[-1]) if ema_9 is not None and len(ema_9) > 0 else None
    ema_21_val = float(ema_21.iloc[-1]) if ema_21 is not None and len(ema_21) > 0 else None

    signals = []
    if current_rsi is not None:
        if current_rsi > 70:
            signals.append("RSI overbought (>70) — potential sell signal")
        elif current_rsi < 30:
            signals.append("RSI oversold (<30) — potential buy signal")

    if macd_line is not None and macd_signal is not None:
        if macd_line > macd_signal:
            signals.append("MACD bullish crossover")
        else:
            signals.append("MACD bearish crossover")

    if bb_upper is not None:
        if current_price > bb_upper:
            signals.append("Price above upper Bollinger Band — overbought")
        elif current_price < bb_lower:
            signals.append("Price below lower Bollinger Band — oversold")

    if sma_20_val and sma_50_val:
        if sma_20_val > sma_50_val:
            signals.append("SMA20 above SMA50 — bullish trend")
        else:
            signals.append("SMA20 below SMA50 — bearish trend")

    trend = "neutral"
    if ema_9_val and ema_21_val:
        if current_price > ema_9_val > ema_21_val:
            trend = "bullish"
        elif current_price < ema_9_val < ema_21_val:
            trend = "bearish"

    return {
        "ticker": ticker,
        "current_price": current_price,
        "trend": trend,
        "rsi": round(current_rsi, 2) if current_rsi else None,
        "macd": {
            "line": round(macd_line, 4) if macd_line else None,
            "signal": round(macd_signal, 4) if macd_signal else None,
            "histogram": round(macd_histogram, 4) if macd_histogram else None,
        },
        "bollinger_bands": {
            "upper": round(bb_upper, 2) if bb_upper else None,
            "middle": round(bb_middle, 2) if bb_middle else None,
            "lower": round(bb_lower, 2) if bb_lower else None,
        },
        "moving_averages": {
            "sma_20": round(sma_20_val, 2) if sma_20_val else None,
            "sma_50": round(sma_50_val, 2) if sma_50_val else None,
            "ema_9": round(ema_9_val, 2) if ema_9_val else None,
            "ema_21": round(ema_21_val, 2) if ema_21_val else None,
        },
        "signals": signals,
        "data_points": len(df),
    }
