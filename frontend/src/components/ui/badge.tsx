"use client";

import { cn } from "@/lib/utils";

export type RecommendationType =
  | "BUY"
  | "SELL"
  | "HOLD"
  | "HOLD_TO_MATURITY"
  | "REDEEM_EARLY";

interface BadgeProps {
  recommendation: RecommendationType;
  className?: string;
}

const badgeConfig: Record<
  RecommendationType,
  { label: string; color: string; bg: string; glow: string }
> = {
  BUY: {
    label: "BUY",
    color: "text-profit",
    bg: "bg-profit/15",
    glow: "shadow-[0_0_8px_rgba(0,255,136,0.3)]",
  },
  SELL: {
    label: "SELL",
    color: "text-loss",
    bg: "bg-loss/15",
    glow: "shadow-[0_0_8px_rgba(255,51,102,0.3)]",
  },
  HOLD: {
    label: "HOLD",
    color: "text-hold",
    bg: "bg-hold/15",
    glow: "shadow-[0_0_8px_rgba(255,170,0,0.3)]",
  },
  HOLD_TO_MATURITY: {
    label: "HOLD TO MATURITY",
    color: "text-accent",
    bg: "bg-accent/15",
    glow: "shadow-[0_0_8px_rgba(51,102,255,0.3)]",
  },
  REDEEM_EARLY: {
    label: "REDEEM EARLY",
    color: "text-secondary",
    bg: "bg-secondary/15",
    glow: "shadow-[0_0_8px_rgba(170,51,255,0.3)]",
  },
};

export function Badge({ recommendation, className }: BadgeProps) {
  const config = badgeConfig[recommendation];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wide",
        config.bg,
        config.color,
        config.glow,
        className
      )}
    >
      {config.label}
    </span>
  );
}
