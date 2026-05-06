"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs } from "@/components/ui/tabs";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Badge, type RecommendationType } from "@/components/ui/badge";
import { Sparkline } from "@/components/ui/sparkline";
import { AllocationChart } from "@/components/charts/allocation-chart";
import { CorrelationMatrix } from "@/components/charts/correlation-matrix";
import { LoadingCard } from "@/components/ui/loading";
import { usePortfolio } from "@/hooks/use-portfolio";
import type { Position } from "@/stores/portfolio-store";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { Plus, Upload, FileSpreadsheet, Download, Pencil, Trash2 } from "lucide-react";
import { AddPositionForm } from "./add-position-form";
import { toast } from "sonner";
import { useDeletePosition } from "@/hooks/use-portfolio";

const tabs = [
  { id: "all", label: "All" },
  { id: "stock", label: "Stocks" },
  { id: "fixed-income", label: "Fixed-Income" },
  { id: "fii", label: "FIIs" },
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

const templateOptions = [
  { label: "Stocks", type: "stock" },
  { label: "Fixed-Income", type: "fixed-income" },
  { label: "FIIs", type: "fii" },
];

const csvImportHints = [
  { value: "auto", label: "Auto-detect" },
  { value: "fixed-income", label: "Fixed income (CDB, LCI, …)" },
  { value: "stock", label: "Stocks / FIIs" },
] as const;

export default function PortfolioPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [csvImportHint, setCsvImportHint] =
    useState<(typeof csvImportHints)[number]["value"]>("auto");
  const { isLoading, positions } = usePortfolio();
  const queryClient = useQueryClient();

  const filteredPositions =
    activeTab === "all"
      ? positions
      : positions.filter((p) => p.assetType === activeTab);

  const handleDownloadTemplate = (type: string) => {
    const link = document.createElement("a");
    link.href = `${API_BASE}/portfolio/template/${type}`;
    link.download = `template_${type}.csv`;
    link.click();
    setShowTemplates(false);
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    if (csvImportHint !== "auto") {
      formData.append("asset_type_hint", csvImportHint);
    }

    try {
      const res = await fetch(`${API_BASE}/portfolio/import-csv`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(`Import failed: ${res.statusText}`);
      const result = await res.json();
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      const errPreview =
        Array.isArray(result.errors) && result.errors.length > 0
          ? result.errors.slice(0, 3).join(" · ")
          : undefined;
      toast.success(`Imported ${result.imported} positions from ${file.name}`, {
        description: result.errors?.length
          ? `${result.errors.length} row(s) skipped${errPreview ? `: ${errPreview}` : ""}`
          : undefined,
      });
    } catch (err) {
      toast.error("CSV import failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }, [queryClient, csvImportHint]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"] },
    maxFiles: 1,
  });

  const allocationData = Object.entries(
    positions.reduce<Record<string, number>>((acc, p) => {
      const label =
        p.assetType === "stock"
          ? "Stocks"
          : p.assetType === "fixed-income"
          ? "Fixed Income"
          : "FIIs";
      acc[label] = (acc[label] || 0) + p.currentPrice * p.quantity;
      return acc;
    }, {})
  ).map(([name, value]) => ({
    name,
    value,
    color:
      name === "Stocks"
        ? "#00ff88"
        : name === "Fixed Income"
        ? "#3366ff"
        : "#aa33ff",
  }));

  if (isLoading && positions.length === 0) {
    return (
      <div className="space-y-6">
        <LoadingCard />
        <LoadingCard />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold text-text-primary">Portfolio</h1>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Button variant="ghost" size="sm" onClick={() => setShowTemplates(!showTemplates)}>
                <Download className="h-4 w-4" />
                Templates
              </Button>
              {showTemplates && (
                <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-xl border border-glass-border bg-glass p-1 backdrop-blur-xl shadow-lg">
                  {templateOptions.map((opt) => (
                    <button
                      key={opt.type}
                      onClick={() => handleDownloadTemplate(opt.type)}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-text-secondary transition-colors hover:bg-glass-hover hover:text-text-primary"
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button variant="primary" onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4" />
              Add Position
            </Button>
          </div>
        </div>
        <p className="max-w-2xl text-xs text-text-muted">
          Use <strong className="text-text-secondary">Edit</strong> to change balances and rates;{" "}
          <strong className="text-text-secondary">Remove</strong> drops the line from this app only (not your broker).
        </p>
      </div>

      {/* Allocation chart for 'all' tab */}
      {activeTab === "all" && allocationData.length > 0 && (
        <GlassCard>
          <h3 className="mb-4 text-sm font-medium text-text-muted">Allocation</h3>
          <AllocationChart data={allocationData} />
        </GlassCard>
      )}

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Positions list */}
      <div className="space-y-3">
        {filteredPositions.length === 0 ? (
          <GlassCard>
            <p className="text-center text-text-muted">
              No positions{activeTab !== "all" ? ` in ${activeTab}` : ""}. Add one or import a CSV.
            </p>
          </GlassCard>
        ) : activeTab === "fixed-income" ? (
          <FixedIncomeGrid positions={filteredPositions} />
        ) : (
          <PositionsTable positions={filteredPositions} showType={activeTab === "all"} />
        )}
      </div>

      {/* CSV Drop Zone */}
      <GlassCard className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-medium text-text-muted">CSV type (when auto-detect fails)</p>
          <select
            value={csvImportHint}
            onChange={(e) =>
              setCsvImportHint(e.target.value as (typeof csvImportHints)[number]["value"])
            }
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "max-w-full rounded-lg border border-glass-border bg-glass px-2 py-1.5 text-xs text-text-primary",
              "outline-none focus:border-accent/50"
            )}
          >
            {csvImportHints.map((h) => (
              <option key={h.value} value={h.value}>
                {h.label}
              </option>
            ))}
          </select>
        </div>
        <div
          {...getRootProps()}
          className={cn(
            "cursor-pointer rounded-xl border-2 border-dashed border-glass-border p-8 text-center transition-colors",
            isDragActive && "border-accent bg-accent/5"
          )}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-3">
            {isDragActive ? (
              <Upload className="h-8 w-8 text-accent" />
            ) : (
              <FileSpreadsheet className="h-8 w-8 text-text-muted" />
            )}
            <div>
              <p className="text-sm font-medium text-text-secondary">
                {isDragActive ? "Drop your CSV here" : "Import portfolio from CSV"}
              </p>
              <p className="mt-1 text-xs text-text-muted">Drag & drop or click to browse</p>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Correlation Matrix */}
      {positions.length >= 2 && <CorrelationMatrix />}

      {/* Add Position Modal */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Position"
        className="max-w-2xl"
      >
        <AddPositionForm onClose={() => setShowAddModal(false)} />
      </Modal>
    </div>
  );
}

function PositionsTable({
  positions,
  showType,
}: {
  positions: Position[];
  showType: boolean;
}) {
  return (
    <GlassCard className="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-glass-border text-text-muted">
            <th className="px-4 py-3 text-left font-medium">Ticker</th>
            <th className="px-4 py-3 text-left font-medium">Name</th>
            {showType && <th className="px-4 py-3 text-left font-medium">Type</th>}
            <th className="px-4 py-3 text-right font-medium">Qty</th>
            <th className="px-4 py-3 text-right font-medium">Avg Price</th>
            <th className="px-4 py-3 text-right font-medium">Current Price</th>
            <th className="px-4 py-3 text-right font-medium">Current Total</th>
            <th className="px-4 py-3 text-right font-medium">P&L%</th>
            <th className="px-4 py-3 text-right font-medium">Trend</th>
            <th className="px-4 py-3 text-right font-medium">Signal</th>
            <th className="min-w-[140px] px-4 py-3 text-right font-medium" title="Edit or remove this holding">
              Manage
            </th>
          </tr>
        </thead>
        <tbody>
          {positions.map((pos) => (
            <tr
              key={pos.id}
              className="border-b border-glass-border/50 transition-colors hover:bg-glass-hover"
            >
              <td className="px-4 py-3 font-mono font-semibold text-text-primary">
                {pos.ticker}
              </td>
              <td className="px-4 py-3 text-text-secondary">{pos.name}</td>
              {showType && (
                <td className="px-4 py-3">
                  <span className="rounded-md bg-glass px-2 py-0.5 text-xs capitalize text-text-muted">
                    {pos.assetType}
                  </span>
                </td>
              )}
              <td className="px-4 py-3 text-right text-text-primary">{pos.quantity}</td>
              <td className="px-4 py-3 text-right text-text-secondary">
                {formatCurrency(pos.avgPrice)}
              </td>
              <td className="px-4 py-3 text-right text-text-primary">
                {formatCurrency(pos.currentPrice)}
              </td>
              <td className="px-4 py-3 text-right text-text-primary">
                {formatCurrency(pos.currentValue ?? pos.currentPrice * pos.quantity)}
              </td>
              <td
                className={cn(
                  "px-4 py-3 text-right font-semibold",
                  pos.pnlPercent >= 0 ? "text-profit" : "text-loss"
                )}
              >
                {formatPercent(pos.pnlPercent)}
              </td>
              <td className="px-4 py-3">
                {pos.priceHistory && (
                  <Sparkline data={pos.priceHistory} className="ml-auto w-16" height={24} />
                )}
              </td>
              <td className="px-4 py-3 text-right">
                {pos.recommendation && (
                  <Badge recommendation={pos.recommendation as RecommendationType} />
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <PositionRowActions position={pos} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </GlassCard>
  );
}

function FixedIncomeGrid({
  positions,
}: {
  positions: Position[];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {positions.map((pos) => {
        const daysToMaturity =
          pos.maturityDate && pos.maturityDate.length > 0
            ? Math.ceil(
                (new Date(pos.maturityDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
              )
            : null;
        return (
          <GlassCard key={pos.id} hover>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className="rounded-md bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                  {pos.name}
                </span>
                <p className="mt-2 text-xs text-text-muted">{pos.rate}</p>
              </div>
              {pos.recommendation && (
                <div className="shrink-0">
                  <Badge recommendation={pos.recommendation as RecommendationType} />
                </div>
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-text-muted">Invested</p>
                <p className="font-semibold text-text-primary">
                  {formatCurrency(pos.investedAmount || pos.avgPrice * pos.quantity)}
                </p>
              </div>
              <div>
                <p className="text-text-muted">Current Value</p>
                <p className="font-semibold text-text-primary">
                  {formatCurrency(pos.currentValue || pos.currentPrice * pos.quantity)}
                </p>
              </div>
              <div>
                <p className="text-text-muted">Yield</p>
                <p className={cn("font-semibold", (pos.yieldPercent || 0) >= 0 ? "text-profit" : "text-loss")}>
                  {formatPercent(pos.yieldPercent || pos.pnlPercent)}
                </p>
              </div>
              <div>
                <p className="text-text-muted">Maturity</p>
                <p
                  className={cn(
                    "font-semibold",
                    daysToMaturity != null && daysToMaturity <= 30 ? "text-loss" : "text-text-primary"
                  )}
                >
                  {!pos.maturityDate
                    ? "Open-ended"
                    : daysToMaturity != null
                      ? `${daysToMaturity}d`
                      : "—"}
                </p>
              </div>
            </div>
            {pos.taxStatus && (
              <p className="mt-3 text-[10px] text-text-muted">Tax: {pos.taxStatus}</p>
            )}
            <PositionCardActions position={pos} />
          </GlassCard>
        );
      })}
    </div>
  );
}

function PositionRowActions({ position }: { position: Position }) {
  return (
    <PositionActionsInner position={position} layout="table" />
  );
}

function PositionCardActions({ position }: { position: Position }) {
  return (
    <PositionActionsInner position={position} layout="card" />
  );
}

function PositionActionsInner({
  position,
  layout,
}: {
  position: Position;
  layout: "table" | "card";
}) {
  const router = useRouter();
  const deletePosition = useDeletePosition();
  const label =
    position.assetType === "fixed-income"
      ? position.name.slice(0, 48)
      : position.ticker;

  const editHint =
    position.assetType === "fixed-income"
      ? "Edit balances, % CDI range, and tax-related overrides"
      : "Edit statement value and how this position is tracked";

  const onRemove = () => {
    if (
      !confirm(
        `Remove "${label}" from this portfolio?\n\nThis only removes it in the app — it does not sell at your broker.`
      )
    )
      return;
    deletePosition.mutate(position.id, {
      onSuccess: () => toast.success("Position removed from portfolio"),
      onError: (e: Error) =>
        toast.error("Could not remove position", { description: e.message }),
    });
  };

  const goEdit = () => {
    router.push(`/portfolio/${encodeURIComponent(position.id)}`);
  };

  if (layout === "card") {
    return (
      <div className="mt-4 flex flex-col gap-2 border-t border-glass-border pt-4">
        <p className="text-[10px] font-medium uppercase tracking-wide text-text-muted">Position</p>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            type="button"
            className="flex-1"
            title={editHint}
            onClick={goEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit position
          </Button>
          <Button
            variant="danger"
            size="sm"
            type="button"
            className="flex-1"
            title="Remove from this app only"
            disabled={deletePosition.isPending}
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-wrap items-center justify-end gap-2"
      role="group"
      aria-label={`Manage ${label}`}
    >
      <Button
        variant="ghost"
        size="sm"
        type="button"
        title={editHint}
        onClick={goEdit}
      >
        <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Edit
      </Button>
      <Button
        variant="danger"
        size="sm"
        type="button"
        title="Remove from this app only — does not sell at broker"
        disabled={deletePosition.isPending}
        onClick={onRemove}
      >
        <Trash2 className="h-3.5 w-3.5 shrink-0" />
        <span>Remove</span>
      </Button>
    </div>
  );
}
