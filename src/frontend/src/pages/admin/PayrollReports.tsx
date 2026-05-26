import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, FileText } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Role } from "../../backend";
import { ExportButton } from "../../components/ExportButton";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { useCompanyProfile } from "../../hooks/useCompanyProfile";
import { api } from "../../lib/api";
import type { ColumnDef } from "../../lib/exportUtils";
import { exportToExcel, logExportToAuditTrail } from "../../lib/exportUtils";
import { useAuthStore } from "../../store/authStore";

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

const COLUMNS: ColumnDef[] = [
  { key: "employeeCode", label: "Employee Code", type: "text" },
  { key: "employeeName", label: "Employee Name", type: "text" },
  { key: "designation", label: "Designation", type: "text" },
  { key: "department", label: "Department", type: "text" },
  { key: "basic", label: "Basic", type: "number" },
  { key: "hra", label: "HRA", type: "number" },
  { key: "travelAllowance", label: "Travel Allowance", type: "number" },
  { key: "otherAllowances", label: "Other Allowances", type: "number" },
  { key: "grossSalary", label: "Gross Salary", type: "number" },
  { key: "pfDeduction", label: "PF Deduction", type: "number" },
  { key: "esicDeduction", label: "ESIC Deduction", type: "number" },
  { key: "ptDeduction", label: "PT Deduction", type: "number" },
  { key: "tdsDeduction", label: "TDS Deduction", type: "number" },
  { key: "totalDeductions", label: "Total Deductions", type: "number" },
  { key: "netPay", label: "Net Pay", type: "number" },
  { key: "daysWorked", label: "Days Worked", type: "number" },
  { key: "lossOfPayDays", label: "Loss of Pay Days", type: "number" },
  { key: "payrollMonth", label: "Payroll Month", type: "text" },
  { key: "status", label: "Status", type: "text" },
];

type RowData = Record<string, unknown>;

const CUR_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [
  CUR_YEAR - 2,
  CUR_YEAR - 1,
  CUR_YEAR,
  CUR_YEAR + 1,
  CUR_YEAR + 2,
];

export default function PayrollReports() {
  const { session } = useAuthStore();
  const { companyProfile } = useCompanyProfile();
  const token = session?.token ?? "";

  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [rows, setRows] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const users = (await (api as any).listAllUsers(token)) as Array<{
        id: string;
        employeeId: string;
        name: string;
        role: string;
        territory: string;
        department: string;
        designation: string;
      }>;
      const results: RowData[] = [];
      for (const u of users) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const r = (await (api as any).getPayrollRecord(
            token,
            u.id,
            BigInt(selectedMonth),
            BigInt(selectedYear),
          )) as {
            basicPay: bigint | number;
            hra: bigint | number;
            taAllowance: bigint | number;
            daAllowance: bigint | number;
            grossPay: bigint | number;
            pfDeduction: bigint | number;
            esiDeduction: bigint | number;
            netPay: bigint | number;
            payableDays: bigint | number;
            isApproved: boolean;
            year: bigint | number;
          } | null;
          if (!r) continue;
          const pf = Number(r.pfDeduction);
          const esi = Number(r.esiDeduction);
          results.push({
            employeeCode: u.employeeId,
            employeeName: u.name,
            designation: u.designation,
            department: u.department,
            basic: Number(r.basicPay),
            hra: Number(r.hra),
            travelAllowance: Number(r.taAllowance),
            otherAllowances: Number(r.daAllowance),
            grossSalary: Number(r.grossPay),
            pfDeduction: pf,
            esicDeduction: esi,
            ptDeduction: 0,
            tdsDeduction: 0,
            totalDeductions: pf + esi,
            netPay: Number(r.netPay),
            daysWorked: Number(r.payableDays),
            lossOfPayDays: 0,
            payrollMonth: `${MONTH_NAMES[selectedMonth - 1]} ${Number(r.year)}`,
            status: r.isApproved ? "Approved" : "Pending",
          });
        } catch {
          // user has no record for this period — skip
        }
      }
      setRows(results);
    } catch {
      setError("Could not load payroll data from server.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [token, selectedMonth, selectedYear]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const activeFilters = `Month: ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`;

  const handleExport = useCallback(() => {
    exportToExcel({
      reportName: "Payroll Report",
      columns: COLUMNS,
      data: rows,
      activeFilters,
      companyName: companyProfile?.companyName ?? "Krishkar Pharmaceuticals",
    });
    logExportToAuditTrail(
      {
        userId: String(session?.userId ?? ""),
        userName: session?.name ?? "",
        role: session?.role ?? "",
      },
      "Payroll Report",
      activeFilters,
      rows.length,
    );
    toast.success(`Exported ${rows.length} rows`);
  }, [rows, activeFilters, companyProfile, session]);

  return (
    <PortalLayout portalRole={Role.Admin}>
      <PageHeader
        title="Payroll Reports"
        subtitle="Monthly payroll summary for all employees"
        actions={
          <ExportButton
            onClick={handleExport}
            disabled={rows.length === 0}
            tooltip={
              rows.length === 0
                ? "No data to export."
                : "Exports currently filtered data."
            }
            data-ocid="payroll-report.export_button"
          />
        }
      />
      <PageContent>
        {/* Filters */}
        <div className="bg-card border border-border rounded-lg p-4 mb-5 flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="payroll-month"
              className="text-xs text-muted-foreground font-display"
            >
              Month
            </label>
            <select
              id="payroll-month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="h-9 text-xs rounded-md border border-input bg-background px-3 py-1 w-[160px] focus:outline-none focus:ring-1 focus:ring-ring"
              data-ocid="payroll-report.month_select"
            >
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="payroll-year"
              className="text-xs text-muted-foreground font-display"
            >
              Year
            </label>
            <select
              id="payroll-year"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="h-9 text-xs rounded-md border border-input bg-background px-3 py-1 w-[120px] focus:outline-none focus:ring-1 focus:ring-ring"
              data-ocid="payroll-report.year_select"
            >
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => void fetchData()}
            disabled={loading}
            className="h-9 px-4 text-xs rounded-md bg-primary text-primary-foreground font-display font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 mt-auto"
            data-ocid="payroll-report.search_button"
          >
            {loading ? "Loading…" : "Apply Filter"}
          </button>
        </div>

        {error && !loading && (
          <div
            className="bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-4 flex items-center gap-3 mb-4"
            data-ocid="payroll-report.error_state"
          >
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {loading && (
          <div className="space-y-2" data-ocid="payroll-report.loading_state">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-10 rounded-lg" />
            ))}
          </div>
        )}

        {!loading && rows.length === 0 && !error && (
          <div
            className="bg-card border border-border rounded-lg p-12 text-center"
            data-ocid="payroll-report.empty_state"
          >
            <FileText className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-display font-medium text-foreground mb-1">
              No payroll records found
            </p>
            <p className="text-sm text-muted-foreground font-body">
              No data matched the selected month and year.
            </p>
          </div>
        )}

        {!loading && rows.length > 0 && (
          <div
            className="bg-card border border-border rounded-lg overflow-hidden"
            data-ocid="payroll-report.table"
          >
            <div className="px-5 py-3 bg-primary/5 border-b border-border">
              <p className="text-sm font-display font-semibold text-foreground">
                {rows.length} record{rows.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-body">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {COLUMNS.map((col) => (
                      <th
                        key={col.key}
                        className={`py-2.5 px-4 font-display text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap ${
                          col.type === "number" ? "text-right" : "text-left"
                        }`}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-muted/20 transition-colors"
                      data-ocid={`payroll-report.item.${idx + 1}`}
                    >
                      {COLUMNS.map((col) => (
                        <td
                          key={col.key}
                          className={`py-3 px-4 text-foreground whitespace-nowrap ${
                            col.type === "number" ? "text-right font-mono" : ""
                          }`}
                        >
                          {col.type === "number"
                            ? Number(row[col.key] ?? 0).toLocaleString("en-IN")
                            : String(row[col.key] ?? "—")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-primary/5">
                    <td
                      className="py-3 px-4 font-display font-semibold text-foreground"
                      colSpan={COLUMNS.length}
                    >
                      Total Records: {rows.length}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </PageContent>
    </PortalLayout>
  );
}
