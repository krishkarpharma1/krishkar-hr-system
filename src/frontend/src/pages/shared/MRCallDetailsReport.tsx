/**
 * Shared MRCallDetailsReport component — used across MR, ASM, RSM, ZSM, NSM, HR, Admin portals.
 * MR sees their own data; managers/HR/Admin can select from reportees.
 * RSM: MR dropdown is grouped by ASM using getMrsGroupedByAsmForManager.
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarDays,
  Download,
  FileText,
  Filter,
  Printer,
  RefreshCw,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Role } from "../../backend";
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

interface DayCallSummary {
  date: string;
  doctorsVisited: number;
  doctorNames: string[];
  productsDiscussed: string[];
  samplesGiven: string[];
  giftsGiven: string[];
  station: string;
  workingMode: string;
}

interface CallSummary {
  totalDaysWorked: number;
  totalDoctorVisits: number;
  totalSamplesGiven: number;
}

// ASM group for RSM dropdown
interface AsmMrGroup {
  asmId: bigint;
  asmName: string;
  mrs: Array<{ mrId: bigint; mrName: string }>;
}

interface MRCallDetailsReportProps {
  portalRole?: Role;
}

const isHRAdminRole = (role: Role) =>
  role === Role.HRManager || role === Role.Admin;

export default function MRCallDetailsReport({
  portalRole = Role.ASM,
}: MRCallDetailsReportProps) {
  const { session } = useAuthStore();
  const token = session?.token ?? "";
  const userId = session?.userId ?? BigInt(0);
  const { companyProfile } = useCompanyProfile();

  const [mrList, setMrList] = useState<UserInfo[]>([]);
  // RSM-specific: grouped by ASM
  const [asmMrGroups, setAsmMrGroups] = useState<AsmMrGroup[]>([]);
  const [selectedMrId, setSelectedMrId] = useState<string>("");
  const [callDetails, setCallDetails] = useState<DayCallSummary[]>([]);
  const [summary, setSummary] = useState<CallSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [mrLoading, setMrLoading] = useState(false);

  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [fromDate, setFromDate] = useState(
    thirtyDaysAgo.toISOString().slice(0, 10),
  );
  const [toDate, setToDate] = useState(today.toISOString().slice(0, 10));

  const isMR = portalRole === Role.MR;
  const isHRAdmin = isHRAdminRole(portalRole);
  const isRSM = portalRole === Role.RSM;

  // Fetch MR list for non-MR roles
  useEffect(() => {
    if (isMR || !token) return;
    setMrLoading(true);
    const fetchMrs = async () => {
      try {
        if (isHRAdmin) {
          const users = await api.listAllUsers(token);
          setMrList(
            users.filter((u) => u.role === "MR" || (u.role as string) === "MR"),
          );
        } else if (isRSM) {
          // RSM: use getMrsGroupedByAsmForManager for proper hierarchy traversal
          const groups = await api.getMrsGroupedByAsmForManager(token);
          setAsmMrGroups(groups);
          // Build a flat list for easy lookup (partial cast — only id/name/role/reportsTo used)
          const flat = groups.flatMap((g) =>
            g.mrs.map(
              (m) =>
                ({
                  id: m.mrId,
                  name: m.mrName,
                  role: "MR",
                  reportsTo: g.asmId,
                }) as unknown as UserInfo,
            ),
          );
          setMrList(flat);
        } else {
          const reportees = await api.listReportees(token, userId);
          setMrList(
            reportees.filter(
              (u) => u.role === "MR" || (u.role as string) === "MR",
            ),
          );
        }
      } catch {
        // ignore
      } finally {
        setMrLoading(false);
      }
    };
    fetchMrs();
  }, [token, userId, isMR, isHRAdmin, isRSM]);

  const activeMrId = isMR ? userId : selectedMrId ? BigInt(selectedMrId) : null;

  const fetchData = useCallback(async () => {
    if (!activeMrId || !token) return;
    setLoading(true);
    try {
      const fromTs = BigInt(new Date(fromDate).getTime()) * BigInt(1_000_000);
      const toTs =
        BigInt(new Date(`${toDate}T23:59:59`).getTime()) * BigInt(1_000_000);

      const result = await callWithFallback(token, activeMrId, fromTs, toTs);
      setCallDetails(result.details);
      setSummary(result.summary);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setLoading(false);
    }
  }, [activeMrId, token, fromDate, toDate]);

  useEffect(() => {
    if (activeMrId) {
      fetchData();
    }
  }, [fetchData, activeMrId]);

  // Resolve selected MR name
  const selectedMrName = isMR
    ? (session?.name ?? "")
    : (() => {
        if (isRSM) {
          for (const g of asmMrGroups) {
            const mr = g.mrs.find((m) => String(m.mrId) === selectedMrId);
            if (mr) return mr.mrName;
          }
          return "";
        }
        return mrList.find((m) => String(m.id) === selectedMrId)?.name ?? "";
      })();

  // Resolve selected ASM name for the selected MR (RSM only)
  const selectedAsmName = (() => {
    if (!isRSM || !selectedMrId) return "";
    for (const g of asmMrGroups) {
      const found = g.mrs.find((m) => String(m.mrId) === selectedMrId);
      if (found) return g.asmName;
    }
    return "";
  })();

  const exportExcel = () => {
    if (callDetails.length === 0) {
      toast.info("No data to export.");
      return;
    }
    const COLS = 9;
    const brandingRows = buildBrandingExcelRows(companyProfile ?? null).map(
      (r) => {
        const val = Object.values(r)[0] ?? "";
        return [val, ...Array(COLS - 1).fill("")] as string[];
      },
    );
    const header = [
      "Date",
      "MR Name",
      ...(isRSM ? ["ASM Name"] : []),
      "No. of Doctors",
      "Doctor Names",
      "Products Discussed",
      "Samples Given",
      "Gift Articles",
      "Station/Area",
      "Working Mode",
    ];
    const dataRows: string[][] = callDetails.map((row) => [
      row.date,
      selectedMrName,
      ...(isRSM ? [selectedAsmName] : []),
      row.doctorsVisited.toString(),
      row.doctorNames.join(", "),
      row.productsDiscussed.join(", "),
      row.samplesGiven.join(", "),
      row.giftsGiven.join(", "),
      row.station,
      row.workingMode,
    ]);
    const summaryRow: string[] = summary
      ? [
          "TOTAL",
          "",
          ...(isRSM ? [""] : []),
          `${summary.totalDoctorVisits} visits`,
          `${summary.totalDaysWorked} days worked`,
          "",
          `${summary.totalSamplesGiven} samples`,
          "",
          "",
          "",
        ]
      : [];
    const rows = [
      ...brandingRows,
      header,
      ...dataRows,
      ...(summaryRow.length ? [summaryRow] : []),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mr-call-details-${selectedMrName.replace(/\s+/g, "-")}-${fromDate}-to-${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported successfully");
  };

  const handlePrint = () => {
    const brandingHtml = buildBrandingHtml(companyProfile ?? null);
    const tableRows = callDetails
      .map(
        (row) => `
      <tr>
        <td>${row.date}</td>
        ${isRSM ? `<td>${selectedAsmName}</td>` : ""}
        <td style="text-align:center">${row.doctorsVisited}</td>
        <td>${row.doctorNames.join("<br/>")}</td>
        <td>${row.productsDiscussed.join(", ")}</td>
        <td>${row.samplesGiven.join("<br/>")}</td>
        <td>${row.giftsGiven.join("<br/>") || "—"}</td>
        <td>${row.station}</td>
        <td>${row.workingMode}</td>
      </tr>`,
      )
      .join("");

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>MR Call Details — ${selectedMrName}</title>
${brandingHtml}
<style>
  h3 { margin: 12px 0 8px; font-size: 15px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #7c3aed; color: #fff; padding: 7px 8px; text-align: left; font-size: 11px; }
  td { padding: 6px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
  tr:nth-child(even) td { background: #f9f9f9; }
  .summary { margin-top: 12px; background: #f5f3ff; border: 1px solid #ddd6fe; padding: 10px 16px; border-radius: 6px; }
  .summary p { margin: 4px 0; font-size: 13px; }
</style>
</head><body>
<h3>MR Detail Report — ${selectedMrName}${isRSM && selectedAsmName ? ` (ASM: ${selectedAsmName})` : ""} (${fromDate} to ${toDate})</h3>
<table>
  <thead><tr>
    <th>Date</th>${isRSM ? "<th>ASM</th>" : ""}<th># Doctors</th><th>Doctor Names</th>
    <th>Products Discussed</th><th>Samples Given</th>
    <th>Gifts Given</th><th>Station/Area</th><th>Working Mode</th>
  </tr></thead>
  <tbody>${tableRows}</tbody>
</table>
${
  summary
    ? `<div class="summary">
  <p><strong>Total Days Worked:</strong> ${summary.totalDaysWorked}</p>
  <p><strong>Total Doctor Visits:</strong> ${summary.totalDoctorVisits}</p>
  <p><strong>Total Samples Given:</strong> ${summary.totalSamplesGiven}</p>
</div>`
    : ""
}
</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
  };

  return (
    <PortalLayout portalRole={portalRole}>
      <PageHeader
        title={
          isMR
            ? "My Call Details (Last 30 Days)"
            : isRSM
              ? "MR Detail Report — RSM View"
              : "MR Call Details Report"
        }
        subtitle={
          isMR
            ? "Date-wise breakdown of your doctor visits"
            : isRSM
              ? "Select an MR (grouped by ASM) to view full call-level details"
              : "View date-wise call activity for any MR under your management"
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="gap-1.5"
              data-ocid="btn-print-call-details"
            >
              <Printer className="w-4 h-4" /> Print
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportExcel}
              className="gap-1.5"
              data-ocid="btn-export-call-details"
            >
              <Download className="w-4 h-4" /> Export Excel
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
              {isMR ? "Date Range" : "Filters"}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {!isMR && (
              <div className="md:col-span-2">
                <Label className="text-xs mb-1 block text-muted-foreground">
                  Select MR {mrLoading && "(loading…)"}
                  {isRSM && !mrLoading && asmMrGroups.length > 0 && (
                    <span className="ml-1 text-muted-foreground font-normal">
                      (grouped by ASM)
                    </span>
                  )}
                </Label>
                {mrLoading ? (
                  <Skeleton className="h-9 w-full" />
                ) : (
                  <select
                    className="w-full h-9 border border-input bg-background px-3 text-sm rounded-md"
                    value={selectedMrId}
                    onChange={(e) => setSelectedMrId(e.target.value)}
                    data-ocid="select-mr"
                  >
                    <option value="">— Select MR —</option>
                    {isRSM && asmMrGroups.length > 0
                      ? asmMrGroups.map((group) =>
                          group.mrs.length === 0 ? null : (
                            <optgroup
                              key={String(group.asmId)}
                              label={`ASM: ${group.asmName} (${group.mrs.length})`}
                            >
                              {group.mrs.map((mr) => (
                                <option
                                  key={String(mr.mrId)}
                                  value={String(mr.mrId)}
                                >
                                  {mr.mrName}
                                </option>
                              ))}
                            </optgroup>
                          ),
                        )
                      : mrList.map((mr) => (
                          <option key={String(mr.id)} value={String(mr.id)}>
                            {mr.name} ({mr.employeeId})
                          </option>
                        ))}
                  </select>
                )}
                {isRSM && selectedMrId && selectedAsmName && (
                  <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                    <Users className="w-3 h-3" /> Reporting to ASM:{" "}
                    <strong>{selectedAsmName}</strong>
                  </p>
                )}
              </div>
            )}
            <div>
              <Label className="text-xs mb-1 block text-muted-foreground">
                From Date
              </Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-9"
                data-ocid="filter-from-date"
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
                data-ocid="filter-to-date"
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              onClick={fetchData}
              disabled={!activeMrId}
              className="gap-1.5"
              data-ocid="btn-apply-filters"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Apply Filters
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setFromDate(thirtyDaysAgo.toISOString().slice(0, 10));
                setToDate(today.toISOString().slice(0, 10));
              }}
              data-ocid="btn-reset-dates"
            >
              Reset to 30 Days
            </Button>
          </div>
        </div>

        {/* Summary stats */}
        {summary && !loading && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              {
                label: "Days Worked",
                value: summary.totalDaysWorked,
                icon: CalendarDays,
              },
              {
                label: "Doctor Visits",
                value: summary.totalDoctorVisits,
                icon: FileText,
              },
              {
                label: "Samples Given",
                value: summary.totalSamplesGiven,
                icon: FileText,
              },
            ].map(({ label, value, icon: Icon }) => (
              <div
                key={label}
                className="bg-card border border-border rounded-lg p-3 flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="font-display font-bold text-lg text-foreground">
                    {value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Main table */}
        {!activeMrId && !isMR ? (
          <div
            className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3"
            data-ocid="no-mr-selected"
          >
            <FileText className="w-10 h-10 opacity-20" />
            <p className="text-sm">
              {isRSM
                ? "Select an MR from the dropdown (grouped by ASM) to view their full call details."
                : "Please select an MR to view their call details."}
            </p>
          </div>
        ) : loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : callDetails.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3"
            data-ocid="call-details-empty"
          >
            <CalendarDays className="w-10 h-10 opacity-20" />
            <p className="text-sm">
              No call records found for the selected MR and date range.
            </p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center justify-between">
              <div>
                <h3 className="font-display font-semibold text-sm text-foreground">
                  {selectedMrName && `${selectedMrName} — `}Call Details
                </h3>
                {isRSM && selectedAsmName && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    ASM: {selectedAsmName}
                  </p>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {callDetails.length} days · {formatDate(fromDate)} to{" "}
                {formatDate(toDate)}
              </span>
            </div>
            <ScrollableTable>
              <table className="w-full text-sm" data-ocid="call-details-table">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {[
                      "Date",
                      ...(isRSM ? ["ASM"] : []),
                      "# Doctors",
                      "Doctor Names",
                      "Products Discussed",
                      "Samples Given",
                      "Gift Articles",
                      "Station / Area",
                      "Working Mode",
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
                  {callDetails.map((row) => (
                    <tr
                      key={row.date}
                      className="border-b border-border/50 hover:bg-muted/20"
                      data-ocid={`call-row-${row.date}`}
                    >
                      <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">
                        {formatDate(row.date)}
                      </td>
                      {isRSM && (
                        <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                          {selectedAsmName || "—"}
                        </td>
                      )}
                      <td className="px-3 py-2.5 text-center font-semibold text-foreground">
                        {row.doctorsVisited}
                      </td>
                      <td className="px-3 py-2.5 text-sm max-w-[180px]">
                        {row.doctorNames.length > 0 ? (
                          <div className="space-y-0.5">
                            {row.doctorNames.map((d) => (
                              <div key={d} className="text-xs text-foreground">
                                {d}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[160px]">
                        {row.productsDiscussed.join(", ") || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-xs max-w-[140px]">
                        {row.samplesGiven.length > 0 ? (
                          <div className="space-y-0.5">
                            {row.samplesGiven.map((s) => (
                              <div key={s} className="text-xs">
                                {s}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs max-w-[140px]">
                        {row.giftsGiven.length > 0 ? (
                          <div className="space-y-0.5">
                            {row.giftsGiven.map((g) => (
                              <div key={g} className="text-xs">
                                {g}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-sm text-foreground whitespace-nowrap">
                        {row.station || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {row.workingMode || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {summary && (
                  <tfoot>
                    <tr className="bg-primary/5 border-t-2 border-primary/20 font-semibold">
                      <td className="px-3 py-3 text-sm text-foreground">
                        TOTAL
                      </td>
                      {isRSM && <td />}
                      <td className="px-3 py-3 text-center text-sm text-primary">
                        {summary.totalDoctorVisits}
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {summary.totalDaysWorked} days worked
                      </td>
                      <td
                        colSpan={2}
                        className="px-3 py-3 text-xs text-muted-foreground"
                      >
                        {summary.totalSamplesGiven} samples
                      </td>
                      <td colSpan={isRSM ? 4 : 3} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </ScrollableTable>
          </div>
        )}
      </PageContent>
    </PortalLayout>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function callWithFallback(
  token: string,
  mrUserId: bigint,
  fromTs: bigint,
  toTs: bigint,
): Promise<{ details: DayCallSummary[]; summary: CallSummary }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawApi = api as unknown as Record<
      string,
      (...args: unknown[]) => Promise<unknown>
    >;

    let details: DayCallSummary[] = [];
    let summary: CallSummary = {
      totalDaysWorked: 0,
      totalDoctorVisits: 0,
      totalSamplesGiven: 0,
    };

    if (typeof rawApi.getMRCallDetails === "function") {
      const detailsRes = await rawApi.getMRCallDetails(
        token,
        mrUserId,
        fromTs,
        toTs,
      );
      const result = detailsRes as {
        __kind__: string;
        ok?: unknown[];
        err?: string;
      };
      if (result.__kind__ === "ok" && Array.isArray(result.ok)) {
        details = result.ok.map(mapDayCallSummary);
      }
    }

    if (typeof rawApi.getMRCallSummary === "function") {
      const summaryRes = await rawApi.getMRCallSummary(
        token,
        mrUserId,
        fromTs,
        toTs,
      );
      const result = summaryRes as {
        __kind__: string;
        ok?: {
          totalDaysWorked?: unknown;
          totalDoctorVisits?: unknown;
          totalSamplesGiven?: unknown;
        };
        err?: string;
      };
      if (result.__kind__ === "ok" && result.ok) {
        summary = {
          totalDaysWorked: Number(result.ok.totalDaysWorked ?? 0),
          totalDoctorVisits: Number(result.ok.totalDoctorVisits ?? 0),
          totalSamplesGiven: Number(result.ok.totalSamplesGiven ?? 0),
        };
      }
    }

    // Fallback: derive from existing reports
    if (details.length === 0) {
      details = await deriveCallDetailsFromExisting(mrUserId, fromTs, toTs);
      summary = {
        totalDaysWorked: details.length,
        totalDoctorVisits: details.reduce((s, d) => s + d.doctorsVisited, 0),
        totalSamplesGiven: details.reduce(
          (s, d) =>
            s +
            d.samplesGiven.reduce((ss, sg) => {
              const match = sg.match(/\((\d+)\)/);
              return ss + (match ? Number.parseInt(match[1], 10) : 1);
            }, 0),
          0,
        ),
      };
    }

    return { details, summary };
  } catch {
    return {
      details: [],
      summary: {
        totalDaysWorked: 0,
        totalDoctorVisits: 0,
        totalSamplesGiven: 0,
      },
    };
  }
}

function mapDayCallSummary(raw: unknown): DayCallSummary {
  const r = raw as Record<string, unknown>;
  return {
    date: String(r.date ?? ""),
    doctorsVisited: Number(r.doctorsVisited ?? 0),
    doctorNames: Array.isArray(r.doctorNames)
      ? (r.doctorNames as string[])
      : [],
    productsDiscussed: Array.isArray(r.productsDiscussed)
      ? (r.productsDiscussed as string[])
      : [],
    samplesGiven: Array.isArray(r.samplesGiven)
      ? (r.samplesGiven as string[])
      : [],
    giftsGiven: Array.isArray(r.giftsGiven) ? (r.giftsGiven as string[]) : [],
    station: String(r.station ?? ""),
    workingMode: String(r.workingMode ?? ""),
  };
}

async function deriveCallDetailsFromExisting(
  mrUserId: bigint,
  fromTs: bigint,
  toTs: bigint,
): Promise<DayCallSummary[]> {
  try {
    const fromDate = new Date(Number(fromTs) / 1_000_000);
    const monthStr = fromDate.toISOString().slice(0, 7);

    const reports = await api.listMyCallReportsByMonth(mrUserId, monthStr);
    const toDate = new Date(Number(toTs) / 1_000_000);
    const byDate = new Map<string, DayCallSummary>();

    for (const report of reports) {
      const reportDate = report.date;
      const reportDateObj = new Date(reportDate);
      if (reportDateObj < fromDate || reportDateObj > toDate) continue;

      const existing = byDate.get(reportDate) ?? {
        date: reportDate,
        doctorsVisited: 0,
        doctorNames: [],
        productsDiscussed: [],
        samplesGiven: [],
        giftsGiven: [],
        station: report.workingStation ?? "",
        workingMode: report.workType ?? "",
      };

      existing.doctorsVisited += report.doctorsVisited?.length ?? 0;
      byDate.set(reportDate, existing);
    }

    return Array.from(byDate.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  } catch {
    return [];
  }
}
