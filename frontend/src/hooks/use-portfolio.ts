"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { usePortfolioStore, type Position } from "@/stores/portfolio-store";
import { useEffect } from "react";

export function usePortfolio() {
  const { setPositions, setLoading, setError } = usePortfolioStore();

  const query = useQuery({
    queryKey: ["portfolio"],
    queryFn: () => apiFetch<Position[]>("/portfolio"),
    refetchInterval: 30000,
  });

  useEffect(() => {
    setLoading(query.isLoading);
    if (query.data) setPositions(query.data);
    if (query.error) setError(query.error.message);
  }, [query.data, query.isLoading, query.error, setPositions, setLoading, setError]);

  return query;
}

export function useAddPosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (position: Omit<Position, "id">) =>
      apiFetch<Position>("/portfolio", {
        method: "POST",
        body: JSON.stringify(position),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
    },
  });
}

export function useDeletePosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/portfolio/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
    },
  });
}

export function useAssetDetail(assetId: string) {
  return useQuery({
    queryKey: ["asset", assetId],
    queryFn: () => apiFetch<Position & { technicals?: Record<string, number>; fundamentals?: Record<string, number> }>(`/portfolio/${assetId}`),
    enabled: !!assetId,
  });
}
