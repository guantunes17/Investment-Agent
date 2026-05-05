import csv
import io
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.stock_position import AssetSubtype, StockPosition
from app.models.fixed_income import (
    CDIIndexMode,
    FixedIncomePosition,
    FixedIncomeSubtype,
    RateType,
)
from app.services.fixed_income_csv import (
    infer_asset_subtype,
    looks_like_fixed_income,
    normalize_fixed_income_row,
    parse_brazilian_rate,
    parse_decimal_br,
    read_csv_rows,
)


class CSVImportService:
    def __init__(self, db: AsyncSession):
        self._db = db

    async def import_csv(self, file_content: bytes, asset_type: Optional[str] = None) -> dict:
        fieldnames, rows_raw = read_csv_rows(file_content)
        headers_lower = [str(h).strip().lower() for h in fieldnames if h]

        normalized_samples = [normalize_fixed_income_row(r) for r in rows_raw[:3]]

        if not asset_type:
            asset_type = self._detect_asset_type(headers_lower, normalized_samples)

        imported = 0
        errors = []

        for i, raw in enumerate(rows_raw, start=2):
            row = normalize_fixed_income_row(raw) if asset_type == "fixed_income" else {
                (k.strip().lower() if k else ""): (v or "").strip()
                for k, v in raw.items() if k
            }
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

    def _detect_asset_type(self, headers: list[str], sample_rows: list[dict[str, str]]) -> str:
        joined = " ".join(headers)
        if looks_like_fixed_income(headers, sample_rows):
            return "fixed_income"
        if "maturity_date" in headers or "rate_type" in headers or "issuer" in headers:
            return "fixed_income"
        if "ticker" in headers:
            return "stock"
        if sample_rows and sample_rows[0].get("name") and not sample_rows[0].get("ticker"):
            # Broker FI export often has product name but no ticker
            if sample_rows[0].get("invested_amount") or sample_rows[0].get("maturity_date"):
                return "fixed_income"
        return "stock"

    async def _import_stock_row(self, row: dict) -> None:
        ticker = row.get("ticker", "")
        if not ticker:
            raise ValueError("Missing ticker")
        sub = row.get("asset_subtype", "STOCK").upper()
        try:
            ast = AssetSubtype(sub)
        except ValueError:
            ast = AssetSubtype.STOCK
        rv_raw = (row.get("reported_position_value") or "").strip()
        reported = None
        if rv_raw:
            try:
                reported = parse_decimal_br(rv_raw)
            except (InvalidOperation, ValueError):
                reported = Decimal(rv_raw.replace(",", "."))
        position = StockPosition(
            ticker=ticker.upper(),
            name=row.get("name", ticker),
            exchange=row.get("exchange", "B3"),
            asset_subtype=ast,
            quantity=Decimal(row.get("quantity", "0")),
            avg_price=Decimal(row.get("avg_price", "0")),
            reported_position_value=reported,
        )
        self._db.add(position)

    async def _import_fixed_income_row(self, row: dict) -> None:
        name = row.get("name", "").strip()
        if not name:
            raise ValueError("Missing name (product title)")

        issuer = (row.get("issuer") or "").strip() or "Não informado"

        invested_raw = row.get("invested_amount", "0") or "0"
        try:
            invested_amount = parse_decimal_br(invested_raw)
        except (InvalidOperation, ValueError):
            invested_amount = Decimal(row.get("invested_amount", "0").replace(",", "."))

        purchase_date = self._parse_date(row.get("purchase_date", ""))
        maturity_date = self._parse_date(row.get("maturity_date", ""))

        explicit_subtype = (row.get("asset_subtype") or "").strip().upper()
        subtype = infer_asset_subtype(name, explicit_subtype)
        subtype = self._coerce_subtype(subtype)

        rate_type_str, rate_value = self._resolve_rate(row)
        rate_type_str, rate_value = self._coerce_rate(rate_type_str, rate_value)

        tax_raw = row.get("is_tax_exempt", "").lower()
        is_tax_exempt = tax_raw in ("true", "1", "yes", "sim", "s")
        if not tax_raw and subtype in ("LCI", "LCA"):
            is_tax_exempt = True

        subtype_enum = (
            FixedIncomeSubtype(subtype)
            if subtype in {m.value for m in FixedIncomeSubtype}
            else FixedIncomeSubtype.CDB
        )

        mode_raw = (row.get("cdi_index_mode") or "FIXED").strip().upper()
        cdi_mode = CDIIndexMode.RANGE if mode_raw == "RANGE" else CDIIndexMode.FIXED

        ceiling_raw = (row.get("rate_ceiling_value") or "").strip()
        rate_ceiling = None
        if ceiling_raw:
            try:
                rate_ceiling = parse_decimal_br(ceiling_raw)
            except (InvalidOperation, ValueError):
                rate_ceiling = Decimal(ceiling_raw.replace(",", "."))

        proj_raw = (row.get("projection_cdi_percent") or "").strip()
        projection = None
        if proj_raw:
            try:
                projection = parse_decimal_br(proj_raw)
            except (InvalidOperation, ValueError):
                projection = Decimal(proj_raw.replace(",", "."))

        rep_raw = (row.get("reported_position_value") or "").strip()
        reported_fi = None
        if rep_raw:
            try:
                reported_fi = parse_decimal_br(rep_raw)
            except (InvalidOperation, ValueError):
                reported_fi = Decimal(rep_raw.replace(",", "."))

        position = FixedIncomePosition(
            name=name[:200],
            issuer=issuer[:200],
            asset_subtype=subtype_enum,
            invested_amount=invested_amount,
            purchase_date=purchase_date,
            maturity_date=maturity_date,
            rate_type=RateType(rate_type_str),
            rate_value=rate_value,
            cdi_index_mode=cdi_mode,
            rate_ceiling_value=rate_ceiling,
            projection_cdi_percent=projection,
            reported_position_value=reported_fi,
            is_tax_exempt=is_tax_exempt,
        )
        self._db.add(position)

    def _coerce_subtype(self, subtype: str) -> str:
        valid = {m.value for m in FixedIncomeSubtype}
        if subtype in valid:
            return subtype
        return FixedIncomeSubtype.CDB.value

    def _coerce_rate(self, rate_type_str: str, rate_value: Decimal) -> tuple[str, Decimal]:
        valid_rt = {m.value for m in RateType}
        rt = rate_type_str.upper().replace("-", "_")
        if rt not in valid_rt:
            rt = RateType.PCT_CDI.value
        return rt, rate_value

    def _resolve_rate(self, row: dict) -> tuple[str, Decimal]:
        raw = (row.get("rate_raw") or "").strip()
        if row.get("rate_type") and row.get("rate_value"):
            try:
                rt = row.get("rate_type", "PCT_CDI").upper().replace("-", "_")
                rv = Decimal(str(row.get("rate_value", "0")).replace(",", "."))
                return rt, rv
            except (InvalidOperation, ValueError):
                pass
        if raw:
            return parse_brazilian_rate(raw)
        return parse_brazilian_rate("")

    def _parse_date(self, value: str) -> date:
        if not value:
            raise ValueError("Missing date value")
        v = value.strip()
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y"):
            try:
                return datetime.strptime(v, fmt).date()
            except ValueError:
                continue
        raise ValueError(f"Cannot parse date: {value}")
