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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Gift,
  Loader2,
  MapPin,
  Navigation,
  Package,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Stethoscope,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { WorkType, WorkingMode, WorkingStationSource } from "../../backend";
import type { WorkingStationSource__1 } from "../../backend.d";
import ScrollToBottom from "../../components/ScrollToBottom";
import { useConnectivity } from "../../hooks/useConnectivity";
import {
  GPS_ACCURACY_THRESHOLD_M,
  GPS_ACCURACY_WEAK_MAX_M,
  computeAccuracyStatus,
  getGpsCoords,
  isGpsRequired,
  isMobileDevice,
  useGps,
  useGpsStore,
} from "../../hooks/useGps";
import type { GpsAccuracyStatus } from "../../hooks/useGps";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import {
  addOfflineDcrRecord,
  useOfflineDcrQueue,
} from "../../store/offlineDcrQueue";
import type {
  CallReportInfo,
  DoctorInfo,
  GiftArticleDistributedV2,
  GiftArticleInfo,
  GpsCoord,
  ProductId,
  ProductInfo,
  SampleDistributed,
  StationRecord,
} from "../../types";
import { useAttachmentMailto } from "../../utils/attachmentMailto";
import { formatDate } from "../../utils/dateFormatter";

// ── Visit history cache (module-level) ───────────────────────────────────────
const modalVisitHistoryCache = new Map<string, CallReportInfo[]>();

// ── Per-station doctor cache (module-level) ──────────────────────────────────
const stationDoctorCache = new Map<string, DoctorInfo[]>();

// ── Auto-station resolution type ─────────────────────────────────────────────
type AutoStationSource =
  | { kind: "additional"; stationName: string }
  | { kind: "travelPlan"; stationName: string }
  | { kind: "manual" };

// ── Types ────────────────────────────────────────────────────────────────────
interface SampleRow {
  productId: bigint | null;
  quantity: string;
}

interface GiftRow {
  giftArticleId: bigint | null;
  giftArticleName: string;
  quantity: string;
}

interface VisitState {
  doctorId: bigint | null;
  // Track which station the selected doctor belongs to (for DCR station tagging)
  selectedDoctorStation: string;
  notes: string;
  productIds: bigint[];
  productDetails: Map<string, string>;
  samplesEnabled: boolean;
  samples: SampleRow[];
  giftsEnabled: boolean;
  giftArticles: GiftRow[];
  visitHistory: CallReportInfo[] | null;
  loadingHistory: boolean;
  historyExpanded: boolean;
}

const NULL_GPS: GpsCoord = { lat: 0, lng: 0, timestamp: BigInt(0) };

function newVisit(): VisitState {
  return {
    doctorId: null,
    selectedDoctorStation: "",
    notes: "",
    productIds: [],
    productDetails: new Map(),
    samplesEnabled: false,
    samples: [{ productId: null, quantity: "" }],
    giftsEnabled: false,
    giftArticles: [{ giftArticleId: null, giftArticleName: "", quantity: "" }],
    visitHistory: null,
    loadingHistory: false,
    historyExpanded: true,
  };
}

function safeArray<T>(val: unknown): T[] {
  if (Array.isArray(val)) return val as T[];
  return [];
}

function daysSince(dateStr: string): number {
  const visitDate = new Date(`${dateStr}T00:00:00`);
  return Math.floor((Date.now() - visitDate.getTime()) / (1000 * 60 * 60 * 24));
}

function formatShortDate(dateStr: string): string {
  return formatDate(dateStr);
}

type LastVisitState = "loading" | "error" | string | null;

function LastVisitedBadge({ state }: { state: LastVisitState | undefined }) {
  if (state === undefined || state === "loading") {
    return (
      <span className="inline-block h-4 w-20 rounded-full bg-muted animate-pulse" />
    );
  }
  if (state === "error") {
    return (
      <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/40 font-medium">
        —
      </span>
    );
  }
  if (state === null) {
    return (
      <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground border border-border/40 font-medium">
        Never visited
      </span>
    );
  }
  const days = daysSince(state);
  if (days <= 0) {
    return (
      <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200 font-semibold">
        Visited today
      </span>
    );
  }
  if (days <= 7) {
    return (
      <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200 font-semibold">
        {days}d ago
      </span>
    );
  }
  if (days <= 19) {
    return (
      <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 font-semibold">
        {days}d ago
      </span>
    );
  }
  return (
    <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 font-semibold">
      Overdue · {formatShortDate(state)}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const cat = (category || "").toUpperCase();
  const cls =
    cat === "A"
      ? "bg-green-100 text-green-700 border-green-200"
      : cat === "B"
        ? "bg-blue-100 text-blue-700 border-blue-200"
        : cat === "C"
          ? "bg-orange-100 text-orange-700 border-orange-200"
          : "bg-muted text-muted-foreground border-border";
  if (!category) return null;
  return (
    <span
      className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded border ${cls}`}
    >
      {category}
    </span>
  );
}

function StationSourceBadge({ source }: { source: AutoStationSource }) {
  if (source.kind === "manual") return null;
  const isAdditional = source.kind === "additional";
  return (
    <div
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border ${
        isAdditional
          ? "bg-purple-50 text-purple-700 border-purple-200"
          : "bg-blue-50 text-blue-700 border-blue-200"
      }`}
      data-ocid="doctor-call-station-source-badge"
    >
      <Navigation className="w-3.5 h-3.5 shrink-0" />
      <span>
        Showing doctors for:{" "}
        <span className="font-semibold">{source.stationName}</span>{" "}
        <span className="opacity-70">
          ({isAdditional ? "from Additional Station" : "from Travel Plan"})
        </span>
      </span>
    </div>
  );
}

// ── GPS Status Bar ────────────────────────────────────────────────────────────
function GpsStatusBar({
  status,
  accuracy,
  onRetry,
  loading,
}: {
  status: GpsAccuracyStatus;
  accuracy: number | null;
  onRetry: () => void;
  loading: boolean;
}) {
  if (status === "fetching") {
    return (
      <div
        className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium"
        data-ocid="doctor-call-gps-status-fetching"
      >
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        <span>Fetching your location…</span>
      </div>
    );
  }
  if (status === "verified") {
    return (
      <div
        className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-green-50 border border-green-200 text-green-700 text-xs font-medium"
        data-ocid="doctor-call-gps-status-verified"
      >
        <Check className="w-4 h-4 shrink-0" />
        <span>
          Location captured
          {accuracy != null ? ` (±${Math.round(accuracy)}m accuracy)` : ""}
        </span>
      </div>
    );
  }
  if (status === "weak") {
    return (
      <div className="space-y-1.5" data-ocid="doctor-call-gps-status-weak">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            GPS Weak — accuracy ±{accuracy != null ? Math.round(accuracy) : "?"}
            m — may still submit
          </span>
        </div>
        <p className="text-xs text-amber-700 flex items-start gap-1.5 px-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          GPS accuracy is too low. Please move to an open area and wait for a
          better signal.
        </p>
      </div>
    );
  }
  if (status === "failed") {
    return (
      <div className="space-y-1.5" data-ocid="doctor-call-gps-status-failed">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs font-medium">
          <X className="w-4 h-4 shrink-0" />
          <span className="flex-1">
            GPS unavailable — Cannot submit without GPS
          </span>
          <button
            type="button"
            onClick={onRetry}
            disabled={loading}
            className="ml-1 opacity-70 hover:opacity-100"
            aria-label="Retry GPS"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
          </button>
        </div>
        <p className="text-xs text-destructive flex items-start gap-1.5 px-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          GPS accuracy is too low. Please move to an open area and wait for a
          better signal.
        </p>
      </div>
    );
  }
  // idle — never got coords yet
  return (
    <div
      className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-orange-50 border border-orange-200 text-orange-600 text-xs font-medium"
      data-ocid="doctor-call-gps-status-idle"
    >
      <MapPin className="w-4 h-4 shrink-0" />
      <span className="flex-1">GPS not detected</span>
      <button
        type="button"
        onClick={onRetry}
        disabled={loading}
        className="ml-1 opacity-70 hover:opacity-100"
        aria-label="Retry GPS"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
      </button>
    </div>
  );
}

// ── Location Permission Block (full-screen overlay inside modal) ──────────────
function LocationPermissionBlock({
  onRecheck,
  recheckActive,
}: {
  onRecheck: () => void;
  recheckActive: boolean;
}) {
  function openSettings() {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/i.test(ua)) {
      window.location.href = "app-settings:";
    } else {
      toast.info(
        "To enable location: Open your device Settings → Apps → your browser → Permissions → Location → Allow.",
        { duration: 10000 },
      );
    }
  }

  return (
    <div
      className="flex flex-col items-center justify-center gap-5 px-4 py-10 text-center"
      data-ocid="doctor-call-permission-block"
    >
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
        <MapPin className="w-8 h-8 text-destructive" />
      </div>
      <div className="space-y-2">
        <h3 className="text-base font-bold text-foreground">
          Location Permission Required
        </h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          Location permission is required to submit Doctor Calls. Please enable
          location access in your device settings.
        </p>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-xs">
        <Button
          type="button"
          onClick={openSettings}
          className="gap-2"
          data-ocid="doctor-call-open-settings-button"
        >
          <Settings className="w-4 h-4" />
          Open Device Settings
        </Button>
        <p className="text-xs text-muted-foreground">
          After enabling location, tap the button below to continue.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={onRecheck}
          disabled={recheckActive}
          className="gap-2"
          data-ocid="doctor-call-recheck-permission-button"
        >
          {recheckActive ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          I've enabled location — Continue
        </Button>
      </div>
      <p className="text-xs text-muted-foreground/70">
        If you're in a building with no GPS signal, contact your Admin to
        request a GPS override.
      </p>
    </div>
  );
}

// ── Visit History Panel ───────────────────────────────────────────────────────
function VisitHistoryPanel({
  history,
  loading,
  expanded,
  onToggle,
  products,
}: {
  history: CallReportInfo[] | null;
  loading: boolean;
  expanded: boolean;
  onToggle: () => void;
  products: ProductInfo[];
}) {
  return (
    <div className="border border-primary/20 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-primary/5 hover:bg-primary/10 transition-colors"
        data-ocid="doctor-call-history-toggle"
      >
        <span className="text-sm font-semibold text-primary">
          Previous Call Records
        </span>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-primary" />
        ) : (
          <ChevronDown className="w-4 h-4 text-primary" />
        )}
      </button>

      {expanded && (
        <div className="p-3 bg-background">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : !history || history.length === 0 ? (
            <p
              className="text-xs text-muted-foreground italic text-center py-2"
              data-ocid="doctor-call-no-history"
            >
              No previous call records found for this doctor.
            </p>
          ) : (
            <div className="space-y-3">
              {history.map((r, idx) => {
                const entry = r.doctorsVisited[0];
                const productNames = entry?.productIds?.length
                  ? entry.productIds
                      .map(
                        (pid) =>
                          products.find((p) => p.id === pid)?.name ?? `#${pid}`,
                      )
                      .join(", ")
                  : "—";
                const samplesText = r.samplesDistributed
                  .map((s) => {
                    const p = products.find((x) => x.id === s.productId);
                    return p ? `${p.name} ×${s.quantity}` : `×${s.quantity}`;
                  })
                  .join(", ");
                const giftsText = entry?.giftArticles
                  ?.map((g) => `${g.giftArticleName} ×${g.quantity}`)
                  .join(", ");
                return (
                  <div
                    key={r.id.toString()}
                    className="p-2.5 bg-muted/30 rounded-md text-xs space-y-1"
                    data-ocid={`doctor-call-history-item.${idx + 1}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold text-foreground">
                        {r.date}
                      </span>
                      <span className="text-muted-foreground text-[10px]">
                        Visit #{idx + 1}
                      </span>
                    </div>
                    <div className="text-muted-foreground">
                      <span className="font-medium text-foreground">
                        Products:{" "}
                      </span>
                      {productNames}
                    </div>
                    {samplesText && (
                      <div className="text-muted-foreground">
                        <span className="font-medium text-foreground">
                          Samples:{" "}
                        </span>
                        {samplesText}
                      </div>
                    )}
                    {giftsText && (
                      <div className="text-muted-foreground">
                        <span className="font-medium text-foreground">
                          Gifts:{" "}
                        </span>
                        {giftsText}
                      </div>
                    )}
                    {entry?.notes && (
                      <div className="text-muted-foreground">
                        <span className="font-medium text-foreground">
                          Notes:{" "}
                        </span>
                        {entry.notes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Scrollable Product List with inline details entry ────────────────────────
function ProductListWithDetails({
  products,
  selectedIds,
  productDetails,
  onToggle,
  onDetailChange,
}: {
  products: ProductInfo[];
  selectedIds: bigint[];
  productDetails: Map<string, string>;
  onToggle: (id: bigint) => void;
  onDetailChange: (id: bigint, text: string) => void;
}) {
  const active = products.filter((p) => p.isActive);
  return (
    <div
      className="border border-input rounded-md bg-background max-h-64 overflow-y-auto"
      data-ocid="doctor-call-product-list"
    >
      {active.length === 0 ? (
        <p className="px-3 py-4 text-xs text-muted-foreground italic text-center">
          No active products available.
        </p>
      ) : (
        active.map((p, idx) => {
          const isChecked = selectedIds.some((id) => id === p.id);
          const details = productDetails.get(p.id.toString()) ?? "";
          const checkId = `prod-check-${p.id}`;
          return (
            <div
              key={p.id.toString()}
              className={`border-b border-border/30 last:border-0 transition-colors ${isChecked ? "bg-primary/5" : "hover:bg-muted/20"}`}
              data-ocid={`doctor-call-product.item.${idx + 1}`}
            >
              <label
                htmlFor={checkId}
                className="flex items-start gap-3 px-3 py-2.5 cursor-pointer"
              >
                <Checkbox
                  id={checkId}
                  checked={isChecked}
                  onCheckedChange={() => onToggle(p.id)}
                  className="mt-0.5 shrink-0"
                  data-ocid={`doctor-call-product.checkbox.${idx + 1}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-sm font-medium ${isChecked ? "text-primary" : "text-foreground"}`}
                    >
                      {p.name}
                    </span>
                    {p.category && (
                      <span className="text-[10px] text-muted-foreground border border-border/60 rounded px-1.5">
                        {p.category}
                      </span>
                    )}
                  </div>
                  {p.description && (
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {p.description}
                    </p>
                  )}
                </div>
              </label>
              {isChecked && (
                <div className="px-3 pb-2.5">
                  <Textarea
                    placeholder="Enter details discussed about this product..."
                    value={details}
                    onChange={(e) => onDetailChange(p.id, e.target.value)}
                    rows={2}
                    className="text-xs resize-none"
                    data-ocid={`doctor-call-product.details.${idx + 1}`}
                  />
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// ── Gift Article Search & Select ─────────────────────────────────────────────
function GiftArticleSearch({
  giftArticles,
  onSelect,
}: {
  giftArticles: GiftArticleInfo[];
  onSelect: (article: GiftArticleInfo) => void;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return giftArticles.filter((g) => g.isActive);
    const q = search.toLowerCase();
    return giftArticles.filter(
      (g) => g.isActive && g.name.toLowerCase().includes(q),
    );
  }, [search, giftArticles]);

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search gift article..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className="pl-9 text-sm"
          data-ocid="doctor-call-gift-search"
        />
        {search && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setOpen(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-popover border border-border rounded-md shadow-md max-h-44 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground italic">
              No gift articles found.
            </p>
          ) : (
            filtered.map((g) => (
              <button
                key={g.id.toString()}
                type="button"
                className="w-full text-left flex items-center gap-2 px-3 py-2 hover:bg-muted/40 transition-colors"
                onClick={() => {
                  onSelect(g);
                  setSearch("");
                  setOpen(false);
                }}
              >
                <Gift className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <span className="text-sm text-foreground">{g.name}</span>
                  {g.category && (
                    <span className="ml-2 text-[10px] text-muted-foreground">
                      {g.category}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── GPS Accuracy Badge (for submitted call records) ───────────────────────────
export function GpsAccuracyBadge({
  category,
}: {
  category: "verified" | "weak" | "none" | string | undefined;
}) {
  if (!category || category === "none") {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border border-border/60">
        <MapPin className="w-2.5 h-2.5" />
        No GPS
      </span>
    );
  }
  if (category === "verified") {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700 border border-green-200">
        <Check className="w-2.5 h-2.5" />
        GPS Verified
      </span>
    );
  }
  // weak
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700 border border-amber-200">
      <AlertTriangle className="w-2.5 h-2.5" />
      GPS Weak
    </span>
  );
}

// ── Grouped doctor list section ───────────────────────────────────────────────
function DoctorListSection({
  label,
  accentClass,
  doctors,
  loading,
  selectedDoctorId,
  doctorSearch,
  lastVisitMap,
  onSelect,
  emptyMessage,
  dataOcidPrefix,
}: {
  label: string;
  accentClass: string;
  doctors: DoctorInfo[];
  loading: boolean;
  selectedDoctorId: bigint | null;
  doctorSearch: string;
  lastVisitMap: Map<string, LastVisitState>;
  onSelect: (doc: DoctorInfo, stationName: string) => void;
  emptyMessage: string;
  stationName: string;
  dataOcidPrefix: string;
}) {
  const filtered = useMemo(() => {
    if (!doctorSearch.trim()) return doctors;
    const q = doctorSearch.toLowerCase();
    return doctors.filter((d) => d.name.toLowerCase().includes(q));
  }, [doctors, doctorSearch]);

  return (
    <div>
      <div
        className={`px-3 py-1.5 text-[11px] font-semibold ${accentClass} rounded-t-md`}
      >
        {label}
      </div>
      <div className="border border-t-0 border-input rounded-b-md bg-background max-h-44 overflow-y-auto">
        {loading ? (
          <div className="p-3 space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-4 text-xs text-muted-foreground text-center italic">
            {doctors.length === 0
              ? emptyMessage
              : "No doctor found matching search"}
          </div>
        ) : (
          filtered.map((d, idx) => {
            const isSelected = selectedDoctorId === d.id;
            const lastVisitState = lastVisitMap.get(d.id.toString());
            return (
              <button
                key={d.id.toString()}
                type="button"
                onClick={() => onSelect(d, label)}
                data-ocid={`${dataOcidPrefix}.${idx + 1}`}
                className={`w-full text-left px-3 py-2.5 border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors ${
                  isSelected ? "bg-primary/10 border-l-2 border-l-primary" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-sm font-semibold ${isSelected ? "text-primary" : "text-foreground"}`}
                      >
                        {d.name}
                      </span>
                      <CategoryBadge category={d.category} />
                    </div>
                    {d.specialization && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {d.specialization}
                      </p>
                    )}
                    {d.clinicName && (
                      <p className="text-[11px] text-muted-foreground truncate">
                        {d.clinicName}
                      </p>
                    )}
                    <div className="mt-1">
                      <LastVisitedBadge state={lastVisitState} />
                    </div>
                  </div>
                  {isSelected && (
                    <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Main DoctorCallModal ──────────────────────────────────────────────────────
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export default function DoctorCallModal({ open, onOpenChange }: Props) {
  const session = useAuthStore((s) => s.session);
  const {
    coords: gpsCoords,
    permissionState,
    loading: gpsLoading,
    refreshGps,
  } = useGps();
  const { buildMailto } = useAttachmentMailto();
  const { isOnline } = useConnectivity();
  const refreshPendingCount = useOfflineDcrQueue((s) => s.refreshPendingCount);

  // ── GPS enforcement state ─────────────────────────────────────────────────
  const [gpsEnforcementEnabled, setGpsEnforcementEnabled] = useState<
    boolean | null
  >(null);
  const [gpsOverrideActive, setGpsOverrideActive] = useState<boolean>(false);

  // ── GPS accuracy status ───────────────────────────────────────────────────
  const [gpsStatus, setGpsStatus] = useState<GpsAccuracyStatus>("idle");
  const lastGpsCaptureRef = useRef<number | null>(null);
  const [waitingForGps, setWaitingForGps] = useState(false);
  const stalenessIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const permRecheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const [permRecheckActive, setPermRecheckActive] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  // ── Data loaded once on modal open ───────────────────────────────────────
  const [products, setProducts] = useState<ProductInfo[]>([]);
  const [giftArticles, setGiftArticles] = useState<GiftArticleInfo[]>([]);
  const [stationRecords, setStationRecords] = useState<StationRecord[]>([]);
  const [hqNameMap, setHqNameMap] = useState<Map<string, string>>(new Map());
  const [dataLoaded, setDataLoaded] = useState(false);
  const [stationsLoading, setStationsLoading] = useState(false);
  const [stationsLoadError, setStationsLoadError] = useState(false);

  // MTP settings (unused after V81 rollback)
  const [_mtpSettings] = useState<Record<string, unknown> | null>(null);

  // Primary station and doctors
  const [selectedStation, setSelectedStation] = useState<string>("all");
  const [stationDoctors, setStationDoctors] = useState<DoctorInfo[]>([]);
  const [stationDoctorsLoading, setStationDoctorsLoading] = useState(false);
  const [doctorSearch, setDoctorSearch] = useState("");

  // MTP additional station doctors (Part C)
  const [mtpAdditionalStations, setMtpAdditionalStations] = useState<string[]>(
    [],
  );
  // Map: stationName -> { doctors, loading }
  const [additionalStationDoctors, setAdditionalStationDoctors] = useState<
    Map<string, { doctors: DoctorInfo[]; loading: boolean }>
  >(new Map());

  // "Select Other Station" on-the-spot (Part D)
  const [availableStations, _setAvailableStations] = useState<StationRecord[]>(
    [],
  );
  const [otherStationSelected, setOtherStationSelected] = useState<string>("");
  const [otherStationDoctors, setOtherStationDoctors] = useState<DoctorInfo[]>(
    [],
  );
  const [otherStationLoading, setOtherStationLoading] = useState(false);

  const [lastVisitMap, setLastVisitMap] = useState<Map<string, LastVisitState>>(
    new Map(),
  );

  const [visit, setVisit] = useState<VisitState>(newVisit());
  const [saving, setSaving] = useState(false);

  const [autoStationSource, setAutoStationSource] = useState<AutoStationSource>(
    { kind: "manual" },
  );
  const [autoStationResolving, setAutoStationResolving] = useState(false);

  // ── Helper: load doctors for a station with last-visit tracking ───────────
  const loadDoctorsForStation = useCallback(
    async (stationName: string): Promise<DoctorInfo[]> => {
      if (!session) return [];
      // Use module-level cache
      if (stationDoctorCache.has(stationName)) {
        return stationDoctorCache.get(stationName)!;
      }
      const result = await api.getDoctorsForStation(
        session.token,
        session.userId,
        stationName,
      );
      const doctors = result.__kind__ === "ok" ? result.ok : [];
      stationDoctorCache.set(stationName, doctors);
      // Prime last-visit map for new doctors
      setLastVisitMap((prev) => {
        const next = new Map(prev);
        for (const doc of doctors) {
          const key = doc.id.toString();
          if (!next.has(key)) next.set(key, "loading");
        }
        return next;
      });
      Promise.allSettled(
        doctors.map(async (doc) => {
          const key = doc.id.toString();
          const cached = modalVisitHistoryCache.get(key);
          let lastDate: string | null = null;
          if (cached !== undefined) {
            lastDate = cached.length > 0 ? cached[0].date : null;
          } else {
            const raw = await api.getDoctorVisitHistory(doc.id, BigInt(1));
            const history = safeArray<CallReportInfo>(raw);
            modalVisitHistoryCache.set(key, history);
            lastDate = history.length > 0 ? history[0].date : null;
          }
          return { key, lastDate };
        }),
      ).then((results) => {
        setLastVisitMap((prev) => {
          const next = new Map(prev);
          for (const r of results) {
            if (r.status === "fulfilled")
              next.set(r.value.key, r.value.lastDate);
          }
          for (const doc of doctors) {
            const key = doc.id.toString();
            if (next.get(key) === "loading") next.set(key, "error");
          }
          return next;
        });
      });
      return doctors;
    },
    [session],
  );

  // ── Derive GPS status whenever coords change ──────────────────────────────
  useEffect(() => {
    if (gpsLoading && !gpsCoords) {
      setGpsStatus("fetching");
      return;
    }
    if (!gpsCoords) {
      setGpsStatus("idle");
      return;
    }
    const accStatus = computeAccuracyStatus(gpsCoords.accuracy);
    if (accStatus === "verified") setGpsStatus("verified");
    else if (accStatus === "weak") setGpsStatus("weak");
    else setGpsStatus("failed");
    lastGpsCaptureRef.current = Date.now();
  }, [gpsCoords, gpsLoading]);

  useEffect(() => {
    if (gpsLoading) setGpsStatus("fetching");
  }, [gpsLoading]);

  // ── Check GPS enforcement + override when modal opens ────────────────────
  useEffect(() => {
    if (!open || !session) return;
    refreshGps();
    setGpsStatus("fetching");
    api.getGpsEnforcementEnabled(session.token).then((enabled) => {
      setGpsEnforcementEnabled(enabled);
    });
    api.checkGpsOverride(session.token, today).then((hasOverride) => {
      setGpsOverrideActive(hasOverride);
    });
  }, [open, session, refreshGps, today]);

  // ── Staleness re-fetch timer ──────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      if (stalenessIntervalRef.current) {
        clearInterval(stalenessIntervalRef.current);
        stalenessIntervalRef.current = null;
      }
      return;
    }
    stalenessIntervalRef.current = setInterval(() => {
      const lastCapture = lastGpsCaptureRef.current;
      if (
        lastCapture !== null &&
        Date.now() - lastCapture > STALE_THRESHOLD_MS
      ) {
        setGpsStatus("fetching");
        lastGpsCaptureRef.current = null;
        refreshGps();
      }
    }, 30_000);
    return () => {
      if (stalenessIntervalRef.current) {
        clearInterval(stalenessIntervalRef.current);
        stalenessIntervalRef.current = null;
      }
    };
  }, [open, refreshGps]);

  // ── Permission re-check interval ─────────────────────────────────────────
  useEffect(() => {
    const isDeniedMobile = isMobileDevice() && permissionState === "denied";
    if (isDeniedMobile && open) {
      permRecheckIntervalRef.current = setInterval(() => {
        if ("permissions" in navigator) {
          navigator.permissions
            .query({ name: "geolocation" as PermissionName })
            .then((res) => {
              if (res.state !== "denied") refreshGps();
            })
            .catch(() => {});
        }
      }, 5000);
    } else {
      if (permRecheckIntervalRef.current) {
        clearInterval(permRecheckIntervalRef.current);
        permRecheckIntervalRef.current = null;
      }
    }
    return () => {
      if (permRecheckIntervalRef.current) {
        clearInterval(permRecheckIntervalRef.current);
        permRecheckIntervalRef.current = null;
      }
    };
  }, [permissionState, open, refreshGps]);

  // ── Load data once on open ───────────────────────────────────────────────
  useEffect(() => {
    if (!open || dataLoaded || !session) return;
    setStationsLoading(true);
    setStationsLoadError(false);
    Promise.all([
      api.listProducts(),
      api.getStationsByMRHqAssignments(session.token, session.userId),
      api.getAllActiveHQs(session.token),
      api.listGiftArticles(session.token),
    ])
      .then(async ([p, records, hqList, gifts]) => {
        setProducts(p);

        let resolvedRecords = records;

        // Fallback: if getStationsByMRHqAssignments returned nothing, try direct user profile lookup
        if (!resolvedRecords || resolvedRecords.length === 0) {
          try {
            const userInfo = await api
              .getUser(session.token, session.userId)
              .catch(() => null);
            const userTyped = userInfo as {
              primaryHqId?: bigint | number | null;
              hqAssignments?: { stationIds?: (bigint | number)[] }[];
            } | null;
            if (userTyped) {
              // Try primaryHqId first
              if (userTyped.primaryHqId != null) {
                const primaryHqId =
                  typeof userTyped.primaryHqId === "bigint"
                    ? userTyped.primaryHqId
                    : BigInt(userTyped.primaryHqId as number);
                const hqStations = await api
                  .listStationsByHQ(session.token, primaryHqId)
                  .catch(() => []);
                if (hqStations && hqStations.length > 0) {
                  resolvedRecords = hqStations;
                }
              }
              // Also try hqAssignments[].stationIds if still empty
              if (
                resolvedRecords.length === 0 &&
                userTyped.hqAssignments &&
                userTyped.hqAssignments.length > 0
              ) {
                const allHqStations = await Promise.all(
                  userTyped.hqAssignments.map((assignment) =>
                    Promise.all(
                      (assignment.stationIds ?? []).map((sid) => {
                        const stationId =
                          typeof sid === "bigint" ? sid : BigInt(sid as number);
                        return api
                          .listStationsByHQ(session.token, stationId)
                          .catch(() => []);
                      }),
                    ).then((results) => results.flat()),
                  ),
                ).then((results) => results.flat());
                if (allHqStations.length > 0) {
                  resolvedRecords = allHqStations;
                }
              }
            }
          } catch (e) {
            console.error(
              "[DoctorCallModal] Fallback station lookup failed:",
              e,
            );
          }
        }

        setStationRecords(resolvedRecords);
        const map = new Map<string, string>();
        for (const hq of hqList) map.set(String(hq.id), hq.name);
        setHqNameMap(map);
        setGiftArticles(
          Array.isArray(gifts) ? (gifts as GiftArticleInfo[]) : [],
        );
        setDataLoaded(true);
        setStationsLoading(false);
      })
      .catch((err) => {
        console.error("[DoctorCallModal] Failed to load data:", err);
        setStationsLoadError(true);
        setStationsLoading(false);
        toast.error("Could not load stations. Please close and try again.");
      });
  }, [open, dataLoaded, session]);

  // ── Reset form when modal closes ─────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      setVisit(newVisit());
      setSelectedStation("all");
      setDoctorSearch("");
      setStationDoctors([]);
      setLastVisitMap(new Map());
      setAutoStationSource({ kind: "manual" });
      setAutoStationResolving(false);
      setGpsStatus("idle");
      setGpsEnforcementEnabled(null);
      setGpsOverrideActive(false);
      setPermRecheckActive(false);
      setMtpAdditionalStations([]);
      setAdditionalStationDoctors(new Map());
      setOtherStationSelected("");
      setOtherStationDoctors([]);
      setOtherStationLoading(false);
    }
  }, [open]);

  // ── Auto-station resolution + MTP additional stations (Part C) ─────────
  useEffect(() => {
    if (!open || !session || !dataLoaded) return;

    setAutoStationResolving(true);
    setAutoStationSource({ kind: "manual" });

    const currentMonth = today.slice(0, 7);

    Promise.all([
      api.getTodayWorkingStyle(session.employeeId).catch(() => null),
      api.listMyTravelPlans(session.token, currentMonth).catch(() => []),
    ])
      .then(async ([wsRaw, tpRaw]) => {
        const ws = wsRaw as {
          stationSource?: string;
          otherStationName?: string;
          additionalArea?: string;
        } | null;
        const plans = tpRaw as {
          date: string;
          plannedStation: string;
          additionalStations: string[];
        }[];
        const todayPlan = plans.find((p) => p.date === today);

        // Part C: collect additional stations from today's MTP entry (V81 feature removed)
        const addlStations: string[] = [];
        setMtpAdditionalStations(addlStations);

        let resolved: AutoStationSource = { kind: "manual" };

        if (
          ws &&
          ws.stationSource === "OtherStation" &&
          ws.additionalArea?.trim()
        ) {
          resolved = {
            kind: "additional",
            stationName: ws.additionalArea.trim(),
          };
        } else if (todayPlan?.plannedStation) {
          resolved = {
            kind: "travelPlan",
            stationName: todayPlan.plannedStation,
          };
        }

        setAutoStationSource(resolved);

        // Load primary station doctors
        if (resolved.kind !== "manual") {
          setSelectedStation(resolved.stationName);
          setStationDoctors([]);
          setLastVisitMap(new Map());
          setStationDoctorsLoading(true);
          try {
            const doctors = await loadDoctorsForStation(resolved.stationName);
            setStationDoctors(doctors);
          } catch {
            // ignore
          } finally {
            setStationDoctorsLoading(false);
          }
        }

        // Load additional station doctors in parallel (Part C)
        if (addlStations.length > 0) {
          const initialMap = new Map<
            string,
            { doctors: DoctorInfo[]; loading: boolean }
          >();
          for (const stn of addlStations) {
            initialMap.set(stn, { doctors: [], loading: true });
          }
          setAdditionalStationDoctors(new Map(initialMap));

          for (const stn of addlStations) {
            loadDoctorsForStation(stn)
              .then((docs) => {
                setAdditionalStationDoctors((prev) => {
                  const next = new Map(prev);
                  next.set(stn, { doctors: docs, loading: false });
                  return next;
                });
              })
              .catch(() => {
                setAdditionalStationDoctors((prev) => {
                  const next = new Map(prev);
                  next.set(stn, { doctors: [], loading: false });
                  return next;
                });
              });
          }
        }
      })
      .catch(() => setAutoStationSource({ kind: "manual" }))
      .finally(() => setAutoStationResolving(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, session, dataLoaded, today, loadDoctorsForStation]);

  // Build grouped station list
  const stationGroups = useMemo(() => {
    if (stationRecords.length === 0) return [];
    const groupMap = new Map<
      bigint,
      { stationName: string; stationId: bigint }[]
    >();
    for (const rec of stationRecords) {
      const arr = groupMap.get(rec.hqId) ?? [];
      arr.push({ stationName: rec.stationName, stationId: rec.stationId });
      groupMap.set(rec.hqId, arr);
    }
    return Array.from(groupMap.entries()).map(([hqId, sts]) => ({
      hqId,
      stations: [...sts].sort((a, b) =>
        a.stationName.localeCompare(b.stationName),
      ),
    }));
  }, [stationRecords]);

  const allStationNames = useMemo(
    () => Array.from(new Set(stationRecords.map((r) => r.stationName))).sort(),
    [stationRecords],
  );

  // Available station names for "Select Other Station" dropdown
  const otherStationOptions = useMemo(() => {
    const names = Array.from(
      new Set(availableStations.map((r) => r.stationName)),
    ).sort();
    // Filter out already-visible stations to avoid duplication
    const shown = new Set([
      selectedStation !== "all" ? selectedStation : "",
      ...mtpAdditionalStations,
    ]);
    return names.filter((n) => !shown.has(n));
  }, [availableStations, selectedStation, mtpAdditionalStations]);

  async function handleStationChange(val: string) {
    setSelectedStation(val);
    setDoctorSearch("");
    setVisit((v) => ({
      ...v,
      doctorId: null,
      selectedDoctorStation: "",
      visitHistory: null,
      loadingHistory: false,
    }));
    setStationDoctors([]);
    if (val === "all" || !session) return;
    setStationDoctorsLoading(true);
    try {
      const doctors = await loadDoctorsForStation(val);
      setStationDoctors(doctors);
    } catch {
      toast.error("Could not load doctors for this station. Please try again.");
    } finally {
      setStationDoctorsLoading(false);
    }
  }

  // "Select Other Station" handler (Part D)
  async function handleOtherStationChange(val: string) {
    setOtherStationSelected(val);
    setOtherStationDoctors([]);
    if (!val || !session) return;
    setOtherStationLoading(true);
    try {
      const doctors = await loadDoctorsForStation(val);
      setOtherStationDoctors(doctors);
    } catch {
      toast.error("Could not load doctors for the selected station.");
    } finally {
      setOtherStationLoading(false);
    }
  }

  const filteredDoctors = useMemo(() => {
    const list = selectedStation === "all" ? [] : stationDoctors;
    if (!doctorSearch.trim()) return list;
    const q = doctorSearch.toLowerCase();
    return list.filter((d) => d.name.toLowerCase().includes(q));
  }, [stationDoctors, selectedStation, doctorSearch]);

  // Find the selected doctor across all sections
  const selectedDoctor = useMemo(() => {
    if (!visit.doctorId) return null;
    // Check primary, additional, and other station lists
    const allDoctors = [
      ...stationDoctors,
      ...Array.from(additionalStationDoctors.values()).flatMap(
        (v) => v.doctors,
      ),
      ...otherStationDoctors,
    ];
    return allDoctors.find((d) => d.id === visit.doctorId) ?? null;
  }, [
    visit.doctorId,
    stationDoctors,
    additionalStationDoctors,
    otherStationDoctors,
  ]);

  async function handleDoctorSelect(doc: DoctorInfo, stationName: string) {
    const isSelected = visit.doctorId === doc.id;
    if (isSelected) {
      setVisit((v) => ({
        ...v,
        doctorId: null,
        selectedDoctorStation: "",
        visitHistory: null,
      }));
      return;
    }
    const cacheKey = doc.id.toString();
    const cached = modalVisitHistoryCache.get(cacheKey);
    if (cached) {
      setVisit((v) => ({
        ...v,
        doctorId: doc.id,
        selectedDoctorStation: stationName,
        visitHistory: cached,
        loadingHistory: false,
        historyExpanded: true,
      }));
      return;
    }
    setVisit((v) => ({
      ...v,
      doctorId: doc.id,
      selectedDoctorStation: stationName,
      visitHistory: null,
      loadingHistory: true,
      historyExpanded: true,
    }));
    try {
      const history = await api.getDoctorVisitHistory(doc.id, BigInt(2));
      modalVisitHistoryCache.set(cacheKey, history);
      setVisit((v) => ({ ...v, visitHistory: history, loadingHistory: false }));
    } catch {
      toast.info("Visit history unavailable", { duration: 3000 });
      setVisit((v) => ({ ...v, visitHistory: [], loadingHistory: false }));
    }
  }

  function toggleProduct(id: bigint) {
    setVisit((v) => {
      const isSelected = v.productIds.some((p) => p === id);
      if (isSelected) {
        const newDetails = new Map(v.productDetails);
        newDetails.delete(id.toString());
        return {
          ...v,
          productIds: v.productIds.filter((p) => p !== id),
          productDetails: newDetails,
        };
      }
      return { ...v, productIds: [...v.productIds, id] };
    });
  }

  function setProductDetail(id: bigint, text: string) {
    setVisit((v) => {
      const newDetails = new Map(v.productDetails);
      newDetails.set(id.toString(), text);
      return { ...v, productDetails: newDetails };
    });
  }

  function addSampleRow() {
    setVisit((v) => ({
      ...v,
      samples: [...v.samples, { productId: null, quantity: "" }],
    }));
  }
  function removeSampleRow(idx: number) {
    setVisit((v) => ({ ...v, samples: v.samples.filter((_, i) => i !== idx) }));
  }
  function updateSampleProduct(idx: number, val: string) {
    setVisit((v) => ({
      ...v,
      samples: v.samples.map((s, i) =>
        i === idx
          ? { ...s, productId: val === "none" ? null : BigInt(val) }
          : s,
      ),
    }));
  }
  function updateSampleQty(idx: number, val: string) {
    setVisit((v) => ({
      ...v,
      samples: v.samples.map((s, i) =>
        i === idx ? { ...s, quantity: val } : s,
      ),
    }));
  }

  function addGiftRow() {
    setVisit((v) => ({
      ...v,
      giftArticles: [
        ...v.giftArticles,
        { giftArticleId: null, giftArticleName: "", quantity: "" },
      ],
    }));
  }
  function removeGiftRow(idx: number) {
    setVisit((v) => ({
      ...v,
      giftArticles: v.giftArticles.filter((_, i) => i !== idx),
    }));
  }
  function selectGiftForRow(idx: number, article: GiftArticleInfo) {
    setVisit((v) => ({
      ...v,
      giftArticles: v.giftArticles.map((g, i) =>
        i === idx
          ? { ...g, giftArticleId: article.id, giftArticleName: article.name }
          : g,
      ),
    }));
  }
  function updateGiftQty(idx: number, val: string) {
    setVisit((v) => ({
      ...v,
      giftArticles: v.giftArticles.map((g, i) =>
        i === idx ? { ...g, quantity: val } : g,
      ),
    }));
  }
  function clearGiftRow(idx: number) {
    setVisit((v) => ({
      ...v,
      giftArticles: v.giftArticles.map((g, i) =>
        i === idx ? { ...g, giftArticleId: null, giftArticleName: "" } : g,
      ),
    }));
  }

  // ── GPS submission gate logic ────────────────────────────────────────────
  const gpsBlocksSubmission =
    gpsEnforcementEnabled !== false &&
    !gpsOverrideActive &&
    gpsStatus !== "verified" &&
    gpsStatus !== "weak";

  const submitDisabled =
    saving ||
    waitingForGps ||
    !visit.doctorId ||
    visit.productIds.length === 0 ||
    gpsBlocksSubmission ||
    gpsStatus === "fetching";

  async function handleAttachment() {
    const doctorName = selectedDoctor?.name ?? visit.doctorId?.toString() ?? "";
    const userInfo = session
      ? await api.getUser(session.token, session.userId).catch(() => null)
      : null;
    const userTyped = userInfo as {
      designation?: string;
      hqAssignments?: { hqName?: string }[];
    } | null;
    const url = await buildMailto("doctorCallEntry", {
      employeeName: session?.name ?? "",
      name: session?.name ?? "",
      designation: userTyped?.designation ?? "",
      hq: userTyped?.hqAssignments?.[0]?.hqName ?? "",
      doctorName,
      date: formatDate(today),
    });
    window.location.href = url;
  }

  async function handleSave() {
    if (!session) {
      toast.error("Session expired. Please log in again.");
      return;
    }
    if (!visit.doctorId) {
      toast.error("Please select a doctor.");
      return;
    }
    if (visit.productIds.length === 0) {
      toast.error("Select at least one product discussed.");
      return;
    }

    if (visit.samplesEnabled) {
      const activeSamples = visit.samples.filter(
        (s) => s.productId !== null || s.quantity !== "",
      );
      for (const s of activeSamples) {
        if (!s.productId) {
          toast.error("Please select a product for each sample row.");
          return;
        }
        const qty = Number.parseInt(s.quantity, 10);
        if (!s.quantity || qty < 1) {
          toast.error("Quantity must be at least 1 for each sample.");
          return;
        }
      }
    }

    if (visit.giftsEnabled) {
      const activeGifts = visit.giftArticles.filter(
        (g) => g.giftArticleId !== null || g.quantity !== "",
      );
      for (const g of activeGifts) {
        if (!g.giftArticleId) {
          toast.error("Please select a gift article for each gift row.");
          return;
        }
        const qty = Number.parseInt(g.quantity, 10);
        if (!g.quantity || qty < 1) {
          toast.error("Quantity must be at least 1 for each gift.");
          return;
        }
      }
    }

    // ── Fresh pinpoint GPS capture at the exact moment of submission ──────
    setWaitingForGps(true);
    const freshCoords = await new Promise<{
      lat: number;
      lng: number;
      accuracy: number | null;
    } | null>((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy ?? null,
          });
        },
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      );
    });
    setWaitingForGps(false);

    // Update the shared GPS store so the accuracy badge re-renders
    if (freshCoords) {
      useGpsStore.getState().setCoords({
        lat: freshCoords.lat,
        lng: freshCoords.lng,
        accuracy: freshCoords.accuracy,
        timestamp: Date.now(),
      });
    }

    let resolvedLat: number | null = freshCoords?.lat ?? null;
    let resolvedLng: number | null = freshCoords?.lng ?? null;
    let resolvedAccuracy: number | null = freshCoords?.accuracy ?? null;
    const hasGps = resolvedLat !== null && resolvedLng !== null;

    if (gpsEnforcementEnabled !== false && !gpsOverrideActive) {
      if (!hasGps) {
        if (isGpsRequired()) {
          toast.error("GPS location is required to submit this Doctor Call.");
          return;
        }
        toast.warning(
          "Location could not be captured. Please ensure location permission is enabled.",
          { duration: 6000 },
        );
      } else {
        const accuracy = resolvedAccuracy;
        const accStatus = computeAccuracyStatus(accuracy);
        if (accStatus === "failed") {
          toast.error(
            `GPS accuracy is too low (±${accuracy != null ? Math.round(accuracy) : "?"}m). Please move to an open area and try again.`,
          );
          return;
        }
      }
    }

    const reportGps: GpsCoord = hasGps
      ? { lat: resolvedLat!, lng: resolvedLng!, timestamp: BigInt(Date.now()) }
      : NULL_GPS;

    const detailsPerProduct: Array<[ProductId, string]> = visit.productIds
      .map((id): [ProductId, string] => [
        id,
        visit.productDetails.get(id.toString()) ?? "",
      ])
      .filter(([, text]) => text.trim() !== "");

    const samplesDistributed: SampleDistributed[] = visit.samplesEnabled
      ? visit.samples
          .filter((s) => s.productId !== null && s.quantity !== "")
          .map((s) => ({
            productId: s.productId!,
            quantity: BigInt(Number.parseInt(s.quantity, 10)),
          }))
      : [];

    const giftArticlesV2: GiftArticleDistributedV2[] = visit.giftsEnabled
      ? visit.giftArticles
          .filter((g) => g.giftArticleId !== null && g.quantity !== "")
          .map((g) => ({
            giftArticleId: g.giftArticleId!,
            giftArticleName: g.giftArticleName ?? "",
            quantity: BigInt(Number.parseInt(g.quantity, 10)),
          }))
      : [];

    setSaving(true);
    try {
      const reportId = await api.createCallReport(session.userId, {
        date: today,
        workType: WorkType.Field,
        gps: reportGps,
        startLocation: reportGps,
        endLocation: NULL_GPS,
        remarks: "",
        doctorsVisited: [
          {
            doctorId: visit.doctorId,
            notes: visit.notes,
            gps: undefined,
            productIds: visit.productIds,
            detailsPerProduct,
            giftArticles: giftArticlesV2,
            samplesDistributed: [],
            gpsAccuracy: resolvedAccuracy ?? undefined,
          } as Parameters<typeof api.createCallReport>[1]["doctorsVisited"][0],
        ],
        samplesDistributed,
        stationType: "Head Quarter",
        // Store the actual station the doctor belongs to for correct DCR tagging
        workingStation: visit.selectedDoctorStation || undefined,
        workingStationSource:
          WorkingStationSource.OtherStation as unknown as WorkingStationSource__1,
        workingMode: WorkingMode.WorkingAlone,
        workingWithUserId: undefined,
        workingWithUserName: undefined,
        gpsAccuracy: resolvedAccuracy ?? undefined,
      } as Parameters<typeof api.createCallReport>[1]);

      toast.success("Doctor visit saved successfully");
      try {
        void api.triggerDoctorCallNotification(
          String(reportId),
          session.token ?? "",
        );
      } catch {
        // ignore
      }
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Doctor call save failed:", err);
      if (
        msg.toLowerCase().includes("unauthorized") ||
        msg.toLowerCase().includes("session") ||
        msg.toLowerCase().includes("not authenticated")
      ) {
        toast.error("Session expired. Please log in again.");
      } else {
        const isNetworkError =
          !isOnline ||
          (err instanceof Error &&
            (err.message.includes("fetch") ||
              err.message.includes("network") ||
              err.message.toLowerCase().includes("failed to fetch")));
        if (isNetworkError) {
          const istTimestamp = new Date().toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
          });
          const offlineSession = useAuthStore.getState().session;
          await addOfflineDcrRecord({
            mrId: offlineSession?.userId?.toString() ?? "",
            mrName: offlineSession?.name ?? "",
            timestamp: istTimestamp,
            doctorName: "",
            specialty: "",
            clinicHospital: "",
            visitOutcome: "",
            productsDetailed: [],
            samplesGiven: [],
            nextAction: "",
            followUpDate: "",
            gpsLat: gpsCoords?.lat ?? null,
            gpsLng: gpsCoords?.lng ?? null,
            gpsAccuracy: gpsCoords?.accuracy ?? null,
            territory: "",
            station: visit.selectedDoctorStation ?? "",
            rawFormData: visit,
          });
          await refreshPendingCount();
          toast.success(
            "No internet connection. Your doctor call has been saved offline and will sync automatically when you are back online.",
            { duration: 5000 },
          );
        } else {
          toast.error("Failed to save visit. Please try again.");
        }
      }
    } finally {
      setSaving(false);
    }
  }

  function handleManualPermissionRecheck() {
    setPermRecheckActive(true);
    if ("permissions" in navigator) {
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((res) => {
          if (res.state !== "denied") {
            refreshGps();
          } else {
            toast.warning(
              "Location permission is still denied. Please enable it in your device settings.",
              { duration: 5000 },
            );
          }
        })
        .catch(() => refreshGps())
        .finally(() => setPermRecheckActive(false));
    } else {
      refreshGps();
      setPermRecheckActive(false);
    }
  }

  const activeProducts = products.filter((p) => p.isActive);
  const showPermissionBlock = isMobileDevice() && permissionState === "denied";

  // Always show the other station picker when data is loaded.
  const showOtherStationPicker = dataLoaded;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg max-h-[90vh] overflow-y-auto"
        data-ocid="doctor-call-modal"
      >
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-primary" />
            Doctor Call Entry
          </DialogTitle>
        </DialogHeader>

        {showPermissionBlock ? (
          <LocationPermissionBlock
            onRecheck={handleManualPermissionRecheck}
            recheckActive={permRecheckActive}
          />
        ) : (
          <div className="space-y-5 pb-2">
            <div className="flex justify-end">
              <ScrollToBottom label="Jump to bottom" />
            </div>

            {/* ── GPS Status Bar ── */}
            <GpsStatusBar
              status={gpsStatus}
              accuracy={gpsCoords?.accuracy ?? null}
              onRetry={refreshGps}
              loading={gpsLoading}
            />

            {(gpsStatus === "weak" || gpsStatus === "failed") && (
              <p
                className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-1.5"
                data-ocid="doctor-call-gps-accuracy-warning"
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                GPS accuracy is too low. Please move to an open area and wait
                for a better signal.
              </p>
            )}

            {/* Station detection */}
            {dataLoaded && autoStationResolving && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Detecting your current station…
              </div>
            )}

            {dataLoaded &&
              !autoStationResolving &&
              autoStationSource.kind !== "manual" && (
                <StationSourceBadge source={autoStationSource} />
              )}

            {/* Manual station selection */}
            {dataLoaded &&
              !autoStationResolving &&
              autoStationSource.kind === "manual" && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Step 1 — Select Station
                  </Label>
                  <Select
                    value={selectedStation}
                    onValueChange={handleStationChange}
                  >
                    <SelectTrigger data-ocid="doctor-call-station-select">
                      <SelectValue
                        placeholder={
                          stationsLoading
                            ? "Loading stations…"
                            : "Select station"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">— Select a Station —</SelectItem>
                      {stationGroups.length > 0
                        ? stationGroups.map(({ hqId, stations }) => (
                            <SelectGroup key={String(hqId)}>
                              {stationGroups.length > 1 && (
                                <SelectLabel className="text-xs text-muted-foreground">
                                  {hqNameMap.get(String(hqId)) ??
                                    `HQ ${String(hqId)}`}
                                </SelectLabel>
                              )}
                              {stations.map((s) => (
                                <SelectItem
                                  key={String(s.stationId)}
                                  value={s.stationName}
                                >
                                  {s.stationName}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          ))
                        : allStationNames.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                    </SelectContent>
                  </Select>
                  {!stationsLoading &&
                    !stationsLoadError &&
                    allStationNames.length === 0 && (
                      <p className="text-xs text-amber-600 flex items-start gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        No stations found for your area. Contact HR to verify
                        your assignment.
                      </p>
                    )}
                  {stationsLoadError && (
                    <p className="text-xs text-destructive flex items-start gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      Could not load stations. Please try again.
                    </p>
                  )}
                </div>
              )}

            {/* ── Part C: Doctor selection — grouped by station ── */}
            {selectedStation !== "all" && (
              <div className="space-y-3">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {autoStationSource.kind === "manual"
                    ? "Step 2 — Select Doctor"
                    : "Select Doctor"}{" "}
                  <span className="text-destructive">*</span>
                </Label>

                {/* Search box shared across all sections */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search by Doctor Name..."
                    value={doctorSearch}
                    onChange={(e) => setDoctorSearch(e.target.value)}
                    className="pl-9"
                    data-ocid="doctor-call-doctor-search"
                  />
                  {doctorSearch && (
                    <button
                      type="button"
                      onClick={() => setDoctorSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Primary station doctor list */}
                <DoctorListSection
                  label={`Primary Station — ${selectedStation}`}
                  accentClass="bg-primary/10 text-primary border border-primary/20"
                  doctors={filteredDoctors}
                  loading={stationDoctorsLoading}
                  selectedDoctorId={visit.doctorId}
                  doctorSearch=""
                  lastVisitMap={lastVisitMap}
                  onSelect={handleDoctorSelect}
                  emptyMessage="No doctors found for this station."
                  stationName={selectedStation}
                  dataOcidPrefix="doctor-call-doctor.item"
                />

                {/* Additional station doctor lists (Part C) */}
                {mtpAdditionalStations.map((stn, si) => {
                  const entry = additionalStationDoctors.get(stn);
                  return (
                    <DoctorListSection
                      key={stn}
                      label={`Additional Station — ${stn}`}
                      accentClass="bg-purple-50 text-purple-700 border border-purple-200"
                      doctors={entry?.doctors ?? []}
                      loading={entry?.loading ?? true}
                      selectedDoctorId={visit.doctorId}
                      doctorSearch={doctorSearch}
                      lastVisitMap={lastVisitMap}
                      onSelect={handleDoctorSelect}
                      emptyMessage={`No doctors found for ${stn}.`}
                      stationName={stn}
                      dataOcidPrefix={`doctor-call-addl-station.${si + 1}.doctor.item`}
                    />
                  );
                })}
              </div>
            )}

            {/* ── Part D: Select Other Station (on-the-spot) ── */}
            {showOtherStationPicker && (
              <div
                className="border border-border/60 rounded-lg overflow-hidden"
                data-ocid="doctor-call-other-station-section"
              >
                <div className="px-3 py-2 bg-muted/30 flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs font-semibold text-foreground">
                    Select Other Station
                  </span>
                  <span className="text-[10px] text-muted-foreground ml-1">
                    (visit doctors from any station under your HQ)
                  </span>
                </div>
                <div className="p-3 space-y-2">
                  <Select
                    value={otherStationSelected}
                    onValueChange={handleOtherStationChange}
                  >
                    <SelectTrigger data-ocid="doctor-call-other-station-select">
                      <SelectValue placeholder="Select a station…" />
                    </SelectTrigger>
                    <SelectContent>
                      {otherStationOptions.length === 0 ? (
                        <SelectItem value="__none__" disabled>
                          No other stations configured for your HQ
                        </SelectItem>
                      ) : (
                        otherStationOptions.map((stn) => (
                          <SelectItem key={stn} value={stn}>
                            {stn}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>

                  {otherStationSelected && (
                    <DoctorListSection
                      label={`Doctors from ${otherStationSelected}`}
                      accentClass="bg-teal-50 text-teal-700 border border-teal-200"
                      doctors={otherStationDoctors}
                      loading={otherStationLoading}
                      selectedDoctorId={visit.doctorId}
                      doctorSearch={doctorSearch}
                      lastVisitMap={lastVisitMap}
                      onSelect={handleDoctorSelect}
                      emptyMessage={`No doctors found for ${otherStationSelected}.`}
                      stationName={otherStationSelected}
                      dataOcidPrefix="doctor-call-other-station.doctor.item"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Doctor Selected — show all fields */}
            {visit.doctorId && selectedDoctor && (
              <>
                <div className="flex items-center gap-2.5 px-3 py-2.5 bg-primary/5 border border-primary/20 rounded-lg">
                  <Check className="w-4 h-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-primary">
                        {selectedDoctor.name}
                      </p>
                      <CategoryBadge category={selectedDoctor.category} />
                    </div>
                    {selectedDoctor.specialization && (
                      <p className="text-xs text-muted-foreground">
                        {selectedDoctor.specialization}
                        {selectedDoctor.clinicName
                          ? ` · ${selectedDoctor.clinicName}`
                          : ""}
                      </p>
                    )}
                    {visit.selectedDoctorStation && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                        <MapPin className="w-2.5 h-2.5 shrink-0" />
                        {visit.selectedDoctorStation}
                      </p>
                    )}
                  </div>
                </div>

                <VisitHistoryPanel
                  history={visit.visitHistory}
                  loading={visit.loadingHistory}
                  expanded={visit.historyExpanded}
                  onToggle={() =>
                    setVisit((v) => ({
                      ...v,
                      historyExpanded: !v.historyExpanded,
                    }))
                  }
                  products={products}
                />

                {/* Products Discussed */}
                <div className="space-y-1.5">
                  <div className="mt-4 flex items-center gap-2 w-full rounded-md bg-blue-600 px-4 py-2">
                    <Package className="w-4 h-4 text-white shrink-0" />
                    <span className="text-sm font-bold text-white tracking-wide">
                      Product Selection
                    </span>
                    {visit.productIds.length > 0 && (
                      <span className="ml-auto text-xs font-semibold bg-white/20 text-white rounded-full px-2 py-0.5">
                        {visit.productIds.length} selected
                      </span>
                    )}
                  </div>
                  <ProductListWithDetails
                    products={products}
                    selectedIds={visit.productIds}
                    productDetails={visit.productDetails}
                    onToggle={toggleProduct}
                    onDetailChange={setProductDetail}
                  />
                  {visit.productIds.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Select at least one product to save this visit.
                    </p>
                  )}
                </div>

                {/* Samples */}
                <div className="border border-border/40 rounded-lg overflow-hidden">
                  <div className="flex items-center gap-2 w-full rounded-t-lg bg-green-600 px-4 py-2">
                    <Package className="w-4 h-4 text-white shrink-0" />
                    <span className="text-sm font-bold text-white tracking-wide">
                      Sample Given
                    </span>
                  </div>
                  <label
                    htmlFor="samples-toggle"
                    className="flex items-center gap-3 px-4 py-2.5 bg-muted/20 cursor-pointer hover:bg-muted/30 transition-colors"
                  >
                    <Checkbox
                      id="samples-toggle"
                      checked={visit.samplesEnabled}
                      onCheckedChange={(v) =>
                        setVisit((s) => ({
                          ...s,
                          samplesEnabled: !!v,
                          samples: s.samples.length
                            ? s.samples
                            : [{ productId: null, quantity: "" }],
                        }))
                      }
                      data-ocid="doctor-call-samples-toggle"
                    />
                    <span className="text-sm font-semibold">Samples Given</span>
                  </label>

                  {visit.samplesEnabled && (
                    <div className="p-3 space-y-2 border-t border-border/40">
                      {visit.samples.map((s, si) => (
                        <div
                          key={`sample-row-${si}-${s.productId?.toString() ?? "none"}`}
                          className="flex flex-col sm:flex-row gap-2 items-start sm:items-center"
                          data-ocid={`doctor-call-sample-row.${si + 1}`}
                        >
                          <div className="flex-1 w-full">
                            <Select
                              value={s.productId?.toString() ?? "none"}
                              onValueChange={(val) =>
                                updateSampleProduct(si, val)
                              }
                            >
                              <SelectTrigger
                                data-ocid={`doctor-call-sample-product.${si + 1}`}
                              >
                                <SelectValue placeholder="Select product" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">
                                  — Select product —
                                </SelectItem>
                                {activeProducts.map((p) => (
                                  <SelectItem
                                    key={p.id.toString()}
                                    value={p.id.toString()}
                                  >
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
                                updateSampleQty(si, e.target.value)
                              }
                              data-ocid={`doctor-call-sample-qty.${si + 1}`}
                              className="w-20"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeSampleRow(si)}
                              className="h-9 w-9 shrink-0"
                              aria-label="Remove sample"
                              data-ocid={`doctor-call-sample-remove.${si + 1}`}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1 mt-1"
                        onClick={addSampleRow}
                        data-ocid="doctor-call-add-sample"
                      >
                        <Plus className="w-3 h-3" /> Add Another Sample
                      </Button>
                    </div>
                  )}
                </div>

                {/* Gift Articles */}
                <div className="border border-border/40 rounded-lg overflow-hidden">
                  <div className="flex items-center gap-2 w-full rounded-t-lg bg-orange-600 px-4 py-2">
                    <Gift className="w-4 h-4 text-white shrink-0" />
                    <span className="text-sm font-bold text-white tracking-wide">
                      Gift Article Given
                    </span>
                  </div>
                  <label
                    htmlFor="gifts-toggle"
                    className="flex items-center gap-3 px-4 py-2.5 bg-muted/20 cursor-pointer hover:bg-muted/30 transition-colors"
                  >
                    <Checkbox
                      id="gifts-toggle"
                      checked={visit.giftsEnabled}
                      onCheckedChange={(v) =>
                        setVisit((s) => ({
                          ...s,
                          giftsEnabled: !!v,
                          giftArticles: s.giftArticles.length
                            ? s.giftArticles
                            : [
                                {
                                  giftArticleId: null,
                                  giftArticleName: "",
                                  quantity: "",
                                },
                              ],
                        }))
                      }
                      data-ocid="doctor-call-gifts-toggle"
                    />
                    <span className="text-sm font-semibold flex items-center gap-1.5">
                      <Gift className="w-3.5 h-3.5" />
                      Gift Article Given
                    </span>
                  </label>

                  {visit.giftsEnabled && (
                    <div className="p-3 space-y-3 border-t border-border/40">
                      {visit.giftArticles.map((g, gi) => (
                        <div
                          key={`gift-row-${gi}-${g.giftArticleId?.toString() ?? "none"}`}
                          className="space-y-2"
                          data-ocid={`doctor-call-gift-row.${gi + 1}`}
                        >
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              {g.giftArticleId ? (
                                <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-md">
                                  <Gift className="w-3.5 h-3.5 text-primary shrink-0" />
                                  <span className="text-sm font-medium text-primary flex-1 truncate">
                                    {g.giftArticleName}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => clearGiftRow(gi)}
                                    className="text-muted-foreground hover:text-destructive shrink-0"
                                    aria-label="Change gift article"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <GiftArticleSearch
                                  giftArticles={giftArticles}
                                  onSelect={(article) =>
                                    selectGiftForRow(gi, article)
                                  }
                                />
                              )}
                            </div>
                            <div className="flex gap-2 items-start shrink-0">
                              <Input
                                type="number"
                                min="1"
                                placeholder="Qty"
                                value={g.quantity}
                                onChange={(e) =>
                                  updateGiftQty(gi, e.target.value)
                                }
                                data-ocid={`doctor-call-gift-qty.${gi + 1}`}
                                className="w-20"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeGiftRow(gi)}
                                className="h-9 w-9 shrink-0"
                                aria-label="Remove gift"
                                data-ocid={`doctor-call-gift-remove.${gi + 1}`}
                              >
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1"
                        onClick={addGiftRow}
                        data-ocid="doctor-call-add-gift"
                      >
                        <Plus className="w-3 h-3" /> Add Another Gift
                      </Button>
                    </div>
                  )}
                </div>

                {/* Visit Notes */}
                <div>
                  <Label className="text-xs mb-1 block text-muted-foreground">
                    Visit Notes / Remarks
                  </Label>
                  <Textarea
                    placeholder="Notes about this visit..."
                    value={visit.notes}
                    onChange={(e) =>
                      setVisit((v) => ({ ...v, notes: e.target.value }))
                    }
                    data-ocid="doctor-call-notes"
                    rows={2}
                    className="resize-none text-sm"
                  />
                </div>
              </>
            )}

            {/* Footer actions */}
            <div className="flex flex-col gap-2 pt-2 border-t border-border">
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handleSave}
                  disabled={submitDisabled}
                  data-ocid="doctor-call-save"
                  className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {waitingForGps ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Getting your location…
                    </>
                  ) : saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Save Doctor Visit
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleAttachment()}
                  className="border-primary/40 text-primary hover:bg-primary/5"
                  title="Tap to email your file to the company and your reporting managers. Your email app will open with all recipients pre-filled."
                  data-ocid="doctor-call-attachment-button"
                >
                  <Paperclip className="w-3.5 h-3.5 mr-1.5" />
                  Attachment
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={saving}
                  data-ocid="doctor-call-cancel"
                >
                  Cancel
                </Button>
              </div>
              {/* GPS accuracy badge — shown once coords are known */}
              {gpsCoords && (
                <span
                  className="text-xs text-green-600 font-medium flex items-center gap-1"
                  data-ocid="doctor-call-gps-accuracy-badge"
                >
                  <MapPin className="w-3 h-3" />
                  GPS: ±{Math.round(gpsCoords.accuracy ?? 0)}m
                </span>
              )}
              {gpsBlocksSubmission && !gpsOverrideActive && (
                <p
                  className="text-xs text-muted-foreground flex items-start gap-1.5"
                  data-ocid="doctor-call-gps-required-hint"
                >
                  <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-destructive" />
                  GPS location is required to submit a Doctor Call. Please wait
                  while your location is being fetched.
                </p>
              )}
              {gpsOverrideActive && (
                <p
                  className="text-xs text-amber-700 flex items-start gap-1.5"
                  data-ocid="doctor-call-gps-override-hint"
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  Admin GPS override active. Submission without GPS is permitted
                  for this session.
                </p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
