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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertCircle,
  Download,
  Edit2,
  Gift,
  Loader2,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Role } from "../../backend";
import type { GiftArticleInfo } from "../../backend.d";
import {
  DataTable,
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = ["Promotional", "Educational", "Utility", "Other"] as const;
type Category = (typeof CATEGORIES)[number];

interface FormState {
  name: string;
  category: Category | "";
  description: string;
}

const EMPTY_FORM: FormState = { name: "", category: "", description: "" };

function safeArray<T>(val: unknown): T[] {
  return Array.isArray(val) ? (val as T[]) : [];
}

// ── Bulk Import Types ─────────────────────────────────────────────────────────

interface BulkRow {
  name: string;
  category: string;
  description: string;
}

interface RowError {
  row: number;
  name: string;
  reason: string;
}

interface BulkState {
  fileName: string;
  totalRows: number;
  validRows: BulkRow[];
  errors: RowError[];
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface GiftArticleMasterProps {
  portalRole?: "Admin" | "HRManager";
}

// ── Component ────────────────────────────────────────────────────────────────

export default function GiftArticleMaster({
  portalRole = "Admin",
}: GiftArticleMasterProps) {
  const { session } = useAuthStore();
  const role = portalRole === "Admin" ? Role.Admin : Role.HRManager;

  // ── Data state ──────────────────────────────────────────────────────────
  const [articles, setArticles] = useState<GiftArticleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<Category | "all">("all");
  const [monthlyUsage, setMonthlyUsage] = useState<Map<string, number>>(
    new Map(),
  );

  // ── Modal state ─────────────────────────────────────────────────────────
  const [showDialog, setShowDialog] = useState(false);
  const [editArticle, setEditArticle] = useState<GiftArticleInfo | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // ── Delete / Deactivate state ───────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<GiftArticleInfo | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  // ── Bulk import state ───────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [bulk, setBulk] = useState<BulkState | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    created: number;
    skipped: number;
    errors: RowError[];
  } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // ── Load ────────────────────────────────────────────────────────────────
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-based
  const currentYear = now.getFullYear();

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    Promise.all([
      api.listAllGiftArticles(session.token),
      api.getGiftArticleMonthlyUsage(session.token, currentMonth, currentYear),
    ])
      .then(([arts, usageRaw]) => {
        setArticles(safeArray<GiftArticleInfo>(arts));
        const usageArr = safeArray<{
          articleId: string;
          totalQuantity: number;
        }>(usageRaw);
        const map = new Map<string, number>();
        for (const u of usageArr) {
          if (u?.articleId != null)
            map.set(String(u.articleId), Number(u.totalQuantity ?? 0));
        }
        setMonthlyUsage(map);
      })
      .catch(() => {
        toast.error("Failed to load gift articles");
      })
      .finally(() => setLoading(false));
  }, [session, currentMonth, currentYear]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Filtering ────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = articles;
    if (categoryFilter !== "all")
      list = list.filter((a) => a.category === categoryFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.category.toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [articles, categoryFilter, search]);

  const totalCount = articles.length;
  const activeCount = articles.filter((a) => a.isActive).length;

  // ── CRUD helpers ─────────────────────────────────────────────────────────
  function openCreate() {
    setEditArticle(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowDialog(true);
  }

  function openEdit(article: GiftArticleInfo) {
    setEditArticle(article);
    setForm({
      name: article.name,
      category: (CATEGORIES.includes(article.category as Category)
        ? article.category
        : "Other") as Category,
      description: article.description,
    });
    setFormError("");
    setShowDialog(true);
  }

  function closeDialog() {
    setShowDialog(false);
    setEditArticle(null);
    setForm(EMPTY_FORM);
    setFormError("");
  }

  function validateForm(): boolean {
    if (!form.name.trim()) {
      setFormError("Gift article name is required.");
      return false;
    }
    if (!form.category) {
      setFormError("Category is required.");
      return false;
    }
    return true;
  }

  async function handleSave() {
    if (!session || !validateForm()) return;
    setSaving(true);
    setFormError("");
    try {
      if (editArticle) {
        const res = await api.updateGiftArticle(session.token, editArticle.id, {
          name: form.name.trim(),
          category: form.category,
          description: form.description.trim(),
          isActive: editArticle.isActive,
        });
        if (res.__kind__ === "err") {
          toast.error(res.err);
          return;
        }
        toast.success("Gift article updated");
      } else {
        const res = await api.createGiftArticle(session.token, {
          name: form.name.trim(),
          category: form.category,
          description: form.description.trim(),
        });
        if (res.__kind__ === "err") {
          toast.error(res.err);
          return;
        }
        toast.success("Gift article created");
      }
      closeDialog();
      await load();
    } catch {
      toast.error("Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivateOrDelete() {
    if (!session || !deleteTarget) return;
    setDeleting(true);
    try {
      const res = await api.deleteGiftArticle(session.token, deleteTarget.id);
      if (res.__kind__ === "err") {
        toast.error(res.err);
        return;
      }
      toast.success(
        deleteTarget.isActive
          ? "Gift article deactivated"
          : "Gift article deleted",
      );
      await load();
    } catch {
      toast.error("Action failed. Please try again.");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  // ── Bulk Import Helpers ───────────────────────────────────────────────────

  function downloadTemplate() {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ["Gift Article Name", "Category", "Description (Optional)"],
      ["Pen", "Promotional", "Blue ballpoint pen with company logo"],
    ]);
    ws["!cols"] = [{ wch: 30 }, { wch: 20 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws, "Gift Articles");
    XLSX.writeFile(wb, "gift_articles_template.xlsx");
  }

  function normaliseCategory(raw: string): Category | null {
    const lower = raw.trim().toLowerCase();
    for (const cat of CATEGORIES) {
      if (cat.toLowerCase() === lower) return cat;
    }
    return null;
  }

  function parseFile(file: File) {
    setBulk(null);
    setImportResult(null);

    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(ext ?? "")) {
      toast.error("Invalid file type. Please upload .xlsx, .xls, or .csv");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: "binary" });
        const wsName = wb.SheetNames[0];
        if (!wsName) {
          toast.error("Empty or invalid Excel file.");
          return;
        }
        const ws = wb.Sheets[wsName];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
          defval: "",
        });

        if (rows.length === 0) {
          toast.error("No data rows found in the file.");
          return;
        }

        const validRows: BulkRow[] = [];
        const errors: RowError[] = [];

        for (const [i, row] of rows.entries()) {
          const rowNum = i + 2; // Excel row (header = 1)
          const name = String(
            (row as Record<string, unknown>)["Gift Article Name"] ??
              (row as Record<string, unknown>).Name ??
              "",
          ).trim();
          const catRaw = String(
            (row as Record<string, unknown>).Category ?? "",
          ).trim();
          const description = String(
            (row as Record<string, unknown>)["Description (Optional)"] ??
              (row as Record<string, unknown>).Description ??
              "",
          ).trim();

          // Skip completely blank rows
          if (!name && !catRaw && !description) continue;

          if (!name) {
            errors.push({
              row: rowNum,
              name: name || "(blank)",
              reason: "Gift Article Name is required.",
            });
            continue;
          }
          const category = normaliseCategory(catRaw);
          if (!category) {
            errors.push({
              row: rowNum,
              name,
              reason: `Category "${catRaw}" is invalid. Must be one of: ${CATEGORIES.join(", ")}.`,
            });
            continue;
          }
          validRows.push({ name, category, description });
        }

        setBulk({
          fileName: file.name,
          totalRows: validRows.length + errors.length,
          validRows,
          errors,
        });
      } catch {
        toast.error(
          "Failed to parse file. Please check the format and try again.",
        );
      }
    };
    reader.onerror = () => toast.error("Failed to read the file.");
    reader.readAsBinaryString(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) parseFile(file);
  }

  async function handleImport() {
    if (!session || !bulk || bulk.validRows.length === 0) return;
    setImporting(true);
    try {
      const result = await api.bulkImportGiftArticles(
        session.token,
        bulk.validRows.map((r) => ({
          name: r.name,
          category: r.category,
          description: r.description,
        })),
      );

      const created = Number(result.created ?? 0);
      const skipped = Number(result.skipped ?? 0);
      const backendErrors: RowError[] = safeArray<{
        row: number;
        name: string;
        reason: string;
      }>(result.errors).map((e) => ({
        row: Number(e.row),
        name: e.name,
        reason: e.reason,
      }));

      setImportResult({ created, skipped, errors: backendErrors });
      setBulk(null);
      toast.success(`${created} articles imported successfully.`);
      await load();
    } catch {
      toast.error("Import failed. Please try again.");
    } finally {
      setImporting(false);
    }
  }

  function downloadErrorReport(errors: RowError[]) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ["Row #", "Article Name", "Error Reason"],
      ...errors.map((e) => [e.row, e.name, e.reason]),
    ]);
    ws["!cols"] = [{ wch: 8 }, { wch: 30 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, ws, "Errors");
    XLSX.writeFile(wb, "gift_articles_import_errors.xlsx");
  }

  // ── Table columns ────────────────────────────────────────────────────────
  const cols = [
    { key: "srno", label: "Sr. No." },
    { key: "name", label: "Name" },
    { key: "category", label: "Category" },
    { key: "description", label: "Description" },
    { key: "giventhismonth", label: "Given This Month" },
    { key: "status", label: "Status" },
    { key: "actions", label: "Actions", className: "text-right" },
  ];

  return (
    <PortalLayout portalRole={role}>
      <PageHeader
        title="Gift Article Master"
        subtitle="Manage gift articles available in Doctor Call Entry"
        actions={
          <Button
            size="sm"
            onClick={openCreate}
            data-ocid="gift-article.open_modal_button"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add New Gift Article
          </Button>
        }
      />

      <PageContent>
        <Tabs defaultValue="list" className="w-full">
          <TabsList className="mb-4 bg-card border border-border">
            <TabsTrigger value="list" data-ocid="gift-article.tab.list">
              Article List
            </TabsTrigger>
            <TabsTrigger
              value="bulk-import"
              data-ocid="gift-article.tab.bulk-import"
            >
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              Bulk Import
            </TabsTrigger>
          </TabsList>

          {/* ── LIST TAB ──────────────────────────────────────────────── */}
          <TabsContent value="list">
            {/* Stats row */}
            <div className="flex gap-4 mb-4 flex-wrap text-sm">
              <span className="text-muted-foreground">
                Total articles:{" "}
                <strong className="text-foreground">{totalCount}</strong>
              </span>
              <span className="text-muted-foreground">
                Active:{" "}
                <strong className="text-green-700">{activeCount}</strong>
              </span>
              <span className="text-muted-foreground">
                Inactive:{" "}
                <strong className="text-foreground">
                  {totalCount - activeCount}
                </strong>
              </span>
            </div>

            {/* Filters */}
            <div className="flex gap-3 mb-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-8 h-9"
                  placeholder="Search by name or category…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  data-ocid="gift-article.search_input"
                />
              </div>
              <Select
                value={categoryFilter}
                onValueChange={(v) => setCategoryFilter(v as Category | "all")}
              >
                <SelectTrigger
                  className="h-9 w-[180px]"
                  data-ocid="gift-article.filter.tab"
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
            </div>

            {/* Table */}
            <DataTable
              columns={cols}
              data={filtered}
              getKey={(a) => String(a.id)}
              loading={loading}
              emptyMessage="No gift articles found. Click 'Add New Gift Article' to create one."
              renderRow={(a, idx) => {
                const usageCount = monthlyUsage.get(String(a.id)) ?? 0;
                return (
                  <>
                    <td
                      className="px-4 py-3 text-xs text-muted-foreground font-mono"
                      data-ocid={`gift-article.item.${idx + 1}`}
                    >
                      {idx + 1}
                    </td>
                    <td className="px-4 py-3 font-body font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <Gift className="w-3.5 h-3.5 text-primary shrink-0" />
                        {a.name}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded font-display">
                        {a.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground max-w-[240px] truncate">
                      {a.description || "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {usageCount > 0 ? (
                        <span className="inline-flex items-center justify-center bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold px-2 py-0.5 rounded-full min-w-[28px]">
                          {usageCount}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50 text-sm">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={a.isActive ? "default" : "secondary"}
                        className={`text-xs ${a.isActive ? "bg-green-100 text-green-700 border-green-200" : ""}`}
                      >
                        {a.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEdit(a)}
                          data-ocid={`gift-article.edit_button.${idx + 1}`}
                          aria-label="Edit gift article"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteTarget(a)}
                          data-ocid={`gift-article.delete_button.${idx + 1}`}
                          aria-label={
                            a.isActive
                              ? "Deactivate gift article"
                              : "Delete gift article"
                          }
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </>
                );
              }}
            />
          </TabsContent>

          {/* ── BULK IMPORT TAB ───────────────────────────────────────── */}
          <TabsContent value="bulk-import">
            <div className="max-w-2xl space-y-5">
              {/* Step 1: Download template */}
              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="font-display font-semibold text-sm mb-2 flex items-center gap-2">
                  <span className="bg-primary text-primary-foreground w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold">
                    1
                  </span>
                  Download Template
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Download the Excel template with the required columns. Fill in
                  the gift article data and upload it below.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadTemplate}
                  data-ocid="gift-article.bulk.download_template"
                >
                  <Download className="w-4 h-4 mr-1.5" />
                  Download Template
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Columns: <strong>Gift Article Name</strong>,{" "}
                  <strong>Category</strong> (Promotional / Educational / Utility
                  / Other), <strong>Description (Optional)</strong>
                </p>
              </div>

              {/* Step 2: Upload file */}
              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="font-display font-semibold text-sm mb-2 flex items-center gap-2">
                  <span className="bg-primary text-primary-foreground w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold">
                    2
                  </span>
                  Upload File
                </h3>

                <button
                  type="button"
                  className={`w-full border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                    isDragOver
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-muted/30"
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Upload file"
                  data-ocid="gift-article.bulk.dropzone"
                >
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium text-foreground">
                    Drag & drop or click to select file
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Accepts .xlsx, .xls, .csv
                  </p>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFileChange}
                  data-ocid="gift-article.bulk.upload_button"
                />
              </div>

              {/* Parse preview */}
              {bulk && (
                <div className="bg-card border border-border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-semibold text-sm flex items-center gap-2">
                      <span className="bg-primary text-primary-foreground w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold">
                        3
                      </span>
                      Preview — {bulk.fileName}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setBulk(null)}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Clear file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Summary */}
                  <div className="flex gap-4 text-sm flex-wrap">
                    <span className="text-muted-foreground">
                      Total rows:{" "}
                      <strong className="text-foreground">
                        {bulk.totalRows}
                      </strong>
                    </span>
                    <span className="text-green-700">
                      Valid: <strong>{bulk.validRows.length}</strong>
                    </span>
                    {bulk.errors.length > 0 && (
                      <span className="text-destructive">
                        Invalid: <strong>{bulk.errors.length}</strong>
                      </span>
                    )}
                  </div>

                  {/* Error list */}
                  {bulk.errors.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Rows with errors (will be skipped):
                      </p>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {bulk.errors.map((err) => (
                          <div
                            key={`${err.row}-${err.name}`}
                            className="text-xs bg-destructive/8 border border-destructive/20 rounded px-2.5 py-1.5 flex gap-2"
                          >
                            <span className="font-mono text-destructive font-semibold shrink-0">
                              Row {err.row}
                            </span>
                            <span className="text-foreground font-medium shrink-0">
                              {err.name}
                            </span>
                            <span className="text-muted-foreground">
                              {err.reason}
                            </span>
                          </div>
                        ))}
                      </div>
                      {bulk.errors.length > 3 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => downloadErrorReport(bulk.errors)}
                        >
                          <Download className="w-3 h-3 mr-1" />
                          Download Error Report
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Confirm import */}
                  <Button
                    onClick={handleImport}
                    disabled={importing || bulk.validRows.length === 0}
                    data-ocid="gift-article.bulk.submit_button"
                  >
                    {importing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                        Importing…
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-1.5" />
                        Import {bulk.validRows.length} Article
                        {bulk.validRows.length !== 1 ? "s" : ""}
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Import result */}
              {importResult && (
                <div className="bg-card border border-border rounded-lg p-4 space-y-2">
                  <h3 className="font-display font-semibold text-sm text-green-700 flex items-center gap-1.5">
                    Import Complete
                  </h3>
                  <div className="flex gap-4 text-sm flex-wrap">
                    <span className="text-green-700">
                      Created: <strong>{importResult.created}</strong>
                    </span>
                    <span className="text-muted-foreground">
                      Skipped: <strong>{importResult.skipped}</strong>
                    </span>
                  </div>
                  {importResult.errors.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-destructive">
                        Rows skipped with errors:
                      </p>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {importResult.errors.map((err) => (
                          <div
                            key={`${err.row}-${err.name}`}
                            className="text-xs bg-destructive/8 border border-destructive/20 rounded px-2.5 py-1 flex gap-2"
                          >
                            <span className="font-mono text-destructive font-semibold">
                              Row {err.row}
                            </span>
                            <span className="text-muted-foreground">
                              {err.reason}
                            </span>
                          </div>
                        ))}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => downloadErrorReport(importResult.errors)}
                      >
                        <Download className="w-3 h-3 mr-1" />
                        Download Error Report
                      </Button>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setImportResult(null)}
                    data-ocid="gift-article.bulk.close_button"
                  >
                    Dismiss
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </PageContent>

      {/* ── Add / Edit Dialog ──────────────────────────────────────────────── */}
      <Dialog open={showDialog} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-md" data-ocid="gift-article.dialog">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editArticle ? "Edit Gift Article" : "Add New Gift Article"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Name */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                value={form.name}
                onChange={(e) => {
                  setForm((p) => ({ ...p, name: e.target.value }));
                  setFormError("");
                }}
                placeholder="e.g. Branded Pen Set"
                className="h-9"
                data-ocid="gift-article.input"
              />
            </div>

            {/* Category */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">
                Category <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.category}
                onValueChange={(v) => {
                  setForm((p) => ({ ...p, category: v as Category }));
                  setFormError("");
                }}
              >
                <SelectTrigger className="h-9" data-ocid="gift-article.select">
                  <SelectValue placeholder="Select category" />
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

            {/* Description */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">
                Description{" "}
                <span className="text-muted-foreground/60">(optional)</span>
              </Label>
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description: e.target.value }))
                }
                placeholder="Brief description of the gift article…"
                rows={3}
                className="resize-none"
                data-ocid="gift-article.textarea"
              />
            </div>

            {/* Error */}
            {formError && (
              <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {formError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeDialog}
              data-ocid="gift-article.cancel_button"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              data-ocid="gift-article.submit_button"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  Saving…
                </>
              ) : editArticle ? (
                "Save Changes"
              ) : (
                "Add Gift Article"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Deactivate / Delete Confirmation ──────────────────────────────── */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="max-w-sm" data-ocid="gift-article.dialog">
          <DialogHeader>
            <DialogTitle className="font-display text-destructive">
              {deleteTarget?.isActive
                ? "Deactivate Gift Article"
                : "Delete Gift Article Permanently"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-muted-foreground space-y-2">
            {deleteTarget?.isActive ? (
              <>
                <p>
                  Deactivate{" "}
                  <span className="font-semibold text-foreground">
                    {deleteTarget?.name}
                  </span>
                  ?
                </p>
                <p className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded px-3 py-2">
                  It will no longer appear in Doctor Call Entry. You can
                  re-activate it by editing the record.
                </p>
              </>
            ) : (
              <>
                <p>
                  Permanently delete{" "}
                  <span className="font-semibold text-foreground">
                    {deleteTarget?.name}
                  </span>
                  ?
                </p>
                <p className="text-xs text-destructive/80 bg-destructive/8 border border-destructive/20 rounded px-3 py-2">
                  This action cannot be undone.
                </p>
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              data-ocid="gift-article.cancel_button"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeactivateOrDelete}
              disabled={deleting}
              data-ocid="gift-article.confirm_button"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  Processing…
                </>
              ) : deleteTarget?.isActive ? (
                "Deactivate"
              ) : (
                "Delete Permanently"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
