"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Position } from "@/stores/portfolio-store";
import { useUpdatePosition } from "@/hooks/use-portfolio";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PositionAlignmentFormProps {
  position: Position;
  onSaved?: () => void;
}

export function PositionAlignmentForm({ position, onSaved }: PositionAlignmentFormProps) {
  const update = useUpdatePosition();
  const isFi = position.assetType === "fixed-income";

  const [statementValue, setStatementValue] = useState("");
  const [cdiMode, setCdiMode] = useState<"FIXED" | "RANGE">("FIXED");
  const [rateFloor, setRateFloor] = useState("");
  const [rateCeiling, setRateCeiling] = useState("");
  const [projectionPct, setProjectionPct] = useState("");

  useEffect(() => {
    const r = position.reportedPositionValue;
    setStatementValue(
      r != null && Number.isFinite(r) ? String(r) : ""
    );
    setCdiMode(position.cdiIndexMode ?? "FIXED");
    setRateFloor(
      position.rateValueForCdi != null ? String(position.rateValueForCdi) : ""
    );
    setRateCeiling(
      position.rateCeilingValue != null ? String(position.rateCeilingValue) : ""
    );
    setProjectionPct(
      position.projectionCdiPercent != null ? String(position.projectionCdiPercent) : ""
    );
  }, [position]);

  const clearStatement = () => {
    setStatementValue("");
    update.mutate(
      {
        id: position.id,
        body: { reported_position_value: null },
      },
      {
        onSuccess: () => {
          toast.success("Using app estimate / market prices again");
          onSaved?.();
        },
        onError: (e: Error) => toast.error(e.message),
      }
    );
  };

  const saveStatement = () => {
    const raw = statementValue.trim();
    if (!raw) {
      clearStatement();
      return;
    }
    const v = parseFloat(raw.replace(",", "."));
    if (!Number.isFinite(v) || v < 0) {
      toast.error("Enter a valid amount in R$");
      return;
    }
    update.mutate(
      {
        id: position.id,
        body: { reported_position_value: v },
      },
      {
        onSuccess: () => {
          toast.success("Balance saved — totals will match your statement");
          onSaved?.();
        },
        onError: (e: Error) => toast.error(e.message),
      }
    );
  };

  const saveCdiSettings = () => {
    if (!isFi) return;
    const floor = parseFloat(rateFloor.replace(",", "."));
    const ceilRaw = rateCeiling.trim();
    const ceil = ceilRaw ? parseFloat(ceilRaw.replace(",", ".")) : null;
    const projRaw = projectionPct.trim();
    const proj = projRaw ? parseFloat(projRaw.replace(",", ".")) : null;

    if (!Number.isFinite(floor)) {
      toast.error("Enter the % do CDI floor (or fixed rate)");
      return;
    }
    if (cdiMode === "RANGE" && (ceil == null || !Number.isFinite(ceil))) {
      toast.error("Enter the ceiling % do CDI for a range product");
      return;
    }
    if (cdiMode === "RANGE" && Number.isFinite(floor) && Number.isFinite(ceil!) && ceil! < floor) {
      toast.error("Ceiling must be ≥ floor");
      return;
    }

    update.mutate(
      {
        id: position.id,
        body: {
          cdi_index_mode: cdiMode,
          rate_value: floor,
          rate_ceiling_value: cdiMode === "RANGE" && ceil != null ? ceil : null,
          projection_cdi_percent: proj != null && Number.isFinite(proj) ? proj : null,
        },
      },
      {
        onSuccess: () => {
          toast.success("CDI indexing updated");
          onSaved?.();
        },
        onError: (e: Error) => toast.error(e.message),
      }
    );
  };

  const estLabel = isFi
    ? position.modelEstimatedValue != null
      ? formatBrl(position.modelEstimatedValue)
      : "—"
    : "—";

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-text-primary">Statement &amp; gains</h3>
        <p className="mt-1 text-xs text-text-muted">
          Enter the <strong>current position value in R$</strong> exactly as your bank or broker shows
          (including accrued yield). This overrides the app&apos;s estimate so portfolio totals match your
          account. Clear it to use live quotes or the yield model again.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label={isFi ? "Current value — your statement (R$)" : "Position value — your statement (R$)"}
          type="text"
          inputMode="decimal"
          placeholder="e.g. 10432.18"
          value={statementValue}
          onChange={(e) => setStatementValue(e.target.value)}
        />
        {isFi && (
          <div className="flex flex-col justify-end rounded-xl border border-glass-border bg-white/[0.02] px-3 py-2 text-xs text-text-muted">
            <span className="text-[10px] uppercase tracking-wide">App model estimate (R$)</span>
            <span className="text-sm font-medium text-text-secondary">{estLabel}</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="primary" onClick={saveStatement} disabled={update.isPending}>
          Save balance
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={clearStatement} disabled={update.isPending}>
          Clear — use estimate
        </Button>
      </div>

      {isFi && position.rateContractType === "PCT_CDI" && (
        <>
          <div className="border-t border-glass-border pt-4">
            <h3 className="text-sm font-medium text-text-primary">% do CDI — fixed or range</h3>
            <p className="mt-1 text-xs text-text-muted">
              Many CDBs pay between a floor and a ceiling (e.g. 100% to 113% of CDI). Choose{" "}
              <strong>Fixed</strong> for a single multiplier, or <strong>Range</strong> for products marketed as
              &quot;até X% do CDI&quot;. The app uses the <strong>midpoint</strong> for projections unless you
              set an explicit simulation rate.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-text-muted">CDI indexing</label>
            <select
              value={cdiMode}
              onChange={(e) => setCdiMode(e.target.value as "FIXED" | "RANGE")}
              className={cn(
                "w-full rounded-xl border border-glass-border bg-glass px-3 py-2.5 text-sm text-text-primary",
                "backdrop-blur-md outline-none focus:border-accent/50"
              )}
            >
              <option value="FIXED">Fixed % of CDI</option>
              <option value="RANGE">Range (min–max % of CDI)</option>
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              label={cdiMode === "RANGE" ? "Floor % of CDI" : "% of CDI"}
              type="text"
              inputMode="decimal"
              placeholder="100"
              value={rateFloor}
              onChange={(e) => setRateFloor(e.target.value)}
            />
            {cdiMode === "RANGE" && (
              <Input
                label="Ceiling % of CDI"
                type="text"
                inputMode="decimal"
                placeholder="113"
                value={rateCeiling}
                onChange={(e) => setRateCeiling(e.target.value)}
              />
            )}
            <Input
              label="Simulation % (optional)"
              type="text"
              inputMode="decimal"
              placeholder="e.g. 105"
              value={projectionPct}
              onChange={(e) => setProjectionPct(e.target.value)}
            />
          </div>
          <p className="text-[11px] text-text-muted">
            Optional <strong>Simulation %</strong> sets exactly which multiple of CDI to use in yield math
            (useful when you know what the bank paid this month). Leave empty to use the fixed rate or the
            midpoint of the range.
          </p>

          <Button
            type="button"
            size="sm"
            variant="success"
            onClick={saveCdiSettings}
            disabled={update.isPending}
          >
            Save CDI settings
          </Button>
        </>
      )}
    </div>
  );
}

function formatBrl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
