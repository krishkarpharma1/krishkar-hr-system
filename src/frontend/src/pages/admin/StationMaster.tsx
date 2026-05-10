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
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Edit2,
  History,
  Loader2,
  MapPin,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Role, Variant_ok_error } from "../../backend";
import type { HQRecord, StationRecord } from "../../backend.d";
import type {
  BulkStationImportInput,
  BulkStationImportResult,
} from "../../backend.d";
import {
  DataTable,
  PageContent,
  PageHeader,
  PortalLayout,
  SectionCard,
} from "../../components/PortalLayout";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";

// ── Types ────────────────────────────────────────────────────────────────────

type TabId = "list" | "bulk" | "history";

interface StationRow extends StationRecord {
  hqName: string;
}

interface ParsedStationRow {
  rowIndex: number;
  stationName: string;
  hqName: string;
  errors: string[];
}

const EMPTY_FORM = { stationName: "", hqId: "" };

// ── Excel helpers ─────────────────────────────────────────────────────────────

function downloadStationTemplate() {
  const wb = XLSX.utils.book_new();
  const headers = ["Station Name", "HQ Name"];
  const sample = ["Mumbai Central", "Mumbai HQ"];
  const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
  ws["!cols"] = [{ wch: 30 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws, "Station Template");
  XLSX.writeFile(wb, "Station_Bulk_Import_Template.xlsx");
  toast.success("Template downloaded successfully");
}

function downloadStationErrorReport(rows: ParsedStationRow[]) {
  const wb = XLSX.utils.book_new();
  const data = rows.map((r) => ({
    "Row Number": r.rowIndex,
    "Station Name": r.stationName || "(blank)",
    "HQ Name": r.hqName || "(blank)",
    "Error Reason(s)": r.errors.join("; "),
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [{ wch: 12 }, { wch: 30 }, { wch: 30 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, ws, "Error Rows");
  XLSX.writeFile(wb, "Station_Import_Error_Report.xlsx");
  toast.success("Error report downloaded");
}

function validateFileExt(file: File): string | null {
  if (file.size === 0)
    return "The file appears to be empty. Please check and re-upload.";
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!["xlsx", "xls"].includes(ext))
    return "File format not supported. Please upload a valid .xlsx or .xls file.";
  return null;
}

function parseStationFile(
  file: File,
  knownHqNames: Set<string>,
): Promise<ParsedStationRow[]> {
  return new Promise((resolve, reject) => {
    const extError = validateFileExt(file);
    if (extError) {
      reject(new Error(extError));
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const buffer = ev.target?.result;
        if (!buffer) {
          reject(
            new Error(
              "The file appears to be empty. Please check and re-upload.",
            ),
          );
          return;
        }
        let wb: XLSX.WorkBook;
        try {
          wb = XLSX.read(buffer, { type: "array" });
        } catch {
          reject(
            new Error(
              "The file appears to be corrupted. Please check and re-upload.",
            ),
          );
          return;
        }
        if (!wb.SheetNames.length) {
          reject(
            new Error(
              "No sheets found in the file. Please check and re-upload.",
            ),
          );
          return;
        }
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawAoa = XLSX.utils.sheet_to_json<string[]>(ws, {
          header: 1,
          defval: "",
        });
        if (rawAoa.length < 2) {
          reject(
            new Error(
              "No data rows found. The file contains only headers or is empty.",
            ),
          );
          return;
        }
        const headers = rawAoa[0].map((h) => String(h ?? "").trim());
        const dataRows: Record<string, string>[] = [];
        for (let i = 1; i < rawAoa.length; i++) {
          const row = rawAoa[i];
          const isBlank = row.every((c) => String(c ?? "").trim() === "");
          if (isBlank) continue;
          const obj: Record<string, string> = {};
          headers.forEach((h, hi) => {
            obj[h] = String(row[hi] ?? "").trim();
          });
          dataRows.push(obj);
        }
        if (dataRows.length === 0) {
          reject(
            new Error(
              "No data rows found. The file contains only headers or is empty.",
            ),
          );
          return;
        }

        const parsed: ParsedStationRow[] = dataRows.map((row, idx) => {
          const stationName =
            row["Station Name"] ||
            row["station name"] ||
            row["STATION NAME"] ||
            "";
          const hqName =
            row["HQ Name"] ||
            row["hq name"] ||
            row["HQ NAME"] ||
            row.Headquarters ||
            "";
          const errors: string[] = [];
          if (!stationName.trim()) errors.push("Station Name is required");
          if (!hqName.trim()) {
            errors.push("HQ Name is required");
          } else if (!knownHqNames.has(hqName.trim().toLowerCase())) {
            errors.push(`HQ not found: ${hqName.trim()}`);
          }
          return {
            rowIndex: idx + 2,
            stationName: stationName.trim(),
            hqName: hqName.trim(),
            errors,
          };
        });
        resolve(parsed);
      } catch {
        reject(
          new Error(
            "Failed to parse file. Please ensure it is a valid .xlsx or .xls file.",
          ),
        );
      }
    };
    reader.onerror = () =>
      reject(new Error("Failed to read file. Please try again."));
    reader.readAsArrayBuffer(file);
  });
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function StationMaster() {
  const { session } = useAuthStore();
  const [tab, setTab] = useState<TabId>("list");

  // ── CRUD state ────────────────────────────────────────────────────────────
  const [stations, setStations] = useState<StationRow[]>([]);
  const [hqs, setHqs] = useState<HQRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [hqFilter, setHqFilter] = useState("all");

  const [showDialog, setShowDialog] = useState(false);
  const [editStation, setEditStation] = useState<StationRow | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<StationRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Bulk import state ─────────────────────────────────────────────────────
  const fileRef = useRef<HTMLInputElement>(null);
  const [bulkRows, setBulkRows] = useState<ParsedStationRow[]>([]);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkStationImportResult | null>(
    null,
  );

  // ── History state ─────────────────────────────────────────────────────────
  const [history, setHistory] = useState<BulkStationImportResult[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ── Data loading ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [allStations, allHqs] = await Promise.all([
        api.listAllStations(session.token),
        api.getAllActiveHQs(session.token),
      ]);
      const hqMap = new Map(allHqs.map((h) => [String(h.id), h.name]));
      setHqs(allHqs as HQRecord[]);
      setStations(
        allStations.map((s) => ({
          ...s,
          hqName: hqMap.get(String(s.hqId)) ?? `HQ-${String(s.hqId)}`,
        })),
      );
    } catch {
      toast.error("Failed to load stations");
    } finally {
      setLoading(false);
    }
  }, [session]);

  const loadHistory = useCallback(async () => {
    if (!session) return;
    setHistoryLoading(true);
    try {
      const records = await api.listStationBulkUploadHistory(session.token);
      setHistory(records);
    } catch {
      toast.error("Failed to load upload history");
    } finally {
      setHistoryLoading(false);
    }
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (tab === "history") loadHistory();
  }, [tab, loadHistory]);

  // ── CRUD helpers ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = stations;
    if (hqFilter !== "all")
      list = list.filter((s) => String(s.hqId) === hqFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((s) => s.stationName.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => a.stationName.localeCompare(b.stationName));
  }, [stations, hqFilter, search]);

  function openCreate() {
    setEditStation(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowDialog(true);
  }

  function openEdit(row: StationRow) {
    setEditStation(row);
    setForm({ stationName: row.stationName, hqId: String(row.hqId) });
    setFormError("");
    setShowDialog(true);
  }

  function closeDialog() {
    setShowDialog(false);
    setEditStation(null);
    setForm(EMPTY_FORM);
    setFormError("");
  }

  async function handleSave() {
    if (!session) return;
    const name = form.stationName.trim();
    if (!name) {
      setFormError("Station name is required.");
      return;
    }
    if (!editStation && !form.hqId) {
      setFormError("Please select a Headquarters.");
      return;
    }
    const hqId = editStation ? String(editStation.hqId) : form.hqId;
    const duplicate = stations.find(
      (s) =>
        s.stationName.toLowerCase() === name.toLowerCase() &&
        String(s.hqId) === hqId &&
        (!editStation || s.stationId !== editStation.stationId),
    );
    if (duplicate) {
      setFormError(`A station named "${name}" already exists in this HQ.`);
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      if (editStation) {
        const res = await api.updateStation(
          session.token,
          editStation.stationId,
          { stationName: name },
        );
        if (res.__kind__ === "err") {
          toast.error(res.err);
          return;
        }
        toast.success("Station updated");
      } else {
        const res = await api.createStation(session.token, {
          stationName: name,
          hqId: BigInt(form.hqId),
        });
        if (res.__kind__ === "err") {
          toast.error(res.err);
          return;
        }
        toast.success("Station created");
      }
      closeDialog();
      await load();
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!session || !deleteTarget) return;
    setDeleting(true);
    try {
      const ok = await api.deleteStation(session.token, deleteTarget.stationId);
      if (!ok) {
        toast.error("Delete failed — station may be in use");
      } else {
        toast.success("Station deleted");
        await load();
      }
    } catch {
      toast.error("Delete failed");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  // ── Bulk import helpers ───────────────────────────────────────────────────
  const hqNameSet = useMemo(
    () => new Set(hqs.map((h) => h.name.toLowerCase())),
    [hqs],
  );

  const validRows = bulkRows.filter((r) => r.errors.length === 0);
  const invalidRows = bulkRows.filter((r) => r.errors.length > 0);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkResult(null);
    setBulkRows([]);
    parseStationFile(file, hqNameSet)
      .then((rows) => setBulkRows(rows))
      .catch((err: Error) => toast.error(err.message));
  }

  async function handleBulkImport() {
    if (!session || validRows.length === 0) return;
    const items: BulkStationImportInput[] = validRows.map((r) => ({
      stationName: r.stationName,
      hqName: r.hqName,
    }));
    setBulkImporting(true);
    try {
      const result = await api.bulkImportStations(session.token, items);
      setBulkResult(result);
      if (result.saved > BigInt(0)) {
        toast.success(
          `Imported ${String(result.saved)} station(s) successfully`,
        );
        await load();
      }
      if (result.skipped > BigInt(0)) {
        toast.warning(`${String(result.skipped)} row(s) were skipped`);
      }
    } catch {
      toast.error("Bulk import failed");
    } finally {
      setBulkImporting(false);
    }
  }

  // ── Tabs definition ───────────────────────────────────────────────────────
  const tabs: {
    id: TabId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: "list", label: "Station List", icon: MapPin },
    { id: "bulk", label: "Bulk Import", icon: Upload },
    { id: "history", label: "Import History", icon: History },
  ];

  const cols = [
    { key: "name", label: "Station Name" },
    { key: "hq", label: "Headquarters" },
    { key: "created", label: "Created" },
    { key: "actions", label: "Actions", className: "text-right" },
  ];

  return (
    <PortalLayout portalRole={Role.Admin}>
      <PageHeader
        title="Station Master"
        subtitle="Manage stations linked to headquarters"
        actions={
          <div className="flex gap-2 flex-wrap">
            {tabs.map((t) => (
              <Button
                key={t.id}
                variant={tab === t.id ? "default" : "outline"}
                size="sm"
                onClick={() => setTab(t.id)}
                data-ocid={`tab-station-${t.id}`}
              >
                <t.icon className="w-3.5 h-3.5 mr-1.5" />
                {t.label}
              </Button>
            ))}
            {tab === "list" && (
              <Button
                size="sm"
                onClick={openCreate}
                data-ocid="create-station-btn"
              >
                <Plus className="w-4 h-4 mr-1" /> New Station
              </Button>
            )}
          </div>
        }
      />

      <PageContent>
        {/* ── STATION LIST TAB ──────────────────────────────────────────── */}
        {tab === "list" && (
          <>
            {/* Filters */}
            <div className="flex gap-3 mb-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-8 h-9"
                  placeholder="Search station name…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  data-ocid="station-search"
                />
              </div>
              <Select value={hqFilter} onValueChange={setHqFilter}>
                <SelectTrigger className="h-9 w-[200px]" data-ocid="hq-filter">
                  <SelectValue placeholder="All HQs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All HQs</SelectItem>
                  {hqs.map((h) => (
                    <SelectItem key={String(h.id)} value={String(h.id)}>
                      {h.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DataTable
              columns={cols}
              data={filtered}
              getKey={(s) => String(s.stationId)}
              loading={loading}
              emptyMessage="No stations found. Create your first station or use Bulk Import."
              renderRow={(s) => (
                <>
                  <td className="px-4 py-3 font-body font-medium text-foreground">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                      {s.stationName}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded font-display">
                      {s.hqName}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                    {s.createdAt
                      ? new Date(
                          Number(s.createdAt) / 1_000_000,
                        ).toLocaleDateString("en-IN")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEdit(s)}
                        data-ocid={`edit-station-${s.stationId}`}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteTarget(s)}
                        data-ocid={`delete-station-${s.stationId}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </>
              )}
            />
          </>
        )}

        {/* ── BULK IMPORT TAB ───────────────────────────────────────────── */}
        {tab === "bulk" && (
          <div className="max-w-4xl space-y-5">
            <SectionCard>
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <h3 className="font-display font-semibold text-sm text-foreground">
                      Bulk Import Stations
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Download the Excel template, fill in station details, and
                      upload here. Each station must have a Station Name and a
                      valid HQ Name.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Mandatory columns:{" "}
                      <span className="font-mono bg-muted/60 px-1.5 py-0.5 rounded text-foreground">
                        Station Name, HQ Name
                      </span>
                    </p>
                    <p className="text-xs text-amber-700 mt-1">
                      ⚠ HQ Name must exactly match an existing HQ in the system
                      (case-insensitive).
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadStationTemplate}
                    className="shrink-0"
                    data-ocid="btn-download-station-template"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Download Template
                  </Button>
                </div>

                <div>
                  <Label
                    htmlFor="station-bulk-file"
                    className="text-xs mb-1 block"
                  >
                    Upload Excel File (.xlsx, .xls){" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <input
                    ref={fileRef}
                    id="station-bulk-file"
                    type="file"
                    accept=".xlsx,.xls"
                    className="block w-full text-xs text-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:bg-muted file:text-foreground hover:file:bg-muted/80 cursor-pointer"
                    onChange={handleFileChange}
                    data-ocid="bulk-station-file-input"
                  />
                </div>
              </div>
            </SectionCard>

            {/* Validation summary + preview */}
            {bulkRows.length > 0 && (
              <div className="space-y-4">
                {/* Summary bar */}
                <div className="bg-muted/30 border border-border rounded-lg px-4 py-3 flex flex-wrap gap-4 text-sm">
                  <span>
                    Total rows: <strong>{bulkRows.length}</strong>
                  </span>
                  <span className="text-green-700">
                    Valid rows: <strong>{validRows.length}</strong>
                  </span>
                  <span className="text-destructive">
                    Invalid rows: <strong>{invalidRows.length}</strong>
                  </span>
                </div>

                {/* Valid rows preview */}
                {validRows.length > 0 && (
                  <div className="bg-card border border-border rounded-lg overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-border bg-green-50">
                      <span className="text-xs font-display font-semibold text-green-700 uppercase tracking-wider">
                        Valid Rows — Ready to Import ({validRows.length})
                      </span>
                    </div>
                    <div className="overflow-x-auto max-h-64">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-muted/30 border-b border-border">
                            {["#", "Station Name", "HQ Name"].map((h) => (
                              <th
                                key={h}
                                className="px-3 py-2 text-left font-display text-muted-foreground"
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {validRows.map((row) => (
                            <tr
                              key={`valid-${row.rowIndex}`}
                              className="border-b border-border/50"
                            >
                              <td className="px-3 py-2 text-muted-foreground font-mono">
                                {row.rowIndex}
                              </td>
                              <td className="px-3 py-2 font-medium">
                                <div className="flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3 h-3 text-green-600 shrink-0" />
                                  {row.stationName}
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <span className="bg-primary/10 text-primary text-xs px-1.5 py-0.5 rounded font-display">
                                  {row.hqName}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Invalid rows */}
                {invalidRows.length > 0 && (
                  <div className="bg-card border border-border rounded-lg overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-border bg-destructive/5 flex items-center justify-between">
                      <span className="text-xs font-display font-semibold text-destructive uppercase tracking-wider">
                        Invalid Rows — Skipped ({invalidRows.length})
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadStationErrorReport(invalidRows)}
                        data-ocid="btn-download-station-error-report"
                      >
                        <Download className="w-3.5 h-3.5 mr-1.5" />
                        Download Error Report
                      </Button>
                    </div>
                    <div className="overflow-x-auto max-h-64">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-muted/30 border-b border-border">
                            {[
                              "Row #",
                              "Station Name",
                              "HQ Name",
                              "Error(s)",
                            ].map((h) => (
                              <th
                                key={h}
                                className="px-3 py-2 text-left font-display text-muted-foreground"
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {invalidRows.map((row) => (
                            <tr
                              key={`invalid-${row.rowIndex}`}
                              className="border-b border-border/50 bg-destructive/5"
                            >
                              <td className="px-3 py-2 text-muted-foreground font-mono">
                                {row.rowIndex}
                              </td>
                              <td className="px-3 py-2 font-medium">
                                {row.stationName || (
                                  <span className="text-destructive italic">
                                    blank
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                {row.hqName || (
                                  <span className="text-destructive italic">
                                    blank
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <span className="flex items-start gap-1 text-destructive">
                                  <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                                  {row.errors.join("; ")}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Import result */}
            {bulkResult && (
              <div
                className={`rounded-lg p-4 border text-sm space-y-1 ${
                  bulkResult.skipped === BigInt(0)
                    ? "border-green-300 bg-green-50"
                    : "border-destructive/30 bg-destructive/5"
                }`}
              >
                <p className="font-semibold">
                  Import complete: {String(bulkResult.saved)} saved,{" "}
                  {String(bulkResult.skipped)} skipped out of{" "}
                  {String(bulkResult.totalRows)} rows
                </p>
                {bulkResult.rowResults
                  .filter(
                    (r) => r.status === Variant_ok_error.error && r.errorReason,
                  )
                  .slice(0, 5)
                  .map((r) => (
                    <p
                      key={`${String(r.rowIndex)}-err`}
                      className="text-xs text-destructive"
                    >
                      Row {String(r.rowIndex)}: {r.errorReason}
                    </p>
                  ))}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 flex-wrap">
              <Button
                onClick={handleBulkImport}
                disabled={bulkImporting || validRows.length === 0}
                data-ocid="btn-confirm-bulk-import-stations"
              >
                {bulkImporting && (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                )}
                <Upload className="w-4 h-4 mr-1.5" />
                Import {validRows.length} Station(s)
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setBulkRows([]);
                  setBulkResult(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
                data-ocid="btn-clear-station-bulk"
              >
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* ── IMPORT HISTORY TAB ────────────────────────────────────────── */}
        {tab === "history" && (
          <div className="space-y-4">
            <SectionCard title="Bulk Import History">
              {historyLoading ? (
                <div className="space-y-2 py-2">
                  {(["s1", "s2", "s3"] as const).map((k) => (
                    <div
                      key={k}
                      className="h-12 bg-muted rounded animate-pulse"
                    />
                  ))}
                </div>
              ) : history.length === 0 ? (
                <div
                  className="py-10 text-center"
                  data-ocid="station-history-empty"
                >
                  <History className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No import history yet. Use the Bulk Import tab to upload
                    stations.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border">
                        {[
                          "Date & Time",
                          "Uploaded By",
                          "Total Rows",
                          "Saved",
                          "Skipped",
                          "Status",
                        ].map((h) => (
                          <th
                            key={h}
                            className="px-3 py-2 text-left text-xs font-display text-muted-foreground uppercase tracking-wider"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {history.map((rec, idx) => (
                        <tr
                          key={`${rec.uploadedAt}-${idx}`}
                          className="hover:bg-muted/20"
                        >
                          <td className="px-3 py-2 text-xs font-mono text-muted-foreground">
                            {rec.uploadedAt
                              ? new Date(
                                  Number(rec.uploadedAt) / 1_000_000,
                                ).toLocaleString("en-IN")
                              : "—"}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {rec.uploadedBy || "—"}
                          </td>
                          <td className="px-3 py-2 text-xs font-mono text-center">
                            {String(rec.totalRows)}
                          </td>
                          <td className="px-3 py-2 text-xs font-mono text-center text-green-700">
                            {String(rec.saved)}
                          </td>
                          <td className="px-3 py-2 text-xs font-mono text-center text-destructive">
                            {String(rec.skipped)}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {rec.skipped === BigInt(0) ? (
                              <span className="inline-flex items-center gap-1 text-green-700">
                                <CheckCircle2 className="w-3 h-3" /> Complete
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-amber-700">
                                <AlertCircle className="w-3 h-3" /> Partial
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </div>
        )}

        {/* ── Create / Edit dialog ──────────────────────────────────────── */}
        <Dialog open={showDialog} onOpenChange={closeDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">
                {editStation ? "Edit Station" : "New Station"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Headquarters
                </Label>
                {editStation ? (
                  <div className="flex items-center h-9 px-3 bg-muted/50 border border-border rounded-md">
                    <span className="text-sm text-foreground font-display">
                      {editStation.hqName}
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      Read-only
                    </span>
                  </div>
                ) : (
                  <Select
                    value={form.hqId}
                    onValueChange={(v) => {
                      setForm((p) => ({ ...p, hqId: v }));
                      setFormError("");
                    }}
                  >
                    <SelectTrigger data-ocid="station-form-hq">
                      <SelectValue placeholder="Select HQ" />
                    </SelectTrigger>
                    <SelectContent>
                      {hqs.map((h) => (
                        <SelectItem key={String(h.id)} value={String(h.id)}>
                          {h.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Station Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={form.stationName}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, stationName: e.target.value }));
                    setFormError("");
                  }}
                  placeholder="e.g. Mumbai Central"
                  className="h-9"
                  data-ocid="station-form-name"
                />
              </div>

              {formError && (
                <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {formError}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                data-ocid="save-station-btn"
              >
                {saving ? "Saving…" : "Save Station"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Delete confirmation dialog ────────────────────────────────── */}
        <Dialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
        >
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-display text-destructive">
                Delete Station
              </DialogTitle>
            </DialogHeader>
            <div className="py-2 text-sm text-muted-foreground space-y-2">
              <p>
                Are you sure you want to delete{" "}
                <span className="font-semibold text-foreground">
                  {deleteTarget?.stationName}
                </span>
                ?
              </p>
              <p className="text-xs text-destructive/80 bg-destructive/8 border border-destructive/20 rounded px-3 py-2">
                This station will be removed from all MR assignments. This
                action cannot be undone.
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
                data-ocid="confirm-delete-station-btn"
              >
                {deleting ? "Deleting…" : "Delete Station"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageContent>
    </PortalLayout>
  );
}
