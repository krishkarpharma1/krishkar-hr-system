import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Target } from "lucide-react";
import { useCallback, useState } from "react";
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
  { key: "period", label: "Period", type: "text" },
  { key: "product", label: "Product", type: "text" },
  { key: "targetValue", label: "Target Value", type: "number" },
  { key: "achievedValue", label: "Achieved Value", type: "number" },
  { key: "achievementPct", label: "Achievement %", type: "percent" },
  { key: "grade", label: "Grade", type: "text" },
];

type RowData = Record<string, unknown>;

export default function SalesTargetReport() {
  const { session } = useAuthStore();
  const { companyProfile } = useCompanyProfile();
  const token = session?.token ?? "";

  const today = new Date();
  const [period, setPeriod] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`,
  );
  const [territory, setTerritory] = useState("");
  const [employee, setEmployee] = useState("");
  const [rows, setRows] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data =
        (await (api as any).getSalesTargets?.(token, {
          period,
          territory,
          employee,
        })) ?? [];
      setRows((data as RowData[]) ?? []);
      setFetched(true);
    } catch {
      setRows([]);
      setFetched(true);
      setError("Could not load sales target data from server.");
    } finally {
      setLoading(false);
    }
  }, [token, period, territory, employee]);

  const activeFilters = [
    period && `Period: ${period}`,
    territory && `Territory: ${territory}`,
    employee && `Employee: ${employee}`,
  ]
    .filter(Boolean)
    .join(" | ");

  const handleExport = useCallback(() => {
    exportToExcel({
      reportName: "Sales Target Report",
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
      "Sales Target Report",
      activeFilters || "All Data",
      rows.length,
    );
    toast.success(`Exported ${rows.length} rows`);
  }, [rows, activeFilters, companyProfile, session]);

  return (
    <PortalLayout portalRole={Role.Admin}>
      <PageHeader
        title="Sales Target Report"
        subtitle="Target vs. achieved values by employee, product, and period"
        actions={
          <ExportButton
            onClick={handleExport}
            disabled={rows.length === 0}
            tooltip={
              rows.length === 0
                ? "No data to export."
                : activeFilters
                  ? "Exports currently filtered data."
                  : undefined
            }
            data-ocid="sales-target.export_button"
          />
        }
      />
      <PageContent>
        {/* Filters */}
        <div className="bg-card border border-border rounded-lg p-4 mb-5 flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="sales-target-period"
              className="text-xs text-muted-foreground font-display"
            >
              Period (YYYY-MM)
            </label>
            <input
              id="sales-target-period"
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="h-9 text-xs rounded-md border border-input bg-background px-3 py-1 w-[160px] focus:outline-none focus:ring-1 focus:ring-ring"
              data-ocid="sales-target.period_input"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="sales-target-territory"
              className="text-xs text-muted-foreground font-display"
            >
              Territory
            </label>
            <input
              type="text"
              placeholder="All territories"
              value={territory}
              onChange={(e) => setTerritory(e.target.value)}
              className="h-9 text-xs rounded-md border border-input bg-background px-3 py-1 w-[180px] focus:outline-none focus:ring-1 focus:ring-ring"
              data-ocid="sales-target.territory_input"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="sales-target-employee"
              className="text-xs text-muted-foreground font-display"
            >
              Employee
            </label>
            <input
              id="sales-target-employee"
              type="text"
              placeholder="All employees"
              value={employee}
              onChange={(e) => setEmployee(e.target.value)}
              className="h-9 text-xs rounded-md border border-input bg-background px-3 py-1 w-[180px] focus:outline-none focus:ring-1 focus:ring-ring"
              data-ocid="sales-target.employee_input"
            />
          </div>
          <button
            type="button"
            onClick={() => void fetchData()}
            disabled={loading}
            className="h-9 px-4 text-xs rounded-md bg-primary text-primary-foreground font-display font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 mt-auto"
            data-ocid="sales-target.search_button"
          >
            {loading ? "Loading…" : "Apply Filter"}
          </button>
        </div>

        {error && !loading && (
          <div
            className="bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-4 flex items-center gap-3 mb-4"
            data-ocid="sales-target.error_state"
          >
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {loading && (
          <div className="space-y-2" data-ocid="sales-target.loading_state">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-10 rounded-lg" />
            ))}
          </div>
        )}

        {!loading && !fetched && !error && (
          <div className="bg-card border border-border rounded-lg p-10 text-center">
            <Target className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground font-body">
              Apply filters and click <strong>Apply Filter</strong> to load
              data.
            </p>
          </div>
        )}

        {!loading && fetched && rows.length === 0 && !error && (
          <div
            className="bg-card border border-border rounded-lg p-12 text-center"
            data-ocid="sales-target.empty_state"
          >
            <Target className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-display font-medium text-foreground mb-1">
              No records found
            </p>
            <p className="text-sm text-muted-foreground font-body">
              No sales target data matched the selected filters.
            </p>
          </div>
        )}

        {!loading && rows.length > 0 && (
          <div
            className="bg-card border border-border rounded-lg overflow-hidden"
            data-ocid="sales-target.table"
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
                        className={`py-2.5 px-4 font-display text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap ${col.type === "number" || col.type === "percent" ? "text-right" : "text-left"}`}
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
                      data-ocid={`sales-target.item.${idx + 1}`}
                    >
                      {COLUMNS.map((col) => (
                        <td
                          key={col.key}
                          className={`py-3 px-4 text-foreground ${col.type === "number" || col.type === "percent" ? "text-right font-mono" : ""}`}
                        >
                          {col.type === "percent"
                            ? `${Number(row[col.key] ?? 0).toFixed(1)}%`
                            : col.type === "number"
                              ? Number(row[col.key] ?? 0).toLocaleString(
                                  "en-IN",
                                )
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
