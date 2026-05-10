import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import { Layers, Package, Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Role } from "../../backend";
import type { ProductInfo, SampleAllocationInfo } from "../../backend.d";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import type { UserInfo } from "../../types";

const MONTH_NAMES = [
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
];

function monthYearLabel(month: number, year: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

function exportToCSV(
  allocations: SampleAllocationInfo[],
  mrMap: Map<bigint, string>,
  month: number,
  year: number,
): void {
  const rows = [
    [
      "MR Name",
      "Product",
      "Allocated Qty",
      "Used Qty",
      "Remaining Qty",
      "Remarks",
      "Allocated On",
    ],
    ...allocations.map((a) => {
      const mrName = mrMap.get(a.mrId) ?? `MR-${String(a.mrId)}`;
      const remaining = Number(a.allocatedQty) - Number(a.usedQty);
      const allocatedOn = new Date(
        Number(a.allocatedAt) / 1_000_000,
      ).toLocaleDateString("en-IN");
      return [
        mrName,
        a.productName,
        String(a.allocatedQty),
        String(a.usedQty),
        String(remaining),
        a.remarks,
        allocatedOn,
      ];
    }),
  ];
  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `SampleAllocation_${monthYearLabel(month, year).replace(" ", "_")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

interface SampleAllocationCoreProps {
  portalRole: "Admin" | "HRManager";
}

export function SampleAllocationCore({
  portalRole,
}: SampleAllocationCoreProps) {
  const { session } = useAuthStore();
  const role = portalRole === "Admin" ? Role.Admin : Role.HRManager;

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const [allocations, setAllocations] = useState<SampleAllocationInfo[]>([]);
  const [mrs, setMrs] = useState<UserInfo[]>([]);
  const [products, setProducts] = useState<ProductInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [formMrId, setFormMrId] = useState("");
  const [formProductId, setFormProductId] = useState("");
  const [formQty, setFormQty] = useState("1");
  const [formRemarks, setFormRemarks] = useState("");
  const [saving, setSaving] = useState(false);

  const mrMap = new Map(mrs.map((m) => [m.id, m.name]));

  const load = useCallback(() => {
    if (!session?.token) return;
    setLoading(true);
    Promise.all([
      api.getAllAllocations(session.token, month, year),
      api.listUsersByRole(session.token, Role.MR),
      api.listProducts(),
    ])
      .then(([allocs, mrList, prodList]) => {
        setAllocations(allocs);
        setMrs(mrList as UserInfo[]);
        setProducts(prodList.filter((p) => p.isActive));
        setLoading(false);
      })
      .catch(() => {
        toast.error("Failed to load data");
        setLoading(false);
      });
  }, [session?.token, month, year]);

  useEffect(() => {
    load();
  }, [load]);

  const openModal = () => {
    setFormMrId("");
    setFormProductId("");
    setFormQty("1");
    setFormRemarks("");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formMrId || !formProductId) {
      toast.error("Please select both MR and Product");
      return;
    }
    const qty = Number.parseInt(formQty, 10);
    if (Number.isNaN(qty) || qty < 1) {
      toast.error("Quantity must be at least 1");
      return;
    }
    if (!session?.token) return;
    setSaving(true);
    try {
      const prod = products.find((p) => String(p.id) === formProductId);
      if (!prod) throw new Error("Product not found");
      await api.allocateSamplesToMR(session.token, {
        mrId: BigInt(formMrId),
        productId: prod.id,
        productName: prod.name,
        month: BigInt(month),
        year: BigInt(year),
        allocatedQty: BigInt(qty),
        remarks: formRemarks,
      });
      toast.success("Samples allocated successfully");
      setModalOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Allocation failed");
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    setExporting(true);
    try {
      exportToCSV(allocations, mrMap, month, year);
    } finally {
      setExporting(false);
    }
  };

  // Group allocations by MR
  const grouped = new Map<bigint, SampleAllocationInfo[]>();
  for (const a of allocations) {
    const arr = grouped.get(a.mrId) ?? [];
    arr.push(a);
    grouped.set(a.mrId, arr);
  }

  const yearOptions = [year - 1, year, year + 1];

  // Check for existing allocation
  const existingAllocation =
    formMrId && formProductId
      ? allocations.find(
          (a) =>
            String(a.mrId) === formMrId &&
            String(a.productId) === formProductId,
        )
      : null;

  return (
    <PortalLayout portalRole={role}>
      <PageHeader
        title="Sample Allocation"
        subtitle={`Manage sample allocations for ${monthYearLabel(month, year)}`}
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={exporting || allocations.length === 0}
              data-ocid="sample-allocation.secondary_button"
            >
              {exporting ? "Exporting…" : "Export CSV"}
            </Button>
            <Button
              onClick={openModal}
              className="gap-2"
              data-ocid="sample-allocation.primary_button"
            >
              <Plus className="w-4 h-4" />
              Allocate Samples
            </Button>
          </div>
        }
      />
      <PageContent>
        {/* Month / Year selector */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <Select
            value={String(month)}
            onValueChange={(v) => setMonth(Number(v))}
          >
            <SelectTrigger
              className="w-[150px]"
              data-ocid="sample-allocation.select"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_NAMES.map((m, i) => (
                <SelectItem key={m} value={String(i + 1)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(year)}
            onValueChange={(v) => setYear(Number(v))}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            className="gap-1.5"
            data-ocid="sample-allocation-refresh-btn"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-card border border-border rounded-lg px-4 py-3">
            <p className="text-xs text-muted-foreground font-display uppercase tracking-wide">
              Total Allocations
            </p>
            <p className="text-2xl font-display font-bold text-foreground">
              {loading ? "—" : allocations.length}
            </p>
          </div>
          <div className="bg-card border border-border rounded-lg px-4 py-3">
            <p className="text-xs text-muted-foreground font-display uppercase tracking-wide">
              MRs with Allocations
            </p>
            <p className="text-2xl font-display font-bold text-foreground">
              {loading ? "—" : grouped.size}
            </p>
          </div>
          <div className="bg-card border border-border rounded-lg px-4 py-3">
            <p className="text-xs text-muted-foreground font-display uppercase tracking-wide">
              Total Allocated
            </p>
            <p className="text-2xl font-display font-bold text-foreground">
              {loading
                ? "—"
                : allocations.reduce(
                    (sum, a) => sum + Number(a.allocatedQty),
                    0,
                  )}
            </p>
          </div>
          <div className="bg-card border border-border rounded-lg px-4 py-3">
            <p className="text-xs text-muted-foreground font-display uppercase tracking-wide">
              Total Used
            </p>
            <p className="text-2xl font-display font-bold text-foreground">
              {loading
                ? "—"
                : allocations.reduce((sum, a) => sum + Number(a.usedQty), 0)}
            </p>
          </div>
        </div>

        {/* Allocations grouped by MR */}
        {loading ? (
          <div className="space-y-4">
            {(["skel-a", "skel-b", "skel-c"] as const).map((skKey) => (
              <div
                key={skKey}
                className="bg-card border border-border rounded-lg p-4 space-y-3"
              >
                <div className="h-5 bg-muted animate-pulse rounded w-40" />
                <div className="h-4 bg-muted animate-pulse rounded w-full" />
                <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : grouped.size === 0 ? (
          <div
            className="bg-card border border-border rounded-lg py-16 text-center"
            data-ocid="sample-allocation.empty_state"
          >
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-muted-foreground font-body text-sm mb-3">
              No sample allocations for {monthYearLabel(month, year)}.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={openModal}
              className="gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Allocate Samples
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {Array.from(grouped.entries()).map(([mrId, mrAllocs], idx) => {
              const mrName = mrMap.get(mrId) ?? `MR-${String(mrId)}`;
              const totalAllocated = mrAllocs.reduce(
                (s, a) => s + Number(a.allocatedQty),
                0,
              );
              const totalUsed = mrAllocs.reduce(
                (s, a) => s + Number(a.usedQty),
                0,
              );
              const totalRemaining = totalAllocated - totalUsed;
              return (
                <div
                  key={String(mrId)}
                  className="bg-card border border-border rounded-lg overflow-hidden"
                  data-ocid={`sample-allocation.item.${idx + 1}`}
                >
                  {/* MR Header */}
                  <div className="flex items-center justify-between gap-4 px-4 py-3 bg-muted/30 border-b border-border">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-primary flex-shrink-0" />
                      <span className="font-display font-semibold text-foreground">
                        {mrName}
                      </span>
                      <Badge variant="outline" className="text-xs font-display">
                        MR
                      </Badge>
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground font-body">
                      <span>
                        Allocated:{" "}
                        <strong className="text-foreground">
                          {totalAllocated}
                        </strong>
                      </span>
                      <span>
                        Used:{" "}
                        <strong className="text-foreground">{totalUsed}</strong>
                      </span>
                      <span>
                        Remaining:{" "}
                        <strong
                          className={
                            totalRemaining > 0
                              ? "text-green-600"
                              : "text-destructive"
                          }
                        >
                          {totalRemaining}
                        </strong>
                      </span>
                    </div>
                  </div>
                  {/* Product rows */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="px-4 py-2.5 text-left text-xs font-display text-muted-foreground uppercase tracking-wider">
                            Product
                          </th>
                          <th className="px-4 py-2.5 text-right text-xs font-display text-muted-foreground uppercase tracking-wider">
                            Allocated
                          </th>
                          <th className="px-4 py-2.5 text-right text-xs font-display text-muted-foreground uppercase tracking-wider">
                            Used
                          </th>
                          <th className="px-4 py-2.5 text-right text-xs font-display text-muted-foreground uppercase tracking-wider">
                            Remaining
                          </th>
                          <th className="px-4 py-2.5 text-left text-xs font-display text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                            Remarks
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {mrAllocs.map((a) => {
                          const remaining =
                            Number(a.allocatedQty) - Number(a.usedQty);
                          return (
                            <tr
                              key={String(a.id)}
                              className="hover:bg-muted/10"
                            >
                              <td className="px-4 py-2.5 font-body text-foreground">
                                {a.productName}
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono text-sm text-foreground">
                                {String(a.allocatedQty)}
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono text-sm text-muted-foreground">
                                {String(a.usedQty)}
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono text-sm">
                                <span
                                  className={
                                    remaining > 0
                                      ? "text-green-600 font-medium"
                                      : "text-destructive font-medium"
                                  }
                                >
                                  {remaining}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-xs text-muted-foreground hidden md:table-cell">
                                {a.remarks || "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PageContent>

      {/* Allocate Modal */}
      <Dialog open={modalOpen} onOpenChange={(v) => !v && setModalOpen(false)}>
        <DialogContent
          className="sm:max-w-md"
          data-ocid="sample-allocation.dialog"
        >
          <DialogHeader>
            <DialogTitle className="font-display">
              Allocate Samples to MR
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {existingAllocation && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 font-body">
                An allocation already exists for this MR + Product + Month.
                Saving will update the existing allocation.
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="font-display">
                Select MR <span className="text-destructive">*</span>
              </Label>
              <Select value={formMrId} onValueChange={setFormMrId}>
                <SelectTrigger data-ocid="sample-allocation.select">
                  <SelectValue placeholder="Choose MR…" />
                </SelectTrigger>
                <SelectContent>
                  {mrs.map((m) => (
                    <SelectItem key={String(m.id)} value={String(m.id)}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="font-display">
                Select Product <span className="text-destructive">*</span>
              </Label>
              <Select value={formProductId} onValueChange={setFormProductId}>
                <SelectTrigger data-ocid="sample-allocation-product-select">
                  <SelectValue placeholder="Choose product…" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={String(p.id)} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="font-display">Month</Label>
                <Select
                  value={String(month)}
                  onValueChange={(v) => setMonth(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES.map((m, i) => (
                      <SelectItem key={m} value={String(i + 1)}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="font-display">Year</Label>
                <Select
                  value={String(year)}
                  onValueChange={(v) => setYear(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="alloc-qty" className="font-display">
                Quantity <span className="text-destructive">*</span>
              </Label>
              <Input
                id="alloc-qty"
                type="number"
                min="1"
                value={formQty}
                onChange={(e) => setFormQty(e.target.value)}
                data-ocid="sample-allocation.input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="alloc-remarks" className="font-display">
                Remarks
              </Label>
              <Input
                id="alloc-remarks"
                placeholder="Optional notes…"
                value={formRemarks}
                onChange={(e) => setFormRemarks(e.target.value)}
                data-ocid="sample-allocation-remarks-input"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setModalOpen(false)}
              disabled={saving}
              data-ocid="sample-allocation.cancel_button"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              data-ocid="sample-allocation.submit_button"
            >
              {saving
                ? "Saving…"
                : existingAllocation
                  ? "Update Allocation"
                  : "Allocate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}

export default function SampleAllocationPage() {
  return <SampleAllocationCore portalRole="Admin" />;
}
