"""Helpers for Brazilian broker CSV exports (BTG, XP-style) and rate conventions."""

from __future__ import annotations

import csv
import io
import re
from decimal import Decimal, InvalidOperation
from typing import Optional


def detect_delimiter(sample: str) -> str:
    """Prefer ';' (Brazilian Excel) vs ',' when ambiguous."""
    first_line = sample.splitlines()[0] if sample else ""
    semi = first_line.count(";")
    comma = first_line.count(",")
    if semi > comma:
        return ";"
    try:
        dialect = csv.Sniffer().sniff(sample[:8192], delimiters=",;\t")
        return dialect.delimiter
    except csv.Error:
        return ","


def parse_decimal_br(value: str) -> Decimal:
    """Accept '1.234,56', '1234.56', '1 234,56'."""
    if value is None:
        raise InvalidOperation
    s = str(value).strip().strip('"').replace(" ", "").replace("R$", "")
    if not s:
        raise InvalidOperation
    # Brazilian: thousands . and decimal ,
    if "," in s and "." in s:
        if s.rfind(",") > s.rfind("."):
            s = s.replace(".", "").replace(",", ".")
        else:
            s = s.replace(",", "")
    elif "," in s:
        parts = s.split(",")
        if len(parts) == 2 and len(parts[1]) <= 2:
            s = parts[0].replace(".", "") + "." + parts[1]
        else:
            s = s.replace(",", ".")
    return Decimal(s)


_HEADER_ALIASES: dict[str, str] = {
    # Portuguese / brokers
    "nome": "name",
    "produto": "name",
    "titulo": "name",
    "ativo": "name",
    "descricao": "name",
    "papel": "name",
    "emissor": "issuer",
    "instituicao": "issuer",
    "instituição": "issuer",
    "banco": "issuer",
    "corretora": "issuer",
    "valor aplicado": "invested_amount",
    "valor investido": "invested_amount",
    "valor da aplicacao": "invested_amount",
    "valor da aplicação": "invested_amount",
    "vl aplicado": "invested_amount",
    "vl. aplicado": "invested_amount",
    "saldo": "invested_amount",
    "posicao": "invested_amount",
    "posição": "invested_amount",
    "data aplicacao": "purchase_date",
    "data da aplicacao": "purchase_date",
    "data da aplicação": "purchase_date",
    "data aplicação": "purchase_date",
    "data compra": "purchase_date",
    "dt aplicacao": "purchase_date",
    "dt. aplicacao": "purchase_date",
    "data de aquisicao": "purchase_date",
    "data de aquisição": "purchase_date",
    "vencimento": "maturity_date",
    "data vencimento": "maturity_date",
    "dt vencimento": "maturity_date",
    "vencto": "maturity_date",
    "taxa": "rate_raw",
    "rentabilidade": "rate_raw",
    "indexador": "rate_raw",
    "tipo": "asset_subtype",
    "classe": "asset_subtype",
    "isin": "isin",
}


def normalize_header(h: str) -> str:
    key = h.strip().lower().strip('"')
    key = re.sub(r"\s+", " ", key)
    return _HEADER_ALIASES.get(key, key)


def normalize_fixed_income_row(raw: dict[str, str]) -> dict[str, str]:
    """Map arbitrary broker columns to canonical keys."""
    out: dict[str, str] = {}
    for k, v in raw.items():
        if k is None:
            continue
        nk = normalize_header(k)
        # Keep first canonical wins; merge duplicates only if empty
        val = (v or "").strip()
        if nk not in out or not out[nk]:
            out[nk] = val
    return out


_RATE_PATTERNS = [
    (re.compile(r"(\d+[.,]?\d*)\s*%\s*(?:do\s*)?cdi", re.I), "PCT_CDI"),
    (re.compile(r"cdi\s*\+\s*(\d+[.,]?\d*)\s*%?", re.I), "CDI_PLUS"),
    (re.compile(r"(\d+[.,]?\d*)\s*%\s*cdi\s*\+", re.I), "CDI_PLUS"),  # unusual order
    (re.compile(r"ipca\s*\+\s*(\d+[.,]?\d*)\s*%?", re.I), "IPCA_PLUS"),
    (re.compile(r"(\d+[.,]?\d*)\s*%\s*(?:a\.?\s*a\.?|ao\s*ano)?", re.I), "PRE"),
    (re.compile(r"pr[eé]\s*[:\s]*(\d+[.,]?\d*)\s*%?", re.I), "PRE"),
    (re.compile(r"selic\s*\+\s*(\d+[.,]?\d*)\s*%?", re.I), "SELIC_PLUS"),
]


def parse_brazilian_rate(text: str) -> tuple[str, Decimal]:
    """
    Map common BR phrases to (rate_type, rate_value).
    PCT_CDI: multiplier as % of CDI (e.g. 110 -> 110% of CDI daily composition).
    Others: value is spread or annual % per YieldCalculator expectations.
    """
    if not text or not text.strip():
        return "PCT_CDI", Decimal("100")

    s = text.strip().replace("%", " %")
    s_lower = s.lower()

    for rx, kind in _RATE_PATTERNS:
        m = rx.search(s_lower)
        if m:
            num = m.group(1).replace(",", ".")
            try:
                val = Decimal(num)
            except InvalidOperation:
                continue
            if kind == "PRE":
                return "PRE", val
            if kind == "PCT_CDI":
                return "PCT_CDI", val
            if kind == "CDI_PLUS":
                return "CDI_PLUS", val
            if kind == "IPCA_PLUS":
                return "IPCA_PLUS", val
            if kind == "SELIC_PLUS":
                return "SELIC_PLUS", val

    # Fallback: lone number + CDI mention
    if "cdi" in s_lower and "+" not in s_lower:
        nums = re.findall(r"(\d+[.,]?\d*)", s_lower)
        if nums:
            try:
                return "PCT_CDI", Decimal(nums[0].replace(",", "."))
            except InvalidOperation:
                pass

    return "PCT_CDI", Decimal("100")


def infer_asset_subtype(name: str, explicit: str = "") -> str:
    """Map product title to FixedIncomeSubtype enum string (must match DB enum)."""
    x = f"{explicit} {name}".upper()
    if "TESOURO IPCA" in x or "NTN-B" in x:
        return "TESOURO_IPCA"
    if "TESOURO SELIC" in x or "LFT" in x:
        return "TESOURO_SELIC"
    if "TESOURO PREFIXADO" in x or "NTN-F" in x or "LTN" in x:
        return "TESOURO_PRE"
    if "DEBENTURE INFRA" in x or " INFRA " in x or x.endswith(" INFRA"):
        return "INFRA"
    if "LCI" in x and "LCIA" not in x:
        return "LCI"
    if "LCA" in x:
        return "LCA"
    if explicit:
        e = explicit.upper().strip()
        for token in ("CDB", "LCI", "LCA", "TESOURO_SELIC", "TESOURO_IPCA", "TESOURO_PRE", "INFRA"):
            if token in e or e == token.replace("_", " "):
                return token
        if "CDB" in e:
            return "CDB"
    return "CDB"


def read_csv_rows(content: bytes) -> tuple[list[str], list[dict[str, str]]]:
    """Decode UTF-8 (with BOM) or Latin-1 (legacy Excel), sniff delimiter."""
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1")
    delim = detect_delimiter(text)
    reader = csv.DictReader(io.StringIO(text), delimiter=delim)
    fieldnames = list(reader.fieldnames or [])
    rows = []
    for row in reader:
        cleaned = {k: (v or "").strip() for k, v in row.items() if k}
        rows.append(cleaned)
    return fieldnames, rows


def looks_like_fixed_income(headers_lower: list[str], sample_rows: list[dict[str, str]]) -> bool:
    joined = " ".join(headers_lower).lower()
    if any(
        k in joined
        for k in (
            "vencimento",
            "maturity",
            "aplicacao",
            "aplicação",
            "invested_amount",
            "cdi",
            "taxa",
            "cdb",
            "lci",
            "tesouro",
        )
    ):
        return True
    if sample_rows:
        r = normalize_fixed_income_row(sample_rows[0])
        if r.get("maturity_date") or r.get("purchase_date") or r.get("invested_amount"):
            return True
    return False
