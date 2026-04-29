"use client";

import { useEffect } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <GlassCard className="max-w-md text-center">
        <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-loss" />
        <h2 className="mb-2 text-xl font-bold text-text-primary">
          Something went wrong
        </h2>
        <p className="mb-6 text-sm text-text-muted">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>
        <Button variant="primary" onClick={reset}>
          Try Again
        </Button>
      </GlassCard>
    </div>
  );
}
