import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Target,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Role } from "../../backend";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import type {
  MonthlyTarget,
  TargetRevision,
  TargetVsActual,
} from "../../types";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function fmt(n: number) {
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

function getStatusInfo(pct: number, elapsedPct: number) {
  const isOnTrack = pct >= elapsedPct;
  const isSlightly = !isOnTrack && pct >= elapsedPct * 0.75;
  if (isOnTrack)
    return {
      label: "On Track",
      icon: CheckCircle2,
      barCls: "bg-green-500",
      textCls: "text-green-700",
      badgeCls: "bg-green-100 text-green-800 border-green-300",
    };
  if (isSlightly)
    return {
      label: "Slightly Behind",
      icon: AlertTriangle,
      barCls: "bg-yellow-500",
      textCls: "text-yellow-700",
      badgeCls: "bg-yellow-100 text-yellow-800 border-yellow-300",
    };
  return {
    label: "Significantly Behind",
    icon: XCircle,
    barCls: "bg-red-500",
    textCls: "text-red-700",
    badgeCls: "bg-red-100 text-red-800 border-red-300",
  };
}

export default function MyMonthlyTargets() {
  const { session } = useAuthStore();
  const token = session?.token ?? "";
  const nowRef = new Date();
  const currentYear = nowRef.getFullYear();
  const currentMonthNum = nowRef.getMonth() + 1;

  const [month, setMonth] = useState(currentMonthNum);
  const [year, setYear] = useState(currentYear);
  const [target, setTarget] = useState<MonthlyTarget | null>(null);
  const [tva, setTva] = useState<TargetVsActual | null>(null);
  const [history, setHistory] = useState<TargetRevision[]>([]);
  const [pastTargets, setPastTargets] = useState<MonthlyTarget[]>([]);
  const [loading, setLoading] = useState(false);

  const yearOpts = [nowRef.getFullYear() - 1, nowRef.getFullYear()];
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;

  // Days elapsed progress
  const totalDays = new Date(year, month, 0).getDate();
  const elapsedDays =
    month === currentMonthNum && year === currentYear
      ? Math.min(nowRef.getDate(), totalDays)
      : totalDays;
  const elapsedPct = (elapsedDays / totalDays) * 100;

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      api.getMyMonthlyTarget(token, BigInt(month), BigInt(year)),
      api.getMyTargetVsActual(token, BigInt(month), BigInt(year)),
      api.getTargetRevisionHistory(
        token,
        session!.userId,
        BigInt(month),
        BigInt(year),
      ),
    ])
      .then(([t, tv, rev]) => {
        setTarget(t);
        setTva(tv);
        setHistory(rev);
      })
      .finally(() => setLoading(false));
  }, [token, month, year, session]);

  // Last 6 months
  useEffect(() => {
    if (!token) return;
    const fetches: Promise<MonthlyTarget | null>[] = [];
    for (let i = 1; i <= 6; i++) {
      let m = currentMonthNum - i;
      let y = currentYear;
      if (m <= 0) {
        m += 12;
        y -= 1;
      }
      fetches.push(api.getMyMonthlyTarget(token, BigInt(m), BigInt(y)));
    }
    Promise.all(fetches).then((results) =>
      setPastTargets(results.filter((t): t is MonthlyTarget => t !== null)),
    );
  }, [token, currentMonthNum, currentYear]);

  const achievementPct = tva?.achievementPct ?? 0;
  const statusInfo = getStatusInfo(achievementPct, elapsedPct);
  const StatusIcon = statusInfo.icon;

  return (
    <PortalLayout portalRole={Role.MR}>
      <PageHeader
        title="My Monthly Target"
        subtitle="View your assigned sales target and track performance"
        actions={
          <div className="flex items-center gap-2">
            <Select
              value={String(month)}
              onValueChange={(v) => setMonth(Number(v))}
            >
              <SelectTrigger
                className="w-36 h-8 text-sm"
                data-ocid="month-selector"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={m} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(year)}
              onValueChange={(v) => setYear(Number(v))}
            >
              <SelectTrigger
                className="w-24 h-8 text-sm"
                data-ocid="year-selector"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOpts.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />
      <PageContent>
        {/* Target Overview Card */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Target className="w-4 h-4" /> {MONTHS[month - 1]} {year} Target
              </h2>
              {!loading && target && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${statusInfo.badgeCls}`}
                >
                  <StatusIcon className="w-3 h-3" />
                  {statusInfo.label}
                </span>
              )}
            </div>

            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-40" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : target ? (
              <>
                <p className="text-3xl font-display font-bold text-foreground tabular-nums mb-4">
                  {fmt(target.targetAmount)}
                </p>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Achievement Progress</span>
                      <span className={`font-semibold ${statusInfo.textCls}`}>
                        {achievementPct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${statusInfo.barCls}`}
                        style={{ width: `${Math.min(achievementPct, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>Actual: {fmt(tva?.actualAmount ?? 0)}</span>
                      <span>
                        Remaining:{" "}
                        {fmt(tva?.remainingTarget ?? target.targetAmount)}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>
                        Days Elapsed ({elapsedDays}/{totalDays})
                      </span>
                      <span>{elapsedPct.toFixed(0)}% of month</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-border rounded-full"
                        style={{ width: `${elapsedPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <Target className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm font-medium">No target assigned</p>
                <p className="text-xs mt-1">
                  Contact your manager or HR to set a target for{" "}
                  {MONTHS[month - 1]} {year}
                </p>
              </div>
            )}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                label: "Sales Target",
                value: loading ? null : fmt(target?.targetAmount ?? 0),
                icon: Target,
                sub: monthKey,
              },
              {
                label: "Actual Sales",
                value: loading ? null : fmt(tva?.actualAmount ?? 0),
                icon: TrendingUp,
                sub: "this month",
              },
              {
                label: "Achievement",
                value: loading ? null : `${achievementPct.toFixed(1)}%`,
                icon: StatusIcon,
                sub: statusInfo.label,
              },
              {
                label: "Remaining",
                value: loading
                  ? null
                  : fmt(Math.max(tva?.remainingTarget ?? 0, 0)),
                icon: TrendingDown,
                sub: "to reach target",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="bg-muted/30 border border-border rounded-lg p-4"
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <item.icon className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground font-display uppercase tracking-wide">
                    {item.label}
                  </span>
                </div>
                {loading ? (
                  <Skeleton className="h-6 w-20" />
                ) : (
                  <>
                    <p className="text-lg font-display font-bold text-foreground tabular-nums">
                      {item.value}
                    </p>
                    <p className="text-xs text-muted-foreground">{item.sub}</p>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Revision History */}
        {history.length > 0 && (
          <div className="bg-card border border-border rounded-lg mb-6">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                Target Revision History — {MONTHS[month - 1]} {year}
              </h3>
            </div>
            <div className="divide-y divide-border">
              {history.map((rev, i) => {
                const revDate = new Date(Number(rev.revisedAt) / 1_000_000);
                const isIncrease = rev.newAmount > rev.previousAmount;
                const revKey = `${String(rev.revisedAt)}-${i}`;
                return (
                  <div
                    key={revKey}
                    className="px-4 py-3 flex items-start justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-foreground font-medium">
                        {fmt(rev.previousAmount)} →{" "}
                        <span
                          className={
                            isIncrease ? "text-green-700" : "text-red-700"
                          }
                        >
                          {fmt(rev.newAmount)}
                        </span>
                      </p>
                      {rev.remarks && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {rev.remarks}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {revDate.toLocaleDateString("en-IN")}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Past 6 months */}
        <div className="bg-card border border-border rounded-lg">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground">
              Previous 6 Months Targets
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-body">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  {["Month", "Target Amount", "Remarks"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-xs uppercase tracking-wider font-display text-muted-foreground text-left"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pastTargets.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-8 text-center text-muted-foreground text-sm"
                    >
                      No previous targets found
                    </td>
                  </tr>
                ) : (
                  pastTargets.map((pt) => (
                    <tr
                      key={pt.id}
                      className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-4 py-2.5 text-foreground">
                        {MONTHS[Number(pt.month) - 1]} {String(pt.year)}
                      </td>
                      <td className="px-4 py-2.5 font-mono font-semibold text-foreground">
                        {fmt(pt.targetAmount)}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground truncate max-w-xs">
                        {pt.remarks || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </PageContent>
    </PortalLayout>
  );
}
