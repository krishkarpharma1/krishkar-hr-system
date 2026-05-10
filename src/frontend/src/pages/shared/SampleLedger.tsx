import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Download,
  FileText,
  Package,
  RefreshCw,
  TrendingDown,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Role } from "../../backend";
import {
  DataTable,
  PageContent,
  PageHeader,
  PortalLayout,
  SectionCard,
} from "../../components/PortalLayout";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";

interface LedgerRow {
  productName: string;
  batchNumber: string;
  issuedQty: number;
  returnedQty: number;
  netBalance: number;
  month: string;
  mrName?: string;
  mrId?: string;
  isOverdue?: boolean;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  label: new Date(2024, i, 1).toLocaleString("en-IN", { month: "long" }),
  value: String(i + 1),
}));
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 3 }, (_, i) => String(CURRENT_YEAR - i));

export default function SampleLedger({ portalRole }: { portalRole?: string }) {
  const { session } = useAuthStore();
  const isManager =
    session?.role === Role.Admin ||
    session?.role === Role.HRManager ||
    session?.role === Role.RSM ||
    session?.role === Role.ASM ||
    session?.role === Role.ZSM;
  const effectiveRole = portalRole ?? session?.role ?? "MR";

  const [activeTab, setActiveTab] = useState<"my" | "consolidated">(
    isManager ? "consolidated" : "my",
  );
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterMonth, setFilterMonth] = useState(
    String(new Date().getMonth() + 1),
  );
  const [filterYear, setFilterYear] = useState(String(CURRENT_YEAR));
  const [filterProduct, setFilterProduct] = useState("all");
  const [filterMr, setFilterMr] = useState("all");
  const [mrList, setMrList] = useState<Array<{ id: string; name: string }>>([]);
  const [productList, setProductList] = useState<string[]>([]);
  const [summary, setSummary] = useState({ totalUnits: 0, totalProducts: 0 });

  const loadData = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const month = Number(filterMonth);
      const year = Number(filterYear);
      const mrId =
        activeTab === "my"
          ? (session.userId as unknown as bigint)
          : filterMr !== "all"
            ? BigInt(filterMr)
            : undefined;

      let raw: LedgerRow[] = [];

      if (activeTab === "my") {
        const balances = await api.getMyBalance(session.token, month, year);
        raw = balances.map((b) => ({
          productName: String(b.productName ?? ""),
          batchNumber: "-",
          issuedQty: Number(b.allocatedQty ?? 0),
          returnedQty: Number(
            (b as unknown as Record<string, unknown>).returnedQty ?? 0,
          ),
          netBalance: Number(b.remainingQty ?? 0),
          month: `${filterMonth}/${filterYear}`,
          isOverdue: false,
        }));
      } else {
        // Consolidated — use team balances
        const teamMrs = mrList.map((m) => BigInt(m.id));
        if (teamMrs.length > 0) {
          const balances = await api.getTeamSampleBalances(
            session.token,
            mrId ? [BigInt(String(mrId))] : teamMrs,
            month,
            year,
          );
          raw = balances.map((b) => ({
            productName: String(
              (b as unknown as Record<string, unknown>).productName ?? "",
            ),
            batchNumber: "-",
            issuedQty: Number(
              (b as unknown as Record<string, unknown>).allocatedQty ?? 0,
            ),
            returnedQty: Number(
              (b as unknown as Record<string, unknown>).returnedQty ?? 0,
            ),
            netBalance: Number(
              (b as unknown as Record<string, unknown>).remainingQty ?? 0,
            ),
            month: `${filterMonth}/${filterYear}`,
            mrId: String((b as unknown as Record<string, unknown>).mrId ?? ""),
          }));
        }
      }

      if (filterProduct !== "all") {
        raw = raw.filter((r) => r.productName === filterProduct);
      }

      setRows(raw);
      setProductList([...new Set(raw.map((r) => r.productName))]);
      setSummary({
        totalUnits: raw.reduce((s, r) => s + r.netBalance, 0),
        totalProducts: new Set(raw.map((r) => r.productName)).size,
      });
    } catch (err) {
      toast.error(String(err));
    } finally {
      setLoading(false);
    }
  }, [
    session,
    activeTab,
    filterMonth,
    filterYear,
    filterProduct,
    filterMr,
    mrList,
  ]);

  useEffect(() => {
    if (!session || !isManager) return;
    api
      .listUsersByRole(session.token, Role.MR)
      .then((users) => {
        const u = users as Array<{ id: bigint; name: string }>;
        setMrList(u.map((x) => ({ id: String(x.id), name: x.name })));
      })
      .catch(() => {});
  }, [session, isManager]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleExport() {
    if (rows.length === 0) {
      toast.warning("No data to export");
      return;
    }
    const ws = XLSX.utils.json_to_sheet(
      rows.map((r) => ({
        Product: r.productName,
        Batch: r.batchNumber,
        "Issued Qty": r.issuedQty,
        "Returned Qty": r.returnedQty,
        "Net Balance": r.netBalance,
        Month: r.month,
        ...(r.mrId ? { "MR ID": r.mrId } : {}),
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sample Ledger");
    XLSX.writeFile(wb, `sample-ledger-${filterYear}-${filterMonth}.xlsx`);
    toast.success("Exported successfully");
  }

  const balanceCols = [
    { key: "product", label: "Product" },
    { key: "batch", label: "Batch" },
    { key: "issued", label: "Issued Qty" },
    { key: "returned", label: "Returned Qty" },
    { key: "balance", label: "Net Balance" },
    { key: "month", label: "Month" },
    ...(isManager && activeTab === "consolidated"
      ? [{ key: "mr", label: "MR ID" }]
      : []),
  ];

  return (
    <PortalLayout portalRole={effectiveRole as typeof Role.MR}>
      <PageHeader
        title="Sample Ledger"
        subtitle="View sample issuance, returns, and net balance"
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            data-ocid="sample-ledger.export-button"
          >
            <Download className="w-4 h-4 mr-1.5" /> Export Excel
          </Button>
        }
      />
      <PageContent>
        {/* Summary card */}
        <div
          className="bg-card border border-border rounded-lg px-5 py-4 mb-5 flex items-center gap-4"
          data-ocid="sample-ledger.summary-card"
        >
          <Package className="w-6 h-6 text-primary" />
          <div>
            <p className="text-sm text-muted-foreground font-body">
              Current Sample Balance
            </p>
            <p className="text-xl font-bold font-display text-foreground">
              {summary.totalUnits} units across {summary.totalProducts} product
              {summary.totalProducts !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Tabs */}
        {isManager && (
          <div className="flex gap-0 border-b border-border mb-5">
            {(["my", "consolidated"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setActiveTab(t)}
                className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === t
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                data-ocid={`sample-ledger.tab-${t}`}
              >
                {t === "my" ? "My Ledger" : "Consolidated (All MRs)"}
              </button>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="bg-card border border-border rounded-lg p-4 mb-5 flex flex-wrap gap-3 items-end">
          <div>
            <p className="text-xs text-muted-foreground mb-1 uppercase font-display tracking-wide">
              Month
            </p>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger
                className="w-[130px] h-9"
                data-ocid="sample-ledger.filter-month"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1 uppercase font-display tracking-wide">
              Year
            </p>
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger
                className="w-[100px] h-9"
                data-ocid="sample-ledger.filter-year"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {productList.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1 uppercase font-display tracking-wide">
                Product
              </p>
              <Select value={filterProduct} onValueChange={setFilterProduct}>
                <SelectTrigger
                  className="w-[160px] h-9"
                  data-ocid="sample-ledger.filter-product"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  {productList.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {isManager && activeTab === "consolidated" && mrList.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1 uppercase font-display tracking-wide">
                MR
              </p>
              <Select value={filterMr} onValueChange={setFilterMr}>
                <SelectTrigger
                  className="w-[160px] h-9"
                  data-ocid="sample-ledger.filter-mr"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All MRs</SelectItem>
                  {mrList.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button
            size="sm"
            className="h-9 self-end"
            onClick={loadData}
            disabled={loading}
            data-ocid="sample-ledger.refresh-button"
          >
            <RefreshCw
              className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="space-y-2" data-ocid="sample-ledger.loading-state">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-16 text-center"
            data-ocid="sample-ledger.empty-state"
          >
            <TrendingDown className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm">
              No sample ledger records found for the selected filters.
            </p>
          </div>
        ) : (
          <DataTable
            columns={balanceCols}
            data={rows}
            getKey={(r) => `${r.productName}-${r.batchNumber}`}
            loading={false}
            emptyMessage="No sample ledger records found"
            renderRow={(r) => (
              <>
                <td className="px-4 py-3 text-sm font-body text-foreground">
                  {r.productName}
                </td>
                <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                  {r.batchNumber}
                </td>
                <td className="px-4 py-3 text-sm text-right">{r.issuedQty}</td>
                <td className="px-4 py-3 text-sm text-right">
                  {r.returnedQty}
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={`text-sm font-bold ${
                      r.netBalance > 0
                        ? "text-emerald-600"
                        : r.netBalance === 0
                          ? "text-muted-foreground"
                          : "text-destructive"
                    }`}
                  >
                    {r.netBalance}
                  </span>
                  {r.isOverdue && (
                    <Badge
                      variant="outline"
                      className="ml-2 text-[10px] border-amber-300 text-amber-600"
                    >
                      Overdue
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                  {r.month}
                </td>
                {isManager && activeTab === "consolidated" && (
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                    {r.mrId ?? "—"}
                  </td>
                )}
              </>
            )}
          />
        )}
      </PageContent>
    </PortalLayout>
  );
}
