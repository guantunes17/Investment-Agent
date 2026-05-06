"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import type { AssetType } from "@/stores/portfolio-store";
import { useAddPosition, type AddPositionPayload } from "@/hooks/use-portfolio";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const assetTabs = [
  { id: "stock", label: "Stock" },
  { id: "fixed-income", label: "Fixed Income" },
  { id: "fii", label: "FII" },
];

/** Matches backend FixedIncomeSubtype */
const FI_SUBTYPES: { value: string; label: string }[] = [
  { value: "CDB", label: "CDB (bank deposit certificate)" },
  { value: "LCI", label: "LCI (tax-free corporate)" },
  { value: "LCA", label: "LCA (tax-free agribusiness)" },
  { value: "TESOURO_SELIC", label: "Tesouro Selic / LFT" },
  { value: "TESOURO_IPCA", label: "Tesouro IPCA+ / NTN-B" },
  { value: "TESOURO_PRE", label: "Tesouro Prefixado / LTN-NTNF" },
  { value: "INFRA", label: "Debênture Infra" },
];

/** Matches backend RateType — Brazilian conventions */
const RATE_TYPES: { value: string; label: string; hint: string }[] = [
  {
    value: "PCT_CDI",
    label: "% do CDI",
    hint: "Multiplier over CDI (e.g. 100 = 100% of CDI, 110 = 110% of CDI). Used by most CDBs/LCIs.",
  },
  {
    value: "CDI_PLUS",
    label: "CDI + spread",
    hint: "Annual spread in percentage points over the CDI curve (e.g. 0.85 = CDI + 0.85 p.p. per year).",
  },
  {
    value: "IPCA_PLUS",
    label: "IPCA +",
    hint: "Real rate over IPCA (e.g. 6 = IPCA + 6% per year). Common for Tesouro IPCA and indexed bonds.",
  },
  { value: "PRE", label: "Pré-fixado", hint: "Annual nominal rate (e.g. 12.5 for ~12.5% per year, 252-day convention)." },
  {
    value: "SELIC_PLUS",
    label: "Selic + spread",
    hint: "Spread over Selic (some floating-rate instruments).",
  },
];

interface AddPositionFormProps {
  onClose: () => void;
}

export function AddPositionForm({ onClose }: AddPositionFormProps) {
  const [assetType, setAssetType] = useState<AssetType>("stock");

  const [ticker, setTicker] = useState("");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [avgPrice, setAvgPrice] = useState("");

  const [fiName, setFiName] = useState("");
  const [issuer, setIssuer] = useState("");
  const [fiSubtype, setFiSubtype] = useState("CDB");
  const [investedAmount, setInvestedAmount] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [maturityDate, setMaturityDate] = useState("");
  const [noFixedMaturity, setNoFixedMaturity] = useState(false);
  const [rateType, setRateType] = useState("PCT_CDI");
  const [rateValue, setRateValue] = useState("100");
  const [cdiIndexMode, setCdiIndexMode] = useState<"FIXED" | "RANGE">("FIXED");
  const [rateCeiling, setRateCeiling] = useState("");
  const [projectionCdi, setProjectionCdi] = useState("");
  const [fiStatementValue, setFiStatementValue] = useState("");
  const [taxExempt, setTaxExempt] = useState(false);

  const [equityStatementValue, setEquityStatementValue] = useState("");

  const addPosition = useAddPosition();
  const parseLocalNumber = (v: string) => parseFloat(String(v).replace(",", "."));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let payload: AddPositionPayload;

    if (assetType === "fixed-income") {
      const inv = parseFloat(String(investedAmount).replace(",", "."));
      const rateNum = parseFloat(String(rateValue).replace(",", "."));
      if (!fiName.trim()) {
        toast.error("Enter the product name");
        return;
      }
      if (!issuer.trim()) {
        toast.error("Enter the issuer (e.g. BTG Pactual, Itaú, Banco do Brasil)");
        return;
      }
      if (!Number.isFinite(inv) || inv <= 0) {
        toast.error("Enter a valid invested amount (principal)");
        return;
      }
      if (!noFixedMaturity && !maturityDate) {
        toast.error("Enter the maturity date, or check “No fixed maturity” for daily liquidity / open term");
        return;
      }
      if (!Number.isFinite(rateNum)) {
        toast.error("Enter a valid rate value");
        return;
      }

      const autoTax =
        fiSubtype === "LCI" || fiSubtype === "LCA" ? true : taxExempt;

      let rateCeilNum: number | null = null;
      let projNum: number | null = null;
      if (rateType === "PCT_CDI") {
        if (cdiIndexMode === "RANGE") {
          const c = parseFloat(String(rateCeiling).replace(",", "."));
          if (!Number.isFinite(c)) {
            toast.error("Enter the ceiling % of CDI for a range CDB");
            return;
          }
          if (c < rateNum) {
            toast.error("Ceiling % of CDI must be ≥ floor");
            return;
          }
          rateCeilNum = c;
        }
        const pr = projectionCdi.trim();
        if (pr) {
          const pv = parseFloat(pr.replace(",", "."));
          if (!Number.isFinite(pv)) {
            toast.error("Enter a valid simulation % of CDI");
            return;
          }
          projNum = pv;
        }
      }

      const stmtRaw = fiStatementValue.trim();
      const stmtNum =
        stmtRaw.length > 0 ? parseFloat(stmtRaw.replace(",", ".")) : null;
      if (stmtRaw.length > 0 && (!Number.isFinite(stmtNum) || (stmtNum ?? 0) < 0)) {
        toast.error("Enter a valid current value from your statement (R$)");
        return;
      }

      payload = {
        assetType: "fixed-income",
        name: fiName.trim(),
        issuer: issuer.trim(),
        asset_subtype: fiSubtype,
        invested_amount: inv,
        purchase_date: purchaseDate,
        maturity_date: noFixedMaturity ? null : maturityDate,
        rate_type: rateType,
        rate_value: rateNum,
        is_tax_exempt: autoTax,
        cdi_index_mode: rateType === "PCT_CDI" ? cdiIndexMode : "FIXED",
        rate_ceiling_value:
          rateType === "PCT_CDI" && cdiIndexMode === "RANGE" ? rateCeilNum : null,
        projection_cdi_percent: projNum,
        reported_position_value: stmtNum != null && Number.isFinite(stmtNum) ? stmtNum : null,
      };
    } else {
      const qtyNum = parseLocalNumber(quantity);
      const avgNum = parseLocalNumber(avgPrice);
      if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
        toast.error("Enter a valid quantity");
        return;
      }
      if (!Number.isFinite(avgNum) || avgNum <= 0) {
        toast.error("Enter a valid average price");
        return;
      }

      const eqStmt = equityStatementValue.trim();
      let repEq: number | null = null;
      if (eqStmt.length > 0) {
        const v = parseLocalNumber(eqStmt);
        if (!Number.isFinite(v) || v < 0) {
          toast.error("Enter a valid total position value from your statement (R$)");
          return;
        }
        repEq = v;
      }
      payload = {
        assetType,
        ticker: ticker.toUpperCase(),
        name,
        quantity: qtyNum,
        avgPrice: avgNum,
        reported_position_value: repEq,
      };
    }

    addPosition.mutate(payload, {
      onSuccess: () => {
        toast.success("Position added successfully");
        onClose();
      },
      onError: (error: Error) => {
        toast.error("Failed to add position", { description: error.message });
      },
    });
  };

  const rateHint = RATE_TYPES.find((r) => r.value === rateType)?.hint ?? "";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Tabs tabs={assetTabs} activeTab={assetType} onChange={(id) => setAssetType(id as AssetType)} />

      {assetType === "fixed-income" ? (
        <>
          <div className="space-y-2">
            <label className="text-xs font-medium text-text-muted">Product type</label>
            <select
              value={fiSubtype}
              onChange={(e) => {
                const v = e.target.value;
                setFiSubtype(v);
                if (v === "LCI" || v === "LCA") setTaxExempt(true);
              }}
              className={cn(
                "w-full rounded-xl border border-glass-border bg-glass px-3 py-2.5 text-sm text-text-primary",
                "backdrop-blur-md outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/20"
              )}
            >
              {FI_SUBTYPES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Product name</label>
            <textarea
              name="fi-product-name"
              rows={3}
              className={cn(
                "min-h-[4.5rem] w-full resize-y rounded-xl border border-glass-border bg-glass px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted backdrop-blur-md",
                "outline-none transition-all focus:border-accent/50 focus:ring-2 focus:ring-accent/20"
              )}
              placeholder="Full name as shown by your bank (wraps to multiple lines)"
              value={fiName}
              onChange={(e) => setFiName(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Issuer (institution)</label>
            <textarea
              name="fi-issuer"
              rows={2}
              className={cn(
                "min-h-[3rem] w-full resize-y rounded-xl border border-glass-border bg-glass px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted backdrop-blur-md",
                "outline-none transition-all focus:border-accent/50 focus:ring-2 focus:ring-accent/20"
              )}
              placeholder="e.g. BTG Pactual, Itaú Unibanco, Banco do Brasil"
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              required
            />
          </div>

          <Input
            label="Invested amount (R$)"
            type="text"
            inputMode="decimal"
            placeholder="10000.00"
            value={investedAmount}
            onChange={(e) => setInvestedAmount(e.target.value)}
            required
          />

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-glass-border bg-white/[0.03] px-3 py-3">
            <input
              type="checkbox"
              checked={noFixedMaturity}
              onChange={(e) => {
                const v = e.target.checked;
                setNoFixedMaturity(v);
                if (v) setMaturityDate("");
              }}
              className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
            />
            <span className="text-sm leading-snug">
              <span className="font-medium text-text-secondary">No fixed maturity date</span>
              <span className="mt-0.5 block text-[11px] text-text-muted">
                Use for daily liquidity CDBs or products without a contract end date. Maturity alerts and “run to
                maturity” projections are skipped; yield still accrues from the purchase date.
              </span>
            </span>
          </label>

          <div className={cn("grid gap-3", noFixedMaturity ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2")}>
            <Input
              label="Purchase / application date"
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              required
            />
            {!noFixedMaturity && (
              <Input
                label="Maturity date"
                type="date"
                value={maturityDate}
                onChange={(e) => setMaturityDate(e.target.value)}
                required
              />
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-text-muted">Indexer / rate type</label>
            <select
              value={rateType}
              onChange={(e) => setRateType(e.target.value)}
              className={cn(
                "w-full rounded-xl border border-glass-border bg-glass px-3 py-2.5 text-sm text-text-primary",
                "backdrop-blur-md outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/20"
              )}
            >
              {RATE_TYPES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] leading-snug text-text-muted">{rateHint}</p>
          </div>

          <Input
            label={
              rateType === "PCT_CDI" && cdiIndexMode === "RANGE"
                ? "Floor % of CDI"
                : "Rate value"
            }
            type="text"
            inputMode="decimal"
            placeholder={rateType === "PCT_CDI" ? "110" : rateType === "CDI_PLUS" ? "0.85" : "6"}
            value={rateValue}
            onChange={(e) => setRateValue(e.target.value)}
            required
          />

          {rateType === "PCT_CDI" && (
            <div className="space-y-3 rounded-xl border border-glass-border bg-white/[0.02] p-3">
              <p className="text-xs font-medium text-text-muted">% do CDI — fixed or range</p>
              <select
                value={cdiIndexMode}
                onChange={(e) => setCdiIndexMode(e.target.value as "FIXED" | "RANGE")}
                className={cn(
                  "w-full rounded-xl border border-glass-border bg-glass px-3 py-2.5 text-sm text-text-primary",
                  "backdrop-blur-md outline-none focus:border-accent/50"
                )}
              >
                <option value="FIXED">Fixed (single % of CDI)</option>
                <option value="RANGE">Range (e.g. 100%–113% do CDI)</option>
              </select>
              {cdiIndexMode === "RANGE" && (
                <Input
                  label="Ceiling % of CDI"
                  type="text"
                  inputMode="decimal"
                  placeholder="113"
                  value={rateCeiling}
                  onChange={(e) => setRateCeiling(e.target.value)}
                  required
                />
              )}
              <Input
                label="Simulation % of CDI (optional)"
                type="text"
                inputMode="decimal"
                placeholder="Leave empty = midpoint or fixed rate"
                value={projectionCdi}
                onChange={(e) => setProjectionCdi(e.target.value)}
              />
              <p className="text-[11px] text-text-muted">
                Optional: set the exact multiple the bank is paying you for projections. Leave empty to use the
                fixed rate or the midpoint between floor and ceiling.
              </p>
            </div>
          )}

          <Input
            label="Current value on statement (optional, R$)"
            type="text"
            inputMode="decimal"
            placeholder="Total position value from your bank app"
            value={fiStatementValue}
            onChange={(e) => setFiStatementValue(e.target.value)}
          />

          {fiSubtype !== "LCI" && fiSubtype !== "LCA" && (
            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-glass-border bg-white/[0.03] px-3 py-2">
              <span className="text-sm text-text-secondary">Tax-exempt (simulate LCI/LCA-style)</span>
              <input
                type="checkbox"
                checked={taxExempt}
                onChange={(e) => setTaxExempt(e.target.checked)}
                className="h-4 w-4 accent-accent"
              />
            </label>
          )}
          {(fiSubtype === "LCI" || fiSubtype === "LCA") && (
            <p className="text-[11px] text-text-muted">
              LCI/LCA are typically income-tax exempt for individuals (rules may vary).
            </p>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Ticker"
              placeholder={assetType === "fii" ? "e.g. HGLG11" : "e.g. PETR4"}
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              required
            />
            <Input
              label="Name"
              placeholder="Company / fund name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Quantity"
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
            <Input
              label="Avg price"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={avgPrice}
              onChange={(e) => setAvgPrice(e.target.value)}
              required
            />
          </div>

          <Input
            label="Total position value from statement (optional, R$)"
            type="text"
            inputMode="decimal"
            placeholder="Matches broker — overrides live quote for P&amp;L"
            value={equityStatementValue}
            onChange={(e) => setEquityStatementValue(e.target.value)}
          />
        </>
      )}

      <div className="sticky bottom-0 z-[1] flex justify-end gap-3 border-t border-glass-border/60 bg-bg-primary/95 py-3 pt-4 backdrop-blur-sm">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={addPosition.isPending}>
          {addPosition.isPending ? "Adding..." : "Add Position"}
        </Button>
      </div>
    </form>
  );
}
