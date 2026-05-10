/**
 * Secondary Sale page for MR portal.
 * Allows MRs to submit stockist-wise secondary sale entries.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Eye,
  Loader2,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Role } from "../../backend";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import type {
  PricelistProductInfo,
  ProductInfo,
  SecondarySaleRecord,
  StockistRecord,
} from "../../types";

interface ProductRow {
  productId: string;
  productName: string;
  quantitySold: string;
  mrp: number;
  pts: number;
  ptr: number;
}

function emptyRow(): ProductRow {
  return {
    productId: "",
    productName: "",
    quantitySold: "",
    mrp: 0,
    pts: 0,
    ptr: 0,
  };
}

function calcNetSaleValue(row: ProductRow): number {
  const qty = Number(row.quantitySold) || 0;
  return qty * row.pts;
}

interface SecondarySalePageProps {
  portalRole?: Role;
}

export default function SecondarySale({
  portalRole = Role.MR,
}: SecondarySalePageProps) {
  const { session } = useAuthStore();
  const token = session?.token ?? "";
  const userId = session?.userId ?? BigInt(0);

  const [entries, setEntries] = useState<SecondarySaleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [viewEntry, setViewEntry] = useState<SecondarySaleRecord | null>(null);

  // Form state
  const [saleDate, setSaleDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [stockists, setStockists] = useState<StockistRecord[]>([]);
  const [stockistSearch, setStockistSearch] = useState("");
  const [selectedStockistId, setSelectedStockistId] = useState<string>("");
  const [products, setProducts] = useState<ProductInfo[]>([]);
  const [pricelist, setPricelist] = useState<PricelistProductInfo[]>([]);
  const [rows, setRows] = useState<ProductRow[]>([emptyRow()]);
  const [dataLoading, setDataLoading] = useState(false);

  // Load existing entries
  useEffect(() => {
    if (!token) return;
    api
      .getSecondarySalesByEmployee(token, userId)
      .then((data) => setEntries([...data].reverse()))
      .finally(() => setLoading(false));
  }, [token, userId]);

  // Load products + pricelist + stockists when form opens
  useEffect(() => {
    if (!showForm || !token) return;
    setDataLoading(true);
    Promise.all([
      api.listProducts(),
      api.listPricelistProducts(token),
      api.getUserLocationAllotment(token, userId).catch(() => null),
    ])
      .then(async ([prods, pl, allotment]) => {
        setProducts(prods);
        setPricelist(pl);
        const areaIds: bigint[] =
          (allotment as { areaIds?: bigint[] } | null)?.areaIds ?? [];
        if (areaIds.length > 0) {
          const results = await Promise.all(
            areaIds.map((aid) =>
              api
                .listStockistsByArea(token, aid)
                .catch(() => [] as StockistRecord[]),
            ),
          );
          const all = results.flat();
          // Deduplicate by id
          const seen = new Set<bigint>();
          const unique = all.filter((s) => {
            if (seen.has(s.id)) return false;
            seen.add(s.id);
            return true;
          });
          setStockists(unique.filter((s) => s.isActive));
        }
      })
      .finally(() => setDataLoading(false));
  }, [showForm, token, userId]);

  const filteredStockists = useMemo(() => {
    if (!stockistSearch.trim()) return stockists;
    const q = stockistSearch.toLowerCase();
    return stockists.filter((s) => s.name.toLowerCase().includes(q));
  }, [stockists, stockistSearch]);

  function handleProductSelect(index: number, productId: string) {
    const prod = products.find((p) => p.id.toString() === productId);
    const pl = pricelist.find((p) => p.name === prod?.name);
    setRows((prev) =>
      prev.map((r, i) =>
        i === index
          ? {
              ...r,
              productId,
              productName: prod?.name ?? "",
              mrp: pl?.mrp ?? 0,
              pts: pl?.pts ?? 0,
              ptr: pl?.ptr ?? 0,
            }
          : r,
      ),
    );
  }

  const totalNetSaleValue = rows.reduce(
    (sum, r) => sum + calcNetSaleValue(r),
    0,
  );

  const resetForm = () => {
    setSaleDate(new Date().toISOString().slice(0, 10));
    setSelectedStockistId("");
    setStockistSearch("");
    setRows([emptyRow()]);
  };

  async function handleSubmit() {
    if (!selectedStockistId) {
      toast.error("Please select a stockist.");
      return;
    }
    const validRows = rows.filter(
      (r) => r.productId && Number(r.quantitySold) > 0,
    );
    if (validRows.length === 0) {
      toast.error("Add at least one product with quantity.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.createSecondarySale(token, {
        stockistId: BigInt(selectedStockistId),
        saleDate: BigInt(new Date(saleDate).getTime()) * 1_000_000n,
        products: validRows.map((r) => ({
          productId: BigInt(r.productId),
          productName: r.productName,
          quantitySold: BigInt(Math.round(Number(r.quantitySold))),
          mrp: r.mrp,
          pts: r.pts,
          ptr: r.ptr,
          netSaleValue: calcNetSaleValue(r),
        })),
      });
      if (res.__kind__ === "ok") {
        toast.success("Secondary sale entry submitted.");
        setEntries((prev) => [res.ok, ...prev]);
        setShowForm(false);
        resetForm();
      } else {
        toast.error(res.err);
      }
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSubmitting(false);
    }
  }

  const stockistNameMap = useMemo(
    () => new Map(stockists.map((s) => [s.id.toString(), s.name])),
    [stockists],
  );

  return (
    <PortalLayout portalRole={portalRole}>
      <PageHeader
        title="Secondary Sale"
        subtitle="Submit and track stockist-wise secondary sale entries"
        actions={
          <Button
            onClick={() => setShowForm(true)}
            className="gap-2"
            data-ocid="btn-new-secondary-sale"
          >
            <Plus className="w-4 h-4" /> New Entry
          </Button>
        }
      />
      <PageContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3"
            data-ocid="secondary-sale-empty"
          >
            <ShoppingBag className="w-12 h-12 opacity-20" />
            <p className="font-medium">No secondary sale entries yet</p>
            <p className="text-sm">
              Click "New Entry" to submit your first entry.
            </p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {[
                      "Date",
                      "Stockist",
                      "Products",
                      "Net Sale Value (₹)",
                      "Actions",
                    ].map((h, i) => (
                      <th
                        key={h}
                        className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground ${i > 1 ? "text-right" : "text-left"}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr
                      key={e.id.toString()}
                      className="border-b border-border/50 hover:bg-muted/20"
                      data-ocid="secondary-sale-row"
                    >
                      <td className="px-4 py-3 font-mono text-xs">
                        {new Date(
                          Number(e.saleDate) / 1_000_000,
                        ).toLocaleDateString("en-IN")}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        {stockistNameMap.get(e.stockistId.toString()) ??
                          `#${e.stockistId}`}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Badge variant="secondary">{e.products.length}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-accent">
                        ₹{e.totalNetSaleValue.toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setViewEntry(e)}
                          className="h-7 px-2 gap-1"
                          data-ocid="btn-view-sale"
                        >
                          <Eye className="w-3.5 h-3.5" /> View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* New Entry Dialog */}
        <Dialog
          open={showForm}
          onOpenChange={(o) => {
            setShowForm(o);
            if (!o) resetForm();
          }}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Secondary Sale Entry</DialogTitle>
            </DialogHeader>
            {dataLoading ? (
              <div className="space-y-3 py-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-5 py-2">
                {/* Sale Date */}
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                    Sale Date *
                  </Label>
                  <Input
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    data-ocid="input-sale-date"
                  />
                </div>

                {/* Stockist Selection */}
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                    Stockist *
                  </Label>
                  <div className="relative mb-1.5">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Search stockist by name…"
                      value={stockistSearch}
                      onChange={(e) => setStockistSearch(e.target.value)}
                      className="pl-9"
                      data-ocid="input-stockist-search"
                    />
                  </div>
                  <div className="border border-input rounded-md bg-background max-h-44 overflow-y-auto">
                    {filteredStockists.length === 0 ? (
                      <p className="p-4 text-xs text-muted-foreground text-center italic">
                        {stockists.length === 0
                          ? "No stockists found for your area."
                          : "No stockists match your search."}
                      </p>
                    ) : (
                      filteredStockists.map((s) => (
                        <button
                          key={s.id.toString()}
                          type="button"
                          onClick={() => setSelectedStockistId(s.id.toString())}
                          data-ocid={`stockist-item-${s.id}`}
                          className={`w-full text-left px-3 py-2.5 text-sm border-b border-border/30 last:border-0 hover:bg-muted/40 transition-colors ${selectedStockistId === s.id.toString() ? "bg-primary/8 font-semibold text-primary" : "text-foreground"}`}
                        >
                          {s.name}
                          {s.address && (
                            <span className="text-xs text-muted-foreground ml-2">
                              {s.address}
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                  {selectedStockistId && (
                    <p className="text-xs text-primary mt-1">
                      Selected:{" "}
                      {
                        stockists.find(
                          (s) => s.id.toString() === selectedStockistId,
                        )?.name
                      }
                    </p>
                  )}
                </div>

                {/* Products Table */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Products *
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => setRows((p) => [...p, emptyRow()])}
                      data-ocid="btn-add-product-row"
                    >
                      <Plus className="w-3 h-3" /> Add Product
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {rows.map((row, i) => (
                      <div
                        key={`row-${i}-${row.productId}`}
                        className="grid grid-cols-12 gap-2 items-center bg-muted/20 rounded-md p-2"
                        data-ocid={`product-row-${i}`}
                      >
                        <div className="col-span-4">
                          <Select
                            value={row.productId || "none"}
                            onValueChange={(v) =>
                              handleProductSelect(i, v === "none" ? "" : v)
                            }
                          >
                            <SelectTrigger
                              className="h-8 text-xs"
                              data-ocid={`product-select-${i}`}
                            >
                              <SelectValue placeholder="Select product" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— Select —</SelectItem>
                              {products
                                .filter((p) => p.isActive)
                                .map((p) => (
                                  <SelectItem
                                    key={p.id.toString()}
                                    value={p.id.toString()}
                                  >
                                    {p.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-2">
                          <Input
                            type="number"
                            min="1"
                            placeholder="Qty"
                            value={row.quantitySold}
                            onChange={(e) =>
                              setRows((prev) =>
                                prev.map((r, idx) =>
                                  idx === i
                                    ? { ...r, quantitySold: e.target.value }
                                    : r,
                                ),
                              )
                            }
                            className="h-8 text-xs"
                            data-ocid={`qty-input-${i}`}
                          />
                        </div>
                        <div className="col-span-2 text-xs text-muted-foreground text-center">
                          MRP: <span className="font-mono">{row.mrp}</span>
                        </div>
                        <div className="col-span-2 text-xs text-muted-foreground text-center">
                          PTS: <span className="font-mono">{row.pts}</span>
                        </div>
                        <div className="col-span-1 text-xs font-mono text-right text-accent font-semibold">
                          ₹{calcNetSaleValue(row).toLocaleString("en-IN")}
                        </div>
                        <div className="col-span-1 flex justify-end">
                          {rows.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() =>
                                setRows((p) => p.filter((_, idx) => idx !== i))
                              }
                            >
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end mt-3 pt-3 border-t border-border">
                    <span className="text-sm font-semibold text-foreground">
                      Total:{" "}
                      <span className="font-mono text-accent">
                        ₹{totalNetSaleValue.toLocaleString("en-IN")}
                      </span>
                    </span>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="gap-2"
                    data-ocid="btn-submit-sale"
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Submit Entry
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowForm(false);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* View Entry Dialog */}
        <Dialog
          open={!!viewEntry}
          onOpenChange={(o) => !o && setViewEntry(null)}
        >
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4" />
                Sale Entry Details
              </DialogTitle>
            </DialogHeader>
            {viewEntry && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground">Date</span>
                    <p className="font-mono font-medium">
                      {new Date(
                        Number(viewEntry.saleDate) / 1_000_000,
                      ).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">
                      Stockist
                    </span>
                    <p className="font-medium">
                      {stockistNameMap.get(viewEntry.stockistId.toString()) ??
                        `#${viewEntry.stockistId}`}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">
                      Total Net Value
                    </span>
                    <p className="font-mono font-semibold text-accent">
                      ₹{viewEntry.totalNetSaleValue.toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Products Sold
                  </p>
                  <div className="space-y-2">
                    {viewEntry.products.map((p, i) => (
                      <div
                        key={`prod-${viewEntry.id}-${i}`}
                        className="bg-muted/30 rounded-md px-3 py-2 text-sm flex flex-col gap-0.5"
                      >
                        <p className="font-medium">{p.productName}</p>
                        <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
                          <span>
                            Qty: <strong>{p.quantitySold.toString()}</strong>
                          </span>
                          <span>
                            MRP: <strong>₹{p.mrp}</strong>
                          </span>
                          <span>
                            PTS: <strong>₹{p.pts}</strong>
                          </span>
                          <span>
                            Net:{" "}
                            <strong className="text-accent">
                              ₹{p.netSaleValue.toLocaleString("en-IN")}
                            </strong>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </PageContent>
    </PortalLayout>
  );
}
