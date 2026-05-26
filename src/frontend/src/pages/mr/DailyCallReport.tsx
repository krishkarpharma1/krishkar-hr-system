import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Gift,
  Info,
  Loader2,
  MapPin,
  Pill,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Stethoscope,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ReportStatus,
  Role,
  WorkType,
  WorkingMode,
  WorkingStationSource,
} from "../../backend";
import type { WorkingStationSource__1 } from "../../backend.d";
import {
  DataTable,
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import ScrollToBottom from "../../components/ScrollToBottom";
import ScrollableTable from "../../components/ScrollableTable";
import { isGpsRequired, isMobileDevice, useGps } from "../../hooks/useGps";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import type {
  CallReportInfo,
  DaHistoryRow,
  DoctorInfo,
  DoctorVisitEntry,
  GpsCoord,
  ProductInfo,
  SampleDistributed,
} from "../../types";

// ── Constants & Types ────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  [ReportStatus.Draft]: "text-muted-foreground bg-muted/40",
  [ReportStatus.Submitted]: "text-primary bg-primary/10",
  [ReportStatus.Approved]: "text-accent bg-accent/10",
  [ReportStatus.Rejected]: "text-destructive bg-destructive/10",
};

const STATION_TYPES = ["HQ Day", "Ex-Station Day", "Out-Station Day"] as const;
type StationType = (typeof STATION_TYPES)[number];

const NULL_GPS: GpsCoord = { lat: 0, lng: 0, timestamp: BigInt(0) };

const DA_RATES: Record<string, Record<StationType, number>> = {
  MR: { "HQ Day": 250, "Ex-Station Day": 300, "Out-Station Day": 500 },
  ASM: { "HQ Day": 250, "Ex-Station Day": 300, "Out-Station Day": 500 },
  RSM: { "HQ Day": 250, "Ex-Station Day": 300, "Out-Station Day": 1100 },
  ZSM: { "HQ Day": 250, "Ex-Station Day": 300, "Out-Station Day": 1100 },
};

type MainTab = "list" | "new" | "detail";
type FormTab = "report-details" | "doctor-call";

interface VisitRow {
  doctorId: bigint | null;
  notes: string;
  gps: GpsCoord | null;
  productIds: bigint[];
  samples: SampleRow[];
  giftArticles: GiftRow[];
  visitHistory: CallReportInfo[] | null;
  loadingHistory: boolean;
  // SFA Phase 2
  productDetails: ProductDetailRow[];
  sampleBalance: SampleBalanceRow[];
}

interface SampleRow {
  productId: bigint | null;
  quantity: string;
}

// SFA Phase 2 — product detailing row (per visit)
export type DetailingPriority = "First Call" | "Second Call" | "Reminder";

interface ProductDetailRow {
  productId: bigint | null;
  priority: DetailingPriority;
  notes: string;
}

// SFA Phase 2 — sample row with balance awareness
interface SampleBalanceRow {
  productId: bigint | null;
  quantity: string;
  // balance info carried here for UI convenience
  remainingQty: number;
}

interface SampleBalance {
  productId: bigint;
  productName: string;
  productCode: string;
  allocatedQty: number;
  usedQty: number;
  remainingQty: number;
}

interface GiftRow {
  giftArticleId: bigint | null;
  giftArticleName: string;
  quantity: string;
}

interface HigherAuthority {
  userId: bigint;
  userName: string;
  role: string;
}

interface SavedReportDetails {
  date: string;
  workType: WorkType;
  stationType: StationType;
  workingStationSource: "AsPerTP" | "OtherStation";
  workingStation: string;
  workingMode: "WorkingAlone" | "WorkingWith";
  workingWithUserId?: bigint;
  workingWithUserName?: string;
  startGps: GpsCoord | null;
  endGps: GpsCoord | null;
  remarks: string;
  daAmount: number;
}

function newVisitRow(): VisitRow {
  return {
    doctorId: null,
    notes: "",
    gps: null,
    productIds: [],
    samples: [],
    giftArticles: [],
    visitHistory: null,
    loadingHistory: false,
    productDetails: [],
    sampleBalance: [],
  };
}

// ── GPS Helpers ──────────────────────────────────────────────────────────────

function GpsStatusBar({
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
        data-ocid="gps-status-bar"
      >
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
        <MapPin className="w-3.5 h-3.5 shrink-0" />
        <span className="font-mono">
          {locationNote
            ? locationNote
            : `Location: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`}
        </span>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="ml-auto opacity-70 hover:opacity-100 transition-opacity"
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
        data-ocid="gps-status-bar"
      >
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
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
      data-ocid="gps-status-bar"
    >
      <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">
            {isMobileDevice()
              ? "Location: Not Available — enable GPS to submit"
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

function GpsRequiredBanner() {
  const mobile = isMobileDevice();
  if (!mobile) return null;
  return (
    <div
      className="flex items-start gap-3 p-4 rounded-lg border border-destructive/40 bg-destructive/5 text-destructive"
      data-ocid="gps-required-banner"
      role="alert"
    >
      <MapPin className="w-5 h-5 shrink-0 mt-0.5" />
      <div className="space-y-1.5">
        <p className="font-semibold text-sm">
          Please enable location access in your browser settings to submit this
          report.
        </p>
        <div className="text-xs space-y-1 text-destructive/80">
          <p className="font-medium">Android Chrome:</p>
          <ul className="list-disc list-inside space-y-0.5 ml-1">
            <li>Tap lock icon → Site settings → Location → Allow</li>
          </ul>
          <p className="font-medium mt-1">iPhone / Safari:</p>
          <ul className="list-disc list-inside space-y-0.5 ml-1">
            <li>Settings → Safari → Location → Allow</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

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
      <span
        className="inline-flex items-center gap-1.5 text-xs font-mono px-2 py-1 rounded-full border border-accent/30 bg-accent/10 text-accent"
        data-ocid="gps-status-badge"
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
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border border-orange-400/30 bg-orange-400/10 text-orange-500"
      data-ocid="gps-status-badge"
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
    </span>
  );
}

function MapLink({ lat, lng }: { lat: number; lng: number }) {
  const url = `https://maps.google.com/?q=${lat},${lng}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
      data-ocid="view-on-map-link"
    >
      <ExternalLink className="w-3 h-3" />
      View on Map
    </a>
  );
}

function ManualGpsButton({
  label,
  value,
  onChange,
}: { label: string; value: GpsCoord | null; onChange: (g: GpsCoord) => void }) {
  const [fetching, setFetching] = useState(false);
  function capture() {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported");
      return;
    }
    setFetching(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: BigInt(Date.now()),
        });
        setFetching(false);
        toast.success(`${label} GPS captured`);
      },
      () => {
        toast.error("Could not capture GPS. Please enable location access.");
        setFetching(false);
      },
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={capture}
        disabled={fetching}
        data-ocid={`gps-capture-${label.toLowerCase().replace(/\s/g, "-")}`}
        className="gap-1.5"
      >
        {fetching ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <MapPin className="w-3.5 h-3.5" />
        )}
        {label}
      </Button>
      {value && value.lat !== 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-accent font-mono flex items-center gap-1">
            <Check className="w-3 h-3" />
            {value.lat.toFixed(4)}, {value.lng.toFixed(4)}
          </span>
          <MapLink lat={value.lat} lng={value.lng} />
        </div>
      )}
    </div>
  );
}

// ── Visit History Panel ──────────────────────────────────────────────────────

function VisitHistoryPanel({
  history,
  loading,
  products,
}: {
  history: CallReportInfo[] | null;
  loading: boolean;
  products: ProductInfo[];
}) {
  if (loading)
    return (
      <div className="p-3 bg-muted/30 rounded-md space-y-2">
        <Skeleton className="h-4 w-32 mb-2" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  if (!history || history.length === 0)
    return (
      <div className="p-3 bg-muted/30 rounded-md text-xs text-muted-foreground italic">
        No previous visits recorded for this doctor.
      </div>
    );
  return (
    <div className="p-3 bg-primary/5 border border-primary/20 rounded-md space-y-2">
      <p className="text-xs font-semibold text-primary uppercase tracking-wide">
        Last {history.length} Visit{history.length > 1 ? "s" : ""}
      </p>
      {history.map((r) => {
        const visitEntry = r.doctorsVisited[0];
        const productNames = visitEntry?.productIds?.length
          ? visitEntry.productIds
              .map(
                (pid) => products.find((p) => p.id === pid)?.name ?? `#${pid}`,
              )
              .join(", ")
          : "No products recorded";
        const samples = r.samplesDistributed
          .map((s) => {
            const p = products.find((x) => x.id === s.productId);
            return p ? `${p.name} x${s.quantity}` : `x${s.quantity}`;
          })
          .join(", ");
        return (
          <div
            key={r.id.toString()}
            className="flex flex-col gap-0.5 border-t border-primary/10 pt-2 first:border-0 first:pt-0"
          >
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <span className="font-mono font-medium">{r.date}</span>
              <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                {r.stationType}
              </Badge>
              {r.startLocation && r.startLocation.lat !== 0 && (
                <MapLink lat={r.startLocation.lat} lng={r.startLocation.lng} />
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              Products:{" "}
              <span className="text-foreground font-medium">
                {productNames}
              </span>
            </div>
            {samples && (
              <div className="text-xs text-muted-foreground">
                Samples: <span className="text-foreground">{samples}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── ThirtyDayDetail ──────────────────────────────────────────────────────────

function ThirtyDayDetail({
  session,
}: { session: { token: string; userId: bigint } | null }) {
  const now = new Date();
  const [month] = useState(BigInt(now.getMonth() + 1));
  const [year] = useState(BigInt(now.getFullYear()));
  const [rows, setRows] = useState<DaHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    api
      .getMyDaHistory(session.token, month, year)
      .then((data) => {
        setRows(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [session, month, year]);

  const totalDa = rows.reduce((sum, r) => sum + r.daAmount, BigInt(0));

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/20 flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground">
            30-Day Working Detail —{" "}
            {now.toLocaleString("default", { month: "long" })}{" "}
            {now.getFullYear()}
          </h3>
          {!loading && (
            <span className="text-xs text-muted-foreground">
              {rows.length} report{rows.length !== 1 ? "s" : ""} submitted
            </span>
          )}
        </div>
        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            No submitted or approved reports this month.
          </div>
        ) : (
          <ScrollableTable>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {[
                    "Date",
                    "Doctors Visited",
                    "Station Type",
                    "DA Earned (Rs)",
                  ].map((h, i) => (
                    <th
                      key={h}
                      className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide ${i === 3 ? "text-right" : "text-left"}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={`${r.date}-${i}`}
                    className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                    data-ocid="da-history-row"
                  >
                    <td className="px-4 py-3 font-mono text-xs">{r.date}</td>
                    <td className="px-4 py-3 text-xs text-center">
                      {r.doctorCount.toString()}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs">
                        {r.stationType}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-accent">
                      Rs {r.daAmount.toString()}
                    </td>
                  </tr>
                ))}
                <tr className="bg-muted/20 font-semibold">
                  <td className="px-4 py-3 text-sm" colSpan={3}>
                    Total DA this month
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-accent">
                    Rs {totalDa.toString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </ScrollableTable>
        )}
      </div>
    </div>
  );
}

// ── SamplesSection ──────────────────────────────────────────────────────────

function SamplesSection({
  samples,
  products,
  onChange,
  visitIndex,
}: {
  samples: SampleRow[];
  products: ProductInfo[];
  onChange: (rows: SampleRow[]) => void;
  visitIndex: number;
}) {
  return (
    <div className="space-y-2 pt-1 border-t border-border/40">
      <div className="flex items-center justify-between flex-wrap gap-2 pt-2">
        <Label className="text-xs text-muted-foreground font-semibold">
          Sample Distribution (Samples Given)
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs px-2 gap-1"
          onClick={() =>
            onChange([...samples, { productId: null, quantity: "" }])
          }
          data-ocid={`add-sample-visit-${visitIndex}`}
        >
          <Plus className="w-3 h-3" /> Add Sample
        </Button>
      </div>
      {samples.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          No samples added yet.
        </p>
      )}
      {samples.map((s, si) => (
        <div
          key={`sample-visit-${visitIndex}-${s.productId?.toString() ?? si}`}
          className="flex flex-col sm:flex-row gap-2 items-start sm:items-center"
        >
          <div className="flex-1 w-full">
            <Select
              value={s.productId?.toString() ?? "none"}
              onValueChange={(val) =>
                onChange(
                  samples.map((r, idx) =>
                    idx === si
                      ? { ...r, productId: val === "none" ? null : BigInt(val) }
                      : r,
                  ),
                )
              }
            >
              <SelectTrigger
                data-ocid={`sample-visit-product-${visitIndex}-${si}`}
              >
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Select product —</SelectItem>
                {products
                  .filter((p) => p.isActive)
                  .map((p) => (
                    <SelectItem key={p.id.toString()} value={p.id.toString()}>
                      {p.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 items-center w-full sm:w-auto">
            <Input
              type="number"
              min="1"
              placeholder="Qty"
              value={s.quantity}
              onChange={(e) =>
                onChange(
                  samples.map((r, idx) =>
                    idx === si ? { ...r, quantity: e.target.value } : r,
                  ),
                )
              }
              data-ocid={`sample-visit-qty-${visitIndex}-${si}`}
              className="w-24"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onChange(samples.filter((_, idx) => idx !== si))}
              className="h-9 w-9 shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5 text-destructive" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── GiftArticlesSection ──────────────────────────────────────────────────────

function GiftArticlesSection({
  gifts,
  onChange,
  visitIndex,
}: {
  gifts: GiftRow[];
  onChange: (rows: GiftRow[]) => void;
  visitIndex: number;
}) {
  return (
    <div className="space-y-2 pt-1 border-t border-border/40">
      <div className="flex items-center justify-between flex-wrap gap-2 pt-2">
        <Label className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5">
          <Gift className="w-3.5 h-3.5" /> Inputs / Promotional Materials Given
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs px-2 gap-1"
          onClick={() =>
            onChange([
              ...gifts,
              { giftArticleId: null, giftArticleName: "", quantity: "" },
            ])
          }
          data-ocid={`add-gift-${visitIndex}`}
        >
          <Plus className="w-3 h-3" /> Add Input
        </Button>
      </div>
      {gifts.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          No inputs / promotional materials added yet.
        </p>
      )}
      {gifts.map((g, gi) => (
        <div
          key={`gift-${visitIndex}-${g.giftArticleName || gi}`}
          className="flex flex-col sm:flex-row gap-2 items-start sm:items-center"
        >
          <Input
            placeholder="Input / promotional item name"
            value={g.giftArticleName}
            onChange={(e) =>
              onChange(
                gifts.map((r, idx) =>
                  idx === gi ? { ...r, giftArticleName: e.target.value } : r,
                ),
              )
            }
            data-ocid={`gift-name-${visitIndex}-${gi}`}
            className="flex-1"
          />
          <div className="flex gap-2 items-center w-full sm:w-auto">
            <Input
              type="number"
              min="1"
              placeholder="Qty"
              value={g.quantity}
              onChange={(e) =>
                onChange(
                  gifts.map((r, idx) =>
                    idx === gi ? { ...r, quantity: e.target.value } : r,
                  ),
                )
              }
              data-ocid={`gift-qty-${visitIndex}-${gi}`}
              className="w-24"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onChange(gifts.filter((_, idx) => idx !== gi))}
              className="h-9 w-9 shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5 text-destructive" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── MultiProductSelect ──────────────────────────────────────────────────────

function MultiProductSelect({
  products,
  selected,
  onChange,
  ocidIndex,
}: {
  products: ProductInfo[];
  selected: bigint[];
  onChange: (ids: bigint[]) => void;
  ocidIndex: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const activeProducts = products.filter((p) => p.isActive);

  function toggleProduct(id: bigint) {
    if (selected.some((s) => s === id))
      onChange(selected.filter((s) => s !== id));
    else onChange([...selected, id]);
  }

  const selectedNames = selected
    .map((id) => activeProducts.find((p) => p.id === id)?.name)
    .filter(Boolean);

  return (
    <div className="space-y-1.5" ref={ref}>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          data-ocid={`visit-product-${ocidIndex}`}
          className={`w-full flex items-center justify-between min-h-[44px] sm:min-h-[38px] px-3 text-xs rounded-md border transition-colors ${open ? "border-ring ring-2 ring-ring/20" : "border-input"} bg-background hover:bg-muted/30 text-foreground`}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span
            className={selected.length === 0 ? "text-muted-foreground" : ""}
          >
            {selected.length === 0
              ? "Select products for detailing"
              : `${selected.length} product${selected.length > 1 ? "s" : ""} selected`}
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        {open && (
          <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-popover border border-border rounded-md shadow-md max-h-44 overflow-y-auto">
            {activeProducts.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground italic">
                No active products
              </p>
            ) : (
              activeProducts.map((p) => {
                const checked = selected.some((s) => s === p.id);
                const checkId = `product-check-${ocidIndex}-${p.id}`;
                return (
                  <label
                    key={p.id.toString()}
                    htmlFor={checkId}
                    className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-muted/40 transition-colors"
                  >
                    <Checkbox
                      id={checkId}
                      checked={checked}
                      onCheckedChange={() => toggleProduct(p.id)}
                      data-ocid={checkId}
                    />
                    <span className="text-sm text-foreground flex-1">
                      {p.name}
                    </span>
                    {p.category && (
                      <span className="text-[10px] text-muted-foreground">
                        {p.category}
                      </span>
                    )}
                  </label>
                );
              })
            )}
          </div>
        )}
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {selected.map((id) => {
            const name =
              activeProducts.find((p) => p.id === id)?.name ?? `#${id}`;
            return (
              <span
                key={id.toString()}
                className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary border border-primary/20 rounded-full px-2.5 py-0.5"
              >
                {name}
                <button
                  type="button"
                  onClick={() => toggleProduct(id)}
                  className="flex items-center justify-center p-1 min-w-[24px] min-h-[24px] hover:text-destructive transition-colors"
                  aria-label={`Remove ${name}`}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            );
          })}
        </div>
      )}
      <span className="sr-only">{selectedNames.join(", ")}</span>
    </div>
  );
}

// ── SFA Phase 2: CoreDoctorBadge ────────────────────────────────────────────

function CoreDoctorBadge({
  doctor,
}: { doctor: DoctorInfo | null | undefined }) {
  if (!doctor) return null;
  const isCore = doctor.isCoreDoctor;
  const freq = doctor.visitFrequencyTarget
    ? Number(doctor.visitFrequencyTarget)
    : 0;
  if (!isCore && freq === 0) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap mt-1">
      {isCore && (
        <span
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20"
          data-ocid="core-doctor-badge"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          Core Doctor
        </span>
      )}
      {freq > 0 && (
        <span
          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20"
          data-ocid="visit-frequency-badge"
        >
          Target: {freq} visit{freq !== 1 ? "s" : ""}/month
        </span>
      )}
    </div>
  );
}

// ── SFA Phase 2: ProductsDetailedSection ─────────────────────────────────────

const DETAILING_PRIORITIES: DetailingPriority[] = [
  "First Call",
  "Second Call",
  "Reminder",
];

function ProductsDetailedSection({
  rows,
  products,
  onChange,
  visitIndex,
}: {
  rows: ProductDetailRow[];
  products: ProductInfo[];
  onChange: (rows: ProductDetailRow[]) => void;
  visitIndex: number;
}) {
  const [open, setOpen] = useState(true);
  const activeProducts = products.filter((p) => p.isActive);

  function addRow() {
    onChange([...rows, { productId: null, priority: "First Call", notes: "" }]);
  }

  function updateRow(idx: number, patch: Partial<ProductDetailRow>) {
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function removeRow(idx: number) {
    onChange(rows.filter((_, i) => i !== idx));
  }

  return (
    <div
      className="border border-border/50 rounded-lg overflow-hidden"
      data-ocid={`products-detailed-section-${visitIndex}`}
    >
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
        aria-expanded={open}
        data-ocid={`products-detailed-toggle-${visitIndex}`}
      >
        <div className="flex items-center gap-2">
          <Pill className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">
            Products Detailed
          </span>
          {rows.length > 0 && (
            <span className="text-xs bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5 font-medium">
              {rows.length}
            </span>
          )}
        </div>
        {open ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="p-4 space-y-3 bg-card">
          {rows.length === 0 && (
            <p className="text-xs text-muted-foreground italic">
              No detailing entries added yet. Add the products you detailed
              during this visit.
            </p>
          )}
          {rows.map((row, idx) => (
            <div
              key={`pd-${visitIndex}-${idx}`}
              className="flex flex-col gap-2 p-3 rounded-md bg-muted/20 border border-border/40"
              data-ocid={`product-detail-row-${visitIndex}-${idx}`}
            >
              <div className="flex flex-col sm:flex-row gap-2">
                {/* Product selector */}
                <div className="flex-1">
                  <Label className="text-[11px] text-muted-foreground mb-1 block">
                    Product
                  </Label>
                  <Select
                    value={row.productId?.toString() ?? "none"}
                    onValueChange={(val) =>
                      updateRow(idx, {
                        productId: val === "none" ? null : BigInt(val),
                      })
                    }
                  >
                    <SelectTrigger
                      data-ocid={`pd-product-${visitIndex}-${idx}`}
                      className="h-9"
                    >
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Select product —</SelectItem>
                      {activeProducts.map((p) => (
                        <SelectItem
                          key={p.id.toString()}
                          value={p.id.toString()}
                        >
                          {p.name}
                          {p.productCode ? ` (${p.productCode})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Priority */}
                <div className="w-full sm:w-36">
                  <Label className="text-[11px] text-muted-foreground mb-1 block">
                    Priority
                  </Label>
                  <Select
                    value={row.priority}
                    onValueChange={(val) =>
                      updateRow(idx, { priority: val as DetailingPriority })
                    }
                  >
                    <SelectTrigger
                      data-ocid={`pd-priority-${visitIndex}-${idx}`}
                      className="h-9"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DETAILING_PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Remove */}
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRow(idx)}
                    className="h-9 w-9 shrink-0"
                    aria-label="Remove product"
                    data-ocid={`pd-remove-${visitIndex}-${idx}`}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
              {/* Notes */}
              <Input
                placeholder="Detailing notes (optional)"
                value={row.notes}
                onChange={(e) => updateRow(idx, { notes: e.target.value })}
                data-ocid={`pd-notes-${visitIndex}-${idx}`}
                className="h-8 text-xs"
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 h-8 text-xs"
            onClick={addRow}
            data-ocid={`pd-add-${visitIndex}`}
          >
            <Plus className="w-3.5 h-3.5" />
            Add Detailing
          </Button>
        </div>
      )}
    </div>
  );
}

// ── SFA Phase 2: SampleBalanceSection ────────────────────────────────────────

function SampleBalanceSection({
  balances,
  balancesLoading,
  rows,
  onChange,
  visitIndex,
}: {
  balances: SampleBalance[];
  balancesLoading: boolean;
  rows: SampleBalanceRow[];
  onChange: (rows: SampleBalanceRow[]) => void;
  visitIndex: number;
}) {
  const [open, setOpen] = useState(false);

  // Calculate how many units are being used in THIS session across all rows
  const sessionUsage = rows.reduce<Map<string, number>>((acc, r) => {
    if (!r.productId) return acc;
    const key = r.productId.toString();
    acc.set(key, (acc.get(key) ?? 0) + (Number.parseInt(r.quantity) || 0));
    return acc;
  }, new Map());

  function getEffectiveRemaining(productId: bigint): number {
    const balance = balances.find((b) => b.productId === productId);
    if (!balance) return 0;
    const alreadyAdded = sessionUsage.get(productId.toString()) ?? 0;
    return Math.max(0, balance.remainingQty - alreadyAdded);
  }

  function addRow() {
    // default to first product with available balance
    const available = balances.find(
      (b) =>
        b.remainingQty > 0 && !rows.some((r) => r.productId === b.productId),
    );
    onChange([
      ...rows,
      {
        productId: available?.productId ?? null,
        quantity: available ? "1" : "",
        remainingQty: available?.remainingQty ?? 0,
      },
    ]);
  }

  function updateRow(idx: number, patch: Partial<SampleBalanceRow>) {
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function removeRow(idx: number) {
    onChange(rows.filter((_, i) => i !== idx));
  }

  const totalGiven = rows.reduce(
    (n, r) => n + (Number.parseInt(r.quantity) || 0),
    0,
  );

  return (
    <div
      className="border border-border/50 rounded-lg overflow-hidden"
      data-ocid={`sample-balance-section-${visitIndex}`}
    >
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
        aria-expanded={open}
        data-ocid={`sample-balance-toggle-${visitIndex}`}
      >
        <div className="flex items-center gap-2">
          <Gift className="w-4 h-4 text-accent" />
          <span className="text-sm font-semibold text-foreground">
            Samples Given
          </span>
          {totalGiven > 0 && (
            <span className="text-xs bg-accent/10 text-accent border border-accent/20 rounded-full px-2 py-0.5 font-medium">
              {totalGiven} unit{totalGiven !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        {open ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="p-4 space-y-3 bg-card">
          {/* Balance summary table */}
          {balancesLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-4/5" />
            </div>
          ) : balances.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              No sample allocation found for this month. Contact Admin.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border/40">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/40 bg-muted/20">
                    {["Product", "Allocated", "Used", "Remaining"].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wide text-[10px]"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {balances.map((b) => {
                    const sessionQty =
                      sessionUsage.get(b.productId.toString()) ?? 0;
                    const effective = Math.max(0, b.remainingQty - sessionQty);
                    return (
                      <tr
                        key={b.productId.toString()}
                        className="border-b border-border/30 last:border-0 hover:bg-muted/10"
                        data-ocid={`sample-balance-row-${b.productId}`}
                      >
                        <td className="px-3 py-2 font-medium text-foreground">
                          {b.productName}
                          {b.productCode && (
                            <span className="ml-1 text-muted-foreground text-[10px]">
                              ({b.productCode})
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center font-mono">
                          {b.allocatedQty}
                        </td>
                        <td className="px-3 py-2 text-center font-mono">
                          {b.usedQty + sessionQty}
                        </td>
                        <td className="px-3 py-2 text-center font-mono">
                          <span
                            className={
                              effective === 0
                                ? "text-destructive"
                                : effective <= 5
                                  ? "text-orange-500 font-semibold"
                                  : "text-accent font-semibold"
                            }
                          >
                            {effective}
                          </span>
                          {effective === 0 && (
                            <span className="ml-1 text-[10px] text-destructive">
                              No stock
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Sample entry rows */}
          {rows.length > 0 && (
            <div className="space-y-2 pt-1">
              <p className="text-xs font-semibold text-muted-foreground">
                Samples for this visit:
              </p>
              {rows.map((row, idx) => {
                const balance = row.productId
                  ? balances.find((b) => b.productId === row.productId)
                  : null;
                const effectiveRemaining = row.productId
                  ? getEffectiveRemaining(row.productId) +
                    (Number.parseInt(row.quantity) || 0)
                  : 0;
                return (
                  <div
                    key={`sb-${visitIndex}-${idx}`}
                    className="flex flex-col sm:flex-row gap-2 items-start sm:items-center"
                    data-ocid={`sample-given-row-${visitIndex}-${idx}`}
                  >
                    <div className="flex-1 w-full">
                      <Select
                        value={row.productId?.toString() ?? "none"}
                        onValueChange={(val) => {
                          const pid = val === "none" ? null : BigInt(val);
                          const b = pid
                            ? balances.find((b) => b.productId === pid)
                            : null;
                          updateRow(idx, {
                            productId: pid,
                            quantity: "",
                            remainingQty: b?.remainingQty ?? 0,
                          });
                        }}
                      >
                        <SelectTrigger
                          data-ocid={`sb-product-${visitIndex}-${idx}`}
                        >
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            — Select product —
                          </SelectItem>
                          {balances.map((b) => {
                            const eff =
                              getEffectiveRemaining(b.productId) +
                              (row.productId === b.productId
                                ? Number.parseInt(row.quantity) || 0
                                : 0);
                            return (
                              <SelectItem
                                key={b.productId.toString()}
                                value={b.productId.toString()}
                                disabled={
                                  eff === 0 && row.productId !== b.productId
                                }
                              >
                                {b.productName}{" "}
                                {eff === 0 ? "(No stock)" : `(${eff} left)`}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2 items-center w-full sm:w-auto">
                      <div className="relative">
                        <Input
                          type="number"
                          min="1"
                          max={effectiveRemaining.toString()}
                          placeholder="Qty"
                          value={row.quantity}
                          onChange={(e) => {
                            const v = Number.parseInt(e.target.value) || 0;
                            const maxQ = effectiveRemaining;
                            updateRow(idx, {
                              quantity: String(Math.min(v, maxQ) || ""),
                            });
                          }}
                          data-ocid={`sb-qty-${visitIndex}-${idx}`}
                          className="w-24"
                        />
                        {balance && (
                          <span className="absolute -bottom-4 left-0 text-[10px] text-muted-foreground whitespace-nowrap">
                            max {effectiveRemaining}
                          </span>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRow(idx)}
                        className="h-9 w-9 shrink-0"
                        data-ocid={`sb-remove-${visitIndex}-${idx}`}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {balances.length > 0 && (
            <div className="pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 h-8 text-xs"
                onClick={addRow}
                disabled={balances.every(
                  (b) => getEffectiveRemaining(b.productId) === 0,
                )}
                data-ocid={`sb-add-${visitIndex}`}
              >
                <Plus className="w-3.5 h-3.5" />
                Add Sample
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── DoctorVisitForm ──────────────────────────────────────────────────────────
// Station-first doctor selector with search + the visit fields

// Module-level visit history cache to avoid redundant API calls
const visitHistoryCache = new Map<string, CallReportInfo[]>();

function DoctorVisitForm({
  visit,
  index,
  doctors,
  products,
  sampleBalances,
  balancesLoading,
  onUpdate,
  onRemove,
  onSave,
  saving,
  canRemove,
  mrUserId,
}: {
  visit: VisitRow;
  index: number;
  doctors: DoctorInfo[];
  products: ProductInfo[];
  sampleBalances: SampleBalance[];
  balancesLoading: boolean;
  onUpdate: (v: VisitRow) => void;
  onRemove: () => void;
  onSave: () => void;
  saving: boolean;
  canRemove: boolean;
  mrUserId?: bigint;
}) {
  const sessionToken = useAuthStore((s) => s.session?.token ?? "");
  const [selectedStation, setSelectedStation] = useState<string>("all");
  const [doctorSearch, setDoctorSearch] = useState("");
  const [extraStations, setExtraStations] = useState<string[]>([]);
  const [stationsLoading, setStationsLoading] = useState(false);

  // Fetch additional stations from backend on mount
  useEffect(() => {
    if (!mrUserId || !sessionToken) return;
    setStationsLoading(true);
    api
      .getStationsByMR(sessionToken, mrUserId)
      .then((stations) => setExtraStations(stations))
      .catch(() => setExtraStations([]))
      .finally(() => setStationsLoading(false));
  }, [mrUserId, sessionToken]);

  // Derive unique stations from assigned doctors + extra from backend, deduplicated
  const stations = useMemo(() => {
    const set = new Set(
      [...doctors.map((d) => d.station), ...extraStations].filter(
        Boolean,
      ) as string[],
    );
    return Array.from(set).sort();
  }, [doctors, extraStations]);

  // Filter doctors by station + search
  const filteredDoctors = useMemo(() => {
    let list = doctors;
    if (selectedStation && selectedStation !== "all")
      list = list.filter((d) => d.station === selectedStation);
    if (doctorSearch.trim())
      list = list.filter((d) =>
        d.name.toLowerCase().includes(doctorSearch.toLowerCase()),
      );
    return list;
  }, [doctors, selectedStation, doctorSearch]);

  async function handleDoctorSelect(val: string) {
    const doctorId = BigInt(val);
    const cacheKey = val;
    // Return cached result immediately if available
    const cached = visitHistoryCache.get(cacheKey);
    if (cached) {
      onUpdate({
        ...visit,
        doctorId,
        visitHistory: cached,
        loadingHistory: false,
      });
      return;
    }
    onUpdate({ ...visit, doctorId, visitHistory: null, loadingHistory: true });
    try {
      const history = await api.getDoctorVisitHistory(doctorId, BigInt(2));
      visitHistoryCache.set(cacheKey, history);
      onUpdate({
        ...visit,
        doctorId,
        visitHistory: history,
        loadingHistory: false,
      });
    } catch (err) {
      console.error("Failed to load doctor visit history:", err);
      onUpdate({ ...visit, doctorId, visitHistory: [], loadingHistory: false });
    }
  }

  const selectedDoctor = visit.doctorId
    ? doctors.find((d) => d.id === visit.doctorId)
    : null;

  return (
    <div
      className="bg-muted/20 border border-border rounded-lg p-4 space-y-4"
      data-ocid={`doctor-visit-form-${index}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Stethoscope className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">
            New Doctor Visit
          </span>
        </div>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="h-7 w-7"
            aria-label="Remove visit form"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
        )}
      </div>

      {/* Step 1: Station */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Step 1 — Select Station
        </Label>
        <Select
          value={selectedStation}
          onValueChange={(val) => {
            setSelectedStation(val);
            setDoctorSearch("");
            // Reset doctor if station changes
            if (visit.doctorId)
              onUpdate({ ...visit, doctorId: null, visitHistory: null });
          }}
        >
          <SelectTrigger
            data-ocid={`visit-station-${index}`}
            className="w-full"
          >
            <SelectValue
              placeholder={
                stationsLoading
                  ? "Loading stations…"
                  : "Select a station / area"
              }
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stations</SelectItem>
            {stations.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Step 2: Doctor with search */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Step 2 — Select Doctor <span className="text-destructive">*</span>
        </Label>
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search doctor by name..."
            value={doctorSearch}
            onChange={(e) => setDoctorSearch(e.target.value)}
            className="pl-9"
            data-ocid={`doctor-search-${index}`}
          />
          {doctorSearch && (
            <button
              type="button"
              onClick={() => setDoctorSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {/* Doctor list */}
        <div className="border border-input rounded-md bg-background max-h-48 overflow-y-auto scrollbar-thin">
          {filteredDoctors.length === 0 ? (
            <div className="px-3 py-4 text-xs text-muted-foreground text-center italic">
              {doctors.length === 0
                ? "No doctors assigned. Contact admin."
                : "No doctors match your search."}
            </div>
          ) : (
            filteredDoctors.map((d) => {
              const isSelected = visit.doctorId === d.id;
              return (
                <button
                  key={d.id.toString()}
                  type="button"
                  onClick={() => handleDoctorSelect(d.id.toString())}
                  data-ocid={`doctor-list-item-${d.id}`}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-muted/40 transition-colors border-b border-border/30 last:border-0 ${isSelected ? "bg-primary/8 border-l-2 border-l-primary" : ""}`}
                >
                  <div className="min-w-0">
                    <p
                      className={`text-sm font-medium truncate ${isSelected ? "text-primary" : "text-foreground"}`}
                    >
                      {d.name}
                    </p>
                    {d.station && (
                      <p className="text-xs text-muted-foreground truncate">
                        {d.station}
                      </p>
                    )}
                  </div>
                  {isSelected && (
                    <Check className="w-4 h-4 text-primary shrink-0 ml-2" />
                  )}
                </button>
              );
            })
          )}
        </div>
        {filteredDoctors.length > 0 && (
          <p className="text-[11px] text-muted-foreground">
            {filteredDoctors.length} doctor
            {filteredDoctors.length !== 1 ? "s" : ""} shown
            {selectedStation ? ` in ${selectedStation}` : ""}
          </p>
        )}
      </div>

      {/* Doctor selected — show details */}
      {visit.doctorId !== null && (
        <>
          {selectedDoctor && (
            <div className="flex flex-col gap-1 px-3 py-2 bg-primary/5 border border-primary/20 rounded-md">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-primary">
                    {selectedDoctor.name}
                  </p>
                  {selectedDoctor.station && (
                    <p className="text-xs text-muted-foreground">
                      {selectedDoctor.station}
                    </p>
                  )}
                </div>
              </div>
              {/* SFA Phase 2: Core Doctor badge + frequency target */}
              <CoreDoctorBadge doctor={selectedDoctor} />
            </div>
          )}

          <VisitHistoryPanel
            history={visit.visitHistory}
            loading={visit.loadingHistory}
            products={products}
          />

          <div>
            <Label className="text-xs mb-1 block text-muted-foreground font-semibold">
              Products Detailed <span className="text-destructive">*</span>
            </Label>
            <MultiProductSelect
              products={products}
              selected={visit.productIds}
              onChange={(ids) => onUpdate({ ...visit, productIds: ids })}
              ocidIndex={index}
            />
          </div>

          {/* SFA Phase 2: Products Detailed section (collapsible) */}
          <ProductsDetailedSection
            rows={visit.productDetails}
            products={products}
            onChange={(rows) => onUpdate({ ...visit, productDetails: rows })}
            visitIndex={index}
          />

          {/* SFA Phase 2: Samples Given with balance tracking (collapsible) */}
          <SampleBalanceSection
            balances={sampleBalances}
            balancesLoading={balancesLoading}
            rows={visit.sampleBalance}
            onChange={(rows) => onUpdate({ ...visit, sampleBalance: rows })}
            visitIndex={index}
          />

          <SamplesSection
            samples={visit.samples}
            products={products}
            onChange={(rows) => onUpdate({ ...visit, samples: rows })}
            visitIndex={index}
          />

          <GiftArticlesSection
            gifts={visit.giftArticles}
            onChange={(rows) => onUpdate({ ...visit, giftArticles: rows })}
            visitIndex={index}
          />

          <div>
            <Label className="text-xs mb-1 block text-muted-foreground">
              Visit Notes
            </Label>
            <Input
              placeholder="Notes about this visit"
              value={visit.notes}
              onChange={(e) => onUpdate({ ...visit, notes: e.target.value })}
              data-ocid={`visit-notes-${index}`}
            />
          </div>

          <Button
            type="button"
            onClick={onSave}
            disabled={saving || visit.productIds.length === 0}
            data-ocid={`save-visit-${index}`}
            className="w-full sm:w-auto gap-2"
            title={
              visit.productIds.length === 0
                ? "Select at least one product"
                : undefined
            }
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Save Doctor Visit
          </Button>
          {visit.productIds.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Select at least one product to save this visit.
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ── SavedVisitCard ────────────────────────────────────────────────────────────

function SavedVisitCard({
  entry,
  doctors,
  products,
  onDelete,
}: {
  entry: DoctorVisitEntry & { _tempKey: string; notes: string };
  doctors: DoctorInfo[];
  products: ProductInfo[];
  onDelete: () => void;
}) {
  const doc = entry.doctorId
    ? doctors.find((d) => d.id === entry.doctorId)
    : null;
  const prods = entry.productIds
    .map((pid) => products.find((p) => p.id === pid)?.name)
    .filter(Boolean)
    .join(", ");

  return (
    <div
      className="flex items-start gap-3 p-3 bg-card border border-border rounded-lg"
      data-ocid={`saved-visit-${entry._tempKey}`}
    >
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-sm font-semibold text-foreground truncate">
          {doc?.name ?? "Unknown Doctor"}
        </p>
        {doc?.station && (
          <p className="text-xs text-muted-foreground">{doc.station}</p>
        )}
        {prods && (
          <p className="text-xs text-muted-foreground">
            Products: <span className="text-foreground">{prods}</span>
          </p>
        )}
        {entry.notes && (
          <p className="text-xs text-muted-foreground italic">{entry.notes}</p>
        )}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onDelete}
        className="h-7 w-7 shrink-0"
        aria-label="Remove visit"
      >
        <Trash2 className="w-3.5 h-3.5 text-destructive" />
      </Button>
    </div>
  );
}

// ── ReportDetailCard ─────────────────────────────────────────────────────────

function ReportDetailCard({
  report,
  doctors,
  products,
}: {
  report: CallReportInfo;
  doctors: DoctorInfo[];
  products: ProductInfo[];
}) {
  const gps = report.startLocation;
  const hasGps = gps && gps.lat !== 0;

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono font-semibold text-sm">{report.date}</span>
        <Badge variant="outline">{report.stationType}</Badge>
        <span
          className={`inline-block px-2 py-0.5 rounded text-xs font-display uppercase tracking-wide ${STATUS_COLORS[report.status] ?? ""}`}
        >
          {report.status}
        </span>
      </div>

      {hasGps && (
        <div className="flex items-center gap-2 text-xs">
          <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-mono text-muted-foreground">
            {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}
          </span>
          <MapLink lat={gps.lat} lng={gps.lng} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-muted-foreground">Work Type: </span>
          <span className="font-medium">{report.workType}</span>
        </div>
        <div>
          <span className="text-muted-foreground">DA: </span>
          <span className="font-mono font-semibold text-accent">
            Rs {report.daAmount?.toString() ?? "0"}
          </span>
        </div>
        {report.workingStation && (
          <div className="col-span-2">
            <span className="text-muted-foreground">Station: </span>
            <span className="font-medium">{report.workingStation}</span>
          </div>
        )}
      </div>

      {report.doctorsVisited.length > 0 && (
        <div className="border-t border-border/40 pt-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Doctors Visited ({report.doctorsVisited.length})
          </p>
          {report.doctorsVisited.map((dv, i) => {
            const doc = doctors.find((d) => d.id === dv.doctorId);
            const prods = dv.productIds
              .map((pid) => products.find((p) => p.id === pid)?.name)
              .filter(Boolean)
              .join(", ");
            return (
              <div
                key={`dv-${dv.doctorId?.toString() ?? i}`}
                className="text-xs flex flex-col gap-0.5 pl-2 border-l-2 border-primary/20"
              >
                <span className="font-medium text-foreground">
                  {doc?.name ?? `Doctor #${dv.doctorId}`}
                </span>
                {prods && (
                  <span className="text-muted-foreground">
                    Products: {prods}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {report.remarks && (
        <p className="text-xs text-muted-foreground border-t border-border/40 pt-2">
          Remarks: {report.remarks}
        </p>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

type PendingVisit = DoctorVisitEntry & { _tempKey: string; notes: string };

export default function DailyCallReport() {
  const session = useAuthStore((s) => s.session);
  const {
    coords: gpsCoords,
    error: gpsError,
    locationNote: gpsNote,
    loading: gpsLoading,
    refreshGps,
  } = useGps();

  const [mainTab, setMainTab] = useState<MainTab>("list");
  const [formTab, setFormTab] = useState<FormTab>("report-details");
  const [doctors, setDoctors] = useState<DoctorInfo[]>([]);
  const [products, setProducts] = useState<ProductInfo[]>([]);
  const [reports, setReports] = useState<CallReportInfo[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingVisit, setSavingVisit] = useState(false);
  const [showGpsError, setShowGpsError] = useState(false);
  const [selectedReport, setSelectedReport] = useState<CallReportInfo | null>(
    null,
  );

  const today = new Date().toISOString().slice(0, 10);

  // ── Report Details state ─────────────────────────────────────────────────
  const [date, setDate] = useState(today);
  const [workType, setWorkType] = useState<WorkType>(WorkType.Field);
  const [stationType, setStationType] = useState<StationType>("HQ Day");
  const [startGps, setStartGps] = useState<GpsCoord | null>(null);
  const [endGps, setEndGps] = useState<GpsCoord | null>(null);
  const [remarks, setRemarks] = useState("");
  const [workingStationSource, setWorkingStationSource] = useState<
    "AsPerTP" | "OtherStation"
  >("OtherStation");
  const [workingStation, setWorkingStation] = useState("");
  const [tpStationLoading, setTpStationLoading] = useState(false);
  const [tpStationError, setTpStationError] = useState<string | null>(null);
  const [workingMode, setWorkingMode] = useState<
    "WorkingAlone" | "WorkingWith"
  >("WorkingAlone");
  const [higherAuthorities, setHigherAuthorities] = useState<HigherAuthority[]>(
    [],
  );
  const [authoritiesLoading, setAuthoritiesLoading] = useState(false);
  const [selectedAuthorityId, setSelectedAuthorityId] = useState<string>("");
  const [savingDetails, setSavingDetails] = useState(false);
  const [savedDetails, setSavedDetails] = useState<SavedReportDetails | null>(
    null,
  );
  const [detailsBannerMsg, setDetailsBannerMsg] = useState<string | null>(null);

  // ── Doctor Call state ────────────────────────────────────────────────────
  const [currentVisit, setCurrentVisit] = useState<VisitRow>(newVisitRow());
  const [pendingVisits, setPendingVisits] = useState<PendingVisit[]>([]);

  // SFA Phase 2 — sample balance for current month
  const [sampleBalances, setSampleBalances] = useState<SampleBalance[]>([]);
  const [balancesLoading, setBalancesLoading] = useState(false);

  const userRole = (session?.role as string) ?? "MR";
  const daAmount =
    DA_RATES[userRole]?.[stationType] ?? DA_RATES.MR[stationType] ?? 250;

  const todayVisitCount =
    reports
      .filter((r) => r.date === today)
      .reduce((n, r) => n + r.doctorsVisited.length, 0) + pendingVisits.length;

  // Auto-fill GPS on form open
  useEffect(() => {
    if (mainTab === "new" && gpsCoords) {
      setStartGps(
        (prev) =>
          prev ?? {
            lat: gpsCoords.lat,
            lng: gpsCoords.lng,
            timestamp: BigInt(Date.now()),
          },
      );
    }
  }, [mainTab, gpsCoords]);

  // Initial data load
  useEffect(() => {
    if (!session) return;
    Promise.all([
      api.listMyDoctors(session.userId),
      api.listProducts(),
      api.listMyCallReports(session.userId),
    ]).then(([d, p, r]) => {
      setDoctors(d);
      setProducts(p);
      setReports(r);
      setLoadingList(false);
    });
  }, [session]);

  // Auto-load today's report details when opening new report form
  useEffect(() => {
    if (mainTab !== "new") return;
    // SFA Phase 2: load sample balance when entering form
    const now = new Date();
    setBalancesLoading(true);
    api
      .getMyBalance(session?.token ?? "", now.getMonth() + 1, now.getFullYear())
      .then((views) => {
        setSampleBalances(
          views.map((v) => ({
            productId: v.productId,
            productName: v.productName,
            productCode: v.productCode,
            allocatedQty: Number(v.allocatedQty),
            usedQty: Number(v.usedQty),
            remainingQty: Number(v.remainingQty),
          })),
        );
      })
      .catch(() => setSampleBalances([]))
      .finally(() => setBalancesLoading(false));

    const todayReport = reports.find((r) => r.date === today);
    if (todayReport) {
      const st = (todayReport.stationType as StationType) ?? "HQ Day";
      const wms =
        (todayReport.workingStationSource as string) === "AsPerTP" ||
        (todayReport.workingStationSource as string) === "AsPerPlan"
          ? "AsPerTP"
          : "OtherStation";
      const wm =
        todayReport.workingMode === WorkingMode.WorkingWith
          ? "WorkingWith"
          : "WorkingAlone";
      setDate(todayReport.date);
      setWorkType(todayReport.workType);
      setStationType(st);
      setWorkingStationSource(wms);
      setWorkingStation(todayReport.workingStation ?? "");
      setWorkingMode(wm);
      setSelectedAuthorityId(todayReport.workingWithUserId?.toString() ?? "");
      setRemarks(todayReport.remarks);
      setStartGps(todayReport.startLocation);
      setEndGps(todayReport.endLocation);
      setSavedDetails({
        date: todayReport.date,
        workType: todayReport.workType,
        stationType: st,
        workingStationSource: wms,
        workingStation: todayReport.workingStation ?? "",
        workingMode: wm,
        workingWithUserId: todayReport.workingWithUserId,
        workingWithUserName: todayReport.workingWithUserName,
        startGps: todayReport.startLocation,
        endGps: todayReport.endLocation,
        remarks: todayReport.remarks,
        daAmount: Number(todayReport.daAmount),
      });
      setDetailsBannerMsg(
        "Report details already saved for today — you can update or add doctor visits.",
      );
    } else {
      setSavedDetails(null);
      setDetailsBannerMsg(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainTab, reports, today, session?.token]);

  // TP station auto-fill
  useEffect(() => {
    if (workingStationSource !== "AsPerTP" || !session || !date) return;
    setTpStationLoading(true);
    setTpStationError(null);
    api
      .getMyStationForDate(session.token, date)
      .then((station) => {
        if (station) {
          setWorkingStation(station);
          setTpStationError(null);
        } else {
          setWorkingStation("");
          setTpStationError(
            `No travel plan found for ${date}. Select "Other Station" or create a TP first.`,
          );
        }
      })
      .catch(() =>
        setTpStationError("Failed to fetch station from travel plan."),
      )
      .finally(() => setTpStationLoading(false));
  }, [workingStationSource, date, session]);

  // Load higher authorities
  useEffect(() => {
    if (
      workingMode !== "WorkingWith" ||
      !session ||
      higherAuthorities.length > 0
    )
      return;
    setAuthoritiesLoading(true);
    api
      .getHigherAuthoritiesForMe(session.token)
      .then((list) =>
        setHigherAuthorities(
          list.map((a) => ({
            userId: a.userId,
            userName: a.userName,
            role: a.role as string,
          })),
        ),
      )
      .catch(() => toast.error("Could not load authorities list"))
      .finally(() => setAuthoritiesLoading(false));
  }, [workingMode, session, higherAuthorities.length]);

  function resolveAuthority() {
    if (workingMode !== "WorkingWith" || !selectedAuthorityId) return {};
    const authority = higherAuthorities.find(
      (a) => a.userId.toString() === selectedAuthorityId,
    );
    return authority
      ? {
          workingWithUserId: authority.userId,
          workingWithUserName: authority.userName,
        }
      : {};
  }

  function isSessionError(msg: string) {
    return (
      msg.toLowerCase().includes("unauthorized") ||
      msg.toLowerCase().includes("session")
    );
  }

  async function handleSaveDetails() {
    if (!session) {
      toast.error("Your session has expired. Please log in again.");
      return;
    }
    const gpsRequired = isGpsRequired();
    if (gpsRequired && !gpsCoords) {
      setShowGpsError(true);
      toast.error("GPS location is required. Please enable location access.");
      return;
    }
    if (!stationType) {
      toast.error("Please select a Station Type");
      return;
    }
    setShowGpsError(false);
    const { workingWithUserId, workingWithUserName } = resolveAuthority();
    const reportGps: GpsCoord = gpsCoords
      ? {
          lat: gpsCoords.lat,
          lng: gpsCoords.lng,
          timestamp: BigInt(Date.now()),
        }
      : NULL_GPS;
    setSavingDetails(true);
    try {
      await api.createCallReport(session.userId, {
        date,
        workType,
        gps: reportGps,
        startLocation: startGps ?? reportGps,
        endLocation: endGps ?? NULL_GPS,
        remarks,
        doctorsVisited: [],
        samplesDistributed: [],
        stationType,
        workingStation: workingStation.trim() || undefined,
        workingStationSource: (workingStationSource === "AsPerTP"
          ? "AsPerTP"
          : "OtherStation") as WorkingStationSource__1,
        workingMode:
          workingMode === "WorkingWith"
            ? WorkingMode.WorkingWith
            : WorkingMode.WorkingAlone,
        workingWithUserId,
        workingWithUserName,
      });
      setSavedDetails({
        date,
        workType,
        stationType,
        workingStationSource,
        workingStation: workingStation.trim(),
        workingMode,
        workingWithUserId,
        workingWithUserName,
        startGps: startGps ?? reportGps,
        endGps,
        remarks,
        daAmount,
      });
      setDetailsBannerMsg(
        "Report details saved — switch to Doctor Call tab to add visits.",
      );
      const updated = await api.listMyCallReports(session.userId);
      setReports(updated);
      toast.success("Report details saved for today");
      // Auto-switch to Doctor Call tab
      setFormTab("doctor-call");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isSessionError(msg))
        toast.error("Your session has expired. Please log in again.");
      else toast.error("Failed to save report details. Please try again.");
    } finally {
      setSavingDetails(false);
    }
  }

  async function handleSaveVisit() {
    if (!session) {
      toast.error("Your session has expired.");
      return;
    }
    if (!savedDetails) {
      toast.error("Save Report Details first.");
      return;
    }
    if (!currentVisit.doctorId) {
      toast.error("Select a doctor.");
      return;
    }
    if (currentVisit.productIds.length === 0) {
      toast.error("Select at least one product.");
      return;
    }
    const gpsRequired = isGpsRequired();
    if (gpsRequired && !gpsCoords) {
      setShowGpsError(true);
      toast.error("GPS required to save visits.");
      return;
    }

    const reportGps: GpsCoord = gpsCoords
      ? {
          lat: gpsCoords.lat,
          lng: gpsCoords.lng,
          timestamp: BigInt(Date.now()),
        }
      : NULL_GPS;
    const { workingWithUserId, workingWithUserName } = resolveAuthority();

    const visitSamples: SampleDistributed[] = currentVisit.samples
      .filter((s) => s.productId !== null && s.quantity !== "")
      .map((s) => ({ productId: s.productId!, quantity: BigInt(s.quantity) }));
    const visitEntry: DoctorVisitEntry = {
      doctorId: currentVisit.doctorId,
      notes: currentVisit.notes,
      gps: currentVisit.gps ?? undefined,
      productIds: currentVisit.productIds,
      detailsPerProduct: [],
      samplesDistributed: visitSamples,
      giftArticles: currentVisit.giftArticles
        .filter((g) => g.giftArticleName.trim() && g.quantity !== "")
        .map((g) => ({
          giftArticleId: g.giftArticleId ?? BigInt(0),
          giftArticleName: g.giftArticleName.trim(),
          quantity: BigInt(g.quantity),
        })),
    };

    setSavingVisit(true);
    try {
      await api.createCallReport(session.userId, {
        date: savedDetails.date,
        workType: savedDetails.workType,
        gps: reportGps,
        startLocation: savedDetails.startGps ?? reportGps,
        endLocation: savedDetails.endGps ?? NULL_GPS,
        remarks: savedDetails.remarks,
        doctorsVisited: [visitEntry],
        samplesDistributed: visitSamples,
        stationType: savedDetails.stationType,
        workingStation: savedDetails.workingStation || undefined,
        workingStationSource: (savedDetails.workingStationSource === "AsPerTP"
          ? "AsPerTP"
          : "OtherStation") as WorkingStationSource__1,
        workingMode:
          savedDetails.workingMode === "WorkingWith"
            ? WorkingMode.WorkingWith
            : WorkingMode.WorkingAlone,
        workingWithUserId: savedDetails.workingWithUserId ?? workingWithUserId,
        workingWithUserName:
          savedDetails.workingWithUserName ?? workingWithUserName,
      });

      // Add to pending display
      setPendingVisits((prev) => [
        ...prev,
        {
          ...visitEntry,
          _tempKey: `${Date.now()}-${Math.random()}`,
          notes: currentVisit.notes,
        },
      ]);
      const updated = await api.listMyCallReports(session.userId);
      setReports(updated);

      // SFA Phase 2: record sample usage against the call report
      const balanceRows = currentVisit.sampleBalance.filter(
        (r) =>
          r.productId !== null && r.quantity !== "" && Number(r.quantity) > 0,
      );
      if (balanceRows.length > 0) {
        const selectedDoctorId = currentVisit.doctorId!;
        const selectedDoctorName =
          doctors.find((d) => d.id === selectedDoctorId)?.name ?? "";
        const newReport = updated.find((r) => r.date === savedDetails.date);
        if (newReport) {
          const usages = balanceRows.map((r) => {
            const bal = sampleBalances.find((b) => b.productId === r.productId);
            return {
              doctorId: selectedDoctorId,
              productId: r.productId!,
              productName: bal?.productName ?? "",
              qtyUsed: BigInt(r.quantity),
              doctorName: selectedDoctorName,
            };
          });
          api
            .recordSamplesUsed(session.token, newReport.id, usages)
            .catch(() => {
              // Non-blocking: log error but don't fail the visit save
              console.warn("[SFA] recordSamplesUsed failed silently");
            });
        }
        // Refresh balance state to reflect the used quantities
        const now = new Date();
        api
          .getMyBalance(session.token, now.getMonth() + 1, now.getFullYear())
          .then((views) => {
            setSampleBalances(
              views.map((v) => ({
                productId: v.productId,
                productName: v.productName,
                productCode: v.productCode,
                allocatedQty: Number(v.allocatedQty),
                usedQty: Number(v.usedQty),
                remainingQty: Number(v.remainingQty),
              })),
            );
          })
          .catch(() => {});
      }

      setCurrentVisit(newVisitRow());
      toast.success("Doctor visit saved successfully");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isSessionError(msg))
        toast.error("Your session has expired. Please log in again.");
      else toast.error("Failed to save visit. Please try again.");
    } finally {
      setSavingVisit(false);
    }
  }

  async function handleFinalSubmit() {
    if (!session) {
      toast.error("Your session has expired.");
      return;
    }
    if (!savedDetails) {
      toast.error("Please save Report Details first.");
      return;
    }
    const todayReport = reports.find((r) => r.date === today);
    if (!todayReport) {
      toast.error(
        "No report found for today. Please save Report Details first.",
      );
      return;
    }
    if (todayReport.doctorsVisited.length === 0 && pendingVisits.length === 0) {
      toast.error("Please add at least one doctor visit before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.submitCallReport(session.token, todayReport.id);
      if (res.__kind__ === "err") {
        const errMsg = res.err as string;
        if (isSessionError(errMsg))
          toast.error(
            "Your session has expired. Please log in again to submit.",
          );
        else toast.error(`Submit failed: ${errMsg}`);
        return;
      }
      toast.success("Report submitted successfully");
      const updated = await api.listMyCallReports(session.userId);
      setReports(updated);
      setMainTab("list");
      resetForm();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isSessionError(msg))
        toast.error("Your session has expired. Please log in again to submit.");
      else toast.error("Failed to submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setDate(today);
    setWorkType(WorkType.Field);
    setStationType("HQ Day");
    setStartGps(null);
    setEndGps(null);
    setRemarks("");
    setWorkingStationSource("OtherStation");
    setWorkingStation("");
    setTpStationError(null);
    setWorkingMode("WorkingAlone");
    setSelectedAuthorityId("");
    setSavedDetails(null);
    setDetailsBannerMsg(null);
    setCurrentVisit(newVisitRow());
    setPendingVisits([]);
    setShowGpsError(false);
    setFormTab("report-details");
  }

  const reportCols = [
    { key: "date", label: "Date" },
    { key: "type", label: "Work Type" },
    { key: "station", label: "Station" },
    { key: "location", label: "Location" },
    { key: "doctors", label: "Doctors" },
    { key: "da", label: "DA (Rs)" },
    { key: "status", label: "Status" },
  ];

  const todayReportsForDisplay = reports.filter((r) => r.date === today);

  return (
    <PortalLayout portalRole={Role.MR}>
      <PageHeader
        title="Doctor Call Report (DCR)"
        subtitle="Log daily field activities, doctor calls, and DCR submission"
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={mainTab === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setMainTab("list");
                setSelectedReport(null);
              }}
              data-ocid="tab-list"
            >
              My Reports
            </Button>
            <Button
              variant={mainTab === "detail" ? "default" : "outline"}
              size="sm"
              onClick={() => setMainTab("detail")}
              data-ocid="tab-detail"
            >
              30-Day Detail
            </Button>
          </div>
        }
      />
      <PageContent>
        {/* LIST VIEW */}
        {mainTab === "list" && !selectedReport && (
          <DataTable
            columns={reportCols}
            data={reports}
            getKey={(r) => r.id.toString()}
            loading={loadingList}
            emptyMessage="No reports yet. Create your first Doctor Call Report (DCR)."
            renderRow={(r) => (
              <>
                <td className="px-4 py-3 font-mono text-xs">{r.date}</td>
                <td className="px-4 py-3 text-xs">{r.workType}</td>
                <td className="px-4 py-3 text-xs">
                  {r.stationType ? (
                    <Badge variant="outline" className="text-[11px]">
                      {r.stationType}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs">
                  {r.startLocation && r.startLocation.lat !== 0 ? (
                    <MapLink
                      lat={r.startLocation.lat}
                      lng={r.startLocation.lng}
                    />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs">{r.doctorsVisited.length}</td>
                <td className="px-4 py-3 text-xs font-mono font-medium text-accent">
                  {r.daAmount ? `Rs ${r.daAmount.toString()}` : "—"}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setSelectedReport(r)}
                    className={`inline-block px-2 py-0.5 rounded text-xs font-display uppercase tracking-wide cursor-pointer hover:opacity-80 transition-opacity ${STATUS_COLORS[r.status] ?? ""}`}
                    data-ocid={`report-row-${r.id}`}
                  >
                    {r.status}
                  </button>
                </td>
              </>
            )}
          />
        )}

        {mainTab === "list" && selectedReport && (
          <div className="space-y-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedReport(null)}
              className="gap-1.5"
            >
              ← Back to Reports
            </Button>
            <ReportDetailCard
              report={selectedReport}
              doctors={doctors}
              products={products}
            />
          </div>
        )}

        {mainTab === "detail" && <ThirtyDayDetail session={session} />}

        {/* NEW REPORT FORM — Two-Tab Layout */}
        {mainTab === "new" && (
          <div className="max-w-2xl space-y-4">
            {/* GPS Status */}
            <GpsStatusBar
              coords={gpsCoords}
              error={gpsError}
              locationNote={gpsNote}
              onRefresh={refreshGps}
              loading={gpsLoading}
            />
            {showGpsError && !gpsCoords && isGpsRequired() && (
              <GpsRequiredBanner />
            )}

            {/* Tab Switcher */}
            <div
              className="flex bg-muted/40 border border-border rounded-lg p-1 gap-1"
              role="tablist"
              aria-label="Report form tabs"
            >
              <button
                type="button"
                role="tab"
                aria-selected={formTab === "report-details"}
                onClick={() => setFormTab("report-details")}
                data-ocid="form-tab-report-details"
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium transition-all ${formTab === "report-details" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${savedDetails ? "bg-accent text-accent-foreground" : "bg-muted-foreground/20 text-muted-foreground"}`}
                >
                  {savedDetails ? <Check className="w-3 h-3" /> : "1"}
                </span>
                <span className="truncate">Report Details</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={formTab === "doctor-call"}
                onClick={() => {
                  if (!savedDetails) {
                    toast.error(
                      "Save Report Details first before adding doctor visits.",
                    );
                    return;
                  }
                  setFormTab("doctor-call");
                }}
                data-ocid="form-tab-doctor-call"
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium transition-all ${formTab === "doctor-call" ? "bg-card shadow-sm text-foreground" : savedDetails ? "text-muted-foreground hover:text-foreground" : "text-muted-foreground/50 cursor-not-allowed"}`}
              >
                <span className="truncate">Doctor Call</span>
                {todayVisitCount > 0 && (
                  <span
                    className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold"
                    data-ocid="doctor-call-count-badge"
                  >
                    {todayVisitCount}
                  </span>
                )}
              </button>
            </div>

            {/* ── TAB 1: Report Details ─────────────────────────────────── */}
            {formTab === "report-details" && (
              <div className="bg-card border border-border rounded-lg p-4 md:p-5 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="font-display font-semibold text-base text-foreground">
                      Report Details
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Fill once per day. Auto-loads if already saved for today.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ScrollToBottom label="Jump to bottom" />
                    <GpsBadge
                      coords={gpsCoords}
                      onRefresh={refreshGps}
                      loading={gpsLoading}
                    />
                  </div>
                </div>

                {detailsBannerMsg && (
                  <div className="flex items-start gap-2 p-3 bg-primary/5 border border-primary/20 rounded-md">
                    <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-xs text-primary">{detailsBannerMsg}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="form-group">
                    <Label htmlFor="rpt-date" className="form-label">
                      Date
                    </Label>
                    <Input
                      id="rpt-date"
                      type="date"
                      value={date}
                      max={today}
                      onChange={(e) => setDate(e.target.value)}
                      data-ocid="report-date"
                    />
                  </div>
                  <div className="form-group">
                    <Label htmlFor="rpt-type" className="form-label">
                      Work Type
                    </Label>
                    <Select
                      value={workType}
                      onValueChange={(v) => setWorkType(v as WorkType)}
                    >
                      <SelectTrigger id="rpt-type" data-ocid="report-work-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(WorkType).map((wt) => (
                          <SelectItem key={wt} value={wt}>
                            {wt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="form-group">
                  <Label htmlFor="rpt-station" className="form-label">
                    Station Type <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={stationType}
                    onValueChange={(v) => setStationType(v as StationType)}
                  >
                    <SelectTrigger
                      id="rpt-station"
                      data-ocid="report-station-type"
                    >
                      <SelectValue placeholder="Select station type" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATION_TYPES.map((st) => (
                        <SelectItem key={st} value={st}>
                          {st}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2 mt-1.5 px-1">
                    <span className="text-[11px] text-muted-foreground">
                      DA for today ({stationType}):
                    </span>
                    <span className="text-xs font-bold text-accent font-mono">
                      Rs {daAmount}
                    </span>
                  </div>
                </div>

                <div className="form-group">
                  <Label
                    htmlFor="rpt-working-station-src"
                    className="form-label"
                  >
                    Working Station <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={workingStationSource}
                    onValueChange={(v) => {
                      setWorkingStationSource(v as "AsPerTP" | "OtherStation");
                      setWorkingStation("");
                      setTpStationError(null);
                    }}
                  >
                    <SelectTrigger
                      id="rpt-working-station-src"
                      data-ocid="report-working-station-source"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AsPerTP">
                        As per TP (Travel Plan)
                      </SelectItem>
                      <SelectItem value="OtherStation">
                        Other Station
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {workingStationSource === "AsPerTP" && (
                    <div className="mt-1.5">
                      {tpStationLoading ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            Fetching from travel plan...
                          </span>
                        </div>
                      ) : workingStation ? (
                        <div className="flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5 text-accent" />
                          <span className="text-sm font-medium">
                            {workingStation}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            (from TP)
                          </span>
                        </div>
                      ) : tpStationError ? (
                        <p className="text-xs text-destructive">
                          {tpStationError}
                        </p>
                      ) : null}
                    </div>
                  )}
                  {workingStationSource === "OtherStation" && (
                    <Input
                      placeholder="Enter station / location name"
                      value={workingStation}
                      onChange={(e) => setWorkingStation(e.target.value)}
                      data-ocid="report-working-station-manual"
                      className="mt-1.5"
                    />
                  )}
                </div>

                <div className="form-group">
                  <Label htmlFor="rpt-working-mode" className="form-label">
                    Working Mode
                  </Label>
                  <Select
                    value={workingMode}
                    onValueChange={(v) => {
                      setWorkingMode(v as "WorkingAlone" | "WorkingWith");
                      setSelectedAuthorityId("");
                    }}
                  >
                    <SelectTrigger
                      id="rpt-working-mode"
                      data-ocid="report-working-mode"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WorkingAlone">
                        Working Alone (Individual)
                      </SelectItem>
                      <SelectItem value="WorkingWith">
                        Joint Field Work (JFW)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {workingMode === "WorkingWith" && (
                    <div className="mt-1.5">
                      {authoritiesLoading ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            Loading authorities...
                          </span>
                        </div>
                      ) : higherAuthorities.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No higher authorities found.
                        </p>
                      ) : (
                        <div className="form-group">
                          <Label
                            htmlFor="rpt-authority"
                            className="text-xs text-muted-foreground flex items-center gap-1"
                          >
                            <Users className="w-3.5 h-3.5" />
                            Select person you worked with
                          </Label>
                          <Select
                            value={selectedAuthorityId}
                            onValueChange={setSelectedAuthorityId}
                          >
                            <SelectTrigger
                              id="rpt-authority"
                              data-ocid="report-working-with-authority"
                            >
                              <SelectValue placeholder="Select authority" />
                            </SelectTrigger>
                            <SelectContent>
                              {higherAuthorities.map((a) => (
                                <SelectItem
                                  key={a.userId.toString()}
                                  value={a.userId.toString()}
                                >
                                  {a.userName} — {a.role}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <Label className="form-label">Location Points</Label>
                  <div className="space-y-2">
                    <ManualGpsButton
                      label="Start Location"
                      value={startGps}
                      onChange={setStartGps}
                    />
                    <ManualGpsButton
                      label="End Location"
                      value={endGps}
                      onChange={setEndGps}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <Label htmlFor="rpt-remarks" className="form-label">
                    Remarks
                  </Label>
                  <textarea
                    id="rpt-remarks"
                    className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm font-body resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    rows={2}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    data-ocid="report-remarks"
                  />
                </div>

                <div className="flex flex-wrap gap-3 pt-1">
                  <Button
                    onClick={handleSaveDetails}
                    disabled={savingDetails || (isGpsRequired() && !gpsCoords)}
                    data-ocid="save-report-details"
                    className="gap-2"
                  >
                    {savingDetails ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    {savedDetails
                      ? "Update Report Details"
                      : "Save & Continue to Doctor Call"}
                  </Button>
                  {savedDetails && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setFormTab("doctor-call")}
                      data-ocid="go-to-doctor-call"
                    >
                      Go to Doctor Call →
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setMainTab("list");
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                </div>
                {isGpsRequired() && !gpsCoords && (
                  <p className="text-xs text-orange-600">
                    GPS location required to save report details.
                  </p>
                )}
              </div>
            )}

            {/* ── TAB 2: Doctor Call ──────────────────────────────────────── */}
            {formTab === "doctor-call" && (
              <div className="space-y-4">
                {/* Summary banner */}
                {savedDetails && (
                  <div className="flex items-start gap-3 p-3 bg-accent/5 border border-accent/20 rounded-lg">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-accent uppercase tracking-wide mb-1">
                        Today's Report — {savedDetails.date}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                        <span>
                          Station:{" "}
                          <span className="text-foreground font-medium">
                            {savedDetails.stationType}
                          </span>
                        </span>
                        <span>
                          DA:{" "}
                          <span className="text-accent font-mono font-bold">
                            Rs {savedDetails.daAmount}
                          </span>
                        </span>
                        {savedDetails.workingStation && (
                          <span>
                            Working:{" "}
                            <span className="text-foreground">
                              {savedDetails.workingStation}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormTab("report-details")}
                      className="text-xs text-primary hover:underline shrink-0"
                    >
                      Edit
                    </button>
                  </div>
                )}

                {/* Saved visits from backend (today) */}
                {todayReportsForDisplay.length > 0 &&
                  todayReportsForDisplay.some(
                    (r) => r.doctorsVisited.length > 0,
                  ) && (
                    <div className="bg-card border border-border rounded-lg overflow-hidden">
                      <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center justify-between">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Visits Recorded Today
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {todayReportsForDisplay.reduce(
                            (n, r) => n + r.doctorsVisited.length,
                            0,
                          )}{" "}
                          visits
                        </Badge>
                      </div>
                      <div className="divide-y divide-border/40">
                        {todayReportsForDisplay.flatMap((r) =>
                          r.doctorsVisited.map((dv, di) => {
                            const doc = doctors.find(
                              (d) => d.id === dv.doctorId,
                            );
                            const prods = dv.productIds
                              .map(
                                (pid) =>
                                  products.find((p) => p.id === pid)?.name,
                              )
                              .filter(Boolean)
                              .join(", ");
                            return (
                              <div
                                key={`today-dv-${r.id}-${di}`}
                                className="px-4 py-3 flex items-start gap-3"
                                data-ocid={`today-visit-${r.id}-${di}`}
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {doc?.name ?? `Doctor #${dv.doctorId}`}
                                  </p>
                                  {prods && (
                                    <p className="text-xs text-muted-foreground truncate">
                                      {prods}
                                    </p>
                                  )}
                                </div>
                                <Badge
                                  variant="outline"
                                  className="text-[10px] py-0 shrink-0"
                                >
                                  {r.status}
                                </Badge>
                              </div>
                            );
                          }),
                        )}
                      </div>
                    </div>
                  )}

                {/* Pending visits (added this session, not yet submitted) */}
                {pendingVisits.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
                      Added This Session ({pendingVisits.length})
                    </p>
                    {pendingVisits.map((v) => (
                      <SavedVisitCard
                        key={v._tempKey}
                        entry={v}
                        doctors={doctors}
                        products={products}
                        onDelete={() =>
                          setPendingVisits((prev) =>
                            prev.filter((pv) => pv._tempKey !== v._tempKey),
                          )
                        }
                      />
                    ))}
                  </div>
                )}

                {/* New Visit Form */}
                {!savedDetails ? (
                  <div className="p-4 bg-muted/20 border border-border/60 rounded-lg text-center space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Save Report Details first to add doctor visits.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFormTab("report-details")}
                    >
                      ← Go to Report Details
                    </Button>
                  </div>
                ) : (
                  <DoctorVisitForm
                    visit={currentVisit}
                    index={0}
                    doctors={doctors}
                    products={products}
                    sampleBalances={sampleBalances}
                    balancesLoading={balancesLoading}
                    onUpdate={setCurrentVisit}
                    onRemove={() => setCurrentVisit(newVisitRow())}
                    onSave={handleSaveVisit}
                    saving={savingVisit}
                    canRemove={false}
                    mrUserId={session?.userId}
                  />
                )}

                {/* Submit / Cancel */}
                {savedDetails && (
                  <div className="flex flex-wrap gap-3 pt-2">
                    <Button
                      onClick={handleFinalSubmit}
                      disabled={
                        submitting ||
                        (isGpsRequired() && !gpsCoords) ||
                        (todayReportsForDisplay.reduce(
                          (n, r) => n + r.doctorsVisited.length,
                          0,
                        ) === 0 &&
                          pendingVisits.length === 0)
                      }
                      data-ocid="submit-report"
                      className="gap-2"
                    >
                      {submitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : null}
                      Submit Report
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setMainTab("list");
                        resetForm();
                      }}
                      disabled={submitting}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </PageContent>
    </PortalLayout>
  );
}
