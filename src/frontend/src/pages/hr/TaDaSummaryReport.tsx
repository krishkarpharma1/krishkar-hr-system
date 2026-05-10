import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Role } from "../../backend";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { useCompanyProfile } from "../../hooks/useCompanyProfile";
import { api } from "../../lib/api";
import { buildBrandingExcelRows } from "../../lib/brandingHtml";
import { useAuthStore } from "../../store/authStore";
import type { TaDaExpense, UserInfo } from "../../types";

// ── helpers ────────────────────────────────────────────────────────────────

function getMondayOf(d: Date): Date {
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setDate(d.getDate() + diff);
  return m;
}

function getSundayOf(monday: Date): Date {
  const s = new Date(monday);
  s.setDate(monday.getDate() + 6);
  return s;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function toNs(dateStr: string, endOfDay = false): bigint {
  const d = new Date(dateStr);
  if (endOfDay) {
    d.setHours(23, 59, 59, 999);
  } else {
    d.setHours(0, 0, 0, 0);
  }
  return BigInt(d.getTime()) * 1_000_000n;
}

function fmtCurrency(v: bigint | number): string {
  return `₹${Number(v).toLocaleString("en-IN")}`;
}

const ROLE_ORDER = ["MR", "ASM", "RSM", "ZSM", "HRManager"];
const ROLE_LABELS: Record<string, string> = {
  MR: "MR",
  ASM: "ASM",
  RSM: "RSM",
  ZSM: "ZSM",
  HRManager: "HR",
};

const ROLE_BADGE_CLASS: Record<string, string> = {
  MR: "bg-sky-100 text-sky-700",
  ASM: "bg-orange-100 text-orange-700",
  RSM: "bg-purple-100 text-purple-700",
  ZSM: "bg-emerald-100 text-emerald-700",
  NSM: "bg-rose-100 text-rose-700",
  HRManager: "bg-indigo-100 text-indigo-700",
};

function statusBadge(status: string) {
  if (status === "approved")
    return (
      <span className="inline-block px-2 py-0.5 text-xs rounded font-mono bg-emerald-100 text-emerald-700">
        Approved
      </span>
    );
  if (status === "rejected")
    return (
      <span className="inline-block px-2 py-0.5 text-xs rounded font-mono bg-red-100 text-red-700">
        Rejected
      </span>
    );
  return (
    <span className="inline-block px-2 py-0.5 text-xs rounded font-mono bg-amber-100 text-amber-700">
      Pending
    </span>
  );
}

// ── types ──────────────────────────────────────────────────────────────────

interface RoleSummary {
  role: string;
  submissions: number;
  totalTA: bigint;
  totalDA: bigint;
  combined: bigint;
  pending: number;
  approved: number;
  rejected: number;
}

interface DetailRow {
  employeeName: string;
  role: string;
  date: string;
  from: string;
  to: string;
  ta: bigint;
  da: bigint;
  total: bigint;
  status: string;
}

// ── component ──────────────────────────────────────────────────────────────

export default function TaDaSummaryReport() {
  const { session } = useAuthStore();
  const { companyProfile } = useCompanyProfile();

  const monday = getMondayOf(new Date());
  const [startDate, setStartDate] = useState(toDateStr(monday));
  const [endDate, setEndDate] = useState(toDateStr(getSundayOf(monday)));

  const [expenses, setExpenses] = useState<TaDaExpense[]>([]);
  const [employees, setEmployees] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    if (!session?.token) return;
    setLoading(true);
    try {
      const [expData, empData] = await Promise.all([
        (async () => {
          const { createActor } = await import("../../backend");
          const { createActorWithConfig } = await import(
            "@caffeineai/core-infrastructure"
          );
          const actor = await createActorWithConfig(createActor);
          return actor.getWeeklyTaDaSummaryByRole(
            toNs(startDate, false),
            toNs(endDate, true),
          );
        })(),
        api.listAllUsers(session.token),
      ]);
      setExpenses(expData);
      setEmployees(empData);
    } catch {
      // silently fail — report is informational
    } finally {
      setLoading(false);
    }
  }, [session?.token, startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    intervalRef.current = setInterval(fetchData, 5 * 60 * 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  function thisWeek() {
    const m = getMondayOf(new Date());
    setStartDate(toDateStr(m));
    setEndDate(toDateStr(getSundayOf(m)));
  }

  const empMap = new Map(
    employees.map((e) => [String(e.employeeId ?? e.id), e]),
  );

  // Aggregate summaries by role
  const summaryMap = new Map<string, RoleSummary>();
  for (const r of ROLE_ORDER)
    summaryMap.set(r, {
      role: r,
      submissions: 0,
      totalTA: 0n,
      totalDA: 0n,
      combined: 0n,
      pending: 0,
      approved: 0,
      rejected: 0,
    });

  for (const exp of expenses) {
    const role = exp.submittedByRole ?? "";
    const key = ROLE_ORDER.find((r) => r === role) ?? role;
    if (!summaryMap.has(key))
      summaryMap.set(key, {
        role: key,
        submissions: 0,
        totalTA: 0n,
        totalDA: 0n,
        combined: 0n,
        pending: 0,
        approved: 0,
        rejected: 0,
      });
    const s = summaryMap.get(key)!;
    s.submissions++;
    s.totalTA += BigInt(exp.travelAmount ?? 0);
    s.totalDA += BigInt(exp.dailyAllowance ?? 0);
    s.combined += BigInt(exp.totalAmount ?? 0);
    if (exp.status === "approved") s.approved++;
    else if (exp.status === "rejected") s.rejected++;
    else s.pending++;
  }

  const summaries = ROLE_ORDER.map((r) => summaryMap.get(r)!).filter(Boolean);

  const totals: RoleSummary = summaries.reduce(
    (acc, s) => ({
      role: "Total",
      submissions: acc.submissions + s.submissions,
      totalTA: acc.totalTA + s.totalTA,
      totalDA: acc.totalDA + s.totalDA,
      combined: acc.combined + s.combined,
      pending: acc.pending + s.pending,
      approved: acc.approved + s.approved,
      rejected: acc.rejected + s.rejected,
    }),
    {
      role: "Total",
      submissions: 0,
      totalTA: 0n,
      totalDA: 0n,
      combined: 0n,
      pending: 0,
      approved: 0,
      rejected: 0,
    },
  );

  // Build detail rows for selected role
  const detailRows: DetailRow[] = (
    selectedRole
      ? expenses.filter((e) => e.submittedByRole === selectedRole)
      : []
  ).map((exp) => {
    const emp = empMap.get(String(exp.employeeId));
    return {
      employeeName: emp?.name ?? `EMP-${String(exp.employeeId)}`,
      role: exp.submittedByRole ?? "",
      date: exp.date,
      from: exp.fromLocation ?? "—",
      to: exp.toLocation ?? "—",
      ta: BigInt(exp.travelAmount ?? 0),
      da: BigInt(exp.dailyAllowance ?? 0),
      total: BigInt(exp.totalAmount ?? 0),
      status: exp.status as string,
    };
  });

  function exportExcel() {
    const wb = XLSX.utils.book_new();

    // Summary sheet
    const brandingRows = buildBrandingExcelRows(companyProfile ?? null);
    const titleRow: Record<string, string> = {
      Role: `Weekly TA/DA Summary: ${startDate} to ${endDate}`,
    };
    const headerRow = {
      Role: "Role",
      Submissions: "Submissions",
      "Total TA (₹)": "Total TA (₹)",
      "Total DA (₹)": "Total DA (₹)",
      "Combined Total (₹)": "Combined Total (₹)",
      Pending: "Pending",
      Approved: "Approved",
      Rejected: "Rejected",
    };
    const summaryDataRows = summaries.map((s) => ({
      Role: ROLE_LABELS[s.role] ?? s.role,
      Submissions: s.submissions,
      "Total TA (₹)": Number(s.totalTA),
      "Total DA (₹)": Number(s.totalDA),
      "Combined Total (₹)": Number(s.combined),
      Pending: s.pending,
      Approved: s.approved,
      Rejected: s.rejected,
    }));
    const totalRow = {
      Role: "TOTAL",
      Submissions: totals.submissions,
      "Total TA (₹)": Number(totals.totalTA),
      "Total DA (₹)": Number(totals.totalDA),
      "Combined Total (₹)": Number(totals.combined),
      Pending: totals.pending,
      Approved: totals.approved,
      Rejected: totals.rejected,
    };

    const summaryWs = XLSX.utils.json_to_sheet([
      ...brandingRows,
      titleRow,
      headerRow,
      ...summaryDataRows,
      totalRow,
    ]);
    XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

    // Details sheet
    const allDetails = expenses.map((exp) => {
      const emp = empMap.get(String(exp.employeeId));
      return {
        "Employee Name": emp?.name ?? `EMP-${String(exp.employeeId)}`,
        Role:
          ROLE_LABELS[exp.submittedByRole ?? ""] ?? exp.submittedByRole ?? "",
        Date: exp.date,
        "From Station": exp.fromLocation ?? "—",
        "To Station": exp.toLocation ?? "—",
        "TA Amount (₹)": Number(exp.travelAmount ?? 0),
        "DA Amount (₹)": Number(exp.dailyAllowance ?? 0),
        "Total (₹)": Number(exp.totalAmount ?? 0),
        Status: exp.status ?? "",
      };
    });

    const footerRow: Record<string, string> = {
      "Employee Name": "Krishkar Pharmaceuticals : Empowering Health",
    };
    const detailsWs = XLSX.utils.json_to_sheet([
      ...brandingRows,
      { "Employee Name": `Weekly TA/DA Details: ${startDate} to ${endDate}` },
      ...allDetails,
      footerRow,
    ]);
    XLSX.utils.book_append_sheet(wb, detailsWs, "Details");

    XLSX.writeFile(wb, `TA_DA_Summary_${startDate}_${endDate}.xlsx`);
  }

  const dateRangeLabel = `${startDate} to ${endDate}`;

  return (
    <PortalLayout portalRole={Role.HRManager}>
      <PageHeader
        title="Weekly TA/DA Summary Report"
        subtitle={`Personal expense submissions by role — ${dateRangeLabel}`}
      />
      <PageContent>
        {/* Controls */}
        <div className="bg-card border border-border rounded-lg p-4 mb-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1 min-w-[130px]">
              <label
                htmlFor="tada-start"
                className="text-xs text-muted-foreground font-body"
              >
                Start Date
              </label>
              <input
                id="tada-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                data-ocid="tada-summary.start_input"
              />
            </div>
            <div className="flex flex-col gap-1 min-w-[130px]">
              <label
                htmlFor="tada-end"
                className="text-xs text-muted-foreground font-body"
              >
                End Date
              </label>
              <input
                id="tada-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                data-ocid="tada-summary.end_input"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={thisWeek}
              data-ocid="tada-summary.this_week_button"
            >
              This Week
            </Button>
            <Button
              size="sm"
              onClick={fetchData}
              disabled={loading}
              className="bg-sky-500 hover:bg-sky-600 text-white"
              data-ocid="tada-summary.refresh_button"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin mr-1.5" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-1.5" />
              )}
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportExcel}
              className="ml-auto"
              data-ocid="tada-summary.export_button"
            >
              <Download className="w-4 h-4 mr-1.5" />
              Export Excel
            </Button>
          </div>
        </div>

        {/* Summary Grid */}
        <div className="bg-card border border-border rounded-lg overflow-hidden mb-5">
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <span className="text-xs uppercase tracking-wider font-display text-muted-foreground">
              Summary by Role — {dateRangeLabel}
            </span>
          </div>
          {loading ? (
            <div className="p-4 space-y-2">
              {["r1", "r2", "r3", "r4", "r5", "r6"].map((k) => (
                <Skeleton key={k} className="h-10 w-full" />
              ))}
            </div>
          ) : expenses.length === 0 ? (
            <div
              className="py-14 text-center"
              data-ocid="tada-summary.empty_state"
            >
              <p className="text-muted-foreground text-sm font-body">
                No TA/DA submissions found for the selected period.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table
                className="w-full text-sm font-body"
                data-ocid="tada-summary.table"
              >
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    {[
                      "Role",
                      "Submissions",
                      "Total TA (₹)",
                      "Total DA (₹)",
                      "Combined Total (₹)",
                      "Pending",
                      "Approved",
                      "Rejected",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-left text-xs font-display uppercase tracking-wider text-muted-foreground whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {summaries.map((s, i) => (
                    <tr
                      key={s.role}
                      tabIndex={0}
                      className={`cursor-pointer transition-colors hover:bg-muted/30 ${selectedRole === s.role ? "bg-sky-50 border-l-2 border-l-sky-500" : ""}`}
                      onClick={() =>
                        setSelectedRole(selectedRole === s.role ? null : s.role)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ")
                          setSelectedRole(
                            selectedRole === s.role ? null : s.role,
                          );
                      }}
                      data-ocid={`tada-summary.item.${i + 1}`}
                    >
                      <td className="px-4 py-3 font-medium">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-mono ${ROLE_BADGE_CLASS[s.role] ?? "bg-muted text-muted-foreground"}`}
                        >
                          {ROLE_LABELS[s.role] ?? s.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {s.submissions}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {fmtCurrency(s.totalTA)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {fmtCurrency(s.totalDA)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-sky-700">
                        {fmtCurrency(s.combined)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-amber-600 font-mono text-xs">
                          {s.pending}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-emerald-600 font-mono text-xs">
                          {s.approved}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-red-500 font-mono text-xs">
                          {s.rejected}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {/* Totals row */}
                  <tr className="bg-sky-50 border-t-2 border-sky-200 font-semibold">
                    <td className="px-4 py-3 text-sky-800">Total</td>
                    <td className="px-4 py-3 text-foreground">
                      {totals.submissions}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {fmtCurrency(totals.totalTA)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {fmtCurrency(totals.totalDA)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sky-700">
                      {fmtCurrency(totals.combined)}
                    </td>
                    <td className="px-4 py-3 text-center text-amber-600 font-mono">
                      {totals.pending}
                    </td>
                    <td className="px-4 py-3 text-center text-emerald-600 font-mono">
                      {totals.approved}
                    </td>
                    <td className="px-4 py-3 text-center text-red-500 font-mono">
                      {totals.rejected}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Drill-down Panel */}
        {selectedRole && (
          <div
            className="bg-card border border-sky-200 rounded-lg overflow-hidden shadow-sm"
            data-ocid="tada-summary.panel"
          >
            <div className="px-4 py-3 border-b border-sky-200 bg-sky-50 flex items-center justify-between gap-3">
              <span className="font-display font-semibold text-sm text-sky-800">
                {ROLE_LABELS[selectedRole] ?? selectedRole} — Expense
                Submissions ({dateRangeLabel})
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedRole(null)}
                className="text-sky-600 hover:text-sky-800"
                data-ocid="tada-summary.close_button"
              >
                <X className="w-4 h-4 mr-1" /> Close
              </Button>
            </div>
            {detailRows.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm font-body">
                No submissions for this role in the selected period.
              </div>
            ) : (
              <div className="overflow-x-auto scrollbar-thin">
                <table
                  className="w-full text-sm font-body"
                  data-ocid="tada-summary.detail_table"
                >
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      {[
                        "Employee Name",
                        "Date",
                        "From → To",
                        "TA (₹)",
                        "DA (₹)",
                        "Total (₹)",
                        "Status",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-2.5 text-left text-xs font-display uppercase tracking-wider text-muted-foreground whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {detailRows.map((row, idx) => (
                      <tr
                        key={`${row.employeeName}-${row.date}-${idx}`}
                        className="hover:bg-muted/20 transition-colors"
                        data-ocid={`tada-summary.detail.item.${idx + 1}`}
                      >
                        <td className="px-4 py-2.5 font-medium text-foreground truncate max-w-[160px]">
                          {row.employeeName}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                          {row.date}
                        </td>
                        <td className="px-4 py-2.5 text-foreground">
                          {row.from === "—" && row.to === "—" ? (
                            <span className="text-muted-foreground text-xs">
                              HQ
                            </span>
                          ) : (
                            <span className="truncate">
                              {row.from} → {row.to}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono">
                          {fmtCurrency(row.ta)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono">
                          {fmtCurrency(row.da)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold">
                          {fmtCurrency(row.total)}
                        </td>
                        <td className="px-4 py-2.5">
                          {statusBadge(row.status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {!selectedRole && !loading && expenses.length > 0 && (
          <p className="text-xs text-center text-muted-foreground mt-3 font-body">
            Click any role row to see individual submissions
          </p>
        )}
      </PageContent>
    </PortalLayout>
  );
}
