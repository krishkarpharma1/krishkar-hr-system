/**
 * MRTravelPlan.tsx — Monthly Tour Program (MTP) scaffold for MR portal.
 * Extended: Station dropdown from HQ Station Master, Additional Station toggle,
 * multi-additional-stations support (Admin config), primaryStation / additionalStations
 * saved to backend CreateTravelPlanInput fields.
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  CalendarRange,
  ChevronDown,
  ChevronUp,
  Clock,
  Edit2,
  FileSpreadsheet,
  Loader2,
  MapPin,
  Minus,
  Plus,
  RefreshCw,
  Send,
  ToggleLeft,
  ToggleRight,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Role, TravelPlanStatus } from "../../backend";
import {
  DataTable,
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { groupAreasByHq, useAllottedAreas } from "../../hooks/useAllottedAreas";
import type { AreaOption } from "../../hooks/useAllottedAreas";
import { isGpsRequired, isMobileDevice, useGps } from "../../hooks/useGps";
import { api } from "../../lib/api";
import {
  handleResultError,
  handleSessionError,
} from "../../lib/sessionErrorHandler";
import { useAuthStore } from "../../store/authStore";
import type { StationRecord, TravelPlanInfo } from "../../types";
// MtpBulkUpload removed (V77-V82 rollback)

// ── MTP encoding helpers ──────────────────────────────────────────────────────
interface MtpFields {
  area: string;
  exStation: string;
  activityNotes: string;
  typeOfWork: string;
}

function encodeMtpNotes(fields: MtpFields, mrModeTag?: string): string {
  const prefix = `[MTP|area=${fields.area}|exstation=${fields.exStation}|tow=${fields.typeOfWork}|notes=${fields.activityNotes}]`;
  return mrModeTag ? `${prefix}${mrModeTag}` : prefix;
}

function decodeMtpNotes(raw: string): MtpFields {
  // New format with typeOfWork
  const m2 = raw.match(
    /^\[MTP\|area=([^|]*)\|exstation=([^|]*)\|tow=([^|]*)\|notes=(.*)\]$/s,
  );
  if (m2)
    return {
      area: m2[1],
      exStation: m2[2],
      typeOfWork: m2[3],
      activityNotes: m2[4],
    };
  // Legacy format without typeOfWork
  const m1 = raw.match(
    /^\[MTP\|area=([^|]*)\|exstation=([^|]*)\|notes=(.*)\]$/s,
  );
  if (m1)
    return {
      area: m1[1],
      exStation: m1[2],
      typeOfWork: "",
      activityNotes: m1[3],
    };
  return { area: "", exStation: "", typeOfWork: "", activityNotes: raw };
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_OF_WORK_VALUES = [
  "HQ",
  "Ex-Station",
  "Out-Station",
  "Joint Work with Manager",
  "As Per Working Plan",
];

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  [TravelPlanStatus.Draft]:
    "bg-amber-100 text-amber-700 border border-amber-300",
  [TravelPlanStatus.Submitted]:
    "bg-blue-100 text-blue-700 border border-blue-300",
};

function StatusPill({ status }: { status: TravelPlanStatus }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-semibold font-body ${
        STATUS_BADGE[status] ?? "bg-muted text-muted-foreground"
      }`}
    >
      {status === TravelPlanStatus.Draft ? "Draft" : "Submitted"}
    </span>
  );
}

// ── Date bounds ───────────────────────────────────────────────────────────────

function getDateBounds() {
  const now = new Date();
  const min = new Date(now.getFullYear(), now.getMonth(), 1);
  const max = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  return {
    min: min.toISOString().slice(0, 10),
    max: max.toISOString().slice(0, 10),
  };
}

// ── GPS Status Row ────────────────────────────────────────────────────────────

function GpsStatusRow({
  coords,
  error,
  locationNote,
  onRefresh,
  loading,
}: {
  coords: { lat: number; lng: number } | null;
  error: string | null;
  locationNote?: string | null;
  onRefresh: () => void;
  loading?: boolean;
}) {
  if (coords) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-green-300 bg-green-50 text-green-700 text-xs">
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
        <MapPin className="w-3.5 h-3.5 shrink-0" />
        <span className="font-mono flex-1">
          {locationNote ??
            `Location: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`}
        </span>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          aria-label="Refresh GPS"
          className="opacity-70 hover:opacity-100"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
          />
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 px-3 py-2.5 rounded-md border border-orange-300 bg-orange-50 text-orange-700 text-xs">
      <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0 mt-0.5" />
      <div className="flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">
            {isMobileDevice()
              ? "Location: Not available — enable GPS to save"
              : "Location: Detecting…"}
          </span>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="opacity-70 hover:opacity-100 inline-flex items-center gap-1 underline-offset-2 hover:underline"
            aria-label="Retry GPS"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Retry
          </button>
        </div>
        {error && <p className="mt-0.5 text-orange-600 text-[11px]">{error}</p>}
      </div>
    </div>
  );
}

// ── AllottedHQPanel ───────────────────────────────────────────────────────────

function AllottedHQPanel({
  areas,
  loading,
}: { areas: AreaOption[]; loading: boolean }) {
  const [open, setOpen] = useState(() => window.innerWidth >= 768);
  const groups = groupAreasByHq(areas);

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted/30 transition-colors"
        aria-expanded={open}
        data-ocid="mtp-hq-panel-toggle"
      >
        <span className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          My Allotted HQs &amp; Stations
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-border/60 pt-3">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          ) : groups.length === 0 ? (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2.5 flex items-center gap-2">
              <MapPin className="w-4 h-4 shrink-0" />
              No locations allotted. Please contact HR or Admin.
            </p>
          ) : (
            <div className="space-y-3">
              {groups.map((group) => (
                <div key={group.hqName}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                      HQ: {group.hqName}
                    </span>
                    {group.isAdditionalHq && (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-300">
                        Additional HQ
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 ml-2">
                    {group.areas.map((area) => (
                      <span
                        key={area.areaId.toString()}
                        className="inline-block px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary border border-primary/20 font-medium"
                      >
                        {area.areaName}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── AreaSelect ────────────────────────────────────────────────────────────────

function AreaSelect({
  areas,
  value,
  onChange,
  areasLoading,
}: {
  areas: AreaOption[];
  value: string;
  onChange: (v: string) => void;
  areasLoading: boolean;
}) {
  if (areasLoading) return <Skeleton className="h-10 w-full" />;
  if (areas.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-md border border-amber-300 bg-amber-50 text-amber-700 text-sm">
        <MapPin className="w-4 h-4 shrink-0" />
        No areas allotted yet — contact HR.
      </div>
    );
  }
  const groups = groupAreasByHq(areas);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      data-ocid="mtp-area-select"
      className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-ring h-10"
    >
      <option value="" disabled>
        Select planned area
      </option>
      {groups.map((group) => (
        <optgroup
          key={group.hqName}
          label={
            group.isAdditionalHq
              ? `${group.hqName} (Additional HQ)`
              : group.hqName
          }
        >
          {group.areas.map((area) => (
            <option key={area.areaId.toString()} value={area.areaName}>
              {area.areaName}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

// ── MTP Form State ─────────────────────────────────────────────────────────────

interface MtpForm {
  date: string;
  primaryStation: string;
  additionalStations: string[];
  area: string;
  typeOfWork: string;
  exStation: string;
  activityNotes: string;
  showAdditionalStation: boolean;
}

const BLANK_MTP: MtpForm = {
  date: "",
  primaryStation: "",
  additionalStations: [],
  area: "",
  typeOfWork: "",
  exStation: "",
  activityNotes: "",
  showAdditionalStation: false,
};

type BulkModalVisible = boolean;
type ModalMode = "create" | "edit" | null;

// ── Main Component ─────────────────────────────────────────────────────────────

export default function MRTravelPlan() {
  const session = useAuthStore((s) => s.session);

  const isMrMode =
    new URLSearchParams(window.location.search).get("mrMode") === "1";
  const {
    coords: gpsCoords,
    error: gpsError,
    locationNote: gpsNote,
    loading: gpsLoading,
    refreshGps,
  } = useGps();
  const [plans, setPlans] = useState<TravelPlanInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingPlan, setEditingPlan] = useState<TravelPlanInfo | null>(null);
  const [form, setForm] = useState<MtpForm>(BLANK_MTP);
  const [saving, setSaving] = useState(false);
  const [submittingId, setSubmittingId] = useState<bigint | null>(null);
  const [monthFilter, setMonthFilter] = useState<string>("");
  const [showGpsError, setShowGpsError] = useState(false);

  const [_stations] = useState<StationRecord[]>([]);

  const { areas: allottedAreas, loading: areasLoading } = useAllottedAreas();
  const { min: dateMin, max: dateMax } = getDateBounds();
  const [_showBulkUpload, _setShowBulkUpload] =
    useState<BulkModalVisible>(false);

  const now = new Date();
  const currentMonthValue = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonthValue = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`;

  // Load MTP settings and stations on mount

  const loadPlans = useCallback(
    async (filterMonth?: string) => {
      if (!session) return;
      setLoading(true);
      try {
        const data = await api.listMyTravelPlans(
          session.token,
          filterMonth || undefined,
        );
        setPlans(data.sort((a, b) => a.date.localeCompare(b.date)));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        handleSessionError(msg, () => toast.error("Failed to load MTP plans."));
      } finally {
        setLoading(false);
      }
    },
    [session],
  );

  useEffect(() => {
    loadPlans(monthFilter || undefined);
  }, [loadPlans, monthFilter]);

  const _isAsPerPlan = form.typeOfWork === "As Per Working Plan";

  function openCreate() {
    setForm({
      ...BLANK_MTP,
      date: new Date().toISOString().slice(0, 10),
    });
    setEditingPlan(null);
    setShowGpsError(false);
    setModalMode("create");
  }

  function openEdit(plan: TravelPlanInfo) {
    const decoded = decodeMtpNotes(plan.notes);
    setForm({
      date: plan.date,
      primaryStation: plan.plannedStation || "",
      additionalStations: [],
      area: decoded.area,
      typeOfWork: decoded.typeOfWork || "",
      exStation: decoded.exStation,
      activityNotes: decoded.activityNotes,
      showAdditionalStation: false,
    });
    setEditingPlan(plan);
    setShowGpsError(false);
    setModalMode("edit");
  }

  function closeModal() {
    setModalMode(null);
    setEditingPlan(null);
    setForm(BLANK_MTP);
    setShowGpsError(false);
  }

  function setField<K extends keyof MtpForm>(k: K, v: MtpForm[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function handleSave() {
    if (!session) return;
    if (!form.date) {
      toast.error("Date is required");
      return;
    }
    if (isGpsRequired() && !gpsCoords) {
      setShowGpsError(true);
      toast.error("GPS location is required. Please enable location access.");
      return;
    }
    setShowGpsError(false);

    const gpsLocation = gpsCoords
      ? { lat: gpsCoords.lat, lng: gpsCoords.lng }
      : null;
    const mrTerritoryHqId = isMrMode
      ? (new URLSearchParams(window.location.search).get("mrTerritoryHqId") ??
        "")
      : "";
    const encodedNotes = encodeMtpNotes(
      {
        area: form.area,
        typeOfWork: form.typeOfWork,
        exStation: form.exStation,
        activityNotes: form.activityNotes,
      },
      isMrMode && session
        ? `[MR_MODE|hq=${mrTerritoryHqId}|emp=${String(session.userId)}]`
        : undefined,
    );

    const plannedStation = form.area || form.typeOfWork || "HQ";

    setSaving(true);
    try {
      if (modalMode === "create") {
        const res = await api.createTravelPlan(session.token, {
          date: form.date,
          plannedStation,
          notes: encodedNotes,
          gpsLocation,
        } as Parameters<typeof api.createTravelPlan>[1]);
        if (res.__kind__ === "err") {
          handleResultError(
            res.err,
            toast.error,
            "Failed to create MTP (Tour Plan) entry",
          );
          return;
        }
        toast.success("MTP entry created successfully");
      } else if (modalMode === "edit" && editingPlan) {
        const res = await api.updateTravelPlan(session.token, editingPlan.id, {
          date: form.date,
          plannedStation,
          notes: encodedNotes,
          gpsLocation,
        } as Parameters<typeof api.updateTravelPlan>[2]);
        if (res.__kind__ === "err") {
          handleResultError(
            res.err,
            toast.error,
            "Failed to update MTP (Tour Plan) entry",
          );
          return;
        }
        toast.success("MTP entry updated successfully");
      }
      closeModal();
      loadPlans(monthFilter || undefined);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      handleSessionError(msg, () =>
        toast.error("Failed to save MTP entry. Please try again."),
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitPlan(plan: TravelPlanInfo) {
    if (!session) return;
    if (isGpsRequired() && !gpsCoords) {
      toast.error(
        isMobileDevice()
          ? "GPS location is required to submit."
          : "Location required to submit.",
      );
      return;
    }
    setSubmittingId(plan.id);
    try {
      const res = await api.submitTravelPlan(session.token, plan.id);
      if (res.__kind__ === "err") {
        handleResultError(res.err, toast.error, "Failed to submit MTP");
        return;
      }
      toast.success("MTP submitted to your reporting manager for approval.");
      loadPlans(monthFilter || undefined);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      handleSessionError(msg, () =>
        toast.error("Failed to submit. Please try again."),
      );
    } finally {
      setSubmittingId(null);
    }
  }

  const cols = [
    { key: "date", label: "Date" },
    { key: "area", label: "Planned Area" },
    { key: "station", label: "Station" },
    { key: "tow", label: "Type of Work" },
    { key: "notes", label: "Activity Notes" },
    { key: "status", label: "Status" },
    { key: "actions", label: "Actions" },
  ];

  return (
    <PortalLayout portalRole={Role.MR}>
      <PageHeader
        title="MTP (Monthly Tour Plan)"
        subtitle="Plan your monthly territory tour schedule — submitted plans are sent to your reporting manager for approval"
        actions={
          <div className="flex gap-2 flex-wrap">
            {/* Bulk Upload buttons removed (V76 rollback) */}
            <Button
              size="sm"
              onClick={openCreate}
              data-ocid="mtp.add_button"
              className="gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add Day
            </Button>
          </div>
        }
      />
      <PageContent>
        {/* MR Mode Context Banner */}
        {isMrMode && (
          <div
            className="flex items-center gap-3 mb-4 px-4 py-3 rounded-xl bg-amber-50 border-2 border-amber-400"
            data-ocid="mtp.mr-mode-banner"
          >
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
            <p className="text-sm font-semibold text-amber-800">
              Submitting as MR (Acting RSM) — MTP will be routed to ZSM for
              approval.
            </p>
          </div>
        )}

        {/* GPS Status */}
        <div className="mb-4">
          <GpsStatusRow
            coords={gpsCoords}
            error={gpsError}
            locationNote={gpsNote}
            onRefresh={refreshGps}
            loading={gpsLoading}
          />
        </div>

        {/* Allotted HQ panel */}
        <div className="mb-4">
          <AllottedHQPanel areas={allottedAreas} loading={areasLoading} />
        </div>

        {/* Month Filter */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <Label className="text-sm text-muted-foreground whitespace-nowrap">
            Filter by month:
          </Label>
          <div className="flex gap-2 flex-wrap">
            {[
              { label: "All", value: "" },
              {
                label: now.toLocaleString("en-IN", {
                  month: "long",
                  year: "numeric",
                }),
                value: currentMonthValue,
              },
              {
                label: nextMonth.toLocaleString("en-IN", {
                  month: "long",
                  year: "numeric",
                }),
                value: nextMonthValue,
              },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMonthFilter(opt.value)}
                className={`px-3 py-1.5 text-xs rounded-md border transition-colors font-body ${
                  monthFilter === opt.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-border hover:bg-muted/40"
                }`}
                data-ocid="mtp.filter.tab"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* MTP info banner */}
        <div className="mb-4 flex items-start gap-3 px-4 py-3 rounded-lg bg-primary/5 border border-primary/20 text-primary text-sm">
          <CalendarRange className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="font-body leading-snug">
            <strong>MTP (Monthly Tour Plan):</strong> Plan your territory visits
            for each day of the upcoming month. Submit by the 25th of the
            current month for manager approval. Submitted MTPs are locked from
            further editing.
          </p>
        </div>

        {/* Table */}
        <DataTable
          columns={cols}
          data={plans}
          getKey={(p) => String(p.id)}
          loading={loading}
          emptyMessage="No MTP (Monthly Tour Plan) entries for this period. Click 'Add Day' to plan your territory tour."
          renderRow={(p, idx) => {
            const mtp = decodeMtpNotes(p.notes);
            const canEdit = p.status === TravelPlanStatus.Draft;
            const primaryStn = p.plannedStation || "—";
            return (
              <>
                <td
                  className="px-4 py-3 text-sm font-mono text-foreground whitespace-nowrap"
                  data-ocid={`mtp.item.${idx + 1}`}
                >
                  {p.date}
                </td>
                <td className="px-4 py-3 text-sm font-body text-foreground">
                  {mtp.area || <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-3 text-sm font-body text-foreground">
                  {primaryStn || (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {mtp.typeOfWork || <span>—</span>}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground max-w-[160px] truncate">
                  {mtp.activityNotes || (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={p.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {canEdit && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(p)}
                          className="h-7 px-2 gap-1 text-xs"
                          data-ocid={`mtp.edit_button.${idx + 1}`}
                        >
                          <Edit2 className="w-3 h-3" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSubmitPlan(p)}
                          disabled={submittingId === p.id}
                          className="h-7 px-2 gap-1 text-xs border-primary/40 text-primary hover:bg-primary/10"
                          data-ocid={`mtp.submit_button.${idx + 1}`}
                        >
                          {submittingId === p.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Send className="w-3 h-3" />
                          )}
                          Submit
                        </Button>
                      </>
                    )}
                    {p.status === TravelPlanStatus.Submitted && (
                      <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                        <Clock className="w-3 h-3" />
                        Pending approval
                      </span>
                    )}
                  </div>
                </td>
              </>
            );
          }}
        />
      </PageContent>

      {/* Create/Edit Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={closeModal}
            onKeyDown={(e) => e.key === "Escape" && closeModal()}
          />
          <div
            className="relative bg-card rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            data-ocid="mtp.dialog"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border sticky top-0 bg-card z-10">
              <h2 className="font-display font-bold text-base text-foreground">
                {modalMode === "create"
                  ? "Add MTP (Tour Plan) Entry"
                  : "Edit MTP (Tour Plan) Entry"}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Close"
                data-ocid="mtp.close_button"
                className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* GPS Status */}
              <GpsStatusRow
                coords={gpsCoords}
                error={gpsError}
                locationNote={gpsNote}
                onRefresh={refreshGps}
                loading={gpsLoading}
              />
              {showGpsError && (
                <p className="text-xs text-destructive font-body">
                  GPS location is required. Please enable location access before
                  saving.
                </p>
              )}

              {/* Date */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="mtp-date"
                  className="text-sm font-medium text-foreground"
                >
                  Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="mtp-date"
                  type="date"
                  value={form.date}
                  min={dateMin}
                  max={dateMax}
                  onChange={(e) => setField("date", e.target.value)}
                  data-ocid="mtp.date_input"
                  className="h-10"
                />
              </div>

              {/* Planned Area */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-foreground">
                  Planned Area / Beat Plan
                </Label>
                <AreaSelect
                  areas={allottedAreas}
                  value={form.area}
                  onChange={(v) => setField("area", v)}
                  areasLoading={areasLoading}
                />
              </div>

              {/* Type of Work */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="mtp-tow"
                  className="text-sm font-medium text-foreground"
                >
                  Type of Work
                </Label>
                <select
                  id="mtp-tow"
                  value={form.typeOfWork}
                  onChange={(e) => {
                    const val = e.target.value;
                    setField("typeOfWork", val);
                    // reset additional stations when switching away
                    if (val !== "As Per Working Plan") {
                      setForm((prev) => ({
                        ...prev,
                        typeOfWork: val,
                        showAdditionalStation: false,
                        additionalStations: [],
                      }));
                    }
                  }}
                  data-ocid="mtp.type_of_work_select"
                  className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-ring h-10"
                >
                  <option value="">Select type of work</option>
                  {TYPE_OF_WORK_VALUES.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              {/* Ex-Station */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="mtp-exstation"
                  className="text-sm font-medium text-foreground"
                >
                  Ex-Station{" "}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="mtp-exstation"
                  placeholder="Ex-station area or station name"
                  value={form.exStation}
                  onChange={(e) => setField("exStation", e.target.value)}
                  data-ocid="mtp.exstation_input"
                  className="h-10"
                />
              </div>

              {/* Activity Notes */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="mtp-notes"
                  className="text-sm font-medium text-foreground"
                >
                  Activity Notes{" "}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </Label>
                <Textarea
                  id="mtp-notes"
                  placeholder="Planned detailing activities, doctors to visit, chemist/stockist calls…"
                  value={form.activityNotes}
                  onChange={(e) => setField("activityNotes", e.target.value)}
                  rows={3}
                  data-ocid="mtp.notes_textarea"
                  className="resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-5 pb-5 pt-2 sticky bottom-0 bg-card border-t border-border">
              <Button
                variant="outline"
                onClick={closeModal}
                className="flex-1"
                data-ocid="mtp.cancel_button"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 gap-2"
                data-ocid="mtp.save_button"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Bulk Upload removed — V76 rollback */}
    </PortalLayout>
  );
}
