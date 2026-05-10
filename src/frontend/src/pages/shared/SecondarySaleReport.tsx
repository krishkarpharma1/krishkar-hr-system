/**
 * Secondary Sale Report — HR and Admin portals.
 * Filterable, exportable Excel report for all secondary sale entries.
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Filter, RefreshCw, ShoppingBag } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { buildBrandingExcelRows } from "../../lib/brandingHtml";
import { useAuthStore } from "../../store/authStore";
import type {
  SecondarySaleRecord,
  StockistRecord,
  UserInfo,
} from "../../types";
import { formatDate } from "../../utils/dateFormatter";

interface SecondarySaleReportProps {
  portalRole?: Role;
}

export default function SecondarySaleReport({
  portalRole = Role.HRManager,
}: SecondarySaleReportProps) {
  const { session } = useAuthStore();
  const token = session?.token ?? "";
  const { companyProfile } = useCompanyProfile();

  const [entries, setEntries] = useState<SecondarySaleRecord[]>([]);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [stockists, setStockists] = useState<StockistRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterEmployee, setFilterEmployee] = useState("");
  const [filterStockist, setFilterStockist] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      api.listSecondarySales(token, {
        fromDate: filterFrom
          ? BigInt(new Date(filterFrom).getTime()) * 1_000_000n
          : undefined,
        toDate: filterTo
          ? BigInt(new Date(`${filterTo}T23:59:59`).getTime()) * 1_000_000n
          : undefined,
      }),
      api.listAllUsers(token),
      api.listStockists(token, {}).catch(() => [] as StockistRecord[]),
    ])
      .then(([sales, u, s]) => {
        setEntries(sales);
        setUsers(u);
        setStockists(s);
      })
      .catch((e) => toast.error(String(e)))
      .finally(() => setLoading(false));
  }, [token, filterFrom, filterTo]);

  useEffect(() => {
    load();
  }, [load]);

  const userMap = useMemo(
    () => new Map(users.map((u) => [u.id.toString(), u])),
    [users],
  );
  const stockistMap = useMemo(
    () => new Map(stockists.map((s) => [s.id.toString(), s])),
    [stockists],
  );

  const filtered = useMemo(() => {
    let list = entries;
    if (filterEmployee) {
      list = list.filter((e) => {
        const u = userMap.get(e.submittedBy.toString());
        return u?.name.toLowerCase().includes(filterEmployee.toLowerCase());
      });
    }
    if (filterStockist) {
      list = list.filter((e) => {
        const s = stockistMap.get(e.stockistId.toString());
        return s?.name.toLowerCase().includes(filterStockist.toLowerCase());
      });
    }
    return list;
  }, [entries, filterEmployee, filterStockist, userMap, stockistMap]);

  const totalValue = filtered.reduce((sum, e) => sum + e.totalNetSaleValue, 0);

  function exportExcel() {
    if (filtered.length === 0) {
      toast.info("No data to export.");
      return;
    }
    const COLS = 5;
    const brandingRows = buildBrandingExcelRows(companyProfile ?? null).map(
      (r) => {
        const val = Object.values(r)[0] ?? "";
        return [val, ...Array(COLS - 1).fill("")] as string[];
      },
    );
    const dataRows: string[][] = [
      ["Date", "Employee", "Stockist", "Products", "Total Net Sale Value (₹)"],
      ...filtered.flatMap((e) =>
        e.products.map((p, i) => [
          i === 0 ? formatDate(new Date(Number(e.saleDate) / 1_000_000)) : "",
          i === 0
            ? (stockistMap.get(e.stockistId.toString())?.name ??
              e.stockistId.toString())
            : "",
          `${p.productName} (Qty: ${p.quantitySold})`,
          i === 0 ? e.totalNetSaleValue.toLocaleString("en-IN") : "",
        ]),
      ),
      ["", "", "", "TOTAL", totalValue.toLocaleString("en-IN")],
    ];
    const rows = [...brandingRows, ...dataRows];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `secondary-sale-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported successfully");
  }

  return (
    <PortalLayout portalRole={portalRole}>
      <PageHeader
        title="Secondary Sale Report"
        subtitle="Stockist-wise secondary sale entries across all territories"
        actions={
          <Button
            variant="outline"
            onClick={exportExcel}
            className="gap-2"
            data-ocid="btn-export-secondary-sale"
          >
            <Download className="w-4 h-4" /> Export Excel
          </Button>
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs mb-1 block text-muted-foreground">
                Employee Name
              </Label>
              <Input
                placeholder="Filter by employee"
                value={filterEmployee}
                onChange={(e) => setFilterEmployee(e.target.value)}
                className="h-9"
                data-ocid="filter-employee"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block text-muted-foreground">
                Stockist Name
              </Label>
              <Input
                placeholder="Filter by stockist"
                value={filterStockist}
                onChange={(e) => setFilterStockist(e.target.value)}
                className="h-9"
                data-ocid="filter-stockist"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block text-muted-foreground">
                From Date
              </Label>
              <Input
                type="date"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
                className="h-9"
                data-ocid="filter-from"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block text-muted-foreground">
                To Date
              </Label>
              <Input
                type="date"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
                className="h-9"
                data-ocid="filter-to"
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              onClick={load}
              className="gap-1.5"
              data-ocid="btn-apply-filters"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Apply Filters
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setFilterEmployee("");
                setFilterStockist("");
                setFilterFrom("");
                setFilterTo("");
              }}
              data-ocid="btn-clear-filters"
            >
              Clear
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3"
            data-ocid="secondary-sale-report-empty"
          >
            <ShoppingBag className="w-10 h-10 opacity-20" />
            <p className="text-sm">
              No secondary sale records found for the selected filters.
            </p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <ScrollableTable>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {[
                      "Date",
                      "Employee",
                      "Stockist",
                      "Product",
                      "Qty",
                      "MRP (₹)",
                      "PTS (₹)",
                      "PTR (₹)",
                      "Net Sale Value (₹)",
                    ].map((h, i) => (
                      <th
                        key={h}
                        className={`px-3 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground ${i > 3 ? "text-right" : "text-left"}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.flatMap((e) =>
                    e.products.map((p, pi) => {
                      const user = userMap.get(e.submittedBy.toString());
                      const stockist = stockistMap.get(e.stockistId.toString());
                      return (
                        <tr
                          key={`${e.id}-${pi}`}
                          className="border-b border-border/50 hover:bg-muted/20"
                        >
                          <td className="px-3 py-2.5 font-mono text-xs">
                            {pi === 0
                              ? formatDate(
                                  new Date(Number(e.saleDate) / 1_000_000),
                                )
                              : ""}
                          </td>
                          <td className="px-3 py-2.5 text-sm">
                            {pi === 0
                              ? (user?.name ?? e.submittedBy.toString())
                              : ""}
                          </td>
                          <td className="px-3 py-2.5 text-sm">
                            {pi === 0
                              ? (stockist?.name ?? e.stockistId.toString())
                              : ""}
                          </td>
                          <td className="px-3 py-2.5 font-medium text-foreground">
                            {p.productName}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono">
                            {p.quantitySold.toString()}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono">
                            ₹{p.mrp}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono">
                            ₹{p.pts}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono">
                            ₹{p.ptr}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-semibold text-accent">
                            ₹{p.netSaleValue.toLocaleString("en-IN")}
                          </td>
                        </tr>
                      );
                    }),
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30 font-semibold border-t-2 border-border">
                    <td colSpan={8} className="px-3 py-3 text-sm text-right">
                      Total
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-accent">
                      ₹{totalValue.toLocaleString("en-IN")}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </ScrollableTable>
            <div className="px-4 py-3 border-t border-border bg-muted/10 text-xs text-muted-foreground">
              Showing {filtered.length} entries ·{" "}
              {filtered.reduce((n, e) => n + e.products.length, 0)} product
              lines
            </div>
          </div>
        )}
      </PageContent>
    </PortalLayout>
  );
}
