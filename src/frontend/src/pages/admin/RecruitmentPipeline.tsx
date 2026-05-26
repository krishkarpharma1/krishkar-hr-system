import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Users } from "lucide-react";
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
  { key: "candidateName", label: "Candidate Name", type: "text" },
  { key: "email", label: "Email", type: "text" },
  { key: "mobile", label: "Mobile", type: "text" },
  { key: "positionApplied", label: "Position Applied", type: "text" },
  { key: "department", label: "Department", type: "text" },
  { key: "territory", label: "Territory", type: "text" },
  { key: "source", label: "Source", type: "text" },
  { key: "currentStage", label: "Current Stage", type: "text" },
  { key: "interviewDate", label: "Interview Date", type: "date" },
  { key: "offerIssued", label: "Offer Issued", type: "text" },
  { key: "joiningDate", label: "Joining Date", type: "date" },
  { key: "status", label: "Status", type: "text" },
];

const STATUSES = [
  "All",
  "Applied",
  "Screening",
  "Interview",
  "Offer",
  "Joined",
  "Rejected",
  "Withdrawn",
];

type RowData = Record<string, unknown>;

export default function RecruitmentPipeline() {
  const { session } = useAuthStore();
  const { companyProfile } = useCompanyProfile();
  const token = session?.token ?? "";

  const [status, setStatus] = useState("All");
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
        (await (a.getRecruitmentCandidates?.(token, {
          status: status === "All" ? undefined : status,
        }) ?? a.listCandidates?.(token))) ?? [];
      setRows((data as RowData[]) ?? []);
      setFetched(true);
    } catch {
      setRows([]);
      setFetched(true);
      setError("Could not load recruitment data from server.");
    } finally {
      setLoading(false);
    }
  }, [token, status]);

  const activeFilters = status !== "All" ? `Status: ${status}` : "";

  const handleExport = useCallback(() => {
    exportToExcel({
      reportName: "Recruitment Pipeline",
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
      "Recruitment Pipeline Export",
      activeFilters || "All Data",
      rows.length,
    );
    toast.success(`Exported ${rows.length} rows`);
  }, [rows, activeFilters, companyProfile, session]);

  return (
    <PortalLayout portalRole={Role.Admin}>
      <PageHeader
        title="Recruitment Pipeline"
        subtitle="Track candidates through all hiring stages"
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
            data-ocid="recruitment.export_button"
          />
        }
      />
      <PageContent>
        {/* Filters */}
        <div className="bg-card border border-border rounded-lg p-4 mb-5 flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="recruitment-status"
              className="text-xs text-muted-foreground font-display"
            >
              Status
            </label>
            <select
              id="recruitment-status"
              onChange={(e) => setStatus(e.target.value)}
              className="h-9 text-xs rounded-md border border-input bg-background px-3 py-1 w-[160px] focus:outline-none focus:ring-1 focus:ring-ring"
              data-ocid="recruitment.status_select"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => void fetchData()}
            disabled={loading}
            className="h-9 px-4 text-xs rounded-md bg-primary text-primary-foreground font-display font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 mt-auto"
            data-ocid="recruitment.search_button"
          >
            {loading ? "Loading…" : "Apply Filter"}
          </button>
        </div>

        {error && !loading && (
          <div
            className="bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-4 flex items-center gap-3 mb-4"
            data-ocid="recruitment.error_state"
          >
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {loading && (
          <div className="space-y-2" data-ocid="recruitment.loading_state">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-10 rounded-lg" />
            ))}
          </div>
        )}

        {!loading && !fetched && !error && (
          <div className="bg-card border border-border rounded-lg p-10 text-center">
            <Users className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground font-body">
              Select a status and click <strong>Apply Filter</strong> to load
              candidates.
            </p>
          </div>
        )}

        {!loading && fetched && rows.length === 0 && !error && (
          <div
            className="bg-card border border-border rounded-lg p-12 text-center"
            data-ocid="recruitment.empty_state"
          >
            <Users className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-display font-medium text-foreground mb-1">
              No candidates found
            </p>
            <p className="text-sm text-muted-foreground font-body">
              No recruitment records matched the selected filters.
            </p>
          </div>
        )}

        {!loading && rows.length > 0 && (
          <div
            className="bg-card border border-border rounded-lg overflow-hidden"
            data-ocid="recruitment.table"
          >
            <div className="px-5 py-3 bg-primary/5 border-b border-border">
              <p className="text-sm font-display font-semibold text-foreground">
                {rows.length} candidate{rows.length !== 1 ? "s" : ""}
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
                      data-ocid={`recruitment.item.${idx + 1}`}
                    >
                      {COLUMNS.map((col) => (
                        <td key={col.key} className="py-3 px-4 text-foreground">
                          {col.key === "status" ||
                          col.key === "currentStage" ? (
                            <span className="text-xs bg-muted border border-border rounded px-1.5 py-0.5">
                              {String(row[col.key] ?? "—")}
                            </span>
                          ) : col.key === "offerIssued" ? (
                            <span
                              className={`text-xs rounded px-1.5 py-0.5 border font-medium ${
                                String(row[col.key]).toLowerCase() === "yes"
                                  ? "bg-green-50 border-green-200 text-green-700"
                                  : "bg-muted border-border text-muted-foreground"
                              }`}
                            >
                              {String(row[col.key] ?? "—")}
                            </span>
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
