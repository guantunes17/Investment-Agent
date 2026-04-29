"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import type { AssetType } from "@/stores/portfolio-store";
import { useAddPosition } from "@/hooks/use-portfolio";
import { toast } from "sonner";

const assetTabs = [
  { id: "stock", label: "Stock" },
  { id: "fixed-income", label: "Fixed Income" },
  { id: "fii", label: "FII" },
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
  const [rate, setRate] = useState("");
  const [maturityDate, setMaturityDate] = useState("");
  const addPosition = useAddPosition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addPosition.mutate(
      {
        assetType,
        ticker: ticker.toUpperCase(),
        name,
        quantity: Number(quantity),
        avgPrice: Number(avgPrice),
        currentPrice: Number(avgPrice),
        pnl: 0,
        pnlPercent: 0,
        ...(assetType === "fixed-income" && { rate, maturityDate }),
      },
      {
        onSuccess: () => {
          toast.success("Position added successfully");
          onClose();
        },
        onError: (error) => {
          toast.error("Failed to add position", { description: error.message });
        },
      }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Tabs tabs={assetTabs} activeTab={assetType} onChange={(id) => setAssetType(id as AssetType)} />

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Ticker"
          placeholder="e.g. PETR4"
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          required
        />
        <Input
          label="Name"
          placeholder="e.g. Petrobras"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Quantity"
          type="number"
          placeholder="0"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
        />
        <Input
          label="Avg Price"
          type="number"
          step="0.01"
          placeholder="0.00"
          value={avgPrice}
          onChange={(e) => setAvgPrice(e.target.value)}
          required
        />
      </div>

      {assetType === "fixed-income" && (
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Rate"
            placeholder="e.g. CDI + 2%"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
          <Input
            label="Maturity Date"
            type="date"
            value={maturityDate}
            onChange={(e) => setMaturityDate(e.target.value)}
          />
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
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
