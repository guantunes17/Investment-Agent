"use client";

import { cn } from "@/lib/utils";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  glow?: string;
  children: React.ReactNode;
  className?: string;
}

export function GlassCard({
  children,
  className,
  hover = false,
  glow,
  ...props
}: GlassCardProps) {
  return (
    <div
      className={cn(
        "relative rounded-2xl border border-glass-border bg-glass p-6 backdrop-blur-[20px]",
        "shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]",
        hover &&
          "transition-colors duration-200 hover:bg-glass-hover hover:border-white/15",
        className
      )}
      style={
        glow
          ? { boxShadow: `0 0 20px ${glow}20, inset 0 1px 1px rgba(255,255,255,0.05)` }
          : undefined
      }
      {...props}
    >
      {glow && (
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-20"
          style={{
            background: `radial-gradient(ellipse at 50% 0%, ${glow}30 0%, transparent 70%)`,
          }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
