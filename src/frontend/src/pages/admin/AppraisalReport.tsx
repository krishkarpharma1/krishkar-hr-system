import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Star } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
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

const BASE_COLUMNS: ColumnDef[] = [
  { key: "employeeCode", label: "Employee Code", type: "text" },
  { key: "employeeName", label: "Employee Name", type: "text" },
  { key: "role", label: "Role", type: "text" },
  { key: "department", label: "Department", type: "text" },
  { key: "cycleName", label: "Cycle Name", type: "text" },
  { key: "period", label: "Period", type: "text" },
];

const END_COLUMNS: ColumnDef[] = [
  { key: "overallScore", label: "Overall Score", type: "number" },
  { key: "grade", label: "Grade", type: "text" },
  { key: "status", label: "Status", type: "text" },
];

type RowData = Record<string, unknown>;

function extractKraKeys(rows: RowData[]): string[] {
  const keys = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (
        !BASE_COLUMNS.some((c) => c.key === key) &&
        !END_COLUMNS.some((c) => c.key === key)
      ) {
        keys.add(key);
      }
    }
  }
  return [...keys];
}

export default function AppraisalReport() {
  const { session } = useAuthStore();
  const { companyProfile } = useCompanyProfile();
  const token = session?.token ?? "";

  const [cycle, setCycle] = useState("");
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
      const a = api as any;
      const data =
        (await (a.getAppraisalCycles?.(token, { cycle }) ??
          a.getAppraisalReport?.(token, { cycle }) ??
          a.listAppraisals?.(token))) ?? [];
      setRows((data as RowData[]) ?? []);
      setFetched(true);
    } catch {
      setRows([]);
      setFetched(true);
      setError("Could not load appraisal data from server.");
    } finally {
      setLoading(false);
    }
  }, [token, cycle]);

  const kraKeys = useMemo(() => extractKraKeys(rows), [rows]);

  const allColumns: ColumnDef[] = useMemo(
    () => [
      ...BASE_COLUMNS,
      ...kraKeys.map((k) => ({ key: k, label: k, type: "number" as const })),
      ...END_COLUMNS,
    ],
    [kraKeys],
  );

  const activeFilters = cycle ? `Cycle: ${cycle}` : "";

  const handleExport = useCallback(() => {
    exportToExcel({
      reportName: "Appraisal Report",
      columns: allColumns,
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
      "Appraisal Report Export",
      activeFilters || "All Data",
      rows.length,
    );
    toast.success(`Exported ${rows.length} rows`);
  }, [rows, allColumns, activeFilters, companyProfile, session]);

  return (
    <PortalLayout portalRole={Role.Admin}>
      <PageHeader
        title="Appraisal Report"
        subtitle="KRA-wise scores, overall grades and status per appraisal cycle"
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
            data-ocid="appraisal.export_button"
          />
        }
      />
      <PageContent>
        {/* Filters */}
        <div className="bg-card border border-border rounded-lg p-4 mb-5 flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="appraisal-cycle"
              className="text-xs text-muted-foreground font-display"
            >
              Cycle Name
            </label>
            <input
              id="appraisal-cycle"
              type="text"
              placeholder="e.g. FY 2025-26 H1"
              value={cycle}
              onChange={(e) => setCycle(e.target.value)}
              className="h-9 text-xs rounded-md border border-input bg-background px-3 py-1 w-[220px] focus:outline-none focus:ring-1 focus:ring-ring"
              data-ocid="appraisal.cycle_input"
            />
          </div>
          <button
            type="button"
            onClick={() => void fetchData()}
            disabled={loading}
            className="h-9 px-4 text-xs rounded-md bg-primary text-primary-foreground font-display font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 mt-auto"
            data-ocid="appraisal.search_button"
          >
            {loading ? "Loading…" : "Apply Filter"}
          </button>
        </div>

        {error && !loading && (
          <div
            className="bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-4 flex items-center gap-3 mb-4"
            data-ocid="appraisal.error_state"
          >
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {loading && (
          <div className="space-y-2" data-ocid="appraisal.loading_state">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-10 rounded-lg" />
            ))}
          </div>
        )}

        {!loading && !fetched && !error && (
          <div className="bg-card border border-border rounded-lg p-10 text-center">
            <Star className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground font-body">
              Enter a cycle name and click <strong>Apply Filter</strong> to load
              appraisal data, or leave blank for all cycles.
            </p>
          </div>
        )}

        {!loading && fetched && rows.length === 0 && !error && (
          <div
            className="bg-card border border-border rounded-lg p-12 text-center"
            data-ocid="appraisal.empty_state"
          >
            <Star className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-display font-medium text-foreground mb-1">
              No appraisal records found
            </p>
            <p className="text-sm text-muted-foreground font-body">
              No appraisal data matched the selected cycle.
            </p>
          </div>
        )}

        {!loading && rows.length > 0 && (
          <div
            className="bg-card border border-border rounded-lg overflow-hidden"
            data-ocid="appraisal.table"
          >
            <div className="px-5 py-3 bg-primary/5 border-b border-border flex items-center justify-between">
              <p className="text-sm font-display font-semibold text-foreground">
                {rows.length} record{rows.length !== 1 ? "s" : ""}
              </p>
              {kraKeys.length > 0 && (
                <p className="text-xs text-muted-foreground font-body">
                  {kraKeys.length} KRA column{kraKeys.length !== 1 ? "s" : ""}{" "}
                  detected
                </p>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-body">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {allColumns.map((col) => (
                      <th
                        key={col.key}
                        className={`py-2.5 px-4 font-display text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap ${col.type === "number" ? "text-right" : "text-left"}`}
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
                      data-ocid={`appraisal.item.${idx + 1}`}
                    >
                      {allColumns.map((col) => (
                        <td
                          key={col.key}
                          className={`py-3 px-4 text-foreground ${col.type === "number" ? "text-right font-mono" : ""}`}
                        >
                          {col.key === "grade" ? (
                            <span className="text-xs bg-accent/20 border border-accent/30 rounded px-1.5 py-0.5 font-display font-semibold">
                              {String(row[col.key] ?? "—")}
                            </span>
                          ) : col.key === "status" ? (
                            <span className="text-xs bg-muted border border-border rounded px-1.5 py-0.5">
                              {String(row[col.key] ?? "—")}
                            </span>
                          ) : col.type === "number" ? (
                            Number(row[col.key] ?? 0).toLocaleString("en-IN")
                          ) : (
                            String(row[col.key] ?? "—")
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-primary/5">
                    <td
                      className="py-3 px-4 font-display font-semibold text-foreground"
                      colSpan={allColumns.length}
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
