"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { GlassCard } from "@/components/ui/glass-card";
import { LoadingCard } from "@/components/ui/loading";
import { apiFetch } from "@/lib/api";
import { ExternalLink, RefreshCw, Search, Newspaper } from "lucide-react";
import { cn } from "@/lib/utils";

interface NewsArticle {
  title: string;
  summary?: string;
  url: string;
  source?: string;
  published_at?: string;
  thumbnail?: string;
  related_tickers?: string[];
}

interface NewsResponse {
  articles: NewsArticle[];
  last_updated: string;
}

function timeAgo(isoString?: string): string {
  if (!isoString) return "";
  const ms = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NewsletterPage() {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching } = useQuery<NewsResponse>({
    queryKey: ["portfolio-news"],
    queryFn: () => apiFetch<NewsResponse>("/portfolio/news"),
    staleTime: 10 * 60 * 1000,
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["portfolio-news"] });
  };

  const articles = data?.articles ?? [];

  const filtered = search.trim()
    ? articles.filter((a) => {
        const q = search.trim().toLowerCase();
        return (
          a.title.toLowerCase().includes(q) ||
          a.source?.toLowerCase().includes(q) ||
          a.related_tickers?.some((t) => t.toLowerCase().includes(q))
        );
      })
    : articles;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Newspaper className="h-6 w-6 text-accent" />
          <h1 className="text-2xl font-bold text-text-primary">Newsletter</h1>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isFetching}
          className="flex items-center gap-1.5 rounded-xl border border-glass-border bg-glass px-3 py-2 text-xs text-text-secondary transition-colors hover:bg-glass-hover hover:text-text-primary disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Search/filter */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          type="search"
          placeholder="Filter by keyword, source, or ticker…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-glass-border bg-glass py-2.5 pl-10 pr-4 text-sm text-text-primary placeholder:text-text-muted backdrop-blur-md outline-none transition-all focus:border-accent/50 focus:ring-2 focus:ring-accent/20"
        />
      </div>

      {data?.last_updated && (
        <p className="text-xs text-text-muted">
          Last updated {timeAgo(data.last_updated)} · News for your portfolio holdings · cached 30 min
        </p>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <LoadingCard key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filtered.length === 0 && (
        <GlassCard>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Newspaper className="h-10 w-10 text-text-muted/40" />
            <p className="text-sm text-text-muted">
              {articles.length === 0
                ? "No news available. Add stock positions to see relevant news here."
                : `No articles match "${search}".`}
            </p>
          </div>
        </GlassCard>
      )}

      {/* Articles grid */}
      {!isLoading && filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((article, idx) => (
            <GlassCard key={idx} hover className="flex flex-col gap-3">
              {/* Thumbnail */}
              {article.thumbnail && (
                <div className="h-36 w-full overflow-hidden rounded-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={article.thumbnail}
                    alt=""
                    className="h-full w-full object-cover opacity-80"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              )}

              {/* Content */}
              <div className="flex flex-1 flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-text-muted">
                    {article.source ?? "Unknown source"}
                  </span>
                  <span className="text-[10px] text-text-muted">
                    {timeAgo(article.published_at)}
                  </span>
                </div>

                <h3 className="line-clamp-3 text-sm font-semibold leading-snug text-text-primary">
                  {article.title}
                </h3>

                {article.summary && (
                  <p className="line-clamp-2 text-xs text-text-muted">
                    {article.summary}
                  </p>
                )}

                {/* Ticker badges */}
                {article.related_tickers && article.related_tickers.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {article.related_tickers.map((t) => (
                      <span
                        key={t}
                        className="rounded-md bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] text-accent"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Read more */}
              {article.url && (
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-auto flex items-center gap-1 text-xs text-accent transition-opacity hover:opacity-70"
                >
                  Read more
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
