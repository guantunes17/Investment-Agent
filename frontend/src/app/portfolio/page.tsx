"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Tabs } from "@/components/ui/tabs";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Badge, type RecommendationType } from "@/components/ui/badge";
import { Sparkline } from "@/components/ui/sparkline";
import { AllocationChart } from "@/components/charts/allocation-chart";
import { LoadingCard } from "@/components/ui/loading";
import { usePortfolioStore, type AssetType } from "@/stores/portfolio-store";
import { usePortfolio } from "@/hooks/use-portfolio";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import { Plus, Upload, FileSpreadsheet } from "lucide-react";
import { AddPositionForm } from "./add-position-form";
import { toast } from "sonner";

const tabs = [
  { id: "all", label: "All" },
  { id: "stock", label: "Stocks" },
  { id: "fixed-income", label: "Fixed-Income" },
  { id: "fii", label: "FIIs" },
];

export default function PortfolioPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const { isLoading } = usePortfolio();
  const { positions } = usePortfolioStore();

  const filteredPositions =
    activeTab === "all"
      ? positions
      : positions.filter((p) => p.assetType === activeTab);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      toast.success(`Imported ${file.name}`, {
        description: "Processing your portfolio CSV...",
      });
    }
  }, []);

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Portfolio</h1>
        <Button variant="primary" onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4" />
          Add Position
        </Button>
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
      <div
        {...getRootProps()}
        className={cn(
          "cursor-pointer rounded-2xl border-2 border-dashed border-glass-border p-8 text-center transition-colors",
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

      {/* Add Position Modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Add Position">
        <AddPositionForm onClose={() => setShowAddModal(false)} />
      </Modal>
    </div>
  );
}

function PositionsTable({
  positions,
  showType,
}: {
  positions: ReturnType<typeof usePortfolioStore.getState>["positions"];
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
            <th className="px-4 py-3 text-right font-medium">Current</th>
            <th className="px-4 py-3 text-right font-medium">P&L%</th>
            <th className="px-4 py-3 text-right font-medium">Trend</th>
            <th className="px-4 py-3 text-right font-medium">Signal</th>
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
  positions: ReturnType<typeof usePortfolioStore.getState>["positions"];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {positions.map((pos) => {
        const daysToMaturity = pos.maturityDate
          ? Math.ceil(
              (new Date(pos.maturityDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            )
          : null;
        return (
          <GlassCard key={pos.id} hover>
            <div className="flex items-start justify-between">
              <div>
                <span className="rounded-md bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                  {pos.name}
                </span>
                <p className="mt-2 text-xs text-text-muted">{pos.rate}</p>
              </div>
              {pos.recommendation && (
                <Badge recommendation={pos.recommendation as RecommendationType} />
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
                <p className={cn("font-semibold", daysToMaturity && daysToMaturity <= 30 ? "text-loss" : "text-text-primary")}>
                  {daysToMaturity != null ? `${daysToMaturity}d` : "—"}
                </p>
              </div>
            </div>
            {pos.taxStatus && (
              <p className="mt-3 text-[10px] text-text-muted">Tax: {pos.taxStatus}</p>
            )}
          </GlassCard>
        );
      })}
    </div>
  );
}
