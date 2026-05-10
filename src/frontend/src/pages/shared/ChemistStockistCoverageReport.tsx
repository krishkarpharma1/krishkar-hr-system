/**
 * ChemistStockistCoverageReport — Phase 2 SFA
 * Tabbed: Chemist Coverage | Stockist Coverage
 * Accessible to ASM, RSM, ZSM, Admin.
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Download,
  Filter,
  Printer,
  RefreshCw,
  ShoppingCart,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Role } from "../../backend";
import { Role as RoleEnum } from "../../backend";
import type { CoverageRow } from "../../backend.d";
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

interface ChemistStockistCoverageReportProps {
  portalRole?: Role;
}

export default function ChemistStockistCoverageReport({
  portalRole = RoleEnum.ASM,
}: ChemistStockistCoverageReportProps) {
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
  const [chemistRows, setChemistRows] = useState<CoverageRow[]>([]);
  const [stockistRows, setStockistRows] = useState<CoverageRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"chemist" | "stockist">("chemist");

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
      let mrIds: bigint[] = [];
      if (selectedMrId) {
        mrIds = [BigInt(selectedMrId)];
      } else {
        mrIds = mrList.map((m) => m.id);
      }

      if (mrIds.length === 0) {
        setChemistRows([]);
        setStockistRows([]);
        return;
      }

      const coverage = await api.getChemistStockistCoverage(
        token,
        mrIds,
        fromDate,
        toDate,
      );
      setChemistRows(coverage.chemistCoverage);
      setStockistRows(coverage.stockistCoverage);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setLoading(false);
    }
  }, [token, fromDate, toDate, selectedMrId, mrList]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // coverage summary computed inside renderTable

  const exportPdf = (kind: "chemist" | "stockist") => {
    const brandingHtml = buildBrandingHtml(companyProfile ?? null);
    const rows = (kind === "chemist" ? chemistRows : stockistRows)
      .map(
        (r) => `<tr>
          <td>${r.mrName}</td>
          <td>${r.station}</td>
          <td>${r.area}</td>
          <td style="text-align:right">${Number(kind === "chemist" ? r.chemistVisits : r.stockistVisits)}</td>
          <td>${r.period || "—"}</td>
        </tr>`,
      )
      .join("");
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
      <title>${kind === "chemist" ? "Chemist" : "Stockist"} Coverage</title>
      ${brandingHtml}
      <style>
        h3{margin:10px 0 6px;font-size:14px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th{background:#0284c7;color:#fff;padding:7px 8px;text-align:left}
        td{padding:6px 8px;border-bottom:1px solid #eee}
      </style></head><body>
      <h3>${kind === "chemist" ? "Chemist" : "Stockist"} Coverage Report — ${formatDate(fromDate)} to ${formatDate(toDate)}</h3>
      <table><thead><tr>
        <th>MR Name</th><th>Station</th><th>Area</th><th style="text-align:right">Visits</th><th>Period</th>
      </tr></thead><tbody>${rows}</tbody></table></body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
  };

  const exportExcel = () => {
    const rows = activeTab === "chemist" ? chemistRows : stockistRows;
    if (rows.length === 0) {
      toast.info("No data to export.");
      return;
    }
    const brandingRows = buildBrandingExcelRows(companyProfile ?? null).map(
      (r) => {
        const val = Object.values(r)[0] ?? "";
        return [val, "", "", "", ""] as string[];
      },
    );
    const header = ["MR Name", "Station", "Area", "Total Visits", "Period"];
    const dataRows = rows.map((r) => [
      r.mrName,
      r.station,
      r.area,
      String(
        Number(activeTab === "chemist" ? r.chemistVisits : r.stockistVisits),
      ),
      r.period || "",
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
    a.download = `${activeTab}-coverage-${fromDate}-to-${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported successfully");
  };

  const renderTable = (rows: CoverageRow[], kind: "chemist" | "stockist") => {
    if (loading)
      return (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      );
    if (rows.length === 0)
      return (
        <div
          className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3"
          data-ocid={`${kind}-coverage.empty_state`}
        >
          <ShoppingCart className="w-10 h-10 opacity-20" />
          <p className="text-sm">
            No {kind} visits found for the selected period.
          </p>
        </div>
      );
    const summary = {
      totalVisits: rows.reduce(
        (s, r) =>
          s + Number(kind === "chemist" ? r.chemistVisits : r.stockistVisits),
        0,
      ),
      uniqueStations: new Set(rows.map((r) => r.station)).size,
    };
    return (
      <>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { label: "Total Visits", value: summary.totalVisits },
            { label: "Unique Stations", value: summary.uniqueStations },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="bg-card border border-border rounded-lg p-3"
            >
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="font-display font-bold text-xl text-foreground">
                {value}
              </p>
            </div>
          ))}
        </div>
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/20 flex justify-between">
            <h3 className="font-display font-semibold text-sm text-foreground capitalize">
              {kind} Coverage
            </h3>
            <span className="text-xs text-muted-foreground">
              {rows.length} rows
            </span>
          </div>
          <ScrollableTable>
            <table
              className="w-full text-sm"
              data-ocid={`${kind}-coverage.table`}
            >
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["MR Name", "Station", "Area", "Total Visits", "Period"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={`${String(r.mrId)}-${r.station}-${i}`}
                    className="border-b border-border/50 hover:bg-muted/20"
                    data-ocid={`${kind}-coverage.item.${i + 1}`}
                  >
                    <td className="px-3 py-2.5 font-medium text-foreground">
                      {r.mrName}
                    </td>
                    <td className="px-3 py-2.5 text-sm">{r.station}</td>
                    <td className="px-3 py-2.5 text-sm text-muted-foreground">
                      {r.area}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold font-mono text-primary">
                      {Number(
                        kind === "chemist" ? r.chemistVisits : r.stockistVisits,
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {r.period || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableTable>
        </div>
      </>
    );
  };

  return (
    <PortalLayout portalRole={portalRole}>
      <PageHeader
        title="Chemist & Stockist Coverage Report"
        subtitle="Total visits per MR broken down by station and date range"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportPdf(activeTab)}
              className="gap-1.5"
              data-ocid="chemist-stockist.print_button"
            >
              <Printer className="w-4 h-4" /> Print PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportExcel}
              className="gap-1.5"
              data-ocid="chemist-stockist.export_button"
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
                data-ocid="chemist-stockist.from_date"
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
                data-ocid="chemist-stockist.to_date"
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
                  data-ocid="chemist-stockist.mr_select"
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
              data-ocid="chemist-stockist.apply_button"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Apply
            </Button>
          </div>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "chemist" | "stockist")}
        >
          <TabsList className="mb-4">
            <TabsTrigger
              value="chemist"
              data-ocid="chemist-stockist.chemist_tab"
            >
              Chemist Coverage
            </TabsTrigger>
            <TabsTrigger
              value="stockist"
              data-ocid="chemist-stockist.stockist_tab"
            >
              Stockist Coverage
            </TabsTrigger>
          </TabsList>
          <TabsContent value="chemist">
            {renderTable(chemistRows, "chemist")}
          </TabsContent>
          <TabsContent value="stockist">
            {renderTable(stockistRows, "stockist")}
          </TabsContent>
        </Tabs>
      </PageContent>
    </PortalLayout>
  );
}
