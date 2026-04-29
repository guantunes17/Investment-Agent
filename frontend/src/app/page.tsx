"use client";

import { GlassCard } from "@/components/ui/glass-card";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Badge, type RecommendationType } from "@/components/ui/badge";
import { Sparkline } from "@/components/ui/sparkline";
import { LoadingCard } from "@/components/ui/loading";
import { usePortfolioStore } from "@/stores/portfolio-store";
import { usePortfolio } from "@/hooks/use-portfolio";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, AlertCircle, Clock, ArrowUpRight } from "lucide-react";
import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";

const assetClassColors: Record<string, string> = {
  stock: "#00ff88",
  "fixed-income": "#3366ff",
  fii: "#aa33ff",
};

export default function Dashboard() {
  const { isLoading } = usePortfolio();
  const { positions, totalValue, dailyPnl, dailyPnlPercent } = usePortfolioStore();

  const allocationData = Object.entries(
    positions.reduce<Record<string, number>>((acc, p) => {
      acc[p.assetType] = (acc[p.assetType] || 0) + p.currentPrice * p.quantity;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value, fill: assetClassColors[name] || "#666" }));

  const topMovers = [...positions]
    .sort((a, b) => Math.abs(b.pnlPercent) - Math.abs(a.pnlPercent))
    .slice(0, 5);

  const maturities = positions
    .filter((p) => p.assetType === "fixed-income" && p.maturityDate)
    .sort((a, b) => new Date(a.maturityDate!).getTime() - new Date(b.maturityDate!).getTime())
    .slice(0, 4);

  if (isLoading && positions.length === 0) {
    return (
      <div className="space-y-6">
        <LoadingCard />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <LoadingCard />
          <LoadingCard />
          <LoadingCard />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero section */}
      <GlassCard className="relative overflow-hidden">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-text-muted">Total Portfolio Value</p>
            <div className="mt-1 text-4xl font-bold tracking-tight text-text-primary">
              <AnimatedNumber
                value={totalValue}
                format={(n) => formatCurrency(n)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {dailyPnl >= 0 ? (
              <TrendingUp className="h-5 w-5 text-profit" />
            ) : (
              <TrendingDown className="h-5 w-5 text-loss" />
            )}
            <span
              className={cn(
                "text-xl font-bold",
                dailyPnl >= 0 ? "text-profit" : "text-loss"
              )}
              style={{
                textShadow: dailyPnl >= 0
                  ? "0 0 12px rgba(0,255,136,0.4)"
                  : "0 0 12px rgba(255,51,102,0.4)",
              }}
            >
              {formatCurrency(dailyPnl)} ({formatPercent(dailyPnlPercent)})
            </span>
          </div>
        </div>
      </GlassCard>

      {/* Asset class allocation bar */}
      {allocationData.length > 0 && (
        <GlassCard>
          <h3 className="mb-4 text-sm font-medium text-text-muted">Asset Class Allocation</h3>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={allocationData} layout="vertical">
                <XAxis type="number" hide />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(10,10,26,0.9)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "12px",
                    color: "#f0f0f0",
                  }}
                  formatter={(value: number) => [formatCurrency(value), "Value"]}
                />
                <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={28}>
                  {allocationData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap gap-4">
            {allocationData.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.fill }} />
                <span className="text-xs capitalize text-text-secondary">{item.name.replace("-", " ")}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Cards grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Top Movers */}
        <GlassCard hover>
          <div className="mb-3 flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-medium text-text-secondary">Top Movers</h3>
          </div>
          <div className="flex flex-col gap-3">
            {topMovers.length === 0 ? (
              <p className="text-sm text-text-muted">No positions yet</p>
            ) : (
              topMovers.map((pos) => (
                <div key={pos.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">{pos.ticker}</span>
                    {pos.priceHistory && (
                      <Sparkline data={pos.priceHistory} className="w-16" height={20} />
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      pos.pnlPercent >= 0 ? "text-profit" : "text-loss"
                    )}
                  >
                    {formatPercent(pos.pnlPercent)}
                  </span>
                </div>
              ))
            )}
          </div>
        </GlassCard>

        {/* Approaching Maturities */}
        <GlassCard hover>
          <div className="mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-hold" />
            <h3 className="text-sm font-medium text-text-secondary">Approaching Maturities</h3>
          </div>
          <div className="flex flex-col gap-3">
            {maturities.length === 0 ? (
              <p className="text-sm text-text-muted">No maturities approaching</p>
            ) : (
              maturities.map((pos) => {
                const days = Math.ceil(
                  (new Date(pos.maturityDate!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                );
                return (
                  <div key={pos.id} className="flex items-center justify-between">
                    <span className="text-sm text-text-primary">{pos.name}</span>
                    <span className={cn("text-xs font-medium", days <= 30 ? "text-loss" : "text-hold")}>
                      {days}d
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </GlassCard>

        {/* Recent Alerts */}
        <GlassCard hover>
          <div className="mb-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-secondary" />
            <h3 className="text-sm font-medium text-text-secondary">Agent Recommendations</h3>
          </div>
          <div className="flex flex-col gap-3">
            {positions.filter((p) => p.recommendation).length === 0 ? (
              <p className="text-sm text-text-muted">No active recommendations</p>
            ) : (
              positions
                .filter((p) => p.recommendation)
                .slice(0, 4)
                .map((pos) => (
                  <div key={pos.id} className="flex items-center justify-between">
                    <span className="text-sm text-text-primary">{pos.ticker}</span>
                    <Badge recommendation={pos.recommendation as RecommendationType} />
                  </div>
                ))
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
