import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  CalendarPlus,
  ChevronDown,
  ChevronUp,
  Edit2,
  ExternalLink,
  GitCompare,
  Loader2,
  Lock,
  MapPin,
  Plus,
  RefreshCw,
  Send,
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
import type { TravelPlanInfo } from "../../types";
import { formatDate } from "../../utils/dateFormatter";

type ModalMode = "create" | "edit" | null;

interface PlanForm {
  date: string;
  plannedStation: string;
  notes: string;
}

const BLANK_FORM: PlanForm = { date: "", plannedStation: "", notes: "" };

// Min/Max date bounds: current month start → next month end
function getDateBounds() {
  const now = new Date();
  const min = new Date(now.getFullYear(), now.getMonth(), 1);
  const max = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  return {
    min: min.toISOString().slice(0, 10),
    max: max.toISOString().slice(0, 10),
  };
}

function getMonthLabel(isoDate: string) {
  const d = new Date(`${isoDate}T00:00:00`);
  return d.toLocaleString("en-IN", { month: "long", year: "numeric" });
}

const STATUS_STYLES: Record<string, string> = {
  [TravelPlanStatus.Draft]:
    "bg-amber-100 text-amber-700 border border-amber-300",
  [TravelPlanStatus.Submitted]:
    "bg-green-100 text-green-700 border border-green-300",
  Approved: "bg-blue-100 text-blue-700 border border-blue-300",
  Rejected: "bg-red-100 text-red-700 border border-red-300",
};

// ── MTP Deadline Banner ───────────────────────────────────────────────────────

function MtpDeadlineBanner() {
  const now = new Date();
  const deadline = 25; // 25th of each month
  const daysLeft = deadline - now.getDate();
  if (daysLeft < 0 || daysLeft > 10) return null; // Only show in the last 10 days

  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-4 py-2.5 mb-4 text-sm border ${
        daysLeft <= 2
          ? "bg-red-50 border-red-200 text-red-700"
          : "bg-amber-50 border-amber-200 text-amber-700"
      }`}
      data-ocid="mtp-deadline-banner"
    >
      <AlertCircle className="w-4 h-4 shrink-0" />
      <span>
        Submit your next month&apos;s MTP before the{" "}
        <strong>25th of this month</strong>.{" "}
        {daysLeft === 0
          ? "Deadline is today!"
          : daysLeft === 1
            ? "1 day remaining."
            : `${daysLeft} days remaining.`}
      </span>
    </div>
  );
}

// ── MTP vs Actual Tab ─────────────────────────────────────────────────────────

interface MtpVsActualRow {
  date: string;
  plannedStation: string;
  actualStation: string;
  hasDeviation: boolean;
}

function MtpVsActualTab({
  session,
}: {
  session: { token: string; userId: bigint } | null;
}) {
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const [month, setMonth] = useState(prevMonth.getMonth() + 1);
  const [year, setYear] = useState(prevMonth.getFullYear());
  const [rows, setRows] = useState<MtpVsActualRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchData() {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const rawApi = api as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof rawApi.getMtpVsActualData !== "function") {
        setError("MTP vs Actual data is coming in Phase 2.");
        return;
      }
      const data = (await rawApi.getMtpVsActualData(
        session.token,
        Number(session.userId),
        month,
        year,
      )) as Array<[string, string, string]>;
      setRows(
        data.map(([date, planned, actual]) => ({
          date,
          plannedStation: planned,
          actualStation: actual,
          hasDeviation: planned !== actual && actual.length > 0,
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }

  const deviationCount = rows.filter((r) => r.hasDeviation).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label
            htmlFor="mtp-vs-month"
            className="text-sm text-muted-foreground"
          >
            Month:
          </label>
          <select
            id="mtp-vs-month"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            data-ocid="mtp-vs-month-select"
            className="bg-background border border-input rounded-md px-2 py-1.5 text-sm h-9 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={`month-${i + 1}`} value={i + 1}>
                {new Date(2000, i, 1).toLocaleString("en-IN", {
                  month: "long",
                })}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label
            htmlFor="mtp-vs-year"
            className="text-sm text-muted-foreground"
          >
            Year:
          </label>
          <select
            id="mtp-vs-year"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            data-ocid="mtp-vs-year-select"
            className="bg-background border border-input rounded-md px-2 py-1.5 text-sm h-9 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {[now.getFullYear() - 1, now.getFullYear()].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <Button
          size="sm"
          onClick={fetchData}
          disabled={loading}
          data-ocid="mtp-vs-fetch-btn"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
          ) : (
            <GitCompare className="w-3.5 h-3.5 mr-1" />
          )}
          {loading ? "Loading…" : "Compare"}
        </Button>
      </div>

      {error && (
        <div
          className="flex items-center gap-2 bg-muted border border-border rounded-lg px-4 py-3 text-sm text-muted-foreground"
          data-ocid="mtp-vs.error_state"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {!error && rows.length === 0 && !loading && (
        <div
          className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2 bg-card border border-border rounded-xl"
          data-ocid="mtp-vs.empty_state"
        >
          <GitCompare className="w-8 h-8 opacity-30" />
          <p className="text-sm">
            Select a month and click Compare to view MTP vs Actual data.
          </p>
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">
              <span className="font-semibold text-foreground">
                {rows.length}
              </span>{" "}
              days compared
            </span>
            <span
              className={
                deviationCount > 0
                  ? "text-orange-600 font-semibold"
                  : "text-green-600 font-semibold"
              }
            >
              {deviationCount === 0
                ? "✓ No deviations"
                : `${deviationCount} deviation${deviationCount !== 1 ? "s" : ""}`}
            </span>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground text-left whitespace-nowrap">
                      Date
                    </th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground text-left">
                      Planned Station
                    </th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground text-left">
                      Actual Station
                    </th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground text-left">
                      Deviation
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.date}
                      className={`border-b border-border ${r.hasDeviation ? "bg-orange-50/30" : ""}`}
                    >
                      <td className="px-3 py-2.5 text-xs font-mono whitespace-nowrap">
                        {formatDate(r.date)}
                      </td>
                      <td className="px-3 py-2.5 text-sm">
                        {r.plannedStation || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-sm">
                        {r.actualStation || (
                          <span className="text-muted-foreground italic">
                            Not recorded
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {r.hasDeviation ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
                            Yes
                          </span>
                        ) : r.actualStation ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
                            No
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── GpsStatusRow ─────────────────────────────────────────────────────────────

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
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-md border border-green-300 bg-green-50 text-green-700 text-xs"
        data-ocid="tp-gps-status"
      >
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
        <MapPin className="w-3.5 h-3.5 shrink-0" />
        <span className="font-mono flex-1">
          {locationNote
            ? locationNote
            : `Location: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`}
        </span>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="opacity-70 hover:opacity-100 transition-opacity"
          aria-label="Refresh GPS"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
          />
        </button>
      </div>
    );
  }

  if (locationNote) {
    return (
      <div
        className="flex items-start gap-2 px-3 py-2.5 rounded-md border border-primary/20 bg-primary/5 text-primary text-xs"
        data-ocid="tp-gps-status"
      >
        <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span className="flex-1 min-w-0">{locationNote}</span>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="opacity-70 hover:opacity-100 transition-opacity"
          aria-label="Retry GPS"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex items-start gap-2 px-3 py-2.5 rounded-md border border-orange-300 bg-orange-50 text-orange-700 text-xs"
      data-ocid="tp-gps-status"
    >
      <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">
            {isMobileDevice()
              ? "Location: Not Available — enable GPS to save"
              : "Location: Detecting…"}
          </span>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="opacity-70 hover:opacity-100 transition-opacity inline-flex items-center gap-1 underline-offset-2 hover:underline"
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

// ── MapLink ───────────────────────────────────────────────────────────────────

function MapLink({ lat, lng }: { lat: number; lng: number }) {
  const url = `https://maps.google.com/?q=${lat},${lng}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
      data-ocid="tp-view-on-map"
    >
      <ExternalLink className="w-3 h-3" />
      View on Map
    </a>
  );
}

// ── GpsRequiredBanner ─────────────────────────────────────────────────────────

function GpsRequiredBanner() {
  const mobile = isMobileDevice();
  if (!mobile) return null;
  return (
    <div
      className="flex items-start gap-3 p-4 rounded-lg border border-destructive/40 bg-destructive/5 text-destructive"
      data-ocid="tp-gps-required-banner"
      role="alert"
    >
      <MapPin className="w-5 h-5 shrink-0 mt-0.5" />
      <div className="space-y-1.5">
        <p className="font-semibold text-sm">
          Please enable location access in your browser settings to save this
          travel plan. GPS is required for all mobile submissions.
        </p>
        <div className="text-xs space-y-1 text-destructive/80">
          <p className="font-medium">How to enable GPS on Android Chrome:</p>
          <ul className="list-disc list-inside space-y-0.5 ml-1">
            <li>
              Tap the lock icon in the address bar → Site settings → Location →
              Allow
            </li>
          </ul>
          <p className="font-medium mt-1">On iPhone / Safari:</p>
          <ul className="list-disc list-inside space-y-0.5 ml-1">
            <li>Settings → Safari → Location → Allow</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ── AllottedHQPanel ────────────────────────────────────────────────────────────
// Collapsible reference panel showing all allotted HQs and their areas/stations

function AllottedHQPanel({
  areas,
  loading,
}: {
  areas: AreaOption[];
  loading: boolean;
}) {
  // Default: collapsed on mobile, open on desktop
  const [open, setOpen] = useState(() => window.innerWidth >= 768);

  const groups = groupAreasByHq(areas);

  return (
    <div
      className="bg-card border border-border rounded-lg overflow-hidden"
      data-ocid="tp-hq-panel"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted/30 transition-colors"
        data-ocid="tp-hq-panel-toggle"
        aria-expanded={open}
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
              No locations allotted. Please contact HR or Admin to allot your HQ
              and stations.
            </p>
          ) : (
            <div className="space-y-3" data-ocid="tp-hq-list">
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
                  {group.areas.length === 0 ? (
                    <p className="text-xs text-muted-foreground ml-2">
                      No areas assigned under this HQ
                    </p>
                  ) : (
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
                  )}
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
  if (areasLoading) {
    return <Skeleton className="h-10 w-full" />;
  }

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
      data-ocid="tp-area-select"
      className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-ring h-10"
    >
      <option value="" disabled>
        Select area to visit
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

export default function TravelPlanManagement() {
  const session = useAuthStore((s) => s.session);
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
  const [form, setForm] = useState<PlanForm>(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [submittingId, setSubmittingId] = useState<bigint | null>(null);
  const [monthFilter, setMonthFilter] = useState<string>("");
  const [showGpsError, setShowGpsError] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<TravelPlanInfo | null>(null);

  // Allotted areas via shared hook (includes Additional Charge HQs)
  const { areas: allottedAreas, loading: areasLoading } = useAllottedAreas();

  const { min: dateMin, max: dateMax } = getDateBounds();

  const now = new Date();
  const currentMonthValue = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonthValue = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}`;

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
        handleSessionError(msg, () =>
          toast.error("Failed to load travel plans. Please try again."),
        );
      } finally {
        setLoading(false);
      }
    },
    [session],
  );

  useEffect(() => {
    loadPlans(monthFilter || undefined);
  }, [loadPlans, monthFilter]);

  function openCreate() {
    setForm({ ...BLANK_FORM, date: new Date().toISOString().slice(0, 10) });
    setEditingPlan(null);
    setShowGpsError(false);
    setModalMode("create");
  }

  function openEdit(plan: TravelPlanInfo) {
    setForm({
      date: plan.date,
      plannedStation: plan.plannedStation,
      notes: plan.notes,
    });
    setEditingPlan(plan);
    setShowGpsError(false);
    setModalMode("edit");
  }

  function closeModal() {
    setModalMode(null);
    setEditingPlan(null);
    setForm(BLANK_FORM);
    setShowGpsError(false);
  }

  async function handleSave() {
    if (!session) return;
    if (!form.date || !form.plannedStation.trim()) {
      toast.error("Date and area / station are required");
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

    setSaving(true);
    try {
      if (modalMode === "create") {
        const res = await api.createTravelPlan(session.token, {
          date: form.date,
          plannedStation: form.plannedStation.trim(),
          primaryStation: form.plannedStation.trim(),
          additionalStations: [],
          notes: form.notes.trim(),
          gpsLocation,
        } as Parameters<typeof api.createTravelPlan>[1]);
        if (res.__kind__ === "err") {
          handleResultError(
            res.err,
            toast.error,
            "Failed to create travel plan",
          );
          return;
        }
        toast.success("Travel plan created");
      } else if (modalMode === "edit" && editingPlan) {
        const res = await api.updateTravelPlan(session.token, editingPlan.id, {
          date: form.date,
          plannedStation: form.plannedStation.trim(),
          primaryStation: form.plannedStation.trim(),
          additionalStations: [],
          notes: form.notes.trim(),
          gpsLocation,
        } as Parameters<typeof api.updateTravelPlan>[2]);
        if (res.__kind__ === "err") {
          handleResultError(
            res.err,
            toast.error,
            "Failed to update travel plan",
          );
          return;
        }
        toast.success("Travel plan updated");
      }
      closeModal();
      loadPlans(monthFilter || undefined);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      handleSessionError(msg, () =>
        toast.error("Failed to save travel plan. Please try again."),
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
          ? "GPS location is required to submit this plan. Please enable location access."
          : "Location is required to submit this travel plan.",
      );
      return;
    }
    setSubmittingId(plan.id);
    try {
      const res = await api.submitTravelPlan(session.token, plan.id);
      if (res.__kind__ === "err") {
        handleResultError(res.err, toast.error, "Failed to submit travel plan");
        return;
      }
      toast.success("Travel plan submitted");
      loadPlans(monthFilter || undefined);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      handleSessionError(msg, () =>
        toast.error("Failed to submit travel plan. Please try again."),
      );
    } finally {
      setSubmittingId(null);
    }
  }

  const tableCols = [
    { key: "date", label: "Date" },
    { key: "month", label: "Month" },
    { key: "station", label: "Area / Station" },
    { key: "notes", label: "Notes" },
    { key: "location", label: "Location" },
    { key: "status", label: "Status" },
    { key: "actions", label: "Actions" },
  ];

  return (
    <PortalLayout portalRole={Role.MR}>
      <PageHeader
        title="Monthly Tour Program"
        subtitle="Plan and manage your monthly tour schedule and track MTP vs Actual"
        actions={
          <Button
            size="sm"
            onClick={openCreate}
            data-ocid="create-tp-btn"
            className="gap-1.5"
          >
            <Plus className="w-4 h-4" />
            New Plan
          </Button>
        }
      />
      <PageContent>
        <MtpDeadlineBanner />

        <Tabs defaultValue="mtp" data-ocid="mtp-tabs">
          <TabsList className="mb-5 bg-card border border-border p-1">
            <TabsTrigger value="mtp" data-ocid="mtp-tab-plans">
              Tour Plans
            </TabsTrigger>
            <TabsTrigger value="vs-actual" data-ocid="mtp-tab-vs-actual">
              <GitCompare className="w-3.5 h-3.5 mr-1.5" />
              MTP vs Actual
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mtp">
            {/* GPS Status Bar */}
            <div className="mb-4">
              <GpsStatusRow
                coords={gpsCoords}
                error={gpsError}
                locationNote={gpsNote}
                onRefresh={refreshGps}
                loading={gpsLoading}
              />
            </div>

            {/* Collapsible Allotted HQ & Stations Reference Panel */}
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
                    data-ocid={`filter-month-${opt.value || "all"}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Plan Detail View */}
            {selectedPlan && (
              <div className="mb-4 bg-card border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedPlan(null)}
                  >
                    ← Back
                  </Button>
                  <h3 className="font-display font-semibold text-sm">
                    Travel Plan — {selectedPlan.date}
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">
                      Area / Station:{" "}
                    </span>
                    <span className="font-medium">
                      {selectedPlan.plannedStation}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status: </span>
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[selectedPlan.status] ?? ""}`}
                    >
                      {selectedPlan.status}
                    </span>
                  </div>
                  {selectedPlan.notes && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Notes: </span>
                      <span>{selectedPlan.notes}</span>
                    </div>
                  )}
                </div>
                {(
                  selectedPlan as TravelPlanInfo & {
                    gpsLocation?: { lat: number; lng: number };
                  }
                ).gpsLocation && (
                  <div className="flex items-center gap-2 text-xs pt-1 border-t border-border/40">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="font-mono text-muted-foreground">
                      Location:{" "}
                      {(
                        selectedPlan as TravelPlanInfo & {
                          gpsLocation?: { lat: number; lng: number };
                        }
                      ).gpsLocation!.lat.toFixed(5)}
                      ,{" "}
                      {(
                        selectedPlan as TravelPlanInfo & {
                          gpsLocation?: { lat: number; lng: number };
                        }
                      ).gpsLocation!.lng.toFixed(5)}
                    </span>
                    <MapLink
                      lat={
                        (
                          selectedPlan as TravelPlanInfo & {
                            gpsLocation?: { lat: number; lng: number };
                          }
                        ).gpsLocation!.lat
                      }
                      lng={
                        (
                          selectedPlan as TravelPlanInfo & {
                            gpsLocation?: { lat: number; lng: number };
                          }
                        ).gpsLocation!.lng
                      }
                    />
                  </div>
                )}
              </div>
            )}

            {loading ? (
              <div className="bg-card border border-border rounded-lg p-5 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <DataTable
                columns={tableCols}
                data={plans}
                getKey={(p) => p.id.toString()}
                loading={false}
                emptyMessage="No travel plans yet. Create your first plan for the current or upcoming month."
                renderRow={(p) => {
                  const planWithGps = p as TravelPlanInfo & {
                    gpsLocation?: { lat: number; lng: number };
                  };
                  return (
                    <>
                      <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                        {p.date}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {getMonthLabel(p.date)}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium max-w-[160px] truncate">
                        {p.plannedStation}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px]">
                        <span className="line-clamp-2">{p.notes || "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {planWithGps.gpsLocation ? (
                          <MapLink
                            lat={planWithGps.gpsLocation.lat}
                            lng={planWithGps.gpsLocation.lng}
                          />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[p.status] ?? ""}`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {p.status === TravelPlanStatus.Draft && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => openEdit(p)}
                                title="Edit"
                                data-ocid={`edit-tp-${p.id}`}
                              >
                                <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1 border-green-300 text-green-700 hover:bg-green-50"
                                onClick={() => handleSubmitPlan(p)}
                                disabled={
                                  submittingId === p.id ||
                                  (isGpsRequired() && !gpsCoords)
                                }
                                title={
                                  isGpsRequired() && !gpsCoords
                                    ? "GPS location required to submit"
                                    : undefined
                                }
                                data-ocid={`submit-tp-${p.id}`}
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
                            <button
                              type="button"
                              onClick={() => setSelectedPlan(p)}
                              className="text-xs text-primary hover:underline"
                              data-ocid={`view-tp-${p.id}`}
                            >
                              View Details
                            </button>
                          )}
                          {(p.status as string) === "Approved" && (
                            <span className="flex items-center gap-1 text-xs text-blue-700">
                              <Lock className="w-3 h-3" />
                              Approved
                            </span>
                          )}
                          {(p.status as string) === "Rejected" && (
                            <>
                              <span className="text-xs text-red-600 font-medium">
                                Rejected
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1 border-amber-300 text-amber-700 hover:bg-amber-50"
                                onClick={() => openEdit(p)}
                                data-ocid={`resubmit-tp-${p.id}`}
                              >
                                <Edit2 className="w-3 h-3" />
                                Revise
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </>
                  );
                }}
              />
            )}

            {/* Summary bar */}
            {!loading && plans.length > 0 && (
              <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                <span>
                  <span className="font-semibold text-foreground">
                    {
                      plans.filter(
                        (p) => p.status === TravelPlanStatus.Submitted,
                      ).length
                    }
                  </span>{" "}
                  submitted
                </span>
                <span>
                  <span className="font-semibold text-foreground">
                    {
                      plans.filter((p) => p.status === TravelPlanStatus.Draft)
                        .length
                    }
                  </span>{" "}
                  draft
                </span>
                <span className="text-foreground font-semibold">
                  {plans.length} total
                </span>
              </div>
            )}
          </TabsContent>

          <TabsContent value="vs-actual">
            <MtpVsActualTab session={session} />
          </TabsContent>
        </Tabs>
      </PageContent>

      {/* Create / Edit Modal */}
      {modalMode && (
        <dialog
          open
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/30 backdrop-blur-sm m-0 max-w-none w-full h-full border-none bg-transparent"
          aria-labelledby="tp-modal-title"
        >
          <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-md p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-2">
              <CalendarPlus className="w-5 h-5 text-primary" />
              <h2
                id="tp-modal-title"
                className="font-display font-semibold text-lg text-foreground"
              >
                {modalMode === "create"
                  ? "New Travel Plan"
                  : "Edit Travel Plan"}
              </h2>
            </div>

            {/* GPS status inside modal */}
            <GpsStatusRow
              coords={gpsCoords}
              error={gpsError}
              locationNote={gpsNote}
              onRefresh={refreshGps}
              loading={gpsLoading}
            />

            {showGpsError && !gpsCoords && isGpsRequired() && (
              <GpsRequiredBanner />
            )}

            <div className="space-y-4">
              <div>
                <Label htmlFor="tp-date" className="text-sm mb-1.5 block">
                  Date <span className="text-destructive">*</span>
                </Label>
                <input
                  id="tp-date"
                  type="date"
                  value={form.date}
                  min={dateMin}
                  max={dateMax}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, date: e.target.value }))
                  }
                  data-ocid="tp-date-input"
                  className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm font-body focus:outline-none focus:ring-2 focus:ring-ring h-10"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  You can plan for the current month or next month only.
                </p>
              </div>

              <div>
                <Label htmlFor="tp-area" className="text-sm mb-1.5 block">
                  Area / Station <span className="text-destructive">*</span>
                </Label>
                <AreaSelect
                  areas={allottedAreas}
                  value={form.plannedStation}
                  onChange={(v) =>
                    setForm((f) => ({ ...f, plannedStation: v }))
                  }
                  areasLoading={areasLoading}
                />
                {allottedAreas.length > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Only areas allotted to you are shown. Contact HR to update
                    your area allotment.
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="tp-notes" className="text-sm mb-1.5 block">
                  Notes
                </Label>
                <textarea
                  id="tp-notes"
                  placeholder="Any additional notes about this travel plan..."
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  data-ocid="tp-notes-input"
                  rows={3}
                  className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm font-body resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                onClick={closeModal}
                disabled={saving}
                data-ocid="tp-modal-cancel"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={
                  saving ||
                  (isGpsRequired() && !gpsCoords) ||
                  allottedAreas.length === 0
                }
                title={
                  isGpsRequired() && !gpsCoords
                    ? "GPS location required to save"
                    : undefined
                }
                data-ocid="tp-modal-save"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                {modalMode === "create" ? "Create Plan" : "Save Changes"}
              </Button>
            </div>
            {isGpsRequired() && !gpsCoords && (
              <p className="text-xs text-orange-600 text-center">
                GPS location is required to save this travel plan.
              </p>
            )}
          </div>
        </dialog>
      )}
    </PortalLayout>
  );
}
