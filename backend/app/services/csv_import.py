import csv
import io
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.stock_position import StockPosition
from app.models.fixed_income import FixedIncomePosition


class CSVImportService:
    def __init__(self, db: AsyncSession):
        self._db = db

    async def import_csv(self, file_content: bytes, asset_type: Optional[str] = None) -> dict:
        text = file_content.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text))
        headers = [h.strip().lower() for h in (reader.fieldnames or [])]

        if not asset_type:
            asset_type = self._detect_asset_type(headers)

        imported = 0
        errors = []

        for i, row in enumerate(reader, start=2):
            row = {k.strip().lower(): v.strip() for k, v in row.items() if k}
            try:
                if asset_type == "stock":
                    await self._import_stock_row(row)
                elif asset_type == "fixed_income":
                    await self._import_fixed_income_row(row)
                else:
                    errors.append(f"Row {i}: Unknown asset type '{asset_type}'")
                    continue
                imported += 1
            except Exception as e:
                errors.append(f"Row {i}: {str(e)}")

        await self._db.commit()
        return {"imported": imported, "errors": errors, "asset_type": asset_type}

    def _detect_asset_type(self, headers: list[str]) -> str:
        if "maturity_date" in headers or "rate_type" in headers or "issuer" in headers:
            return "fixed_income"
        if "ticker" in headers:
            return "stock"
        return "stock"

    async def _import_stock_row(self, row: dict) -> None:
        ticker = row.get("ticker", "")
        if not ticker:
            raise ValueError("Missing ticker")
        position = StockPosition(
            ticker=ticker.upper(),
            name=row.get("name", ticker),
            exchange=row.get("exchange", "B3"),
            asset_subtype=row.get("asset_subtype", "STOCK").upper(),
            quantity=Decimal(row.get("quantity", "0")),
            avg_price=Decimal(row.get("avg_price", "0")),
        )
        self._db.add(position)

    async def _import_fixed_income_row(self, row: dict) -> None:
        name = row.get("name", "")
        if not name:
            raise ValueError("Missing name")
        position = FixedIncomePosition(
            name=name,
            issuer=row.get("issuer", ""),
            asset_subtype=row.get("asset_subtype", "CDB").upper(),
            invested_amount=Decimal(row.get("invested_amount", "0")),
            purchase_date=self._parse_date(row.get("purchase_date", "")),
            maturity_date=self._parse_date(row.get("maturity_date", "")),
            rate_type=row.get("rate_type", "PCT_CDI").upper(),
            rate_value=Decimal(row.get("rate_value", "0")),
            is_tax_exempt=row.get("is_tax_exempt", "false").lower() in ("true", "1", "yes"),
        )
        self._db.add(position)

    def _parse_date(self, value: str) -> date:
        if not value:
            raise ValueError("Missing date value")
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"):
            try:
                return datetime.strptime(value, fmt).date()
            except ValueError:
                continue
        raise ValueError(f"Cannot parse date: {value}")
