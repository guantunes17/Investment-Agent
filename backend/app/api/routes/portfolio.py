from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.api.schemas import (
    StockPositionCreate, StockPositionUpdate, StockPositionResponse,
    FixedIncomeCreate, FixedIncomeUpdate, FixedIncomeResponse,
    PortfolioSummaryResponse, CSVImportResponse,
)
from app.services.portfolio import PortfolioService
from app.services.csv_import import CSVImportService

router = APIRouter()


def _get_service(db: AsyncSession = Depends(get_db)) -> PortfolioService:
    return PortfolioService(db)


# --- All positions ---

@router.get("/")
async def list_positions(service: PortfolioService = Depends(_get_service)):
    stocks = await service.list_stocks()
    fixed_income = await service.list_fixed_income()
    return {
        "stocks": [StockPositionResponse.model_validate(s) for s in stocks],
        "fixed_income": [FixedIncomeResponse.model_validate(fi) for fi in fixed_income],
        "total_positions": len(stocks) + len(fixed_income),
    }


# --- Stocks ---

@router.get("/stocks", response_model=list[StockPositionResponse])
async def list_stocks(service: PortfolioService = Depends(_get_service)):
    stocks = await service.list_stocks()
    return [StockPositionResponse.model_validate(s) for s in stocks]


@router.post("/stocks", response_model=StockPositionResponse, status_code=201)
async def create_stock(
    data: StockPositionCreate,
    service: PortfolioService = Depends(_get_service),
):
    position = await service.create_stock(data.model_dump())
    return StockPositionResponse.model_validate(position)


@router.put("/stocks/{stock_id}", response_model=StockPositionResponse)
async def update_stock(
    stock_id: int,
    data: StockPositionUpdate,
    service: PortfolioService = Depends(_get_service),
):
    position = await service.update_stock(stock_id, data.model_dump(exclude_unset=True))
    if not position:
        raise HTTPException(status_code=404, detail="Stock position not found")
    return StockPositionResponse.model_validate(position)


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
async def list_fixed_income(service: PortfolioService = Depends(_get_service)):
    positions = await service.list_fixed_income()
    return [FixedIncomeResponse.model_validate(fi) for fi in positions]


@router.post("/fixed-income", response_model=FixedIncomeResponse, status_code=201)
async def create_fixed_income(
    data: FixedIncomeCreate,
    service: PortfolioService = Depends(_get_service),
):
    position = await service.create_fixed_income(data.model_dump())
    return FixedIncomeResponse.model_validate(position)


@router.put("/fixed-income/{fi_id}", response_model=FixedIncomeResponse)
async def update_fixed_income(
    fi_id: int,
    data: FixedIncomeUpdate,
    service: PortfolioService = Depends(_get_service),
):
    position = await service.update_fixed_income(fi_id, data.model_dump(exclude_unset=True))
    if not position:
        raise HTTPException(status_code=404, detail="Fixed income position not found")
    return FixedIncomeResponse.model_validate(position)


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
    db: AsyncSession = Depends(get_db),
):
    content = await file.read()
    csv_service = CSVImportService(db)
    result = await csv_service.import_csv(content)
    return CSVImportResponse(**result)
