"use client";

import { useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Bell,
  Download,
  Clock,
  AlertTriangle,
  FileSpreadsheet,
} from "lucide-react";
import { cn } from "@/lib/utils";

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between">
      <span className="text-sm text-text-secondary">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 rounded-full transition-colors duration-200",
          "shadow-[inset_0_1px_3px_rgba(0,0,0,0.3)]",
          checked ? "bg-accent" : "bg-white/10"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-200",
            "shadow-[0_1px_3px_rgba(0,0,0,0.3)]",
            checked && "translate-x-5"
          )}
        />
      </button>
    </label>
  );
}

export default function SettingsPage() {
  const [inAppNotifications, setInAppNotifications] = useState(true);
  const [priceAlertThreshold, setPriceAlertThreshold] = useState("5");
  const [maturityAlertDays, setMaturityAlertDays] = useState("30");
  const [notifyOnRecommendationChange, setNotifyOnRecommendationChange] = useState(true);
  const [notifyOnRateChange, setNotifyOnRateChange] = useState(true);

  const handleSave = () => {
    toast.success("Settings saved successfully");
  };

  const handleExportCSV = async (type: string) => {
    try {
      const res = await fetch(`/api/portfolio/${type}?format=csv`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `portfolio-${type}-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${type} portfolio`);
    } catch {
      toast.error("Export failed. Make sure the backend is running.");
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">Settings</h1>

      {/* Notification Preferences */}
      <GlassCard>
        <div className="mb-5 flex items-center gap-2">
          <Bell className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-semibold text-text-primary">Notifications</h2>
        </div>
        <div className="space-y-5">
          <Toggle
            checked={inAppNotifications}
            onChange={setInAppNotifications}
            label="In-app notifications"
          />

          <div className="border-t border-glass-border pt-4">
            <h3 className="mb-3 text-sm font-medium text-text-secondary">Alert Triggers</h3>
            <div className="space-y-4">
              <Toggle
                checked={notifyOnRecommendationChange}
                onChange={setNotifyOnRecommendationChange}
                label="Recommendation changes (e.g., HOLD → SELL)"
              />
              <Toggle
                checked={notifyOnRateChange}
                onChange={setNotifyOnRateChange}
                label="CDI/Selic rate changes"
              />
              <Input
                label="Price movement threshold (%)"
                type="number"
                placeholder="5"
                value={priceAlertThreshold}
                onChange={(e) => setPriceAlertThreshold(e.target.value)}
                icon={<AlertTriangle className="h-4 w-4" />}
              />
              <Input
                label="Maturity alert window (days)"
                type="number"
                placeholder="30"
                value={maturityAlertDays}
                onChange={(e) => setMaturityAlertDays(e.target.value)}
                icon={<Clock className="h-4 w-4" />}
              />
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Export */}
      <GlassCard>
        <div className="mb-5 flex items-center gap-2">
          <Download className="h-5 w-5 text-secondary" />
          <h2 className="text-lg font-semibold text-text-primary">Export Portfolio</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { label: "Stocks", type: "stocks" },
            { label: "Fixed-Income", type: "fixed-income" },
            { label: "FIIs", type: "fiis" },
          ].map((item) => (
            <Button
              key={item.label}
              variant="ghost"
              size="sm"
              onClick={() => handleExportCSV(item.type)}
              className="gap-2"
            >
              <FileSpreadsheet className="h-4 w-4" />
              {item.label}
            </Button>
          ))}
        </div>
      </GlassCard>

      <div className="flex justify-end">
        <Button variant="primary" onClick={handleSave}>
          Save All Settings
        </Button>
      </div>
    </div>
  );
}
