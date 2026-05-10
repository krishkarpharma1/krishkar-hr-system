/**
 * JfwSummaryReport — Phase 2 SFA
 * Joint Field Work summary for HR and Admin.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Filter, Printer, RefreshCw, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Role } from "../../backend";
import { Role as RoleEnum } from "../../backend";
import { JfwRating } from "../../backend.d";
import type { JfwInfo, JfwSummaryRow } from "../../backend.d";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import ScrollableTable from "../../components/ScrollableTable";
import { useCompanyProfile } from "../../hooks/useCompanyProfile";
import { api } from "../../lib/api";
import {
  buildBrandingExcelRows,
  buildBrandingHtml,
} from "../../lib/brandingHtml";
import { useAuthStore } from "../../store/authStore";
import type { UserInfo } from "../../types";
import { formatDate } from "../../utils/dateFormatter";

interface JfwSummaryReportProps {
  portalRole?: Role;
}

const RATING_BADGE: Record<string, string> = {
  [JfwRating.Excellent]: "bg-emerald-100 text-emerald-700 border-emerald-200",
  [JfwRating.Good]: "bg-blue-100 text-blue-700 border-blue-200",
  [JfwRating.Average]: "bg-amber-100 text-amber-700 border-amber-200",
  [JfwRating.Poor]: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function JfwSummaryReport({
  portalRole = RoleEnum.HRManager,
}: JfwSummaryReportProps) {
  const { session } = useAuthStore();
  const token = session?.token ?? "";
  const { companyProfile } = useCompanyProfile();

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate] = useState(today.toISOString().slice(0, 10));
  const [selectedManagerId, setSelectedManagerId] = useState<string>("");
  const [managerList, setManagerList] = useState<UserInfo[]>([]);
  const [managerLoading, setManagerLoading] = useState(false);
  const [summaryRows, setSummaryRows] = useState<JfwSummaryRow[]>([]);
  const [detailRows, setDetailRows] = useState<JfwInfo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    setManagerLoading(true);
    api
      .listAllUsers(token)
      .then((all) => {
        setManagerList(
          all.filter((u) => ["ASM", "RSM", "ZSM"].includes(u.role)),
        );
      })
      .catch(() => {})
      .finally(() => setManagerLoading(false));
  }, [token]);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [summary, all] = await Promise.all([
        api.getJfwSummary(token, fromDate, toDate) as Promise<JfwSummaryRow[]>,
        api.getAllJfws(token, fromDate, toDate) as Promise<JfwInfo[]>,
      ]);
      // Build manager name map from managerList
      const managerNameMap = new Map(
        managerList.map((m) => [String(m.id), m.name]),
      );

      const filteredSummary = selectedManagerId
        ? summary.filter((r) => String(r.managerId) === selectedManagerId)
        : summary;
      const filteredDetail = selectedManagerId
        ? all.filter((r) => String(r.managerId) === selectedManagerId)
        : all;

      // Annotate detail rows with manager names
      const annotated = filteredDetail.map((r) => ({
        ...r,
        _managerName:
          managerNameMap.get(String(r.managerId)) ??
          `Mgr-${String(r.managerId)}`,
      }));

      setSummaryRows(filteredSummary);
      setDetailRows(annotated as unknown as JfwInfo[]);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setLoading(false);
    }
  }, [token, fromDate, toDate, selectedManagerId, managerList]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Stats
  const totalJfws = detailRows.length;
  const mrsCovered = new Set(detailRows.map((r) => String(r.mrId))).size;
  const avgRating =
    summaryRows.length > 0
      ? (
          summaryRows.reduce((s, r) => s + r.avgRating, 0) / summaryRows.length
        ).toFixed(1)
      : "—";

  // Rating distribution
  const ratingCounts: Record<string, number> = {
    [JfwRating.Excellent]: 0,
    [JfwRating.Good]: 0,
    [JfwRating.Average]: 0,
    [JfwRating.Poor]: 0,
  };
  for (const r of detailRows) {
    if (r.rating in ratingCounts) ratingCounts[r.rating]++;
  }

  const exportPdf = () => {
    const brandingHtml = buildBrandingHtml(companyProfile ?? null);
    const rows = detailRows
      .map(
        (r) => `<tr>
          <td>${(r as unknown as Record<string, string>)._managerName ?? String(r.managerId)}</td>
          <td>${r.mrName}</td>
          <td>${formatDate(r.date)}</td>
          <td>${r.stationVisited}</td>
          <td style="text-align:center">${r.doctorsJointlyVisited.length}</td>
          <td>${r.rating}</td>
          <td>${r.mrAcknowledged ? "Yes" : "No"}</td>
        </tr>`,
      )
      .join("");
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
      <title>JFW Summary</title>${brandingHtml}
      <style>
        h3{margin:10px 0 6px;font-size:14px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th{background:#0284c7;color:#fff;padding:7px 8px;text-align:left}
        td{padding:6px 8px;border-bottom:1px solid #eee}
        .stat{margin-bottom:10px;font-size:13px}
      </style></head><body>
      <h3>JFW Summary Report — ${formatDate(fromDate)} to ${formatDate(toDate)}</h3>
      <p class="stat">Total JFWs: <strong>${totalJfws}</strong> | MRs Covered: <strong>${mrsCovered}</strong> | Avg Rating: <strong>${avgRating}</strong></p>
      <table><thead><tr>
        <th>Manager</th><th>MR Name</th><th>Date</th>
        <th>Station</th><th>Doctors</th><th>Rating</th><th>Acknowledged</th>
      </tr></thead><tbody>${rows}</tbody></table></body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
  };

  const exportExcel = () => {
    if (detailRows.length === 0) {
      toast.info("No data to export.");
      return;
    }
    const brandingRows = buildBrandingExcelRows(companyProfile ?? null).map(
      (r) => {
        const val = Object.values(r)[0] ?? "";
        return [val, "", "", "", "", "", ""] as string[];
      },
    );
    const header = [
      "Manager",
      "MR Name",
      "Date",
      "Station",
      "Doctors Visited",
      "Rating",
      "Acknowledged",
    ];
    const dataRows = detailRows.map((r) => [
      (r as unknown as Record<string, string>)._managerName ??
        String(r.managerId),
      r.mrName,
      formatDate(r.date),
      r.stationVisited,
      String(r.doctorsJointlyVisited.length),
      r.rating,
      r.mrAcknowledged ? "Yes" : "No",
    ]);
    const csv = [...brandingRows, header, ...dataRows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jfw-summary-${fromDate}-to-${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported successfully");
  };

  const maxRatingCount = Math.max(...Object.values(ratingCounts), 1);

  return (
    <PortalLayout portalRole={portalRole}>
      <PageHeader
        title="JFW Summary Report"
        subtitle="Joint Field Work entries showing manager-conducted visits per MR with ratings"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportPdf}
              className="gap-1.5"
              data-ocid="jfw-summary.print_button"
            >
              <Printer className="w-4 h-4" /> Print PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportExcel}
              className="gap-1.5"
              data-ocid="jfw-summary.export_button"
            >
              <Download className="w-4 h-4" /> Export CSV
            </Button>
          </div>
        }
      />
      <PageContent>
        {/* Filters */}
        <div className="bg-card border border-border rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">
              Filters
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs mb-1 block text-muted-foreground">
                From Date
              </Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-9"
                data-ocid="jfw-summary.from_date"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block text-muted-foreground">
                To Date
              </Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-9"
                data-ocid="jfw-summary.to_date"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block text-muted-foreground">
                Manager {managerLoading && "(loading…)"}
              </Label>
              {managerLoading ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <select
                  className="w-full h-9 border border-input bg-background px-3 text-sm rounded-md"
                  value={selectedManagerId}
                  onChange={(e) => setSelectedManagerId(e.target.value)}
                  data-ocid="jfw-summary.manager_select"
                >
                  <option value="">— All Managers —</option>
                  {managerList.map((m) => (
                    <option key={String(m.id)} value={String(m.id)}>
                      {m.name} ({m.role})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
          <div className="mt-3">
            <Button
              size="sm"
              onClick={fetchData}
              className="gap-1.5"
              data-ocid="jfw-summary.apply_button"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Apply
            </Button>
          </div>
        </div>

        {/* Summary cards */}
        {!loading && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: "Total JFWs", value: totalJfws },
              { label: "MRs Covered", value: mrsCovered },
              { label: "Avg Rating", value: avgRating },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="bg-card border border-border rounded-lg p-3 flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Users className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="font-display font-bold text-xl text-foreground">
                    {value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Rating Distribution */}
        {!loading && totalJfws > 0 && (
          <div className="bg-card border border-border rounded-lg p-4 mb-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Rating Distribution
            </h3>
            <div className="space-y-2">
              {Object.entries(ratingCounts).map(([rating, count]) => (
                <div key={rating} className="flex items-center gap-3">
                  <span className="text-xs w-20 flex-shrink-0 text-muted-foreground">
                    {rating}
                  </span>
                  <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${(count / maxRatingCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-foreground w-6 text-right">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detail table */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : detailRows.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3"
            data-ocid="jfw-summary.empty_state"
          >
            <Users className="w-10 h-10 opacity-20" />
            <p className="text-sm">
              No JFW records found for the selected period.
            </p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/20 flex justify-between">
              <h3 className="font-display font-semibold text-sm text-foreground">
                JFW Detail Records
              </h3>
              <span className="text-xs text-muted-foreground">
                {detailRows.length} records
              </span>
            </div>
            <ScrollableTable>
              <table className="w-full text-sm" data-ocid="jfw-summary.table">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {[
                      "Manager",
                      "MR Name",
                      "Date",
                      "Station",
                      "Doctors",
                      "Rating",
                      "Acknowledged",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detailRows.map((r, i) => (
                    <tr
                      key={String(r.id)}
                      className="border-b border-border/50 hover:bg-muted/20"
                      data-ocid={`jfw-summary.item.${i + 1}`}
                    >
                      <td className="px-3 py-2.5 text-sm font-medium text-foreground">
                        {(r as unknown as Record<string, string>)
                          ._managerName ?? String(r.managerId)}
                      </td>
                      <td className="px-3 py-2.5 text-sm">{r.mrName}</td>
                      <td className="px-3 py-2.5 text-xs font-mono">
                        {formatDate(r.date)}
                      </td>
                      <td className="px-3 py-2.5 text-sm text-muted-foreground">
                        {r.stationVisited}
                      </td>
                      <td className="px-3 py-2.5 text-center font-semibold text-primary">
                        {r.doctorsJointlyVisited.length}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge
                          variant="outline"
                          className={`text-xs ${RATING_BADGE[r.rating] ?? "bg-muted text-muted-foreground"}`}
                        >
                          {r.rating}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        {r.mrAcknowledged ? (
                          <Badge
                            variant="outline"
                            className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200"
                          >
                            Yes
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollableTable>
          </div>
        )}
      </PageContent>
    </PortalLayout>
  );
}
