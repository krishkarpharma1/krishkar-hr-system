/**
 * MtpVsActualReport — Phase 2 SFA
 * Compares planned station vs. actual station per day.
 * Accessible to MR (own data), ASM, RSM, ZSM, HR, Admin.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarDays,
  Download,
  Filter,
  Printer,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Role } from "../../backend";
import { Role as RoleEnum } from "../../backend";
import type { DcrInfo, TravelPlanInfo } from "../../backend.d";
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

interface MtpRow {
  date: string;
  dayOfWeek: string;
  plannedStation: string;
  plannedPrimaryStation: string;
  plannedAdditionalStations: string[];
  plannedArea: string;
  actualStation: string;
  actualArea: string;
  hasDeviation: boolean;
  hasDcr: boolean;
}

interface MtpVsActualReportProps {
  portalRole?: Role;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function MtpVsActualReport({
  portalRole = RoleEnum.ASM,
}: MtpVsActualReportProps) {
  const { session } = useAuthStore();
  const token = session?.token ?? "";
  const userId = session?.userId ?? BigInt(0);
  const { companyProfile } = useCompanyProfile();

  const isMR = portalRole === RoleEnum.MR;
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [selectedMrId, setSelectedMrId] = useState<string>("");
  const [mrList, setMrList] = useState<UserInfo[]>([]);
  const [mrLoading, setMrLoading] = useState(false);
  const [rows, setRows] = useState<MtpRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [mrName, setMrName] = useState("");

  const isAdminHR =
    portalRole === RoleEnum.Admin || portalRole === RoleEnum.HRManager;

  useEffect(() => {
    if (isMR || !token) return;
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
  }, [token, userId, isMR, isAdminHR]);

  const fetchData = useCallback(async () => {
    const activeMrId = isMR ? Number(userId) : Number(selectedMrId);
    if (!token || (!isMR && !selectedMrId)) return;
    setLoading(true);
    try {
      // Get MTP planned data
      const mtpData: [string, string, string][] = await api.getMtpVsActualData(
        token,
        activeMrId,
        month,
        year,
      );

      // Get actual DCR data for the same period
      const monthStr = `${year}-${String(month).padStart(2, "0")}`;
      const fromDate = `${monthStr}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const toDate = `${monthStr}-${String(lastDay).padStart(2, "0")}`;
      const dcrs: DcrInfo[] = await api.listTeamDcrs(
        token,
        [activeMrId],
        fromDate,
        toDate,
      );
      const dcrMap = new Map<string, DcrInfo>(dcrs.map((d) => [d.date, d]));

      // Build rows
      const result: MtpRow[] = mtpData.map(
        ([date, plannedStation, plannedArea]) => {
          const dcr = dcrMap.get(date);
          const actualStation = dcr?.stationCovered ?? "";
          const actualArea = dcr?.areaCovered ?? "";
          const hasDeviation =
            Boolean(plannedStation) &&
            Boolean(actualStation) &&
            plannedStation.toLowerCase() !== actualStation.toLowerCase();
          const dayObj = new Date(date);
          return {
            date,
            dayOfWeek: DAYS[dayObj.getDay()],
            plannedStation,
            plannedPrimaryStation: plannedStation,
            plannedAdditionalStations: [],
            plannedArea,
            actualStation,
            actualArea,
            hasDeviation,
            hasDcr: Boolean(dcr),
          };
        },
      );
      setRows(result);

      // Set MR name for display
      if (!isMR) {
        const mr = mrList.find((m) => String(m.id) === selectedMrId);
        setMrName(mr?.name ?? "");
      } else {
        setMrName(session?.name ?? "");
      }
    } catch (e) {
      toast.error(String(e));
    } finally {
      setLoading(false);
    }
  }, [token, isMR, userId, selectedMrId, month, year, mrList, session]);

  useEffect(() => {
    if (isMR || selectedMrId) fetchData();
  }, [fetchData, isMR, selectedMrId]);

  // Stats
  const totalDays = rows.length;
  const dcrDays = rows.filter((r) => r.hasDcr).length;
  const deviations = rows.filter((r) => r.hasDeviation).length;
  const adherencePct =
    dcrDays > 0 ? Math.round(((dcrDays - deviations) / dcrDays) * 100) : 0;

  const rowBg = (r: MtpRow) => {
    if (!r.hasDcr) return "bg-muted/20";
    if (r.hasDeviation) return "bg-destructive/5";
    return "bg-emerald-50/50 dark:bg-emerald-900/5";
  };

  const exportPdf = () => {
    const brandingHtml = buildBrandingHtml(companyProfile ?? null);
    const tableRows = rows
      .map(
        (
          r,
        ) => `<tr class="${r.hasDeviation ? "dev" : r.hasDcr ? "ok" : "grey"}">
          <td>${formatDate(r.date)}</td>
          <td>${r.dayOfWeek}</td>
          <td>${r.plannedPrimaryStation || r.plannedStation || "\u2014"}</td>
          <td>${r.plannedAdditionalStations.length > 0 ? r.plannedAdditionalStations.join(", ") : "\u2014"}</td>
          <td>${r.plannedArea || "\u2014"}</td>
          <td>${r.actualStation || "\u2014"}</td>
          <td>${r.actualArea || "\u2014"}</td>
          <td style="text-align:center">${r.hasDeviation ? "✗ Yes" : r.hasDcr ? "✓ No" : "—"}</td>
        </tr>`,
      )
      .join("");
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
      <title>MTP vs Actual</title>${brandingHtml}
      <style>
        h3{margin:10px 0 6px;font-size:14px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th{background:#0284c7;color:#fff;padding:7px 8px;text-align:left}
        td{padding:6px 8px;border-bottom:1px solid #eee}
        .ok td{background:#f0fdf4}
        .dev td{background:#fef2f2}
        .grey td{background:#f9fafb}
        .stat{margin-bottom:10px;font-size:13px}
      </style></head><body>
      <h3>MTP vs Actual Report — ${mrName} — ${String(month).padStart(2, "0")}/${year}</h3>
      <p class="stat">Adherence: <strong>${adherencePct}%</strong> | Total Days: ${totalDays} | DCR Days: ${dcrDays} | Deviations: ${deviations}</p>
      <table><thead><tr>
        <th>Date</th><th>Day</th>
        <th>Planned Station</th><th>Additional Station(s)</th><th>Planned Area</th>
        <th>Actual Station</th><th>Actual Area</th>
        <th>Deviation</th>
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
        return [val, "", "", "", "", "", "", ""] as string[];
      },
    );
    const header = [
      "Date",
      "Day",
      "Planned Station",
      "Additional Station(s)",
      "Planned Area",
      "Actual Station",
      "Actual Area",
      "Deviation",
    ];
    const dataRows = rows.map((r) => [
      formatDate(r.date),
      r.dayOfWeek,
      r.plannedPrimaryStation || r.plannedStation,
      r.plannedAdditionalStations.join(", "),
      r.plannedArea,
      r.actualStation,
      r.actualArea,
      r.hasDeviation ? "Yes" : r.hasDcr ? "No" : "No DCR",
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
    a.download = `mtp-vs-actual-${mrName.replace(/\s+/g, "-")}-${String(month).padStart(2, "0")}-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported successfully");
  };

  const needsMrSelect = !isMR && !selectedMrId;

  return (
    <PortalLayout portalRole={portalRole}>
      <PageHeader
        title="MTP vs Actual Report"
        subtitle="Compare planned monthly tour program against actual stations visited"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportPdf}
              disabled={needsMrSelect}
              className="gap-1.5"
              data-ocid="mtp-actual.print_button"
            >
              <Printer className="w-4 h-4" /> Print PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportExcel}
              disabled={needsMrSelect}
              className="gap-1.5"
              data-ocid="mtp-actual.export_button"
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <Label
                className="text-xs mb-1 block text-muted-foreground"
                htmlFor="mtp-month"
              >
                Month
              </Label>
              <select
                id="mtp-month"
                className="w-full h-9 border border-input bg-background px-3 text-sm rounded-md"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                data-ocid="mtp-actual.month_select"
              >
                {(
                  [
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
                  ] as const
                ).map((mName, i) => (
                  <option key={mName} value={i + 1}>
                    {mName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label
                className="text-xs mb-1 block text-muted-foreground"
                htmlFor="mtp-year"
              >
                Year
              </Label>
              <select
                id="mtp-year"
                className="w-full h-9 border border-input bg-background px-3 text-sm rounded-md"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                data-ocid="mtp-actual.year_select"
              >
                {[year - 1, year, year + 1].map((y) => (
                  <option key={`yr-${y}`} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            {!isMR && (
              <div className="sm:col-span-2">
                <Label
                  className="text-xs mb-1 block text-muted-foreground"
                  htmlFor="mtp-mr"
                >
                  MR {mrLoading && "(loading…)"}
                </Label>
                {mrLoading ? (
                  <Skeleton className="h-9 w-full" />
                ) : (
                  <select
                    id="mtp-mr"
                    className="w-full h-9 border border-input bg-background px-3 text-sm rounded-md"
                    value={selectedMrId}
                    onChange={(e) => setSelectedMrId(e.target.value)}
                    data-ocid="mtp-actual.mr_select"
                  >
                    <option value="">— Select MR —</option>
                    {mrList.map((mr) => (
                      <option key={String(mr.id)} value={String(mr.id)}>
                        {mr.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>
          <div className="mt-3">
            <Button
              size="sm"
              onClick={fetchData}
              disabled={!isMR && !selectedMrId}
              className="gap-1.5"
              data-ocid="mtp-actual.apply_button"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Apply
            </Button>
          </div>
        </div>

        {needsMrSelect ? (
          <div
            className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3"
            data-ocid="mtp-actual.no_mr_selected"
          >
            <CalendarDays className="w-10 h-10 opacity-20" />
            <p className="text-sm">
              Please select an MR to view their MTP vs Actual data.
            </p>
          </div>
        ) : loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3"
            data-ocid="mtp-actual.empty_state"
          >
            <CalendarDays className="w-10 h-10 opacity-20" />
            <p className="text-sm">
              No MTP data found for the selected month and MR.
            </p>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {[
                {
                  label: "Total Days",
                  value: totalDays,
                  color: "text-foreground",
                },
                { label: "DCR Days", value: dcrDays, color: "text-primary" },
                {
                  label: "Deviations",
                  value: deviations,
                  color: "text-destructive",
                },
                {
                  label: "Adherence",
                  value: `${adherencePct}%`,
                  color:
                    adherencePct >= 80 ? "text-emerald-600" : "text-amber-600",
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

            {/* Legend */}
            <div className="flex gap-4 text-xs text-muted-foreground mb-3">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-emerald-200 inline-block" />{" "}
                On Plan
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-destructive/30 inline-block" />{" "}
                Deviation
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-muted inline-block" /> No
                DCR
              </span>
            </div>

            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/20 flex justify-between">
                <h3 className="font-display font-semibold text-sm text-foreground">
                  {mrName} — {String(month).padStart(2, "0")}/{year}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {rows.length} days
                </span>
              </div>
              <ScrollableTable>
                <table className="w-full text-sm" data-ocid="mtp-actual.table">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {[
                        "Date",
                        "Day",
                        "Planned Station",
                        "Additional Station(s)",
                        "Planned Area",
                        "Actual Station",
                        "Actual Area",
                        "Deviation",
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
                        key={r.date}
                        className={`border-b border-border/50 hover:brightness-95 ${rowBg(r)}`}
                        data-ocid={`mtp-actual.item.${i + 1}`}
                      >
                        <td className="px-3 py-2.5 font-mono text-xs">
                          {formatDate(r.date)}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">
                          {r.dayOfWeek}
                        </td>
                        <td className="px-3 py-2.5 text-sm font-medium">
                          {r.plannedPrimaryStation || r.plannedStation || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-xs">
                          {r.plannedAdditionalStations.length > 0 ? (
                            <span className="text-primary text-xs">
                              {r.plannedAdditionalStations.join(", ")}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">
                          {r.plannedArea || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-sm">
                          {r.actualStation || (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">
                          {r.actualArea || "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          {!r.hasDcr ? (
                            <span className="text-xs text-muted-foreground">
                              No DCR
                            </span>
                          ) : r.hasDeviation ? (
                            <Badge
                              variant="outline"
                              className="text-xs bg-destructive/10 text-destructive border-destructive/20"
                            >
                              Yes
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200"
                            >
                              No
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollableTable>
            </div>
          </>
        )}
      </PageContent>
    </PortalLayout>
  );
}
