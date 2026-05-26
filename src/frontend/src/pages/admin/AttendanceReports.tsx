import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Role } from "../../backend";
import { ExportButton } from "../../components/ExportButton";
import {
  PageContent,
  PageHeader,
  PortalLayout,
  SectionCard,
} from "../../components/PortalLayout";
import { useCompanyProfile } from "../../hooks/useCompanyProfile";
import { api } from "../../lib/api";
import { exportToExcel, logExportToAuditTrail } from "../../lib/exportUtils";
import { useAuthStore } from "../../store/authStore";
import type { UserInfo } from "../../types";

const MONTH_NAMES = [
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

interface AttendanceSummary {
  holidays: bigint | number;
  present: bigint | number;
  absent: bigint | number;
  leaves: bigint | number;
  weeklyOffs: bigint | number;
}

export default function AttendanceReports({
  portalRole,
}: { portalRole?: Role }) {
  const { session } = useAuthStore();
  const { companyProfile } = useCompanyProfile();
  const effectiveRole = portalRole ?? session?.role ?? Role.Admin;
  const token = session?.token ?? "";

  const now = new Date();
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [year, setYear] = useState<number>(now.getFullYear());
  const [employeeId, setEmployeeId] = useState<string>("");
  const [employees, setEmployees] = useState<UserInfo[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  const loadEmployees = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const list = await api.listAllUsers(token);
      setEmployees(list);
    } catch {
      toast.error("Failed to load employee list");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  async function fetchSummary() {
    if (!employeeId || !token) return;
    setFetching(true);
    setSummary(null);
    try {
      const result = await api.getAttendanceSummaryForEmployee(
        token,
        BigInt(employeeId),
        BigInt(month),
        BigInt(year),
      );
      setSummary(result as AttendanceSummary);
    } catch (e) {
      toast.error(String(e) || "Failed to fetch attendance summary");
    } finally {
      setFetching(false);
    }
  }

  const selectedEmployee = employees.find((u) => String(u.id) === employeeId);

  function calcRow() {
    if (!summary || !selectedEmployee) return null;
    const present = Number(summary.present);
    const absent = Number(summary.absent);
    const leaves = Number(summary.leaves);
    const holidays = Number(summary.holidays);
    const weeklyOffs = Number(summary.weeklyOffs);
    const totalDays = holidays + present + absent + leaves;
    const attendancePct =
      totalDays > 0 ? `${((present / totalDays) * 100).toFixed(1)}%` : "0%";
    return {
      employeeCode: String(
        selectedEmployee.employeeId ?? selectedEmployee.id ?? "",
      ),
      employeeName: selectedEmployee.name ?? "",
      role: String(selectedEmployee.role ?? ""),
      territory: String(selectedEmployee.territory ?? ""),
      month: `${MONTH_NAMES[month - 1]} ${year}`,
      totalDays,
      presentDays: present,
      absentDays: absent,
      lateDays: 0,
      autoCheckoutDays: 0,
      leaveDays: leaves,
      weeklyOffs,
      holidays,
      attendancePct,
    };
  }

  const row = calcRow();

  function handleExport() {
    if (!row) return;
    exportToExcel({
      reportName: "Attendance Report",
      columns: [
        { key: "employeeCode", label: "Employee Code", type: "text" },
        { key: "employeeName", label: "Employee Name", type: "text" },
        { key: "role", label: "Role", type: "text" },
        { key: "territory", label: "Territory", type: "text" },
        { key: "month", label: "Month", type: "text" },
        { key: "totalDays", label: "Total Days", type: "number" },
        { key: "presentDays", label: "Present Days", type: "number" },
        { key: "absentDays", label: "Absent Days", type: "number" },
        { key: "lateDays", label: "Late Days", type: "number" },
        {
          key: "autoCheckoutDays",
          label: "Auto Check-Out Days",
          type: "number",
        },
        { key: "leaveDays", label: "Leave Days", type: "number" },
        { key: "attendancePct", label: "Attendance %", type: "text" },
      ],
      data: [row],
      activeFilters: `Month: ${MONTH_NAMES[month - 1]} ${year} | Employee: ${row.employeeName}`,
      companyName: companyProfile?.companyName ?? "Krishkar Pharmaceuticals",
    });
    logExportToAuditTrail(
      {
        userId: String(session?.userId ?? ""),
        userName: String(session?.name ?? ""),
        role: String(session?.role ?? ""),
      },
      "Attendance Report",
      `Month: ${MONTH_NAMES[month - 1]} ${year} | Employee: ${row.employeeName}`,
      1,
    );
  }

  const yearOptions = Array.from(
    { length: 5 },
    (_, i) => now.getFullYear() - i,
  );

  return (
    <PortalLayout portalRole={effectiveRole}>
      <PageHeader
        title="Attendance Reports"
        subtitle="Monthly attendance summary per employee"
        actions={
          <ExportButton
            onClick={handleExport}
            disabled={!row}
            tooltip={
              !row ? "No data to export" : "Exports currently filtered data"
            }
            data-ocid="attendance-reports.export-button"
          />
        }
      />
      <PageContent>
        {/* Filters */}
        <SectionCard title="Select Employee &amp; Period">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[220px]">
              <Label className="text-xs mb-1 block">Employee</Label>
              <Select
                value={employeeId}
                onValueChange={(v) => {
                  setEmployeeId(v);
                  setSummary(null);
                }}
              >
                <SelectTrigger data-ocid="attendance-reports.employee-select">
                  <SelectValue
                    placeholder={loading ? "Loading…" : "Select employee…"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((u) => (
                    <SelectItem key={String(u.id)} value={String(u.id)}>
                      {u.name} ({String(u.employeeId ?? u.id)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Month</Label>
              <Select
                value={String(month)}
                onValueChange={(v) => {
                  setMonth(Number(v));
                  setSummary(null);
                }}
              >
                <SelectTrigger
                  className="w-[140px]"
                  data-ocid="attendance-reports.month-select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((m, idx) => (
                    <SelectItem key={idx + 1} value={String(idx + 1)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Year</Label>
              <Select
                value={String(year)}
                onValueChange={(v) => {
                  setYear(Number(v));
                  setSummary(null);
                }}
              >
                <SelectTrigger
                  className="w-[100px]"
                  data-ocid="attendance-reports.year-select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={fetchSummary}
              disabled={!employeeId || fetching}
              data-ocid="attendance-reports.fetch-button"
            >
              {fetching ? "Loading…" : "Fetch Summary"}
            </Button>
          </div>
        </SectionCard>

        {/* Result */}
        <SectionCard title="Attendance Summary">
          {!summary && !fetching && (
            <div
              className="py-10 text-center"
              data-ocid="attendance-reports.empty_state"
            >
              <p className="text-muted-foreground text-sm">
                Select an employee, month, and year, then click Fetch Summary.
              </p>
            </div>
          )}
          {fetching && (
            <div className="space-y-2 py-4">
              {[1, 2].map((i) => (
                <div key={i} className="h-10 bg-muted rounded animate-pulse" />
              ))}
            </div>
          )}
          {row && !fetching && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    {[
                      "Employee Code",
                      "Employee Name",
                      "Role",
                      "Territory",
                      "Month",
                      "Total Days",
                      "Present",
                      "Absent",
                      "Leave Days",
                      "Weekly Offs",
                      "Holidays",
                      "Attendance %",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2 text-left text-xs font-display text-muted-foreground uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr
                    className="hover:bg-muted/20"
                    data-ocid="attendance-reports.item.1"
                  >
                    <td className="px-3 py-2 font-mono text-xs">
                      {row.employeeCode}
                    </td>
                    <td className="px-3 py-2 font-medium">
                      {row.employeeName}
                    </td>
                    <td className="px-3 py-2 text-xs">{row.role}</td>
                    <td className="px-3 py-2 text-xs">
                      {row.territory || "—"}
                    </td>
                    <td className="px-3 py-2 text-xs">{row.month}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {row.totalDays}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-green-700">
                      {row.presentDays}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-red-600">
                      {row.absentDays}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-amber-700">
                      {row.leaveDays}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                      {row.weeklyOffs}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                      {row.holidays}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-medium">
                      {row.attendancePct}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </PageContent>
    </PortalLayout>
  );
}
