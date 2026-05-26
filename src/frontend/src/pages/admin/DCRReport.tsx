import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ClipboardList } from "lucide-react";
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
import {
  exportToExcel,
  formatDateTime,
  logExportToAuditTrail,
} from "../../lib/exportUtils";
import { useAuthStore } from "../../store/authStore";

const COLUMNS: ColumnDef[] = [
  { key: "date", label: "Date", type: "date" },
  { key: "employeeCode", label: "Employee Code", type: "text" },
  { key: "employeeName", label: "Employee Name", type: "text" },
  { key: "role", label: "Role", type: "text" },
  { key: "territory", label: "Territory", type: "text" },
  { key: "visitType", label: "Visit Type", type: "text" },
  { key: "entityName", label: "Doctor/Chemist/Stockist Name", type: "text" },
  { key: "specialty", label: "Specialty", type: "text" },
  { key: "productsDetailed", label: "Products Detailed", type: "text" },
  { key: "samplesGiven", label: "Samples Given", type: "text" },
  { key: "giftArticlesGiven", label: "Gift Articles Given", type: "text" },
  { key: "gpsCaptured", label: "GPS Captured", type: "text" },
  { key: "submittedAt", label: "Submitted At (IST)", type: "datetime" },
  { key: "source", label: "Source", type: "text" },
];

type RowData = Record<string, unknown>;

interface UserInfo {
  id: string;
  employeeId: string;
  name: string;
  role: string;
  territory: string;
}

interface DoctorVisitEntry {
  doctorId: string;
  productIds: string[];
  samplesDistributed: bigint | number;
  giftArticles: unknown[];
  notes: string;
  gps: unknown;
}

interface CallReportInfo {
  id: string;
  mrId: string;
  date: string;
  status: string;
  workType: string;
  doctorsVisited: DoctorVisitEntry[];
  submittedAt: string | number | null;
}

export default function DCRReport() {
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
  const [territoryFilter, setTerritoryFilter] = useState("");
  const [allReports, setAllReports] = useState<CallReportInfo[]>([]);
  const [userMap, setUserMap] = useState<Map<string, UserInfo>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (api as any).listSubmittedReports() as Promise<CallReportInfo[]>,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (api as any).listAllUsers(token) as Promise<UserInfo[]>,
    ])
      .then(([reports, users]) => {
        setAllReports(reports ?? []);
        const map = new Map<string, UserInfo>();
        for (const u of users ?? []) map.set(u.id, u);
        setUserMap(map);
      })
      .catch(() => setError("Could not load DCR data from server."))
      .finally(() => setLoading(false));
  }, [token]);

  const rows = useMemo<RowData[]>(() => {
    const from = fromDate ? new Date(fromDate).getTime() : 0;
    const to = toDate
      ? new Date(toDate).getTime() + 86399999
      : Number.POSITIVE_INFINITY;

    return allReports.flatMap((r) => {
      const rDate = new Date(r.date).getTime();
      if (rDate < from || rDate > to) return [];
      const user = userMap.get(r.mrId);
      if (
        employeeFilter &&
        !(
          (user?.name ?? "")
            .toLowerCase()
            .includes(employeeFilter.toLowerCase()) ||
          (user?.employeeId ?? "")
            .toLowerCase()
            .includes(employeeFilter.toLowerCase())
        )
      )
        return [];
      if (
        territoryFilter &&
        !(user?.territory ?? "")
          .toLowerCase()
          .includes(territoryFilter.toLowerCase())
      )
        return [];

      const visits = r.doctorsVisited ?? [];
      if (visits.length === 0) {
        return [
          {
            date: r.date,
            employeeCode: user?.employeeId ?? r.mrId,
            employeeName: user?.name ?? "—",
            role: user?.role ?? "—",
            territory: user?.territory ?? "—",
            visitType: r.workType,
            entityName: "—",
            specialty: "",
            productsDetailed: "",
            samplesGiven: "0",
            giftArticlesGiven: "No",
            gpsCaptured: "No",
            submittedAt: r.submittedAt ? formatDateTime(r.submittedAt) : "—",
            source: "Live",
          },
        ];
      }

      return visits.map((entry) => ({
        date: r.date,
        employeeCode: user?.employeeId ?? r.mrId,
        employeeName: user?.name ?? "—",
        role: user?.role ?? "—",
        territory: user?.territory ?? "—",
        visitType: r.workType,
        entityName: entry.doctorId,
        specialty: "",
        productsDetailed: (entry.productIds ?? []).join(", "),
        samplesGiven: String(Number(entry.samplesDistributed ?? 0)),
        giftArticlesGiven: (entry.giftArticles ?? []).length > 0 ? "Yes" : "No",
        gpsCaptured: entry.gps ? "Yes" : "No",
        submittedAt: r.submittedAt ? formatDateTime(r.submittedAt) : "—",
        source: "Live",
      }));
    });
  }, [allReports, userMap, fromDate, toDate, employeeFilter, territoryFilter]);

  const activeFilters = [
    fromDate && `From: ${fromDate}`,
    toDate && `To: ${toDate}`,
    employeeFilter && `Employee: ${employeeFilter}`,
    territoryFilter && `Territory: ${territoryFilter}`,
  ]
    .filter(Boolean)
    .join(" | ");

  const handleExport = useCallback(() => {
    exportToExcel({
      reportName: "DCR Report",
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
      "DCR Report",
      activeFilters || "All Data",
      rows.length,
    );
    toast.success(`Exported ${rows.length} rows`);
  }, [rows, activeFilters, companyProfile, session]);

  return (
    <PortalLayout portalRole={Role.Admin}>
      <PageHeader
        title="DCR Report"
        subtitle="Daily Call Report records with visit details"
        actions={
          <ExportButton
            onClick={handleExport}
            disabled={rows.length === 0}
            tooltip={
              rows.length === 0
                ? "No data to export."
                : "Exports currently filtered data."
            }
            data-ocid="dcr-report.export_button"
          />
        }
      />
      <PageContent>
        {/* Filters */}
        <div className="bg-card border border-border rounded-lg p-4 mb-5 flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="dcr-report-from-date"
              className="text-xs text-muted-foreground font-display"
            >
              From Date
            </label>
            <input
              id="dcr-report-from-date"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-9 text-xs rounded-md border border-input bg-background px-3 py-1 w-[160px] focus:outline-none focus:ring-1 focus:ring-ring"
              data-ocid="dcr-report.from_date_input"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="dcr-report-to-date"
              className="text-xs text-muted-foreground font-display"
            >
              To Date
            </label>
            <input
              id="dcr-report-to-date"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-9 text-xs rounded-md border border-input bg-background px-3 py-1 w-[160px] focus:outline-none focus:ring-1 focus:ring-ring"
              data-ocid="dcr-report.to_date_input"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="dcr-report-employee"
              className="text-xs text-muted-foreground font-display"
            >
              Employee
            </label>
            <input
              id="dcr-report-employee"
              type="text"
              placeholder="Name or code"
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="h-9 text-xs rounded-md border border-input bg-background px-3 py-1 w-[180px] focus:outline-none focus:ring-1 focus:ring-ring"
              data-ocid="dcr-report.employee_input"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="dcr-report-territory"
              className="text-xs text-muted-foreground font-display"
            >
              Territory
            </label>
            <input
              id="dcr-report-territory"
              type="text"
              placeholder="All territories"
              value={territoryFilter}
              onChange={(e) => setTerritoryFilter(e.target.value)}
              className="h-9 text-xs rounded-md border border-input bg-background px-3 py-1 w-[180px] focus:outline-none focus:ring-1 focus:ring-ring"
              data-ocid="dcr-report.territory_input"
            />
          </div>
        </div>

        {error && !loading && (
          <div
            className="bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-4 flex items-center gap-3 mb-4"
            data-ocid="dcr-report.error_state"
          >
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {loading && (
          <div className="space-y-2" data-ocid="dcr-report.loading_state">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-10 rounded-lg" />
            ))}
          </div>
        )}

        {!loading && rows.length === 0 && !error && (
          <div
            className="bg-card border border-border rounded-lg p-12 text-center"
            data-ocid="dcr-report.empty_state"
          >
            <ClipboardList className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-display font-medium text-foreground mb-1">
              No DCR records found
            </p>
            <p className="text-sm text-muted-foreground font-body">
              No call reports matched the selected filters.
            </p>
          </div>
        )}

        {!loading && rows.length > 0 && (
          <div
            className="bg-card border border-border rounded-lg overflow-hidden"
            data-ocid="dcr-report.table"
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
                        className="py-2.5 px-4 font-display text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap text-left"
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
                      data-ocid={`dcr-report.item.${idx + 1}`}
                    >
                      {COLUMNS.map((col) => (
                        <td
                          key={col.key}
                          className="py-3 px-4 text-foreground whitespace-nowrap"
                        >
                          {String(row[col.key] ?? "—")}
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
