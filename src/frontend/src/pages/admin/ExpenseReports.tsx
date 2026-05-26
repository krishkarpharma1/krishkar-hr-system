import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Receipt } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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

const COLUMNS: ColumnDef[] = [
  { key: "employeeCode", label: "Employee Code", type: "text" },
  { key: "employeeName", label: "Employee Name", type: "text" },
  { key: "role", label: "Role", type: "text" },
  { key: "territory", label: "Territory", type: "text" },
  { key: "claimDate", label: "Claim Date", type: "date" },
  { key: "category", label: "Category", type: "text" },
  { key: "travelMode", label: "Travel Mode", type: "text" },
  { key: "fromLocation", label: "From Location", type: "text" },
  { key: "toLocation", label: "To Location", type: "text" },
  { key: "distanceKm", label: "Distance (km)", type: "number" },
  { key: "amount", label: "Amount", type: "number" },
  { key: "receiptUploaded", label: "Receipt Uploaded", type: "text" },
  { key: "status", label: "Status", type: "text" },
  { key: "approvedBy", label: "Approved By", type: "text" },
  { key: "approvalDate", label: "Approval Date", type: "text" },
  { key: "remarks", label: "Remarks", type: "text" },
];

type RowData = Record<string, unknown>;

interface UserInfo {
  id: string;
  employeeId: string;
  name: string;
  role: string;
  territory: string;
}

interface TaDaExpense {
  id: string;
  employeeId: string;
  date: string;
  status: string;
  purpose: string;
  fromLocation: string;
  toLocation: string;
  distanceKm: bigint | number;
  travelAmount: number;
  dailyAllowance: number;
  miscExpense: number;
  lodgingExpense: number;
  totalAmount: number;
  totalClaimAmount: number;
  approvedBy: string;
  modeOfTransport: string;
  submittedAt: string | null;
}

const STATUS_OPTIONS = ["All", "Pending", "Approved", "Rejected"];

export default function ExpenseReports() {
  const { session } = useAuthStore();
  const { companyProfile } = useCompanyProfile();
  const token = session?.token ?? "";

  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [fromDate, setFromDate] = useState(fmt(thirtyDaysAgo));
  const [toDate, setToDate] = useState(fmt(today));
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [allExpenses, setAllExpenses] = useState<TaDaExpense[]>([]);
  const [userMap, setUserMap] = useState<Map<string, UserInfo>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (api as any).getPendingExpenses(token) as Promise<TaDaExpense[]>,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (api as any).listAllUsers(token) as Promise<UserInfo[]>,
    ])
      .then(([expenses, users]) => {
        setAllExpenses(expenses ?? []);
        const map = new Map<string, UserInfo>();
        for (const u of users ?? []) map.set(u.employeeId, u);
        setUserMap(map);
      })
      .catch(() => setError("Could not load expense data from server."))
      .finally(() => setLoading(false));
  }, [token]);

  const rows = useMemo<RowData[]>(() => {
    const from = fromDate ? new Date(fromDate).getTime() : 0;
    const to = toDate
      ? new Date(toDate).getTime() + 86399999
      : Number.POSITIVE_INFINITY;

    return allExpenses.flatMap((e) => {
      const eDate = new Date(e.date).getTime();
      if (eDate < from || eDate > to) return [];
      const user = userMap.get(e.employeeId);
      if (
        employeeFilter &&
        !(
          (user?.name ?? "")
            .toLowerCase()
            .includes(employeeFilter.toLowerCase()) ||
          (user?.employeeId ?? e.employeeId)
            .toLowerCase()
            .includes(employeeFilter.toLowerCase())
        )
      )
        return [];
      if (statusFilter !== "All" && e.status !== statusFilter) return [];

      return [
        {
          employeeCode: user?.employeeId ?? e.employeeId,
          employeeName: user?.name ?? "—",
          role: user?.role ?? "—",
          territory: user?.territory ?? "—",
          claimDate: e.date,
          category: e.purpose || "TA/DA",
          travelMode: e.modeOfTransport,
          fromLocation: e.fromLocation,
          toLocation: e.toLocation,
          distanceKm: Number(e.distanceKm ?? 0),
          amount: Number(e.totalClaimAmount ?? e.totalAmount ?? 0),
          receiptUploaded: "N/A",
          status: e.status,
          approvedBy: e.approvedBy ?? "",
          approvalDate: "",
          remarks: "",
        },
      ];
    });
  }, [allExpenses, userMap, fromDate, toDate, employeeFilter, statusFilter]);

  const activeFilters = [
    fromDate && `From: ${fromDate}`,
    toDate && `To: ${toDate}`,
    employeeFilter && `Employee: ${employeeFilter}`,
    statusFilter !== "All" && `Status: ${statusFilter}`,
  ]
    .filter(Boolean)
    .join(" | ");

  const handleExport = useCallback(() => {
    exportToExcel({
      reportName: "Expense Report",
      columns: COLUMNS,
      data: rows,
      activeFilters: activeFilters || "All Data",
      companyName: companyProfile?.companyName ?? "Krishkar Pharmaceuticals",
    });
    logExportToAuditTrail(
      {
        userId: String(session?.userId ?? ""),
        userName: session?.name ?? "",
        role: session?.role ?? "",
      },
      "Expense Report",
      activeFilters || "All Data",
      rows.length,
    );
    toast.success(`Exported ${rows.length} rows`);
  }, [rows, activeFilters, companyProfile, session]);

  return (
    <PortalLayout portalRole={Role.Admin}>
      <PageHeader
        title="Expense Reports"
        subtitle="TA/DA and expense claim records with applied filters"
        actions={
          <ExportButton
            onClick={handleExport}
            disabled={rows.length === 0}
            tooltip={
              rows.length === 0
                ? "No data to export."
                : "Exports currently filtered data."
            }
            data-ocid="expense-report.export_button"
          />
        }
      />
      <PageContent>
        {/* Filters */}
        <div className="bg-card border border-border rounded-lg p-4 mb-5 flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="expense-report-from-date"
              className="text-xs text-muted-foreground font-display"
            >
              From Date
            </label>
            <input
              id="expense-report-from-date"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-9 text-xs rounded-md border border-input bg-background px-3 py-1 w-[160px] focus:outline-none focus:ring-1 focus:ring-ring"
              data-ocid="expense-report.from_date_input"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="expense-report-to-date"
              className="text-xs text-muted-foreground font-display"
            >
              To Date
            </label>
            <input
              id="expense-report-to-date"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-9 text-xs rounded-md border border-input bg-background px-3 py-1 w-[160px] focus:outline-none focus:ring-1 focus:ring-ring"
              data-ocid="expense-report.to_date_input"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="expense-report-employee"
              className="text-xs text-muted-foreground font-display"
            >
              Employee
            </label>
            <input
              id="expense-report-employee"
              type="text"
              placeholder="Name or code"
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="h-9 text-xs rounded-md border border-input bg-background px-3 py-1 w-[180px] focus:outline-none focus:ring-1 focus:ring-ring"
              data-ocid="expense-report.employee_input"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="expense-report-status"
              className="text-xs text-muted-foreground font-display"
            >
              Status
            </label>
            <select
              id="expense-report-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 text-xs rounded-md border border-input bg-background px-3 py-1 w-[140px] focus:outline-none focus:ring-1 focus:ring-ring"
              data-ocid="expense-report.status_select"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && !loading && (
          <div
            className="bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-4 flex items-center gap-3 mb-4"
            data-ocid="expense-report.error_state"
          >
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {loading && (
          <div className="space-y-2" data-ocid="expense-report.loading_state">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-10 rounded-lg" />
            ))}
          </div>
        )}

        {!loading && rows.length === 0 && !error && (
          <div
            className="bg-card border border-border rounded-lg p-12 text-center"
            data-ocid="expense-report.empty_state"
          >
            <Receipt className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-display font-medium text-foreground mb-1">
              No expense records found
            </p>
            <p className="text-sm text-muted-foreground font-body">
              No claims matched the selected filters.
            </p>
          </div>
        )}

        {!loading && rows.length > 0 && (
          <div
            className="bg-card border border-border rounded-lg overflow-hidden"
            data-ocid="expense-report.table"
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
                      data-ocid={`expense-report.item.${idx + 1}`}
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
