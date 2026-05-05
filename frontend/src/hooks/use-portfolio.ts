"use client";

import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { mapPortfolioResponse, parsePositionId } from "@/lib/portfolio-mapper";
import type { Position, AssetType } from "@/stores/portfolio-store";

export function usePortfolio() {
  const query = useQuery({
    queryKey: ["portfolio"],
    queryFn: async () => {
      const raw = await apiFetch<unknown>("/portfolio");
      return mapPortfolioResponse(raw);
    },
    refetchInterval: 60_000,
  });

  const positions = query.data ?? [];

  const summary = useMemo(() => {
    const totalValue = positions.reduce((sum, p) => sum + p.currentPrice * p.quantity, 0);
    const totalCost = positions.reduce((sum, p) => sum + p.avgPrice * p.quantity, 0);
    const dailyPnl = positions.reduce((sum, p) => sum + p.pnl, 0);
    const dailyPnlPercent = totalCost > 0 ? (dailyPnl / totalCost) * 100 : 0;
    return { totalValue, dailyPnl, dailyPnlPercent };
  }, [positions]);

  const getPositionsByType = (type: AssetType) =>
    positions.filter((p) => p.assetType === type);

  return {
    ...query,
    positions,
    ...summary,
    getPositionsByType,
  };
}

export function useAddPosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (position: Omit<Position, "id">) => {
      if (position.assetType === "fixed-income") {
        const today = new Date().toISOString().split("T")[0];
        const maturity =
          position.maturityDate && position.maturityDate.length > 0
            ? position.maturityDate
            : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        const invested = position.quantity * position.avgPrice;
        return apiFetch("/portfolio/fixed-income", {
          method: "POST",
          body: JSON.stringify({
            name: position.name,
            issuer: position.name,
            asset_subtype: "CDB",
            invested_amount: invested,
            purchase_date: today,
            maturity_date: maturity,
            rate_type: "PCT_CDI",
            rate_value: 100,
            is_tax_exempt: false,
          }),
        });
      }
      const subtype = position.assetType === "fii" ? "FII" : "STOCK";
      return apiFetch("/portfolio/stocks", {
        method: "POST",
        body: JSON.stringify({
          ticker: position.ticker,
          name: position.name,
          exchange: "B3",
          asset_subtype: subtype,
          quantity: position.quantity,
          avg_price: position.avgPrice,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
    },
  });
}

export function useDeletePosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => {
      const parsed = parsePositionId(id);
      if (!parsed) {
        return Promise.reject(new Error("Invalid position id"));
      }
      if (parsed.kind === "stock") {
        return apiFetch(`/portfolio/stocks/${parsed.numericId}`, { method: "DELETE" });
      }
      return apiFetch(`/portfolio/fixed-income/${parsed.numericId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
    },
  });
}

export function useAssetDetail(assetId: string) {
  return useQuery({
    queryKey: ["asset", assetId],
    queryFn: async () => {
      const raw = await apiFetch<unknown>("/portfolio");
      const positions = mapPortfolioResponse(raw);
      return positions.find((p) => p.id === assetId) ?? null;
    },
    enabled: !!assetId,
  });
}
