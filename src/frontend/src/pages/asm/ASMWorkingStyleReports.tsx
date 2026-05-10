/**
 * ASM Working Style Reports — view working style entries for all MRs
 * under the ASM's reporting hierarchy.
 * Includes Working Type filter, summary counts, and Excel export.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, RefreshCw, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Role } from "../../backend";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { useCompanyProfile } from "../../hooks/useCompanyProfile";
import { api } from "../../lib/api";
import { buildBrandingExcelRows } from "../../lib/brandingHtml";
import { useAuthStore } from "../../store/authStore";

const WORKING_TYPES = [
  "Working",
  "Meeting",
  "Training",
  "Transit",
  "CME/Camp/Doctor Meet",
  "Admin Work",
] as const;

interface WorkingStyleEntry {
  userId: bigint;
  userName: string;
  date: string;
  workingMode: string;
  station: string;
  workingWith?: string;
  workingType?: string;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
function thirtyDaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

export default function ASMWorkingStyleReports() {
  const { session } = useAuthStore();
  const token = session?.token ?? "";
  const { companyProfile } = useCompanyProfile();

  const [fromDate, setFromDate] = useState(thirtyDaysAgo());
  const [toDate, setToDate] = useState(today());
  const [mrFilter, setMrFilter] = useState<string>("All");
  const [entries, setEntries] = useState<WorkingStyleEntry[]>([]);
  const [mrNames, setMrNames] = useState<Array<{ id: bigint; name: string }>>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [workingTypeFilter, setWorkingTypeFilter] = useState<string>("All");

  useEffect(() => {
    if (token) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      // ASM fetches their direct reportees
      const reportees = await api.listReportees(
        token,
        session?.userId ?? BigInt(0),
      );
      const rawApi = api as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;

      const allEntries: WorkingStyleEntry[] = [];
      const mrList: Array<{ id: bigint; name: string }> = [];

      for (const mr of reportees) {
        mrList.push({ id: mr.id, name: mr.name });
        if (typeof rawApi.listWorkingStyleEntries === "function") {
          try {
            const res = (await rawApi.listWorkingStyleEntries(
              token,
              mr.id,
              fromDate,
              toDate,
            )) as
              | {
                  __kind__: "ok";
                  ok: Array<{
                    date: string;
                    workingMode: string;
                    station: string;
                    workingWith?: string;
                    workingType?: string;
                  }>;
                }
              | { __kind__: "err"; err: string }
              | Array<{
                  date: string;
                  workingMode: string;
                  station: string;
                  workingWith?: string;
                  workingType?: string;
                }>;
            const items = Array.isArray(res)
              ? res
              : res.__kind__ === "ok"
                ? res.ok
                : [];
            for (const item of items) {
              allEntries.push({
                userId: mr.id,
                userName: mr.name,
                date: item.date,
                workingMode: item.workingMode || "—",
                station: item.station || "—",
                workingWith: item.workingWith,
                workingType: item.workingType,
              });
            }
          } catch {
            // skip this MR
          }
        }
      }

      allEntries.sort((a, b) => b.date.localeCompare(a.date));
      setEntries(allEntries);
      setMrNames(mrList);
      setHasFetched(true);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let result = entries;
    if (mrFilter !== "All") {
      result = result.filter((e) => e.userName === mrFilter);
    }
    if (workingTypeFilter !== "All") {
      result = result.filter((e) => e.workingType === workingTypeFilter);
    }
    return result;
  }, [entries, mrFilter, workingTypeFilter]);

  // Summary breakdown counts (based on MR-filtered but not type-filtered set)
  const baseForCounts = useMemo(() => {
    if (mrFilter === "All") return entries;
    return entries.filter((e) => e.userName === mrFilter);
  }, [entries, mrFilter]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const wt of WORKING_TYPES) {
      counts[wt] = baseForCounts.filter((e) => e.workingType === wt).length;
    }
    counts.Unspecified = baseForCounts.filter((e) => !e.workingType).length;
    return counts;
  }, [baseForCounts]);

  const handleExport = () => {
    const brandingRows = buildBrandingExcelRows(companyProfile ?? null);
    const dataRows = filtered.map((e) => ({
      "MR Name": e.userName,
      Date: e.date,
      "Working Mode": e.workingMode,
      "Working Type": e.workingType || "—",
      Station: e.station,
      "Working With": e.workingWith || "Alone",
    }));
    const wb = XLSX.utils.book_new();
    const allRows = [
      ...brandingRows.map((r) => ({ "MR Name": r[""] ?? "" })),
      {
        "MR Name": `ASM Working Style Reports — ${fromDate} to ${toDate}${workingTypeFilter !== "All" ? ` — ${workingTypeFilter}` : ""}`,
      },
      { "MR Name": "" },
      {
        "MR Name": "MR Name",
        Date: "Date",
        "Working Mode": "Working Mode",
        "Working Type": "Working Type",
        Station: "Station",
        "Working With": "Working With",
      },
      ...dataRows,
      { "MR Name": "Krishkar Pharmaceuticals : Empowering Health" },
    ];
    const ws = XLSX.utils.json_to_sheet(allRows, { skipHeader: true });
    XLSX.utils.book_append_sheet(wb, ws, "Working Style");
    XLSX.writeFile(wb, `asm-working-style-${fromDate}-${toDate}.xlsx`);
  };

  return (
    <PortalLayout portalRole={Role.ASM}>
      <PageHeader
        title="Working Style Reports"
        subtitle="View daily working mode entries for your MRs"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={entries.length === 0}
            data-ocid="asm-ws.export_button"
          >
            <Download className="w-4 h-4 mr-1.5" /> Export Excel
          </Button>
        }
      />
      <PageContent>
        {/* Filters row */}
        <div className="bg-card border border-border rounded-lg p-4 mb-5 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[140px]">
            <label
              htmlFor="asm-ws-from"
              className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5"
            >
              From Date
            </label>
            <Input
              id="asm-ws-from"
              type="date"
              value={fromDate}
              max={toDate}
              onChange={(e) => setFromDate(e.target.value)}
              data-ocid="asm-ws.from-date"
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label
              htmlFor="asm-ws-to"
              className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5"
            >
              To Date
            </label>
            <Input
              id="asm-ws-to"
              type="date"
              value={toDate}
              min={fromDate}
              max={today()}
              onChange={(e) => setToDate(e.target.value)}
              data-ocid="asm-ws.to-date"
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label
              htmlFor="asm-ws-mr"
              className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5"
            >
              MR
            </label>
            <select
              id="asm-ws-mr"
              value={mrFilter}
              onChange={(e) => setMrFilter(e.target.value)}
              className="w-full h-10 px-3 border border-input bg-card rounded-md text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-ocid="asm-ws.mr-filter"
            >
              <option value="All">All MRs</option>
              {mrNames.map((mr) => (
                <option key={String(mr.id)} value={mr.name}>
                  {mr.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label
              htmlFor="asm-ws-type"
              className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5"
            >
              Working Type
            </label>
            <select
              id="asm-ws-type"
              value={workingTypeFilter}
              onChange={(e) => setWorkingTypeFilter(e.target.value)}
              className="w-full h-10 px-3 border border-input bg-card rounded-md text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-ocid="asm-ws.type-filter"
            >
              <option value="All">All Types</option>
              {WORKING_TYPES.map((wt) => (
                <option key={wt} value={wt}>
                  {wt}
                </option>
              ))}
            </select>
          </div>
          <Button
            onClick={fetchData}
            disabled={loading}
            data-ocid="asm-ws.load_button"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Loading…
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" /> Load Reports
              </>
            )}
          </Button>
        </div>

        {/* Working Type breakdown */}
        {hasFetched && !loading && baseForCounts.length > 0 && (
          <div className="bg-card border border-border rounded-lg p-4 mb-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Working Type Breakdown
            </p>
            <div className="flex flex-wrap gap-2">
              {WORKING_TYPES.map((wt) => (
                <button
                  key={wt}
                  type="button"
                  onClick={() =>
                    setWorkingTypeFilter(workingTypeFilter === wt ? "All" : wt)
                  }
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    workingTypeFilter === wt
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  }`}
                  data-ocid={`asm-ws.type-badge.${wt.toLowerCase().replace(/\W+/g, "-")}`}
                >
                  {wt}: <span className="font-bold">{typeCounts[wt] ?? 0}</span>
                </button>
              ))}
              {(typeCounts.Unspecified ?? 0) > 0 && (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-muted/30 text-muted-foreground">
                  Unspecified: {typeCounts.Unspecified}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Summary stats */}
        {hasFetched && !loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <p className="text-2xl font-bold font-display text-foreground">
                {filtered.length}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {workingTypeFilter === "All"
                  ? "Total Entries"
                  : workingTypeFilter}
              </p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <p className="text-2xl font-bold font-display text-foreground">
                {new Set(filtered.map((e) => String(e.userId))).size}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Active MRs</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <p className="text-2xl font-bold font-display text-foreground">
                {
                  filtered.filter((e) =>
                    e.workingMode?.toLowerCase().includes("alone"),
                  ).length
                }
              </p>
              <p className="text-xs text-muted-foreground mt-1">Solo Days</p>
            </div>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : hasFetched && filtered.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3"
            data-ocid="asm-ws.empty_state"
          >
            <TrendingUp className="w-10 h-10 opacity-30" />
            <p className="text-sm font-medium">
              No working style entries found
              {workingTypeFilter !== "All" ? ` for "${workingTypeFilter}"` : ""}
              .
            </p>
          </div>
        ) : hasFetched ? (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-ocid="asm-ws.table">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    {[
                      "MR Name",
                      "Date",
                      "Working Mode",
                      "Working Type",
                      "Station",
                      "Working With",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((e, idx) => (
                    <tr
                      key={`${String(e.userId)}-${e.date}-${idx}`}
                      className="hover:bg-muted/20"
                      data-ocid={`asm-ws.item.${idx + 1}`}
                    >
                      <td className="px-4 py-3 font-medium text-foreground">
                        {e.userName}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-foreground">
                        {e.date}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs">
                          {e.workingMode}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {e.workingType ? (
                          <Badge
                            variant="secondary"
                            className="text-xs whitespace-nowrap"
                          >
                            {e.workingType}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground/50 text-xs">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {e.station}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {e.workingWith || "Alone"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            <TrendingUp className="w-10 h-10 opacity-30" />
            <p className="text-sm">
              Select a date range and click "Load Reports" to view working style
              entries.
            </p>
          </div>
        )}
      </PageContent>
    </PortalLayout>
  );
}
