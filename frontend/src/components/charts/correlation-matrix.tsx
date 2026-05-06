"use client";

import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";

interface CorrelationResponse {
  tickers: string[];
  matrix: number[][];
  diversificationScore: number;
}

function correlationColor(value: number): string {
  if (value >= 0) {
    const r = Math.round(255 * (1 - value));
    const g = Math.round(255 * (1 - value) + 255 * value);
    const b = Math.round(255 * (1 - value) * 0.05 + 136 * value);
    return `rgb(${r}, ${g}, ${b})`;
  }
  const t = Math.abs(value);
  const r = Math.round(255 * (1 - t) + 255 * t);
  const g = Math.round(255 * (1 - t) - 204 * t);
  const b = Math.round(255 * 0.05 * (1 - t) + 102 * t);
  return `rgb(${Math.max(0, r)}, ${Math.max(0, g)}, ${Math.max(0, b)})`;
}

function cellOpacity(value: number): number {
  return 0.15 + Math.abs(value) * 0.85;
}

export function CorrelationMatrix() {
  const [tooltip, setTooltip] = useState<{
    row: number;
    col: number;
    x: number;
    y: number;
  } | null>(null);

  const { data, isLoading, isError } = useQuery<CorrelationResponse>({
    queryKey: ["correlation"],
    queryFn: () =>
      apiFetch<CorrelationResponse>("/portfolio/correlation", { timeout: 60_000 }),
  });

  if (isLoading) {
    return (
      <GlassCard className="animate-pulse">
        <div className="h-48 rounded-lg bg-white/5" />
      </GlassCard>
    );
  }

  if (isError || !data) {
    return (
      <GlassCard>
        <p className="text-sm text-text-secondary">
          Failed to load correlation data.
        </p>
      </GlassCard>
    );
  }

  const { tickers, matrix, diversificationScore } = data;

  if (tickers.length < 2) {
    return (
      <GlassCard>
        <p className="text-sm text-text-secondary">
          Not enough assets for correlation
        </p>
      </GlassCard>
    );
  }

  const size = tickers.length;

  return (
    <GlassCard className="space-y-4">
      <h3 className="text-sm font-medium text-text-secondary">
        Correlation Matrix
      </h3>

      <div className="relative overflow-x-auto">
        <div
          className="grid gap-[2px]"
          style={{
            gridTemplateColumns: `max-content repeat(${size}, minmax(40px, 1fr))`,
            gridTemplateRows: `max-content repeat(${size}, minmax(40px, 1fr))`,
          }}
        >
          {/* Top-left empty corner */}
          <div />

          {/* Column headers */}
          {tickers.map((ticker) => (
            <div
              key={`col-${ticker}`}
              className="flex items-end justify-center pb-1 text-[11px] font-medium text-text-secondary"
            >
              <span className="-rotate-45 origin-center whitespace-nowrap">
                {ticker}
              </span>
            </div>
          ))}

          {/* Rows */}
          {matrix.map((row, rowIdx) => (
            <Fragment key={tickers[rowIdx]}>
              <div
                className="flex items-center justify-end pr-2 text-[11px] font-medium text-text-secondary whitespace-nowrap"
              >
                {tickers[rowIdx]}
              </div>

              {/* Cells */}
              {row.map((value, colIdx) => {
                const isDiagonal = rowIdx === colIdx;
                const color = correlationColor(value);
                const opacity = cellOpacity(value);

                return (
                  <div
                    key={`${rowIdx}-${colIdx}`}
                    className={cn(
                      "relative flex cursor-default items-center justify-center rounded-sm transition-transform duration-150 hover:scale-105 hover:z-10",
                      isDiagonal && "ring-1 ring-white/20"
                    )}
                    style={{
                      backgroundColor: color,
                      opacity,
                      aspectRatio: "1",
                    }}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setTooltip({
                        row: rowIdx,
                        col: colIdx,
                        x: rect.left + rect.width / 2,
                        y: rect.top,
                      });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    <span className="text-[10px] font-semibold text-white mix-blend-difference select-none">
                      {value.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-lg border border-white/10 bg-[rgba(10,10,26,0.95)] px-3 py-2 text-xs text-text-primary shadow-lg backdrop-blur-md"
            style={{ left: tooltip.x, top: tooltip.y - 8 }}
          >
            <span className="font-medium text-white">
              {tickers[tooltip.row]}
            </span>
            <span className="mx-1 text-text-secondary">×</span>
            <span className="font-medium text-white">
              {tickers[tooltip.col]}
            </span>
            <span className="ml-2 tabular-nums" style={{ color: correlationColor(matrix[tooltip.row][tooltip.col]) }}>
              {matrix[tooltip.row][tooltip.col].toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {/* Diversification score */}
      <div className="flex items-center justify-between border-t border-white/5 pt-3">
        <span className="text-xs text-text-secondary">
          Diversification Score
        </span>
        <span
          className="text-sm font-semibold tabular-nums"
          style={{ color: correlationColor(diversificationScore) }}
        >
          {(diversificationScore * 100).toFixed(0)}%
        </span>
      </div>
    </GlassCard>
  );
}
