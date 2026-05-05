"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";

interface PerformanceResponse {
  dates: string[];
  portfolio: number[];
  ibov: number[];
  cdi: number[];
}

type Period = "1m" | "3m" | "6m" | "1y" | "ytd";

const periods: { label: string; value: Period }[] = [
  { label: "1M", value: "1m" },
  { label: "3M", value: "3m" },
  { label: "6M", value: "6m" },
  { label: "1Y", value: "1y" },
  { label: "YTD", value: "ytd" },
];

function formatDate(dateStr: string) {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { color: string; name: string; value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div
      style={{
        background: "rgba(10,10,26,0.9)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "12px",
        padding: "12px 16px",
        color: "#f0f0f0",
      }}
    >
      <p className="mb-1 text-xs text-text-secondary">
        {label && formatDate(label)}
      </p>
      {payload.map((entry) => (
        <p
          key={entry.name}
          className="text-sm font-medium"
          style={{ color: entry.color }}
        >
          {entry.name}: {entry.value.toFixed(2)}%
        </p>
      ))}
    </div>
  );
}

export function PerformanceChart() {
  const [period, setPeriod] = useState<Period>("6m");

  const { data, isLoading } = useQuery({
    queryKey: ["performance", period],
    queryFn: () =>
      apiFetch<PerformanceResponse>(
        `/portfolio/performance?period=${period}`
      ),
  });

  const chartData =
    data?.dates.map((date, i) => ({
      date,
      portfolio: data.portfolio[i],
      ibov: data.ibov[i],
      cdi: data.cdi[i],
    })) ?? [];

  return (
    <GlassCard className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text-primary">
          Rentabilidade
        </h3>
        <div className="flex gap-1">
          {periods.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={cn(
                "rounded-lg px-3 py-1 text-xs font-medium transition-colors",
                period === p.value
                  ? "bg-accent/20 text-accent"
                  : "text-text-secondary hover:text-text-primary"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-[300px] items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{ fill: "#888", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => `${v.toFixed(1)}%`}
              tick={{ fill: "#888", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={50}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="bottom"
              iconType="line"
              wrapperStyle={{ paddingTop: 12, fontSize: 12 }}
            />
            <Line
              type="monotone"
              dataKey="portfolio"
              name="Carteira"
              stroke="#3366ff"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
            <Line
              type="monotone"
              dataKey="ibov"
              name="IBOV"
              stroke="#00ff88"
              strokeWidth={1.5}
              strokeDasharray="6 3"
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
            />
            <Line
              type="monotone"
              dataKey="cdi"
              name="CDI"
              stroke="#aa33ff"
              strokeWidth={1.5}
              strokeDasharray="6 3"
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </GlassCard>
  );
}
