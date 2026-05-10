import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import type { TargetRevision, TargetVsActual } from "../../types";

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
function pct(n: number) {
  return `${n.toFixed(1)}%`;
}

function rowStatus(achPct: number, elapsedPct: number) {
  const on = achPct >= elapsedPct;
  const slight = !on && achPct >= elapsedPct * 0.75;
  if (on)
    return {
      label: "On Track",
      icon: CheckCircle2,
      rowCls: "bg-green-50/60",
      badgeCls: "bg-green-100 text-green-800 border-green-300",
    };
  if (slight)
    return {
      label: "Slightly Behind",
      icon: AlertTriangle,
      rowCls: "bg-yellow-50/60",
      badgeCls: "bg-yellow-100 text-yellow-800 border-yellow-300",
    };
  return {
    label: "Behind",
    icon: XCircle,
    rowCls: "bg-red-50/60",
    badgeCls: "bg-red-100 text-red-800 border-red-300",
  };
}

export default function RSMMonthlyTargets() {
  const { session } = useAuthStore();
  const token = session?.token ?? "";
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [rows, setRows] = useState<TargetVsActual[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<TargetVsActual | null>(null);
  const [revHistory, setRevHistory] = useState<TargetRevision[]>([]);
  const [revLoading, setRevLoading] = useState(false);

  const totalDays = new Date(year, month, 0).getDate();
  const elapsedDays =
    month === now.getMonth() + 1 && year === now.getFullYear()
      ? Math.min(now.getDate(), totalDays)
      : totalDays;
  const elapsedPct = (elapsedDays / totalDays) * 100;

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api
      .getTeamTargetVsActual(token, BigInt(month), BigInt(year))
      .then(setRows)
      .finally(() => setLoading(false));
  }, [token, month, year]);

  function openDetail(row: TargetVsActual) {
    setSelected(row);
    setRevLoading(true);
    api
      .getTargetRevisionHistory(token, row.userId, BigInt(month), BigInt(year))
      .then(setRevHistory)
      .finally(() => setRevLoading(false));
  }

  function exportExcel() {
    const data = rows.map((r) => ({
      "Employee Name": r.name,
      "Employee UID": r.employeeId,
      Role: r.role,
      Territory: r.territory ?? "—",
      Area: r.area ?? "—",
      "Target (₹)": r.targetAmount,
      "Actual Sales (₹)": r.actualAmount,
      "Achievement %": r.achievementPct.toFixed(1),
      "Remaining (₹)": r.remainingTarget,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "MonthlyTargets");
    XLSX.writeFile(
      wb,
      `rsm-monthly-targets-${year}-${String(month).padStart(2, "0")}.xlsx`,
    );
  }

  return (
    <PortalLayout portalRole={Role.RSM}>
      <PageHeader
        title="Monthly Team Targets"
        subtitle={`${MONTHS[month - 1]} ${year} — Regional team target vs. actual`}
        actions={
          <div className="flex items-center gap-2">
            <Select
              value={String(month)}
              onValueChange={(v) => setMonth(Number(v))}
            >
              <SelectTrigger
                className="w-36 h-8 text-sm"
                data-ocid="month-select"
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
              <SelectTrigger className="w-24 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[now.getFullYear() - 1, now.getFullYear()].map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              onClick={exportExcel}
              disabled={rows.length === 0}
              data-ocid="btn-export-targets"
            >
              <Download className="w-4 h-4 mr-1.5" /> Export
            </Button>
          </div>
        }
      />
      <PageContent>
        {selected ? (
          <div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              onKeyDown={(e) => e.key === "Enter" && setSelected(null)}
              className="flex items-center gap-1 text-sm text-primary hover:underline mb-4"
            >
              ← Back to Team
            </button>
            <div className="bg-card border border-border rounded-lg p-5 mb-4">
              <h3 className="font-display font-semibold mb-1">
                {selected.name}
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                {selected.employeeId} · {selected.territory ?? "—"}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { l: "Target", v: fmt(selected.targetAmount) },
                  { l: "Actual", v: fmt(selected.actualAmount) },
                  { l: "Achievement", v: pct(selected.achievementPct) },
                  {
                    l: "Remaining",
                    v: fmt(Math.max(selected.remainingTarget, 0)),
                  },
                ].map((s) => (
                  <div key={s.l} className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">{s.l}</p>
                    <p className="text-base font-display font-bold text-foreground">
                      {s.v}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg">
              <div className="px-4 py-3 border-b border-border">
                <h4 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                  Revision History
                </h4>
              </div>
              {revLoading ? (
                <div className="p-4 space-y-2">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : revHistory.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  No revisions recorded for this month.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {revHistory.map((r, i) => (
                    <div
                      key={`${String(r.revisedAt)}-${i}`}
                      className="px-4 py-3 flex justify-between items-start gap-2"
                    >
                      <div>
                        <p className="text-sm text-foreground">
                          {fmt(r.previousAmount)} → {fmt(r.newAmount)}
                        </p>
                        {r.remarks && (
                          <p className="text-xs text-muted-foreground">
                            {r.remarks}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(
                          Number(r.revisedAt) / 1_000_000,
                        ).toLocaleDateString("en-IN")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-body min-w-[800px]">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    {[
                      "Employee",
                      "Role",
                      "Territory",
                      "Target",
                      "Actual Sales",
                      "Achievement %",
                      "Remaining",
                      "Status",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-xs uppercase tracking-wider font-display text-muted-foreground text-left"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [0, 1, 2, 3].map((i) => (
                      <tr key={i} className="border-b border-border">
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
                      >
                        <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p>
                          No targets assigned for {MONTHS[month - 1]} {year}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => {
                      const s = rowStatus(row.achievementPct, elapsedPct);
                      const Icon = s.icon;
                      return (
                        <tr
                          key={String(row.userId)}
                          className={`border-b border-border last:border-0 cursor-pointer hover:opacity-90 transition-colors ${s.rowCls}`}
                          onClick={() => openDetail(row)}
                          onKeyDown={(e) =>
                            e.key === "Enter" && openDetail(row)
                          }
                          tabIndex={0}
                          data-ocid={`target-row-${String(row.userId)}`}
                        >
                          <td className="px-4 py-3">
                            <p className="font-medium text-foreground">
                              {row.name}{" "}
                              <ChevronRight className="inline w-3.5 h-3.5 text-muted-foreground" />
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {row.employeeId}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="secondary" className="text-xs">
                              {row.role}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-sm">
                            {row.territory ?? "—"}
                          </td>
                          <td className="px-4 py-3 font-mono text-foreground">
                            {fmt(row.targetAmount)}
                          </td>
                          <td className="px-4 py-3 font-mono text-foreground">
                            {fmt(row.actualAmount)}
                          </td>
                          <td className="px-4 py-3 font-mono font-semibold">
                            {pct(row.achievementPct)}
                          </td>
                          <td className="px-4 py-3 font-mono text-muted-foreground">
                            {fmt(Math.max(row.remainingTarget, 0))}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${s.badgeCls}`}
                            >
                              <Icon className="w-3 h-3" />
                              {s.label}
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
        )}
      </PageContent>
    </PortalLayout>
  );
}
