import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ShieldAlert } from "lucide-react";
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
  { key: "timestamp", label: "Timestamp (IST)", type: "datetime" },
  { key: "userId", label: "User ID", type: "text" },
  { key: "userName", label: "User Name", type: "text" },
  { key: "role", label: "Role", type: "text" },
  { key: "actionType", label: "Action Type", type: "text" },
  { key: "details", label: "Details", type: "text" },
  { key: "ipAddress", label: "IP Address", type: "text" },
];

const ACTION_TYPES = [
  "All",
  "Login",
  "Logout",
  "Create",
  "Update",
  "Delete",
  "Export",
  "Approval",
  "Rejection",
];

type RowData = Record<string, unknown>;

export default function AuditTrailPage() {
  const { session } = useAuthStore();
  const { companyProfile } = useCompanyProfile();
  const token = session?.token ?? "";

  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000)
    .toISOString()
    .slice(0, 10);

  const [fromDate, setFromDate] = useState(weekAgo);
  const [toDate, setToDate] = useState(today);
  const [userSearch, setUserSearch] = useState("");
  const [actionType, setActionType] = useState("All");
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
        (await (a.getAuditLog?.(token, {
          fromDate,
          toDate,
          userSearch,
          actionType: actionType === "All" ? undefined : actionType,
        }) ??
          a.listAuditEntries?.(token, { fromDate, toDate }) ??
          a.getAdminAuditTrail?.(token))) ?? [];
      setRows((data as RowData[]) ?? []);
      setFetched(true);
    } catch {
      setRows([]);
      setFetched(true);
      setError("Could not load audit trail data from server.");
    } finally {
      setLoading(false);
    }
  }, [token, fromDate, toDate, userSearch, actionType]);

  const activeFilters = [
    `Date: ${fromDate} to ${toDate}`,
    userSearch && `User: ${userSearch}`,
    actionType !== "All" && `Action: ${actionType}`,
  ]
    .filter(Boolean)
    .join(" | ");

  const handleExport = useCallback(() => {
    exportToExcel({
      reportName: "Audit Trail",
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
      "Audit Trail Export",
      activeFilters,
      rows.length,
    );
    toast.success(`Exported ${rows.length} rows`);
  }, [rows, activeFilters, companyProfile, session]);

  return (
    <PortalLayout portalRole={Role.Admin}>
      <PageHeader
        title="Audit Trail"
        subtitle="Full log of all admin and system actions"
        actions={
          <ExportButton
            onClick={handleExport}
            disabled={rows.length === 0}
            tooltip={
              rows.length === 0
                ? "No data to export."
                : "Exports currently filtered data."
            }
            data-ocid="audit-trail.export_button"
          />
        }
      />
      <PageContent>
        {/* Filters */}
        <div className="bg-card border border-border rounded-lg p-4 mb-5 flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="audit-trail-from-date"
              className="text-xs text-muted-foreground font-display"
            >
              From Date
            </label>
            <input
              id="audit-trail-from-date"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-9 text-xs rounded-md border border-input bg-background px-3 py-1 w-[150px] focus:outline-none focus:ring-1 focus:ring-ring"
              data-ocid="audit-trail.from_date_input"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="audit-trail-to-date"
              className="text-xs text-muted-foreground font-display"
            >
              To Date
            </label>
            <input
              id="audit-trail-to-date"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-9 text-xs rounded-md border border-input bg-background px-3 py-1 w-[150px] focus:outline-none focus:ring-1 focus:ring-ring"
              data-ocid="audit-trail.to_date_input"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="audit-trail-user-search"
              className="text-xs text-muted-foreground font-display"
            >
              User Search
            </label>
            <input
              id="audit-trail-user-search"
              type="text"
              placeholder="Name or ID…"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="h-9 text-xs rounded-md border border-input bg-background px-3 py-1 w-[180px] focus:outline-none focus:ring-1 focus:ring-ring"
              data-ocid="audit-trail.user_search_input"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="audit-trail-action-type"
              className="text-xs text-muted-foreground font-display"
            >
              Action Type
            </label>
            <select
              id="audit-trail-action-type"
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
              className="h-9 text-xs rounded-md border border-input bg-background px-3 py-1 w-[150px] focus:outline-none focus:ring-1 focus:ring-ring"
              data-ocid="audit-trail.action_type_select"
            >
              {ACTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => void fetchData()}
            disabled={loading}
            className="h-9 px-4 text-xs rounded-md bg-primary text-primary-foreground font-display font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 mt-auto"
            data-ocid="audit-trail.search_button"
          >
            {loading ? "Loading…" : "Apply Filter"}
          </button>
        </div>

        {error && !loading && (
          <div
            className="bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-4 flex items-center gap-3 mb-4"
            data-ocid="audit-trail.error_state"
          >
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {loading && (
          <div className="space-y-2" data-ocid="audit-trail.loading_state">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-10 rounded-lg" />
            ))}
          </div>
        )}

        {!loading && !fetched && !error && (
          <div className="bg-card border border-border rounded-lg p-10 text-center">
            <ShieldAlert className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground font-body">
              Apply filters and click <strong>Apply Filter</strong> to load the
              audit log.
            </p>
          </div>
        )}

        {!loading && fetched && rows.length === 0 && !error && (
          <div
            className="bg-card border border-border rounded-lg p-12 text-center"
            data-ocid="audit-trail.empty_state"
          >
            <ShieldAlert className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-display font-medium text-foreground mb-1">
              No audit entries found
            </p>
            <p className="text-sm text-muted-foreground font-body">
              No entries matched the selected filters.
            </p>
          </div>
        )}

        {!loading && rows.length > 0 && (
          <div
            className="bg-card border border-border rounded-lg overflow-hidden"
            data-ocid="audit-trail.table"
          >
            <div className="px-5 py-3 bg-primary/5 border-b border-border">
              <p className="text-sm font-display font-semibold text-foreground">
                {rows.length} entr{rows.length !== 1 ? "ies" : "y"}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-body">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {COLUMNS.map((col) => (
                      <th
                        key={col.key}
                        className="py-2.5 px-4 text-left font-display text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap"
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
                      data-ocid={`audit-trail.item.${idx + 1}`}
                    >
                      <td className="py-3 px-4 text-xs font-mono text-muted-foreground whitespace-nowrap">
                        {String(row.timestamp ?? "—")}
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-muted-foreground">
                        {String(row.userId ?? "—")}
                      </td>
                      <td className="py-3 px-4 text-foreground font-medium">
                        {String(row.userName ?? "—")}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs bg-muted border border-border rounded px-1.5 py-0.5 text-foreground">
                          {String(row.role ?? "—")}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs bg-primary/10 border border-primary/20 rounded px-1.5 py-0.5 text-primary font-medium">
                          {String(row.actionType ?? "—")}
                        </span>
                      </td>
                      <td
                        className="py-3 px-4 text-sm text-foreground max-w-xs truncate"
                        title={String(row.details ?? "")}
                      >
                        {String(row.details ?? "—")}
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-muted-foreground">
                        {String(row.ipAddress ?? "—")}
                      </td>
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
