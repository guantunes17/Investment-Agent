"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Tabs } from "@/components/ui/tabs";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Badge, type RecommendationType } from "@/components/ui/badge";
import { Sparkline } from "@/components/ui/sparkline";
import { LoadingCard } from "@/components/ui/loading";
import { apiFetch } from "@/lib/api";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import { Plus, Search, X } from "lucide-react";
import { toast } from "sonner";

interface WatchlistItem {
  id: string;
  ticker: string;
  name: string;
  assetType: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  recommendation?: string;
  priceHistory?: number[];
}

interface ApiWatchlistItem {
  id: number;
  asset_type: string;
  identifier: string;
  name: string;
  created_at?: string;
}

function mapApiItem(api: ApiWatchlistItem): WatchlistItem {
  const raw = (api.asset_type ?? "stock").toLowerCase();
  const assetType =
    raw === "fii" ? "fii" : raw.includes("fixed") ? "fixed-income" : "stock";
  return {
    id: String(api.id),
    ticker: api.identifier,
    name: api.name?.trim() || api.identifier,
    assetType,
    currentPrice: 0,
    change: 0,
    changePercent: 0,
  };
}

const tabs = [
  { id: "all", label: "All" },
  { id: "stock", label: "Stocks" },
  { id: "fixed-income", label: "Fixed-Income" },
  { id: "fii", label: "FIIs" },
];

export default function WatchlistPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [newAssetType, setNewAssetType] = useState<"stock" | "fii">("stock");
  const queryClient = useQueryClient();

  const { data: rawList = [], isLoading } = useQuery({
    queryKey: ["watchlist"],
    queryFn: () => apiFetch<ApiWatchlistItem[]>("/watchlist", { timeout: 30_000 }),
  });

  const watchlist = rawList.map(mapApiItem);

  const addMutation = useMutation({
    mutationFn: async () => {
      const id = search.trim().toUpperCase();
      if (!id) throw new Error("Enter a ticker or name");
      return apiFetch<ApiWatchlistItem>("/watchlist", {
        method: "POST",
        body: JSON.stringify({
          asset_type: newAssetType,
          identifier: id,
          name: id,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
      setSearch("");
      toast.success("Added to watchlist");
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Could not add item");
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/watchlist/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
      toast.info("Removed from watchlist");
    },
    onError: () => toast.error("Could not remove item"),
  });

  const filteredItems = watchlist.filter((item) => {
    const matchesTab = activeTab === "all" || item.assetType === activeTab;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      item.ticker.toLowerCase().includes(q) ||
      item.name.toLowerCase().includes(q);
    return matchesTab && matchesSearch;
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingCard />
        <LoadingCard />
      </div>
    );
  }

  const emptyCopy = (() => {
    if (watchlist.length === 0) {
      return search.trim()
        ? `No saved assets yet. Click Add to save “${search.trim()}”.`
        : "Your watchlist is empty. Enter a ticker (e.g. PETR4) and choose Stock or FII, then click Add.";
    }
    return `No matches for “${search}” in this tab.`;
  })();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">Watchlist</h1>

      {/* Search bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            id="watchlist-search"
            name="watchlistSearch"
            type="search"
            placeholder="Ticker or name (e.g. PETR4, WEGE3)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-glass-border bg-glass py-2.5 pl-10 pr-4 text-sm text-text-primary placeholder:text-text-muted backdrop-blur-md outline-none transition-all focus:border-accent/50 focus:ring-2 focus:ring-accent/20"
            autoComplete="off"
          />
        </div>
        <div className="flex shrink-0 gap-2">
          <label htmlFor="watchlist-asset-type" className="sr-only">
            Asset type for new item
          </label>
          <select
            id="watchlist-asset-type"
            name="assetType"
            value={newAssetType}
            onChange={(e) => setNewAssetType(e.target.value === "fii" ? "fii" : "stock")}
            className="rounded-xl border border-glass-border bg-glass px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent/50"
          >
            <option value="stock">Stock</option>
            <option value="fii">FII</option>
          </select>
          <Button
            variant="primary"
            onClick={() => addMutation.mutate()}
            disabled={addMutation.isPending || !search.trim()}
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Watchlist items */}
      {filteredItems.length === 0 ? (
        <GlassCard>
          <p className="text-center text-text-muted">{emptyCopy}</p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => (
            <GlassCard key={item.id} hover className="relative">
              <button
                type="button"
                onClick={() => removeMutation.mutate(item.id)}
                className="absolute right-3 top-3 rounded-lg p-1 text-text-muted transition-colors hover:bg-glass-hover hover:text-text-primary cursor-pointer"
                title="Remove"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <div className="flex items-start justify-between pr-6">
                <div>
                  <p className="font-mono text-sm font-bold text-text-primary">
                    {item.ticker}
                  </p>
                  <p className="text-xs text-text-muted">{item.name}</p>
                </div>
                <span className="rounded-md bg-glass px-2 py-0.5 text-[10px] capitalize text-text-muted">
                  {item.assetType}
                </span>
              </div>
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <p className="text-lg font-bold text-text-primary">
                    {item.currentPrice > 0 ? (
                      formatCurrency(item.currentPrice)
                    ) : (
                      <span className="text-sm font-normal text-text-muted">Live quote not loaded</span>
                    )}
                  </p>
                  {item.currentPrice > 0 && (
                    <p
                      className={cn(
                        "text-xs font-semibold",
                        item.changePercent >= 0 ? "text-profit" : "text-loss"
                      )}
                    >
                      {formatPercent(item.changePercent)}
                    </p>
                  )}
                </div>
                {item.priceHistory && item.priceHistory.length > 0 && (
                  <Sparkline data={item.priceHistory} className="w-20" height={28} />
                )}
              </div>
              {item.recommendation && (
                <div className="mt-3 border-t border-glass-border pt-3">
                  <Badge recommendation={item.recommendation as RecommendationType} />
                </div>
              )}
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
