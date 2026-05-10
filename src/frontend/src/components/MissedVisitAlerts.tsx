import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertOctagon,
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface MissedVisitAlert {
  mrId: bigint;
  mrName: string;
  doctorId: bigint;
  doctorName: string;
  lastVisitDate: string | null;
  daysSinceLastVisit: number;
}

interface Props {
  managerId: number;
  token: string;
  managerRole: "ASM" | "RSM" | "ZSM" | "HR" | "Admin";
}

function SeverityBadge({ days }: { days: number }) {
  if (days >= 30) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
        <AlertOctagon className="w-3 h-3" />
        {days}d — Critical
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
      <AlertTriangle className="w-3 h-3" />
      {days}d — Warning
    </span>
  );
}

export function MissedVisitAlerts({ managerId, token, managerRole }: Props) {
  const [alerts, setAlerts] = useState<MissedVisitAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [dismissing, setDismissing] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!token) return;
    setLoading(true);

    const apiAny = api as unknown as Record<
      string,
      (...args: unknown[]) => Promise<unknown>
    >;

    const fetchFn =
      managerRole === "Admin" || managerRole === "HR"
        ? apiAny.getMissedVisitAlertsAll
        : apiAny.getMissedVisitAlerts;

    if (typeof fetchFn !== "function") {
      setLoading(false);
      return;
    }

    const callArgs =
      managerRole === "Admin" || managerRole === "HR"
        ? [token]
        : [token, managerId];

    fetchFn(...callArgs)
      .then((data) => {
        const raw = data as MissedVisitAlert[];
        // Sort: most overdue first
        const sorted = [...raw].sort(
          (a, b) => b.daysSinceLastVisit - a.daysSinceLastVisit,
        );
        setAlerts(sorted);
      })
      .catch(() => setAlerts([]))
      .finally(() => setLoading(false));
  }, [token, managerId, managerRole]);

  async function handleDismiss(mrId: bigint, doctorId: bigint) {
    const key = `${mrId}-${doctorId}`;
    setDismissing((prev) => new Set(prev).add(key));

    const apiAny = api as unknown as Record<
      string,
      (...args: unknown[]) => Promise<unknown>
    >;
    const fn = apiAny.dismissMissedVisitAlert;
    if (typeof fn === "function") {
      await fn(token, mrId, doctorId).catch(() => null);
    }

    setAlerts((prev) =>
      prev.filter((a) => !(a.mrId === mrId && a.doctorId === doctorId)),
    );
    setDismissing((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  const criticalCount = alerts.filter((a) => a.daysSinceLastVisit >= 30).length;
  const warningCount = alerts.filter(
    (a) => a.daysSinceLastVisit >= 20 && a.daysSinceLastVisit < 30,
  ).length;

  return (
    <div
      className="bg-card border border-border rounded-lg overflow-hidden"
      data-ocid="missed-visit-alerts"
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors"
        data-ocid="missed-visit-alerts-toggle"
      >
        <div className="flex items-center gap-2">
          <Bell
            className={`w-4 h-4 ${alerts.length > 0 ? "text-destructive" : "text-muted-foreground"}`}
          />
          <span className="font-display font-semibold text-sm uppercase tracking-wide text-muted-foreground">
            Missed Visit Alerts (20+ days)
          </span>
          {alerts.length > 0 && (
            <Badge
              variant="destructive"
              className="text-xs px-1.5 py-0 rounded-full"
            >
              {alerts.length}
            </Badge>
          )}
          {criticalCount > 0 && (
            <span className="text-xs text-red-600 font-medium">
              {criticalCount} critical
            </span>
          )}
          {warningCount > 0 && (
            <span className="text-xs text-orange-600 font-medium">
              {warningCount} warning
            </span>
          )}
        </div>
        {collapsed ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {/* Body */}
      {!collapsed && (
        <div className="border-t border-border px-4 pb-4 pt-3">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : alerts.length === 0 ? (
            <div className="flex items-center gap-2 py-4 text-sm text-green-700">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              <span className="font-medium">
                All doctors visited recently — no alerts
              </span>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-thin pr-1">
              {alerts.map((alert) => {
                const key = `${alert.mrId}-${alert.doctorId}`;
                const isCritical = alert.daysSinceLastVisit >= 30;
                return (
                  <div
                    key={key}
                    className={`relative flex items-start gap-3 rounded-lg px-3 py-2.5 border ${
                      isCritical
                        ? "bg-red-50 border-red-200"
                        : "bg-orange-50 border-orange-200"
                    }`}
                    data-ocid={`alert-card-${key}`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {isCritical ? (
                        <AlertOctagon className="w-4 h-4 text-red-500" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-orange-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <SeverityBadge days={alert.daysSinceLastVisit} />
                      </div>
                      <p className="text-sm font-medium text-foreground">
                        <span className="font-semibold">{alert.mrName}</span>
                        <span className="text-muted-foreground"> → </span>
                        {alert.doctorName}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 shrink-0" />
                        {alert.lastVisitDate
                          ? `Last visited: ${alert.lastVisitDate}`
                          : "Never visited this month"}
                        <span className="mx-1">·</span>
                        <strong>{alert.daysSinceLastVisit} days</strong> since
                        last visit
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 shrink-0 hover:bg-muted/50 rounded-full"
                      onClick={() => handleDismiss(alert.mrId, alert.doctorId)}
                      disabled={dismissing.has(key)}
                      aria-label="Dismiss alert"
                      data-ocid={`btn-dismiss-alert-${key}`}
                    >
                      <X className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
