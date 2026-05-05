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
  /** Value from bank/broker — overrides model quote when set */
  reportedPositionValue?: number | null;
  /** Fixed income only — app's modeled balance before statement override */
  modelEstimatedValue?: number | null;
  cdiIndexMode?: "FIXED" | "RANGE";
  rateCeilingValue?: number | null;
  projectionCdiPercent?: number | null;
  /** Raw contract rate_value (% of CDI, spread, etc.) for editing */
  rateValueForCdi?: number | null;
  /** Backend RateType for fixed income (e.g. PCT_CDI) */
  rateContractType?: string;
  priceHistory?: number[];
}
