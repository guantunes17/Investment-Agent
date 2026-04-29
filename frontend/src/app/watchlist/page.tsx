"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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

const tabs = [
  { id: "all", label: "All" },
  { id: "stock", label: "Stocks" },
  { id: "fixed-income", label: "Fixed-Income" },
  { id: "fii", label: "FIIs" },
];

export default function WatchlistPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");

  const { data: watchlist = [], isLoading } = useQuery({
    queryKey: ["watchlist"],
    queryFn: () => apiFetch<WatchlistItem[]>("/watchlist"),
  });

  const filteredItems = watchlist.filter((item) => {
    const matchesTab = activeTab === "all" || item.assetType === activeTab;
    const matchesSearch =
      !search ||
      item.ticker.toLowerCase().includes(search.toLowerCase()) ||
      item.name.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const handleAddToWatchlist = () => {
    if (!search) return;
    toast.success(`Searching for "${search}"...`);
  };

  const handleRemove = (id: string) => {
    toast.info("Removed from watchlist");
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingCard />
        <LoadingCard />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">Watchlist</h1>

      {/* Search bar */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search ticker or asset name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-glass-border bg-glass py-2.5 pl-10 pr-4 text-sm text-text-primary placeholder:text-text-muted backdrop-blur-md outline-none transition-all focus:border-accent/50 focus:ring-2 focus:ring-accent/20"
          />
        </div>
        <Button variant="primary" onClick={handleAddToWatchlist}>
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Watchlist items */}
      {filteredItems.length === 0 ? (
        <GlassCard>
          <p className="text-center text-text-muted">
            {search
              ? `No results for "${search}"`
              : "Your watchlist is empty. Search for assets to add."}
          </p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => (
            <GlassCard key={item.id} hover className="relative">
              <button
                onClick={() => handleRemove(item.id)}
                className="absolute right-3 top-3 rounded-lg p-1 text-text-muted transition-colors hover:bg-glass-hover hover:text-text-primary cursor-pointer"
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
                    {formatCurrency(item.currentPrice)}
                  </p>
                  <p
                    className={cn(
                      "text-xs font-semibold",
                      item.changePercent >= 0 ? "text-profit" : "text-loss"
                    )}
                  >
                    {formatPercent(item.changePercent)}
                  </p>
                </div>
                {item.priceHistory && (
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
