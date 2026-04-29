"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-text-secondary">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              "w-full rounded-xl border border-glass-border bg-glass py-2.5 text-sm text-text-primary placeholder:text-text-muted backdrop-blur-md",
              "outline-none transition-all duration-200",
              "focus:border-accent/50 focus:ring-2 focus:ring-accent/20 focus:bg-glass-hover",
              error && "border-loss/50 focus:border-loss/50 focus:ring-loss/20",
              icon ? "pl-10 pr-4" : "px-4",
              className
            )}
            {...props}
          />
        </div>
        {error && <span className="text-xs text-loss">{error}</span>}
      </div>
    );
  }
);

Input.displayName = "Input";
