"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "@/lib/utils";

interface AllocationData {
  name: string;
  value: number;
  color: string;
}

interface AllocationChartProps {
  data: AllocationData[];
  className?: string;
  size?: number;
}

const defaultColors = ["#00ff88", "#3366ff", "#aa33ff", "#ffaa00", "#ff3366"];

export function AllocationChart({ data, className, size = 200 }: AllocationChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className={cn("flex items-center gap-6", className)}>
      <div style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={size * 0.3}
              outerRadius={size * 0.42}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
              animationDuration={800}
            >
              {data.map((entry, i) => (
                <Cell
                  key={entry.name}
                  fill={entry.color || defaultColors[i % defaultColors.length]}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(10,10,26,0.9)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "12px",
                backdropFilter: "blur(20px)",
                color: "#f0f0f0",
              }}
              formatter={(value: number) => [
                `${((value / total) * 100).toFixed(1)}%`,
                "",
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-col gap-2">
        {data.map((item, i) => (
          <div key={item.name} className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full"
              style={{
                backgroundColor:
                  item.color || defaultColors[i % defaultColors.length],
              }}
            />
            <span className="text-sm text-text-secondary">{item.name}</span>
            <span className="text-sm font-medium text-text-primary">
              {((item.value / total) * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
