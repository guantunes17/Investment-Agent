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
import { FileText, Calendar, Download, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

interface Report {
  id: string;
  type: "daily" | "weekly";
  date: string;
  summary: string;
  sections: ReportSection[];
}

interface ReportSection {
  title: string;
  content: string;
  recommendations?: { ticker: string; recommendation: RecommendationType; reason: string }[];
}

export default function ReportsPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["reports"],
    queryFn: () => apiFetch<Report[]>("/reports"),
  });

  const generateReport = useMutation({
    mutationFn: () => apiFetch<Report>("/reports/generate", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      toast.success("Report generated successfully");
    },
    onError: () => {
      toast.error("Failed to generate report");
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
        <Button
          variant="primary"
          onClick={() => generateReport.mutate()}
          disabled={generateReport.isPending}
        >
          <Plus className="h-4 w-4" />
          {generateReport.isPending ? "Generating..." : "Generate Report"}
        </Button>
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
            return (
              <GlassCard key={report.id} className="overflow-hidden p-0" hover>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : report.id)}
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
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-text-muted" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-text-muted" />
                    )}
                  </div>
                </button>

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
                        {report.sections.map((section, i) => (
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
