"use client";

import { GlassCard } from "@/components/ui/glass-card";
import { Badge, type RecommendationType } from "@/components/ui/badge";
import { Gauge } from "@/components/ui/gauge";

export interface RecommendationData {
  ticker: string;
  name: string;
  recommendation: RecommendationType;
  confidence: number;
  metrics?: Record<string, string | number>;
  reasoning?: string;
}

interface RecommendationCardProps {
  data: RecommendationData;
}

export function RecommendationCard({ data }: RecommendationCardProps) {
  return (
    <GlassCard className="mt-3 p-4" hover>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-sm font-bold text-text-primary">
            {data.ticker}
          </p>
          <p className="text-xs text-text-muted">{data.name}</p>
        </div>
        <Badge recommendation={data.recommendation} />
      </div>

      <div className="mt-3 flex items-center gap-4">
        <Gauge value={data.confidence} size={64} label="Confidence" />
        {data.metrics && (
          <div className="grid flex-1 grid-cols-2 gap-2">
            {Object.entries(data.metrics).map(([key, value]) => (
              <div key={key}>
                <p className="text-[10px] text-text-muted">{key}</p>
                <p className="text-xs font-semibold text-text-primary">{value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {data.reasoning && (
        <p className="mt-3 border-t border-glass-border pt-3 text-xs leading-relaxed text-text-secondary">
          {data.reasoning}
        </p>
      )}
    </GlassCard>
  );
}
