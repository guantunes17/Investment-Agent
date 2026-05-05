import type { AssetType, Position } from "@/stores/portfolio-store";

interface ApiStock {
  id: number;
  ticker: string;
  name: string;
  exchange?: string;
  asset_subtype?: string;
  quantity?: number | string;
  avg_price?: number | string;
  current_price?: number | string | null;
  profit_loss?: number | string | null;
  profit_loss_pct?: number | string | null;
}

interface ApiFixedIncome {
  id: number;
  name: string;
  issuer?: string;
  asset_subtype?: string;
  invested_amount?: number | string;
  purchase_date?: string;
  maturity_date?: string;
  rate_type?: string;
  rate_value?: number | string;
  current_estimated_value?: number | string | null;
  is_tax_exempt?: boolean;
  gross_profit?: number | string | null;
  net_profit?: number | string | null;
}

interface ApiPortfolioEnvelope {
  stocks?: ApiStock[];
  fixed_income?: ApiFixedIncome[];
  total_positions?: number;
}

function num(x: unknown): number {
  if (typeof x === "number" && !Number.isNaN(x)) return x;
  if (typeof x === "string") {
    const v = parseFloat(x);
    return Number.isFinite(v) ? v : 0;
  }
  return 0;
}

export function mapPortfolioResponse(data: unknown): Position[] {
  if (Array.isArray(data)) {
    return data as Position[];
  }
  if (!data || typeof data !== "object") {
    return [];
  }

  const o = data as ApiPortfolioEnvelope;
  const stocks = o.stocks ?? [];
  const fixed = o.fixed_income ?? [];
  const out: Position[] = [];

  for (const s of stocks) {
    const qty = num(s.quantity);
    const avg = num(s.avg_price);
    const cur =
      s.current_price != null && s.current_price !== ""
        ? num(s.current_price)
        : avg;
    const pnl =
      s.profit_loss != null && s.profit_loss !== ""
        ? num(s.profit_loss)
        : 0;
    const pnlPct =
      s.profit_loss_pct != null && s.profit_loss_pct !== ""
        ? num(s.profit_loss_pct)
        : 0;
    const subtype = String(s.asset_subtype ?? "STOCK").toUpperCase();
    const assetType: AssetType = subtype === "FII" ? "fii" : "stock";
    out.push({
      id: `s-${s.id}`,
      assetType,
      ticker: s.ticker,
      name: s.name,
      quantity: qty,
      avgPrice: avg,
      currentPrice: cur,
      pnl,
      pnlPercent: pnlPct,
    });
  }

  for (const f of fixed) {
    const invested = num(f.invested_amount);
    const curVal =
      f.current_estimated_value != null && f.current_estimated_value !== ""
        ? num(f.current_estimated_value)
        : invested;
    let pnl = 0;
    if (f.gross_profit != null && f.gross_profit !== "") {
      pnl = num(f.gross_profit);
    } else {
      pnl = curVal - invested;
    }
    const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
    const rateLabel = [f.rate_type, f.rate_value != null ? String(f.rate_value) : ""]
      .filter(Boolean)
      .join(" ");
    out.push({
      id: `f-${f.id}`,
      assetType: "fixed-income",
      ticker:
        f.name
          .replace(/\s+/g, "-")
          .slice(0, 16)
          .toUpperCase() || `FI-${f.id}`,
      name: f.name,
      quantity: 1,
      avgPrice: invested,
      currentPrice: curVal,
      pnl,
      pnlPercent: pnlPct,
      maturityDate: f.maturity_date,
      rate: rateLabel || undefined,
      investedAmount: invested,
      currentValue: curVal,
      yieldPercent: pnlPct,
      taxStatus: f.is_tax_exempt ? "Exempt" : "Taxable",
    });
  }

  return out;
}

export function parsePositionId(
  id: string
): { kind: "stock" | "fixed"; numericId: number } | null {
  const m = id.match(/^(s|f)-(\d+)$/);
  if (!m) return null;
  return { kind: m[1] === "s" ? "stock" : "fixed", numericId: Number(m[2]) };
}
