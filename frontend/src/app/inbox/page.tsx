"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  Check,
  Trash2,
  BellOff,
  Clock,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import type { Notification } from "@/stores/notification-store";

const filterTabs = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "maturity", label: "Maturity" },
  { id: "recommendations", label: "Recommendations" },
];

const typeConfig: Record<
  string,
  { color: string; bg: string; glow: string; label: string; icon: React.ReactNode }
> = {
  maturity_warning: {
    color: "text-hold",
    bg: "bg-hold/15",
    glow: "shadow-[0_0_6px_rgba(255,170,0,0.3)]",
    label: "Maturity",
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  maturity_urgent: {
    color: "text-loss",
    bg: "bg-loss/15",
    glow: "shadow-[0_0_6px_rgba(255,51,102,0.3)]",
    label: "Urgent",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  recommendation: {
    color: "text-accent",
    bg: "bg-accent/15",
    glow: "shadow-[0_0_6px_rgba(51,102,255,0.3)]",
    label: "Recommendation",
    icon: <TrendingUp className="h-3.5 w-3.5" />,
  },
  rate_change: {
    color: "text-secondary",
    bg: "bg-secondary/15",
    glow: "shadow-[0_0_6px_rgba(170,51,255,0.3)]",
    label: "Rate Change",
    icon: <TrendingUp className="h-3.5 w-3.5" />,
  },
  info: {
    color: "text-text-muted",
    bg: "bg-white/5",
    glow: "",
    label: "Info",
    icon: <Bell className="h-3.5 w-3.5" />,
  },
};

function getTypeConfig(type: string) {
  return typeConfig[type] ?? typeConfig.info;
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function InboxPage() {
  const [activeTab, setActiveTab] = useState("all");
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: () => apiFetch<Notification[]>("/notifications/"),
    refetchInterval: 60_000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/notifications/${id}/read`, { method: "PUT" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiFetch("/notifications/read-all", { method: "PUT" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/notifications/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const filtered = notifications.filter((n) => {
    if (activeTab === "unread") return !n.is_read;
    if (activeTab === "maturity")
      return n.notification_type === "maturity_warning" || n.notification_type === "maturity_urgent";
    if (activeTab === "recommendations")
      return n.notification_type === "recommendation";
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-text-primary">Inbox</h1>
          {unreadCount > 0 && (
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-accent/20 px-2 text-xs font-bold text-accent">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
          >
            <Check className="h-4 w-4" />
            Mark All as Read
          </Button>
        )}
      </div>

      <Tabs tabs={filterTabs} activeTab={activeTab} onChange={setActiveTab} />

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <GlassCard className="flex flex-col items-center justify-center py-16">
          <BellOff className="mb-4 h-12 w-12 text-text-muted/40" />
          <p className="text-lg font-medium text-text-muted">No notifications yet</p>
          <p className="mt-1 text-sm text-text-muted/60">
            {activeTab !== "all"
              ? "Try switching to a different filter"
              : "You're all caught up!"}
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((notif) => {
              const cfg = getTypeConfig(notif.notification_type);
              return (
                <motion.div
                  key={notif.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -40, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <GlassCard
                    hover
                    className={cn(
                      "relative overflow-hidden",
                      !notif.is_read &&
                        "border-l-2 border-l-accent shadow-[inset_4px_0_12px_-4px_rgba(51,102,255,0.15)]"
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wide",
                              cfg.bg,
                              cfg.color,
                              cfg.glow
                            )}
                          >
                            {cfg.icon}
                            {cfg.label}
                          </span>
                          <span className="text-xs text-text-muted">
                            {relativeTime(notif.created_at)}
                          </span>
                          {!notif.is_read && (
                            <span className="h-2 w-2 rounded-full bg-accent shadow-[0_0_6px_rgba(51,102,255,0.6)]" />
                          )}
                        </div>
                        <h3 className="text-sm font-semibold text-text-primary">
                          {notif.title}
                        </h3>
                        <p className="mt-1 text-sm leading-relaxed text-text-secondary">
                          {notif.body}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        {!notif.is_read && (
                          <button
                            onClick={() => markReadMutation.mutate(notif.id)}
                            disabled={markReadMutation.isPending}
                            className="rounded-lg p-2 text-text-muted transition-colors hover:bg-white/5 hover:text-accent"
                            title="Mark as read"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteMutation.mutate(notif.id)}
                          disabled={deleteMutation.isPending}
                          className="rounded-lg p-2 text-text-muted transition-colors hover:bg-loss/10 hover:text-loss"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
