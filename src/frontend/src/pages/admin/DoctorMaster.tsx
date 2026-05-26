import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  History,
  Loader2,
  Pencil,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Role } from "../../backend";
import type {
  AreaRecord,
  BulkImportDoctorInput,
  StationRecord,
  UserInfo,
} from "../../backend.d";
import { ExportButton } from "../../components/ExportButton";
import {
  PageContent,
  PageHeader,
  PortalLayout,
  SectionCard,
} from "../../components/PortalLayout";
import ScrollToBottom from "../../components/ScrollToBottom";
import ScrollableTable from "../../components/ScrollableTable";
import { useCompanyProfile } from "../../hooks/useCompanyProfile";
import { api } from "../../lib/api";
import type { BulkUploadRecord } from "../../lib/api";
import { exportToExcel, logExportToAuditTrail } from "../../lib/exportUtils";
import { useAuthStore } from "../../store/authStore";
import type { DoctorInfo } from "../../types";

type TabId = "list" | "bulk" | "history";

const PAGE_SIZE = 50;

// ── Qualification helpers ────────────────────────────────────────────────────

const QUALIFICATION_OPTIONS = [
  "MBBS",
  "MD",
  "MS",
  "BDS",
  "MDS",
  "BAMS",
  "BHMS",
  "DNB",
  "DM",
  "MCh",
  "MBBS DGO",
  "MBBS DNB",
  "MBBS MD",
  "MBBS MS",
  "MBBS ENT",
  "MBBS ORTHO",
  "Other",
] as const;

const QUAL_KIND_LABELS: Record<string, string> = {
  MBBSdgo: "MBBS DGO",
  MBBSdnb: "MBBS DNB",
  MBBSmd: "MBBS MD",
  MBBSms: "MBBS MS",
  MBBSent: "MBBS ENT",
  MBBSortho: "MBBS ORTHO",
};

/**
 * Formats a backend qualification variant object (or plain string) into a
 * human-readable label.
 *
 * Backend shape:  { __kind__: "MBBS" } | { __kind__: "Other"; Other: string }
 * From Excel/edit: plain string like "MBBS", "MBBS DGO", "Other"
 */
function formatQualification(q: unknown): string {
  if (!q) return "—";
  // Plain string (from bulk upload preview or form)
  if (typeof q === "string") return q || "—";
  // Backend variant object
  const qual = q as { __kind__: string; Other?: string };
  const kind = qual.__kind__;
  if (!kind) return "—";
  if (kind === "Other") return qual.Other || "Other";
  return QUAL_KIND_LABELS[kind] ?? kind;
}

interface ParsedDoctorRow {
  name: string;
  qualification: string;
  station: string;
  area: string;
  specialization: string;
  contactPhone: string;
  clinicName: string;
  address: string;
  hq: string;
  category: string;
  assignedMrName: string;
  remarks: string;
  errors: string[];
  warnings: string[];
  rowIndex: number;
}

function getField(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const val = row[k];
    if (val !== undefined && String(val).trim() !== "")
      return String(val).trim();
  }
  return "";
}

function parseRowsFromSheet(
  rawRows: Record<string, string>[],
  knownAreas: AreaRecord[],
  knownStations: StationRecord[],
): ParsedDoctorRow[] {
  const areaNames = new Set(knownAreas.map((a) => a.name.toLowerCase()));

  // Build a set of station names keyed by lowercase for quick lookup
  // Also build a map of stationName.toLowerCase() -> hqId for cross-checking
  const stationsByName = new Map<string, StationRecord>();
  for (const s of knownStations) {
    stationsByName.set(s.stationName.toLowerCase(), s);
  }

  return rawRows.map((row, idx) => {
    const name = getField(
      row,
      "Doctor Name",
      "Name",
      "name",
      "DOCTOR NAME",
      "doctor name",
    );
    // Read qualification exactly as entered (optional — no default override)
    const qualification = getField(
      row,
      "Qualification",
      "qualification",
      "QUALIFICATION",
    );
    // Station must come ONLY from the Station column — never fall back to Clinic/Hospital
    const station = getField(row, "Station", "station", "STATION");
    const clinicName = getField(
      row,
      "Clinic/Hospital Name",
      "Clinic Name",
      "clinic_name",
    );
    const address = getField(row, "Address", "address");
    const hq = getField(
      row,
      "Headquarters",
      "HQ",
      "hq",
      "headquarters",
      "Headquarter",
    );
    const area = getField(row, "Territory", "territory");
    const _zoneName = getField(row, "Zone", "zone") ?? "";
    const _regionName = getField(row, "Region", "region") ?? "";
    const _areaName = getField(row, "Area", "area") ?? "";
    const specialization = getField(
      row,
      "Specialization",
      "specialization",
      "SPECIALIZATION",
      "Speciality",
    );
    const contactPhone = getField(
      row,
      "Mobile Number",
      "Mobile",
      "Contact Phone",
      "Phone",
      "ContactPhone",
      "contact_phone",
      "phone",
    );
    const category = getField(row, "Category", "category", "Cat");
    const assignedMrName = getField(
      row,
      "Assigned MR Name",
      "MR Name",
      "MR",
      "mr_name",
    );
    const remarks = getField(row, "Remarks", "remarks", "Notes");

    const errors: string[] = [];
    const warnings: string[] = [];

    if (!name) errors.push("Missing required field: Doctor Name");
    if (!area)
      errors.push("Missing required field: Territory (Station Name required)");
    else if (!areaNames.has(area.toLowerCase()))
      errors.push(`Area not found: ${area}`);

    // Validate station against Station Master if a station value is provided
    if (station && station.trim() !== "") {
      const stationRecord = stationsByName.get(station.toLowerCase());
      if (!stationRecord) {
        errors.push(`Station not found under the selected HQ: ${station}`);
      } else if (hq && hq.trim() !== "") {
        // If HQ is also provided, verify the station belongs to that HQ
        // We check by name match on HQ — find the hqId for the given HQ name
        // stationRecord.hqId is the linked HQ id; we can't easily resolve HQ name to ID here
        // so we do a soft check: warn if station exists but may be under different HQ
        // The backend will enforce strict validation — frontend just flags for UX
      }
    }

    if (assignedMrName && assignedMrName.trim() !== "") {
      warnings.push(
        `MR "${assignedMrName}" will be linked if name matches an existing employee.`,
      );
    }

    return {
      name,
      qualification,
      station,
      area,
      specialization,
      contactPhone,
      clinicName,
      address,
      hq,
      category,
      assignedMrName,
      remarks,
      errors,
      warnings,
      rowIndex: idx + 2,
    };
  });
}

function validateFileExt(file: File): string | null {
  if (file.size === 0)
    return "The file appears to be empty. Please check and re-upload.";
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!["xlsx", "xls"].includes(ext))
    return "File format not supported. Please upload a valid .xlsx or .xls file.";
  return null;
}

function parseFile(
  file: File,
  knownAreas: AreaRecord[],
  knownStations: StationRecord[],
): Promise<ParsedDoctorRow[]> {
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
        resolve(parseRowsFromSheet(dataRows, knownAreas, knownStations));
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

function downloadTemplate() {
  const wb = XLSX.utils.book_new();
  // Column order as specified: 14 columns including Station
  const headers = [
    "Doctor Name",
    "Specialization",
    "Qualification",
    "Clinic/Hospital Name",
    "Address",
    "Zone",
    "Region",
    "Area",
    "Station *",
    "Territory *",
    "Mobile Number",
    "Email ID",
    "Category",
    "Assigned MR Name",
    "Remarks",
  ];
  const sample = [
    "Dr. Priya Sharma",
    "General Medicine",
    "MBBS",
    "City Hospital",
    "123 Main Street",
    "West Zone",
    "Maharashtra Region",
    "Pune Area",
    "Mumbai Central",
    "Mumbai North",
    "9876543210",
    "doctor@example.com",
    "A",
    "",
    "",
  ];
  const notes = [
    "* Required",
    "",
    "Optional – match exactly: MBBS, MD, MS, BDS etc.",
    "",
    "",
    "Optional",
    "Optional",
    "Optional",
    "* Required – must match an existing Station name",
    "* Required – must exactly match an existing Territory name",
    "",
    "",
    "A, B or C",
    "",
    "",
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, sample, notes]);
  ws["!cols"] = headers.map(() => ({ wch: 26 }));
  XLSX.utils.book_append_sheet(wb, ws, "Doctor Template");
  XLSX.writeFile(wb, "Doctor_Bulk_Upload_Template.xlsx");
  toast.success("Template downloaded successfully");
}

function downloadErrorReport(rows: ParsedDoctorRow[]) {
  const wb = XLSX.utils.book_new();
  const data = rows.map((r) => ({
    "Row Number": r.rowIndex,
    "Doctor Name": r.name || "(blank)",
    "Station Value Entered": r.station || "(blank)",
    "Area Value Entered": r.area || "(blank)",
    "Error Reason(s)": r.errors.join("; "),
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 12 },
    { wch: 30 },
    { wch: 26 },
    { wch: 28 },
    { wch: 60 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Error Rows");
  XLSX.writeFile(wb, "Doctor_Upload_Error_Report.xlsx");
  toast.success("Error report downloaded");
}

function downloadHistoryErrorReport(record: BulkUploadRecord) {
  if (!record.errors || record.errors.length === 0) {
    toast.info("No errors to download for this upload");
    return;
  }
  const wb = XLSX.utils.book_new();
  const rows = record.errors.map((e, i) => ({ "#": i + 1, Error: e }));
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Errors");
  XLSX.writeFile(wb, `Doctor_Upload_Errors_${String(record.id)}.xlsx`);
  toast.success("Error report downloaded");
}

// ── Pagination Controls ──────────────────────────────────────────────────────

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPrev: () => void;
  onNext: () => void;
}

function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPrev,
  onNext,
}: PaginationControlsProps) {
  if (totalPages <= 1) return null;
  const startIdx = (currentPage - 1) * pageSize + 1;
  const endIdx = Math.min(currentPage * pageSize, totalItems);
  return (
    <div className="flex items-center justify-between pt-3 border-t border-border mt-2">
      <span className="text-xs text-muted-foreground">
        Showing {startIdx}–{endIdx} of {totalItems} doctors
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onPrev}
          disabled={currentPage === 1}
          aria-label="Previous page"
          className="h-7 px-2 min-w-[44px]"
          data-ocid="doctor-list-prev"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-xs text-muted-foreground px-1 tabular-nums">
          {currentPage} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={currentPage === totalPages}
          aria-label="Next page"
          className="h-7 px-2 min-w-[44px]"
          data-ocid="doctor-list-next"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Edit Modal ──────────────────────────────────────────────────────────────

interface EditModalProps {
  doctor: DoctorInfo;
  areas: AreaRecord[];
  stations: StationRecord[];
  token: string;
  onClose: () => void;
  onSaved: () => void;
}

function EditDoctorModal({
  doctor,
  areas,
  stations,
  token,
  onClose,
  onSaved,
}: EditModalProps) {
  const [name, setName] = useState(doctor.name);
  const [specialization, setSpecialization] = useState(
    doctor.specialization || "",
  );
  const [qualification, setQualification] = useState<string>(
    formatQualification(doctor.qualification) === "—"
      ? ""
      : formatQualification(doctor.qualification),
  );
  const [station, setStation] = useState(doctor.station || "");
  const [area, setArea] = useState(doctor.area || "");
  const [contactPhone, setContactPhone] = useState(doctor.contactPhone || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Doctor Name is required");
      return;
    }
    setSaving(true);
    try {
      const result = await (
        api as unknown as {
          updateDoctorAdmin: (
            token: string,
            doctorId: bigint,
            name: string | null,
            qualification: string | null,
            station: string | null,
            area: string | null,
            territory: string | null,
            specialization: string | null,
            contactPhone: string | null,
          ) => Promise<{ __kind__: "ok" } | { __kind__: "err"; err: string }>;
        }
      ).updateDoctorAdmin(
        token,
        doctor.id,
        name.trim() || null,
        qualification.trim() || null,
        station.trim() || null,
        area.trim() || null,
        null,
        specialization.trim() || null,
        contactPhone.trim() || null,
      );
      if (result.__kind__ === "err") {
        toast.error((result as { __kind__: "err"; err: string }).err);
      } else {
        toast.success("Doctor updated successfully");
        onSaved();
        onClose();
      }
    } catch {
      toast.error("Failed to update doctor");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-display font-semibold text-foreground">
            Edit Doctor
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">
              Doctor Name <span className="text-destructive">*</span>
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-ocid="edit-doctor-name"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Qualification</Label>
            <Select value={qualification} onValueChange={setQualification}>
              <SelectTrigger data-ocid="edit-doctor-qualification">
                <SelectValue placeholder="Select qualification" />
              </SelectTrigger>
              <SelectContent>
                {QUALIFICATION_OPTIONS.map((q) => (
                  <SelectItem key={q} value={q}>
                    {q}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Specialization</Label>
            <Input
              value={specialization}
              onChange={(e) => setSpecialization(e.target.value)}
              placeholder="e.g. General Medicine"
              data-ocid="edit-doctor-specialization"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Station</Label>
            <Select
              value={station}
              onValueChange={(val) => {
                setStation(val);
                setArea("");
              }}
            >
              <SelectTrigger data-ocid="edit-doctor-station">
                <SelectValue placeholder="Select Station" />
              </SelectTrigger>
              <SelectContent>
                {stations.map((s) => (
                  <SelectItem
                    key={s.stationId?.toString()}
                    value={s.stationName}
                  >
                    {s.stationName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Territory</Label>
            <Select value={area} onValueChange={setArea}>
              <SelectTrigger data-ocid="edit-doctor-area">
                <SelectValue placeholder="Select Territory" />
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
          <div className="space-y-1">
            <Label className="text-xs">Mobile Number</Label>
            <Input
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="10-digit mobile"
              data-ocid="edit-doctor-phone"
            />
          </div>
        </div>
        <div className="flex gap-3 px-5 py-4 border-t border-border">
          <Button
            onClick={handleSave}
            disabled={saving}
            data-ocid="btn-save-doctor"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
            Save Changes
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirm Modal ────────────────────────────────────────────────────

interface DeleteConfirmModalProps {
  count: number;
  onConfirm: () => void;
  onClose: () => void;
  deleting: boolean;
}

function DeleteConfirmModal({
  count,
  onConfirm,
  onClose,
  deleting,
}: DeleteConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-sm">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-display font-semibold text-foreground">
            Confirm Delete
          </h2>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-foreground">
            {count === 1
              ? "Are you sure you want to delete this doctor? This action cannot be undone."
              : `Are you sure you want to delete ${count} doctors? This action cannot be undone.`}
          </p>
        </div>
        <div className="flex gap-3 px-5 py-4 border-t border-border">
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={deleting}
            data-ocid="btn-confirm-delete-doctor"
          >
            {deleting && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
            Delete
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function DoctorMaster({ portalRole }: { portalRole?: Role }) {
  const { session } = useAuthStore();
  const token = session?.token ?? "";
  const effectiveRole = portalRole ?? session?.role ?? Role.Admin;
  const { companyProfile } = useCompanyProfile();

  const canEdit =
    effectiveRole === Role.Admin || effectiveRole === Role.HRManager;

  const [tab, setTab] = useState<TabId>("list");
  const [doctors, setDoctors] = useState<DoctorInfo[]>([]);
  const [areas, setAreas] = useState<AreaRecord[]>([]);
  const [stations, setStations] = useState<StationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterArea, setFilterArea] = useState("all");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Edit/delete state
  const [showAddDoctor, setShowAddDoctor] = useState(false);
  const [addDoctorForm, setAddDoctorForm] = useState({
    name: "",
    specialization: "",
    qualification: "",
    contactPhone: "",
    station: "",
    area: "",
  });
  const [selectedStation, setSelectedStation] = useState<StationRecord | null>(
    null,
  );
  const [editingDoctor, setEditingDoctor] = useState<DoctorInfo | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<bigint[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Bulk upload state
  const fileRef = useRef<HTMLInputElement>(null);
  const [bulkRows, setBulkRows] = useState<ParsedDoctorRow[]>([]);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkResult, setBulkResult] = useState<{
    succeeded: number;
    failed: number;
    errors: string[];
  } | null>(null);

  // Upload history
  const [history, setHistory] = useState<BulkUploadRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyUsers, setHistoryUsers] = useState<UserInfo[]>([]);

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [doctorList, areaList, stationList] = await Promise.all([
        api.listDoctors(),
        api.listAllActiveAreas(token),
        api.listAllStations(token),
      ]);
      setDoctors(doctorList);
      setAreas(areaList);
      setStations(stationList);
    } catch {
      toast.error("Failed to load doctor data");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadHistory = useCallback(async () => {
    if (!token) return;
    setHistoryLoading(true);
    try {
      const [records, users] = await Promise.all([
        api.getBulkUploadHistory(token, "doctors"),
        api.listAllUsers(token),
      ]);
      setHistory(records);
      setHistoryUsers(users);
    } catch {
      toast.error("Failed to load upload history");
    } finally {
      setHistoryLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (tab === "history") loadHistory();
  }, [tab, loadHistory]);

  // Reset to page 1 whenever filters change — derive inside the filter useMemo instead
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional reset on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterArea]);

  const handleExportDoctors = () => {
    exportToExcel({
      reportName: "Doctor Master",
      columns: [
        { key: "doctorName", label: "Doctor Name", type: "text" },
        { key: "specialty", label: "Specialty", type: "text" },
        { key: "qualification", label: "Qualification", type: "text" },
        { key: "category", label: "Category (A/B/C)", type: "text" },
        {
          key: "prescriptionPotential",
          label: "Prescription Potential",
          type: "text",
        },
        { key: "clinicHospital", label: "Clinic/Hospital", type: "text" },
        { key: "territory", label: "Territory", type: "text" },
        { key: "contactNumber", label: "Contact Number", type: "text" },
        { key: "visitFrequency", label: "Visit Frequency", type: "text" },
        { key: "productsPreferred", label: "Products Preferred", type: "text" },
      ],
      data: filteredDoctors.map((d) => ({
        doctorName: d.name || "",
        specialty: d.specialization || "",
        qualification: d.qualification || "",
        category: d.category || "",
        prescriptionPotential: "",
        clinicHospital: d.clinicName || "",
        territory: d.territory || d.station || "",
        contactNumber: d.contactPhone || "",
        visitFrequency: String(Number(d.visitFrequencyTarget) || ""),
        productsPreferred: "",
      })),
      activeFilters:
        [
          filterArea !== "all" ? `Area: ${filterArea}` : "",
          search ? `Search: ${search}` : "",
        ]
          .filter(Boolean)
          .join(", ") || "All Data",
      companyName: companyProfile?.companyName || "Krishkar Pharmaceuticals",
    });
    logExportToAuditTrail(
      {
        userId: String(session?.userId ?? ""),
        userName: String(session?.name ?? ""),
        role: String(session?.role ?? ""),
      },
      "Doctor Master",
      [
        filterArea !== "all" ? `Area: ${filterArea}` : "",
        search ? `Search: ${search}` : "",
      ]
        .filter(Boolean)
        .join(", ") || "All Data",
      filteredDoctors.length,
    );
  };

  const filteredDoctors = useMemo(
    () =>
      doctors.filter((d) => {
        const matchArea = filterArea === "all" || d.area === filterArea;
        const q = search.toLowerCase();
        const matchSearch =
          !q ||
          d.name.toLowerCase().includes(q) ||
          d.area.toLowerCase().includes(q) ||
          d.station.toLowerCase().includes(q);
        return matchArea && matchSearch;
      }),
    [doctors, search, filterArea],
  );

  const totalPages = Math.max(1, Math.ceil(filteredDoctors.length / PAGE_SIZE));

  const pagedDoctors = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredDoctors.slice(start, start + PAGE_SIZE);
  }, [filteredDoctors, currentPage]);

  const validRows = bulkRows.filter((r) => r.errors.length === 0);
  const invalidRows = bulkRows.filter((r) => r.errors.length > 0);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkResult(null);
    setBulkRows([]);
    parseFile(file, areas, stations)
      .then((rows) => setBulkRows(rows))
      .catch((err: Error) => toast.error(err.message));
  }

  async function handleBulkImport() {
    if (!session || validRows.length === 0) return;
    const items: BulkImportDoctorInput[] = validRows.map((r) => ({
      name: r.name,
      qualification: r.qualification,
      station: r.station,
      area: r.area,
      specialization: r.specialization,
      contactPhone: r.contactPhone,
    }));
    setBulkImporting(true);
    try {
      // Updated: no extra area argument — area is per-row in items
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
        await loadData();
      }
    } catch {
      toast.error("Bulk import failed");
    } finally {
      setBulkImporting(false);
    }
  }

  async function handleDeleteSingle(doctorId: bigint) {
    setDeleteTarget([doctorId]);
  }

  async function handleDeleteSelected() {
    if (selectedIds.size === 0) return;
    setDeleteTarget(Array.from(selectedIds).map((id) => BigInt(id)));
  }

  async function confirmDelete() {
    if (!deleteTarget || deleteTarget.length === 0) return;
    setDeleting(true);
    try {
      if (deleteTarget.length === 1) {
        await (
          api as unknown as {
            deleteDoctor: (token: string, doctorId: bigint) => Promise<boolean>;
          }
        ).deleteDoctor(token, deleteTarget[0]);
      } else {
        await (
          api as unknown as {
            deleteDoctors: (
              token: string,
              doctorIds: bigint[],
            ) => Promise<{ deleted: bigint; failed: bigint }>;
          }
        ).deleteDoctors(token, deleteTarget);
      }
      toast.success(
        deleteTarget.length === 1
          ? "Doctor deleted"
          : `${deleteTarget.length} doctors deleted`,
      );
      setSelectedIds(new Set());
      setDeleteTarget(null);
      await loadData();
    } catch {
      toast.error("Failed to delete doctor(s)");
    } finally {
      setDeleting(false);
    }
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredDoctors.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredDoctors.map((d) => String(d.id))));
    }
  }

  function toggleSelectOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const tabs: {
    id: TabId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: "list", label: "Doctor List", icon: FileText },
    { id: "bulk", label: "Bulk Upload", icon: Upload },
    { id: "history", label: "Upload History", icon: History },
  ];

  return (
    <PortalLayout portalRole={effectiveRole}>
      {showAddDoctor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-screen overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">Add New Doctor</h2>
            <div className="space-y-3">
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="Doctor Name *"
                value={addDoctorForm.name}
                onChange={(e) =>
                  setAddDoctorForm((f) => ({ ...f, name: e.target.value }))
                }
                data-ocid="add-doctor-name"
              />
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="Specialization"
                value={addDoctorForm.specialization}
                onChange={(e) =>
                  setAddDoctorForm((f) => ({
                    ...f,
                    specialization: e.target.value,
                  }))
                }
                data-ocid="add-doctor-specialization"
              />
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="Qualification"
                value={addDoctorForm.qualification}
                onChange={(e) =>
                  setAddDoctorForm((f) => ({
                    ...f,
                    qualification: e.target.value,
                  }))
                }
                data-ocid="add-doctor-qualification"
              />
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="Mobile Number"
                value={addDoctorForm.contactPhone}
                onChange={(e) =>
                  setAddDoctorForm((f) => ({
                    ...f,
                    contactPhone: e.target.value,
                  }))
                }
                data-ocid="add-doctor-phone"
              />
              <div>
                <label
                  htmlFor="add-doctor-station"
                  className="text-sm font-medium"
                >
                  Station *
                </label>
                <select
                  id="add-doctor-station"
                  className="w-full border rounded px-3 py-2 text-sm mt-1"
                  value={selectedStation?.stationId?.toString() ?? ""}
                  onChange={(e) => {
                    const s =
                      stations.find(
                        (st) => st.stationId?.toString() === e.target.value,
                      ) || null;
                    setSelectedStation(s);
                    setAddDoctorForm((f) => ({
                      ...f,
                      station: s?.stationName ?? "",
                      area: "",
                    }));
                  }}
                  data-ocid="add-doctor-station"
                >
                  <option value="">Select Station</option>
                  {stations.map((s) => (
                    <option
                      key={s.stationId?.toString()}
                      value={s.stationId?.toString()}
                    >
                      {s.stationName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="add-doctor-territory"
                  className="text-sm font-medium"
                >
                  Territory *
                </label>
                <select
                  id="add-doctor-territory"
                  className="w-full border rounded px-3 py-2 text-sm mt-1"
                  value={addDoctorForm.area}
                  onChange={(e) =>
                    setAddDoctorForm((f) => ({ ...f, area: e.target.value }))
                  }
                  data-ocid="add-doctor-territory"
                >
                  <option value="">Select Territory</option>
                  {areas
                    .filter(
                      (a) =>
                        !selectedStation ||
                        (a as AreaRecord & { stationId?: bigint }).stationId ===
                          selectedStation.stationId,
                    )
                    .map((a) => (
                      <option key={a.id?.toString() || a.name} value={a.name}>
                        {a.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                className="flex-1 bg-blue-600 text-white py-2 rounded text-sm"
                data-ocid="add-doctor-save"
                onClick={async () => {
                  if (
                    !addDoctorForm.name ||
                    !addDoctorForm.station ||
                    !addDoctorForm.area
                  ) {
                    alert("Doctor Name, Station and Territory are required");
                    return;
                  }
                  try {
                    await api.addDoctor(BigInt(0), {
                      name: addDoctorForm.name,
                      station: addDoctorForm.station,
                      area: addDoctorForm.area,
                      territory: addDoctorForm.area,
                      specialization: addDoctorForm.specialization,
                      qualification: addDoctorForm.qualification
                        ? {
                            __kind__: "Other" as const,
                            Other: addDoctorForm.qualification,
                          }
                        : { __kind__: "MBBS" as const, MBBS: null },
                      contactPhone: addDoctorForm.contactPhone,
                    });
                    setShowAddDoctor(false);
                    setAddDoctorForm({
                      name: "",
                      specialization: "",
                      qualification: "",
                      contactPhone: "",
                      station: "",
                      area: "",
                    });
                    setSelectedStation(null);
                    await loadData();
                  } catch (e) {
                    alert(`Failed to add doctor: ${(e as Error).message}`);
                  }
                }}
              >
                Save
              </button>
              <button
                type="button"
                className="flex-1 border py-2 rounded text-sm"
                data-ocid="add-doctor-cancel"
                onClick={() => {
                  setShowAddDoctor(false);
                  setAddDoctorForm({
                    name: "",
                    specialization: "",
                    qualification: "",
                    contactPhone: "",
                    station: "",
                    area: "",
                  });
                  setSelectedStation(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {editingDoctor && (
        <EditDoctorModal
          doctor={editingDoctor}
          areas={areas}
          stations={stations}
          token={token}
          onClose={() => setEditingDoctor(null)}
          onSaved={loadData}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          count={deleteTarget.length}
          onConfirm={confirmDelete}
          onClose={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}

      <PageHeader
        title="Doctor Master"
        subtitle="Manage doctor records and bulk upload for all areas"
        actions={
          <div className="flex gap-2">
            {tabs.map((t) => (
              <Button
                key={t.id}
                variant={tab === t.id ? "default" : "outline"}
                size="sm"
                onClick={() => setTab(t.id)}
                data-ocid={`tab-doctor-${t.id}`}
              >
                <t.icon className="w-3.5 h-3.5 mr-1.5" />
                {t.label}
              </Button>
            ))}
          </div>
        }
      />
      <PageContent>
        {/* DOCTOR LIST TAB */}
        {tab === "list" && (
          <div className="space-y-4">
            <SectionCard>
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[200px]">
                  <Label className="text-xs mb-1 block">
                    Search (Name, Area, Station)
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search doctors…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-8"
                      data-ocid="doctor-master-search"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Filter by Area</Label>
                  <Select value={filterArea} onValueChange={setFilterArea}>
                    <SelectTrigger
                      className="w-[180px]"
                      data-ocid="doctor-master-filter-area"
                    >
                      <SelectValue placeholder="All Areas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Areas</SelectItem>
                      {areas.map((a) => (
                        <SelectItem key={a.id.toString()} value={a.name}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {canEdit && selectedIds.size > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteSelected}
                    data-ocid="btn-delete-selected-doctors"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    Delete Selected ({selectedIds.size})
                  </Button>
                )}
                {canEdit && (
                  <Button
                    size="sm"
                    onClick={() => setShowAddDoctor(true)}
                    data-ocid="btn-add-new-doctor"
                  >
                    + Add New Doctor
                  </Button>
                )}
              </div>
            </SectionCard>

            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-sm text-foreground">
                Doctors ({filteredDoctors.length})
              </span>
              <ExportButton
                onClick={handleExportDoctors}
                disabled={filteredDoctors.length === 0}
                tooltip={
                  filteredDoctors.length === 0
                    ? "No data to export"
                    : "Exports currently filtered data"
                }
              />
            </div>
            <SectionCard title="Doctors">
              {loading ? (
                /* Loading skeleton */
                <ScrollableTable>
                  <table className="w-full text-sm min-w-[700px]">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border">
                        {[
                          "Sr",
                          "Name",
                          "Qualification",
                          "Station",
                          "Area",
                          "Specialization",
                          "Phone",
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
                    <tbody>
                      {Array.from({ length: 5 }).map((_, rowIdx) => (
                        <tr key={rowIdx} className="border-b border-border">
                          {[20, 160, 80, 100, 90, 110, 80].map((w, colIdx) => (
                            <td key={colIdx} className="px-3 py-3">
                              <div
                                className="h-4 bg-muted rounded animate-pulse"
                                style={{ width: `${w}px` }}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollableTable>
              ) : filteredDoctors.length === 0 ? (
                <div
                  className="py-12 text-center"
                  data-ocid="doctor-master-empty"
                >
                  <p className="text-muted-foreground text-sm">
                    No doctors found. Use Bulk Upload to add doctors.
                  </p>
                </div>
              ) : (
                <>
                  <ScrollableTable>
                    <table className="w-full text-sm min-w-[700px]">
                      <thead>
                        <tr className="bg-muted/40 border-b border-border">
                          {canEdit && (
                            <th className="px-3 py-2 w-8">
                              <input
                                type="checkbox"
                                checked={
                                  selectedIds.size === filteredDoctors.length &&
                                  filteredDoctors.length > 0
                                }
                                onChange={toggleSelectAll}
                                className="accent-primary cursor-pointer"
                                aria-label="Select all"
                                data-ocid="doctor-select-all"
                              />
                            </th>
                          )}
                          {[
                            "Sr",
                            "Name",
                            "Qualification",
                            "Station",
                            "Area",
                            "Specialization",
                            "Phone",
                          ].map((h) => (
                            <th
                              key={h}
                              className="px-3 py-2 text-left text-xs font-display text-muted-foreground uppercase tracking-wider"
                            >
                              {h}
                            </th>
                          ))}
                          {canEdit && (
                            <th className="px-3 py-2 text-left text-xs font-display text-muted-foreground uppercase tracking-wider">
                              Actions
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {pagedDoctors.map((d, i) => {
                          const globalSr =
                            (currentPage - 1) * PAGE_SIZE + i + 1;
                          return (
                            <tr
                              key={String(d.id)}
                              className="hover:bg-muted/20"
                              data-ocid={`doctor-row-${d.id}`}
                            >
                              {canEdit && (
                                <td className="px-3 py-2">
                                  <input
                                    type="checkbox"
                                    checked={selectedIds.has(String(d.id))}
                                    onChange={() =>
                                      toggleSelectOne(String(d.id))
                                    }
                                    className="accent-primary cursor-pointer"
                                    aria-label={`Select ${d.name}`}
                                    data-ocid={`doctor-checkbox-${d.id}`}
                                  />
                                </td>
                              )}
                              <td className="px-3 py-2 text-xs text-muted-foreground font-mono">
                                {globalSr}
                              </td>
                              <td className="px-3 py-2 font-body font-medium text-foreground">
                                {d.name}
                              </td>
                              <td className="px-3 py-2 text-xs">
                                {formatQualification(d.qualification)}
                              </td>
                              <td className="px-3 py-2 text-xs">{d.station}</td>
                              <td className="px-3 py-2 text-xs">{d.area}</td>
                              <td className="px-3 py-2 text-xs text-muted-foreground">
                                {d.specialization || "—"}
                              </td>
                              <td className="px-3 py-2 text-xs font-mono">
                                {d.contactPhone || "—"}
                              </td>
                              {canEdit && (
                                <td className="px-3 py-2">
                                  <div className="flex gap-1">
                                    <button
                                      type="button"
                                      title="Edit doctor"
                                      aria-label="Edit doctor"
                                      className="p-1.5 rounded hover:bg-primary/10 text-primary transition-colors"
                                      onClick={() => setEditingDoctor(d)}
                                      data-ocid={`btn-edit-doctor-${d.id}`}
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      title="Delete doctor"
                                      aria-label="Delete doctor"
                                      className="p-1.5 rounded hover:bg-destructive/10 text-destructive transition-colors"
                                      onClick={() => handleDeleteSingle(d.id)}
                                      data-ocid={`btn-delete-doctor-${d.id}`}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </ScrollableTable>
                  <PaginationControls
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={filteredDoctors.length}
                    pageSize={PAGE_SIZE}
                    onPrev={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    onNext={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                  />
                </>
              )}
            </SectionCard>
          </div>
        )}

        {/* BULK UPLOAD TAB */}
        {tab === "bulk" && (
          <div className="max-w-4xl space-y-5">
            {/* Scroll to Bottom for long bulk upload form */}
            <div className="flex justify-end">
              <ScrollToBottom label="Jump to bottom" />
            </div>
            <SectionCard>
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <h3 className="font-display font-semibold text-sm text-foreground">
                      Bulk Upload Doctors
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Download the Excel template, fill in doctor details
                      (including Area/Territory for each row), and upload here.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Mandatory columns:{" "}
                      <span className="font-mono bg-muted/60 px-1.5 py-0.5 rounded text-foreground">
                        Doctor Name, Area/Territory
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Qualification values should match:{" "}
                      <span className="font-mono text-foreground">
                        {QUALIFICATION_OPTIONS.join(", ")}
                      </span>
                    </p>
                    <p className="text-xs text-amber-700 mt-1">
                      ⚠ Area/Territory must exactly match an existing Area name
                      in the system. Station (optional) must match an existing
                      Station name under the given HQ.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadTemplate}
                    className="shrink-0"
                    data-ocid="btn-download-doctor-template"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Download Template
                  </Button>
                </div>

                <div>
                  <Label htmlFor="bulk-file" className="text-xs mb-1 block">
                    Upload Excel File (.xlsx, .xls){" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <input
                    ref={fileRef}
                    id="bulk-file"
                    type="file"
                    accept=".xlsx,.xls"
                    className="block w-full text-xs text-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:bg-muted file:text-foreground hover:file:bg-muted/80 cursor-pointer"
                    onChange={handleFileChange}
                    data-ocid="bulk-doctor-file-input"
                  />
                </div>
              </div>
            </SectionCard>

            {bulkRows.length > 0 && (
              <div className="space-y-4">
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

                {validRows.length > 0 && (
                  <div className="bg-card border border-border rounded-lg overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-border bg-green-50">
                      <span className="text-xs font-display font-semibold text-green-700 uppercase tracking-wider">
                        Valid Rows — Ready to Save ({validRows.length})
                      </span>
                    </div>
                    <div className="overflow-x-auto max-h-64">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-muted/30 border-b border-border">
                            {[
                              "#",
                              "Name",
                              "Qualification",
                              "Station",
                              "Area/Territory",
                              "Specialization",
                              "Phone",
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
                          {validRows.map((row) => (
                            <tr
                              key={`valid-${row.rowIndex}`}
                              className="border-b border-border/50"
                            >
                              <td className="px-3 py-2 text-muted-foreground">
                                {row.rowIndex}
                              </td>
                              <td className="px-3 py-2 font-medium">
                                {row.name}
                              </td>
                              <td className="px-3 py-2">
                                {row.qualification || "—"}
                              </td>
                              <td className="px-3 py-2">
                                {row.station || (
                                  <span className="text-muted-foreground italic text-xs">
                                    —
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <span className="flex items-center gap-1 text-green-700">
                                  <CheckCircle2 className="w-3 h-3" />{" "}
                                  {row.area}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                {row.specialization}
                              </td>
                              <td className="px-3 py-2 font-mono">
                                {row.contactPhone}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {invalidRows.length > 0 && (
                  <div className="bg-card border border-border rounded-lg overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-border bg-destructive/5 flex items-center justify-between">
                      <span className="text-xs font-display font-semibold text-destructive uppercase tracking-wider">
                        Invalid Rows — Skipped ({invalidRows.length})
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadErrorReport(invalidRows)}
                        data-ocid="btn-download-error-report"
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
                              "Doctor Name",
                              "Area Value",
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
                                {row.name || (
                                  <span className="text-destructive italic">
                                    blank
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                {row.area || (
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

            {bulkResult && (
              <div
                className={`rounded-lg p-4 border text-sm space-y-1 ${bulkResult.failed === 0 ? "border-green-300 bg-green-50" : "border-destructive/30 bg-destructive/5"}`}
              >
                <p className="font-semibold">
                  Import complete: {bulkResult.succeeded} succeeded,{" "}
                  {bulkResult.failed} failed
                </p>
                {bulkResult.errors.map((e) => (
                  <p key={e.slice(0, 40)} className="text-xs text-destructive">
                    {e}
                  </p>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={handleBulkImport}
                disabled={bulkImporting || validRows.length === 0}
                data-ocid="btn-confirm-bulk-import-doctors"
              >
                {bulkImporting && (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                )}
                <Upload className="w-4 h-4 mr-1.5" />
                Import {validRows.length} Doctor(s)
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setBulkRows([]);
                  setBulkResult(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
              >
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* UPLOAD HISTORY TAB */}
        {tab === "history" && (
          <SectionCard title="Bulk Upload History">
            {historyLoading ? (
              <div className="space-y-2 py-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-10 bg-muted rounded animate-pulse"
                  />
                ))}
              </div>
            ) : history.length === 0 ? (
              <div
                className="py-12 text-center"
                data-ocid="upload-history-empty"
              >
                <p className="text-muted-foreground text-sm">
                  No bulk uploads yet.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      {[
                        "Date & Time",
                        "Uploaded By",
                        "Total Rows",
                        "Saved",
                        "Skipped",
                        "Error Report",
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
                    {history.map((record) => (
                      <tr
                        key={String(record.id)}
                        className="hover:bg-muted/20"
                        data-ocid={`history-row-${record.id}`}
                      >
                        <td className="px-3 py-2 text-xs font-mono">
                          {new Date(
                            Number(record.uploadedAt) / 1_000_000,
                          ).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {historyUsers.find(
                            (u) => String(u.id) === record.uploadedBy,
                          )?.name ?? `#${record.uploadedBy}`}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {String(record.totalRows)}
                        </td>
                        <td className="px-3 py-2">
                          <Badge className="bg-green-100 text-green-700 border-green-300 text-xs">
                            {String(record.savedRows)}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          <Badge
                            className={`text-xs ${Number(record.skippedRows) > 0 ? "bg-destructive/10 text-destructive border-destructive/30" : "bg-muted text-muted-foreground border-border"}`}
                          >
                            {String(record.skippedRows)}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          {Number(record.skippedRows) > 0 ? (
                            <button
                              type="button"
                              onClick={() => downloadHistoryErrorReport(record)}
                              className="text-xs text-primary underline underline-offset-2 hover:text-primary/80"
                              data-ocid={`btn-download-errors-${record.id}`}
                            >
                              Download Errors
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              None
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
        )}
      </PageContent>
    </PortalLayout>
  );
}
