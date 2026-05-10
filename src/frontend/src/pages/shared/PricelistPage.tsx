import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Download,
  Edit2,
  FileSpreadsheet,
  Printer,
  Search,
  Tag,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import type { Role } from "../../backend";
import type { CompanyProfile } from "../../backend.d";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { api } from "../../lib/api";
import {
  buildBrandingExcelRows,
  buildBrandingHtml,
} from "../../lib/brandingHtml";
import { useAuthStore } from "../../store/authStore";
import type {
  AddPricelistProductInput,
  PricelistProductInfo,
} from "../../types";

// ─── Local types (frontend-friendly) ─────────────────────────────────────────

interface PricelistRow {
  id: string; // stringified bigint or uuid
  srNo: number;
  name: string;
  composition: string;
  mrp: number;
  pts: number;
  ptr: number;
}

type FormState = Omit<PricelistRow, "id" | "srNo">;

function emptyForm(): FormState {
  return { name: "", composition: "", mrp: 0, pts: 0, ptr: 0 };
}

function fromBackend(p: PricelistProductInfo): PricelistRow {
  return {
    id: String(p.id),
    srNo: Number(p.srNo),
    name: p.name,
    composition: p.composition,
    mrp: p.mrp,
    pts: p.pts,
    ptr: p.ptr,
  };
}

// ─── Local storage fallback ───────────────────────────────────────────────────

const LS_KEY = "kp_pricelist_v1";

function lsLoad(): PricelistRow[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as PricelistRow[]) : [];
  } catch {
    return [];
  }
}

function lsSave(rows: PricelistRow[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(rows));
}

function nextSrNo(rows: PricelistRow[]): number {
  return rows.length === 0 ? 1 : Math.max(...rows.map((r) => r.srNo)) + 1;
}

// ─── Print / Export helpers ───────────────────────────────────────────────────

function printPricelist(rows: PricelistRow[], company: CompanyProfile | null) {
  const brandHtml = buildBrandingHtml(company);
  const styleMatch = brandHtml.match(/<style>[\s\S]*?<\/style>/);
  const styleBlock = styleMatch ? styleMatch[0] : "";
  const bodyHtml = brandHtml.replace(/<style>[\s\S]*?<\/style>/, "");

  const tableRows = rows
    .sort((a, b) => a.srNo - b.srNo)
    .map(
      (p) =>
        `<tr>
        <td style="text-align:center;border:1px solid #ddd;padding:6px 8px;">${p.srNo}</td>
        <td style="border:1px solid #ddd;padding:6px 8px;">${p.name}</td>
        <td style="color:#555;border:1px solid #ddd;padding:6px 8px;">${p.composition || "—"}</td>
        <td style="text-align:right;border:1px solid #ddd;padding:6px 8px;">&#8377;${p.mrp.toFixed(2)}</td>
        <td style="text-align:right;border:1px solid #ddd;padding:6px 8px;">&#8377;${p.pts.toFixed(2)}</td>
        <td style="text-align:right;border:1px solid #ddd;padding:6px 8px;">&#8377;${p.ptr.toFixed(2)}</td>
      </tr>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Products Pricelist</title>
  ${styleBlock}
</head>
<body>
  ${bodyHtml}
  <h3 style="font-family:Arial,sans-serif;font-size:15px;margin:0 0 12px;font-weight:bold;">Products Pricelist</h3>
  <table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px;">
    <thead>
      <tr style="background:#f0f0f0;">
        <th style="border:1px solid #ddd;padding:6px 8px;text-align:center;">Sr. No.</th>
        <th style="border:1px solid #ddd;padding:6px 8px;text-align:left;">Product Name</th>
        <th style="border:1px solid #ddd;padding:6px 8px;text-align:left;">Composition</th>
        <th style="border:1px solid #ddd;padding:6px 8px;text-align:right;">MRP</th>
        <th style="border:1px solid #ddd;padding:6px 8px;text-align:right;">PTS</th>
        <th style="border:1px solid #ddd;padding:6px 8px;text-align:right;">PTR</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows || `<tr><td colspan="6" style="text-align:center;padding:16px;color:#666;">No products</td></tr>`}
    </tbody>
  </table>
</body>
</html>`;

  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) {
    toast.error("Popup blocked — please allow popups.");
    return;
  }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

function exportPricelistXlsx(
  rows: PricelistRow[],
  company: CompanyProfile | null,
) {
  const brandRows = buildBrandingExcelRows(company).map((r) =>
    Object.values(r),
  );
  const heading = [
    "Sr. No.",
    "Product Name",
    "Composition",
    "MRP",
    "PTS",
    "PTR",
  ];
  const dataRows = rows
    .sort((a, b) => a.srNo - b.srNo)
    .map((p) => [p.srNo, p.name, p.composition, p.mrp, p.pts, p.ptr]);

  const ws = XLSX.utils.aoa_to_sheet([...brandRows, heading, ...dataRows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Pricelist");
  XLSX.writeFile(wb, "pricelist.xlsx");
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  portalRole: Role;
  canManage?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PricelistPage({
  portalRole,
  canManage = false,
}: Props) {
  const { session } = useAuthStore();
  const [rows, setRows] = useState<PricelistRow[]>([]);
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [useBackend, setUseBackend] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!session?.token) {
      setRows(lsLoad());
      return;
    }
    try {
      const result = await api.listPricelistProducts(session.token);
      if (result.length > 0 || useBackend) {
        setRows(result.map(fromBackend));
        setUseBackend(true);
        return;
      }
    } catch {
      // fall through to local storage
    }
    setRows(lsLoad());
  }, [session?.token, useBackend]);

  useEffect(() => {
    setLoading(true);
    void loadData().finally(() => setLoading(false));
    if (session?.token) {
      api
        .getCompanyProfile(session.token)
        .then(setCompany)
        .catch(() => {});
    }
  }, [loadData, session?.token]);

  // ── Filtered rows ─────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const sorted = [...rows].sort((a, b) => a.srNo - b.srNo);
    if (!search.trim()) return sorted;
    const q = search.toLowerCase();
    return sorted.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.composition.toLowerCase().includes(q),
    );
  }, [rows, search]);

  // ── CRUD ──────────────────────────────────────────────────────────────────

  const handleNew = () => {
    setEditingId(null);
    setForm(emptyForm());
    setShowForm(true);
  };

  const handleEdit = (p: PricelistRow) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      composition: p.composition,
      mrp: p.mrp,
      pts: p.pts,
      ptr: p.ptr,
    });
    setShowForm(true);
  };

  const validate = (): boolean => {
    if (!form.name.trim()) {
      toast.error("Product name is required");
      return false;
    }
    if (form.mrp < 0 || form.pts < 0 || form.ptr < 0) {
      toast.error("Prices must be 0 or greater");
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate() || !session?.token) return;
    setSaving(true);
    try {
      const input: AddPricelistProductInput = {
        name: form.name.trim(),
        composition: form.composition.trim(),
        mrp: form.mrp,
        pts: form.pts,
        ptr: form.ptr,
      };

      if (useBackend) {
        let res:
          | { __kind__: "ok"; ok: unknown }
          | { __kind__: "err"; err: string };
        if (editingId) {
          res = await api.updatePricelistProduct(
            session.token,
            BigInt(editingId),
            input,
          );
        } else {
          res = await api.addPricelistProduct(session.token, input);
        }
        if (res.__kind__ === "ok") {
          toast.success(editingId ? "Product updated" : "Product added");
          setShowForm(false);
          setEditingId(null);
          await loadData();
        } else {
          toast.error(res.err || "Save failed");
        }
      } else {
        const all = lsLoad();
        if (editingId) {
          lsSave(all.map((p) => (p.id === editingId ? { ...p, ...input } : p)));
        } else {
          const newRow: PricelistRow = {
            id: crypto.randomUUID(),
            srNo: nextSrNo(all),
            ...input,
          };
          lsSave([...all, newRow]);
        }
        setRows(lsLoad());
        toast.success(editingId ? "Product updated" : "Product added");
        setShowForm(false);
        setEditingId(null);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!session?.token) return;
    try {
      if (useBackend) {
        const res = await api.deletePricelistProduct(session.token, BigInt(id));
        if (res.__kind__ === "ok") {
          toast.success("Product deleted");
          await loadData();
        } else {
          toast.error(res.err || "Delete failed");
        }
      } else {
        const updated = lsLoad().filter((p) => p.id !== id);
        lsSave(updated);
        setRows(updated);
        toast.success("Product deleted");
      }
    } catch {
      toast.error("Failed to delete product");
    } finally {
      setConfirmDeleteId(null);
    }
  };

  // ── Bulk Upload ────────────────────────────────────────────────────────────

  const handleBulkFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session?.token) return;
    setBulkUploading(true);
    e.target.value = "";
    try {
      const text = await file.text();
      const lines = text.split("\n").filter((l) => l.trim());
      const startIdx =
        lines[0]?.toLowerCase().includes("product") ||
        lines[0]?.toLowerCase().includes("name")
          ? 1
          : 0;

      const inputs: AddPricelistProductInput[] = [];
      let errors = 0;

      for (let i = startIdx; i < lines.length; i++) {
        const cols = lines[i]
          .split(/[,\t]/)
          .map((c) => c.replace(/^"|"$/g, "").trim());
        if (cols.length < 3) {
          errors++;
          continue;
        }

        let name = "";
        let composition = "";
        let mrp = 0;
        let pts = 0;
        let ptr = 0;
        const firstIsNum = !Number.isNaN(Number(cols[0])) && cols[0] !== "";

        if (firstIsNum && cols.length >= 6) {
          name = cols[1];
          composition = cols[2];
          mrp = Number.parseFloat(cols[3]) || 0;
          pts = Number.parseFloat(cols[4]) || 0;
          ptr = Number.parseFloat(cols[5]) || 0;
        } else if (cols.length >= 5) {
          name = cols[0];
          composition = cols[1];
          mrp = Number.parseFloat(cols[2]) || 0;
          pts = Number.parseFloat(cols[3]) || 0;
          ptr = Number.parseFloat(cols[4]) || 0;
        } else if (cols.length >= 3) {
          name = cols[0];
          composition = cols[1];
          mrp = Number.parseFloat(cols[2]) || 0;
        } else {
          errors++;
          continue;
        }

        if (!name.trim()) {
          errors++;
          continue;
        }
        inputs.push({
          name: name.trim(),
          composition: composition.trim(),
          mrp,
          pts,
          ptr,
        });
      }

      if (inputs.length === 0) {
        toast.error(`No valid rows found (${errors} rows skipped)`);
        return;
      }

      if (useBackend) {
        const res = await api.bulkAddPricelistProducts(session.token, inputs);
        toast.success(
          `Added ${res.added} products${errors > 0 ? ` (${errors} skipped)` : ""}`,
        );
        await loadData();
      } else {
        const existing = lsLoad();
        let srCount = nextSrNo(existing);
        const newRows: PricelistRow[] = inputs.map((inp) => ({
          id: crypto.randomUUID(),
          srNo: srCount++,
          ...inp,
        }));
        lsSave([...existing, ...newRows]);
        setRows(lsLoad());
        toast.success(
          `Added ${inputs.length} products${errors > 0 ? ` (${errors} skipped)` : ""}`,
        );
      }
    } catch {
      toast.error("Failed to parse file");
    } finally {
      setBulkUploading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <PortalLayout portalRole={portalRole}>
      <PageHeader
        title="Products Pricelist"
        subtitle="Complete product price reference including MRP, PTS, and PTR"
        actions={
          canManage ? (
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => fileInputRef.current?.click()}
                disabled={bulkUploading}
                data-ocid="pricelist-bulk-upload-btn"
              >
                <Upload className="w-4 h-4" />
                {bulkUploading ? "Importing…" : "Bulk Upload"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xls,.xlsx,.txt"
                className="hidden"
                onChange={handleBulkFile}
              />
              <Button
                size="sm"
                onClick={handleNew}
                className="gap-1.5"
                data-ocid="pricelist-add-btn"
              >
                + Add Product
              </Button>
            </div>
          ) : undefined
        }
      />

      <PageContent>
        {/* Add / Edit Form */}
        {showForm && canManage && (
          <div className="bg-card border border-border rounded-lg p-5 mb-6 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-display font-semibold text-foreground uppercase tracking-wider">
                {editingId ? "Edit Product" : "Add New Product"}
              </h2>
              <button
                type="button"
                aria-label="Close form"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
                className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="sm:col-span-2 lg:col-span-2 flex flex-col gap-1.5">
                <Label htmlFor="pl-name" className="text-xs font-display">
                  Product Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="pl-name"
                  placeholder="e.g. Amoxicillin 500mg Cap"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  data-ocid="pricelist-name-input"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="pl-composition"
                  className="text-xs font-display"
                >
                  Composition
                </Label>
                <Input
                  id="pl-composition"
                  placeholder="e.g. Amoxicillin Trihydrate"
                  value={form.composition}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, composition: e.target.value }))
                  }
                  data-ocid="pricelist-composition-input"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pl-mrp" className="text-xs font-display">
                  MRP (&#8377;)
                </Label>
                <Input
                  id="pl-mrp"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={form.mrp || ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      mrp: Number.parseFloat(e.target.value) || 0,
                    }))
                  }
                  data-ocid="pricelist-mrp-input"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pl-pts" className="text-xs font-display">
                  PTS (&#8377;)
                </Label>
                <Input
                  id="pl-pts"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={form.pts || ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      pts: Number.parseFloat(e.target.value) || 0,
                    }))
                  }
                  data-ocid="pricelist-pts-input"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pl-ptr" className="text-xs font-display">
                  PTR (&#8377;)
                </Label>
                <Input
                  id="pl-ptr"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={form.ptr || ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      ptr: Number.parseFloat(e.target.value) || 0,
                    }))
                  }
                  data-ocid="pricelist-ptr-input"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                data-ocid="pricelist-save-btn"
              >
                {saving
                  ? "Saving…"
                  : editingId
                    ? "Update Product"
                    : "Add Product"}
              </Button>
            </div>
          </div>
        )}

        {/* Search + Export toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by name or composition…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-ocid="pricelist-search"
            />
          </div>
          <div className="flex gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => printPricelist(filtered, company)}
              data-ocid="pricelist-print-btn"
            >
              <Printer className="w-4 h-4" />
              Print
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => exportPricelistXlsx(rows, company)}
              data-ocid="pricelist-export-btn"
            >
              <Download className="w-4 h-4" />
              Export
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-2 mb-3">
          <Badge variant="secondary" className="gap-1.5 text-xs">
            <Tag className="w-3 h-3" />
            {rows.length} product{rows.length !== 1 ? "s" : ""}
          </Badge>
          {search && (
            <Badge variant="outline" className="text-xs">
              {filtered.length} result{filtered.length !== 1 ? "s" : ""} for
              &ldquo;{search}&rdquo;
            </Badge>
          )}
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden shadow-subtle">
          {loading ? (
            <div className="divide-y divide-border">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="px-4 py-3 flex gap-3 animate-pulse">
                  <div className="w-8 h-4 bg-muted rounded" />
                  <div className="flex-1 h-4 bg-muted rounded" />
                  <div className="w-24 h-4 bg-muted rounded hidden md:block" />
                  <div className="w-16 h-4 bg-muted rounded" />
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-20 text-center px-4"
              data-ocid="pricelist-empty-state"
            >
              <FileSpreadsheet className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <p className="text-sm font-display font-semibold text-foreground mb-1">
                No products in pricelist
              </p>
              <p className="text-xs text-muted-foreground max-w-xs">
                {canManage
                  ? `Click "Add Product" to add your first product, or use "Bulk Upload" to import a CSV file.`
                  : "The pricelist is currently empty. Please contact Admin or HR to add products."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-14 text-center text-xs font-display">
                      Sr.
                    </TableHead>
                    <TableHead className="text-xs font-display">
                      Product Name
                    </TableHead>
                    <TableHead className="text-xs font-display hidden md:table-cell">
                      Composition
                    </TableHead>
                    <TableHead className="text-xs font-display text-right">
                      MRP
                    </TableHead>
                    <TableHead className="text-xs font-display text-right hidden sm:table-cell">
                      PTS
                    </TableHead>
                    <TableHead className="text-xs font-display text-right hidden sm:table-cell">
                      PTR
                    </TableHead>
                    {canManage && (
                      <TableHead className="w-20 text-xs font-display text-center">
                        Actions
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow
                      key={p.id}
                      className="hover:bg-muted/20"
                      data-ocid={`pricelist-row-${p.id}`}
                    >
                      <TableCell className="text-center text-sm text-muted-foreground font-mono">
                        {p.srNo}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium text-foreground">
                          {p.name}
                        </span>
                        {p.composition && (
                          <p className="text-xs text-muted-foreground mt-0.5 md:hidden">
                            {p.composition}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-[200px] truncate">
                        {p.composition || "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm font-mono font-semibold text-foreground">
                        &#8377;{p.mrp.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-mono hidden sm:table-cell text-muted-foreground">
                        &#8377;{p.pts.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-mono hidden sm:table-cell text-muted-foreground">
                        &#8377;{p.ptr.toFixed(2)}
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              aria-label="Edit product"
                              data-ocid={`edit-product-${p.id}`}
                              onClick={() => handleEdit(p)}
                              className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {confirmDeleteId === p.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleDelete(p.id)}
                                  className="text-xs px-1.5 py-0.5 rounded bg-destructive text-white hover:bg-destructive/90 transition-colors"
                                >
                                  Del
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="text-xs px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 transition-colors"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                aria-label="Delete product"
                                data-ocid={`delete-product-${p.id}`}
                                onClick={() => setConfirmDeleteId(p.id)}
                                className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Bulk upload tip */}
        {canManage && (
          <div className="mt-4 bg-muted/30 border border-border rounded-md px-4 py-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">
                &#128203; Bulk Upload format:
              </strong>{" "}
              CSV/Excel with columns:{" "}
              <span className="font-mono bg-muted px-1 rounded text-xs">
                Product Name, Composition, MRP, PTS, PTR
              </span>
              . Optionally include Sr. No. as the first column. Header rows are
              auto-detected and skipped.
            </p>
          </div>
        )}
      </PageContent>
    </PortalLayout>
  );
}
