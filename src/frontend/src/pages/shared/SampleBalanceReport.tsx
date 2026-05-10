/**
 * SampleBalanceReport — Phase 2 SFA
 * MR: own balance  |  ASM/RSM/Admin: team view (filtered by MR)
 */
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Filter, Package, Printer, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Role } from "../../backend";
import { Role as RoleEnum } from "../../backend";
import type { SampleAllocationInfo, SampleBalanceView } from "../../backend.d";
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

interface MRBalanceGroup {
  mrId: string;
  mrName: string;
  balances: SampleBalanceView[];
}

interface SampleBalanceReportProps {
  portalRole?: Role;
}

export default function SampleBalanceReport({
  portalRole = RoleEnum.ASM,
}: SampleBalanceReportProps) {
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
  const [groups, setGroups] = useState<MRBalanceGroup[]>([]);
  const [loading, setLoading] = useState(false);

  // Load MR list for manager roles
  useEffect(() => {
    if (isMR || !token) return;
    setMrLoading(true);
    const isAdmin =
      portalRole === RoleEnum.Admin || portalRole === RoleEnum.HRManager;
    const fetchMrs = async () => {
      try {
        let mrs: UserInfo[] = [];
        if (isAdmin) {
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
  }, [token, userId, isMR, portalRole]);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      if (isMR) {
        const balances = await api.getMyBalance(token, month, year);
        setGroups([
          {
            mrId: String(userId),
            mrName: session?.name ?? "Me",
            balances,
          },
        ]);
      } else if (selectedMrId) {
        const allocs: SampleAllocationInfo[] = await api.getAllocationsForMR(
          token,
          BigInt(selectedMrId),
          month,
          year,
        );
        // Build a pseudo-balance from allocation info
        const balances: SampleBalanceView[] = allocs.map((a) => ({
          month: a.month,
          year: a.year,
          productId: a.productId,
          productCode: "",
          productName: a.productName,
          allocatedQty: a.allocatedQty,
          usedQty: a.usedQty,
          remainingQty: a.allocatedQty - a.usedQty,
        }));
        const mr = mrList.find((m) => String(m.id) === selectedMrId);
        setGroups([
          { mrId: selectedMrId, mrName: mr?.name ?? selectedMrId, balances },
        ]);
      } else {
        // Team view — all MRs
        const mrIds = mrList.map((m) => m.id);
        if (mrIds.length === 0) {
          setGroups([]);
          return;
        }
        const teamData = await api.getTeamSampleBalances(
          token,
          mrIds,
          month,
          year,
        );
        const newGroups: MRBalanceGroup[] = teamData.map(([mrId, bals]) => {
          const mr = mrList.find((m) => String(m.id) === String(mrId));
          return {
            mrId: String(mrId),
            mrName: mr?.name ?? String(mrId),
            balances: bals,
          };
        });
        setGroups(newGroups);
      }
    } catch (e) {
      toast.error(String(e));
    } finally {
      setLoading(false);
    }
  }, [token, isMR, userId, session, month, year, selectedMrId, mrList]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const rowBg = (b: SampleBalanceView) => {
    const rem = Number(b.remainingQty);
    const alloc = Number(b.allocatedQty);
    if (rem === 0) return "bg-destructive/10";
    if (alloc > 0 && rem / alloc < 0.1)
      return "bg-amber-50 dark:bg-amber-900/10";
    return "";
  };

  const exportPdf = () => {
    const brandingHtml = buildBrandingHtml(companyProfile ?? null);
    const monthLabel = `${String(month).padStart(2, "0")}-${year}`;
    const rows = groups
      .flatMap((g) =>
        g.balances.map(
          (b) => `
        <tr class="${Number(b.remainingQty) === 0 ? "zero" : Number(b.remainingQty) / Number(b.allocatedQty) < 0.1 ? "low" : ""}">
          <td>${g.mrName}</td>
          <td>${b.productName}</td>
          <td>${b.productCode || "—"}</td>
          <td style="text-align:right">${Number(b.allocatedQty)}</td>
          <td style="text-align:right">${Number(b.usedQty)}</td>
          <td style="text-align:right"><strong>${Number(b.remainingQty)}</strong></td>
        </tr>`,
        ),
      )
      .join("");

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
      <title>Sample Balance — ${monthLabel}</title>
      ${brandingHtml}
      <style>
        h3 { margin: 10px 0 6px; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { background: #0284c7; color: #fff; padding: 7px 8px; text-align: left; }
        td { padding: 6px 8px; border-bottom: 1px solid #eee; }
        .zero td { background: #fee2e2; }
        .low td { background: #fef3c7; }
        tr:nth-child(even) td { filter: brightness(0.97); }
      </style></head><body>
      <h3>Sample Balance Report — ${monthLabel}</h3>
      <table><thead><tr>
        <th>MR Name</th><th>Product</th><th>Code</th>
        <th style="text-align:right">Allocated</th>
        <th style="text-align:right">Used</th>
        <th style="text-align:right">Remaining</th>
      </tr></thead><tbody>${rows}</tbody></table>
      </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
  };

  const exportExcel = () => {
    if (groups.length === 0) {
      toast.info("No data to export.");
      return;
    }
    const brandingRows = buildBrandingExcelRows(companyProfile ?? null).map(
      (r) => {
        const val = Object.values(r)[0] ?? "";
        return [val, "", "", "", "", ""] as string[];
      },
    );
    const header = [
      "MR Name",
      "Product Name",
      "Product Code",
      "Allocated Qty",
      "Used Qty",
      "Remaining Qty",
    ];
    const dataRows = groups.flatMap((g) =>
      g.balances.map((b) => [
        g.mrName,
        b.productName,
        b.productCode || "",
        String(Number(b.allocatedQty)),
        String(Number(b.usedQty)),
        String(Number(b.remainingQty)),
      ]),
    );
    const csv = [...brandingRows, header, ...dataRows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sample-balance-${String(month).padStart(2, "0")}-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported successfully");
  };

  const allBalances = groups.flatMap((g) => g.balances);
  const totalAllocated = allBalances.reduce(
    (s, b) => s + Number(b.allocatedQty),
    0,
  );
  const totalUsed = allBalances.reduce((s, b) => s + Number(b.usedQty), 0);
  const totalRemaining = allBalances.reduce(
    (s, b) => s + Number(b.remainingQty),
    0,
  );

  return (
    <PortalLayout portalRole={portalRole}>
      <PageHeader
        title="Sample Balance Report"
        subtitle="Opening allocation, total given to date, and remaining balance per product"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportPdf}
              className="gap-1.5"
              data-ocid="sample-balance.print_button"
            >
              <Printer className="w-4 h-4" /> Print PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportExcel}
              className="gap-1.5"
              data-ocid="sample-balance.export_button"
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
              <Label className="text-xs mb-1 block text-muted-foreground">
                Month
              </Label>
              <select
                className="w-full h-9 border border-input bg-background px-3 text-sm rounded-md"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                data-ocid="sample-balance.month_select"
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
              <Label className="text-xs mb-1 block text-muted-foreground">
                Year
              </Label>
              <select
                className="w-full h-9 border border-input bg-background px-3 text-sm rounded-md"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                data-ocid="sample-balance.year_select"
              >
                {[year - 1, year, year + 1].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            {!isMR && (
              <div className="sm:col-span-2">
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
                    data-ocid="sample-balance.mr_select"
                  >
                    <option value="">— All MRs —</option>
                    {mrList.map((mr) => (
                      <option key={String(mr.id)} value={String(mr.id)}>
                        {mr.name} ({mr.employeeId})
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
              className="gap-1.5"
              data-ocid="sample-balance.apply_button"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Apply
            </Button>
          </div>
        </div>

        {/* Summary cards */}
        {!loading && allBalances.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: "Total Allocated", value: totalAllocated },
              { label: "Total Used", value: totalUsed },
              { label: "Total Remaining", value: totalRemaining },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="bg-card border border-border rounded-lg p-3 flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Package className="w-4 h-4 text-primary" />
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

        {/* Legend */}
        <div className="flex gap-4 text-xs text-muted-foreground mb-3">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-destructive/30 inline-block" />{" "}
            Out of stock
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-amber-200 inline-block" />{" "}
            Below 10%
          </span>
        </div>

        {/* Table */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : groups.length === 0 || allBalances.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3"
            data-ocid="sample-balance.empty_state"
          >
            <Package className="w-10 h-10 opacity-20" />
            <p className="text-sm">
              No sample balance data for the selected period.
            </p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/20">
              <h3 className="font-display font-semibold text-sm text-foreground">
                Sample Balances — {String(month).padStart(2, "0")}/{year}
              </h3>
            </div>
            <ScrollableTable>
              <table
                className="w-full text-sm"
                data-ocid="sample-balance.table"
              >
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {[
                      "MR Name",
                      "Product Name",
                      "Code",
                      "Allocated",
                      "Used",
                      "Remaining",
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
                  {groups.map((g, gi) =>
                    g.balances.map((b, bi) => (
                      <tr
                        key={`${g.mrId}-${String(b.productId)}-${gi}-${bi}`}
                        className={`border-b border-border/50 hover:bg-muted/20 ${rowBg(b)}`}
                        data-ocid={`sample-balance.item.${gi * 100 + bi + 1}`}
                      >
                        <td className="px-3 py-2.5 text-sm font-medium text-foreground">
                          {g.mrName}
                        </td>
                        <td className="px-3 py-2.5 text-sm text-foreground">
                          {b.productName}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono">
                          {b.productCode || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-sm">
                          {Number(b.allocatedQty)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-sm">
                          {Number(b.usedQty)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-sm font-bold">
                          <span
                            className={
                              Number(b.remainingQty) === 0
                                ? "text-destructive"
                                : Number(b.remainingQty) /
                                      Number(b.allocatedQty) <
                                    0.1
                                  ? "text-amber-600"
                                  : "text-foreground"
                            }
                          >
                            {Number(b.remainingQty)}
                          </span>
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-primary/5 border-t-2 border-primary/20 font-semibold">
                    <td className="px-3 py-3 text-sm" colSpan={3}>
                      TOTAL
                    </td>
                    <td className="px-3 py-3 text-right text-sm font-mono text-primary">
                      {totalAllocated}
                    </td>
                    <td className="px-3 py-3 text-right text-sm font-mono text-primary">
                      {totalUsed}
                    </td>
                    <td className="px-3 py-3 text-right text-sm font-mono font-bold text-primary">
                      {totalRemaining}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </ScrollableTable>
          </div>
        )}
      </PageContent>
    </PortalLayout>
  );
}
