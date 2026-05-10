/**
 * DcrSummaryReport — Phase 2 SFA
 * Date-wise DCR submission status for team.
 * Accessible to ASM, RSM, ZSM, HR, Admin.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ClipboardList,
  Download,
  Filter,
  Printer,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Role } from "../../backend";
import { Role as RoleEnum } from "../../backend";
import { DcrStatus } from "../../backend.d";
import type { DcrSummaryRow } from "../../backend.d";
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

interface DcrSummaryReportProps {
  portalRole?: Role;
}

const STATUS_BADGE: Record<string, string> = {
  [DcrStatus.Approved]: "bg-emerald-100 text-emerald-700 border-emerald-200",
  [DcrStatus.Submitted]: "bg-blue-100 text-blue-700 border-blue-200",
  [DcrStatus.Late]: "bg-amber-100 text-amber-700 border-amber-200",
  [DcrStatus.Rejected]:
    "bg-destructive/10 text-destructive border-destructive/20",
  [DcrStatus.Draft]: "bg-muted text-muted-foreground border-border",
};

const STATUS_LABEL: Record<string, string> = {
  [DcrStatus.Approved]: "Approved",
  [DcrStatus.Submitted]: "Submitted",
  [DcrStatus.Late]: "Late",
  [DcrStatus.Rejected]: "Rejected",
  [DcrStatus.Draft]: "Draft",
};

export default function DcrSummaryReport({
  portalRole = RoleEnum.ASM,
}: DcrSummaryReportProps) {
  const { session } = useAuthStore();
  const token = session?.token ?? "";
  const userId = session?.userId ?? BigInt(0);
  const { companyProfile } = useCompanyProfile();

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate] = useState(today.toISOString().slice(0, 10));
  const [selectedMrId, setSelectedMrId] = useState<string>("");
  const [mrList, setMrList] = useState<UserInfo[]>([]);
  const [mrLoading, setMrLoading] = useState(false);
  const [rows, setRows] = useState<DcrSummaryRow[]>([]);
  const [loading, setLoading] = useState(false);

  const isAdminHR =
    portalRole === RoleEnum.Admin || portalRole === RoleEnum.HRManager;

  useEffect(() => {
    if (!token) return;
    setMrLoading(true);
    const fetchMrs = async () => {
      try {
        let mrs: UserInfo[] = [];
        if (isAdminHR) {
          const all = await api.listAllUsers(token);
          mrs = all.filter((u) => u.role === "MR");
        } else {
          const reportees = await api.listReportees(token, userId);
          mrs = reportees.filter((u) => u.role === "MR");
        }
        setMrList(mrs);
      } catch {
        // silent
      } finally {
        setMrLoading(false);
      }
    };
    fetchMrs();
  }, [token, userId, isAdminHR]);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      let mrIds: number[] = [];
      if (selectedMrId) {
        mrIds = [Number(selectedMrId)];
      } else {
        mrIds = mrList.map((m) => Number(m.id));
      }
      if (mrIds.length === 0) {
        setRows([]);
        return;
      }
      const summary = await api.getDcrSummary(token, mrIds, fromDate, toDate);
      setRows(summary);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setLoading(false);
    }
  }, [token, fromDate, toDate, selectedMrId, mrList]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Summary stats
  const total = rows.length;
  const submitted = rows.filter((r) =>
    [DcrStatus.Submitted, DcrStatus.Approved, DcrStatus.Late].includes(
      r.status as DcrStatus,
    ),
  ).length;
  const late = rows.filter((r) => r.isLate).length;
  const notSubmitted = rows.filter(
    (r) => r.status === DcrStatus.Draft || !r.status,
  ).length;
  const submissionRate = total > 0 ? Math.round((submitted / total) * 100) : 0;

  const exportPdf = () => {
    const brandingHtml = buildBrandingHtml(companyProfile ?? null);
    const tableRows = rows
      .map(
        (r) => `<tr>
          <td>${r.mrName}</td>
          <td>${formatDate(r.date)}</td>
          <td>${STATUS_LABEL[r.status] ?? r.status}</td>
          <td style="text-align:right">${Number(r.totalDoctors)}</td>
          <td style="text-align:right">${Number(r.totalChemists)}</td>
          <td style="text-align:right">${Number(r.totalStockists)}</td>
          <td>${r.isLate ? "Late" : "—"}</td>
        </tr>`,
      )
      .join("");
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
      <title>DCR Summary</title>${brandingHtml}
      <style>
        h3{margin:10px 0 6px;font-size:14px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th{background:#0284c7;color:#fff;padding:7px 8px;text-align:left}
        td{padding:6px 8px;border-bottom:1px solid #eee}
        .summary{margin-bottom:12px;background:#f0f9ff;padding:10px 14px;border-radius:6px;border:1px solid #bae6fd}
        .summary span{margin-right:20px;font-size:13px}
      </style></head><body>
      <h3>DCR Summary Report — ${formatDate(fromDate)} to ${formatDate(toDate)}</h3>
      <div class="summary">
        <span>Total: ${total}</span>
        <span>Submitted: ${submitted}</span>
        <span>Late: ${late}</span>
        <span>Not Submitted: ${notSubmitted}</span>
        <span>Rate: ${submissionRate}%</span>
      </div>
      <table><thead><tr>
        <th>MR Name</th><th>Date</th><th>Status</th>
        <th style="text-align:right">Doctors</th>
        <th style="text-align:right">Chemists</th>
        <th style="text-align:right">Stockists</th>
        <th>Late</th>
      </tr></thead><tbody>${tableRows}</tbody></table></body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
  };

  const exportExcel = () => {
    if (rows.length === 0) {
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
      "MR Name",
      "Date",
      "Status",
      "Doctors",
      "Chemists",
      "Stockists",
      "Late",
    ];
    const dataRows = rows.map((r) => [
      r.mrName,
      formatDate(r.date),
      STATUS_LABEL[r.status] ?? r.status,
      String(Number(r.totalDoctors)),
      String(Number(r.totalChemists)),
      String(Number(r.totalStockists)),
      r.isLate ? "Yes" : "No",
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
    a.download = `dcr-summary-${fromDate}-to-${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported successfully");
  };

  return (
    <PortalLayout portalRole={portalRole}>
      <PageHeader
        title="DCR Summary Report"
        subtitle="Date-wise Daily Call Report submission status for your team"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportPdf}
              className="gap-1.5"
              data-ocid="dcr-summary.print_button"
            >
              <Printer className="w-4 h-4" /> Print PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportExcel}
              className="gap-1.5"
              data-ocid="dcr-summary.export_button"
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
                data-ocid="dcr-summary.from_date"
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
                data-ocid="dcr-summary.to_date"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block text-muted-foreground">
                MR {mrLoading && "(loading…)"}
              </Label>
              {mrLoading ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <select
                  className="w-full h-9 border border-input bg-background px-3 text-sm rounded-md"
                  value={selectedMrId}
                  onChange={(e) => setSelectedMrId(e.target.value)}
                  data-ocid="dcr-summary.mr_select"
                >
                  <option value="">— All MRs —</option>
                  {mrList.map((mr) => (
                    <option key={String(mr.id)} value={String(mr.id)}>
                      {mr.name}
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
              data-ocid="dcr-summary.apply_button"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Apply
            </Button>
          </div>
        </div>

        {/* Summary cards */}
        {!loading && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
            {[
              { label: "Expected", value: total, color: "text-foreground" },
              { label: "Submitted", value: submitted, color: "text-primary" },
              { label: "Late", value: late, color: "text-amber-600" },
              {
                label: "Not Submitted",
                value: notSubmitted,
                color: "text-destructive",
              },
              {
                label: "Rate",
                value: `${submissionRate}%`,
                color:
                  submissionRate >= 80
                    ? "text-emerald-600"
                    : submissionRate >= 60
                      ? "text-amber-600"
                      : "text-destructive",
              },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="bg-card border border-border rounded-lg p-3"
              >
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={`font-display font-bold text-xl ${color}`}>
                  {value}
                </p>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3"
            data-ocid="dcr-summary.empty_state"
          >
            <ClipboardList className="w-10 h-10 opacity-20" />
            <p className="text-sm">
              No DCR data found for the selected period and filters.
            </p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/20 flex justify-between">
              <h3 className="font-display font-semibold text-sm text-foreground">
                DCR Records
              </h3>
              <span className="text-xs text-muted-foreground">
                {rows.length} records
              </span>
            </div>
            <ScrollableTable>
              <table className="w-full text-sm" data-ocid="dcr-summary.table">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {[
                      "MR Name",
                      "Date",
                      "Status",
                      "Doctors",
                      "Chemists",
                      "Stockists",
                      "Late",
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
                  {rows.map((r, i) => (
                    <tr
                      key={`${String(r.mrId)}-${r.date}`}
                      className="border-b border-border/50 hover:bg-muted/20 cursor-pointer"
                      data-ocid={`dcr-summary.item.${i + 1}`}
                    >
                      <td className="px-3 py-2.5 font-medium text-foreground">
                        {r.mrName}
                      </td>
                      <td className="px-3 py-2.5 text-xs font-mono">
                        {formatDate(r.date)}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge
                          variant="outline"
                          className={`text-xs ${STATUS_BADGE[r.status] ?? "bg-muted text-muted-foreground"}`}
                        >
                          {STATUS_LABEL[r.status] ?? r.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono">
                        {Number(r.totalDoctors)}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono">
                        {Number(r.totalChemists)}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono">
                        {Number(r.totalStockists)}
                      </td>
                      <td className="px-3 py-2.5">
                        {r.isLate ? (
                          <Badge
                            variant="outline"
                            className="text-xs bg-amber-100 text-amber-700 border-amber-200"
                          >
                            Late
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
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
