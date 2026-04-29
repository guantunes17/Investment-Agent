"use client";

import { useEffect, useRef } from "react";
import { createChart, type IChartApi, type ISeriesApi, ColorType } from "lightweight-charts";
import { cn } from "@/lib/utils";

export interface OHLCVData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface OverlayConfig {
  type: "SMA" | "EMA" | "Bollinger";
  period: number;
  color?: string;
}

interface CandlestickChartProps {
  data: OHLCVData[];
  overlays?: OverlayConfig[];
  height?: number;
  className?: string;
}

function calculateSMA(data: OHLCVData[], period: number) {
  const result: { time: string; value: number }[] = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    result.push({ time: data[i].time, value: sum / period });
  }
  return result;
}

function calculateEMA(data: OHLCVData[], period: number) {
  const result: { time: string; value: number }[] = [];
  const multiplier = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((sum, d) => sum + d.close, 0) / period;
  result.push({ time: data[period - 1].time, value: ema });
  for (let i = period; i < data.length; i++) {
    ema = (data[i].close - ema) * multiplier + ema;
    result.push({ time: data[i].time, value: ema });
  }
  return result;
}

export function CandlestickChart({
  data,
  overlays = [],
  height = 400,
  className,
}: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#a0a0b0",
        fontFamily: "Inter, system-ui, sans-serif",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.03)" },
        horzLines: { color: "rgba(255,255,255,0.03)" },
      },
      crosshair: {
        vertLine: { color: "rgba(51,102,255,0.3)", width: 1 },
        horzLine: { color: "rgba(51,102,255,0.3)", width: 1 },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.1)",
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.1)",
      },
    });

    chartRef.current = chart;

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#00ff88",
      downColor: "#ff3366",
      borderDownColor: "#ff3366",
      borderUpColor: "#00ff88",
      wickDownColor: "#ff336680",
      wickUpColor: "#00ff8880",
    });

    candleSeries.setData(data as Parameters<typeof candleSeries.setData>[0]);
    seriesRef.current = candleSeries;

    overlays.forEach((overlay) => {
      const lineSeries = chart.addLineSeries({
        color: overlay.color || "#3366ff",
        lineWidth: 1,
        priceLineVisible: false,
      });

      let lineData: { time: string; value: number }[] = [];
      if (overlay.type === "SMA") {
        lineData = calculateSMA(data, overlay.period);
      } else if (overlay.type === "EMA") {
        lineData = calculateEMA(data, overlay.period);
      }

      if (lineData.length > 0) {
        lineSeries.setData(lineData as Parameters<typeof lineSeries.setData>[0]);
      }
    });

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [data, overlays, height]);

  return (
    <div
      ref={containerRef}
      className={cn("w-full rounded-xl overflow-hidden", className)}
    />
  );
}
