"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { DollarSign, TrendingUp, Calendar } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { GlassCard } from "@/components/ui/glass-card";
import { LoadingCard } from "@/components/ui/loading";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";

interface DividendPosition {
  ticker: string;
  name: string;
  assetType: string;
  quantity: number;
  avgPrice: number;
  dividendYield: number;
  annualIncome: number;
  monthlyIncome: number;
  yieldOnCost: number;
}

interface MonthlyProjection {
  month: number;
  income: number;
}

interface DividendsResponse {
  positions: DividendPosition[];
  totalAnnualIncome: number;
  averageYield: number;
  monthlyProjection: MonthlyProjection[];
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default function DividendsPage() {
  const { data, isLoading } = useQuery<DividendsResponse>({
    queryKey: ["dividends"],
    queryFn: () => apiFetch<DividendsResponse>("/portfolio/dividends"),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingCard />
        <LoadingCard />
        <LoadingCard />
      </div>
    );
  }

  const {
    positions = [],
    totalAnnualIncome = 0,
    averageYield = 0,
    monthlyProjection = [],
  } = data ?? {};

  const allZero = positions.length > 0 && positions.every((p) => p.dividendYield === 0);

  const monthlyAverage = totalAnnualIncome / 12;

  const chartData = monthlyProjection.map((item) => ({
    name: MONTH_LABELS[item.month - 1] ?? `M${item.month}`,
    income: item.income,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <h1 className="text-2xl font-bold text-text-primary">
          Dividends &amp; Yield
        </h1>
        <p className="text-xs text-text-muted max-w-xs text-right">
          Covers stocks &amp; FIIs only. Fixed-income yield is shown separately in each position&apos;s detail view.
        </p>
      </div>

      {allZero && (
        <GlassCard>
          <p className="text-center text-sm text-text-muted">
            Dividend data temporarily unavailable. Market data providers may be rate-limited — try again in a few minutes.
          </p>
        </GlassCard>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <GlassCard>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-profit/10">
              <DollarSign className="h-5 w-5 text-profit" />
            </div>
            <div>
              <p className="text-xs text-text-muted">Total Annual Income</p>
              <p className="text-lg font-bold text-text-primary">
                {formatCurrency(totalAnnualIncome)}
              </p>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-profit/10">
              <TrendingUp className="h-5 w-5 text-profit" />
            </div>
            <div>
              <p className="text-xs text-text-muted">Average Yield</p>
              <p className="text-lg font-bold text-text-primary">
                {formatPercent(averageYield)}
              </p>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-profit/10">
              <Calendar className="h-5 w-5 text-profit" />
            </div>
            <div>
              <p className="text-xs text-text-muted">Monthly Average</p>
              <p className="text-lg font-bold text-text-primary">
                {formatCurrency(monthlyAverage)}
              </p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Monthly projection chart */}
      <GlassCard>
        <h3 className="mb-4 text-sm font-medium text-text-muted">
          Monthly Income Projection
        </h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="name"
                tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `R$${v}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(10, 10, 20, 0.9)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "12px",
                  color: "#fff",
                }}
                labelStyle={{ color: "rgba(255,255,255,0.6)" }}
                formatter={(value: number) => [formatCurrency(value), "Income"]}
              />
              <Bar dataKey="income" fill="#00ff88" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      {/* Positions table */}
      <GlassCard className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-glass-border text-text-muted">
              <th className="px-4 py-3 text-left font-medium">Ticker</th>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Type</th>
              <th className="px-4 py-3 text-right font-medium">Qty</th>
              <th className="px-4 py-3 text-right font-medium">Div Yield</th>
              <th className="px-4 py-3 text-right font-medium">Monthly</th>
              <th className="px-4 py-3 text-right font-medium">Annual</th>
              <th className="px-4 py-3 text-right font-medium">Yield on Cost</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((pos) => (
              <tr
                key={pos.ticker}
                className="border-b border-glass-border/50 transition-colors hover:bg-glass-hover"
              >
                <td className="px-4 py-3 font-mono font-semibold text-text-primary">
                  {pos.ticker}
                </td>
                <td className="px-4 py-3 text-text-secondary">{pos.name}</td>
                <td className="px-4 py-3">
                  <span className="rounded-md bg-glass px-2 py-0.5 text-xs capitalize text-text-muted">
                    {pos.assetType}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-text-primary">
                  {pos.quantity}
                </td>
                <td className="px-4 py-3 text-right text-profit">
                  {formatPercent(pos.dividendYield)}
                </td>
                <td className="px-4 py-3 text-right text-text-primary">
                  {formatCurrency(pos.monthlyIncome)}
                </td>
                <td className="px-4 py-3 text-right text-text-primary">
                  {formatCurrency(pos.annualIncome)}
                </td>
                <td className="px-4 py-3 text-right text-profit">
                  {formatPercent(pos.yieldOnCost)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
}
