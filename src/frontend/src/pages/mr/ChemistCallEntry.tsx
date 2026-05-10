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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Info,
  Loader2,
  MapPin,
  Package,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Role } from "../../backend";
import type { ChemistCallInfo } from "../../backend.d";
import {
  DataTable,
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { isGpsRequired, isMobileDevice, useGps } from "../../hooks/useGps";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import type { ChemistInfo, ProductInfo } from "../../types";
import { formatDate } from "../../utils/dateFormatter";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProductRow {
  productId: bigint | null;
  productName: string;
  enquiryType: string;
}

const ENQUIRY_TYPES = ["Enquiry", "Order", "Push", "Return"] as const;

// ── GPS Status Bar ────────────────────────────────────────────────────────────

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
        data-ocid="chemist-gps-status-bar"
      >
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
        <MapPin className="w-3.5 h-3.5 shrink-0" />
        <span className="font-mono flex-1 min-w-0 truncate">
          {locationNote
            ? locationNote
            : `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`}
        </span>
        <a
          href={`https://maps.google.com/?q=${coords.lat},${coords.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-green-600 hover:underline shrink-0"
        >
          <ExternalLink className="w-3 h-3" />
        </a>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="opacity-70 hover:opacity-100 transition-opacity shrink-0"
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
        data-ocid="chemist-gps-status-bar"
      >
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span className="flex-1 min-w-0">{locationNote}</span>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="opacity-70 hover:opacity-100 transition-opacity shrink-0"
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
      data-ocid="chemist-gps-status-bar"
    >
      <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <span className="font-medium">
          {isMobileDevice()
            ? "Location not available — enable GPS to submit"
            : "Detecting location…"}
        </span>
        {error && <p className="mt-0.5 text-orange-600 text-[11px]">{error}</p>}
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        className="opacity-70 hover:opacity-100 transition-opacity inline-flex items-center gap-1 underline-offset-2 hover:underline shrink-0"
        aria-label="Retry GPS"
      >
        <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
        Retry
      </button>
    </div>
  );
}

// ── Products Section ──────────────────────────────────────────────────────────

function ProductsEnquiredSection({
  rows,
  products,
  onChange,
}: {
  rows: ProductRow[];
  products: ProductInfo[];
  onChange: (rows: ProductRow[]) => void;
}) {
  const activeProducts = useMemo(
    () => products.filter((p) => p.isActive),
    [products],
  );

  function addRow() {
    onChange([
      ...rows,
      { productId: null, productName: "", enquiryType: "Enquiry" },
    ]);
  }

  function removeRow(idx: number) {
    onChange(rows.filter((_, i) => i !== idx));
  }

  function updateRow(idx: number, patch: Partial<ProductRow>) {
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  return (
    <div className="space-y-2 pt-1 border-t border-border/40">
      <div className="flex items-center justify-between flex-wrap gap-2 pt-2">
        <Label className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5" /> Products Enquired / Pushed
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs px-2 gap-1"
          onClick={addRow}
          data-ocid="chemist-add-product-btn"
        >
          <Plus className="w-3 h-3" /> Add Product
        </Button>
      </div>
      {rows.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          No products added yet.
        </p>
      )}
      {rows.map((row, idx) => (
        <div
          key={`product-row-${idx}-${row.productId?.toString() ?? "none"}`}
          className="flex flex-col sm:flex-row gap-2 items-start sm:items-center"
        >
          <div className="flex-1 w-full">
            <Select
              value={row.productId?.toString() ?? "none"}
              onValueChange={(val) => {
                const found = activeProducts.find(
                  (p) => p.id.toString() === val,
                );
                updateRow(idx, {
                  productId: found ? found.id : null,
                  productName: found ? found.name : "",
                });
              }}
            >
              <SelectTrigger
                data-ocid={`chemist-product-select-${idx}`}
                className="text-xs"
              >
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Select product —</SelectItem>
                {activeProducts.map((p) => (
                  <SelectItem key={p.id.toString()} value={p.id.toString()}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 items-center w-full sm:w-auto">
            <Select
              value={row.enquiryType}
              onValueChange={(val) => updateRow(idx, { enquiryType: val })}
            >
              <SelectTrigger
                className="w-[120px] text-xs shrink-0"
                data-ocid={`chemist-enquiry-type-${idx}`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENQUIRY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeRow(idx)}
              className="h-9 w-9 shrink-0"
              aria-label="Remove product"
            >
              <Trash2 className="w-3.5 h-3.5 text-destructive" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Chemist Selector ──────────────────────────────────────────────────────────

function ChemistSelector({
  chemists,
  selectedId,
  onSelect,
}: {
  chemists: ChemistInfo[];
  selectedId: bigint | null;
  onSelect: (c: ChemistInfo) => void;
}) {
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(
    () =>
      chemists.filter(
        (c) =>
          !search.trim() ||
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          (c.area ?? "").toLowerCase().includes(search.toLowerCase()),
      ),
    [chemists, search],
  );

  const selected = chemists.find((c) => c.id === selectedId);

  return (
    <div className="space-y-2">
      {selected && (
        <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-md">
          <Check className="w-4 h-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-primary truncate">
              {selected.name}
            </p>
            {selected.area && (
              <p className="text-xs text-muted-foreground truncate">
                {selected.area}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() =>
              onSelect({ ...selected, id: BigInt(-1) } as ChemistInfo)
            }
            className="p-1 rounded hover:bg-primary/10 transition-colors"
            aria-label="Clear chemist selection"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      )}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          placeholder="Search chemist by name or area..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 text-sm"
          data-ocid="chemist-search-input"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="border border-input rounded-md bg-background max-h-48 overflow-y-auto scrollbar-thin">
        {filtered.length === 0 ? (
          <div className="px-3 py-4 text-xs text-muted-foreground text-center italic">
            {chemists.length === 0
              ? "No chemists added yet."
              : "No chemists match your search."}
          </div>
        ) : (
          filtered.map((c) => {
            const isSelected = selectedId === c.id;
            return (
              <button
                key={c.id.toString()}
                type="button"
                onClick={() => onSelect(c)}
                data-ocid={`chemist-list-item-${c.id}`}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-muted/40 transition-colors border-b border-border/30 last:border-0 ${isSelected ? "bg-primary/8 border-l-2 border-l-primary" : ""}`}
              >
                <div className="min-w-0">
                  <p
                    className={`text-sm font-medium truncate ${isSelected ? "text-primary" : "text-foreground"}`}
                  >
                    {c.name}
                  </p>
                  {c.area && (
                    <p className="text-xs text-muted-foreground truncate">
                      {c.area}
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
      {filtered.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          {filtered.length} chemist{filtered.length !== 1 ? "s" : ""} shown
        </p>
      )}
    </div>
  );
}

// ── Visit Row in History ──────────────────────────────────────────────────────

function HistoryRow({
  call,
  isExpanded,
  onToggle,
}: {
  call: ChemistCallInfo;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const hasGps = call.gpsLocation && call.gpsLocation.lat !== 0;

  return (
    <>
      <tr
        className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer"
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onToggle();
        }}
        data-ocid={`chemist-history-row-${call.id}`}
        tabIndex={0}
      >
        <td className="px-4 py-3 font-mono text-xs">{formatDate(call.date)}</td>
        <td className="px-4 py-3 text-sm font-medium truncate max-w-[140px]">
          {call.chemistName}
        </td>
        <td className="px-4 py-3 text-xs text-muted-foreground">
          {call.station}
        </td>
        <td className="px-4 py-3 text-center text-xs">
          {call.productsEnquired.length}
        </td>
        <td className="px-4 py-3">
          {hasGps ? (
            <Badge
              variant="outline"
              className="text-[10px] py-0 px-1.5 border-green-400 text-green-700 bg-green-50"
            >
              GPS ✓
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] py-0 px-1.5">
              No GPS
            </Badge>
          )}
        </td>
        <td className="px-4 py-3">
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </td>
      </tr>
      {isExpanded && (
        <tr className="bg-muted/10 border-b border-border/40">
          <td colSpan={6} className="px-4 py-3">
            <div className="space-y-2 text-xs">
              {call.productsEnquired.length > 0 && (
                <div>
                  <span className="font-semibold text-muted-foreground">
                    Products:
                  </span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {call.productsEnquired.map((p) => (
                      <span
                        key={`${p.productId?.toString() ?? "u"}-${p.enquiryType}`}
                        className="inline-flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5 text-[11px]"
                      >
                        {p.productName}
                        <span className="text-muted-foreground">
                          ({p.enquiryType})
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {call.orderNoted && (
                <div>
                  <span className="font-semibold text-muted-foreground">
                    Order Notes:{" "}
                  </span>
                  <span>{call.orderNoted}</span>
                </div>
              )}
              {call.remarks && (
                <div>
                  <span className="font-semibold text-muted-foreground">
                    Remarks:{" "}
                  </span>
                  <span>{call.remarks}</span>
                </div>
              )}
              {hasGps && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="font-mono text-muted-foreground">
                    {call.gpsLocation.lat.toFixed(5)},{" "}
                    {call.gpsLocation.lng.toFixed(5)}
                  </span>
                  <a
                    href={`https://maps.google.com/?q=${call.gpsLocation.lat},${call.gpsLocation.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    View Map
                  </a>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ChemistCallEntry() {
  const session = useAuthStore((s) => s.session);
  const {
    coords: gpsCoords,
    error: gpsError,
    locationNote: gpsNote,
    loading: gpsLoading,
    refreshGps,
    permissionState,
  } = useGps();

  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400 * 1000)
    .toISOString()
    .slice(0, 10);

  // Form state
  const [date, setDate] = useState(today);
  const [selectedChemist, setSelectedChemist] = useState<ChemistInfo | null>(
    null,
  );
  const [station, setStation] = useState("");
  const [area, setArea] = useState("");
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [orderNoted, setOrderNoted] = useState("");
  const [remarks, setRemarks] = useState("");

  // Data
  const [chemists, setChemists] = useState<ChemistInfo[]>([]);
  const [productMaster, setProductMaster] = useState<ProductInfo[]>([]);
  const [history, setHistory] = useState<ChemistCallInfo[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expandedRow, setExpandedRow] = useState<bigint | null>(null);

  // History filter
  const [fromDate, setFromDate] = useState(thirtyDaysAgo);
  const [toDate, setToDate] = useState(today);

  // GPS enforcement
  const gpsRequired = isGpsRequired();
  const canSubmit =
    !submitting &&
    selectedChemist !== null &&
    selectedChemist.id !== BigInt(-1) &&
    (!gpsRequired || !!gpsCoords);

  // Load data on mount
  useEffect(() => {
    if (!session) return;
    Promise.all([api.listMyChemists(session.userId), api.listProducts()])
      .then(([ch, pr]) => {
        setChemists(ch);
        setProductMaster(pr);
        setLoadingData(false);
      })
      .catch(() => {
        toast.error("Failed to load data. Please refresh.");
        setLoadingData(false);
      });
  }, [session]);

  // Load history when filter changes
  useEffect(() => {
    if (!session) return;
    setLoadingHistory(true);
    api
      .listMyChemistCalls(session.token, fromDate, toDate)
      .then((calls) => {
        setHistory(calls);
        setLoadingHistory(false);
      })
      .catch(() => setLoadingHistory(false));
  }, [session, fromDate, toDate]);

  function handleChemistSelect(c: ChemistInfo) {
    if (c.id === BigInt(-1)) {
      // Clear selection
      setSelectedChemist(null);
      setStation("");
      setArea("");
      return;
    }
    setSelectedChemist(c);
    setStation((c as unknown as Record<string, string>).station ?? "");
    setArea(c.area ?? "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !selectedChemist || selectedChemist.id === BigInt(-1)) {
      toast.error("Please select a chemist.");
      return;
    }
    if (gpsRequired && !gpsCoords) {
      toast.error(
        "GPS coordinates required. Please wait for location capture.",
      );
      return;
    }

    const gpsLocation = gpsCoords
      ? {
          lat: gpsCoords.lat,
          lng: gpsCoords.lng,
          timestamp: BigInt(Date.now()),
        }
      : { lat: 0, lng: 0, timestamp: BigInt(0) };

    const productsEnquired = products
      .filter((p) => p.productId !== null)
      .map((p) => ({
        productId: p.productId!,
        productName: p.productName,
        enquiryType: p.enquiryType,
      }));

    setSubmitting(true);
    try {
      const result = await api.submitChemistCall(session.token, {
        chemistId: selectedChemist.id,
        chemistName: selectedChemist.name,
        station,
        area,
        date,
        productsEnquired,
        orderNoted,
        remarks,
        gpsLocation,
      });

      if (result.__kind__ === "ok") {
        toast.success("Chemist call recorded successfully!");
        // Reset form
        setSelectedChemist(null);
        setStation("");
        setArea("");
        setProducts([]);
        setOrderNoted("");
        setRemarks("");
        setDate(today);
        // Refresh history
        api
          .listMyChemistCalls(session.token, fromDate, toDate)
          .then(setHistory)
          .catch(() => {});
      } else {
        toast.error(result.err ?? "Failed to submit chemist visit.");
      }
    } catch {
      toast.error("Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Show full-screen GPS gate if permission explicitly denied on mobile
  if (permissionState === "denied" && gpsRequired && isMobileDevice()) {
    return (
      <PortalLayout portalRole={Role.MR}>
        <PageHeader
          title="Chemist Call Entry"
          subtitle="Log a chemist call with GPS verification"
        />
        <PageContent>
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
            <div className="p-5 rounded-full bg-destructive/10">
              <MapPin className="w-12 h-12 text-destructive" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-display font-semibold text-foreground">
                Location Access Required
              </h2>
              <p className="text-muted-foreground text-sm max-w-sm">
                Please enable location access in your browser settings to record
                chemist visits with GPS verification.
              </p>
            </div>
            <div className="text-left text-xs text-muted-foreground space-y-1 bg-muted/30 border border-border rounded-lg p-4 max-w-xs">
              <p className="font-semibold mb-1">Android Chrome:</p>
              <p>Tap lock icon → Site settings → Location → Allow</p>
              <p className="font-semibold mt-2 mb-1">iPhone / Safari:</p>
              <p>Settings → Safari → Location → Allow</p>
            </div>
          </div>
        </PageContent>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout portalRole={Role.MR}>
      <PageHeader
        title="Chemist Call Entry"
        subtitle="Log a chemist call with GPS verification"
      />
      <PageContent>
        {/* ── GPS Status Banner ── */}
        <GpsStatusBar
          coords={gpsCoords}
          error={gpsError}
          locationNote={gpsNote}
          onRefresh={refreshGps}
          loading={gpsLoading}
        />

        {/* ── Entry Form ── */}
        <form
          onSubmit={handleSubmit}
          className="mt-4 space-y-5 bg-card border border-border rounded-xl p-5"
        >
          <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground">
            New Chemist Call
          </h2>

          {/* Date */}
          <div className="space-y-1.5">
            <Label
              htmlFor="chemist-date"
              className="text-xs font-semibold text-muted-foreground uppercase tracking-wide"
            >
              Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="chemist-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={today}
              data-ocid="chemist-date-input"
              className="text-sm"
            />
          </div>

          {/* Chemist Selection */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Chemist <span className="text-destructive">*</span>
            </Label>
            {loadingData ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : chemists.length === 0 ? (
              <div
                className="flex items-center gap-3 p-4 rounded-lg border border-border bg-muted/20 text-sm"
                data-ocid="chemist-empty-state"
              >
                <Info className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">
                  No chemists added yet.{" "}
                  <a
                    href="/mr/chemists"
                    className="text-primary underline underline-offset-2 hover:opacity-80"
                  >
                    Add chemists in Chemist Management.
                  </a>
                </span>
              </div>
            ) : (
              <ChemistSelector
                chemists={chemists}
                selectedId={selectedChemist?.id ?? null}
                onSelect={handleChemistSelect}
              />
            )}
          </div>

          {/* Station & Area (auto-filled, editable) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="chemist-station"
                className="text-xs font-semibold text-muted-foreground uppercase tracking-wide"
              >
                Station
              </Label>
              <Input
                id="chemist-station"
                value={station}
                onChange={(e) => setStation(e.target.value)}
                placeholder="Station name"
                data-ocid="chemist-station-input"
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="chemist-area"
                className="text-xs font-semibold text-muted-foreground uppercase tracking-wide"
              >
                Area
              </Label>
              <Input
                id="chemist-area"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="Area name"
                data-ocid="chemist-area-input"
                className="text-sm"
              />
            </div>
          </div>

          {/* Products Section */}
          <ProductsEnquiredSection
            rows={products}
            products={productMaster}
            onChange={setProducts}
          />

          {/* Order Notes */}
          <div className="space-y-1.5 pt-1 border-t border-border/40">
            <Label
              htmlFor="chemist-order"
              className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2 block"
            >
              Order Noted
            </Label>
            <Textarea
              id="chemist-order"
              value={orderNoted}
              onChange={(e) => setOrderNoted(e.target.value)}
              placeholder="Notes on any order the chemist placed..."
              rows={2}
              data-ocid="chemist-order-textarea"
              className="text-sm resize-none"
            />
          </div>

          {/* Remarks */}
          <div className="space-y-1.5">
            <Label
              htmlFor="chemist-remarks"
              className="text-xs font-semibold text-muted-foreground uppercase tracking-wide"
            >
              Remarks
            </Label>
            <Textarea
              id="chemist-remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Optional remarks..."
              rows={2}
              data-ocid="chemist-remarks-textarea"
              className="text-sm resize-none"
            />
          </div>

          {/* GPS indicator when required and not yet available */}
          {gpsRequired && !gpsCoords && (
            <div className="flex items-center gap-2 text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-md px-3 py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              <span>
                Waiting for GPS signal. Submit will be enabled once location is
                captured.
              </span>
            </div>
          )}

          {/* Submit */}
          <Button
            type="submit"
            disabled={!canSubmit}
            data-ocid="chemist-submit-btn"
            className="w-full gap-2"
            title={
              !selectedChemist || selectedChemist.id === BigInt(-1)
                ? "Select a chemist first"
                : gpsRequired && !gpsCoords
                  ? "Waiting for GPS signal"
                  : undefined
            }
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Submit Chemist Call
          </Button>
        </form>

        {/* ── History / List ── */}
        <div className="mt-6 bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h3 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground">
              My Chemist Calls
            </h3>
            {/* Date Range Filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">From</span>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                data-ocid="chemist-history-from-date"
                className="h-7 text-xs w-36"
              />
              <span className="text-xs text-muted-foreground">To</span>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                data-ocid="chemist-history-to-date"
                className="h-7 text-xs w-36"
              />
            </div>
          </div>
          {loadingHistory ? (
            <div className="p-5 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <div
              className="p-10 text-center text-muted-foreground text-sm"
              data-ocid="chemist-history-empty-state"
            >
              No chemist calls found for the selected date range.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="border-b border-border bg-muted/10">
                    {["Date", "Chemist", "Station", "Products", "GPS", ""].map(
                      (h, i) => (
                        <th
                          key={h || i}
                          className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-left"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {history.map((call) => (
                    <HistoryRow
                      key={call.id.toString()}
                      call={call}
                      isExpanded={expandedRow === call.id}
                      onToggle={() =>
                        setExpandedRow((prev) =>
                          prev === call.id ? null : call.id,
                        )
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </PageContent>
    </PortalLayout>
  );
}
