import asyncio
import csv
import io
import logging
from datetime import date, timedelta
from typing import Optional

import numpy as np
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Body, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from redis.asyncio import Redis

from app.api.deps import get_db, get_redis
from app.api.schemas import (
    StockPositionCreate, StockPositionUpdate, StockPositionResponse,
    FixedIncomeCreate, FixedIncomeUpdate, FixedIncomeResponse,
    PortfolioSummaryResponse, CSVImportResponse,
)
from app.models.fixed_income import FixedIncomePosition
from app.models.stock_position import StockPosition
from app.services.portfolio import PortfolioService
from app.services.csv_import import CSVImportService
from app.services.position_enrichment import (
    build_yield_calculator,
    enrich_fixed_income_response,
    enrich_stock_response,
)
from app.data.providers.registry import DataProviderRegistry

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_service(db: AsyncSession = Depends(get_db)) -> PortfolioService:
    return PortfolioService(db)


async def _to_stock_response(stock: StockPosition, redis: Redis) -> StockPositionResponse:
    registry = DataProviderRegistry()
    data = await enrich_stock_response(stock, registry)
    return StockPositionResponse(**data)


async def _to_fixed_income_response(fi: FixedIncomePosition, redis: Redis) -> FixedIncomeResponse:
    calculator = await build_yield_calculator(redis)
    data = await enrich_fixed_income_response(fi, calculator)
    return FixedIncomeResponse(**data)


# --- All positions ---

@router.get("/")
async def list_positions(
    service: PortfolioService = Depends(_get_service),
    redis: Redis = Depends(get_redis),
):
    stocks = await service.list_stocks()
    fixed_income = await service.list_fixed_income()
    out_stocks = (
        await asyncio.gather(*[_to_stock_response(s, redis) for s in stocks])
        if stocks
        else []
    )
    calc = await build_yield_calculator(redis)
    out_fi = (
        await asyncio.gather(
            *[_to_fixed_income_response(fi, redis) for fi in fixed_income]
        )
        if fixed_income
        else []
    )
    return {
        "stocks": out_stocks,
        "fixed_income": out_fi,
        "total_positions": len(stocks) + len(fixed_income),
    }


# --- Stocks ---

@router.get("/stocks", response_model=list[StockPositionResponse])
async def list_stocks(
    service: PortfolioService = Depends(_get_service),
    redis: Redis = Depends(get_redis),
):
    stocks = await service.list_stocks()
    return [await _to_stock_response(s, redis) for s in stocks]


@router.post("/stocks", response_model=StockPositionResponse, status_code=201)
async def create_stock(
    data: StockPositionCreate,
    service: PortfolioService = Depends(_get_service),
    redis: Redis = Depends(get_redis),
):
    position = await service.create_stock(data.model_dump())
    return await _to_stock_response(position, redis)


@router.put("/stocks/{stock_id}", response_model=StockPositionResponse)
async def update_stock(
    stock_id: int,
    data: StockPositionUpdate,
    service: PortfolioService = Depends(_get_service),
    redis: Redis = Depends(get_redis),
):
    position = await service.update_stock(stock_id, data.model_dump(exclude_unset=True))
    if not position:
        raise HTTPException(status_code=404, detail="Stock position not found")
    return await _to_stock_response(position, redis)


@router.delete("/stocks/{stock_id}", status_code=204)
async def delete_stock(
    stock_id: int,
    service: PortfolioService = Depends(_get_service),
):
    deleted = await service.delete_stock(stock_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Stock position not found")


# --- Fixed Income ---

@router.get("/fixed-income", response_model=list[FixedIncomeResponse])
async def list_fixed_income(
    service: PortfolioService = Depends(_get_service),
    redis: Redis = Depends(get_redis),
):
    positions = await service.list_fixed_income()
    calc = await build_yield_calculator(redis)
    return [
        FixedIncomeResponse(**await enrich_fixed_income_response(fi, calc)) for fi in positions
    ]


@router.post("/fixed-income", response_model=FixedIncomeResponse, status_code=201)
async def create_fixed_income(
    data: FixedIncomeCreate,
    service: PortfolioService = Depends(_get_service),
    redis: Redis = Depends(get_redis),
):
    position = await service.create_fixed_income(data.model_dump())
    return await _to_fixed_income_response(position, redis)


@router.put("/fixed-income/{fi_id}", response_model=FixedIncomeResponse)
async def update_fixed_income(
    fi_id: int,
    data: FixedIncomeUpdate,
    service: PortfolioService = Depends(_get_service),
    redis: Redis = Depends(get_redis),
):
    position = await service.update_fixed_income(fi_id, data.model_dump(exclude_unset=True))
    if not position:
        raise HTTPException(status_code=404, detail="Fixed income position not found")
    return await _to_fixed_income_response(position, redis)


@router.delete("/fixed-income/{fi_id}", status_code=204)
async def delete_fixed_income(
    fi_id: int,
    service: PortfolioService = Depends(_get_service),
):
    deleted = await service.delete_fixed_income(fi_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Fixed income position not found")



# --- Summary ---

@router.get("/summary", response_model=PortfolioSummaryResponse)
async def get_summary(service: PortfolioService = Depends(_get_service)):
    summary = await service.get_summary()
    return PortfolioSummaryResponse(**summary)


# --- CSV Import ---

@router.post("/import-csv", response_model=CSVImportResponse)
async def import_csv(
    file: UploadFile = File(...),
    asset_type_hint: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
):
    content = await file.read()
    csv_service = CSVImportService(db)
    hint = (asset_type_hint or "").strip() or None
    if hint == "fixed-income":
        hint = "fixed_income"
    elif hint == "stock" or hint == "fii":
        hint = "stock"
    result = await csv_service.import_csv(content, asset_type=hint)
    return CSVImportResponse(**result)


# --- CSV Templates ---

_TEMPLATES: dict[str, tuple[list[str], list[str]]] = {
    "stock": (
        ["ticker", "name", "exchange", "asset_subtype", "quantity", "avg_price", "reported_position_value"],
        ["PETR4", "Petrobras PN", "B3", "STOCK", "100", "28.50", ""],
    ),
    "fixed-income": (
        [
            "name", "issuer", "asset_subtype", "invested_amount",
            "purchase_date", "maturity_date", "rate_type", "rate_value",
            "is_tax_exempt",
            "cdi_index_mode", "rate_ceiling_value", "projection_cdi_percent",
            "reported_position_value",
        ],
        [
            "CDB Banco X 120% CDI", "Banco X", "CDB", "10000.00",
            "2025-01-15", "2027-01-15", "PCT_CDI", "120", "false",
            "FIXED", "", "", "",
        ],
    ),
    "fii": (
        ["ticker", "name", "exchange", "asset_subtype", "quantity", "avg_price", "reported_position_value"],
        ["HGLG11", "CSHG Logística FII", "B3", "FII", "50", "162.30", ""],
    ),
}


@router.get("/template/{asset_type}")
async def download_template(asset_type: str):
    if asset_type not in _TEMPLATES:
        raise HTTPException(status_code=404, detail=f"Unknown asset type: {asset_type}")

    headers, example = _TEMPLATES[asset_type]
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(headers)
    writer.writerow(example)
    buf.seek(0)

    filename = f"template_{asset_type.replace('-', '_')}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# --- CSV Export ---

@router.get("/export/{asset_type}")
async def export_csv(
    asset_type: str,
    service: PortfolioService = Depends(_get_service),
):
    if asset_type == "stocks":
        positions = await service.list_stocks()
        headers = [
            "ticker", "name", "exchange", "asset_subtype", "quantity", "avg_price",
            "reported_position_value",
        ]
        rows = [
            [
                p.ticker,
                p.name,
                p.exchange,
                getattr(p.asset_subtype, "value", str(p.asset_subtype)),
                str(p.quantity),
                str(p.avg_price),
                str(p.reported_position_value) if p.reported_position_value is not None else "",
            ]
            for p in positions
        ]
    elif asset_type == "fixed-income":
        positions = await service.list_fixed_income()
        headers = [
            "name", "issuer", "asset_subtype", "invested_amount",
            "purchase_date", "maturity_date", "rate_type", "rate_value",
            "is_tax_exempt",
            "cdi_index_mode", "rate_ceiling_value", "projection_cdi_percent",
            "reported_position_value",
        ]
        rows = [
            [
                p.name,
                p.issuer,
                getattr(p.asset_subtype, "value", str(p.asset_subtype)),
                str(p.invested_amount),
                str(p.purchase_date),
                str(p.maturity_date) if p.maturity_date is not None else "",
                getattr(p.rate_type, "value", str(p.rate_type)),
                str(p.rate_value),
                str(p.is_tax_exempt).lower(),
                getattr(p.cdi_index_mode, "value", str(p.cdi_index_mode)),
                str(p.rate_ceiling_value) if p.rate_ceiling_value is not None else "",
                str(p.projection_cdi_percent) if p.projection_cdi_percent is not None else "",
                str(p.reported_position_value) if p.reported_position_value is not None else "",
            ]
            for p in positions
        ]
    elif asset_type == "fiis":
        positions = await service.list_stocks()
        fii_only = [p for p in positions if str(getattr(p, "asset_subtype", "")).upper() == "FII"]
        headers = [
            "ticker", "name", "exchange", "asset_subtype", "quantity", "avg_price",
            "reported_position_value",
        ]
        rows = [
            [
                p.ticker,
                p.name,
                p.exchange,
                getattr(p.asset_subtype, "value", str(p.asset_subtype)),
                str(p.quantity),
                str(p.avg_price),
                str(p.reported_position_value) if p.reported_position_value is not None else "",
            ]
            for p in fii_only
        ]
    else:
        raise HTTPException(status_code=404, detail=f"Unknown asset type: {asset_type}")

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(headers)
    writer.writerows(rows)
    buf.seek(0)

    filename = f"portfolio_{asset_type}_{date.today().isoformat()}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# --- Dividends ---

@router.get("/dividends")
async def get_dividends(service: PortfolioService = Depends(_get_service)):
    registry = DataProviderRegistry()
    stocks = await service.list_stocks()
    results = []
    for s in stocks:
        try:
            fundamentals = await registry.get_fundamentals(s.ticker)
            dy = fundamentals.get("dividend_yield") or 0
            annual_income = float(s.quantity) * float(s.avg_price) * dy
            results.append({
                "ticker": s.ticker,
                "name": s.name,
                "assetType": "fii" if str(s.asset_subtype).upper() == "FII" else "stock",
                "quantity": float(s.quantity),
                "avgPrice": float(s.avg_price),
                "dividendYield": round(dy * 100, 2),
                "annualIncome": round(annual_income, 2),
                "monthlyIncome": round(annual_income / 12, 2),
                "yieldOnCost": round(dy * 100, 2),
            })
        except Exception as e:
            logger.warning("Failed to fetch dividends for %s: %s", s.ticker, e)
            results.append({
                "ticker": s.ticker,
                "name": s.name,
                "assetType": "fii" if str(s.asset_subtype).upper() == "FII" else "stock",
                "quantity": float(s.quantity),
                "avgPrice": float(s.avg_price),
                "dividendYield": 0,
                "annualIncome": 0,
                "monthlyIncome": 0,
                "yieldOnCost": 0,
            })

    total_annual = sum(r["annualIncome"] for r in results)
    avg_yield = np.mean([r["dividendYield"] for r in results]) if results else 0
    monthly_projection = [
        {"month": i + 1, "income": round(total_annual / 12, 2)}
        for i in range(12)
    ]

    return {
        "positions": results,
        "totalAnnualIncome": round(total_annual, 2),
        "averageYield": round(float(avg_yield), 2),
        "monthlyProjection": monthly_projection,
    }


# --- Performance vs Benchmark ---

_PERIOD_DAYS = {"1m": 30, "3m": 90, "6m": 180, "1y": 365, "ytd": None}


@router.get("/performance")
async def get_performance(
    period: str = Query("6m"),
    service: PortfolioService = Depends(_get_service),
):
    registry = DataProviderRegistry()
    days_map = {"1m": 30, "3m": 90, "6m": 180, "1y": 365}
    if period == "ytd":
        num_days = (date.today() - date(date.today().year, 1, 1)).days
    else:
        num_days = days_map.get(period, 180)

    yf_period = "1mo" if num_days <= 30 else "3mo" if num_days <= 90 else "6mo" if num_days <= 180 else "1y"

    stocks = await service.list_stocks()
    portfolio_returns: dict[str, float] = {}
    for s in stocks:
        try:
            hist = await registry.get_historical("stock", s.ticker, yf_period)
            for point in hist:
                d = point["date"][:10]
                portfolio_returns[d] = portfolio_returns.get(d, 0) + point["close"] * float(s.quantity)
        except Exception:
            pass

    try:
        ibov_hist = await registry._yahoo.get_historical("^BVSP", yf_period)
    except Exception:
        ibov_hist = []

    try:
        bcb = registry.get_bcb_provider()
        cdi_start = date.today() - timedelta(days=num_days)
        cdi_data = await bcb.get_rate_history("cdi", cdi_start, date.today())
    except Exception:
        cdi_data = []

    dates = sorted(portfolio_returns.keys())
    if not dates:
        return {"dates": [], "portfolio": [], "ibov": [], "cdi": []}

    base_val = portfolio_returns.get(dates[0], 1)
    port_series = [round((portfolio_returns.get(d, base_val) / base_val - 1) * 100, 2) for d in dates]

    ibov_map = {p["date"][:10]: p["close"] for p in ibov_hist}
    ibov_dates = sorted(ibov_map.keys())
    ibov_base = ibov_map.get(ibov_dates[0], 1) if ibov_dates else 1
    ibov_series = [round((ibov_map.get(d, ibov_base) / ibov_base - 1) * 100, 2) for d in dates]

    cdi_map = {c["date"][:10] if isinstance(c.get("date"), str) else str(c.get("date", "")): c.get("value", 0) for c in cdi_data} if cdi_data else {}
    cdi_cum = 0.0
    cdi_series = []
    for d in dates:
        daily_rate = cdi_map.get(d, 0)
        cdi_cum = (1 + cdi_cum / 100) * (1 + daily_rate / 100 / 252) - 1
        cdi_cum *= 100
        cdi_series.append(round(cdi_cum, 2))

    return {
        "dates": dates,
        "portfolio": port_series,
        "ibov": ibov_series,
        "cdi": cdi_series,
    }


# --- Daily P&L ---

@router.get("/daily-pnl")
async def get_daily_pnl(
    year: int = Query(default=None),
    service: PortfolioService = Depends(_get_service),
):
    if year is None:
        year = date.today().year

    registry = DataProviderRegistry()
    stocks = await service.list_stocks()

    daily_values: dict[str, float] = {}
    for s in stocks:
        try:
            hist = await registry.get_historical("stock", s.ticker, "1y")
            for point in hist:
                d = point["date"][:10]
                if d.startswith(str(year)):
                    daily_values[d] = daily_values.get(d, 0) + point["close"] * float(s.quantity)
        except Exception:
            pass

    dates = sorted(daily_values.keys())
    result = []
    for i, d in enumerate(dates):
        if i == 0:
            result.append({"date": d, "pnl": 0})
        else:
            pnl = daily_values[d] - daily_values[dates[i - 1]]
            result.append({"date": d, "pnl": round(pnl, 2)})

    return result


# --- Correlation Matrix ---

@router.get("/correlation")
async def get_correlation(service: PortfolioService = Depends(_get_service)):
    registry = DataProviderRegistry()
    stocks = await service.list_stocks()
    stock_only = [s for s in stocks if str(getattr(s, "asset_subtype", "STOCK")).upper() in ("STOCK", "FII")]

    if len(stock_only) < 2:
        tickers = [s.ticker for s in stock_only]
        return {"tickers": tickers, "matrix": [[1.0]] if stock_only else []}

    price_series: dict[str, dict[str, float]] = {}
    for s in stock_only:
        try:
            hist = await registry.get_historical("stock", s.ticker, "3mo")
            price_series[s.ticker] = {p["date"][:10]: p["close"] for p in hist}
        except Exception:
            price_series[s.ticker] = {}

    tickers = [s.ticker for s in stock_only if price_series.get(s.ticker)]
    if len(tickers) < 2:
        return {"tickers": tickers, "matrix": [[1.0] for _ in tickers]}

    all_dates = sorted(set.intersection(*(set(price_series[t].keys()) for t in tickers)))
    if len(all_dates) < 5:
        return {"tickers": tickers, "matrix": [[1.0 if i == j else 0.0 for j in range(len(tickers))] for i in range(len(tickers))]}

    returns_matrix = []
    for t in tickers:
        prices = [price_series[t][d] for d in all_dates]
        returns = [(prices[i] / prices[i - 1] - 1) for i in range(1, len(prices))]
        returns_matrix.append(returns)

    arr = np.array(returns_matrix)
    corr = np.corrcoef(arr)
    corr_list = [[round(float(corr[i][j]), 3) for j in range(len(tickers))] for i in range(len(tickers))]

    avg_off_diag = float(np.mean([corr[i][j] for i in range(len(tickers)) for j in range(len(tickers)) if i != j]))

    return {
        "tickers": tickers,
        "matrix": corr_list,
        "diversificationScore": round(1 - abs(avg_off_diag), 3),
    }


# --- Allocation Targets ---

_allocation_targets: dict[str, float] = {
    "stock": 60.0,
    "fixed-income": 30.0,
    "fii": 10.0,
}


@router.get("/allocation-targets")
async def get_allocation_targets():
    return _allocation_targets


@router.put("/allocation-targets")
async def update_allocation_targets(targets: dict[str, float] = Body(...)):
    total = sum(targets.values())
    if abs(total - 100) > 0.01:
        raise HTTPException(status_code=400, detail=f"Targets must sum to 100%, got {total}%")
    _allocation_targets.update(targets)
    return _allocation_targets


# --- Rebalance Suggestions ---

@router.get("/rebalance")
async def get_rebalance(service: PortfolioService = Depends(_get_service)):
    stocks = await service.list_stocks()
    fixed_income = await service.list_fixed_income()

    stock_value = sum(float(s.quantity * s.avg_price) for s in stocks if str(s.asset_subtype).upper() == "STOCK")
    fii_value = sum(float(s.quantity * s.avg_price) for s in stocks if str(s.asset_subtype).upper() == "FII")
    fi_value = sum(float(fi.invested_amount) for fi in fixed_income)
    total = stock_value + fii_value + fi_value

    if total == 0:
        return {"current": {}, "targets": _allocation_targets, "suggestions": []}

    current = {
        "stock": round(stock_value / total * 100, 1),
        "fixed-income": round(fi_value / total * 100, 1),
        "fii": round(fii_value / total * 100, 1),
    }

    suggestions = []
    for asset_class, target_pct in _allocation_targets.items():
        current_pct = current.get(asset_class, 0)
        diff_pct = target_pct - current_pct
        diff_value = diff_pct / 100 * total
        if abs(diff_pct) > 1:
            action = "Buy" if diff_pct > 0 else "Sell"
            label = asset_class.replace("-", " ").title()
            suggestions.append({
                "assetClass": asset_class,
                "action": action,
                "amount": round(abs(diff_value), 2),
                "description": f"{action} R${abs(diff_value):,.2f} in {label} to reach {target_pct}% target",
            })

    return {
        "current": current,
        "targets": _allocation_targets,
        "suggestions": suggestions,
        "totalValue": round(total, 2),
    }
