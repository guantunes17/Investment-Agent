import { create } from "zustand";

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
  // Stock/FII specific
  dividendYield?: number;
  pvp?: number;
  // Fixed-income specific
  rate?: string;
  maturityDate?: string;
  investedAmount?: number;
  currentValue?: number;
  yieldPercent?: number;
  taxStatus?: string;
  // Price history for sparklines
  priceHistory?: number[];
}

interface PortfolioState {
  positions: Position[];
  isLoading: boolean;
  error: string | null;
  totalValue: number;
  dailyPnl: number;
  dailyPnlPercent: number;
  setPositions: (positions: Position[]) => void;
  addPosition: (position: Position) => void;
  removePosition: (id: string) => void;
  updatePosition: (id: string, updates: Partial<Position>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  getPositionsByType: (type: AssetType) => Position[];
}

export const usePortfolioStore = create<PortfolioState>((set, get) => ({
  positions: [],
  isLoading: false,
  error: null,
  totalValue: 0,
  dailyPnl: 0,
  dailyPnlPercent: 0,

  setPositions: (positions) => {
    const totalValue = positions.reduce((sum, p) => sum + p.currentPrice * p.quantity, 0);
    const totalCost = positions.reduce((sum, p) => sum + p.avgPrice * p.quantity, 0);
    const dailyPnl = positions.reduce((sum, p) => sum + p.pnl, 0);
    set({
      positions,
      totalValue,
      dailyPnl,
      dailyPnlPercent: totalCost > 0 ? (dailyPnl / totalCost) * 100 : 0,
    });
  },

  addPosition: (position) => {
    const positions = [...get().positions, position];
    get().setPositions(positions);
  },

  removePosition: (id) => {
    const positions = get().positions.filter((p) => p.id !== id);
    get().setPositions(positions);
  },

  updatePosition: (id, updates) => {
    const positions = get().positions.map((p) =>
      p.id === id ? { ...p, ...updates } : p
    );
    get().setPositions(positions);
  },

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  getPositionsByType: (type) => get().positions.filter((p) => p.assetType === type),
}));
