"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge, type RecommendationType } from "@/components/ui/badge";
import { Gauge } from "@/components/ui/gauge";
import { Button } from "@/components/ui/button";
import { LoadingCard } from "@/components/ui/loading";
import { CandlestickChart, type OHLCVData } from "@/components/charts/candlestick-chart";
import { useAssetDetail, usePortfolio } from "@/hooks/use-portfolio";
import { PositionAlignmentForm } from "@/app/portfolio/position-alignment-form";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { ArrowLeft, TrendingUp, Calendar, Percent, DollarSign, RefreshCw } from "lucide-react";
import Link from "next/link";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

const PERIODS = [
  { label: "1M", value: "1mo" },
  { label: "3M", value: "3mo" },
  { label: "6M", value: "6mo" },
  { label: "1Y", value: "1y" },
] as const;

type Period = (typeof PERIODS)[number]["value"];

export default function AssetDetailPage({
  params,
}: {
  params: Promise<{ assetId: string }>;
}) {
  const { assetId } = use(params);
  const { data: asset, isLoading, refetch } = useAssetDetail(assetId);
  const { refetch: refetchPortfolio } = usePortfolio();
  const [period, setPeriod] = useState<Period>("3mo");

  const isEquity = asset?.assetType === "stock" || asset?.assetType === "fii";

  const {
    data: ohlcvData,
    isLoading: isOhlcvLoading,
  } = useQuery<OHLCVData[]>({
    queryKey: ["ohlcv", asset?.ticker, period],
    queryFn: () =>
      apiFetch<{ date: string; open: number; high: number; low: number; close: number; volume: number }[]>(
        `/analysis/historical/${asset!.ticker}?period=${period}`
      ).then((rows) =>
        rows.map((r) => ({
          time: r.date.slice(0, 10),
          open: r.open,
          high: r.high,
          low: r.low,
          close: r.close,
          volume: r.volume,
        }))
      ),
    enabled: !!asset?.ticker && isEquity,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingCard />
        <LoadingCard />
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-text-muted">Asset not found</p>
        <Link href="/portfolio">
          <Button variant="ghost">
            <ArrowLeft className="h-4 w-4" />
            Back to Portfolio
          </Button>
        </Link>
      </div>
    );
  }

  const isFixedIncome = asset.assetType === "fixed-income";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/portfolio">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-text-primary">
              {asset.ticker}
            </h1>
            {asset.recommendation && (
              <Badge recommendation={asset.recommendation as RecommendationType} />
            )}
          </div>
          <p className="text-sm text-text-muted">{asset.name}</p>
          <p className="mt-1 text-xs text-text-muted">
            Edit using the sections below — each block has its own save action.
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-2xl font-bold text-text-primary">
            {formatCurrency(asset.currentPrice)}
          </p>
          <p
            className={cn(
              "text-sm font-semibold",
              asset.pnlPercent >= 0 ? "text-profit" : "text-loss"
            )}
          >
            {formatPercent(asset.pnlPercent)}
          </p>
        </div>
      </div>

      {/* Chart section */}
      {isEquity && (
        <GlassCard>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-medium text-text-muted">Price Chart</h3>
            <div className="flex items-center gap-1">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  className={cn(
                    "rounded-lg px-3 py-1 text-xs font-medium transition-colors",
                    period === p.value
                      ? "bg-accent/20 text-accent"
                      : "text-text-muted hover:bg-glass-hover hover:text-text-secondary"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          {isOhlcvLoading ? (
            <div className="flex h-[350px] items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin text-text-muted" />
            </div>
          ) : (ohlcvData && ohlcvData.length > 0) ? (
            <CandlestickChart
              data={ohlcvData}
              overlays={[
                { type: "SMA", period: 20, color: "#3366ff" },
                { type: "EMA", period: 9, color: "#aa33ff" },
              ]}
              height={350}
            />
          ) : (
            <div className="flex h-[350px] items-center justify-center text-sm text-text-muted">
              No chart data available for this period
            </div>
          )}
        </GlassCard>
      )}

      {/* Fixed income yield progression (simulated — fixed income has no OHLCV) */}
      {isFixedIncome && (
        <GlassCard>
          <h3 className="mb-4 text-sm font-medium text-text-muted">
            Yield Progression{" "}
            <span className="text-[10px] text-text-muted/60">(simulated projection)</span>
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={Array.from({ length: 12 }, (_, i) => ({
                  month: `M${i + 1}`,
                  yield: (asset.yieldPercent || 10) * (0.6 + (i / 12) * 0.5),
                }))}
              >
                <XAxis dataKey="month" stroke="#606070" fontSize={12} />
                <YAxis stroke="#606070" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(10,10,26,0.9)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "12px",
                    color: "#f0f0f0",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="yield"
                  stroke="#00ff88"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      )}

      <GlassCard>
        <PositionAlignmentForm
          position={asset}
          onSaved={() => {
            void refetch();
            void refetchPortfolio();
          }}
        />
      </GlassCard>

      {/* Metrics grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isEquity && (
          <>
            <MetricCard
              icon={<TrendingUp className="h-4 w-4 text-accent" />}
              label="RSI (14)"
              value={asset.technicals?.rsi?.toString() || "52"}
            >
              <Gauge value={asset.technicals?.rsi || 52} size={80} label="RSI" />
            </MetricCard>
            <MetricCard
              icon={<Percent className="h-4 w-4 text-profit" />}
              label="Dividend Yield"
              value={`${(asset.dividendYield || 4.2).toFixed(2)}%`}
            />
            {asset.assetType === "fii" && (
              <MetricCard
                icon={<DollarSign className="h-4 w-4 text-secondary" />}
                label="P/VP"
                value={(asset.pvp || 0.95).toFixed(2)}
              />
            )}
            <MetricCard
              icon={<TrendingUp className="h-4 w-4 text-hold" />}
              label="Confidence"
            >
              <Gauge value={asset.confidence || 75} size={80} label="Score" />
            </MetricCard>
          </>
        )}

        {isFixedIncome && (
          <>
            <MetricCard
              icon={<Percent className="h-4 w-4 text-profit" />}
              label="Rate"
              value={asset.rate || "CDI + 2%"}
            />
            <MetricCard
              icon={<DollarSign className="h-4 w-4 text-accent" />}
              label="Invested"
              value={formatCurrency(asset.investedAmount || asset.avgPrice * asset.quantity)}
            />
            <MetricCard
              icon={<Calendar className="h-4 w-4 text-hold" />}
              label="Maturity"
              value={asset.maturityDate ? asset.maturityDate : "Open-ended (no fixed date)"}
            />
            <MetricCard
              icon={<TrendingUp className="h-4 w-4 text-secondary" />}
              label="Tax Status"
              value={asset.taxStatus || "IOF exempt (30d+)"}
            />
          </>
        )}

      </div>

      {/* Sentiment / Recommendation */}
      {asset.recommendation && (
        <GlassCard glow={asset.recommendation === "BUY" ? "#00ff88" : asset.recommendation === "SELL" ? "#ff3366" : "#ffaa00"}>
          <div className="flex items-center gap-4">
            <Badge recommendation={asset.recommendation as RecommendationType} />
            <div>
              <p className="text-sm font-medium text-text-primary">AI Recommendation</p>
              <p className="text-xs text-text-muted">
                Based on technical analysis, fundamentals, and market sentiment
              </p>
            </div>
            {asset.confidence && (
              <div className="ml-auto">
                <Gauge value={asset.confidence} size={80} label="Confidence" />
              </div>
            )}
          </div>
        </GlassCard>
      )}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <GlassCard className="flex flex-col items-center gap-2 p-4 text-center">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs text-text-muted">{label}</span>
      </div>
      {children || <p className="text-lg font-bold text-text-primary">{value}</p>}
    </GlassCard>
  );
}
