"use client";

import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { mapPortfolioResponse, parsePositionId } from "@/lib/portfolio-mapper";
import type { AssetType } from "@/stores/portfolio-store";

/** Discriminated payload for add position (stocks/FII vs fixed income). */
export type AddPositionPayload =
  | {
      assetType: "stock" | "fii";
      ticker: string;
      name: string;
      quantity: number;
      avgPrice: number;
      reported_position_value?: number | null;
    }
  | {
      assetType: "fixed-income";
      name: string;
      issuer: string;
      asset_subtype: string;
      invested_amount: number;
      purchase_date: string;
      maturity_date: string | null;
      rate_type: string;
      rate_value: number;
      is_tax_exempt: boolean;
      cdi_index_mode?: "FIXED" | "RANGE";
      rate_ceiling_value?: number | null;
      projection_cdi_percent?: number | null;
      reported_position_value?: number | null;
    };

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
    mutationFn: async (payload: AddPositionPayload) => {
      if (payload.assetType === "fixed-income") {
        return apiFetch("/portfolio/fixed-income", {
          method: "POST",
          body: JSON.stringify({
            name: payload.name,
            issuer: payload.issuer,
            asset_subtype: payload.asset_subtype,
            invested_amount: payload.invested_amount,
            purchase_date: payload.purchase_date,
            maturity_date: payload.maturity_date,
            rate_type: payload.rate_type,
            rate_value: payload.rate_value,
            is_tax_exempt: payload.is_tax_exempt,
            cdi_index_mode: payload.cdi_index_mode ?? "FIXED",
            rate_ceiling_value: payload.rate_ceiling_value ?? null,
            projection_cdi_percent: payload.projection_cdi_percent ?? null,
            reported_position_value: payload.reported_position_value ?? null,
          }),
        });
      }
      const subtype = payload.assetType === "fii" ? "FII" : "STOCK";
      const stockBody: Record<string, unknown> = {
        ticker: payload.ticker,
        name: payload.name,
        exchange: "B3",
        asset_subtype: subtype,
        quantity: payload.quantity,
        avg_price: payload.avgPrice,
      };
      if (payload.reported_position_value != null) {
        stockBody.reported_position_value = payload.reported_position_value;
      }
      return apiFetch("/portfolio/stocks", {
        method: "POST",
        body: JSON.stringify(stockBody),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
    },
  });
}

export function useUpdatePosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      body,
    }: {
      id: string;
      body: Record<string, unknown>;
    }) => {
      const parsed = parsePositionId(id);
      if (!parsed) {
        return Promise.reject(new Error("Invalid position id"));
      }
      const path =
        parsed.kind === "stock"
          ? `/portfolio/stocks/${parsed.numericId}`
          : `/portfolio/fixed-income/${parsed.numericId}`;
      return apiFetch(path, {
        method: "PUT",
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["asset"] });
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
      queryClient.invalidateQueries({ queryKey: ["asset"] });
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
