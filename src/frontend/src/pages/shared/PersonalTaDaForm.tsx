/**
 * PersonalTaDaForm — shared TA/DA expense entry form for all employee roles.
 *
 * HQ station type auto-fill logic:
 *  - HQ selected → hide From/To, set Distance=0 (read-only), DA=₹250 (read-only)
 *  - Ex Station / Out Station → show From/To, allow distance entry, auto-calc DA
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
  Info,
  Loader2,
  Paperclip,
  Plus,
  RefreshCw,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DaRate, StationType } from "../../backend";
import { DataTable } from "../../components/PortalLayout";
import { useGps } from "../../hooks/useGps";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import type { TaDaExpense } from "../../types";
import { useAttachmentMailto } from "../../utils/attachmentMailto";
import { formatDate } from "../../utils/dateFormatter";

// ─── Constants ────────────────────────────────────────────────────────────────

const TA_RATE = 2.75; // Rs per km

type UIStationType = "Head Quarter" | "Ex Station" | "Out Station";

const STATION_TYPES: { value: UIStationType; label: string }[] = [
  { value: "Head Quarter", label: "Head Quarter (HQ)" },
  { value: "Ex Station", label: "Ex Station" },
  { value: "Out Station", label: "Out Station" },
];

const HQ_DA = 250;
const EX_DA = 300;
const OUT_DA_FALLBACK = 500;

function stationToDaRate(st: UIStationType): DaRate {
  if (st === "Ex Station") return DaRate.rate300;
  return DaRate.rate250;
}

function stationToBackendType(st: UIStationType): StationType {
  if (st === "Head Quarter") return StationType.HQ;
  if (st === "Ex Station") return StationType.ExHQ;
  return StationType.Outstation;
}

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

/** Show route gracefully — for HQ entries (empty from/to), show "HQ" */
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
        data-ocid="gps-status-tada"
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
      data-ocid="gps-status-tada"
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

// ─── Component ────────────────────────────────────────────────────────────────

interface PersonalTaDaFormProps {
  /** Optional role label shown in the heading ("ASM", "RSM", etc.) */
  roleLabel?: string;
}

export default function PersonalTaDaForm({ roleLabel }: PersonalTaDaFormProps) {
  const session = useAuthStore((s) => s.session);
  const { coords: gpsCoords, loading: gpsLoading, refreshGps } = useGps();
  const { buildMailto } = useAttachmentMailto();

  const [view, setView] = useState<"list" | "new">("list");
  const [expenses, setExpenses] = useState<TaDaExpense[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [stationType, setStationType] = useState<UIStationType>("Head Quarter");
  const [fromLocation, setFromLocation] = useState("");
  const [toLocation, setToLocation] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [outStationRate, setOutStationRate] = useState<number | null>(null);
  const [fetchingRate, setFetchingRate] = useState(false);
  const [purpose, setPurpose] = useState("");

  // ── HQ Auto-fill derived values ────────────────────────────────────────────

  const isHQ = stationType === "Head Quarter";
  const isOutStation = stationType === "Out Station";

  // Fetch Out Station DA rate from backend when Out Station selected
  useEffect(() => {
    if (!isOutStation || !session) {
      setOutStationRate(null);
      return;
    }
    setFetchingRate(true);
    api
      .getOutStationDaRate(session.token, session.userId)
      .then((rate) => setOutStationRate(rate !== null ? Number(rate) : null))
      .catch(() => setOutStationRate(null))
      .finally(() => setFetchingRate(false));
  }, [isOutStation, session]);

  const dailyAllowance = isHQ
    ? HQ_DA
    : stationType === "Ex Station"
      ? EX_DA
      : (outStationRate ?? OUT_DA_FALLBACK);

  const effectiveDistance = isHQ ? 0 : Number.parseFloat(distanceKm || "0");
  const travelAmount = isHQ ? 0 : effectiveDistance * TA_RATE;
  const totalAmount = travelAmount + dailyAllowance;

  // ── Load expense history ───────────────────────────────────────────────────

  useEffect(() => {
    if (!session) return;
    setLoadingList(true);
    api
      .getMyExpenses(session.token)
      .then((e) => setExpenses(e))
      .catch(() => {})
      .finally(() => setLoadingList(false));
  }, [session]);

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!session) return;

    if (!isHQ && (!fromLocation.trim() || !toLocation.trim() || !distanceKm)) {
      toast.error("From location, to location, and distance are required");
      return;
    }
    if (!isHQ) {
      const km = Number.parseFloat(distanceKm);
      if (Number.isNaN(km) || km <= 0) {
        toast.error("Distance must be a positive number");
        return;
      }
    }

    const gpsLocation = gpsCoords
      ? { lat: gpsCoords.lat, lng: gpsCoords.lng }
      : undefined;

    setSubmitting(true);
    try {
      const res = await api.submitTaDaExpense(
        session.token,
        date,
        stationToBackendType(stationType),
        isHQ ? null : fromLocation.trim() || null,
        isHQ ? null : toLocation.trim() || null,
        isHQ ? BigInt(0) : BigInt(Math.round(Number.parseFloat(distanceKm))),
        stationToDaRate(stationType),
        purpose.trim(),
        gpsLocation,
      );

      if (res.__kind__ === "err") {
        toast.error(`Submission failed: ${res.err}`);
        return;
      }

      toast.success("Expense submitted for approval");
      const updated = await api.getMyExpenses(session.token);
      setExpenses(updated);
      setView("list");
      resetForm();
    } catch {
      toast.error("Failed to submit expense. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setDate(today);
    setStationType("Head Quarter");
    setFromLocation("");
    setToLocation("");
    setDistanceKm("");
    setOutStationRate(null);
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

  const label = roleLabel ? `${roleLabel} Personal TA/DA` : "My Personal TA/DA";

  // ─────────────────────────────────────────────────────────────────────────────

  const histCols = [
    { key: "date", label: "Date" },
    { key: "route", label: "Route" },
    { key: "km", label: "Km", className: "text-right" },
    { key: "ta", label: "TA (₹)", className: "text-right" },
    { key: "da", label: "DA (₹)", className: "text-right" },
    { key: "total", label: "Total (₹)", className: "text-right" },
    { key: "status", label: "Status" },
  ];

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display font-semibold text-base text-foreground">
            {label}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Submit your own travel and daily allowance claims
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={view === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("list")}
            data-ocid="personal-tada.tab-list"
          >
            My History
          </Button>
          <Button
            variant={view === "new" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("new")}
            data-ocid="personal-tada.tab-new"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> New Entry
          </Button>
        </div>
      </div>

      {/* ── History list ── */}
      {view === "list" && (
        <DataTable
          columns={histCols}
          data={expenses}
          getKey={(e) => String(e.id)}
          loading={loadingList}
          emptyMessage="No personal TA/DA entries yet. Tap 'New Entry' to add one."
          renderRow={(e) => {
            const status = getExpenseStatus(e);
            return (
              <>
                <td className="px-4 py-3 font-mono text-xs">{e.date}</td>
                <td className="px-4 py-3 text-xs max-w-[140px] truncate">
                  {formatRoute(e.fromLocation, e.toLocation)}
                </td>
                <td className="px-4 py-3 text-xs font-mono text-right">
                  {Number(e.distanceKm)} km
                </td>
                <td className="px-4 py-3 text-xs font-mono text-right">
                  ₹{Number(e.travelAmount).toLocaleString("en-IN")}
                </td>
                <td className="px-4 py-3 text-xs font-mono text-right">
                  ₹{Number(e.dailyAllowance).toLocaleString("en-IN")}
                </td>
                <td className="px-4 py-3 text-xs font-mono text-right font-semibold">
                  ₹{Number(e.totalAmount).toLocaleString("en-IN")}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs font-display uppercase tracking-wide ${STATUS_COLORS[status] ?? STATUS_COLORS.pending}`}
                  >
                    {status}
                  </span>
                </td>
              </>
            );
          }}
        />
      )}

      {/* ── New entry form ── */}
      {view === "new" && (
        <div className="max-w-lg space-y-4">
          {/* Expense details card */}
          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                Expense Details
              </h4>
              <GpsBadge
                coords={gpsCoords}
                onRefresh={refreshGps}
                loading={gpsLoading}
              />
            </div>

            {/* Date */}
            <div>
              <Label htmlFor="tada-date" className="text-xs mb-1 block">
                Date
              </Label>
              <Input
                id="tada-date"
                type="date"
                value={date}
                max={today}
                onChange={(e) => setDate(e.target.value)}
                data-ocid="personal-tada.date"
              />
            </div>

            {/* Station Type */}
            <div>
              <Label htmlFor="tada-station" className="text-xs mb-1 block">
                Station Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={stationType}
                onValueChange={(v) => {
                  setStationType(v as UIStationType);
                  setFromLocation("");
                  setToLocation("");
                  setDistanceKm("");
                }}
              >
                <SelectTrigger
                  id="tada-station"
                  data-ocid="personal-tada.station-type"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATION_TYPES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* HQ info badge */}
              {isHQ && (
                <div
                  className="mt-2 flex items-center gap-2 text-xs px-3 py-2 rounded-md border border-primary/20 bg-primary/5"
                  data-ocid="personal-tada.hq-info"
                >
                  <Info className="w-3 h-3 text-primary flex-shrink-0" />
                  <span className="text-primary">
                    HQ day — Distance is 0 km and DA is auto-set to ₹{HQ_DA}.
                    From/To fields are not required.
                  </span>
                </div>
              )}

              {/* Out Station DA info badge */}
              {isOutStation && (
                <div
                  className="mt-2 flex items-center gap-2 text-xs px-3 py-2 rounded-md border"
                  data-ocid="personal-tada.outstation-da-badge"
                >
                  {fetchingRate ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                      <span className="text-muted-foreground">
                        Fetching your Out Station DA rate…
                      </span>
                    </>
                  ) : outStationRate !== null ? (
                    <>
                      <Info className="w-3 h-3 text-primary flex-shrink-0" />
                      <span className="text-primary font-medium">
                        DA Rate: ₹{outStationRate} (from your role config)
                      </span>
                    </>
                  ) : (
                    <>
                      <Info className="w-3 h-3 text-amber-600 flex-shrink-0" />
                      <span className="text-amber-600">
                        DA rate not configured. Default ₹{OUT_DA_FALLBACK}{" "}
                        applied.
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* From / To — hidden for HQ */}
            {!isHQ && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tada-from" className="text-xs mb-1 block">
                    From Location <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="tada-from"
                    value={fromLocation}
                    onChange={(e) => setFromLocation(e.target.value)}
                    placeholder="Starting station"
                    data-ocid="personal-tada.from"
                  />
                </div>
                <div>
                  <Label htmlFor="tada-to" className="text-xs mb-1 block">
                    To Location <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="tada-to"
                    value={toLocation}
                    onChange={(e) => setToLocation(e.target.value)}
                    placeholder="Destination"
                    data-ocid="personal-tada.to"
                  />
                </div>
              </div>
            )}

            {/* Distance + DA */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="tada-km" className="text-xs mb-1 block">
                  Distance (km){" "}
                  {!isHQ && <span className="text-destructive">*</span>}
                </Label>
                <Input
                  id="tada-km"
                  type="number"
                  min="0"
                  step="0.1"
                  value={isHQ ? "0" : distanceKm}
                  readOnly={isHQ}
                  disabled={isHQ}
                  onChange={(e) => !isHQ && setDistanceKm(e.target.value)}
                  placeholder="0"
                  className={isHQ ? "bg-muted/40 cursor-not-allowed" : ""}
                  data-ocid="personal-tada.km"
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">
                  DA Amount (₹){" "}
                  <span className="text-muted-foreground font-normal">
                    (auto-filled)
                  </span>
                </Label>
                <Input
                  value={
                    fetchingRate && isOutStation
                      ? "Loading…"
                      : `₹${dailyAllowance}`
                  }
                  readOnly
                  disabled
                  className="bg-muted/40 cursor-not-allowed font-mono text-right"
                  data-ocid="personal-tada.da-display"
                />
              </div>
            </div>

            {/* Purpose */}
            <div>
              <Label htmlFor="tada-purpose" className="text-xs mb-1 block">
                Purpose
              </Label>
              <Input
                id="tada-purpose"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="e.g. Office work — HQ"
                data-ocid="personal-tada.purpose"
              />
            </div>
          </div>

          {/* Auto-calc summary */}
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center gap-2 mb-3">
              <Calculator className="w-4 h-4 text-muted-foreground" />
              <h4 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                Expense Summary
              </h4>
            </div>
            <div className="space-y-2 text-sm font-body">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Travel Allowance ({isHQ ? "0" : distanceKm || "0"} km × ₹
                  {TA_RATE}/km)
                </span>
                <span className="font-mono font-semibold">
                  ₹{travelAmount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Daily Allowance ({stationType})
                </span>
                <span className="font-mono font-semibold">
                  ₹{dailyAllowance.toFixed(2)}
                </span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between text-base">
                <span className="font-display font-semibold">Total</span>
                <span className="font-mono font-bold text-primary">
                  ₹{totalAmount.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleSubmit}
              disabled={submitting || fetchingRate}
              data-ocid="personal-tada.submit"
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
              title="Tap to email your file to the company and your reporting managers. Your email app will open with all recipients pre-filled."
              data-ocid="personal-tada.attachment_button"
            >
              <Paperclip className="w-3.5 h-3.5 mr-1.5" />
              Attachment
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                resetForm();
                setView("list");
              }}
              data-ocid="personal-tada.cancel"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
