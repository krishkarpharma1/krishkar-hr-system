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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Download,
  FileSpreadsheet,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import type { Role } from "../../backend.d";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { useCompanyProfile } from "../../hooks/useCompanyProfile";
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toFixed(2);
}

// ─── Form Modal ───────────────────────────────────────────────────────────────

interface FormFields {
  name: string;
  composition: string;
  mrp: string;
  pts: string;
  ptr: string;
}

const EMPTY_FORM: FormFields = {
  name: "",
  composition: "",
  mrp: "",
  pts: "",
  ptr: "",
};

function validateForm(f: FormFields): string | null {
  if (!f.name.trim()) return "Product Name is required";
  if (!f.composition.trim()) return "Composition is required";
  if (!f.mrp || Number.isNaN(Number(f.mrp)) || Number(f.mrp) <= 0)
    return "MRP must be a positive number";
  if (!f.pts || Number.isNaN(Number(f.pts)) || Number(f.pts) <= 0)
    return "PTS must be a positive number";
  if (!f.ptr || Number.isNaN(Number(f.ptr)) || Number(f.ptr) <= 0)
    return "PTR must be a positive number";
  return null;
}

function ProductFormModal({
  open,
  onClose,
  onSave,
  initial,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (f: FormFields) => void;
  initial?: FormFields;
  saving: boolean;
}) {
  const [form, setForm] = useState<FormFields>(initial ?? EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(initial ?? EMPTY_FORM);
      setError(null);
    }
  }, [open, initial]);

  function handleSave() {
    const err = validateForm(form);
    if (err) {
      setError(err);
      return;
    }
    onSave(form);
  }

  function field(
    label: string,
    key: keyof FormFields,
    inputType = "text",
    placeholder?: string,
    readOnly?: boolean,
  ) {
    return (
      <div className="flex flex-col gap-1">
        <Label className="text-xs font-body text-muted-foreground">
          {label}
        </Label>
        <Input
          type={inputType}
          value={form[key]}
          onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
          placeholder={placeholder}
          readOnly={readOnly}
          className="h-9 text-sm"
          min={inputType === "number" ? "0.01" : undefined}
          step={inputType === "number" ? "0.01" : undefined}
        />
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-foreground">
            {initial ? "Edit Product" : "Add Product"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {error && (
            <p className="text-xs text-destructive font-body bg-destructive/10 px-3 py-2 rounded">
              {error}
            </p>
          )}
          {field("Product Name *", "name", "text", "e.g. Amoxicillin 500mg")}
          {field(
            "Composition *",
            "composition",
            "text",
            "e.g. Amoxicillin Trihydrate",
          )}
          <div className="grid grid-cols-3 gap-3">
            {field("MRP (₹) *", "mrp", "number", "0.00")}
            {field("PTS (₹) *", "pts", "number", "0.00")}
            {field("PTR (₹) *", "ptr", "number", "0.00")}
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={saving}
            data-ocid="pricelist-form-cancel"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            data-ocid="pricelist-form-save"
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Confirm Dialog ────────────────────────────────────────────────────

function DeleteConfirmDialog({
  open,
  productName,
  onConfirm,
  onCancel,
  deleting,
}: {
  open: boolean;
  productName: string;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-destructive">
            Delete Product
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm font-body text-foreground py-2">
          Are you sure you want to delete{" "}
          <span className="font-semibold">{productName}</span>? This action
          cannot be undone.
        </p>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={deleting}
            data-ocid="pricelist-delete-cancel"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onConfirm}
            disabled={deleting}
            data-ocid="pricelist-delete-confirm"
          >
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Bulk Upload Row ──────────────────────────────────────────────────────────

interface BulkRow extends AddPricelistProductInput {
  _rowNum: number;
  _errors: string[];
}

function validateBulkRow(r: Record<string, unknown>, idx: number): BulkRow {
  const errors: string[] = [];
  const name = String(r["Product Name"] ?? r.name ?? "").trim();
  const composition = String(r.Composition ?? r.composition ?? "").trim();
  const mrpRaw = Number(r.MRP ?? r.mrp ?? 0);
  const ptsRaw = Number(r.PTS ?? r.pts ?? 0);
  const ptrRaw = Number(r.PTR ?? r.ptr ?? 0);

  if (!name) errors.push("Product Name required");
  if (!composition) errors.push("Composition required");
  if (!mrpRaw || mrpRaw <= 0) errors.push("MRP must be > 0");
  if (!ptsRaw || ptsRaw <= 0) errors.push("PTS must be > 0");
  if (!ptrRaw || ptrRaw <= 0) errors.push("PTR must be > 0");

  return {
    _rowNum: idx + 1,
    _errors: errors,
    name,
    composition,
    mrp: mrpRaw,
    pts: ptsRaw,
    ptr: ptrRaw,
  };
}

function BulkUploadModal({
  open,
  onClose,
  onUpload,
}: {
  open: boolean;
  onClose: () => void;
  onUpload: (rows: AddPricelistProductInput[]) => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSummary(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const parsed = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
        setRows(parsed.map((r, i) => validateBulkRow(r, i)));
      } catch {
        toast.error("Failed to parse file. Please use .xls, .xlsx, or .csv");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleConfirm() {
    const valid = rows.filter((r) => r._errors.length === 0);
    if (valid.length === 0) {
      toast.error("No valid rows to upload");
      return;
    }
    setUploading(true);
    await onUpload(valid);
    setSummary(
      `${valid.length} product${valid.length !== 1 ? "s" : ""} uploaded. ${rows.length - valid.length} row${rows.length - valid.length !== 1 ? "s" : ""} skipped due to errors.`,
    );
    setUploading(false);
  }

  function handleClose() {
    setRows([]);
    setSummary(null);
    if (fileRef.current) fileRef.current.value = "";
    onClose();
  }

  const allValid = rows.length > 0 && rows.every((r) => r._errors.length === 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-foreground">
            Bulk Upload Pricelist
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-xs text-muted-foreground font-body">
            Upload .xls, .xlsx, or .csv with columns:{" "}
            <span className="font-semibold text-foreground">
              Product Name, Composition, MRP, PTS, PTR
            </span>
          </p>
          <Input
            ref={fileRef}
            type="file"
            accept=".xls,.xlsx,.csv"
            onChange={handleFileChange}
            className="h-9 text-xs"
            data-ocid="pricelist-bulk-file"
          />

          {summary && (
            <div className="bg-primary/10 border border-primary/20 rounded px-3 py-2 text-sm font-body text-foreground">
              {summary}
            </div>
          )}

          {rows.length > 0 && !summary && (
            <div className="overflow-auto max-h-72 border border-border rounded">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    {[
                      "#",
                      "Product Name",
                      "Composition",
                      "MRP",
                      "PTS",
                      "PTR",
                      "Status",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-2 py-1.5 text-left font-semibold text-muted-foreground font-body"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r._rowNum}
                      className={
                        r._errors.length > 0
                          ? "bg-destructive/10"
                          : "bg-background"
                      }
                    >
                      <td className="px-2 py-1 text-muted-foreground">
                        {r._rowNum}
                      </td>
                      <td className="px-2 py-1">{r.name}</td>
                      <td className="px-2 py-1">{r.composition}</td>
                      <td className="px-2 py-1 text-right">{fmt(r.mrp)}</td>
                      <td className="px-2 py-1 text-right">{fmt(r.pts)}</td>
                      <td className="px-2 py-1 text-right">{fmt(r.ptr)}</td>
                      <td className="px-2 py-1">
                        {r._errors.length > 0 ? (
                          <span className="text-destructive font-semibold">
                            {r._errors.join("; ")}
                          </span>
                        ) : (
                          <span className="text-green-600 font-semibold">
                            ✓ Valid
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClose}
            data-ocid="pricelist-bulk-cancel"
          >
            Cancel
          </Button>
          {!summary && (
            <Button
              size="sm"
              onClick={handleConfirm}
              disabled={!allValid || uploading}
              data-ocid="pricelist-bulk-confirm"
            >
              {uploading
                ? "Uploading…"
                : `Confirm & Upload (${rows.filter((r) => r._errors.length === 0).length} rows)`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

interface ProductsPricelistProps {
  portalRole: Role;
}

export default function ProductsPricelist({
  portalRole,
}: ProductsPricelistProps) {
  const { session } = useAuthStore();
  const { companyProfile } = useCompanyProfile();
  const [products, setProducts] = useState<PricelistProductInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"srNo" | "name">("srNo");

  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<PricelistProductInfo | null>(null);
  const [deleteItem, setDeleteItem] = useState<PricelistProductInfo | null>(
    null,
  );
  const [bulkOpen, setBulkOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canMutate =
    portalRole === "Admin" || (portalRole as string) === "HRManager";

  const load = useCallback(async () => {
    if (!session?.token) return;
    setLoading(true);
    try {
      const data = await api.listPricelistProducts(session.token);
      setProducts(data);
    } catch {
      toast.error("Failed to load pricelist");
    } finally {
      setLoading(false);
    }
  }, [session?.token]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = products
    .filter(
      (p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.composition.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => {
      if (sortBy === "srNo") return Number(a.srNo) - Number(b.srNo);
      return a.name.localeCompare(b.name);
    });

  // ── Add
  async function handleAdd(form: FormFields) {
    if (!session?.token) return;
    setSaving(true);
    const result = await api.addPricelistProduct(session.token, {
      name: form.name.trim(),
      composition: form.composition.trim(),
      mrp: Number(form.mrp),
      pts: Number(form.pts),
      ptr: Number(form.ptr),
    });
    setSaving(false);
    if (result.__kind__ === "err") {
      toast.error(result.err);
    } else {
      toast.success("Product added to pricelist");
      setAddOpen(false);
      load();
    }
  }

  // ── Edit
  async function handleEdit(form: FormFields) {
    if (!session?.token || !editItem) return;
    setSaving(true);
    const result = await api.updatePricelistProduct(
      session.token,
      editItem.id,
      {
        name: form.name.trim(),
        composition: form.composition.trim(),
        mrp: Number(form.mrp),
        pts: Number(form.pts),
        ptr: Number(form.ptr),
      },
    );
    setSaving(false);
    if (result.__kind__ === "err") {
      toast.error(result.err);
    } else {
      toast.success("Product updated");
      setEditItem(null);
      load();
    }
  }

  // ── Delete
  async function handleDelete() {
    if (!session?.token || !deleteItem) return;
    setDeleting(true);
    const result = await api.deletePricelistProduct(
      session.token,
      deleteItem.id,
    );
    setDeleting(false);
    if (result.__kind__ === "err") {
      toast.error(result.err);
    } else {
      toast.success("Product deleted");
      setDeleteItem(null);
      load();
    }
  }

  // ── Bulk upload
  async function handleBulkUpload(rows: AddPricelistProductInput[]) {
    if (!session?.token) return;
    const result = await api.bulkAddPricelistProducts(session.token, rows);
    if (result.errors.length > 0) {
      toast.warning(
        `${result.added} added. Errors: ${result.errors.slice(0, 3).join("; ")}`,
      );
    } else {
      toast.success(`${result.added} products added successfully`);
    }
    setBulkOpen(false);
    load();
  }

  // ── Print
  function handlePrint() {
    const headerHtml = buildBrandingHtml(companyProfile ?? null);
    const rows = filtered
      .map(
        (p, i) => `<tr style="border-bottom:1px solid #eee;">
          <td style="padding:6px 8px;text-align:center;">${i + 1}</td>
          <td style="padding:6px 8px;">${p.name}</td>
          <td style="padding:6px 8px;">${p.composition}</td>
          <td style="padding:6px 8px;text-align:right;">₹${fmt(p.mrp)}</td>
          <td style="padding:6px 8px;text-align:right;">₹${fmt(p.pts)}</td>
          <td style="padding:6px 8px;text-align:right;">₹${fmt(p.ptr)}</td>
        </tr>`,
      )
      .join("");

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Products Pricelist</title>
      <style>
        @page { size: A4; margin: 0.5cm 2cm 1.5cm 2cm; }
        body { font-family: Arial, sans-serif; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #00BCD4; color: #fff; padding: 8px; text-align: left; font-size: 11px; }
        th:nth-child(1) { text-align: center; width: 48px; }
        th:last-child, th:nth-child(4), th:nth-child(5), th:nth-child(6) { text-align: right; }
        td:nth-child(1) { text-align: center; }
        td:last-child, td:nth-child(4), td:nth-child(5), td:nth-child(6) { text-align: right; }
        h3 { margin: 0 0 12px; font-size: 14px; }
        .footer-bar { position: fixed; bottom: 0; left: 0; right: 0; background: #00BCD4; padding: 8px 0; text-align: center; }
        .footer-bar span { color: #fff; font-weight: bold; font-size: 12px; }
      </style>
    </head><body>
      ${headerHtml}
      <h3 style="margin-bottom:12px;">Products Pricelist</h3>
      <table>
        <thead><tr>
          <th>#</th><th>Product Name</th><th>Composition</th><th>MRP (₹)</th><th>PTS (₹)</th><th>PTR (₹)</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer-bar"><span>Krishkar Pharmaceuticals : Empowering Health</span></div>
    </body></html>`);
    win.document.close();
    win.print();
  }

  // ── Export Excel
  function handleExportExcel() {
    if (filtered.length === 0) {
      toast.warning("No products to export");
      return;
    }
    const brandRows = buildBrandingExcelRows(companyProfile ?? null);
    const dataRows = filtered.map((p, i) => ({
      "Sr. No.": i + 1,
      "Product Name": p.name,
      Composition: p.composition,
      "MRP (₹)": p.mrp,
      "PTS (₹)": p.pts,
      "PTR (₹)": p.ptr,
    }));
    const allRows = [
      ...brandRows,
      { "": "Products Pricelist" },
      { "": "" },
      ...(dataRows as unknown as Record<string, unknown>[]),
    ];
    const ws = XLSX.utils.json_to_sheet(allRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pricelist");
    XLSX.writeFile(
      wb,
      `products-pricelist-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
    toast.success(`Exported ${filtered.length} products`);
  }

  const editInitial: FormFields | undefined = editItem
    ? {
        name: editItem.name,
        composition: editItem.composition,
        mrp: String(editItem.mrp),
        pts: String(editItem.pts),
        ptr: String(editItem.ptr),
      }
    : undefined;

  return (
    <PortalLayout portalRole={portalRole}>
      <PageHeader
        title="Products Pricelist"
        subtitle="View and manage the company product pricelist with MRP, PTS, and PTR"
      />
      <PageContent>
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by name or composition…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
              data-ocid="pricelist-search"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-body ml-1">
            <span>Sort:</span>
            {(["srNo", "name"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSortBy(s)}
                className={`px-2 py-1 rounded text-xs transition-colors ${sortBy === s ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                {s === "srNo" ? "Sr. No." : "Name"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="h-9 gap-1.5"
              data-ocid="pricelist-print-btn"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Print</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              className="h-9 gap-1.5"
              data-ocid="pricelist-export-btn"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export Excel</span>
            </Button>
            {canMutate && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBulkOpen(true)}
                  className="h-9 gap-1.5"
                  data-ocid="pricelist-bulk-btn"
                >
                  <Upload className="w-4 h-4" />
                  <span className="hidden sm:inline">Bulk Upload</span>
                </Button>
                <Button
                  size="sm"
                  onClick={() => setAddOpen(true)}
                  className="h-9 gap-1.5"
                  data-ocid="pricelist-add-btn"
                >
                  <Plus className="w-4 h-4" />
                  Add Product
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {[
                    "Sr. No.",
                    "Product Name",
                    "Composition",
                    "MRP (₹)",
                    "PTS (₹)",
                    "PTR (₹)",
                    ...(canMutate ? ["Actions"] : []),
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold font-display text-muted-foreground whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }, (_, i) => `skeleton-row-${i}`).map(
                    (rowKey) => (
                      <tr key={rowKey} className="border-b border-border/50">
                        {Array.from(
                          { length: canMutate ? 7 : 6 },
                          (_, j) => `skeleton-cell-${j}`,
                        ).map((cellKey) => (
                          <td key={cellKey} className="px-4 py-3">
                            <Skeleton className="h-4 w-full" />
                          </td>
                        ))}
                      </tr>
                    ),
                  )
                ) : filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={canMutate ? 7 : 6}
                      className="px-4 py-12 text-center"
                    >
                      <FileSpreadsheet className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                      <p className="text-sm font-body text-muted-foreground">
                        {search
                          ? "No products match your search"
                          : "No products in pricelist yet"}
                      </p>
                      {canMutate && !search && (
                        <Button
                          size="sm"
                          className="mt-4"
                          onClick={() => setAddOpen(true)}
                          data-ocid="pricelist-empty-add"
                        >
                          <Plus className="w-4 h-4 mr-1.5" />
                          Add First Product
                        </Button>
                      )}
                    </td>
                  </tr>
                ) : (
                  filtered.map((p, idx) => (
                    <tr
                      key={String(p.id)}
                      className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                      data-ocid={`pricelist-row-${String(p.id)}`}
                    >
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        {p.name}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {p.composition}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-foreground">
                        ₹{fmt(p.mrp)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-foreground">
                        ₹{fmt(p.pts)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-foreground">
                        ₹{fmt(p.ptr)}
                      </td>
                      {canMutate && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => setEditItem(p)}
                              aria-label={`Edit ${p.name}`}
                              data-ocid={`pricelist-edit-${String(p.id)}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={() => setDeleteItem(p)}
                              aria-label={`Delete ${p.name}`}
                              data-ocid={`pricelist-delete-${String(p.id)}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div className="px-4 py-2 border-t border-border bg-muted/20 flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-body">
                {filtered.length} product{filtered.length !== 1 ? "s" : ""}
                {search ? " (filtered)" : ""}
              </span>
            </div>
          )}
        </div>
      </PageContent>

      {/* Modals */}
      <ProductFormModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={handleAdd}
        saving={saving}
      />
      <ProductFormModal
        open={!!editItem}
        onClose={() => setEditItem(null)}
        onSave={handleEdit}
        initial={editInitial}
        saving={saving}
      />
      <DeleteConfirmDialog
        open={!!deleteItem}
        productName={deleteItem?.name ?? ""}
        onConfirm={handleDelete}
        onCancel={() => setDeleteItem(null)}
        deleting={deleting}
      />
      <BulkUploadModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onUpload={handleBulkUpload}
      />
    </PortalLayout>
  );
}
