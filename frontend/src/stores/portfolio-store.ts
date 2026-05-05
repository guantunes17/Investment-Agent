export type AssetType = "stock" | "fixed-income" | "fii";

export interface Position {
  id: string;
  assetType: AssetType;
  ticker: string;
  name: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  recommendation?: string;
  confidence?: number;
  dividendYield?: number;
  pvp?: number;
  rate?: string;
  maturityDate?: string;
  investedAmount?: number;
  currentValue?: number;
  yieldPercent?: number;
  taxStatus?: string;
  priceHistory?: number[];
}
