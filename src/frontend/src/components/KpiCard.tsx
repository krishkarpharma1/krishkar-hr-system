import { Card } from "@/components/ui/card";
import type React from "react";

interface KpiCardProps {
  title: string;
  value: string | number;
  target?: number;
  progressBar?: boolean;
  icon?: React.ReactNode;
  accentColor?: string;
  subtitle?: string;
}

function getProgressColor(pct: number): string {
  if (pct >= 80) return "#22c55e"; // green
  if (pct >= 60) return "#f97316"; // orange
  return "#ef4444"; // red
}

export function KpiCard({
  title,
  value,
  target,
  progressBar = false,
  icon,
  accentColor = "#0EA5E9",
  subtitle,
}: KpiCardProps) {
  const numericValue =
    typeof value === "number" ? value : Number.parseFloat(String(value)) || 0;
  const pct =
    target && target > 0
      ? Math.min(100, Math.round((numericValue / target) * 100))
      : 0;
  const progressColor = getProgressColor(pct);

  return (
    <Card className="p-4 flex flex-col gap-2 w-full min-w-0 bg-card border border-border shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground leading-tight flex-1 min-w-0">
          {title}
        </p>
        {icon && (
          <span
            className="flex-shrink-0 p-1.5 rounded-lg"
            style={{ background: `${accentColor}18`, color: accentColor }}
          >
            {icon}
          </span>
        )}
      </div>

      <div className="flex items-end gap-2 min-w-0">
        <span
          className="text-2xl font-bold leading-none truncate"
          style={{ color: accentColor }}
        >
          {value}
        </span>
        {target !== undefined && (
          <span className="text-xs text-muted-foreground pb-0.5 flex-shrink-0">
            vs {target} target
          </span>
        )}
      </div>

      {subtitle && (
        <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
      )}

      {progressBar && target !== undefined && target > 0 && (
        <div className="mt-1 space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Achievement</span>
            <span
              className="text-xs font-semibold"
              style={{ color: progressColor }}
            >
              {pct}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: progressColor }}
            />
          </div>
        </div>
      )}
    </Card>
  );
}
