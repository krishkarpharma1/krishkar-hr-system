/**
 * MRExpenses — TA/DA Claim form for Medical Representatives.
 *
 * Enhanced with:
 * - Standard pharma SFA day-type labels (HQ Day / Ex-Station Day / Out-Station Day / Leave Day / Holiday)
 * - Mode of Transport (required)
 * - Lodging Expense (Out-Station only)
 * - Miscellaneous Expense + Narration
 * - Total Claim Amount (read-only, auto-calculated)
 * - Grade-based rate info panel + auto-calculation from getTaDaGradeByName
 * - Uses submitTaDaExpenseV2 for submission
 * - formatCurrency applied throughout
 */

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
  Calculator,
  Home,
  Info,
  Loader2,
  Paperclip,
  Plus,
  RefreshCw,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DaRate, Role, StationType } from "../../backend";
import type { TaDaGrade } from "../../backend.d";
import {
  DataTable,
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { useGps } from "../../hooks/useGps";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import type { TaDaExpense } from "../../types";
import { useAttachmentMailto } from "../../utils/attachmentMailto";
import { formatCurrency, formatPaise } from "../../utils/currencyFormatter";
import { formatDate } from "../../utils/dateFormatter";

// ─── Day type ────────────────────────────────────────────────────────────────

type DayType =
  | "HQ Day"
  | "Ex-Station Day"
  | "Out-Station Day"
  | "Leave Day"
  | "Holiday";

const DAY_TYPES: { value: DayType; label: string }[] = [
  { value: "HQ Day", label: "HQ Day" },
  { value: "Ex-Station Day", label: "Ex-Station Day" },
  { value: "Out-Station Day", label: "Out-Station Day" },
  { value: "Leave Day", label: "Leave Day" },
  { value: "Holiday", label: "Holiday" },
];

const TRANSPORT_MODES = [
  "Two Wheeler",
  "Four Wheeler",
  "Auto / Rickshaw",
  "Train",
  "Bus",
  "Air",
] as const;

// ─── Fallback rates (paise) ───────────────────────────────────────────────────

const FALLBACK_HQ_DA_PAISE = 25000; // ₹ 250
const FALLBACK_EX_DA_PAISE = 30000; // ₹ 300
const FALLBACK_OUT_DA_PAISE = 50000; // ₹ 500
const FALLBACK_TA_PER_KM_PAISE = 275; // ₹ 2.75 per km

function dayTypeToDaRate(dt: DayType): DaRate {
  if (dt === "Ex-Station Day") return DaRate.rate300;
  return DaRate.rate250;
}

function dayTypeToBackendStation(dt: DayType): StationType {
  if (dt === "HQ Day") return StationType.HQ;
  if (dt === "Ex-Station Day") return StationType.ExHQ;
  if (dt === "Out-Station Day") return StationType.Outstation;
  // Leave Day / Holiday — map to HQ for submission purposes
  return StationType.HQ;
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pending: "text-muted-foreground bg-muted/40",
  approved: "text-accent bg-accent/10",
  rejected: "text-destructive bg-destructive/10",
};

function getExpenseStatus(expense: TaDaExpense): string {
  const s = expense.status as unknown as { __kind__?: string } | string;
  if (typeof s === "string") return s.toLowerCase();
  return (s as { __kind__?: string }).__kind__?.toLowerCase() ?? "pending";
}

function formatRoute(
  from: string | null | undefined,
  to: string | null | undefined,
): string {
  const f = from?.trim() || null;
  const t = to?.trim() || null;
  if (!f && !t) return "HQ";
  if (!f || !t) return f ?? t ?? "HQ";
  return `${f} → ${t}`;
}

// ─── GPS Badge ────────────────────────────────────────────────────────────────

function GpsBadge({
  coords,
  onRefresh,
  loading,
}: {
  coords: { lat: number; lng: number } | null;
  onRefresh: () => void;
  loading?: boolean;
}) {
  if (coords) {
    return (
      <div
        className="flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-full border border-accent/30 bg-accent/10 text-accent"
        data-ocid="gps-status-expense"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
        {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="ml-1 opacity-70 hover:opacity-100 transition-opacity"
          aria-label="Refresh GPS"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
    );
  }
  return (
    <div
      className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-orange-400/30 bg-orange-400/10 text-orange-500"
      data-ocid="gps-status-expense"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
      GPS not available
      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        className="ml-1 opacity-70 hover:opacity-100 transition-opacity"
        aria-label="Retry GPS"
      >
        <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
      </button>
    </div>
  );
}

// ─── Grade Info Panel ─────────────────────────────────────────────────────────

function GradeInfoPanel({
  grade,
  loading,
  error,
}: {
  grade: TaDaGrade | null;
  loading: boolean;
  error: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground px-3 py-2.5 rounded-md border bg-muted/30">
        <Loader2 className="w-3 h-3 animate-spin" />
        Loading your grade rates…
      </div>
    );
  }
  if (error || !grade) {
    return (
      <div className="flex items-start gap-2 text-xs px-3 py-2.5 rounded-md border border-amber-400/30 bg-amber-400/10 text-amber-700">
        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <span>
          No TA/DA rates configured for your grade. Please contact Admin.
          Fallback rates will be used.
        </span>
      </div>
    );
  }
  return (
    <div
      className="text-xs px-3 py-3 rounded-md border border-primary/20 bg-primary/5 space-y-1.5"
      data-ocid="tada.grade-info"
    >
      <div className="flex items-center gap-1.5 font-semibold text-primary mb-1">
        <Info className="w-3.5 h-3.5" />
        Your Grade: {grade.gradeName}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
        <span>
          DA (HQ Day):{" "}
          <span className="font-semibold text-foreground">
            {formatPaise(grade.daHqRate)}
          </span>
        </span>
        <span>
          DA (Ex-Station):{" "}
          <span className="font-semibold text-foreground">
            {formatPaise(grade.daExStationRate)}
          </span>
        </span>
        <span>
          DA (Out-Station):{" "}
          <span className="font-semibold text-foreground">
            {formatPaise(grade.daOutStationRate)}
          </span>
        </span>
        <span>
          TA Rate:{" "}
          <span className="font-semibold text-foreground">
            {formatPaise(grade.taPerKmRate)} / km
          </span>
        </span>
        <span>
          Lodging Entitlement:{" "}
          <span className="font-semibold text-foreground">
            {formatPaise(grade.lodgingEntitlement)} / night
          </span>
        </span>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MRExpenses() {
  const session = useAuthStore((s) => s.session);
  const { coords: gpsCoords, loading: gpsLoading, refreshGps } = useGps();
  const { buildMailto } = useAttachmentMailto();

  const [tab, setTab] = useState<"list" | "new">("list");
  const [expenses, setExpenses] = useState<TaDaExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Grade state
  const [gradeInfo, setGradeInfo] = useState<TaDaGrade | null>(null);
  const [gradeLoading, setGradeLoading] = useState(false);
  const [gradeError, setGradeError] = useState(false);
  const [userDesignation, setUserDesignation] = useState("");

  const today = new Date().toISOString().slice(0, 10);

  // Form fields
  const [date, setDate] = useState(today);
  const [dayType, setDayType] = useState<DayType>("HQ Day");
  const [modeOfTransport, setModeOfTransport] = useState("");
  const [fromLocation, setFromLocation] = useState("");
  const [toLocation, setToLocation] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [daAmount, setDaAmount] = useState<number>(0);
  const [taAmount, setTaAmount] = useState<number>(0);
  const [lodgingExpense, setLodgingExpense] = useState("");
  const [miscExpense, setMiscExpense] = useState("");
  const [miscNarration, setMiscNarration] = useState("");
  const [purpose, setPurpose] = useState("");

  const isHqDay = dayType === "HQ Day";
  const isOutStation = dayType === "Out-Station Day";
  const isLeaveOrHoliday = dayType === "Leave Day" || dayType === "Holiday";
  const needsTravel = !isHqDay && !isLeaveOrHoliday;

  // ── Fetch employee details and grade on mount ──────────────────────────────

  useEffect(() => {
    if (!session) return;
    api
      .getUser(session.token, session.userId)
      .then((user) => {
        if (!user) return;
        const designation =
          (user as { designation?: string }).designation ?? "";
        setUserDesignation(designation);
        if (!designation) {
          setGradeError(true);
          return;
        }
        setGradeLoading(true);
        return api
          .getTaDaGradeByName(session.token, designation)
          .then((res) => {
            if (res.__kind__ === "ok") {
              setGradeInfo(res.ok);
            } else {
              setGradeError(true);
            }
          })
          .catch(() => setGradeError(true))
          .finally(() => setGradeLoading(false));
      })
      .catch(() => setGradeError(true));
  }, [session]);

  // ── Auto-calculate DA & TA when dayType / distance / grade changes ──────────

  useEffect(() => {
    let da = 0;
    if (gradeInfo) {
      if (dayType === "HQ Day") da = Number(gradeInfo.daHqRate) / 100;
      else if (dayType === "Ex-Station Day")
        da = Number(gradeInfo.daExStationRate) / 100;
      else if (dayType === "Out-Station Day")
        da = Number(gradeInfo.daOutStationRate) / 100;
    } else {
      // Fallback paise values
      if (dayType === "HQ Day") da = FALLBACK_HQ_DA_PAISE / 100;
      else if (dayType === "Ex-Station Day") da = FALLBACK_EX_DA_PAISE / 100;
      else if (dayType === "Out-Station Day") da = FALLBACK_OUT_DA_PAISE / 100;
    }
    setDaAmount(da);

    const km = Number.parseFloat(distanceKm || "0");
    const taRatePer100 = gradeInfo
      ? Number(gradeInfo.taPerKmRate)
      : FALLBACK_TA_PER_KM_PAISE;
    const ta = isHqDay || isLeaveOrHoliday ? 0 : km * (taRatePer100 / 100);
    setTaAmount(ta);
  }, [dayType, distanceKm, gradeInfo, isHqDay, isLeaveOrHoliday]);

  // ── HQ auto-clear distance / location ─────────────────────────────────────

  useEffect(() => {
    if (isHqDay || isLeaveOrHoliday) {
      setDistanceKm("0");
      setFromLocation("");
      setToLocation("");
    }
    if (!isOutStation) setLodgingExpense("");
  }, [isHqDay, isLeaveOrHoliday, isOutStation]);

  // ── Derived totals ─────────────────────────────────────────────────────────

  const lodgingVal = isOutStation
    ? Number.parseFloat(lodgingExpense || "0")
    : 0;
  const miscVal = Number.parseFloat(miscExpense || "0");
  const totalClaimAmount = taAmount + daAmount + lodgingVal + miscVal;

  // ── Load expense list ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    api
      .getMyExpenses(session.token)
      .then((e) => setExpenses(e))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session]);

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!session) return;

    if (!modeOfTransport) {
      toast.error("Mode of transport is required");
      return;
    }
    if (needsTravel) {
      if (!fromLocation.trim() || !toLocation.trim()) {
        toast.error("From and To locations are required");
        return;
      }
      const km = Number.parseFloat(distanceKm);
      if (Number.isNaN(km) || km <= 0) {
        toast.error("Distance must be a positive number");
        return;
      }
    }

    const gpsLocation = gpsCoords
      ? { lat: gpsCoords.lat, lng: gpsCoords.lng }
      : undefined;

    const submitKm =
      isHqDay || isLeaveOrHoliday
        ? BigInt(0)
        : BigInt(Math.round(Number.parseFloat(distanceKm || "0")));

    const lodgingPaise =
      isOutStation && lodgingExpense
        ? BigInt(Math.round(Number.parseFloat(lodgingExpense) * 100))
        : null;
    const miscPaise = miscExpense
      ? BigInt(Math.round(Number.parseFloat(miscExpense) * 100))
      : null;

    setSubmitting(true);
    try {
      const res = await api.submitTaDaExpenseV2(
        session.token,
        date,
        dayTypeToBackendStation(dayType),
        needsTravel ? fromLocation.trim() || null : null,
        needsTravel ? toLocation.trim() || null : null,
        submitKm,
        dayTypeToDaRate(dayType),
        purpose.trim(),
        gpsLocation,
        modeOfTransport || null,
        lodgingPaise,
        miscPaise,
        miscNarration.trim() || null,
        gradeInfo ? gradeInfo.gradeName : userDesignation || null,
      );

      if (res.__kind__ === "err") {
        toast.error(`Submission failed: ${res.err}`);
        return;
      }
      toast.success("TA/DA claim submitted for approval");
      const updated = await api.getMyExpenses(session.token);
      setExpenses(updated);
      setTab("list");
      resetForm();
    } catch {
      toast.error("Failed to submit claim. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setDate(today);
    setDayType("HQ Day");
    setModeOfTransport("");
    setFromLocation("");
    setToLocation("");
    setDistanceKm("");
    setLodgingExpense("");
    setMiscExpense("");
    setMiscNarration("");
    setPurpose("");
  }

  async function handleAttachment() {
    const now = new Date();
    const monthYear = `${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()}`;
    const userInfo = session
      ? await api.getUser(session.token, session.userId).catch(() => null)
      : null;
    const userTyped = userInfo as {
      designation?: string;
      hqAssignments?: { hqName?: string }[];
    } | null;
    const url = await buildMailto("tadaClaim", {
      employeeName: session?.name ?? "",
      name: session?.name ?? "",
      designation: userTyped?.designation ?? "",
      hq: userTyped?.hqAssignments?.[0]?.hqName ?? "",
      monthYear,
      date: formatDate(date),
    });
    window.location.href = url;
  }

  // ─── Table columns ────────────────────────────────────────────────────────

  const cols = [
    { key: "date", label: "Date" },
    { key: "type", label: "Day Type" },
    { key: "route", label: "Route" },
    { key: "km", label: "Km", className: "text-right" },
    { key: "mode", label: "Mode" },
    { key: "ta", label: "TA", className: "text-right" },
    { key: "da", label: "DA", className: "text-right" },
    { key: "lodging", label: "Lodging", className: "text-right" },
    { key: "misc", label: "Misc", className: "text-right" },
    { key: "total", label: "Total", className: "text-right" },
    { key: "status", label: "Status" },
  ];

  function stationTypeLabel(e: TaDaExpense): string {
    const raw = (e as unknown as Record<string, unknown>).stationType;
    if (typeof raw === "string") {
      if (raw === "HQ" || raw === "Head Quarter") return "HQ Day";
      if (raw === "ExHQ" || raw === "Ex Station") return "Ex-Station Day";
      if (raw === "Outstation" || raw === "Out Station")
        return "Out-Station Day";
      return raw;
    }
    const variant = raw as { __kind__?: string } | null;
    const k = variant?.__kind__ ?? "";
    if (k === "HQ") return "HQ Day";
    if (k === "ExHQ") return "Ex-Station Day";
    if (k === "Outstation") return "Out-Station Day";
    return k || "—";
  }

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <PortalLayout portalRole={Role.MR}>
      <PageHeader
        title="TA/DA Claim"
        subtitle="Submit travel and daily allowance claims for approval"
        actions={
          <div className="flex gap-2">
            <Button
              variant={tab === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setTab("list")}
              data-ocid="tada.tab-list"
            >
              My Claims
            </Button>
            <Button
              variant={tab === "new" ? "default" : "outline"}
              size="sm"
              onClick={() => setTab("new")}
              data-ocid="tada.tab-new"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> New Claim
            </Button>
          </div>
        }
      />
      <PageContent>
        {tab === "list" ? (
          <DataTable
            columns={cols}
            data={expenses}
            getKey={(e) => String(e.id)}
            loading={loading}
            emptyMessage="No TA/DA claims submitted yet."
            renderRow={(e) => {
              const status = getExpenseStatus(e);
              const modeRaw = (e as unknown as Record<string, unknown>)
                .modeOfTransport as string | undefined;
              const lodgingRaw = (e as unknown as Record<string, unknown>)
                .lodgingExpense as bigint | undefined;
              const miscRaw = (e as unknown as Record<string, unknown>)
                .miscExpense as bigint | undefined;
              return (
                <>
                  <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                    {e.date}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                      {stationTypeLabel(e)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs max-w-[120px] truncate">
                    {formatRoute(e.fromLocation, e.toLocation)}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-right">
                    {Number(e.distanceKm)} km
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {modeRaw || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-right">
                    {formatCurrency(Number(e.travelAmount))}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-right">
                    {formatCurrency(Number(e.dailyAllowance))}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-right">
                    {lodgingRaw && Number(lodgingRaw) > 0
                      ? formatCurrency(Number(lodgingRaw) / 100)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-right">
                    {miscRaw && Number(miscRaw) > 0
                      ? formatCurrency(Number(miscRaw) / 100)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-right font-semibold">
                    {formatCurrency(Number(e.totalAmount))}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-display uppercase tracking-wide ${
                        STATUS_COLORS[status] ?? STATUS_COLORS.pending
                      }`}
                    >
                      {status}
                    </span>
                  </td>
                </>
              );
            }}
          />
        ) : (
          <div className="max-w-xl space-y-5">
            {/* Grade info panel */}
            <GradeInfoPanel
              grade={gradeInfo}
              loading={gradeLoading}
              error={gradeError}
            />

            {/* Expense details card */}
            <div className="bg-card border border-border rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                  Claim Details
                </h3>
                <GpsBadge
                  coords={gpsCoords}
                  onRefresh={refreshGps}
                  loading={gpsLoading}
                />
              </div>

              {/* Date */}
              <div>
                <Label htmlFor="claim-date" className="text-xs mb-1 block">
                  Claim Date
                </Label>
                <Input
                  id="claim-date"
                  type="date"
                  value={date}
                  max={today}
                  onChange={(e) => setDate(e.target.value)}
                  data-ocid="tada.date"
                />
              </div>

              {/* Day Type */}
              <div>
                <Label htmlFor="claim-daytype" className="text-xs mb-1 block">
                  Type of Day <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={dayType}
                  onValueChange={(v) => setDayType(v as DayType)}
                >
                  <SelectTrigger id="claim-daytype" data-ocid="tada.day-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAY_TYPES.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* HQ info banner */}
                {isHqDay && (
                  <div
                    className="mt-2 flex items-start gap-2 text-xs px-3 py-2.5 rounded-md border border-primary/20 bg-primary/5"
                    data-ocid="tada.hq-info"
                  >
                    <Home className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="text-primary font-medium">
                        HQ Day selected
                      </p>
                      <p className="text-muted-foreground">
                        From/To stations are not required. Distance is 0 km. DA
                        of{" "}
                        <span className="font-semibold text-foreground">
                          {formatCurrency(daAmount)}
                        </span>{" "}
                        applies as per your grade.
                      </p>
                    </div>
                  </div>
                )}

                {isLeaveOrHoliday && (
                  <div
                    className="mt-2 flex items-center gap-2 text-xs px-3 py-2 rounded-md border border-muted bg-muted/30 text-muted-foreground"
                    data-ocid="tada.leave-info"
                  >
                    <Info className="w-3 h-3 flex-shrink-0" />
                    No TA/DA is payable for Leave Day or Holiday.
                  </div>
                )}
              </div>

              {/* Mode of Transport */}
              <div>
                <Label htmlFor="claim-mode" className="text-xs mb-1 block">
                  Mode of Transport <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={modeOfTransport}
                  onValueChange={setModeOfTransport}
                >
                  <SelectTrigger
                    id="claim-mode"
                    data-ocid="tada.mode-of-transport"
                  >
                    <SelectValue placeholder="Select mode of transport" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSPORT_MODES.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* From / To — visible for Ex-Station and Out-Station only */}
              {needsTravel && (
                <div
                  className="grid grid-cols-2 gap-4"
                  data-ocid="tada.location-fields"
                >
                  <div>
                    <Label htmlFor="claim-from" className="text-xs mb-1 block">
                      From Location <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="claim-from"
                      value={fromLocation}
                      onChange={(e) => setFromLocation(e.target.value)}
                      placeholder="Starting location"
                      data-ocid="tada.from"
                    />
                  </div>
                  <div>
                    <Label htmlFor="claim-to" className="text-xs mb-1 block">
                      To Location <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="claim-to"
                      value={toLocation}
                      onChange={(e) => setToLocation(e.target.value)}
                      placeholder="Destination"
                      data-ocid="tada.to"
                    />
                  </div>
                </div>
              )}

              {/* Distance / DA Amount */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="claim-km" className="text-xs mb-1 block">
                    Distance (km){" "}
                    {needsTravel ? (
                      <span className="text-destructive">*</span>
                    ) : (
                      <span className="text-muted-foreground font-normal">
                        (auto)
                      </span>
                    )}
                  </Label>
                  <Input
                    id="claim-km"
                    type="number"
                    min="0"
                    step="0.1"
                    value={isHqDay || isLeaveOrHoliday ? "0" : distanceKm}
                    readOnly={!needsTravel}
                    disabled={!needsTravel}
                    onChange={(e) =>
                      needsTravel && setDistanceKm(e.target.value)
                    }
                    placeholder="0"
                    className={
                      !needsTravel ? "bg-muted/40 cursor-not-allowed" : ""
                    }
                    data-ocid="tada.km"
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">
                    DA Amount{" "}
                    <span className="text-muted-foreground font-normal">
                      (auto-calc)
                    </span>
                  </Label>
                  <Input
                    value={formatCurrency(daAmount)}
                    readOnly
                    disabled
                    className="bg-muted/40 cursor-not-allowed font-mono text-right"
                    data-ocid="tada.da-display"
                  />
                </div>
              </div>

              {/* TA Amount — read-only auto-calc, editable override */}
              <div>
                <Label htmlFor="claim-ta" className="text-xs mb-1 block">
                  TA Amount{" "}
                  <span className="text-muted-foreground font-normal">
                    (auto-calculated — you may adjust)
                  </span>
                </Label>
                <Input
                  id="claim-ta"
                  type="number"
                  min="0"
                  step="0.01"
                  value={taAmount.toFixed(2)}
                  onChange={(e) =>
                    setTaAmount(Number.parseFloat(e.target.value) || 0)
                  }
                  className="font-mono"
                  data-ocid="tada.ta-amount"
                />
              </div>

              {/* Lodging Expense — Out-Station only */}
              {isOutStation && (
                <div data-ocid="tada.lodging-section">
                  <Label htmlFor="claim-lodging" className="text-xs mb-1 block">
                    Lodging Expense (₹)
                  </Label>
                  <Input
                    id="claim-lodging"
                    type="number"
                    min="0"
                    step="1"
                    value={lodgingExpense}
                    onChange={(e) => setLodgingExpense(e.target.value)}
                    placeholder="0"
                    className="font-mono"
                    data-ocid="tada.lodging"
                  />
                  {gradeInfo && Number(gradeInfo.lodgingEntitlement) > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Your lodging entitlement:{" "}
                      <span className="font-semibold text-foreground">
                        {formatPaise(gradeInfo.lodgingEntitlement)}
                      </span>{" "}
                      per night
                    </p>
                  )}
                </div>
              )}

              {/* Misc Expense + Narration */}
              <div className="space-y-3">
                <div>
                  <Label htmlFor="claim-misc" className="text-xs mb-1 block">
                    Miscellaneous Expense (₹)
                  </Label>
                  <Input
                    id="claim-misc"
                    type="number"
                    min="0"
                    step="1"
                    value={miscExpense}
                    onChange={(e) => setMiscExpense(e.target.value)}
                    placeholder="0"
                    className="font-mono"
                    data-ocid="tada.misc-expense"
                  />
                </div>
                <div>
                  <Label
                    htmlFor="claim-misc-narration"
                    className="text-xs mb-1 block"
                  >
                    Narration{" "}
                    <span className="text-muted-foreground font-normal">
                      (for misc expense)
                    </span>
                  </Label>
                  <Input
                    id="claim-misc-narration"
                    value={miscNarration}
                    onChange={(e) => setMiscNarration(e.target.value)}
                    placeholder="e.g. Parking charges at clinic"
                    data-ocid="tada.misc-narration"
                  />
                </div>
              </div>

              {/* Purpose */}
              <div>
                <Label htmlFor="claim-purpose" className="text-xs mb-1 block">
                  Purpose / Remarks
                </Label>
                <Input
                  id="claim-purpose"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder={
                    isHqDay
                      ? "Office work / admin duties"
                      : "Doctor visits — field area"
                  }
                  data-ocid="tada.purpose"
                />
              </div>
            </div>

            {/* Expense Summary */}
            <div className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-center gap-2 mb-3">
                <Calculator className="w-4 h-4 text-muted-foreground" />
                <h3 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                  Claim Summary
                </h3>
              </div>
              <div className="space-y-2 text-sm font-body">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Travel Allowance (
                    {isHqDay || isLeaveOrHoliday ? "0" : distanceKm || "0"} km)
                  </span>
                  <span className="font-mono font-semibold">
                    {formatCurrency(taAmount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Daily Allowance ({dayType})
                  </span>
                  <span className="font-mono font-semibold">
                    {formatCurrency(daAmount)}
                  </span>
                </div>
                {isOutStation && lodgingVal > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Lodging Expense
                    </span>
                    <span className="font-mono font-semibold">
                      {formatCurrency(lodgingVal)}
                    </span>
                  </div>
                )}
                {miscVal > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Miscellaneous{miscNarration ? ` (${miscNarration})` : ""}
                    </span>
                    <span className="font-mono font-semibold">
                      {formatCurrency(miscVal)}
                    </span>
                  </div>
                )}
                <div className="border-t border-border pt-2 flex justify-between text-base">
                  <span className="font-display font-semibold">
                    Total Claim Amount
                  </span>
                  <span className="font-mono font-bold text-primary">
                    {formatCurrency(totalClaimAmount)}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                data-ocid="tada.submit_button"
              >
                {submitting && (
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                )}
                Submit for Approval
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleAttachment()}
                className="border-primary/40 text-primary hover:bg-primary/5"
                title="Tap to email your claim documents to the company and your reporting managers."
                data-ocid="tada.attachment_button"
              >
                <Paperclip className="w-3.5 h-3.5 mr-1.5" />
                Attachment
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  resetForm();
                  setTab("list");
                }}
                data-ocid="tada.cancel"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </PageContent>
    </PortalLayout>
  );
}
