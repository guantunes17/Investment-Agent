"use client";

import { LineChart, Line, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

interface SparklineProps {
  data: number[];
  className?: string;
  height?: number;
}

export function Sparkline({ data, className, height = 32 }: SparklineProps) {
  const chartData = data.map((value, i) => ({ i, value }));
  const trend = data.length > 1 ? data[data.length - 1] - data[0] : 0;
  const color = trend >= 0 ? "#00ff88" : "#ff3366";

  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={true}
            animationDuration={800}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
