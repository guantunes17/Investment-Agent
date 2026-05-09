"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Briefcase,
  Eye,
  MessageSquare,
  FileText,
  Inbox,
  Settings,
  TrendingUp,
  DollarSign,
  BarChart3,
  Newspaper,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portfolio", label: "Portfolio", icon: Briefcase },
  { href: "/dividends", label: "Dividends", icon: DollarSign },
  { href: "/performance", label: "Performance", icon: BarChart3 },
  { href: "/watchlist", label: "Watchlist", icon: Eye },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/newsletter", label: "Newsletter", icon: Newspaper },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  const { data: countData } = useQuery<{ unread_count: number }>({
    queryKey: ["notifications-count"],
    queryFn: () => apiFetch("/notifications/count"),
    refetchInterval: 60_000,
  });
  const unreadCount = countData?.unread_count ?? 0;

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col border-r border-glass-border bg-glass backdrop-blur-xl md:flex">
        <div className="flex items-center gap-3 px-6 py-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/20">
            <TrendingUp className="h-5 w-5 text-accent" />
          </div>
          <span className="text-lg font-bold text-text-primary">InvestAI</span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            const showBadge = item.href === "/inbox" && unreadCount > 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors",
                  isActive
                    ? "text-text-primary"
                    : "text-text-muted hover:text-text-secondary hover:bg-glass-hover"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-xl bg-accent/10 border border-accent/20"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                <item.icon
                  className={cn(
                    "relative z-10 h-5 w-5",
                    isActive && "text-accent"
                  )}
                />
                <span className="relative z-10">{item.label}</span>
                {showBadge && (
                  <span className="relative z-10 ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-loss text-[10px] font-bold text-white shadow-[0_0_8px_rgba(255,51,102,0.4)]">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
                {isActive && (
                  <div className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r bg-accent shadow-[0_0_8px_rgba(51,102,255,0.6)]" />
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-glass-border bg-glass/80 backdrop-blur-xl md:hidden">
        {navItems.slice(0, 5).map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-3 text-[10px] font-medium transition-colors",
                isActive ? "text-accent" : "text-text-muted"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
