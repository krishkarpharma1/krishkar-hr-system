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

const CATEGORIES = Object.values(ProductCategory);

type ProductFormData = {
  name: string;
  category: ProductCategory;
  description: string;
};

const EMPTY_FORM: ProductFormData = {
  name: "",
  category: ProductCategory.Tablet,
  description: "",
};

export default function ProductMaster() {
  const [products, setProducts] = useState<ProductInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProductInfo | null>(null);
  const [form, setForm] = useState<ProductFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Confirm deactivate
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
    setForm({ name: p.name, category: p.category, description: p.description });
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
    setSaving(true);
    try {
      if (editTarget) {
        const res = await api.updateProduct(
          editTarget.id,
          form.name,
          form.category,
          form.description,
        );
        if (res.__kind__ === "err") throw new Error(res.err);
        toast.success("Product updated successfully");
      } else {
        await api.addProduct({
          name: form.name,
          category: form.category,
          description: form.description,
          productCode: "",
          division: "",
          mrpPaise: BigInt(0),
          packSize: "",
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
      // Pass current values — backend will clear deactivation if it supports it
      const res = await api.updateProduct(
        p.id,
        p.name,
        p.category,
        p.description,
      );
      if (res.__kind__ === "err") throw new Error(res.err);
      toast.success("Product updated");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reactivation failed");
    }
  };

  const filtered = products.filter((p) => {
    const matchSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === "all" || p.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const active = products.filter((p) => p.isActive).length;
  const inactive = products.filter((p) => !p.isActive).length;

  return (
    <PortalLayout portalRole={Role.Admin}>
      <PageHeader
        title="Product Master"
        subtitle="Manage the pharmaceutical product catalogue"
      />
      <PageContent>
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-card border border-border rounded-lg px-4 py-3 flex items-center gap-3">
            <PackageSearch className="w-5 h-5 text-primary flex-shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground font-display uppercase tracking-wide">
                Total
              </p>
              <p className="text-xl font-display font-bold text-foreground">
                {loading ? "—" : products.length}
              </p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg px-4 py-3 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground font-display uppercase tracking-wide">
                Active
              </p>
              <p className="text-xl font-display font-bold text-foreground">
                {loading ? "—" : active}
              </p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg px-4 py-3 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-muted-foreground flex-shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground font-display uppercase tracking-wide">
                Inactive
              </p>
              <p className="text-xl font-display font-bold text-foreground">
                {loading ? "—" : inactive}
              </p>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by name or category…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-ocid="product-search"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger
              className="w-[160px]"
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
          <Button
            onClick={openAdd}
            className="gap-2 flex-shrink-0"
            data-ocid="add-product-btn"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </Button>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                    Description
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <>
                    {["sk1", "sk2", "sk3", "sk4", "sk5"].map((sk) => (
                      <tr key={sk}>
                        {["a", "b", "c", "d", "e"].map((col) => (
                          <td key={`${sk}-${col}`} className="px-4 py-3">
                            <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center">
                      <PackageSearch className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-40" />
                      <p className="text-muted-foreground font-body text-sm">
                        {search || categoryFilter !== "all"
                          ? "No products match your filters"
                          : "No products yet. Add your first product."}
                      </p>
                      {!search && categoryFilter === "all" && (
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
                  filtered.map((p) => (
                    <tr
                      key={String(p.id)}
                      className="hover:bg-muted/20 transition-colors"
                      data-ocid={`product-row-${p.id}`}
                    >
                      <td className="px-4 py-3 font-body font-medium text-foreground">
                        {p.name}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-display">
                          {p.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell max-w-xs">
                        <span className="line-clamp-2">
                          {p.description || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
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
                            data-ocid={`edit-product-${p.id}`}
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
                              data-ocid={`deactivate-product-${p.id}`}
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
                              data-ocid={`reactivate-product-${p.id}`}
                            >
                              <RefreshCw className="w-3 h-3" />
                              Reactivate
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editTarget ? "Edit Product" : "Add New Product"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
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
                data-ocid="product-name-input"
              />
            </div>
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
            <Button variant="outline" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              data-ocid="product-save-btn"
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
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">
              Deactivate Product?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground font-body">
            This product will be marked as inactive and hidden from MR
            assignment forms. You can reactivate it at any time.
          </p>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmId(null)}
              disabled={deactivating}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmId !== null && handleDeactivate(confirmId)}
              disabled={deactivating}
              data-ocid="confirm-deactivate-btn"
            >
              {deactivating ? "Deactivating…" : "Yes, Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
