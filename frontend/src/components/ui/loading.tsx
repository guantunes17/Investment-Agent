"use client";

import { cn } from "@/lib/utils";

interface LoadingProps {
  className?: string;
  lines?: number;
}

export function Loading({ className, lines = 3 }: LoadingProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 animate-pulse rounded-lg bg-glass-border"
          style={{ width: `${85 - i * 15}%`, animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  );
}

export function LoadingCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-glass-border bg-glass p-6 backdrop-blur-xl",
        className
      )}
    >
      <div className="flex flex-col gap-4">
        <div className="h-5 w-1/3 animate-pulse rounded-lg bg-glass-border" />
        <div className="h-4 w-2/3 animate-pulse rounded-lg bg-glass-border" style={{ animationDelay: "100ms" }} />
        <div className="h-4 w-1/2 animate-pulse rounded-lg bg-glass-border" style={{ animationDelay: "200ms" }} />
        <div className="mt-2 h-24 w-full animate-pulse rounded-xl bg-glass-border" style={{ animationDelay: "300ms" }} />
      </div>
    </div>
  );
}

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-glass-border border-t-accent" />
    </div>
  );
}
