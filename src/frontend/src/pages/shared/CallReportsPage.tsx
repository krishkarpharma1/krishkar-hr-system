import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Map as MapIcon,
  MapPin,
  Package,
  Printer,
  RefreshCw,
  Search,
  Stethoscope,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import type { Role } from "../../backend.d";
import type { CallReportDetail, DoctorVisitDetail } from "../../backend.d";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { api } from "../../lib/api";
import {
  buildBrandingExcelRows,
  buildPdfPrintCss,
} from "../../lib/brandingHtml";
import { useAuthStore } from "../../store/authStore";
import type { UserInfo } from "../../types";
import { GpsAccuracyBadge } from "../mr/DoctorCallModal";

interface CallReportsPageProps {
  userRole: Role;
}

// ── GPS modal data type ───────────────────────────────────────────────────────
interface GpsModalData {
  reportId: bigint;
  mrName: string;
  doctorName: string;
  submittedAt: string;
  station: string;
  lat: number;
  lng: number;
  timestamp: bigint;
  // Doctor's registered address text (display only — no GPS coords available)
  doctorAddress?: string;
  doctorClinicName?: string;
  // GPS accuracy in meters (optional)
  accuracy?: number;
}

// ── Bulk day map pin ──────────────────────────────────────────────────────────
interface DayMapPin {
  callNumber: number;
  doctorName: string;
  submittedAt: string;
  station: string;
  lat: number;
  lng: number;
}

// ── Date helpers ─────────────────────────────────────────────────────────────
function toDateMs(dateStr: string): bigint {
  return BigInt(new Date(dateStr).getTime()) * BigInt(1_000_000);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function thirtyDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function formatTs(ts: bigint): string {
  return new Date(Number(ts) / 1_000_000).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// ── Category badge color ──────────────────────────────────────────────────────
function categoryColor(cat: string) {
  if (cat === "A") return "bg-green-100 text-green-800 border-green-200";
  if (cat === "B") return "bg-blue-100 text-blue-800 border-blue-200";
  return "bg-amber-100 text-amber-800 border-amber-200";
}

// ── Leaflet CSS injection (once) ──────────────────────────────────────────────
let leafletCssInjected = false;
function ensureLeafletCss() {
  if (leafletCssInjected) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  document.head.appendChild(link);
  leafletCssInjected = true;
}

// ── Leaflet icon fix ──────────────────────────────────────────────────────────
function applyLeafletIconFix(L: typeof import("leaflet")) {
  // biome-ignore lint/performance/noDelete: leaflet icon prototype requires delete
  // biome-ignore lint/suspicious/noExplicitAny: leaflet icon prototype fix
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

// ── SVG pin icon helpers ──────────────────────────────────────────────────────
function makeRedIcon(L: typeof import("leaflet")) {
  return L.divIcon({
    html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="28" height="42">
      <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24S24 21 24 12c0-6.6-5.4-12-12-12z" fill="#ef4444" stroke="#fff" stroke-width="1.5"/>
      <circle cx="12" cy="12" r="5" fill="#fff"/>
    </svg>`,
    className: "",
    iconSize: [28, 42],
    iconAnchor: [14, 42],
    popupAnchor: [0, -44],
  });
}

function makeNumberedIcon(L: typeof import("leaflet"), num: number) {
  return L.divIcon({
    html: `<div style="background:#3b82f6;color:#fff;font-size:11px;font-weight:700;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.35)">${num}</div>`,
    className: "",
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -14],
  });
}

// ── Enhanced GPS Map Modal ────────────────────────────────────────────────────
function GpsMapModal({
  data,
  onClose,
}: {
  data: GpsModalData;
  onClose: () => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);

  useEffect(() => {
    ensureLeafletCss();
    if (!mapRef.current) return;
    let map: import("leaflet").Map | null = null;

    import("leaflet").then((leaflet) => {
      const L = leaflet.default;
      applyLeafletIconFix(L);
      if (!mapRef.current) return;

      map = L.map(mapRef.current, {
        center: [data.lat, data.lng],
        zoom: 15,
        zoomControl: true,
        scrollWheelZoom: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      // RED pin — MR submission location
      const redIcon = makeRedIcon(L);
      L.marker([data.lat, data.lng], { icon: redIcon })
        .addTo(map)
        .bindPopup(
          `<div style="font-size:12px;line-height:1.6;min-width:160px">
            <div style="font-weight:700;margin-bottom:4px;color:#ef4444">📍 MR Submission Point</div>
            <div><b>MR:</b> ${data.mrName}</div>
            <div><b>Doctor:</b> Dr. ${data.doctorName}</div>
            <div><b>Station:</b> ${data.station || "—"}</div>
            <div><b>Time:</b> ${data.submittedAt}</div>
            <div style="color:#6b7280;font-size:11px;margin-top:4px">${data.lat.toFixed(6)}, ${data.lng.toFixed(6)}</div>
          </div>`,
        )
        .openPopup();

      mapInstanceRef.current = map;
      setTimeout(() => map?.invalidateSize(), 150);
    });

    return () => {
      map?.remove();
      mapInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    data.lat,
    data.lng,
    data.doctorName,
    data.mrName,
    data.station,
    data.submittedAt,
  ]);

  // Accuracy badge
  const accuracy = data.accuracy;
  const accuracyBadge =
    typeof accuracy === "number" ? (
      accuracy > 100 ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
          ⚠ Low GPS Accuracy (~{Math.round(accuracy)}m)
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200">
          Accuracy: ~{Math.round(accuracy)}m
        </span>
      )
    ) : null;

  return (
    <div
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="bg-card w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30 shrink-0">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-green-600" />
            <span className="font-semibold text-sm text-foreground">
              GPS Location — Doctor Call
            </span>
          </div>
          <button
            type="button"
            className="p-1.5 rounded-full hover:bg-muted transition-colors"
            onClick={onClose}
            aria-label="Close GPS modal"
            data-ocid="call-reports.gps-modal.close_button"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Call info panel */}
        <div className="px-4 py-3 border-b border-border bg-card shrink-0 space-y-1.5 text-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-muted-foreground text-xs">MR:</span>
            <span className="font-medium text-foreground">{data.mrName}</span>
            <span className="text-muted-foreground mx-1">·</span>
            <span className="text-muted-foreground text-xs">Doctor:</span>
            <span className="font-medium text-foreground">
              Dr. {data.doctorName}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-muted-foreground text-xs">Submitted:</span>
            <span className="text-foreground text-xs">{data.submittedAt}</span>
            {data.station && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground text-xs">Station:</span>
                <span className="text-foreground text-xs">{data.station}</span>
              </>
            )}
          </div>
          {/* MR location coordinates */}
          <div className="flex items-center gap-1 text-xs">
            <MapPin className="w-3 h-3 shrink-0 text-red-500" />
            <span className="text-red-600 font-medium">MR location:</span>
            <span className="text-muted-foreground">
              {data.lat.toFixed(6)}, {data.lng.toFixed(6)}
            </span>
          </div>
          {/* Doctor registered address (text only) */}
          {(data.doctorClinicName || data.doctorAddress) && (
            <div className="flex items-start gap-1 text-xs">
              <MapPin className="w-3 h-3 shrink-0 text-blue-500 mt-0.5" />
              <span className="text-blue-600 font-medium">Doctor address:</span>
              <span className="text-muted-foreground break-words">
                {[data.doctorClinicName, data.doctorAddress]
                  .filter(Boolean)
                  .join(", ")}
              </span>
            </div>
          )}
          {accuracyBadge && <div className="pt-0.5">{accuracyBadge}</div>}
        </div>

        {/* Pin legend */}
        <div className="flex items-center gap-4 px-4 py-2 border-b border-border bg-muted/20 shrink-0 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full bg-red-500 border border-white shadow-sm" />
            MR Submission Point
          </span>
        </div>

        {/* Map */}
        <div className="relative flex-1 min-h-[260px]">
          <div ref={mapRef} className="absolute inset-0 w-full h-full" />
        </div>
      </div>
    </div>
  );
}

// ── Bulk Day Map Modal ────────────────────────────────────────────────────────
function DayMapModal({
  pins,
  mrName,
  date,
  onClose,
}: {
  pins: DayMapPin[];
  mrName: string;
  date: string;
  onClose: () => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);

  useEffect(() => {
    ensureLeafletCss();
    if (!mapRef.current || pins.length === 0) return;
    let map: import("leaflet").Map | null = null;

    import("leaflet").then((leaflet) => {
      const L = leaflet.default;
      applyLeafletIconFix(L);
      if (!mapRef.current) return;

      map = L.map(mapRef.current, {
        zoom: 13,
        center: [pins[0].lat, pins[0].lng],
        zoomControl: true,
        scrollWheelZoom: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      const latLngs: [number, number][] = [];
      for (const pin of pins) {
        const icon = makeNumberedIcon(L, pin.callNumber);
        L.marker([pin.lat, pin.lng], { icon })
          .addTo(map)
          .bindPopup(
            `<div style="font-size:12px;line-height:1.6;min-width:150px">
              <div style="font-weight:700;margin-bottom:3px">Call #${pin.callNumber}</div>
              <div><b>Doctor:</b> Dr. ${pin.doctorName}</div>
              <div><b>Station:</b> ${pin.station || "—"}</div>
              <div><b>Time:</b> ${pin.submittedAt}</div>
            </div>`,
          );
        latLngs.push([pin.lat, pin.lng]);
      }

      // Connecting route polyline
      if (latLngs.length > 1) {
        L.polyline(latLngs, {
          color: "#3b82f6",
          weight: 3,
          opacity: 0.7,
          dashArray: "6 4",
        }).addTo(map);
      }

      // Fit all pins in view
      map.fitBounds(L.latLngBounds(latLngs), { padding: [40, 40] });

      mapInstanceRef.current = map;
      setTimeout(() => map?.invalidateSize(), 150);
    });

    return () => {
      map?.remove();
      mapInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins]);

  return (
    <div
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="bg-card w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <MapIcon className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="font-semibold text-sm text-foreground truncate">
              Day Route — {mrName} · {date}
            </span>
            <Badge variant="outline" className="text-xs flex-shrink-0">
              {pins.length} call{pins.length !== 1 ? "s" : ""}
            </Badge>
          </div>
          <button
            type="button"
            className="p-1.5 rounded-full hover:bg-muted transition-colors flex-shrink-0 ml-2"
            onClick={onClose}
            aria-label="Close day map"
            data-ocid="call-reports.day-map-modal.close_button"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Numbered call legend */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/20 shrink-0 overflow-x-auto text-[11px] text-muted-foreground">
          {pins.map((p) => (
            <span
              key={p.callNumber}
              className="flex items-center gap-1 shrink-0"
            >
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold">
                {p.callNumber}
              </span>
              <span className="truncate max-w-[90px]">Dr. {p.doctorName}</span>
            </span>
          ))}
        </div>

        <div className="relative flex-1 min-h-[320px]">
          <div ref={mapRef} className="absolute inset-0 w-full h-full" />
        </div>
      </div>
    </div>
  );
}

// ── No-GPS modal ──────────────────────────────────────────────────────────────
function NoGpsModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            <span className="font-semibold text-sm text-foreground">
              GPS Location
            </span>
          </div>
          <button
            type="button"
            className="p-1.5 rounded-full hover:bg-muted transition-colors"
            onClick={onClose}
            aria-label="Close"
            data-ocid="call-reports.no-gps-modal.close_button"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <div className="px-5 py-6 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto">
            <MapPin className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">
            Location not available
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            GPS location was not captured when this call was submitted. The MR
            may have denied location permission.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={onClose}
            className="w-full mt-1"
            data-ocid="call-reports.no-gps-modal.cancel_button"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── GPS Location Button ───────────────────────────────────────────────────────
function GpsLocationButton({
  reportId,
  reportDate,
  mrName,
  doctorName,
  doctorAddress,
  doctorClinicName,
  station,
  submittedAt,
  token,
  initialLat,
  initialLng,
}: {
  reportId: bigint;
  reportDate: string;
  mrName: string;
  doctorName: string;
  doctorAddress?: string;
  doctorClinicName?: string;
  station?: string;
  submittedAt: bigint;
  token: string;
  initialLat?: number;
  initialLng?: number;
}) {
  const [loading, setLoading] = useState(false);
  const preKnown =
    typeof initialLat === "number" && typeof initialLng === "number";
  const preNoGps = preKnown && initialLat === 0 && initialLng === 0;
  const [gpsData, setGpsData] = useState<GpsModalData | null | "no-gps">(
    preNoGps ? "no-gps" : null,
  );
  const [showModal, setShowModal] = useState(false);

  const handleClick = useCallback(async () => {
    if (gpsData !== null) {
      setShowModal(true);
      return;
    }

    setLoading(true);
    try {
      const rawApi = api as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof rawApi.getDoctorCallGpsLocation !== "function") {
        setGpsData("no-gps");
        setShowModal(true);
        return;
      }
      const result = (await rawApi.getDoctorCallGpsLocation(token, reportId)) as
        | {
            __kind__: "ok";
            ok: {
              lat: number;
              lng: number;
              submittedAt: bigint;
              mrName: string;
              timestamp: bigint;
              accuracy?: number;
            };
          }
        | { __kind__: "err"; err: string };

      if (result.__kind__ === "ok") {
        const { lat, lng, timestamp, accuracy } = result.ok;
        if (!lat && !lng) {
          setGpsData("no-gps");
        } else {
          const submittedAtFormatted = submittedAt
            ? formatTs(submittedAt)
            : reportDate;
          setGpsData({
            reportId,
            mrName: result.ok.mrName || mrName,
            doctorName,
            submittedAt: submittedAtFormatted,
            station: station ?? "",
            lat,
            lng,
            timestamp,
            doctorAddress,
            doctorClinicName,
            accuracy,
          });
        }
      } else {
        setGpsData("no-gps");
      }
    } catch {
      setGpsData("no-gps");
    } finally {
      setLoading(false);
      setShowModal(true);
    }
  }, [
    gpsData,
    token,
    reportId,
    mrName,
    doctorName,
    station,
    submittedAt,
    reportDate,
    doctorAddress,
    doctorClinicName,
  ]);

  const hasGps = gpsData !== null && gpsData !== "no-gps";
  const isNoGps = gpsData === "no-gps";
  const isUnknown = gpsData === null;

  // Derive accuracy category for the badge
  const accuracyCategory: "verified" | "weak" | "none" | undefined = isNoGps
    ? "none"
    : hasGps
      ? (gpsData as GpsModalData).accuracy != null
        ? (gpsData as GpsModalData).accuracy! <= 100
          ? "verified"
          : (gpsData as GpsModalData).accuracy! <= 200
            ? "weak"
            : "none"
        : "verified" // accuracy unknown but GPS present → treat as verified
      : undefined; // not yet loaded — no badge shown

  return (
    <>
      <div className="inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={handleClick}
          disabled={loading}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
            isNoGps
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : hasGps
                ? "bg-green-100 text-green-800 hover:bg-green-200 border border-green-200"
                : isUnknown
                  ? "bg-muted/60 text-muted-foreground hover:bg-muted border border-border"
                  : "bg-green-50 text-green-700 hover:bg-green-100 border border-green-200"
          }`}
          aria-label={isNoGps ? "Location not available" : "View GPS location"}
          data-ocid="call-reports.gps-location-button"
        >
          {loading ? (
            <RefreshCw className="w-3 h-3 animate-spin" />
          ) : (
            <MapPin className="w-3 h-3" />
          )}
          {isNoGps ? "Location not available" : "View Location"}
        </button>
        {accuracyCategory !== undefined && (
          <GpsAccuracyBadge category={accuracyCategory} />
        )}
      </div>

      {showModal && gpsData === "no-gps" && (
        <NoGpsModal onClose={() => setShowModal(false)} />
      )}
      {showModal && gpsData !== null && gpsData !== "no-gps" && (
        <GpsMapModal data={gpsData} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}

// ── No-GPS Badge ───────────────────────────────────────────────────────────────
function NoGpsBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
      No GPS
    </span>
  );
}

// ── Collapsible Doctor Visit Card ─────────────────────────────────────────────
function DoctorVisitCard({
  visit,
  reportId,
  reportDate,
  mrName,
  submittedAt,
  token,
}: {
  visit: DoctorVisitDetail;
  reportId: bigint;
  reportDate: string;
  mrName: string;
  submittedAt: bigint;
  token: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-border rounded-lg overflow-hidden mb-2 last:mb-0">
      <div className="w-full flex items-center gap-2 p-3 bg-transparent">
        <button
          type="button"
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          <Stethoscope className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="font-semibold text-foreground text-sm flex-1 truncate min-w-0">
            Dr. {visit.doctorName}
          </span>
          <span className="text-xs text-muted-foreground truncate hidden sm:block shrink-0">
            {visit.specialization}
          </span>
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${categoryColor(visit.category)}`}
          >
            {visit.category}
          </span>
          <span className="text-xs text-muted-foreground flex-shrink-0 hidden sm:block">
            {visit.station || "—"}
          </span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          )}
        </button>

        {/* GPS button — visible in list row */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <GpsLocationButton
            reportId={reportId}
            reportDate={reportDate}
            mrName={mrName}
            doctorName={visit.doctorName}
            station={visit.station}
            submittedAt={submittedAt}
            token={token}
          />
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border bg-muted/20 p-3 space-y-3 text-sm">
          <div className="sm:hidden text-xs text-muted-foreground">
            {visit.specialization} · {visit.station || "—"}
          </div>

          <div className="flex items-center gap-2">
            <GpsLocationButton
              reportId={reportId}
              reportDate={reportDate}
              mrName={mrName}
              doctorName={visit.doctorName}
              station={visit.station}
              submittedAt={submittedAt}
              token={token}
            />
            <span className="text-xs text-muted-foreground">
              Location at time of call submission
            </span>
          </div>

          {visit.products.length > 0 && (
            <div>
              <p className="font-semibold text-xs uppercase tracking-wider text-primary mb-1.5 flex items-center gap-1">
                <Package className="w-3 h-3" /> Products Discussed
              </p>
              <ul className="space-y-1">
                {visit.products.map((p) => (
                  <li
                    key={p.productId.toString()}
                    className="flex items-start gap-2"
                  >
                    <span className="text-muted-foreground shrink-0">•</span>
                    <span className="text-foreground">
                      <strong>{p.productName}</strong>
                      {p.detailsDiscussed && (
                        <span className="text-muted-foreground ml-1">
                          {`— ${p.detailsDiscussed}`}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {visit.samplesGiven.length > 0 && (
            <div>
              <p className="font-semibold text-xs uppercase tracking-wider text-green-700 mb-1.5">
                Samples Given
              </p>
              <ul className="space-y-1">
                {visit.samplesGiven.map((s) => (
                  <li
                    key={`${s.productId.toString()}-sample`}
                    className="text-foreground"
                  >
                    {s.productName}{" "}
                    <span className="text-muted-foreground">
                      {`× ${String(s.quantity)}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {visit.giftsGiven.length > 0 && (
            <div>
              <p className="font-semibold text-xs uppercase tracking-wider text-orange-700 mb-1.5">
                Gifts Given
              </p>
              <ul className="space-y-1">
                {visit.giftsGiven.map((g) => (
                  <li
                    key={`${g.articleId.toString()}-gift`}
                    className="text-foreground"
                  >
                    {g.articleName}{" "}
                    <span className="text-muted-foreground">
                      {`× ${String(g.quantity)}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {visit.remarks && (
            <div>
              <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-1">
                Remarks
              </p>
              <p className="text-foreground italic">{visit.remarks}</p>
            </div>
          )}

          {visit.products.length === 0 &&
            visit.samplesGiven.length === 0 &&
            visit.giftsGiven.length === 0 &&
            !visit.remarks && (
              <p className="text-muted-foreground text-xs italic">
                No details recorded for this visit.
              </p>
            )}
        </div>
      )}
    </div>
  );
}

// ── Call Report Card ──────────────────────────────────────────────────────────
function CallReportCard({
  report,
  visibleDoctorFilter,
  token,
  asmName,
}: {
  report: CallReportDetail;
  visibleDoctorFilter: string;
  token: string;
  asmName?: string;
}) {
  const filtered = visibleDoctorFilter
    ? report.doctorVisits.filter(
        (v) =>
          v.doctorId.toString() === visibleDoctorFilter ||
          v.doctorName
            .toLowerCase()
            .includes(visibleDoctorFilter.toLowerCase()),
      )
    : report.doctorVisits;

  if (visibleDoctorFilter && filtered.length === 0) return null;

  return (
    <div
      className="bg-card border border-border rounded-xl overflow-hidden shadow-sm mb-4"
      data-ocid="call-reports.item"
    >
      <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 border-b border-border">
        <FileText className="w-4 h-4 text-primary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground text-sm">{report.date}</p>
          <p className="text-xs text-muted-foreground">
            Submitted: {formatTs(report.submittedAt)}
            {report.mrName && (
              <span className="ml-2 font-medium text-foreground">
                · MR: {report.mrName}
              </span>
            )}
            {asmName && (
              <span className="ml-2 text-muted-foreground">
                · ASM: {asmName}
              </span>
            )}
          </p>
        </div>
        <Badge variant="outline" className="text-xs flex-shrink-0">
          {filtered.length} doctor{filtered.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      <div className="p-3">
        {filtered.map((visit) => (
          <DoctorVisitCard
            key={`${visit.doctorId.toString()}-${visit.station}`}
            visit={visit}
            reportId={report.reportId}
            reportDate={report.date}
            mrName={report.mrName}
            submittedAt={report.submittedAt}
            token={token}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function CallReportsPage({ userRole }: CallReportsPageProps) {
  const { session } = useAuthStore();
  const token = session?.token ?? "";
  const userId = session?.userId ?? BigInt(0);
  const isMR = userRole === "MR";
  const isHRAdmin = userRole === "Admin" || userRole === "HRManager";
  const isRSM = userRole === "RSM";

  // MR list and selection
  const [mrList, setMrList] = useState<UserInfo[]>([]);
  const [mrSearch, setMrSearch] = useState("");
  const [selectedMrId, setSelectedMrId] = useState<bigint | null>(
    isMR ? userId : null,
  );
  const [mrListLoading, setMrListLoading] = useState(false);

  // ASM list and filter (for RSM and above)
  const [asmList, setAsmList] = useState<UserInfo[]>([]);
  const [selectedAsmId, setSelectedAsmId] = useState<bigint | null>(null);

  // Map mrId → asmName for display in call cards
  const [mrToAsmName, setMrToAsmName] = useState<Map<string, string>>(
    new Map(),
  );

  // Date range
  const [fromDate, setFromDate] = useState(thirtyDaysAgo());
  const [toDate, setToDate] = useState(today());

  // Report data
  const [reports, setReports] = useState<CallReportDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  // Doctor filter (within loaded reports)
  const [doctorFilter, setDoctorFilter] = useState("");

  // Bulk Day Map state
  const [dayMapPins, setDayMapPins] = useState<DayMapPin[] | null>(null);
  const [dayMapLoading, setDayMapLoading] = useState(false);
  const [dayMapMrName, setDayMapMrName] = useState("");
  const [dayMapDate, setDayMapDate] = useState("");

  // Load MR and ASM lists for non-MR roles
  useEffect(() => {
    if (isMR || !token) return;
    setMrListLoading(true);

    if (isHRAdmin) {
      api
        .listUsersByRole(
          token,
          "MR" as Parameters<typeof api.listUsersByRole>[1],
        )
        .then((users) => setMrList(users as UserInfo[]))
        .catch(() => setMrList([]))
        .finally(() => setMrListLoading(false));
    } else if (isRSM) {
      api
        .getMrsGroupedByAsmForManager(token)
        .then((groups) => {
          const asms = groups.map(
            (g) =>
              ({
                id: g.asmId,
                name: g.asmName,
                role: "ASM",
              }) as unknown as UserInfo,
          );
          setAsmList(asms);

          const mrAsmMap = new Map<string, string>();
          for (const g of groups) {
            for (const mr of g.mrs) {
              mrAsmMap.set(String(mr.mrId), g.asmName);
            }
          }
          setMrToAsmName(mrAsmMap);

          const flat = groups.flatMap((g) =>
            g.mrs.map(
              (m) =>
                ({
                  id: m.mrId,
                  name: m.mrName,
                  role: "MR",
                  reportsTo: g.asmId,
                }) as unknown as UserInfo,
            ),
          );
          setMrList(flat);
        })
        .catch(() => {
          return Promise.all([
            api.listCallReportsMrIds(token),
            api.listReportees(token, userId),
            api.listAllUsers(token),
          ]).then(([mrIds, directReportees, allUsers]) => {
            const userMap = new Map<string, UserInfo>(
              (allUsers as UserInfo[]).map((u) => [String(u.id), u]),
            );
            const asms = (directReportees as UserInfo[]).filter(
              (u) => u.role === "ASM",
            );
            setAsmList(asms);
            const mrAsmMap = new Map<string, string>();
            for (const asm of asms) {
              for (const u of allUsers as UserInfo[]) {
                if (u.role === "MR" && u.reportsTo === asm.id) {
                  mrAsmMap.set(String(u.id), asm.name);
                }
              }
            }
            setMrToAsmName(mrAsmMap);
            const enrichedMrs = mrIds
              .map((id) => userMap.get(id))
              .filter((u): u is UserInfo => u !== undefined);
            setMrList(enrichedMrs);
          });
        })
        .finally(() => setMrListLoading(false));
    } else {
      api
        .listReportees(token, userId)
        .then((users) => {
          const mrUsers = (users as UserInfo[]).filter((u) => u.role === "MR");
          setMrList(mrUsers);
        })
        .catch(() => setMrList([]))
        .finally(() => setMrListLoading(false));
    }
  }, [token, userId, isMR, isHRAdmin, isRSM]);

  // Filter MR list when ASM is selected
  const filteredMrListByAsm = useMemo(() => {
    if (!selectedAsmId) return mrList;
    return mrList.filter((u) => {
      const asmName = mrToAsmName.get(String(u.id));
      const selectedAsm = asmList.find((a) => a.id === selectedAsmId);
      return (
        u.reportsTo === selectedAsmId ||
        (selectedAsm && asmName === selectedAsm.name)
      );
    });
  }, [mrList, selectedAsmId, mrToAsmName, asmList]);

  // Fetch reports for a single MR
  const fetchReportsForMr = useCallback(
    async (
      mrId: bigint,
      from: string,
      to: string,
    ): Promise<CallReportDetail[]> => {
      return api.listCallReportsByMr(
        token,
        mrId,
        toDateMs(from),
        toDateMs(`${to}T23:59:59`),
      );
    },
    [token],
  );

  // Fetch all reports
  const fetchReports = useCallback(async () => {
    if (!token) return;

    if (isMR) {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchReportsForMr(userId, fromDate, toDate);
        setReports(result);
        setHasFetched(true);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
      return;
    }

    if (selectedMrId !== null) {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchReportsForMr(selectedMrId, fromDate, toDate);
        setReports(result);
        setHasFetched(true);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
      return;
    }

    if (isRSM && mrList.length > 0) {
      setLoading(true);
      setError(null);
      try {
        const mrsToFetch =
          filteredMrListByAsm.length > 0 ? filteredMrListByAsm : mrList;
        const allResults = await Promise.all(
          mrsToFetch.map((mr) =>
            fetchReportsForMr(mr.id, fromDate, toDate).catch(() => []),
          ),
        );
        const combined = allResults.flat();
        combined.sort((a, b) => Number(b.submittedAt - a.submittedAt));
        setReports(combined);
        setHasFetched(true);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    }
  }, [
    token,
    isMR,
    userId,
    selectedMrId,
    fromDate,
    toDate,
    isRSM,
    mrList,
    filteredMrListByAsm,
    fetchReportsForMr,
  ]);

  // Auto-fetch for MR on mount
  useEffect(() => {
    if (isMR && token) {
      fetchReports();
    }
  }, [isMR, token, fetchReports]);

  // Auto-fetch for RSM when MR list has loaded
  useEffect(() => {
    if (
      isRSM &&
      token &&
      mrList.length > 0 &&
      selectedMrId === null &&
      !hasFetched
    ) {
      fetchReports();
    }
  }, [isRSM, token, mrList.length, selectedMrId, hasFetched, fetchReports]);

  // ── Build Day Map ─────────────────────────────────────────────────────────
  const handleViewDayMap = useCallback(async () => {
    if (!token) return;
    const targetDate = fromDate;
    const targetMrId = isMR ? userId : selectedMrId;
    if (!targetMrId) return;

    const mrLabel = isMR
      ? (session?.name ?? "MR")
      : (mrList.find((u) => u.id === targetMrId)?.name ?? "MR");

    setDayMapLoading(true);
    try {
      // Use already-loaded reports or fetch for the target date
      let dayReports = reports.filter(
        (r) => r.mrId === targetMrId && r.date === targetDate,
      );
      if (dayReports.length === 0) {
        dayReports = await fetchReportsForMr(
          targetMrId,
          targetDate,
          targetDate,
        );
        dayReports = dayReports.filter((r) => r.date === targetDate);
      }

      if (dayReports.length === 0) {
        setDayMapPins([]);
        setDayMapMrName(mrLabel);
        setDayMapDate(targetDate);
        return;
      }

      const rawApi = api as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      const hasGpsApi = typeof rawApi.getDoctorCallGpsLocation === "function";

      const sorted = [...dayReports].sort((a, b) =>
        Number(a.submittedAt - b.submittedAt),
      );

      const pins: DayMapPin[] = [];
      let callNumber = 0;

      for (const report of sorted) {
        for (const visit of report.doctorVisits) {
          callNumber++;
          if (!hasGpsApi) continue;
          try {
            const res = (await rawApi.getDoctorCallGpsLocation(
              token,
              report.reportId,
            )) as
              | {
                  __kind__: "ok";
                  ok: { lat: number; lng: number; timestamp: bigint };
                }
              | { __kind__: "err"; err: string };
            if (
              res.__kind__ === "ok" &&
              (res.ok.lat !== 0 || res.ok.lng !== 0)
            ) {
              pins.push({
                callNumber,
                doctorName: visit.doctorName,
                submittedAt: formatTs(report.submittedAt),
                station: visit.station || "",
                lat: res.ok.lat,
                lng: res.ok.lng,
              });
            }
          } catch {
            // skip this pin silently
          }
        }
      }

      setDayMapPins(pins);
      setDayMapMrName(mrLabel);
      setDayMapDate(targetDate);
    } catch {
      setDayMapPins([]);
      setDayMapMrName(mrLabel);
      setDayMapDate(fromDate);
    } finally {
      setDayMapLoading(false);
    }
  }, [
    token,
    isMR,
    userId,
    selectedMrId,
    fromDate,
    reports,
    mrList,
    session,
    fetchReportsForMr,
  ]);

  // Summary calculations
  const summary = useMemo(() => {
    const totalCalls = reports.length;
    const doctorSet = new Set<string>();
    const productSet = new Set<string>();
    const mrSet = new Set<string>();
    const asmSet = new Set<string>();

    for (const r of reports) {
      mrSet.add(r.mrId.toString());
      const asmN = mrToAsmName.get(r.mrId.toString());
      if (asmN) asmSet.add(asmN);
      for (const v of r.doctorVisits) {
        doctorSet.add(v.doctorId.toString());
        for (const p of v.products) productSet.add(p.productId.toString());
      }
    }
    return {
      totalCalls,
      totalDoctors: doctorSet.size,
      totalProducts: productSet.size,
      totalMRsWithCalls: mrSet.size,
      totalAsmsWithCalls: asmSet.size,
    };
  }, [reports, mrToAsmName]);

  // Doctor filter options
  const doctorOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of reports) {
      for (const v of r.doctorVisits) {
        map.set(v.doctorId.toString(), v.doctorName);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [reports]);

  // Filtered MR list for searchable dropdown
  const filteredMrList = useMemo(
    () =>
      filteredMrListByAsm.filter((u) =>
        u.name.toLowerCase().includes(mrSearch.toLowerCase()),
      ),
    [filteredMrListByAsm, mrSearch],
  );

  // Show "View Day Map" button when a single MR is in context and reports are loaded
  const canShowDayMap =
    hasFetched &&
    !loading &&
    reports.length > 0 &&
    (isMR || selectedMrId !== null);

  // Export to Excel — includes GPS columns
  const handleExport = async () => {
    let companyProfile: import("../../backend.d").CompanyProfile | null = null;
    try {
      companyProfile = await api.getCompanyProfile(token);
    } catch {
      // ignore
    }

    const brandingRows = buildBrandingExcelRows(companyProfile);
    const selectedMr = mrList.find((u) => u.id === selectedMrId);
    const mrName = isMR
      ? (session?.name ?? "")
      : (selectedMr?.name ?? "All MRs");

    const headerRow = {
      Date: "Date",
      "MR Name": "MR Name",
      "ASM Name": "ASM Name",
      "Doctor Name": "Doctor Name",
      Specialization: "Specialization",
      Category: "Category",
      Station: "Station",
      "Date/Time Submitted": "Date/Time Submitted",
      "Products Discussed": "Products Discussed",
      "Samples Given": "Samples Given",
      "Gifts Given": "Gifts Given",
      Remarks: "Remarks",
      Latitude: "Latitude",
      Longitude: "Longitude",
      "GPS Location": "GPS Location",
    };

    // Pre-fetch GPS for all reports (up to 200 for performance)
    const rawApi = api as unknown as Record<
      string,
      (...args: unknown[]) => Promise<unknown>
    >;
    const hasGpsApi = typeof rawApi.getDoctorCallGpsLocation === "function";
    const gpsCache = new Map<string, { lat: number; lng: number } | null>();

    if (hasGpsApi) {
      await Promise.all(
        reports.slice(0, 200).map(async (r) => {
          const key = String(r.reportId);
          if (gpsCache.has(key)) return;
          try {
            const res = (await rawApi.getDoctorCallGpsLocation(
              token,
              r.reportId,
            )) as
              | {
                  __kind__: "ok";
                  ok: { lat: number; lng: number };
                }
              | { __kind__: "err"; err: string };
            gpsCache.set(
              key,
              res.__kind__ === "ok" && (res.ok.lat !== 0 || res.ok.lng !== 0)
                ? { lat: res.ok.lat, lng: res.ok.lng }
                : null,
            );
          } catch {
            gpsCache.set(key, null);
          }
        }),
      );
    }

    const dataRows: Record<string, string>[] = [];
    for (const r of reports) {
      const asmName = mrToAsmName.get(r.mrId.toString()) ?? "";
      const gps = gpsCache.get(String(r.reportId));
      const latStr = gps ? gps.lat.toFixed(6) : "No GPS";
      const lngStr = gps ? gps.lng.toFixed(6) : "No GPS";
      const locStr = gps ? `${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)}` : "";

      for (const v of r.doctorVisits) {
        if (doctorFilter && v.doctorId.toString() !== doctorFilter) continue;
        dataRows.push({
          Date: r.date,
          "MR Name": r.mrName || mrName,
          "ASM Name": asmName,
          "Doctor Name": v.doctorName,
          Specialization: v.specialization,
          Category: v.category,
          Station: v.station || "",
          "Date/Time Submitted": formatTs(r.submittedAt),
          "Products Discussed": v.products
            .map((p) =>
              p.detailsDiscussed
                ? `${p.productName} (${p.detailsDiscussed})`
                : p.productName,
            )
            .join("; "),
          "Samples Given": v.samplesGiven
            .map((s) => `${s.productName} x${s.quantity}`)
            .join("; "),
          "Gifts Given": v.giftsGiven
            .map((g) => `${g.articleName} x${g.quantity}`)
            .join("; "),
          Remarks: v.remarks || "",
          Latitude: latStr,
          Longitude: lngStr,
          "GPS Location": locStr,
        });
      }
    }

    const wb = XLSX.utils.book_new();
    const allRows = [
      ...brandingRows.map((r) => ({ Date: r[""] ?? "" })),
      { Date: `Call Reports: ${fromDate} to ${toDate}` },
      { Date: `MR: ${mrName || "All"}` },
      { Date: "" },
      headerRow,
      ...dataRows,
    ];
    const ws = XLSX.utils.json_to_sheet(allRows, { skipHeader: true });
    XLSX.utils.book_append_sheet(wb, ws, "Call Reports");
    XLSX.writeFile(
      wb,
      `call-reports-${mrName.replace(/\s+/g, "-")}-${fromDate}-${toDate}.xlsx`,
    );
  };

  const selectedMrName = isMR
    ? session?.name
    : mrList.find((u) => u.id === selectedMrId)?.name;

  // ── PDF Export (window.print) ─────────────────────────────────────────────
  const [exportingPdf, setExportingPdf] = useState(false);

  const handleExportPdf = useCallback(async () => {
    if (reports.length === 0) return;
    setExportingPdf(true);

    let companyProfile: import("../../backend.d").CompanyProfile | null = null;
    try {
      companyProfile = await api.getCompanyProfile(token);
    } catch {
      /* ignore */
    }

    const mrLabel = isMR
      ? (session?.name ?? "MR")
      : (mrList.find((u) => u.id === selectedMrId)?.name ?? "All MRs");
    const filterSummary = [
      mrLabel !== "All MRs" ? `MR - ${mrLabel}` : "All MRs",
      `Date: ${fromDate} to ${toDate}`,
      doctorFilter
        ? `Doctor: ${doctorOptions.find((d) => d.id === doctorFilter)?.name ?? doctorFilter}`
        : "",
    ]
      .filter(Boolean)
      .join(" | ");

    // Build table rows HTML
    const tableRows = reports
      .flatMap((r) => {
        const asmLabel = mrToAsmName.get(r.mrId.toString()) ?? "";
        return r.doctorVisits
          .filter(
            (v) => !doctorFilter || v.doctorId.toString() === doctorFilter,
          )
          .map(
            (v) => `
          <tr>
            <td>${r.date}</td>
            <td>${r.mrName || mrLabel}</td>
            ${asmLabel ? `<td>${asmLabel}</td>` : ""}
            <td><strong>Dr. ${v.doctorName}</strong>${v.specialization ? `<br/><span style="font-size:9px;color:#6b7280">${v.specialization}</span>` : ""}</td>
            <td><span style="background:#e0f2fe;padding:1px 5px;border-radius:3px;font-size:9px;font-weight:bold">${v.category}</span></td>
            <td>${v.station || "—"}</td>
            <td style="font-size:9px">${new Date(Number(r.submittedAt) / 1_000_000).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</td>
            <td style="font-size:9px">${v.products.map((p) => p.productName).join("; ") || "—"}</td>
            <td style="font-size:9px">${v.samplesGiven.map((s) => `${s.productName}×${s.quantity}`).join("; ") || "—"}</td>
            <td style="font-size:9px">${v.giftsGiven.map((g) => `${g.articleName}×${g.quantity}`).join("; ") || "—"}</td>
          </tr>`,
          );
      })
      .join("");

    const showAsm = isRSM && mrToAsmName.size > 0;
    const tableHtml = `
      <div class="pdf-print-summary-bar">
        <span class="pdf-print-summary-item"><strong>${summary.totalCalls}</strong> Total Calls</span>
        <span class="pdf-print-summary-item"><strong>${summary.totalDoctors}</strong> Unique Doctors</span>
        ${isRSM && summary.totalMRsWithCalls > 0 ? `<span class="pdf-print-summary-item"><strong>${summary.totalMRsWithCalls}</strong> MRs Active</span>` : ""}
        ${isRSM && summary.totalMRsWithCalls > 0 ? `<span class="pdf-print-summary-item"><strong>${summary.totalAsmsWithCalls}</strong> ASMs Active</span>` : ""}
      </div>
      <table class="pdf-print-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>MR Name</th>
            ${showAsm ? "<th>ASM</th>" : ""}
            <th>Doctor</th>
            <th>Cat.</th>
            <th>Station</th>
            <th>Submitted</th>
            <th>Products</th>
            <th>Samples</th>
            <th>Gifts</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>`;

    const cssAndRoot = buildPdfPrintCss(
      "Doctor Call Report",
      filterSummary,
      companyProfile,
    );

    // Inject or update the print CSS + root
    let existingStyle = document.getElementById("pdf-report-print-css");
    if (existingStyle) existingStyle.remove();

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = cssAndRoot;
    const styleEl = tempDiv.querySelector("#pdf-report-print-css");
    if (styleEl) document.head.appendChild(styleEl.cloneNode(true));

    let printRoot = document.getElementById("pdf-report-print-root");
    if (!printRoot) {
      printRoot = document.createElement("div");
      printRoot.id = "pdf-report-print-root";
      printRoot.style.display = "none";
      document.body.appendChild(printRoot);
    }

    printRoot.innerHTML = `
      <div class="pdf-print-page">
        <div class="pdf-print-body">
          ${companyProfile?.logoUrl ? `<img class="pdf-print-watermark" src="${companyProfile.logoUrl}" alt="" aria-hidden="true" />` : ""}
          <div class="pdf-print-footer">Krishkar Pharmaceuticals : Empowering Health</div>
          <div class="pdf-print-header">
            ${companyProfile?.logoUrl ? `<div class="pdf-print-header-logo"><img src="${companyProfile.logoUrl}" alt="${companyProfile.companyName}" style="height:60px;max-width:130px;object-fit:contain;" /></div>` : ""}
            <div class="pdf-print-header-text">
              <h2>${companyProfile?.companyName ?? "Krishkar Pharmaceuticals"}</h2>
              ${companyProfile?.address ? `<p>${companyProfile.address}</p>` : ""}
              ${companyProfile?.contactNumber ? `<p>Tel: ${companyProfile.contactNumber}${companyProfile.emailId ? ` | Email: ${companyProfile.emailId}` : ""}</p>` : ""}
            </div>
          </div>
          <p class="pdf-print-report-title">Doctor Call Report</p>
          <p class="pdf-print-filter-summary">${filterSummary}</p>
          ${tableHtml}
        </div>
      </div>`;
    printRoot.style.display = "block";

    // Set document title for filename hint
    const safeMr = mrLabel.replace(/\s+/g, "");
    const prevTitle = document.title;
    document.title = `DoctorCallReport_${safeMr}_${fromDate}_${toDate}`;

    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.title = prevTitle;
        if (printRoot) {
          printRoot.style.display = "none";
          printRoot.innerHTML = "";
        }
        existingStyle = document.getElementById("pdf-report-print-css");
        if (existingStyle) existingStyle.remove();
        setExportingPdf(false);
      }, 500);
    }, 150);
  }, [
    reports,
    token,
    isMR,
    isRSM,
    session,
    mrList,
    selectedMrId,
    fromDate,
    toDate,
    doctorFilter,
    doctorOptions,
    mrToAsmName,
    summary,
  ]);

  const showAsmFilter = isRSM && asmList.length > 0;
  const showSummaryBar = hasFetched && !loading && !error;
  const showRSMSummaryExtras = isRSM && summary.totalMRsWithCalls > 0;

  return (
    <PortalLayout portalRole={userRole}>
      <PageHeader
        title="Call Reports"
        subtitle="Doctor call records — last 30 days or custom range"
      />
      <PageContent>
        {/* ── Filters ── */}
        <div className="bg-card border border-border rounded-xl p-4 mb-5 space-y-4">
          {/* ASM selector (for RSM only) */}
          {showAsmFilter && (
            <div>
              <label
                htmlFor="asm-select"
                className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5"
              >
                Filter by ASM
              </label>
              <select
                id="asm-select"
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                value={selectedAsmId?.toString() ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setSelectedAsmId(v ? BigInt(v) : null);
                  setSelectedMrId(null);
                  setReports([]);
                  setHasFetched(false);
                  setDoctorFilter("");
                }}
                data-ocid="call-reports.asm-select"
              >
                <option value="">— All ASMs ({asmList.length}) —</option>
                {asmList.map((a) => (
                  <option key={String(a.id)} value={String(a.id)}>
                    {a.name} {a.employeeId ? `(${a.employeeId})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* MR selector (non-MR roles) */}
          {!isMR && (
            <div>
              <label
                htmlFor="mr-select"
                className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5"
              >
                Select MR{" "}
                {isRSM && (
                  <span className="text-muted-foreground font-normal normal-case">
                    (leave blank to show all MRs under you)
                  </span>
                )}
              </label>
              {mrListLoading ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="mr-search"
                      placeholder="Search MR by name…"
                      value={mrSearch}
                      onChange={(e) => setMrSearch(e.target.value)}
                      className="pl-9"
                      data-ocid="call-reports.mr-search-input"
                    />
                  </div>
                  <select
                    id="mr-select"
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={selectedMrId?.toString() ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSelectedMrId(v ? BigInt(v) : null);
                      setReports([]);
                      setHasFetched(false);
                      setDoctorFilter("");
                    }}
                    data-ocid="call-reports.mr-select"
                  >
                    <option value="">
                      {isRSM
                        ? `— All MRs (${filteredMrListByAsm.length}) —`
                        : "— Select an MR —"}
                    </option>
                    {isRSM && asmList.length > 0
                      ? asmList.map((asm) => {
                          const asmMrs = filteredMrList.filter(
                            (u) =>
                              u.reportsTo === asm.id ||
                              mrToAsmName.get(String(u.id)) === asm.name,
                          );
                          if (asmMrs.length === 0) return null;
                          return (
                            <optgroup key={String(asm.id)} label={asm.name}>
                              {asmMrs.map((u) => (
                                <option key={String(u.id)} value={String(u.id)}>
                                  {u.name}{" "}
                                  {u.employeeId ? `(${u.employeeId})` : ""}
                                </option>
                              ))}
                            </optgroup>
                          );
                        })
                      : filteredMrList.map((u) => (
                          <option key={String(u.id)} value={String(u.id)}>
                            {u.name} {u.employeeId ? `(${u.employeeId})` : ""}
                          </option>
                        ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Date range */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label
                htmlFor="from-date"
                className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5"
              >
                From Date
              </label>
              <Input
                id="from-date"
                type="date"
                value={fromDate}
                max={toDate}
                onChange={(e) => setFromDate(e.target.value)}
                data-ocid="call-reports.from-date-input"
              />
            </div>
            <div className="flex-1">
              <label
                htmlFor="to-date"
                className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5"
              >
                To Date
              </label>
              <Input
                id="to-date"
                type="date"
                value={toDate}
                min={fromDate}
                max={today()}
                onChange={(e) => setToDate(e.target.value)}
                data-ocid="call-reports.to-date-input"
              />
            </div>
          </div>

          {/* Fetch + Export + Day Map buttons */}
          <div className="flex items-center flex-wrap gap-3">
            <Button
              onClick={fetchReports}
              disabled={loading}
              data-ocid="call-reports.fetch-button"
              className="min-w-[120px]"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Loading…
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Load Reports
                </>
              )}
            </Button>
            {reports.length > 0 && (
              <Button
                variant="outline"
                onClick={handleExport}
                data-ocid="call-reports.export-button"
              >
                <Download className="w-4 h-4 mr-2" />
                Export Excel
              </Button>
            )}
            {reports.length > 0 && (
              <Button
                variant="outline"
                onClick={handleExportPdf}
                disabled={exportingPdf}
                data-ocid="call-reports.export-pdf-button"
                className="border-primary/40 text-primary hover:bg-primary/5"
              >
                {exportingPdf ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Generating PDF…
                  </>
                ) : (
                  <>
                    <Printer className="w-4 h-4 mr-2" />
                    Export PDF
                  </>
                )}
              </Button>
            )}
            {canShowDayMap && (
              <Button
                variant="outline"
                onClick={handleViewDayMap}
                disabled={dayMapLoading}
                data-ocid="call-reports.view-day-map-button"
                className="border-primary/40 text-primary hover:bg-primary/5"
              >
                {dayMapLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Building Map…
                  </>
                ) : (
                  <>
                    <MapIcon className="w-4 h-4 mr-2" />
                    View Day Map
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* ── Summary bar ── */}
        {showSummaryBar && (
          <div
            className={`grid gap-3 mb-5 ${showRSMSummaryExtras ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}
          >
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-foreground font-display">
                {summary.totalCalls}
              </p>
              <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                <FileText className="w-3 h-3" /> Total Calls
              </p>
            </div>
            {showRSMSummaryExtras && (
              <div className="bg-card border border-border rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-foreground font-display">
                  {summary.totalMRsWithCalls}
                </p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                  <Users className="w-3 h-3" /> MRs with Calls
                </p>
              </div>
            )}
            <div className="bg-card border border-border rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-foreground font-display">
                {summary.totalDoctors}
              </p>
              <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                <Stethoscope className="w-3 h-3" /> Unique Doctors
              </p>
            </div>
            {showRSMSummaryExtras && (
              <div className="bg-card border border-border rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-foreground font-display">
                  {summary.totalAsmsWithCalls}
                </p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                  <Users className="w-3 h-3" /> ASMs Active
                </p>
              </div>
            )}
            {!showRSMSummaryExtras && (
              <div className="bg-card border border-border rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-foreground font-display">
                  {summary.totalProducts}
                </p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                  <Package className="w-3 h-3" /> Unique Products
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Doctor filter ── */}
        {hasFetched && !loading && reports.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <select
                className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                value={doctorFilter}
                onChange={(e) => setDoctorFilter(e.target.value)}
                data-ocid="call-reports.doctor-filter"
              >
                <option value="">All Doctors ({doctorOptions.length})</option>
                {doctorOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {`Dr. ${d.name}`}
                  </option>
                ))}
              </select>
              {doctorFilter && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDoctorFilter("")}
                  data-ocid="call-reports.clear-doctor-filter"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ── GPS feature legend ── */}
        {hasFetched && !loading && reports.length > 0 && (
          <div className="flex items-center gap-4 mb-4 px-1 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-800 border border-green-200 text-[10px] font-medium">
                <MapPin className="w-2.5 h-2.5" /> View Location
              </span>
              GPS captured
            </span>
            <span className="flex items-center gap-1.5">
              <NoGpsBadge />
              No GPS data
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 border border-white" />
              Red pin = MR submission point
            </span>
          </div>
        )}

        {/* ── Content area ── */}
        {loading && (
          <div className="space-y-3" data-ocid="call-reports.loading_state">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-card border border-border rounded-xl p-4"
              >
                <Skeleton className="h-5 w-48 mb-2" />
                <Skeleton className="h-4 w-64 mb-3" />
                <Skeleton className="h-12 w-full" />
              </div>
            ))}
          </div>
        )}

        {error && !loading && (
          <div
            className="flex flex-col items-center justify-center py-12 text-center gap-3"
            data-ocid="call-reports.error_state"
          >
            <AlertCircle className="w-10 h-10 text-destructive opacity-60" />
            <p className="text-sm font-medium text-destructive">{error}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={fetchReports}
              data-ocid="call-reports.retry-button"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        )}

        {!loading && !error && hasFetched && reports.length === 0 && (
          <div
            className="flex flex-col items-center justify-center py-14 text-center gap-3"
            data-ocid="call-reports.empty_state"
          >
            <FileText className="w-12 h-12 text-muted-foreground opacity-40" />
            <p className="text-base font-semibold text-foreground">
              No call records found
            </p>
            <p className="text-sm text-muted-foreground max-w-xs">
              No doctor calls were recorded
              {selectedMrName ? ` for ${selectedMrName}` : ""} between{" "}
              {fromDate} and {toDate}.
            </p>
          </div>
        )}

        {!loading && !error && !hasFetched && !isMR && !isRSM && (
          <div className="flex flex-col items-center justify-center py-14 text-center gap-3">
            <Users className="w-12 h-12 text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">
              Select an MR and click "Load Reports" to view call records.
            </p>
          </div>
        )}

        {!loading && !error && reports.length > 0 && (
          <div data-ocid="call-reports.list">
            {reports.map((report, i) => (
              <CallReportCard
                key={`${String(report.reportId)}-${i}`}
                report={report}
                visibleDoctorFilter={doctorFilter}
                token={token}
                asmName={
                  isRSM ? mrToAsmName.get(report.mrId.toString()) : undefined
                }
              />
            ))}
          </div>
        )}

        {/* ── Day Map Modal ── */}
        {dayMapPins !== null &&
          (dayMapPins.length === 0 ? (
            <div
              tabIndex={-1}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
              onClick={() => setDayMapPins(null)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setDayMapPins(null);
              }}
            >
              <div className="bg-card rounded-2xl shadow-xl w-full max-w-sm p-6 text-center space-y-3">
                <MapIcon className="w-10 h-10 text-muted-foreground mx-auto opacity-50" />
                <p className="font-medium text-foreground">No GPS data found</p>
                <p className="text-sm text-muted-foreground">
                  No GPS-enabled calls found for {dayMapMrName} on {dayMapDate}.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDayMapPins(null)}
                  className="w-full"
                  data-ocid="call-reports.day-map-empty.close_button"
                >
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <DayMapModal
              pins={dayMapPins}
              mrName={dayMapMrName}
              date={dayMapDate}
              onClose={() => setDayMapPins(null)}
            />
          ))}
      </PageContent>
    </PortalLayout>
  );
}
