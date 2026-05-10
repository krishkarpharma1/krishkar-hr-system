import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { Role } from "../../backend";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import { PerformanceStatus, TargetPeriod } from "../../types";
import type { PerformanceRow } from "../../types";
import { ROLE_LABELS } from "../../types";

const PERIODS: { label: string; value: TargetPeriod }[] = [
  { label: "Monthly", value: TargetPeriod.Monthly },
  { label: "Quarterly", value: TargetPeriod.Quarterly },
  { label: "Half-Yearly", value: TargetPeriod.HalfYearly },
  { label: "Yearly", value: TargetPeriod.Yearly },
];

function formatRupee(n: number): string {
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function statusConfig(status: PerformanceStatus) {
  switch (status) {
    case PerformanceStatus.OnTrack:
      return {
        label: "On Track",
        icon: CheckCircle2,
        rowCls: "bg-green-50/60",
        badgeCls: "bg-green-100 text-green-800 border-green-300",
        textCls: "text-green-700",
      };
    case PerformanceStatus.SlightlyBehind:
      return {
        label: "Slightly Behind",
        icon: AlertTriangle,
        rowCls: "bg-yellow-50/60",
        badgeCls: "bg-yellow-100 text-yellow-800 border-yellow-300",
        textCls: "text-yellow-700",
      };
    case PerformanceStatus.SignificantlyBehind:
      return {
        label: "Behind",
        icon: XCircle,
        rowCls: "bg-red-50/60",
        badgeCls: "bg-red-100 text-red-800 border-red-300",
        textCls: "text-red-700",
      };
  }
}

interface BreadcrumbItem {
  userId: string;
  label: string;
}

interface Props {
  portalRole?: Role;
}

export default function TargetVsActualPerformance({ portalRole }: Props) {
  const { session } = useAuthStore();
  const token = session?.token ?? "";
  const effectiveRole =
    portalRole ?? (session?.role as Role | undefined) ?? Role.ASM;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [period, setPeriod] = useState<TargetPeriod>(TargetPeriod.Monthly);
  const [rows, setRows] = useState<PerformanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([
    { userId: "self", label: "Your Team" },
  ]);

  const drillFromId =
    breadcrumb.length > 1
      ? BigInt(breadcrumb[breadcrumb.length - 1].userId)
      : undefined;

  useEffect(() => {
    if (!token || !session?.userId) return;
    setLoading(true);
    api
      .getTargetVsActualPerformance(token, {
        period,
        year: BigInt(currentYear),
        month:
          period === TargetPeriod.Monthly ? BigInt(currentMonth) : undefined,
        managerId: session.userId,
        drillDownFrom: drillFromId,
      })
      .then(setRows)
      .finally(() => setLoading(false));
  }, [token, session?.userId, period, drillFromId, currentYear, currentMonth]);

  function drillDown(row: PerformanceRow) {
    // Only ASM / RSM / ZSM rows can be drilled into
    const drillableRoles: Role[] = [Role.ASM, Role.RSM, Role.ZSM];
    if (!drillableRoles.includes(row.role)) return;
    setBreadcrumb((prev) => [
      ...prev,
      { userId: String(row.userId), label: `${row.name}'s Team` },
    ]);
  }

  function goBack(idx: number) {
    setBreadcrumb((prev) => prev.slice(0, idx + 1));
  }

  function exportExcel() {
    const data = rows.map((r) => ({
      "Employee Name": r.name,
      "Employee UID": r.employeeId,
      Role: ROLE_LABELS[r.role] ?? r.role,
      Territory: r.territory ?? "—",
      Area: r.area ?? "—",
      "Assigned Target (₹)": r.targetAmount,
      "Actual Sales (₹)": r.actualSales,
      "Achievement %": r.achievementPct.toFixed(1),
      "Remaining Target (₹)": r.remainingTarget,
      "Projected Achievement (₹)": r.projectedAchievement,
      Status: r.performanceStatus,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Performance");
    XLSX.writeFile(wb, `team-performance-${period}-${currentYear}.xlsx`);
  }

  const managerableRoles: Role[] = [Role.ASM, Role.RSM, Role.ZSM];

  return (
    <PortalLayout portalRole={effectiveRole}>
      <PageHeader
        title="Target vs. Actual Performance"
        subtitle="Team performance against assigned targets for the selected period"
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={exportExcel}
            disabled={rows.length === 0}
            data-ocid="btn-export-performance"
          >
            <Download className="w-4 h-4 mr-1.5" /> Export Excel
          </Button>
        }
      />
      <PageContent>
        {/* Period Filter */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <span className="text-sm text-muted-foreground font-body mr-1">
            Period:
          </span>
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => {
                setPeriod(p.value);
                setBreadcrumb([{ userId: "self", label: "Your Team" }]);
              }}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors border ${
                period === p.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border text-foreground hover:bg-muted/60"
              }`}
              data-ocid={`period-btn-${p.value.toLowerCase()}`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Breadcrumb */}
        {breadcrumb.length > 1 && (
          <div className="flex items-center gap-1 mb-4 flex-wrap">
            {breadcrumb.map((crumb, idx) => (
              <span key={crumb.userId} className="flex items-center gap-1">
                {idx > 0 && (
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                )}
                {idx < breadcrumb.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => goBack(idx)}
                    className="text-sm text-primary hover:underline font-medium"
                  >
                    {crumb.label}
                  </button>
                ) : (
                  <span className="text-sm font-semibold text-foreground">
                    {crumb.label}
                  </span>
                )}
              </span>
            ))}
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                setBreadcrumb((prev) => prev.slice(0, prev.length - 1))
              }
              className="ml-2 h-7 px-2 text-xs"
              data-ocid="btn-drill-back"
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Back
            </Button>
          </div>
        )}

        {/* Desktop Table */}
        <div className="hidden md:block bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-body min-w-[900px]">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  {[
                    { label: "Employee", align: "left" },
                    { label: "Role", align: "left" },
                    { label: "Assigned Target", align: "right" },
                    { label: "Actual Sales", align: "right" },
                    { label: "Achievement %", align: "right" },
                    { label: "Remaining", align: "right" },
                    { label: "Projected", align: "right" },
                    { label: "Status", align: "left" },
                  ].map((col) => (
                    <th
                      key={col.label}
                      className={`px-4 py-3 text-xs uppercase tracking-wider font-display text-muted-foreground whitespace-nowrap text-${col.align}`}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [0, 1, 2, 3, 4].map((i) => (
                    <tr
                      key={i}
                      className="border-b border-border last:border-0"
                    >
                      {[0, 1, 2, 3, 4, 5, 6, 7].map((j) => (
                        <td key={j} className="px-4 py-3">
                          <Skeleton className="h-4 w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-12 text-center text-muted-foreground"
                      data-ocid="performance-empty-state"
                    >
                      <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p>No performance data for this period.</p>
                      <p className="text-xs mt-1">
                        Targets must be assigned to see performance.
                      </p>
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const cfg = statusConfig(row.performanceStatus);
                    const Icon = cfg.icon;
                    const canDrill = managerableRoles.includes(row.role);
                    return (
                      <tr
                        key={String(row.userId)}
                        className={`border-b border-border last:border-0 transition-colors ${cfg.rowCls} ${canDrill ? "cursor-pointer hover:opacity-90" : ""}`}
                        onClick={() => canDrill && drillDown(row)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && canDrill && drillDown(row)
                        }
                        tabIndex={canDrill ? 0 : undefined}
                        data-ocid={`perf-row-${String(row.userId)}`}
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground text-sm">
                            {row.name}
                            {canDrill && (
                              <ChevronRight className="inline w-3.5 h-3.5 ml-1 text-muted-foreground" />
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {row.employeeId}
                            {row.territory ? ` · ${row.territory}` : ""}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="secondary"
                            className="text-xs font-mono"
                          >
                            {row.role}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-foreground tabular-nums">
                          {formatRupee(row.targetAmount)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-foreground tabular-nums">
                          {formatRupee(row.actualSales)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`font-mono font-semibold tabular-nums ${cfg.textCls}`}
                          >
                            {pct(row.achievementPct)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-muted-foreground tabular-nums">
                          {formatRupee(row.remainingTarget)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-foreground tabular-nums">
                          {formatRupee(row.projectedAchievement)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${cfg.badgeCls}`}
                          >
                            <Icon className="w-3 h-3" />
                            {cfg.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Card Layout */}
        <div className="md:hidden space-y-3">
          {loading ? (
            [0, 1, 2].map((i) => (
              <div
                key={i}
                className="bg-card border border-border rounded-lg p-4 space-y-2"
              >
                {[0, 1, 2, 3].map((j) => (
                  <Skeleton key={j} className="h-4 w-full" />
                ))}
              </div>
            ))
          ) : rows.length === 0 ? (
            <div
              className="bg-card border border-border rounded-lg p-8 text-center text-muted-foreground"
              data-ocid="performance-empty-mobile"
            >
              <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No performance data for this period.</p>
            </div>
          ) : (
            rows.map((row) => {
              const cfg = statusConfig(row.performanceStatus);
              const Icon = cfg.icon;
              const canDrill = managerableRoles.includes(row.role);
              return (
                <div
                  key={String(row.userId)}
                  className={`border border-border rounded-lg p-4 ${cfg.rowCls} ${canDrill ? "cursor-pointer active:opacity-80" : ""}`}
                  onClick={() => canDrill && drillDown(row)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && canDrill && drillDown(row)
                  }
                  tabIndex={canDrill ? 0 : undefined}
                  data-ocid={`perf-card-${String(row.userId)}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground text-sm truncate">
                        {row.name}
                        {canDrill && (
                          <ChevronRight className="inline w-3.5 h-3.5 ml-1 text-muted-foreground" />
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {row.employeeId}
                        {row.territory ? ` · ${row.territory}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <Badge variant="secondary" className="text-xs">
                        {row.role}
                      </Badge>
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium border ${cfg.badgeCls}`}
                      >
                        <Icon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Target</p>
                      <p className="font-mono font-semibold text-foreground">
                        {formatRupee(row.targetAmount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Actual Sales</p>
                      <p className="font-mono font-semibold text-foreground">
                        {formatRupee(row.actualSales)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Achievement</p>
                      <p className={`font-mono font-bold ${cfg.textCls}`}>
                        {pct(row.achievementPct)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Remaining</p>
                      <p className="font-mono text-foreground">
                        {formatRupee(row.remainingTarget)}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted-foreground">
                        Projected by Period End
                      </p>
                      <p className="font-mono font-semibold text-foreground">
                        {formatRupee(row.projectedAchievement)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> On Track —
            achievement ≥ expected
          </span>
          <span className="flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-yellow-600" /> Slightly
            Behind — ≥75% of expected
          </span>
          <span className="flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5 text-red-600" /> Behind — &lt;75% of
            expected
          </span>
        </div>
      </PageContent>
    </PortalLayout>
  );
}
