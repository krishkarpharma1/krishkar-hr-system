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
import { Textarea } from "@/components/ui/textarea";
import {
  Edit2,
  PackageSearch,
  Plus,
  PowerOff,
  RefreshCw,
  Search,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Role } from "../../backend";
import { ProductCategory } from "../../backend.d";
import type { ProductInfo } from "../../backend.d";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { api } from "../../lib/api";

const CATEGORIES: ProductCategory[] = [
  ProductCategory.Tablet,
  ProductCategory.Capsule,
  ProductCategory.Syrup,
  ProductCategory.Injection,
  ProductCategory.Ointment,
  ProductCategory.Other,
];

type ProductFormData = {
  name: string;
  productCode: string;
  category: ProductCategory;
  division: string;
  mrpRupees: string;
  packSize: string;
  description: string;
};

const EMPTY_FORM: ProductFormData = {
  name: "",
  productCode: "",
  category: ProductCategory.Tablet,
  division: "",
  mrpRupees: "",
  packSize: "",
  description: "",
};

function toRupees(paise: bigint): string {
  return (Number(paise) / 100).toFixed(2);
}

function toPaise(rupees: string): bigint {
  const n = Number.parseFloat(rupees);
  if (Number.isNaN(n) || n < 0) return BigInt(0);
  return BigInt(Math.round(n * 100));
}

export default function ProductMasterPage() {
  const [products, setProducts] = useState<ProductInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProductInfo | null>(null);
  const [form, setForm] = useState<ProductFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [confirmId, setConfirmId] = useState<bigint | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .listProducts()
      .then((p) => {
        setProducts(p);
        setLoading(false);
      })
      .catch(() => {
        toast.error("Failed to load products");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (p: ProductInfo) => {
    setEditTarget(p);
    setForm({
      name: p.name,
      productCode: p.productCode ?? "",
      category: p.category,
      division: p.division ?? "",
      mrpRupees: p.mrpPaise ? toRupees(p.mrpPaise) : "",
      packSize: p.packSize ?? "",
      description: p.description ?? "",
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditTarget(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Product name is required");
      return;
    }
    if (!form.productCode.trim()) {
      toast.error("Product code is required");
      return;
    }
    setSaving(true);
    try {
      if (editTarget) {
        const res = await api.updateProduct(
          editTarget.id,
          form.name || null,
          form.category || null,
          form.description || null,
          form.productCode || null,
          form.division || null,
          form.mrpRupees ? toPaise(form.mrpRupees) : null,
          form.packSize || null,
        );
        if (res.__kind__ === "err") throw new Error(res.err);
        toast.success("Product updated successfully");
      } else {
        await api.addProduct({
          name: form.name,
          productCode: form.productCode,
          category: form.category,
          division: form.division,
          mrpPaise: toPaise(form.mrpRupees),
          packSize: form.packSize,
          description: form.description,
        });
        toast.success("Product added successfully");
      }
      closeModal();
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Operation failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: bigint) => {
    setDeactivating(true);
    try {
      const res = await api.deactivateProduct(id);
      if (res.__kind__ === "err") throw new Error(res.err);
      toast.success("Product deactivated");
      setConfirmId(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Deactivation failed");
    } finally {
      setDeactivating(false);
    }
  };

  const handleReactivate = async (p: ProductInfo) => {
    try {
      const res = await api.updateProduct(
        p.id,
        p.name,
        p.category,
        p.description,
        p.productCode,
        p.division,
        p.mrpPaise,
        p.packSize,
      );
      if (res.__kind__ === "err") throw new Error(res.err);
      toast.success("Product reactivated");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reactivation failed");
    }
  };

  const filtered = products.filter((p) => {
    const matchSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.productCode ?? "").toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === "all" || p.category === categoryFilter;
    const matchStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && p.isActive) ||
      (statusFilter === "inactive" && !p.isActive);
    return matchSearch && matchCat && matchStatus;
  });

  const activeCount = products.filter((p) => p.isActive).length;
  const inactiveCount = products.filter((p) => !p.isActive).length;

  return (
    <PortalLayout portalRole={Role.Admin}>
      <PageHeader
        title="Product Master"
        subtitle={`Manage the pharmaceutical product catalogue — ${loading ? "…" : products.length} products`}
        actions={
          <Button
            onClick={openAdd}
            className="gap-2"
            data-ocid="add-product-btn"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </Button>
        }
      />
      <PageContent>
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            {
              label: "Total",
              value: loading ? "—" : products.length,
              icon: <PackageSearch className="w-5 h-5 text-primary" />,
            },
            {
              label: "Active",
              value: loading ? "—" : activeCount,
              dot: "bg-green-500",
            },
            {
              label: "Inactive",
              value: loading ? "—" : inactiveCount,
              dot: "bg-muted-foreground",
            },
          ].map((c) => (
            <div
              key={c.label}
              className="bg-card border border-border rounded-lg px-4 py-3 flex items-center gap-3"
            >
              {c.icon ?? (
                <div
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dot}`}
                />
              )}
              <div>
                <p className="text-xs text-muted-foreground font-display uppercase tracking-wide">
                  {c.label}
                </p>
                <p className="text-xl font-display font-bold text-foreground">
                  {c.value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by name or product code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-ocid="product-search-input"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger
              className="w-[150px]"
              data-ocid="product-category-filter"
            >
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger
              className="w-[130px]"
              data-ocid="product-status-filter"
            >
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  {[
                    "Product Code",
                    "Name",
                    "Category",
                    "Division",
                    "MRP",
                    "Pack Size",
                    "Status",
                    "Actions",
                  ].map((h, i) => (
                    <th
                      key={h}
                      className={`px-4 py-3 text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider ${i === 7 ? "text-right" : "text-left"} ${i >= 3 && i < 7 ? "hidden md:table-cell" : ""}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  (["sk1", "sk2", "sk3", "sk4", "sk5"] as const).map(
                    (rowKey) => (
                      <tr key={rowKey}>
                        {(
                          ["a", "b", "c", "d", "e", "f", "g", "h"] as const
                        ).map((colKey) => (
                          <td key={`${rowKey}-${colKey}`} className="px-4 py-3">
                            <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                          </td>
                        ))}
                      </tr>
                    ),
                  )
                ) : filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-12 text-center"
                      data-ocid="product-empty-state"
                    >
                      <PackageSearch className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-40" />
                      <p className="text-muted-foreground font-body text-sm">
                        {search ||
                        categoryFilter !== "all" ||
                        statusFilter !== "all"
                          ? "No products match your filters"
                          : "No products yet. Add your first product."}
                      </p>
                      {!search &&
                        categoryFilter === "all" &&
                        statusFilter === "all" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3 gap-1.5"
                            onClick={openAdd}
                          >
                            <Plus className="w-3.5 h-3.5" /> Add Product
                          </Button>
                        )}
                    </td>
                  </tr>
                ) : (
                  filtered.map((p, idx) => (
                    <tr
                      key={String(p.id)}
                      className="hover:bg-muted/20 transition-colors"
                      data-ocid={`product.item.${idx + 1}`}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {p.productCode || "—"}
                      </td>
                      <td className="px-4 py-3 font-body font-medium text-foreground">
                        {p.name}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-display">
                          {p.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">
                        {p.division || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground hidden md:table-cell">
                        {p.mrpPaise ? `₹${toRupees(p.mrpPaise)}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                        {p.packSize || "—"}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <Badge
                          variant={p.isActive ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {p.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 gap-1 text-xs"
                            onClick={() => openEdit(p)}
                            data-ocid={`product.edit_button.${idx + 1}`}
                          >
                            <Edit2 className="w-3 h-3" />
                            Edit
                          </Button>
                          {p.isActive ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 gap-1 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setConfirmId(p.id)}
                              data-ocid={`product.delete_button.${idx + 1}`}
                            >
                              <PowerOff className="w-3 h-3" />
                              Deactivate
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 gap-1 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => handleReactivate(p)}
                              data-ocid={`product.secondary_button.${idx + 1}`}
                            >
                              <RefreshCw className="w-3 h-3" />
                              Activate
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {!loading && filtered.length > 0 && (
            <div className="px-4 py-2.5 border-t border-border bg-muted/20">
              <p className="text-xs text-muted-foreground font-body">
                Showing {filtered.length} of {products.length} products
              </p>
            </div>
          )}
        </div>
      </PageContent>

      {/* Add / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={(v) => !v && closeModal()}>
        <DialogContent className="sm:max-w-lg" data-ocid="product.dialog">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editTarget ? "Edit Product" : "Add New Product"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="prod-name" className="font-display">
                  Product Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="prod-name"
                  placeholder="e.g. Amoxicillin 500mg"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  data-ocid="product.input"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prod-code" className="font-display">
                  Product Code <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="prod-code"
                  placeholder="e.g. KP-001"
                  value={form.productCode}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, productCode: e.target.value }))
                  }
                  data-ocid="product-code-input"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="prod-category" className="font-display">
                  Category <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={form.category}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, category: v as ProductCategory }))
                  }
                >
                  <SelectTrigger
                    id="prod-category"
                    data-ocid="product-category-select"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prod-division" className="font-display">
                  Division
                </Label>
                <Input
                  id="prod-division"
                  placeholder="e.g. Cardiac, CNS"
                  value={form.division}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, division: e.target.value }))
                  }
                  data-ocid="product-division-input"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="prod-mrp" className="font-display">
                  MRP (₹)
                </Label>
                <Input
                  id="prod-mrp"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 150.00"
                  value={form.mrpRupees}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, mrpRupees: e.target.value }))
                  }
                  data-ocid="product-mrp-input"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prod-packsize" className="font-display">
                  Pack Size
                </Label>
                <Input
                  id="prod-packsize"
                  placeholder="e.g. 10 tablets/strip"
                  value={form.packSize}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, packSize: e.target.value }))
                  }
                  data-ocid="product-packsize-input"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prod-desc" className="font-display">
                Description{" "}
                <span className="text-muted-foreground text-xs">
                  (optional)
                </span>
              </Label>
              <Textarea
                id="prod-desc"
                placeholder="Brief product description…"
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                data-ocid="product-desc-input"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={closeModal}
              disabled={saving}
              data-ocid="product.cancel_button"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              data-ocid="product.save_button"
            >
              {saving ? "Saving…" : editTarget ? "Save Changes" : "Add Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Confirmation */}
      <Dialog
        open={confirmId !== null}
        onOpenChange={(v) => !v && setConfirmId(null)}
      >
        <DialogContent
          className="sm:max-w-sm"
          data-ocid="product-deactivate.dialog"
        >
          <DialogHeader>
            <DialogTitle className="font-display">
              Deactivate Product?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground font-body">
            This product will be marked as inactive and hidden from assignment
            forms. You can reactivate it at any time.
          </p>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmId(null)}
              disabled={deactivating}
              data-ocid="product-deactivate.cancel_button"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmId !== null && handleDeactivate(confirmId)}
              disabled={deactivating}
              data-ocid="product-deactivate.confirm_button"
            >
              {deactivating ? "Deactivating…" : "Yes, Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
