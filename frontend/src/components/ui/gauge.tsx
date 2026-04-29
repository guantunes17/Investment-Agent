"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface GaugeProps {
  value: number;
  size?: number;
  label?: string;
  className?: string;
}

function getGaugeColor(value: number): string {
  if (value <= 30) return "#ff3366";
  if (value <= 50) return "#ffaa00";
  if (value <= 70) return "#ffcc44";
  return "#00ff88";
}

export function Gauge({ value, size = 120, label, className }: GaugeProps) {
  const clampedValue = Math.max(0, Math.min(100, value));
  const strokeWidth = size * 0.1;
  const radius = (size - strokeWidth) / 2;
  const circumference = Math.PI * radius;
  const fillLength = (clampedValue / 100) * circumference;
  const color = getGaugeColor(clampedValue);

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <svg width={size} height={size / 2 + strokeWidth} viewBox={`0 0 ${size} ${size / 2 + strokeWidth}`}>
        <path
          d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        <motion.path
          d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - fillLength }}
          transition={{ duration: 1, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 6px ${color}60)` }}
        />
      </svg>
      <div className="flex flex-col items-center -mt-2">
        <span className="text-lg font-bold text-text-primary" style={{ color }}>
          {clampedValue}
        </span>
        {label && (
          <span className="text-xs text-text-muted">{label}</span>
        )}
      </div>
    </div>
  );
}
