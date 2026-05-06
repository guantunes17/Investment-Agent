"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Badge, type RecommendationType } from "@/components/ui/badge";
import { LoadingCard } from "@/components/ui/loading";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { FileText, Calendar, Download, Plus, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { toast } from "sonner";

type ConfidenceLevel = "high" | "medium" | "low";
type ScorecardStatus = "positive" | "neutral" | "warning" | "negative";

interface Report {
  id: string;
  type: "daily" | "weekly";
  date: string;
  summary: string;
  scorecards: Scorecard[];
  actionItems: string[];
  confidence: { level: ConfidenceLevel; reason: string };
  dataLimitations: string[];
  sections: ReportSection[];
}

interface Scorecard {
  id: string;
  label: string;
  value: string;
  status: ScorecardStatus;
  reason: string;
}

interface ReportSection {
  title: string;
  content: string;
  recommendations?: { ticker: string; recommendation: RecommendationType; reason: string }[];
}

interface ApiReport {
  id: number;
  report_type?: string;
  title?: string;
  created_at?: string;
  content_json?: Record<string, unknown> | null;
}

interface SchedulerSettings {
  daily_enabled: boolean;
  weekly_enabled: boolean;
  weekly_day: string;
  daily_hour: number;
  daily_minute: number;
  weekly_hour: number;
  weekly_minute: number;
  timezone: string;
}

const WEEKDAY_OPTIONS: { value: string; label: string }[] = [
  { value: "mon", label: "Segunda-feira" },
  { value: "tue", label: "Terça-feira" },
  { value: "wed", label: "Quarta-feira" },
  { value: "thu", label: "Quinta-feira" },
  { value: "fri", label: "Sexta-feira" },
  { value: "sat", label: "Sábado" },
  { value: "sun", label: "Domingo" },
];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function normalizeScorecards(value: unknown): Scorecard[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, idx) => {
    const obj = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
    const rawStatus = String(obj.status ?? "neutral").toLowerCase();
    const status: ScorecardStatus =
      rawStatus === "positive" || rawStatus === "warning" || rawStatus === "negative"
        ? rawStatus
        : "neutral";
    return {
      id: String(obj.id ?? `card_${idx + 1}`),
      label: String(obj.label ?? `Indicador ${idx + 1}`),
      value: String(obj.value ?? ""),
      status,
      reason: String(obj.reason ?? ""),
    };
  });
}

function normalizeConfidence(value: unknown): { level: ConfidenceLevel; reason: string } {
  const obj = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const rawLevel = String(obj.level ?? "medium").toLowerCase();
  const level: ConfidenceLevel = rawLevel === "high" || rawLevel === "low" ? rawLevel : "medium";
  return {
    level,
    reason: String(obj.reason ?? "Confiança moderada com base nos dados disponíveis."),
  };
}

function prettyText(value: unknown, level = 0): string {
  const indent = "  ".repeat(level);
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === "object" && item !== null
          ? `${indent}-\n${prettyText(item, level + 1)}`
          : `${indent}- ${String(item)}`
      )
      .join("\n");
  }
  if (typeof value === "object" && value !== null) {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => {
        const label = k.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
        if (typeof v === "object" && v !== null) {
          return `${indent}${label}:\n${prettyText(v, level + 1)}`;
        }
        return `${indent}- ${label}: ${String(v)}`;
      })
      .join("\n");
  }
  return `${indent}${String(value)}`;
}

function normalizeReports(raw: ApiReport[]): Report[] {
  return raw.map((r) => {
    const content = (r.content_json ?? {}) as Record<string, unknown>;
    const explicitSections = Array.isArray(content.sections) ? content.sections : null;

    const sections: ReportSection[] =
      explicitSections?.map((s) => {
        const recs = Array.isArray((s as Record<string, unknown>).recommendations)
          ? ((s as Record<string, unknown>).recommendations as Array<Record<string, unknown>>)
              .map((rec) => ({
                ticker: String(rec.ticker ?? ""),
                recommendation: String(rec.recommendation ?? "HOLD").toUpperCase() as RecommendationType,
                reason: String(rec.reason ?? ""),
              }))
              .filter((x) => x.ticker.length > 0)
          : undefined;
        return {
          title: String((s as Record<string, unknown>).title ?? "Section"),
          content: String((s as Record<string, unknown>).content ?? ""),
          recommendations: recs,
        };
      }) ??
      Object.entries(content)
        .filter(([k]) => !["title", "generated_at", "report_type", "summary"].includes(k))
        .map(([k, v]) => ({
          title: k.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()),
          content: typeof v === "string" ? v : prettyText(v),
        }));

    const summary =
      typeof content.summary === "string" && content.summary.trim().length > 0
        ? content.summary
        : typeof r.title === "string"
          ? r.title
          : "Generated report";

    let scorecards = normalizeScorecards(content.scorecards);
    const actionItems = Array.isArray(content.action_items)
      ? (content.action_items as unknown[])
          .map((v) => String(v).trim())
          .filter((v) => v.length > 0)
      : [];
    const confidence = normalizeConfidence(content.confidence);
    const dataLimitations = Array.isArray(content.data_limitations)
      ? (content.data_limitations as unknown[])
          .map((v) => String(v).trim())
          .filter((v) => v.length > 0)
      : [];

    // Backward compatibility for legacy reports that only have summary + sections.
    if (scorecards.length === 0) {
      scorecards = [
        {
          id: "legacy_summary",
          label: "Resumo do Relatório",
          value: summary,
          status: "neutral",
          reason: "Formato legado sem scorecards estruturados.",
        },
      ];
    }

    return {
      id: String(r.id),
      type: (String(r.report_type ?? "daily").toLowerCase() === "weekly" ? "weekly" : "daily"),
      date: String(r.created_at ?? new Date().toISOString()).slice(0, 10),
      summary,
      scorecards,
      actionItems,
      confidence,
      dataLimitations,
      sections,
    };
  });
}

export default function ReportsPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [manualType, setManualType] = useState<"daily" | "weekly">("daily");
  const queryClient = useQueryClient();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const raw = await apiFetch<ApiReport[]>("/reports");
      return normalizeReports(raw);
    },
  });

  const generateReport = useMutation({
    mutationFn: (reportType: "daily" | "weekly") =>
      apiFetch<Report>("/reports/generate", {
        method: "POST",
        body: JSON.stringify({ report_type: reportType }),
        timeout: 90000,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      toast.success("Report generated successfully");
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to generate report");
    },
  });

  const { data: schedulerSettings } = useQuery({
    queryKey: ["report-scheduler-settings"],
    queryFn: () => apiFetch<SchedulerSettings>("/reports/scheduler/settings"),
  });

  const updateSchedulerSettings = useMutation({
    mutationFn: (payload: {
      daily_enabled?: boolean;
      weekly_enabled?: boolean;
      weekly_day?: string;
    }) =>
      apiFetch<SchedulerSettings>("/reports/scheduler/settings", {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-scheduler-settings"] });
      toast.success("Scheduler settings updated");
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to update scheduler settings");
    },
  });

  const deleteReport = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/reports/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      toast.success("Report deleted");
      setExpandedId(null);
    },
    onError: () => {
      toast.error("Failed to delete report");
    },
  });

  const handleDownload = (report: Report) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head><title>Report - ${report.date}</title>
        <style>
          body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; }
          h1 { color: #1a1a2e; }
          h2 { color: #333; margin-top: 24px; }
          p { line-height: 1.6; color: #555; }
          .recommendation { padding: 8px 12px; margin: 4px 0; background: #f5f5f5; border-radius: 8px; }
        </style></head>
        <body>
          <h1>${report.type.charAt(0).toUpperCase() + report.type.slice(1)} Report — ${report.date}</h1>
          <p>${report.summary}</p>
          ${report.sections.map((s) => `
            <h2>${s.title}</h2>
            <p>${s.content}</p>
            ${s.recommendations?.map((r) => `
              <div class="recommendation"><strong>${r.ticker}</strong> — ${r.recommendation}: ${r.reason}</div>
            `).join("") || ""}
          `).join("")}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Reports</h1>
        <div className="flex items-center gap-2">
          <select
            className="rounded-lg border border-glass-border bg-glass px-2 py-1 text-xs text-text-primary"
            value={manualType}
            onChange={(e) => setManualType(e.target.value === "weekly" ? "weekly" : "daily")}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
          <Button
            variant="primary"
            onClick={() => generateReport.mutate(manualType)}
            disabled={generateReport.isPending}
          >
            <Plus className="h-4 w-4" />
            {generateReport.isPending ? "Generating..." : `Generate ${manualType === "daily" ? "Daily" : "Weekly"}`}
          </Button>
        </div>
      </div>
      <div className="rounded-lg border border-glass-border bg-glass p-4 space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-primary">
            Agendamento automático
          </p>
          <p className="mt-1 text-xs text-text-muted">
            Horários abaixo vêm do servidor (variáveis{" "}
            <span className="font-mono">DAILY_REPORT_*</span> e{" "}
            <span className="font-mono">WEEKLY_REPORT_*</span> no{" "}
            <span className="font-mono">.env</span>). O dia da semanal você escolhe aqui; demais ajustes de
            horário exigem alterar o ambiente e reiniciar o container do agendador.
          </p>
        </div>
        {schedulerSettings && (
          <div className="grid gap-2 text-sm text-text-secondary sm:grid-cols-2">
            <div className="rounded-md border border-glass-border bg-glass-hover/30 px-3 py-2">
              <p className="text-[10px] font-bold uppercase text-text-muted">Relatório diário</p>
              <p className="mt-0.5 font-medium text-text-primary">
                {pad2(schedulerSettings.daily_hour)}:{pad2(schedulerSettings.daily_minute)} ·{" "}
                {schedulerSettings.timezone}
              </p>
            </div>
            <div className="rounded-md border border-glass-border bg-glass-hover/30 px-3 py-2">
              <p className="text-[10px] font-bold uppercase text-text-muted">Relatório semanal</p>
              <p className="mt-0.5 font-medium text-text-primary">
                {WEEKDAY_OPTIONS.find((d) => d.value === schedulerSettings.weekly_day)?.label ??
                  schedulerSettings.weekly_day}{" "}
                às {pad2(schedulerSettings.weekly_hour)}:{pad2(schedulerSettings.weekly_minute)} ·{" "}
                {schedulerSettings.timezone}
              </p>
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-6 text-sm text-text-secondary">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="rounded border-glass-border"
              checked={schedulerSettings?.daily_enabled ?? true}
              onChange={(e) => updateSchedulerSettings.mutate({ daily_enabled: e.target.checked })}
              disabled={updateSchedulerSettings.isPending || !schedulerSettings}
            />
            Gerar diário automaticamente
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="rounded border-glass-border"
              checked={schedulerSettings?.weekly_enabled ?? true}
              onChange={(e) => updateSchedulerSettings.mutate({ weekly_enabled: e.target.checked })}
              disabled={updateSchedulerSettings.isPending || !schedulerSettings}
            />
            Gerar semanal automaticamente
          </label>
        </div>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
          <label htmlFor="weekly-day" className="text-sm text-text-secondary shrink-0">
            Dia da semana (semanal)
          </label>
          <select
            id="weekly-day"
            className="max-w-xs rounded-lg border border-glass-border bg-glass px-3 py-2 text-sm text-text-primary"
            value={schedulerSettings?.weekly_day ?? "mon"}
            onChange={(e) => updateSchedulerSettings.mutate({ weekly_day: e.target.value })}
            disabled={updateSchedulerSettings.isPending || !schedulerSettings}
          >
            {WEEKDAY_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-text-muted">
          Isso só afeta geração automática pelo agendador. Você pode gerar relatórios manualmente a qualquer
          momento.
        </p>
      </div>

      {reports.length === 0 ? (
        <GlassCard>
          <div className="flex flex-col items-center gap-4 py-8">
            <FileText className="h-12 w-12 text-text-muted" />
            <p className="text-text-muted">No reports yet. Generate your first report.</p>
          </div>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => {
            const isExpanded = expandedId === report.id;
            const confidenceClass =
              report.confidence.level === "high"
                ? "bg-profit/10 text-profit"
                : report.confidence.level === "low"
                  ? "bg-loss/10 text-loss"
                  : "bg-secondary/10 text-secondary";
            return (
              <GlassCard key={report.id} className="overflow-hidden p-0" hover>
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  onClick={() => setExpandedId(isExpanded ? null : report.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setExpandedId(isExpanded ? null : report.id);
                    }
                  }}
                  className="flex w-full cursor-pointer items-center gap-4 p-5 text-left"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10">
                    <FileText className="h-5 w-5 text-accent" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "rounded-md px-2 py-0.5 text-[10px] font-bold uppercase",
                          report.type === "daily"
                            ? "bg-profit/10 text-profit"
                            : "bg-secondary/10 text-secondary"
                        )}
                      >
                        {report.type}
                      </span>
                      <div className="flex items-center gap-1 text-xs text-text-muted">
                        <Calendar className="h-3 w-3" />
                        {report.date}
                      </div>
                      <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-bold uppercase", confidenceClass)}>
                        confiança {report.confidence.level}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-text-secondary line-clamp-2">
                      {report.summary}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(report);
                      }}
                      className="rounded-lg p-2 text-text-muted transition-colors hover:bg-glass-hover hover:text-text-primary cursor-pointer"
                      title="Download report"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!confirm("Delete this report from the page?")) return;
                        deleteReport.mutate(report.id);
                      }}
                      className="rounded-lg p-2 text-text-muted transition-colors hover:bg-loss/20 hover:text-loss cursor-pointer"
                      title="Delete report"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-text-muted" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-text-muted" />
                    )}
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-4 border-t border-glass-border p-5">
                        <div className="space-y-3">
                          <h3 className="text-sm font-semibold text-text-primary">Resumo Executivo</h3>
                          <div className="grid gap-2 md:grid-cols-2">
                            {(report.scorecards ?? []).map((card) => {
                              const statusClass =
                                card.status === "positive"
                                  ? "border-profit/30 bg-profit/5"
                                  : card.status === "warning"
                                    ? "border-yellow-500/30 bg-yellow-500/5"
                                    : card.status === "negative"
                                      ? "border-loss/30 bg-loss/5"
                                      : "border-glass-border bg-glass";
                              return (
                                <div key={card.id} className={cn("rounded-lg border p-3", statusClass)}>
                                  <p className="text-[11px] uppercase tracking-wide text-text-muted">{card.label}</p>
                                  <p className="mt-1 text-sm font-medium text-text-primary">{card.value}</p>
                                  {card.reason && (
                                    <p className="mt-1 text-xs leading-relaxed text-text-muted">{card.reason}</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {report.actionItems.length > 0 && (
                            <div className="rounded-lg border border-glass-border bg-glass p-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-text-primary">
                                Ações Prioritárias
                              </p>
                              <ul className="mt-2 space-y-1 text-sm text-text-secondary">
                                {report.actionItems.map((action, idx) => (
                                  <li key={idx}>- {action}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {(report.dataLimitations.length > 0 || report.confidence.reason) && (
                            <div className="rounded-lg border border-glass-border bg-glass p-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-text-primary">
                                Confiança & Limitações
                              </p>
                              <p className="mt-1 text-xs text-text-secondary">{report.confidence.reason}</p>
                              {report.dataLimitations.length > 0 && (
                                <ul className="mt-2 space-y-1 text-xs text-text-muted">
                                  {report.dataLimitations.map((limitation, idx) => (
                                    <li key={idx}>- {limitation}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="border-t border-glass-border pt-4">
                          <h3 className="text-sm font-semibold text-text-primary">Diagnóstico Detalhado</h3>
                        </div>
                        {(report.sections ?? []).map((section, i) => (
                          <div key={i}>
                            <h3 className="text-sm font-semibold text-text-primary">
                              {section.title}
                            </h3>
                            <p className="mt-1 text-sm leading-relaxed text-text-secondary">
                              {section.content}
                            </p>
                            {section.recommendations &&
                              section.recommendations.length > 0 && (
                                <div className="mt-3 space-y-2">
                                  {section.recommendations.map((rec, j) => (
                                    <div
                                      key={j}
                                      className="flex items-center gap-3 rounded-lg bg-glass p-2"
                                    >
                                      <span className="font-mono text-xs font-bold text-text-primary">
                                        {rec.ticker}
                                      </span>
                                      <Badge recommendation={rec.recommendation} />
                                      <span className="text-xs text-text-muted">
                                        {rec.reason}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
