import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  PackagePlus,
  Plus,
  RefreshCw,
  Search,
  Stethoscope,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Role } from "../../backend";
import type { AreaRecord, BulkImportDoctorInput } from "../../backend.d";
import {
  DataTable,
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import type {
  CallReportInfo,
  DoctorInfo,
  DoctorProductAssignment,
  DoctorVisitEntry,
  ProductInfo,
} from "../../types";

type TabId = "list" | "add" | "bulk";

type DoctorQualification =
  | { __kind__: "MBBS"; MBBS: null }
  | { __kind__: "MD"; MD: null }
  | { __kind__: "MS"; MS: null }
  | { __kind__: "BDS"; BDS: null }
  | { __kind__: "BAMS"; BAMS: null }
  | { __kind__: "MDS"; MDS: null }
  | { __kind__: "Other"; Other: string };

const QUAL_OPTIONS = [
  "MBBS",
  "MD",
  "MS",
  "BDS",
  "BAMS",
  "MDS",
  "Other",
] as const;

function makeQual(val: string): DoctorQualification {
  if (val === "Other") return { __kind__: "Other", Other: "" };
  return {
    __kind__: val as Exclude<typeof val, "Other">,
    [val]: null,
  } as DoctorQualification;
}

const BLANK_FORM = {
  name: "",
  qualification: "MBBS",
  station: "",
  area: "",
  territory: "",
  specialization: "",
  contactPhone: "",
};

interface ParsedDoctorRow {
  name: string;
  qualification: string;
  station: string;
  area: string;
  specialization: string;
  contactPhone: string;
  errors: string[];
  rowIndex: number;
}

function getField(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const val = row[k];
    if (val !== undefined && val !== "") return val.trim();
  }
  return "";
}

function parseRowsFromSheet(
  rawRows: Record<string, string>[],
): ParsedDoctorRow[] {
  return rawRows.map((row, idx) => {
    const name = getField(row, "Name", "name", "DOCTOR NAME", "Doctor Name");
    // Read qualification exactly as entered in the Excel file — no default fallback
    const qualification = getField(
      row,
      "Qualification",
      "qualification",
      "QUALIFICATION",
      "Qual",
      "QUAL",
    );
    const station = getField(row, "Station", "station", "STATION");
    const area = getField(
      row,
      "Area",
      "area",
      "AREA",
      "Area/Territory",
      "Area / Territory",
      "Territory",
      "territory",
    );
    const specialization = getField(
      row,
      "Specialization",
      "specialization",
      "SPECIALIZATION",
    );
    const contactPhone = getField(
      row,
      "Contact Phone",
      "ContactPhone",
      "contact_phone",
      "Phone",
      "phone",
      "Mobile",
      "mobile",
    );

    const errors: string[] = [];
    if (!name) errors.push("Missing required field: Name");
    if (!station) errors.push("Missing required field: Station");

    return {
      name,
      qualification: qualification || "",
      station,
      area,
      specialization,
      contactPhone,
      errors,
      rowIndex: idx + 2,
    };
  });
}

function parseFile(file: File): Promise<ParsedDoctorRow[]> {
  return new Promise((resolve, reject) => {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (ext === "csv") {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const text = ev.target?.result as string;
          const wb = XLSX.read(text, { type: "string" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, {
            defval: "",
          });
          resolve(parseRowsFromSheet(rows));
        } catch {
          reject(new Error("Failed to parse CSV file"));
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = ev.target?.result;
          const wb = XLSX.read(data, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, {
            defval: "",
          });
          resolve(parseRowsFromSheet(rows));
        } catch {
          reject(
            new Error(
              "Failed to parse Excel file. Please ensure the file is a valid .xlsx or .xls format.",
            ),
          );
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsArrayBuffer(file);
    }
  });
}

export default function DoctorManagement() {
  const session = useAuthStore((s) => s.session);
  const userRole = (session?.role as string) ?? "";
  const canBulkUpload = userRole === "Admin" || userRole === "HRManager";
  const [tab, setTab] = useState<TabId>("list");

  // Doctors list state — fetched by HQ+Area matching (automatic)
  const [doctors, setDoctors] = useState<DoctorInfo[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [products, setProducts] = useState<ProductInfo[]>([]);
  const [areas, setAreas] = useState<AreaRecord[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [assignDoctor, setAssignDoctor] = useState<DoctorInfo | null>(null);
  const [productIds, setProductIds] = useState<Set<string>>(new Set());
  const [sampleIds, setSampleIds] = useState<Set<string>>(new Set());
  const [_existingAssign, setExistingAssign] =
    useState<DoctorProductAssignment | null>(null);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  // Visit history state
  const [historyDoctor, setHistoryDoctor] = useState<DoctorInfo | null>(null);
  const [visitHistory, setVisitHistory] = useState<CallReportInfo[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const HISTORY_LIMIT = 20;

  // Bulk upload state
  const fileRef = useRef<HTMLInputElement>(null);
  const [bulkRows, setBulkRows] = useState<ParsedDoctorRow[]>([]);
  const [bulkArea, setBulkArea] = useState<string>("");
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkResult, setBulkResult] = useState<{
    succeeded: number;
    failed: number;
    errors: string[];
  } | null>(null);

  useEffect(() => {
    if (!session) return;
    setListLoading(true);
    Promise.all([
      api.listMyDoctors(session.userId),
      api.listProducts(),
      api.listAllActiveAreas(session.token),
    ])
      .then(([docs, p, a]) => {
        setDoctors(docs);
        setProducts(p.filter((x) => x.isActive));
        setAreas(a);
        setListLoading(false);
      })
      .catch(() => {
        toast.error("Failed to load doctors");
        setListLoading(false);
      });
  }, [session]);

  const filteredDoctors = doctors.filter((d) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      d.name.toLowerCase().includes(q) ||
      d.area.toLowerCase().includes(q) ||
      d.specialization.toLowerCase().includes(q)
    );
  });

  async function handleAdd() {
    if (!session) return;
    if (!form.name.trim() || !form.station.trim()) {
      toast.error("Name and station are required");
      return;
    }
    setSubmitting(true);
    try {
      await api.addDoctor(session.userId, {
        name: form.name.trim(),
        qualification: makeQual(form.qualification || "MBBS"),
        station: form.station.trim(),
        area: form.area.trim(),
        territory: form.territory.trim(),
        specialization: form.specialization.trim(),
        contactPhone: form.contactPhone.trim(),
      });
      toast.success("Doctor added successfully");
      // Refresh doctors list
      const docs = await api.listMyDoctors(session.userId);
      setDoctors(docs);
      setForm({ ...BLANK_FORM });
      setTab("list");
    } catch {
      toast.error("Failed to add doctor");
    } finally {
      setSubmitting(false);
    }
  }

  async function openAssign(doc: DoctorInfo) {
    if (!session) return;
    setAssignDoctor(doc);
    setAssignLoading(true);
    try {
      const existing = await api.getDoctorAssignment(session.userId, doc.id);
      setExistingAssign(existing);
      if (existing) {
        setProductIds(new Set(existing.productIds.map((id) => id.toString())));
        setSampleIds(new Set(existing.sampleIds.map((id) => id.toString())));
      } else {
        setProductIds(new Set());
        setSampleIds(new Set());
      }
    } finally {
      setAssignLoading(false);
    }
  }

  async function handleAssign() {
    if (!session || !assignDoctor) return;
    setAssignSubmitting(true);
    try {
      await api.assignProductsToDoctor(session.userId, {
        doctorId: assignDoctor.id,
        productIds: [...productIds].map(BigInt),
        sampleIds: [...sampleIds].map(BigInt),
      });
      toast.success("Products assigned to doctor");
      setAssignDoctor(null);
    } catch {
      toast.error("Failed to assign products");
    } finally {
      setAssignSubmitting(false);
    }
  }

  async function openHistory(doc: DoctorInfo) {
    setHistoryDoctor(doc);
    setVisitHistory([]);
    setHistoryError(null);
    setHistoryLoading(true);
    try {
      const reports = await api.getDoctorVisitHistory(
        doc.id,
        BigInt(HISTORY_LIMIT),
      );
      const sorted = [...reports].sort((a, b) => b.date.localeCompare(a.date));
      setVisitHistory(sorted);
    } catch {
      setHistoryError("Failed to load visit history. Please try again.");
    } finally {
      setHistoryLoading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkResult(null);
    setBulkRows([]);
    parseFile(file)
      .then((rows) => setBulkRows(rows))
      .catch((err: Error) => toast.error(err.message));
  }

  async function handleBulkImport() {
    if (!session || bulkRows.length === 0) return;
    if (!bulkArea) {
      toast.error("Select an area for bulk import");
      return;
    }
    const validRows = bulkRows.filter((r) => r.errors.length === 0);
    if (validRows.length === 0) {
      toast.error("No valid rows to import. Fix errors first.");
      return;
    }
    const items: BulkImportDoctorInput[] = validRows.map((r) => ({
      name: r.name,
      qualification: r.qualification || "MBBS",
      station: r.station,
      area: r.area || bulkArea,
      specialization: r.specialization,
      contactPhone: r.contactPhone,
    }));
    setBulkImporting(true);
    try {
      const result = await api.bulkImportDoctors(
        session.token,
        session.userId,
        items,
      );
      setBulkResult({
        succeeded: Number(result.succeeded),
        failed: Number(result.failed),
        errors: result.errors,
      });
      if (Number(result.succeeded) > 0) {
        toast.success(`Imported ${result.succeeded} doctor(s) successfully`);
        const docs = await api.listMyDoctors(session.userId);
        setDoctors(docs);
      }
    } catch {
      toast.error("Bulk import failed");
    } finally {
      setBulkImporting(false);
    }
  }

  const allottedCols = [
    { key: "sr", label: "Sr." },
    { key: "name", label: "Doctor Name" },
    { key: "spec", label: "Specialization" },
    { key: "station", label: "Station" },
    { key: "area", label: "Area" },
    { key: "actions", label: "" },
  ];

  const TAB_DEFS: { id: TabId; label: string }[] = [
    { id: "list", label: "My Doctors" },
    { id: "add", label: "Add Doctor" },
    ...(canBulkUpload ? [{ id: "bulk" as TabId, label: "Bulk Upload" }] : []),
  ];

  return (
    <PortalLayout portalRole={Role.MR}>
      <PageHeader
        title="Doctor Management"
        subtitle="All doctors in your assigned HQ and area"
        actions={
          <div className="flex gap-2">
            {TAB_DEFS.map((t) => (
              <Button
                key={t.id}
                variant={tab === t.id ? "default" : "outline"}
                size="sm"
                onClick={() => setTab(t.id)}
                data-ocid={`tab-${t.id}`}
              >
                {t.id === "bulk" && <Upload className="w-3.5 h-3.5 mr-1" />}
                {t.id === "add" && <Plus className="w-3.5 h-3.5 mr-1" />}
                {t.id === "list" && (
                  <Stethoscope className="w-3.5 h-3.5 mr-1" />
                )}
                {t.label}
              </Button>
            ))}
          </div>
        }
      />
      <PageContent>
        {/* DOCTORS LIST TAB */}
        {tab === "list" && (
          <div className="space-y-4">
            {/* Search bar */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  className="pl-8 h-8 text-xs"
                  placeholder="Search by doctor name or area…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-ocid="search-allotted-doctors"
                />
              </div>
              {!listLoading && (
                <span className="text-xs text-muted-foreground shrink-0">
                  {filteredDoctors.length} doctor
                  {filteredDoctors.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            {/* Empty state */}
            {!listLoading && doctors.length === 0 && (
              <div
                className="flex flex-col items-center justify-center py-16 text-center rounded-lg border border-dashed border-border bg-muted/20"
                data-ocid="allotted-doctors-empty"
              >
                <Stethoscope className="w-10 h-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-foreground mb-1">
                  No doctors found for your assigned area.
                </p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Please contact Admin to add doctors in your area.
                </p>
              </div>
            )}

            {/* Search empty state */}
            {!listLoading &&
              doctors.length > 0 &&
              filteredDoctors.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center rounded-lg border border-dashed border-border bg-muted/20">
                  <Search className="w-8 h-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm font-medium text-foreground mb-1">
                    No results found
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Try a different name or area.
                  </p>
                </div>
              )}

            {/* Doctor table */}
            {(listLoading || filteredDoctors.length > 0) && (
              <DataTable
                columns={allottedCols}
                data={filteredDoctors}
                getKey={(d) => d.id.toString()}
                loading={listLoading}
                emptyMessage=""
                renderRow={(d, idx) => (
                  <>
                    <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                      {(idx ?? 0) + 1}
                    </td>
                    <td className="px-4 py-3 font-body text-sm font-medium">
                      {d.name}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {d.specialization || "—"}
                    </td>
                    <td className="px-4 py-3 text-xs">{d.station || "—"}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">
                        {d.area || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openAssign(d)}
                          data-ocid={`assign-products-${d.id}`}
                          className="gap-1 text-xs"
                        >
                          <PackagePlus className="w-3.5 h-3.5" /> Assign
                          Products
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openHistory(d)}
                          data-ocid={`visit-history-${d.id}`}
                          className="gap-1 text-xs border-primary/40 text-primary hover:bg-primary/10"
                        >
                          <Clock className="w-3.5 h-3.5" /> Visit History
                        </Button>
                      </div>
                    </td>
                  </>
                )}
              />
            )}
          </div>
        )}

        {/* ADD TAB */}
        {tab === "add" && (
          <div className="max-w-xl bg-card border border-border rounded-lg p-5 space-y-4">
            <h3 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground">
              Add New Doctor
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="doc-name" className="text-xs mb-1 block">
                  Full Name *
                </Label>
                <Input
                  id="doc-name"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Dr. Rajeev Kumar"
                  data-ocid="doctor-name"
                />
              </div>
              <div>
                <Label htmlFor="doc-qual" className="text-xs mb-1 block">
                  Qualification *
                </Label>
                <Select
                  value={form.qualification}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, qualification: v }))
                  }
                >
                  <SelectTrigger id="doc-qual" data-ocid="doctor-qualification">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUAL_OPTIONS.map((q) => (
                      <SelectItem key={q} value={q}>
                        {q}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="doc-spec" className="text-xs mb-1 block">
                  Specialization
                </Label>
                <Input
                  id="doc-spec"
                  value={form.specialization}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, specialization: e.target.value }))
                  }
                  placeholder="Cardiologist"
                  data-ocid="doctor-specialization"
                />
              </div>
              <div>
                <Label htmlFor="doc-station" className="text-xs mb-1 block">
                  Station *
                </Label>
                <Input
                  id="doc-station"
                  value={form.station}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, station: e.target.value }))
                  }
                  placeholder="Mumbai"
                  data-ocid="doctor-station"
                />
              </div>
              <div>
                <Label htmlFor="doc-area" className="text-xs mb-1 block">
                  Area
                </Label>
                <Select
                  value={form.area}
                  onValueChange={(v) => setForm((f) => ({ ...f, area: v }))}
                >
                  <SelectTrigger id="doc-area" data-ocid="doctor-area">
                    <SelectValue placeholder="Select area" />
                  </SelectTrigger>
                  <SelectContent>
                    {areas.map((a) => (
                      <SelectItem key={a.id.toString()} value={a.name}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="doc-territory" className="text-xs mb-1 block">
                  Territory
                </Label>
                <Input
                  id="doc-territory"
                  value={form.territory}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, territory: e.target.value }))
                  }
                  placeholder="West Zone"
                  data-ocid="doctor-territory"
                />
              </div>
              <div>
                <Label htmlFor="doc-phone" className="text-xs mb-1 block">
                  Phone
                </Label>
                <Input
                  id="doc-phone"
                  value={form.contactPhone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, contactPhone: e.target.value }))
                  }
                  placeholder="+91 98765 43210"
                  data-ocid="doctor-phone"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleAdd}
                disabled={submitting}
                data-ocid="submit-add-doctor"
              >
                {submitting && (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                )}
                Add Doctor
              </Button>
              <Button variant="ghost" onClick={() => setTab("list")}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* BULK UPLOAD TAB — Admin/HR only */}
        {tab === "bulk" && canBulkUpload && (
          <div className="max-w-3xl space-y-5">
            <div className="bg-card border border-border rounded-lg p-5 space-y-4">
              <h3 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                Bulk Upload Doctors
              </h3>
              <p className="text-xs text-muted-foreground">
                Upload a CSV or Excel file (.xlsx, .xls, .csv) with columns:{" "}
                <span className="font-mono bg-muted/40 px-1 rounded">
                  Name, Qualification, Station, Area, Specialization, Contact
                  Phone
                </span>{" "}
                (header row required). Qualification is read exactly as entered
                in the file. Bad rows will be flagged inline and skipped during
                import.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="bulk-area" className="text-xs mb-1 block">
                    Default Area (used if row has no area) *
                  </Label>
                  <Select value={bulkArea} onValueChange={setBulkArea}>
                    <SelectTrigger id="bulk-area" data-ocid="bulk-doctor-area">
                      <SelectValue placeholder="Select area" />
                    </SelectTrigger>
                    <SelectContent>
                      {areas.map((a) => (
                        <SelectItem key={a.id.toString()} value={a.name}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="bulk-file" className="text-xs mb-1 block">
                    File (.xlsx, .xls, .csv) *
                  </Label>
                  <input
                    ref={fileRef}
                    id="bulk-file"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="block w-full text-xs text-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:bg-muted file:text-foreground hover:file:bg-muted/80 cursor-pointer"
                    onChange={handleFileChange}
                    data-ocid="bulk-file-input"
                  />
                </div>
              </div>
            </div>

            {bulkRows.length > 0 && (
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <span className="text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground">
                    Preview — {bulkRows.length} row(s)
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {bulkRows.filter((r) => r.errors.length === 0).length}{" "}
                    valid, {bulkRows.filter((r) => r.errors.length > 0).length}{" "}
                    with errors
                  </span>
                </div>
                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/30 border-b border-border">
                        <th className="px-3 py-2 text-left font-display text-muted-foreground">
                          #
                        </th>
                        <th className="px-3 py-2 text-left font-display text-muted-foreground">
                          Name
                        </th>
                        <th className="px-3 py-2 text-left font-display text-muted-foreground">
                          Qualification
                        </th>
                        <th className="px-3 py-2 text-left font-display text-muted-foreground">
                          Station
                        </th>
                        <th className="px-3 py-2 text-left font-display text-muted-foreground">
                          Area
                        </th>
                        <th className="px-3 py-2 text-left font-display text-muted-foreground">
                          Specialization
                        </th>
                        <th className="px-3 py-2 text-left font-display text-muted-foreground">
                          Phone
                        </th>
                        <th className="px-3 py-2 text-left font-display text-muted-foreground">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkRows.map((row) => (
                        <tr
                          key={`row-${row.rowIndex}`}
                          className={`border-b border-border/50 ${row.errors.length > 0 ? "bg-destructive/5" : ""}`}
                        >
                          <td className="px-3 py-2 text-muted-foreground">
                            {row.rowIndex}
                          </td>
                          <td className="px-3 py-2 font-medium">
                            {row.name || (
                              <span className="text-destructive">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {row.qualification ? (
                              <Badge
                                variant="outline"
                                className="text-xs font-mono"
                              >
                                {row.qualification}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground italic text-xs">
                                not set
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {row.station || (
                              <span className="text-destructive">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2">{row.area}</td>
                          <td className="px-3 py-2">{row.specialization}</td>
                          <td className="px-3 py-2 font-mono">
                            {row.contactPhone}
                          </td>
                          <td className="px-3 py-2">
                            {row.errors.length > 0 ? (
                              <span className="flex items-center gap-1 text-destructive">
                                <AlertCircle className="w-3 h-3" />
                                {row.errors.join("; ")}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-accent">
                                <CheckCircle2 className="w-3 h-3" /> Valid
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {bulkResult && (
              <div
                className={`rounded-lg p-4 border text-sm space-y-1 ${bulkResult.failed === 0 ? "border-accent/30 bg-accent/5" : "border-destructive/30 bg-destructive/5"}`}
              >
                <p className="font-semibold">
                  Import complete: {bulkResult.succeeded} succeeded,{" "}
                  {bulkResult.failed} failed
                </p>
                {bulkResult.errors.map((e, i) => (
                  <p
                    key={`bulk-err-${e.slice(0, 20)}-${i}`}
                    className="text-xs text-destructive"
                  >
                    {e}
                  </p>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={handleBulkImport}
                disabled={bulkImporting || bulkRows.length === 0 || !bulkArea}
                data-ocid="submit-bulk-import-doctors"
              >
                {bulkImporting && (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                )}
                <Upload className="w-4 h-4 mr-1" />
                Import {bulkRows.filter((r) => r.errors.length === 0).length}{" "}
                Doctor(s)
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setBulkRows([]);
                  setBulkResult(null);
                  setBulkArea("");
                  if (fileRef.current) fileRef.current.value = "";
                }}
              >
                Clear
              </Button>
            </div>
          </div>
        )}
      </PageContent>

      {/* Assign Products Dialog */}
      <Dialog
        open={assignDoctor !== null}
        onOpenChange={(o) => !o && setAssignDoctor(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-base">
              Assign Products — {assignDoctor?.name}
            </DialogTitle>
          </DialogHeader>
          {assignLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-display uppercase tracking-wider text-muted-foreground mb-2">
                  Products Assigned (Detailing)
                </p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {products.map((p) => (
                    <label
                      key={p.id.toString()}
                      htmlFor={`product-check-${p.id}`}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <Checkbox
                        id={`product-check-${p.id}`}
                        checked={productIds.has(p.id.toString())}
                        onCheckedChange={(checked) => {
                          setProductIds((s) => {
                            const next = new Set(s);
                            if (checked) next.add(p.id.toString());
                            else next.delete(p.id.toString());
                            return next;
                          });
                        }}
                        data-ocid={`product-check-${p.id}`}
                      />
                      <span>{p.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({p.category})
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-display uppercase tracking-wider text-muted-foreground mb-2">
                  Samples Given (Total per Doctor)
                </p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {products.map((p) => (
                    <label
                      key={p.id.toString()}
                      htmlFor={`sample-check-${p.id}`}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <Checkbox
                        id={`sample-check-${p.id}`}
                        checked={sampleIds.has(p.id.toString())}
                        onCheckedChange={(checked) => {
                          setSampleIds((s) => {
                            const next = new Set(s);
                            if (checked) next.add(p.id.toString());
                            else next.delete(p.id.toString());
                            return next;
                          });
                        }}
                        data-ocid={`sample-check-${p.id}`}
                      />
                      <span>{p.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleAssign}
                  disabled={assignSubmitting}
                  data-ocid="save-assignment"
                >
                  {assignSubmitting && (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  )}
                  Save Assignment
                </Button>
                <Button variant="ghost" onClick={() => setAssignDoctor(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Visit History Modal */}
      <Dialog
        open={historyDoctor !== null}
        onOpenChange={(o) => {
          if (!o) {
            setHistoryDoctor(null);
            setVisitHistory([]);
            setHistoryError(null);
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-display text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Visit History — {historyDoctor?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 -mx-2 px-2">
            {historyLoading && (
              <div
                className="flex items-center justify-center py-12"
                data-ocid="visit-history-loading"
              >
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            )}

            {!historyLoading && historyError && (
              <div
                className="flex flex-col items-center justify-center py-10 gap-3 text-center"
                data-ocid="visit-history-error"
              >
                <AlertCircle className="w-8 h-8 text-destructive/70" />
                <p className="text-sm text-destructive">{historyError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => historyDoctor && openHistory(historyDoctor)}
                  className="gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Retry
                </Button>
              </div>
            )}

            {!historyLoading && !historyError && visitHistory.length === 0 && (
              <div
                className="flex flex-col items-center justify-center py-12 text-center gap-2"
                data-ocid="visit-history-empty"
              >
                <Clock className="w-8 h-8 text-muted-foreground/30" />
                <p className="text-sm font-medium text-foreground">
                  No visits recorded yet
                </p>
                <p className="text-xs text-muted-foreground">
                  No visit history found for this doctor.
                </p>
              </div>
            )}

            {!historyLoading && !historyError && visitHistory.length > 0 && (
              <div
                className="space-y-0 divide-y divide-border"
                data-ocid="visit-history-list"
              >
                {visitHistory.map((report) => {
                  const visit: DoctorVisitEntry | undefined =
                    report.doctorsVisited.find(
                      (v) => v.doctorId === historyDoctor?.id,
                    );
                  return (
                    <VisitHistoryCard
                      key={report.id.toString()}
                      report={report}
                      visit={visit}
                    />
                  );
                })}
                {visitHistory.length >= HISTORY_LIMIT && (
                  <p className="text-xs text-center text-muted-foreground py-3">
                    Showing the {HISTORY_LIMIT} most recent visits.
                  </p>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}

// ── Visit History Card ───────────────────────────────────────────────────────

interface VisitHistoryCardProps {
  report: CallReportInfo;
  visit: DoctorVisitEntry | undefined;
}

function VisitHistoryCard({ report, visit }: VisitHistoryCardProps) {
  const formattedDate = formatVisitDate(report.date);
  const products =
    visit && visit.productIds.length > 0
      ? visit.productIds.map((id) => `Product #${id.toString()}`).join(", ")
      : "None";
  const samples =
    report.samplesDistributed.length > 0
      ? report.samplesDistributed
          .map((s) => `${s.productId} ×${s.quantity}`)
          .join(", ")
      : "None";
  const gifts =
    visit && visit.giftArticles.length > 0
      ? visit.giftArticles
          .map((g) => `${g.giftArticleName} ×${g.quantity}`)
          .join(", ")
      : "None";
  const viaMRCharge = visit?.submittedViaMRCharge === true;

  return (
    <div className="py-3 px-1" data-ocid={`visit-card-${report.id}`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-semibold text-foreground">
          {formattedDate}
        </span>
        <div className="flex items-center gap-1.5">
          {viaMRCharge && (
            <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
              Via MR Charge
            </span>
          )}
          {visit?.submittedByRole && !viaMRCharge && (
            <span className="px-1.5 py-0.5 rounded text-xs text-muted-foreground border border-border bg-muted/40">
              {visit.submittedByRole}
            </span>
          )}
        </div>
      </div>
      <div className="space-y-1">
        <DetailRow label="Products" value={products} />
        <DetailRow label="Samples" value={samples} />
        <DetailRow label="Gifts" value={gifts} />
        {visit?.notes && <DetailRow label="Notes" value={visit.notes} />}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-muted-foreground shrink-0 w-16">{label}:</span>
      <span
        className={`text-foreground break-words min-w-0 ${value === "None" ? "text-muted-foreground italic" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

function formatVisitDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split("-").map(Number);
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return `${String(day).padStart(2, "0")} ${months[month - 1]} ${year}`;
  } catch {
    return dateStr;
  }
}
