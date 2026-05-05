"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { GlassCard } from "@/components/ui/glass-card";
import { LoadingCard } from "@/components/ui/loading";
import { cn, formatCurrency } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Calendar,
  BarChart3,
} from "lucide-react";

interface DailyPnl {
  date: string;
  pnl: number;
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const DAY_LABELS = ["Mon", "", "Wed", "", "Fri", "", ""];

function getColorClass(pnl: number, maxAbsPnl: number): string {
  if (maxAbsPnl === 0) return "bg-white/5";
  const ratio = Math.abs(pnl) / maxAbsPnl;

  if (pnl > 0) {
    if (ratio > 0.75) return "bg-green-500/90";
    if (ratio > 0.5) return "bg-green-500/65";
    if (ratio > 0.25) return "bg-green-500/40";
    return "bg-green-500/20";
  }
  if (ratio > 0.75) return "bg-red-500/80";
  if (ratio > 0.5) return "bg-red-500/55";
  if (ratio > 0.25) return "bg-red-500/35";
  return "bg-red-500/15";
}

interface WeekCell {
  date: Date;
  dateStr: string;
  pnl: number | null;
  dayOfWeek: number;
}

function buildCalendarGrid(year: number, pnlMap: Map<string, number>) {
  const jan1 = new Date(year, 0, 1);
  const dec31 = new Date(year, 11, 31);

  const startDow = (jan1.getDay() + 6) % 7; // 0=Mon
  const gridStart = new Date(jan1);
  gridStart.setDate(gridStart.getDate() - startDow);

  const weeks: WeekCell[][] = [];
  const monthStartWeeks: { month: number; weekIdx: number }[] = [];
  let currentMonth = -1;
  const cursor = new Date(gridStart);

  while (cursor <= dec31 || cursor.getDay() !== 1) {
    const week: WeekCell[] = [];
    for (let d = 0; d < 7; d++) {
      const dateStr = formatDateStr(cursor);
      const isInYear =
        cursor.getFullYear() === year;
      const pnlVal = isInYear ? (pnlMap.get(dateStr) ?? null) : null;
      const month = cursor.getMonth();

      if (isInYear && month !== currentMonth) {
        currentMonth = month;
        monthStartWeeks.push({ month, weekIdx: weeks.length });
      }

      week.push({
        date: new Date(cursor),
        dateStr,
        pnl: pnlVal,
        dayOfWeek: d,
      });

      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);

    if (cursor.getFullYear() > year && cursor.getDay() === 1) break;
  }

  return { weeks, monthStartWeeks };
}

function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDisplayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${MONTH_LABELS[Number(m) - 1]} ${Number(d)}, ${y}`;
}

export default function PerformancePage() {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    date: string;
    pnl: number;
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["daily-pnl", year],
    queryFn: () =>
      apiFetch<DailyPnl[]>(`/portfolio/daily-pnl?year=${year}`),
  });

  const pnlMap = useMemo(() => {
    const map = new Map<string, number>();
    data?.forEach((d) => map.set(d.date, d.pnl));
    return map;
  }, [data]);

  const { weeks, monthStartWeeks } = useMemo(
    () => buildCalendarGrid(year, pnlMap),
    [year, pnlMap]
  );

  const stats = useMemo(() => {
    if (!data || data.length === 0) return null;
    const sorted = [...data].sort((a, b) => a.pnl - b.pnl);
    const positives = data.filter((d) => d.pnl > 0).length;
    const negatives = data.filter((d) => d.pnl < 0).length;
    const total = data.reduce((sum, d) => sum + d.pnl, 0);

    return {
      best: sorted[sorted.length - 1],
      worst: sorted[0],
      total,
      positives,
      negatives,
    };
  }, [data]);

  const maxAbsPnl = useMemo(() => {
    if (!data || data.length === 0) return 0;
    return Math.max(...data.map((d) => Math.abs(d.pnl)));
  }, [data]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-text-primary">Performance</h1>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <LoadingCard />
          <LoadingCard />
          <LoadingCard />
          <LoadingCard />
        </div>
        <LoadingCard className="h-48" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Performance</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setYear((y) => y - 1)}
            className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-glass-hover hover:text-text-primary"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="min-w-[4.5rem] text-center text-lg font-semibold text-text-primary">
            {year}
          </span>
          <button
            onClick={() => setYear((y) => y + 1)}
            className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-glass-hover hover:text-text-primary"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Summary stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <GlassCard>
            <div className="flex items-center gap-2 text-text-muted">
              <TrendingUp className="h-4 w-4 text-profit" />
              <span className="text-xs font-medium">Best Day</span>
            </div>
            <p className="mt-2 text-xl font-bold text-profit">
              {formatCurrency(stats.best.pnl)}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              {formatDisplayDate(stats.best.date)}
            </p>
          </GlassCard>

          <GlassCard>
            <div className="flex items-center gap-2 text-text-muted">
              <TrendingDown className="h-4 w-4 text-loss" />
              <span className="text-xs font-medium">Worst Day</span>
            </div>
            <p className="mt-2 text-xl font-bold text-loss">
              {formatCurrency(stats.worst.pnl)}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              {formatDisplayDate(stats.worst.date)}
            </p>
          </GlassCard>

          <GlassCard>
            <div className="flex items-center gap-2 text-text-muted">
              <BarChart3 className="h-4 w-4" />
              <span className="text-xs font-medium">Total P&L</span>
            </div>
            <p
              className={cn(
                "mt-2 text-xl font-bold",
                stats.total >= 0 ? "text-profit" : "text-loss"
              )}
            >
              {formatCurrency(stats.total)}
            </p>
            <p className="mt-1 text-xs text-text-muted">{year} year-to-date</p>
          </GlassCard>

          <GlassCard>
            <div className="flex items-center gap-2 text-text-muted">
              <Calendar className="h-4 w-4" />
              <span className="text-xs font-medium">Win / Loss Days</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-profit">
                {stats.positives}
              </span>
              <span className="text-sm text-text-muted">/</span>
              <span className="text-xl font-bold text-loss">
                {stats.negatives}
              </span>
            </div>
            <p className="mt-1 text-xs text-text-muted">
              {data!.length} trading days
            </p>
          </GlassCard>
        </div>
      )}

      {/* Heatmap calendar */}
      <GlassCard className="overflow-x-auto">
        <div className="relative min-w-[800px]">
          {/* Month labels */}
          <div className="mb-2 flex pl-10">
            {monthStartWeeks.map(({ month, weekIdx }, i) => {
              const nextWeekIdx =
                i + 1 < monthStartWeeks.length
                  ? monthStartWeeks[i + 1].weekIdx
                  : weeks.length;
              const span = nextWeekIdx - weekIdx;
              return (
                <div
                  key={month}
                  className="text-xs text-text-muted"
                  style={{
                    width: `${(span / weeks.length) * 100}%`,
                  }}
                >
                  {MONTH_LABELS[month]}
                </div>
              );
            })}
          </div>

          {/* Grid body */}
          <div className="flex gap-0">
            {/* Day-of-week labels */}
            <div className="mr-2 flex w-8 shrink-0 flex-col gap-[3px]">
              {DAY_LABELS.map((label, i) => (
                <div
                  key={i}
                  className="flex h-[14px] items-center justify-end text-[10px] text-text-muted"
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Week columns */}
            <div className="flex flex-1 gap-[3px]">
              {weeks.map((week, weekIdx) => (
                <div key={weekIdx} className="flex flex-col gap-[3px]">
                  {week.map((cell) => {
                    const isInYear = cell.date.getFullYear() === year;
                    const hasData = cell.pnl !== null;

                    return (
                      <div
                        key={cell.dateStr}
                        className={cn(
                          "h-[14px] w-[14px] rounded-sm transition-all",
                          !isInYear && "invisible",
                          isInYear && !hasData && "bg-white/5",
                          isInYear &&
                            hasData &&
                            getColorClass(cell.pnl!, maxAbsPnl),
                          isInYear &&
                            hasData &&
                            "cursor-pointer hover:ring-1 hover:ring-white/40"
                        )}
                        onMouseEnter={(e) => {
                          if (!isInYear || !hasData) return;
                          const rect =
                            e.currentTarget.getBoundingClientRect();
                          const parent =
                            e.currentTarget
                              .closest(".relative")
                              ?.getBoundingClientRect();
                          if (!parent) return;
                          setTooltip({
                            x: rect.left - parent.left + rect.width / 2,
                            y: rect.top - parent.top - 8,
                            date: cell.dateStr,
                            pnl: cell.pnl!,
                          });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Tooltip */}
          {tooltip && (
            <div
              className="pointer-events-none absolute z-50 -translate-x-1/2 -translate-y-full rounded-lg border border-glass-border bg-glass px-3 py-2 text-xs shadow-lg backdrop-blur-xl"
              style={{ left: tooltip.x, top: tooltip.y }}
            >
              <p className="font-medium text-text-primary">
                {formatDisplayDate(tooltip.date)}
              </p>
              <p
                className={cn(
                  "mt-0.5 font-semibold",
                  tooltip.pnl >= 0 ? "text-profit" : "text-loss"
                )}
              >
                {formatCurrency(tooltip.pnl)}
              </p>
            </div>
          )}

          {/* Legend */}
          <div className="mt-4 flex items-center justify-end gap-2 text-[10px] text-text-muted">
            <span>Loss</span>
            <div className="flex gap-[2px]">
              <div className="h-[10px] w-[10px] rounded-sm bg-red-500/80" />
              <div className="h-[10px] w-[10px] rounded-sm bg-red-500/55" />
              <div className="h-[10px] w-[10px] rounded-sm bg-red-500/15" />
              <div className="h-[10px] w-[10px] rounded-sm bg-white/5" />
              <div className="h-[10px] w-[10px] rounded-sm bg-green-500/20" />
              <div className="h-[10px] w-[10px] rounded-sm bg-green-500/65" />
              <div className="h-[10px] w-[10px] rounded-sm bg-green-500/90" />
            </div>
            <span>Profit</span>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
