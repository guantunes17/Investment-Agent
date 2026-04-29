from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional

from pydantic import BaseModel, Field


# --- Stock Schemas ---

class StockPositionCreate(BaseModel):
    ticker: str
    name: str
    exchange: str = "B3"
    asset_subtype: str = "STOCK"
    quantity: Decimal
    avg_price: Decimal


class StockPositionUpdate(BaseModel):
    ticker: Optional[str] = None
    name: Optional[str] = None
    exchange: Optional[str] = None
    asset_subtype: Optional[str] = None
    quantity: Optional[Decimal] = None
    avg_price: Optional[Decimal] = None


class StockPositionResponse(BaseModel):
    id: int
    ticker: str
    name: str
    exchange: str
    asset_subtype: str
    quantity: Decimal
    avg_price: Decimal
    created_at: datetime
    updated_at: datetime
    current_price: Optional[float] = None
    total_value: Optional[float] = None
    profit_loss: Optional[float] = None
    profit_loss_pct: Optional[float] = None

    model_config = {"from_attributes": True}


# --- Fixed Income Schemas ---

class FixedIncomeCreate(BaseModel):
    name: str
    issuer: str
    asset_subtype: str
    invested_amount: Decimal
    purchase_date: date
    maturity_date: date
    rate_type: str
    rate_value: Decimal
    is_tax_exempt: bool = False


class FixedIncomeUpdate(BaseModel):
    name: Optional[str] = None
    issuer: Optional[str] = None
    asset_subtype: Optional[str] = None
    invested_amount: Optional[Decimal] = None
    purchase_date: Optional[date] = None
    maturity_date: Optional[date] = None
    rate_type: Optional[str] = None
    rate_value: Optional[Decimal] = None
    current_estimated_value: Optional[Decimal] = None
    is_tax_exempt: Optional[bool] = None


class FixedIncomeResponse(BaseModel):
    id: int
    name: str
    issuer: str
    asset_subtype: str
    invested_amount: Decimal
    purchase_date: date
    maturity_date: date
    rate_type: str
    rate_value: Decimal
    current_estimated_value: Optional[Decimal] = None
    is_tax_exempt: bool
    created_at: datetime
    updated_at: datetime
    days_to_maturity: Optional[int] = None
    gross_profit: Optional[float] = None
    net_profit: Optional[float] = None

    model_config = {"from_attributes": True}


# --- Watchlist Schemas ---

class WatchlistItemCreate(BaseModel):
    asset_type: str
    identifier: str
    name: str


class WatchlistItemResponse(BaseModel):
    id: int
    asset_type: str
    identifier: str
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Analysis Schemas ---

class AnalysisResponse(BaseModel):
    id: int
    asset_identifier: str
    asset_type: str
    analysis_type: str
    result_json: dict[str, Any]
    recommendation: str
    confidence: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AnalysisTriggerRequest(BaseModel):
    analysis_type: str = "full"


class RatesResponse(BaseModel):
    cdi: float
    selic: float
    ipca: float


# --- Report Schemas ---

class ReportResponse(BaseModel):
    id: int
    report_type: str
    title: str
    content_json: dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}


class ReportGenerateRequest(BaseModel):
    report_type: str = "daily"


# --- Notification Schemas ---

class NotificationResponse(BaseModel):
    id: int
    title: str
    body: str
    is_read: bool
    notification_type: str
    metadata_json: Optional[dict[str, Any]] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Portfolio Summary ---

class AssetClassSummary(BaseModel):
    asset_class: str
    total_value: float
    total_invested: float
    profit_loss: float
    profit_loss_pct: float
    count: int
    allocation_pct: float


class PortfolioSummaryResponse(BaseModel):
    total_net_worth: float
    total_invested: float
    total_profit_loss: float
    total_profit_loss_pct: float
    breakdown: list[AssetClassSummary]


# --- Chat Schemas ---

class ChatMessage(BaseModel):
    role: str
    content: str
    timestamp: Optional[datetime] = None


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = Field(default_factory=list)


# --- CSV Import ---

class CSVImportResponse(BaseModel):
    imported: int
    errors: list[str]
    asset_type: str
