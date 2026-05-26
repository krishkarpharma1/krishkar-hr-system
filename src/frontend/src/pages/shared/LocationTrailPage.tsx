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
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  MapPin,
  RefreshCw,
  Route,
  Stethoscope,
  User,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { type AttendanceCheckIn, Role } from "../../backend";

import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { api } from "../../lib/api";
import { buildBrandingExcelRows } from "../../lib/brandingHtml";
import { useAuthStore } from "../../store/authStore";
import type { GpsCoord } from "../../types";

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";

// ── Palette for multi-employee trails ─────────────────────────────────────────
const TRAIL_COLORS = [
  "#0ea5e9", // sky-blue
  "#ef4444", // red
  "#8b5cf6", // purple
  "#f97316", // orange
  "#14b8a6", // teal
  "#ec4899", // pink
  "#92400e", // brown
  "#84cc16", // lime
];

// ── Doctor call enrichment types ──────────────────────────────────────────────
interface TrailDoctorCall {
  doctorName: string;
  doctorSpecialization: string;
  station: string;
}

interface EnrichedTrailEvent {
  coord: GpsCoord;
  activityType: string;
  doctorCalls: TrailDoctorCall[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureLeafletCSS() {
  if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = LEAFLET_CSS;
    document.head.appendChild(link);
  }
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function totalDistanceKm(coords: GpsCoord[]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversineKm(
      coords[i - 1].lat,
      coords[i - 1].lng,
      coords[i].lat,
      coords[i].lng,
    );
  }
  return total;
}

function formatTime(ts: bigint): string {
  if (ts <= 0n) return "—";
  return new Date(Number(ts) / 1_000_000).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatFullDatetime(ts: bigint): string {
  if (ts <= 0n) return "—";
  return new Date(Number(ts) / 1_000_000).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function inferActivity(index: number, total: number): string {
  if (index === 0) return "Check-In";
  if (index === total - 1) return "Attendance Out";
  if (index % 3 === 1) return "Doctor Visit";
  if (index % 3 === 2) return "Working Style";
  return "GPS Recording";
}

/** Resolve activity label: use enriched activityType when available, else infer */
function resolveActivity(
  event: EnrichedTrailEvent | null,
  index: number,
  total: number,
): string {
  if (!event) return inferActivity(index, total);
  if (event.activityType && event.activityType.trim() !== "") {
    return event.activityType;
  }
  if (event.doctorCalls && event.doctorCalls.length > 0) return "Doctor Call";
  return inferActivity(index, total);
}

/** Format doctor call names for a single GPS point (used in popups / exports) */
function formatDoctorCallNames(calls: TrailDoctorCall[]): string {
  if (!calls || calls.length === 0) return "";
  return calls
    .map((dc) => dc.doctorName)
    .filter(Boolean)
    .join(", ");
}

/**
 * Convert a plain GpsCoord array to EnrichedTrailEvents (fallback for old API).
 * activityType is inferred, doctorCalls is empty.
 */
function coordsToEnriched(coords: GpsCoord[]): EnrichedTrailEvent[] {
  return coords.map((coord, i) => ({
    coord,
    activityType: inferActivity(i, coords.length),
    doctorCalls: [],
  }));
}

// ── Multi-trail Leaflet map ───────────────────────────────────────────────────

interface EmployeeTrail {
  empId: string;
  name: string;
  color: string;
  coords: GpsCoord[];
  /** Enriched events — same length as coords. May be empty if not available. */
  events: EnrichedTrailEvent[];
}

interface MultiTrailMapProps {
  trails: EmployeeTrail[];
  activeEntry: { empId: string; coordIndex: number } | null;
  onMarkerClick: (empId: string, coordIndex: number) => void;
}

function buildMarkerPopup(
  trailName: string,
  color: string,
  event: EnrichedTrailEvent | null,
  coord: GpsCoord,
  index: number,
  total: number,
): string {
  const activity = resolveActivity(event, index, total);
  const time = formatTime(coord.timestamp);
  const hasDoctorCalls =
    event?.doctorCalls != null && event.doctorCalls.length > 0;
  const isDoctorCall = hasDoctorCalls || activity === "Doctor Call";

  const doctorSection = hasDoctorCalls
    ? event?.doctorCalls
        .map(
          (dc) =>
            `<div style="margin-top:5px;padding-top:5px;border-top:1px solid #e0f2fe;display:flex;align-items:flex-start;gap:4px;">
              <div>
                <div style="font-size:11px;font-weight:bold;color:#0369a1;">${dc.doctorName || "Unknown Doctor"}</div>
                ${dc.doctorSpecialization ? `<div style="font-size:10px;color:#6b7280;margin-top:1px;">${dc.doctorSpecialization}</div>` : ""}
                ${dc.station ? `<div style="font-size:9px;color:#9ca3af;margin-top:1px;">📍 ${dc.station}</div>` : ""}
              </div>
            </div>`,
        )
        .join("")
    : "";

  return `<div style="font-family:sans-serif;min-width:170px;padding:2px 0">
    <div style="font-size:11px;font-weight:bold;color:${color};margin-bottom:2px;">${trailName}</div>
    <div style="font-size:11px;font-weight:bold;color:${isDoctorCall ? "#0369a1" : "#111"};display:flex;align-items:center;gap:3px;">
      ${isDoctorCall ? "🩺 Doctor Call" : activity}
    </div>
    <div style="font-size:10px;color:#555;margin-top:2px;">🕐 ${time}</div>
    <div style="font-size:9px;color:#9ca3af;margin-top:1px;">${coord.lat.toFixed(5)}, ${coord.lng.toFixed(5)}</div>
    ${doctorSection}
  </div>`;
}

function MultiTrailMap({
  trails,
  activeEntry,
  onMarkerClick,
}: MultiTrailMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const onClickRef = useRef(onMarkerClick);
  onClickRef.current = onMarkerClick;

  // Init map once
  useEffect(() => {
    ensureLeafletCSS();
    let mounted = true;

    async function init() {
      if (!containerRef.current || mapRef.current) return;
      const L = await import("leaflet");
      if (!mounted || !containerRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (L.Icon.Default.prototype as any)._getIconUrl = undefined;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      if (
        containerRef.current.clientWidth === 0 ||
        containerRef.current.clientHeight === 0
      ) {
        resizeObserverRef.current = new ResizeObserver((entries) => {
          for (const e of entries) {
            const { width, height } = e.contentRect;
            if (width > 0 && height > 0) {
              resizeObserverRef.current?.disconnect();
              resizeObserverRef.current = null;
              if (mounted && !mapRef.current) doInit(L);
            }
          }
        });
        resizeObserverRef.current.observe(containerRef.current);
        return;
      }
      doInit(L);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function doInit(L: any) {
      if (!containerRef.current || mapRef.current || !mounted) return;
      const m = L.map(containerRef.current, {
        center: [20.5937, 78.9629] as [number, number],
        zoom: 5,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 18,
      }).addTo(m);
      mapRef.current = { map: m, L };
      requestAnimationFrame(() => {
        m.invalidateSize();
        setTimeout(() => m.invalidateSize(), 100);
      });
    }

    init();
    return () => {
      mounted = false;
      resizeObserverRef.current?.disconnect();
    };
  }, []);

  // Redraw all trails when trails prop changes
  useEffect(() => {
    if (!mapRef.current) return;
    const { map, L } = mapRef.current;

    map.eachLayer((layer: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!(layer as any)._url) map.removeLayer(layer);
    });

    const allLatLngs: [number, number][] = [];

    for (const trail of trails) {
      if (trail.coords.length === 0) continue;
      const latLngs: [number, number][] = trail.coords.map((c) => [
        c.lat,
        c.lng,
      ]);
      allLatLngs.push(...latLngs);

      L.polyline(latLngs, {
        color: trail.color,
        weight: 4,
        opacity: 0.85,
      }).addTo(map);

      trail.coords.forEach((c, i) => {
        const isFirst = i === 0;
        const isLast = i === trail.coords.length - 1;
        const label = isFirst ? "S" : isLast ? "E" : String(i + 1);
        const event = trail.events[i] ?? null;

        const icon = L.divIcon({
          className: "",
          html: `<div style="
            width:26px;height:26px;border-radius:50%;
            background:${trail.color};color:#fff;
            display:flex;align-items:center;justify-content:center;
            font-size:9px;font-weight:bold;
            border:2.5px solid #fff;
            box-shadow:0 2px 6px rgba(0,0,0,0.35);cursor:pointer;
          ">${label}</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });

        const popupHtml = buildMarkerPopup(
          trail.name,
          trail.color,
          event,
          c,
          i,
          trail.coords.length,
        );

        const marker = L.marker([c.lat, c.lng], { icon });
        marker.bindPopup(popupHtml, { maxWidth: 240 });
        marker.on("click", () => onClickRef.current(trail.empId, i));
        marker.addTo(map);
      });
    }

    if (allLatLngs.length > 0) {
      map.fitBounds(allLatLngs, { padding: [40, 40], maxZoom: 14 });
    } else {
      map.setView([20.5937, 78.9629], 5);
    }
  }, [trails]);

  // Pan to active entry
  useEffect(() => {
    if (!mapRef.current || !activeEntry) return;
    const trail = trails.find((t) => t.empId === activeEntry.empId);
    if (!trail) return;
    const coord = trail.coords[activeEntry.coordIndex];
    if (!coord) return;
    mapRef.current.map.panTo([coord.lat, coord.lng], { animate: true });
  }, [activeEntry, trails]);

  // Invalidate size after trail data update so map fills its container
  useEffect(() => {
    const m = mapRef.current?.map;
    if (!m) return;
    requestAnimationFrame(() => {
      m.invalidateSize();
      setTimeout(() => m.invalidateSize(), 150);
    });
  });

  return (
    <div
      ref={containerRef}
      className="w-full h-full rounded-lg overflow-hidden border border-border"
      data-ocid="location-trail-map"
    />
  );
}

// ── Single-employee trail map (delegates to multi with 1 trail) ───────────────
interface TrailMapProps {
  coords: GpsCoord[];
  events: EnrichedTrailEvent[];
  empId: string;
  empName: string;
  activeIndex: number | null;
  onMarkerClick: (i: number) => void;
}

function TrailMap({
  coords,
  events,
  empId,
  empName,
  activeIndex,
  onMarkerClick,
}: TrailMapProps) {
  const trails: EmployeeTrail[] = [
    { empId, name: empName, color: "#0ea5e9", coords, events },
  ];
  const activeEntry =
    activeIndex !== null ? { empId, coordIndex: activeIndex } : null;
  return (
    <MultiTrailMap
      trails={trails}
      activeEntry={activeEntry}
      onMarkerClick={(_id, i) => onMarkerClick(i)}
    />
  );
}

// ── Timeline item ─────────────────────────────────────────────────────────────

interface TimelineItemProps {
  index: number;
  total: number;
  coord: GpsCoord;
  event?: EnrichedTrailEvent | null;
  isActive: boolean;
  onClick: () => void;
  color?: string;
  empName?: string;
}

function TimelineItem({
  index,
  total,
  coord,
  event,
  isActive,
  onClick,
  color,
  empName,
}: TimelineItemProps) {
  const isFirst = index === 0;
  const isLast = index === total - 1;
  const markerBg =
    color ?? (isFirst ? "#22c55e" : isLast ? "#ef4444" : "#0ea5e9");
  const activity = resolveActivity(event ?? null, index, total);
  const time = formatTime(coord.timestamp);
  const doctorCalls =
    event?.doctorCalls != null && event.doctorCalls.length > 0
      ? event.doctorCalls
      : [];
  const isDoctorCallActivity =
    activity === "Doctor Call" || doctorCalls.length > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left flex items-start gap-3 p-2.5 rounded-lg border transition-colors",
        isActive
          ? "bg-primary/10 border-primary/30"
          : isDoctorCallActivity
            ? "bg-card border-border hover:bg-accent/10"
            : "bg-card border-border hover:bg-muted/30",
      )}
      data-ocid={`trail-timeline-item.${index + 1}`}
    >
      <div className="flex flex-col items-center flex-shrink-0 pt-0.5">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold border-2 border-white shadow-sm flex-shrink-0"
          style={{ background: markerBg }}
        >
          {isFirst ? "S" : isLast ? "E" : index + 1}
        </div>
        {index < total - 1 && (
          <div className="w-px h-3 bg-border mt-1 rounded-full" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        {empName && (
          <p
            className="text-[10px] font-semibold mb-0.5 truncate"
            style={{ color: color }}
          >
            {empName}
          </p>
        )}

        {/* Activity label — show "Doctor Call" prominently with stethoscope icon */}
        <p
          className={cn(
            "text-sm font-semibold leading-snug flex items-center gap-1.5",
            isDoctorCallActivity ? "text-accent" : "text-foreground",
          )}
        >
          {isDoctorCallActivity && (
            <Stethoscope className="w-3.5 h-3.5 flex-shrink-0" />
          )}
          {isDoctorCallActivity ? "Doctor Call" : activity}
        </p>

        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
          <Clock className="w-3 h-3 flex-shrink-0" />
          {time}
        </p>

        {/* Doctor call entries — each shown as a distinct card with prominent Doctor Name */}
        {doctorCalls.length > 0 && (
          <div className="mt-1.5 space-y-1">
            {doctorCalls.map((dc, di) => (
              <div
                key={`${dc.doctorName}-${di}`}
                className="flex items-start gap-1.5 bg-accent/10 border border-accent/25 rounded-md px-2 py-1.5"
              >
                <div className="min-w-0 flex-1">
                  {/* Doctor Name — bold and prominent */}
                  <p className="text-xs font-bold text-foreground leading-tight truncate">
                    {dc.doctorName || "Doctor"}
                  </p>
                  {/* Specialization — smaller, muted */}
                  {dc.doctorSpecialization && (
                    <p className="text-[10px] text-accent leading-tight mt-0.5">
                      {dc.doctorSpecialization}
                    </p>
                  )}
                  {/* Station */}
                  {dc.station && (
                    <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 flex items-center gap-0.5 truncate">
                      <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                      {dc.station}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate">
          {coord.lat.toFixed(5)}, {coord.lng.toFixed(5)}
        </p>
      </div>

      {isActive && (
        <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
      )}
    </button>
  );
}

// ── Color Legend ──────────────────────────────────────────────────────────────

function ColorLegend({ trails }: { trails: EmployeeTrail[] }) {
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 flex flex-wrap gap-x-4 gap-y-1.5 mb-3">
      {trails.map((t) => (
        <div
          key={t.empId}
          className="flex items-center gap-1.5 text-xs text-foreground"
        >
          <span
            className="w-3 h-3 rounded-full flex-shrink-0 border-2 border-white shadow-sm"
            style={{ background: t.color }}
          />
          <span className="font-medium truncate max-w-[120px]">{t.name}</span>
          {t.coords.length === 0 && (
            <span className="text-muted-foreground italic">— No data</span>
          )}
          {t.coords.length > 1 && (
            <span className="text-muted-foreground">
              {totalDistanceKm(t.coords).toFixed(1)} km
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Print CSS (for PDF export via window.print) ───────────────────────────────
const PRINT_STYLE_ID = "trail-print-css";
function ensurePrintStyle() {
  if (document.getElementById(PRINT_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = PRINT_STYLE_ID;
  style.textContent = `
@media print {
  @page { size: A4; margin: 0.5cm 2cm 0cm 2cm; }
  body { margin: 0 !important; }
  body > *:not(#trail-print-root) { display: none !important; }
  #trail-print-root { display: block !important; }
  .trail-print-page { page-break-after: always; }
  .trail-print-page:last-child { page-break-after: avoid; }
  .trail-print-header {
    margin-left: -2cm; margin-right: -2cm;
    width: calc(100% + 4cm);
    padding: 12px 2cm 12px 2cm;
    border-bottom: 2px solid #333;
    margin-bottom: 14px;
    background: #fff;
    print-color-adjust: exact; -webkit-print-color-adjust: exact;
  }
  .trail-print-footer {
    position: fixed; bottom: 0; left: -2cm; right: -2cm;
    width: calc(100% + 4cm);
    background: #00BCD4 !important;
    color: #ffffff !important; font-weight: bold;
    font-size: 14pt; text-align: center; padding: 16px 24px;
    print-color-adjust: exact; -webkit-print-color-adjust: exact;
  }
  .trail-print-table { width: 100%; border-collapse: collapse; font-size: 11px; }
  .trail-print-table th {
    background: #e0f7fa; color: #00838f;
    border: 1px solid #b2ebf2; padding: 6px 8px; text-align: left; font-weight: bold;
    print-color-adjust: exact; -webkit-print-color-adjust: exact;
  }
  .trail-print-table td { border: 1px solid #ddd; padding: 5px 8px; vertical-align: top; }
  .trail-print-table tr:nth-child(even) td { background: #f9fafb; }
  .trail-print-body { padding-bottom: 80px; font-family: Arial, sans-serif; font-size: 12px; color: #111; }
  .trail-print-summary { margin-bottom: 10px; font-size: 12px; }
  .trail-print-doctor { font-size:10px; color:#00838f; margin-top:2px; }
}
`;
  document.head.appendChild(style);
}

// ── Main page ─────────────────────────────────────────────────────────────────

interface LocationTrailPageProps {
  portalRole: Role;
}

const IS_ADMIN_HR_ROLES = [Role.Admin, Role.HRManager];

export default function LocationTrailPage({
  portalRole,
}: LocationTrailPageProps) {
  const { session } = useAuthStore();
  const isAdminHR = IS_ADMIN_HR_ROLES.includes(portalRole);

  const [employees, setEmployees] = useState<
    Array<{ userId: bigint; name: string; role: string }>
  >([]);
  const [empLoading, setEmpLoading] = useState(false);

  // Single select for non-admin, multi-select for admin/HR
  const [selectedId, setSelectedId] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [date, setDate] = useState(todayISO());

  // Single-employee trail — enriched events
  const [trailEvents, setTrailEvents] = useState<EnrichedTrailEvent[] | null>(
    null,
  );
  const [trailLoading, setTrailLoading] = useState(false);
  const [trailError, setTrailError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // Multi-employee trails
  const [multiTrails, setMultiTrails] = useState<EmployeeTrail[]>([]);
  const [multiLoading, setMultiLoading] = useState(false);
  const [multiError, setMultiError] = useState<string | null>(null);
  const [activeEntry, setActiveEntry] = useState<{
    empId: string;
    coordIndex: number;
  } | null>(null);

  // Export loading
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  // Check-In/Out log tab
  const [activeTab, setActiveTab] = useState<"trail" | "checkin-log">("trail");
  const [checkInLogs, setCheckInLogs] = useState<AttendanceCheckIn[]>([]);
  const [checkInLogsLoading, setCheckInLogsLoading] = useState(false);

  // Ensure print styles are injected once
  useEffect(() => {
    ensurePrintStyle();
  }, []);

  // Fetch check-in/out logs when that tab is active
  useEffect(() => {
    if (activeTab !== "checkin-log" || !session?.token || !date) return;
    setCheckInLogsLoading(true);
    api
      .getCheckInsByDate(session.token, date)
      .then((data) => {
        setCheckInLogs((data as AttendanceCheckIn[]) ?? []);
      })
      .catch(() => setCheckInLogs([]))
      .finally(() => setCheckInLogsLoading(false));
  }, [activeTab, date, session]);

  // Load employee list
  useEffect(() => {
    if (!session?.token) return;
    setEmpLoading(true);
    const rawApi = api as unknown as Record<
      string,
      (...args: unknown[]) => Promise<unknown>
    >;
    (typeof rawApi.getEmployeesForTrailSelector === "function"
      ? (rawApi.getEmployeesForTrailSelector(session.token) as Promise<
          Array<{ userId: bigint; name: string; role: string }>
        >)
      : Promise.resolve([])
    )
      .then((list) => setEmployees(list))
      .catch(() => setEmployees([]))
      .finally(() => setEmpLoading(false));
  }, [session?.token]);

  // ── Fetch enriched trail (single-employee) ────────────────────────────────
  async function loadTrail() {
    if (!session?.token || !selectedId) return;
    setTrailLoading(true);
    setTrailError(null);
    setTrailEvents(null);
    setActiveIndex(null);
    try {
      const rawApi = api as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;

      // Prefer the enriched API; fall back to plain trail API
      if (typeof rawApi.getTrailWithDoctorCalls === "function") {
        const result = await (rawApi.getTrailWithDoctorCalls(
          session.token,
          BigInt(selectedId),
          date,
        ) as Promise<
          { ok?: EnrichedTrailEvent[]; err?: string } | EnrichedTrailEvent[]
        >);

        // Handle variant result shape { #ok / #err } or plain array
        if (Array.isArray(result)) {
          setTrailEvents(result);
        } else if ("ok" in result && result.ok) {
          setTrailEvents(result.ok);
        } else if ("err" in result && result.err) {
          // Enriched API failed — fall back to plain trail
          await loadTrailFallback(rawApi);
        } else {
          setTrailEvents([]);
        }
      } else {
        await loadTrailFallback(rawApi);
      }
    } catch {
      setTrailError("Could not load location trail. Please try again.");
    } finally {
      setTrailLoading(false);
    }
  }

  async function loadTrailFallback(
    rawApi: Record<string, (...args: unknown[]) => Promise<unknown>>,
  ) {
    if (!session?.token || !selectedId) return;
    const coords =
      typeof rawApi.getLocationTrailForEmployee === "function"
        ? await (rawApi.getLocationTrailForEmployee(
            session.token,
            BigInt(selectedId),
            date,
          ) as Promise<GpsCoord[]>)
        : [];
    setTrailEvents(coordsToEnriched(coords));
  }

  // ── Fetch trails (multi-employee) ─────────────────────────────────────────
  async function loadMultiTrails() {
    if (!session?.token || selectedIds.length === 0) return;
    setMultiLoading(true);
    setMultiError(null);
    setMultiTrails([]);
    setActiveEntry(null);
    try {
      const rawApi = api as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      const results = await Promise.all(
        selectedIds.map(async (id, idx) => {
          const emp = employees.find((e) => String(e.userId) === id);
          try {
            let events: EnrichedTrailEvent[] = [];

            if (typeof rawApi.getTrailWithDoctorCalls === "function") {
              const result = await (rawApi.getTrailWithDoctorCalls(
                session!.token,
                BigInt(id),
                date,
              ) as Promise<
                | { ok?: EnrichedTrailEvent[]; err?: string }
                | EnrichedTrailEvent[]
              >);

              if (Array.isArray(result)) {
                events = result;
              } else if ("ok" in result && result.ok) {
                events = result.ok;
              } else {
                // fallback
                const coords =
                  typeof rawApi.getLocationTrailForEmployee === "function"
                    ? await (rawApi.getLocationTrailForEmployee(
                        session!.token,
                        BigInt(id),
                        date,
                      ) as Promise<GpsCoord[]>)
                    : [];
                events = coordsToEnriched(coords);
              }
            } else if (
              typeof rawApi.getLocationTrailForEmployee === "function"
            ) {
              const coords = await (rawApi.getLocationTrailForEmployee(
                session!.token,
                BigInt(id),
                date,
              ) as Promise<GpsCoord[]>);
              events = coordsToEnriched(coords);
            }

            return {
              empId: id,
              name: emp?.name ?? `Employee ${id}`,
              color: TRAIL_COLORS[idx % TRAIL_COLORS.length],
              coords: events.map((e) => e.coord),
              events,
            };
          } catch {
            return {
              empId: id,
              name: emp?.name ?? `Employee ${id}`,
              color: TRAIL_COLORS[idx % TRAIL_COLORS.length],
              coords: [],
              events: [],
            };
          }
        }),
      );
      setMultiTrails(results);
    } catch {
      setMultiError("Could not load trails. Please try again.");
    } finally {
      setMultiLoading(false);
    }
  }

  // Derive coords array from enriched events for single-employee mode
  const trailCoords: GpsCoord[] | null = trailEvents
    ? trailEvents.map((e) => e.coord)
    : null;

  // Combined timeline for multi mode
  interface CombinedEntry {
    empId: string;
    empName: string;
    color: string;
    coordIndex: number;
    total: number;
    coord: GpsCoord;
    event: EnrichedTrailEvent | null;
  }
  const combinedTimeline: CombinedEntry[] = multiTrails
    .flatMap((t) =>
      t.coords.map((c, i) => ({
        empId: t.empId,
        empName: t.name,
        color: t.color,
        coordIndex: i,
        total: t.coords.length,
        coord: c,
        event: t.events[i] ?? null,
      })),
    )
    .sort((a, b) => Number(a.coord.timestamp - b.coord.timestamp));

  const selectedEmployee = employees.find(
    (e) => String(e.userId) === selectedId,
  );
  const coords = trailCoords ?? [];
  const distKm = coords.length > 1 ? totalDistanceKm(coords) : 0;

  const isMultiMode = isAdminHR && selectedIds.length > 1;
  const hasMultiData = multiTrails.length > 0;
  const hasSingleData = trailCoords !== null;

  const canExportSingle = hasSingleData && coords.length > 0 && !trailLoading;
  const canExportMulti = hasMultiData && !multiLoading;
  const canExport = isMultiMode ? canExportMulti : canExportSingle;

  // ── Excel export ──────────────────────────────────────────────────────────
  async function handleExportExcel() {
    setExportingExcel(true);
    try {
      let companyProfile: import("../../backend.d").CompanyProfile | null =
        null;
      try {
        companyProfile = await api.getCompanyProfile(session?.token ?? "");
      } catch {
        /* ignore */
      }

      const brandingRows = buildBrandingExcelRows(companyProfile);
      const wb = XLSX.utils.book_new();

      const makeSheetRows = (
        empName: string,
        empEvents: EnrichedTrailEvent[],
      ) => {
        const empCoords = empEvents.map((e) => e.coord);
        const header: Record<string, string> = {
          Timestamp: "Timestamp",
          "Activity Type": "Activity Type",
          "Doctor Name": "Doctor Name",
          Latitude: "Latitude",
          Longitude: "Longitude",
          Notes: "Notes / Address",
        };
        const dataRows = empEvents.map((ev, i) => {
          const activity = resolveActivity(ev, i, empEvents.length);
          const doctorNames = formatDoctorCallNames(ev.doctorCalls ?? []);
          return {
            Timestamp: formatFullDatetime(ev.coord.timestamp),
            "Activity Type": activity,
            "Doctor Name": doctorNames,
            Latitude: String(ev.coord.lat.toFixed(6)),
            Longitude: String(ev.coord.lng.toFixed(6)),
            Notes: "",
          };
        });
        const total =
          empCoords.length > 1 ? totalDistanceKm(empCoords).toFixed(2) : "0.00";
        return [
          ...brandingRows.map((r) => ({
            Timestamp: r[""] ?? "",
            "Activity Type": "",
            "Doctor Name": "",
            Latitude: "",
            Longitude: "",
            Notes: "",
          })),
          {
            Timestamp: "Location Trail Report",
            "Activity Type": "",
            "Doctor Name": "",
            Latitude: "",
            Longitude: "",
            Notes: "",
          },
          {
            Timestamp: `Employee: ${empName}`,
            "Activity Type": "",
            "Doctor Name": "",
            Latitude: "",
            Longitude: "",
            Notes: "",
          },
          {
            Timestamp: `Date: ${date}`,
            "Activity Type": "",
            "Doctor Name": "",
            Latitude: "",
            Longitude: "",
            Notes: "",
          },
          {
            Timestamp: `Total Distance: ${total} km`,
            "Activity Type": "",
            "Doctor Name": "",
            Latitude: "",
            Longitude: "",
            Notes: "",
          },
          {
            Timestamp: "",
            "Activity Type": "",
            "Doctor Name": "",
            Latitude: "",
            Longitude: "",
            Notes: "",
          },
          header,
          ...dataRows,
          {
            Timestamp: "",
            "Activity Type": "",
            "Doctor Name": "",
            Latitude: "",
            Longitude: "",
            Notes: "",
          },
          {
            Timestamp: "Krishkar Pharmaceuticals : Empowering Health",
            "Activity Type": "",
            "Doctor Name": "",
            Latitude: "",
            Longitude: "",
            Notes: "",
          },
        ];
      };

      if (isMultiMode) {
        for (const trail of multiTrails) {
          const rows = makeSheetRows(trail.name, trail.events);
          const ws = XLSX.utils.json_to_sheet(rows, { skipHeader: true });
          const sheetName = trail.name.slice(0, 31).replace(/[:\\/?*[\]]/g, "");
          XLSX.utils.book_append_sheet(wb, ws, sheetName);
        }
        XLSX.writeFile(wb, `location-trail-comparison-${date}.xlsx`);
      } else {
        const empName = selectedEmployee?.name ?? selectedId;
        const rows = makeSheetRows(empName, trailEvents ?? []);
        const ws = XLSX.utils.json_to_sheet(rows, { skipHeader: true });
        XLSX.utils.book_append_sheet(wb, ws, "Trail");
        const safeName = empName.replace(/\s+/g, "-").toLowerCase();
        XLSX.writeFile(wb, `location-trail-${safeName}-${date}.xlsx`);
      }
    } finally {
      setExportingExcel(false);
    }
  }

  // ── PDF export (window.print) ─────────────────────────────────────────────
  async function handleExportPdf() {
    setExportingPdf(true);

    let printRoot = document.getElementById("trail-print-root");
    if (!printRoot) {
      printRoot = document.createElement("div");
      printRoot.id = "trail-print-root";
      printRoot.style.display = "none";
      document.body.appendChild(printRoot);
    }

    let companyProfile: import("../../backend.d").CompanyProfile | null = null;
    try {
      companyProfile = await api.getCompanyProfile(session?.token ?? "");
    } catch {
      /* ignore */
    }

    const companyName =
      companyProfile?.companyName ?? "Krishkar Pharmaceuticals";
    const address = companyProfile?.address ?? "";
    const logoUrl = companyProfile?.logoUrl ?? "";

    const makeTableHtml = (
      empName: string,
      empEvents: EnrichedTrailEvent[],
      distStr: string,
    ) => {
      const empCoords = empEvents.map((e) => e.coord);
      return `
        <div class="trail-print-summary">
          <strong>Employee:</strong> ${empName} &nbsp;|&nbsp; <strong>Date:</strong> ${date} &nbsp;|&nbsp; <strong>Total Distance:</strong> ${distStr}
        </div>
        <table class="trail-print-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Timestamp</th>
              <th>Activity Type</th>
              <th>Doctor Name</th>
              <th>Latitude</th>
              <th>Longitude</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${empEvents
              .map((ev, i) => {
                const activity = resolveActivity(ev, i, empCoords.length);
                const hasDoctors = ev.doctorCalls && ev.doctorCalls.length > 0;
                const doctorHtml = hasDoctors
                  ? ev.doctorCalls
                      .map(
                        (dc) =>
                          `<div class="trail-print-doctor"><strong>${dc.doctorName || "Doctor"}</strong>${dc.doctorSpecialization ? ` — ${dc.doctorSpecialization}` : ""}${dc.station ? ` (${dc.station})` : ""}</div>`,
                      )
                      .join("")
                  : "";
                return `
                    <tr>
                      <td>${i + 1}</td>
                      <td>${formatFullDatetime(ev.coord.timestamp)}</td>
                      <td>${activity}</td>
                      <td>${doctorHtml || ""}</td>
                      <td>${ev.coord.lat.toFixed(6)}</td>
                      <td>${ev.coord.lng.toFixed(6)}</td>
                      <td></td>
                    </tr>
                  `;
              })
              .join("")}
          </tbody>
        </table>
      `;
    };

    const headerHtml = `
      <div class="trail-print-header">
        ${logoUrl ? `<img src="${logoUrl}" alt="${companyName}" style="height:60px;max-width:140px;object-fit:contain;float:left;margin-right:14px;" />` : ""}
        <div>
          <h2 style="margin:0 0 4px;font-size:18px;font-weight:bold;font-family:Arial,sans-serif;">${companyName}</h2>
          ${address ? `<p style="margin:2px 0;font-size:11px;color:#444;font-family:Arial,sans-serif;">${address}</p>` : ""}
          <p style="margin:4px 0 0;font-size:14px;font-weight:bold;color:#00838f;font-family:Arial,sans-serif;">Location Trail Report</p>
        </div>
        <div style="clear:both;"></div>
      </div>
    `;

    const footerHtml = `<div class="trail-print-footer">Krishkar Pharmaceuticals : Empowering Health</div>`;

    let pagesHtml = "";
    if (isMultiMode) {
      pagesHtml = multiTrails
        .map((t) => {
          const dist =
            t.coords.length > 1
              ? `${totalDistanceKm(t.coords).toFixed(2)} km`
              : "0.00 km";
          return `<div class="trail-print-page">
          <div class="trail-print-body">
            ${headerHtml}
            ${footerHtml}
            <h3 style="margin:0 0 8px;font-size:14px;color:#0ea5e9;">${t.name}</h3>
            ${makeTableHtml(t.name, t.events, dist)}
          </div>
        </div>`;
        })
        .join("");
    } else {
      const empName = selectedEmployee?.name ?? selectedId;
      const dist = coords.length > 1 ? `${distKm.toFixed(2)} km` : "0.00 km";
      pagesHtml = `<div class="trail-print-page">
        <div class="trail-print-body">
          ${headerHtml}
          ${footerHtml}
          ${makeTableHtml(empName, trailEvents ?? [], dist)}
        </div>
      </div>`;
    }

    printRoot.innerHTML = pagesHtml;
    printRoot.style.display = "block";

    setTimeout(() => {
      window.print();
      setTimeout(() => {
        if (printRoot) {
          printRoot.style.display = "none";
          printRoot.innerHTML = "";
        }
        setExportingPdf(false);
      }, 500);
    }, 100);
  }

  // ── Multi-select checkbox list for Admin/HR ───────────────────────────────
  function toggleEmpId(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    setMultiTrails([]);
    setMultiError(null);
  }

  return (
    <PortalLayout portalRole={portalRole}>
      <PageHeader
        title="Location Trail"
        subtitle="View day-wise GPS movement trail for any employee"
      />
      <PageContent>
        {/* Controls bar */}
        <div className="bg-card border border-border rounded-lg p-4 mb-4 flex flex-wrap gap-3 items-end shadow-sm">
          {/* Employee selector — single for non-admin, multi for admin/HR */}
          <div className="flex-1 min-w-[200px]">
            <Label className="text-xs text-muted-foreground mb-1.5 block">
              {isAdminHR
                ? "Employees (select multiple to compare)"
                : "Employee"}
            </Label>

            {isAdminHR ? (
              /* Multi-select: checkbox dropdown */
              <div className="relative">
                <div className="border border-input rounded-md bg-background min-h-[36px] max-h-[160px] overflow-y-auto px-2 py-1.5 text-sm">
                  {empLoading ? (
                    <p className="text-muted-foreground py-1">
                      Loading employees…
                    </p>
                  ) : employees.length === 0 ? (
                    <p className="text-muted-foreground py-1">
                      No employees found
                    </p>
                  ) : (
                    employees.map((e) => (
                      <label
                        key={String(e.userId)}
                        className="flex items-center gap-2 py-1 cursor-pointer hover:bg-muted/30 rounded px-1"
                      >
                        <input
                          type="checkbox"
                          className="accent-primary w-3.5 h-3.5 flex-shrink-0"
                          checked={selectedIds.includes(String(e.userId))}
                          onChange={() => toggleEmpId(String(e.userId))}
                          data-ocid="trail-employee-checkbox"
                        />
                        <span className="truncate text-foreground">
                          {e.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground ml-auto flex-shrink-0">
                          {e.role}
                        </span>
                      </label>
                    ))
                  )}
                </div>
                {selectedIds.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedIds.length} employee
                    {selectedIds.length > 1 ? "s" : ""} selected
                    {selectedIds.length > 1 && (
                      <span className="text-primary ml-1">(Compare mode)</span>
                    )}
                  </p>
                )}
              </div>
            ) : (
              /* Single select for non-admin roles */
              <Select
                value={selectedId}
                onValueChange={(v) => {
                  setSelectedId(v);
                  setTrailEvents(null);
                  setTrailError(null);
                }}
                disabled={empLoading}
              >
                <SelectTrigger data-ocid="trail-employee-select">
                  <SelectValue
                    placeholder={
                      empLoading ? "Loading employees…" : "Select employee…"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={String(e.userId)} value={String(e.userId)}>
                      {e.name}{" "}
                      <span className="text-xs text-muted-foreground">
                        — {e.role}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">
              Date
            </Label>
            <Input
              type="date"
              value={date}
              max={todayISO()}
              onChange={(e) => {
                setDate(e.target.value);
                setTrailEvents(null);
                setTrailError(null);
                setMultiTrails([]);
                setMultiError(null);
              }}
              className="h-9 w-[160px]"
              data-ocid="trail-date-input"
            />
          </div>

          <Button
            onClick={isMultiMode ? loadMultiTrails : loadTrail}
            disabled={
              isMultiMode
                ? selectedIds.length === 0 || multiLoading
                : !selectedId || trailLoading
            }
            data-ocid="trail-load-button"
          >
            {trailLoading || multiLoading ? (
              <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
            ) : isMultiMode ? (
              <Users className="w-4 h-4 mr-1.5" />
            ) : (
              <Route className="w-4 h-4 mr-1.5" />
            )}
            {isMultiMode ? "Compare Trails" : "Load Trail"}
          </Button>

          {/* Export buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              disabled={!canExport || exportingExcel}
              data-ocid="trail-export-excel-button"
              title={
                !canExport
                  ? "Load a trail first to enable export"
                  : "Export to Excel"
              }
            >
              {exportingExcel ? (
                <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4 mr-1.5" />
              )}
              Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPdf}
              disabled={!canExport || exportingPdf}
              data-ocid="trail-export-pdf-button"
              title={
                !canExport
                  ? "Load a trail first to enable export"
                  : "Export to PDF"
              }
            >
              {exportingPdf ? (
                <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <FileText className="w-4 h-4 mr-1.5" />
              )}
              PDF
            </Button>
          </div>
        </div>

        {/* Tab switcher — single-employee mode only */}
        {!isMultiMode && (
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setActiveTab("trail")}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                activeTab === "trail"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              data-ocid="trail-tab-trail"
            >
              Location Trail
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("checkin-log")}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                activeTab === "checkin-log"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              data-ocid="trail-tab-checkin-log"
            >
              Check-In/Out Log
            </button>
          </div>
        )}

        {/* ── SINGLE-EMPLOYEE mode ─────────────────────────────────── */}
        {!isMultiMode && activeTab === "trail" && (
          <>
            {/* Summary badges */}
            {trailCoords !== null && selectedEmployee && (
              <div className="flex flex-wrap gap-2 mb-4">
                <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-1.5 text-sm shadow-sm">
                  <User className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  <span className="font-semibold text-foreground truncate max-w-[140px]">
                    {selectedEmployee.name}
                  </span>
                  <span className="text-muted-foreground text-xs whitespace-nowrap">
                    ({selectedEmployee.role})
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-1.5 text-sm shadow-sm">
                  <MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  <span className="font-mono text-foreground">{date}</span>
                </div>
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm border",
                    coords.length > 0
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-muted/30 border-border text-muted-foreground",
                  )}
                  data-ocid="trail-point-count"
                >
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                  {coords.length} location point{coords.length !== 1 ? "s" : ""}
                </div>
                {coords.length > 1 && (
                  <div
                    className="flex items-center gap-2 bg-accent/10 border border-accent/30 text-accent rounded-lg px-3 py-1.5 text-sm"
                    data-ocid="trail-distance-summary"
                  >
                    <Route className="w-3.5 h-3.5 flex-shrink-0" />
                    Total distance: {distKm.toFixed(2)} km
                  </div>
                )}
              </div>
            )}

            {/* Loading skeleton */}
            {trailLoading && (
              <div className="space-y-3" data-ocid="trail-loading-state">
                <Skeleton className="h-[360px] w-full rounded-lg" />
                <Skeleton className="h-16 w-full rounded-lg" />
              </div>
            )}

            {/* Error */}
            {trailError && !trailLoading && (
              <div
                className="bg-destructive/10 border border-destructive/30 rounded-lg p-8 flex flex-col items-center gap-3 text-center"
                data-ocid="trail-error-state"
              >
                <AlertCircle className="w-8 h-8 text-destructive" />
                <p className="text-sm text-destructive font-medium">
                  {trailError}
                </p>
                <Button variant="outline" size="sm" onClick={loadTrail}>
                  <RefreshCw className="w-4 h-4 mr-1.5" />
                  Retry
                </Button>
              </div>
            )}

            {/* Map + Timeline */}
            {trailCoords !== null &&
              !trailLoading &&
              !trailError &&
              coords.length > 0 && (
                <div
                  className="flex flex-col md:flex-row gap-4"
                  style={{ minHeight: 360 }}
                >
                  <div
                    className="flex-1 md:flex-[65]"
                    style={{ height: "clamp(320px, 50vh, 500px)" }}
                  >
                    <TrailMap
                      coords={coords}
                      events={trailEvents ?? []}
                      empId={selectedId}
                      empName={selectedEmployee?.name ?? selectedId}
                      activeIndex={activeIndex}
                      onMarkerClick={(i) =>
                        setActiveIndex((prev) => (prev === i ? null : i))
                      }
                    />
                  </div>

                  <div
                    className="md:flex-[35] min-w-0"
                    style={{ height: "clamp(320px, 50vh, 500px)" }}
                  >
                    <div className="h-full bg-card border border-border rounded-lg flex flex-col overflow-hidden">
                      <div className="px-4 py-3 border-b border-border bg-muted/30 flex-shrink-0">
                        <p className="text-xs uppercase tracking-wider font-display text-muted-foreground">
                          Timeline — {coords.length} events
                        </p>
                      </div>
                      <div
                        className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin"
                        data-ocid="trail-timeline-panel"
                      >
                        {(trailEvents ?? []).map((ev, i) => (
                          <TimelineItem
                            key={`${ev.coord.lat}-${ev.coord.lng}-${String(ev.coord.timestamp)}-${i}`}
                            index={i}
                            total={coords.length}
                            coord={ev.coord}
                            event={ev}
                            isActive={activeIndex === i}
                            onClick={() =>
                              setActiveIndex((prev) => (prev === i ? null : i))
                            }
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

            {/* Empty — trail loaded but zero points */}
            {trailCoords !== null &&
              !trailLoading &&
              !trailError &&
              coords.length === 0 && (
                <div
                  className="bg-card border border-border rounded-lg p-10 text-center"
                  data-ocid="trail-empty-state"
                >
                  <MapPin className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="font-display font-semibold text-foreground mb-1">
                    No location trail found for this employee on the selected
                    date.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    No GPS data was recorded for{" "}
                    {selectedEmployee?.name ?? "this employee"} on {date}.
                  </p>
                </div>
              )}

            {/* Initial state */}
            {trailCoords === null && !trailLoading && !trailError && (
              <div
                className="bg-card border border-border rounded-lg p-10 text-center"
                data-ocid="trail-initial-state"
              >
                <Route className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="font-display font-semibold text-foreground mb-1">
                  Select an employee and date to view their location trail
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Shows the GPS movement path recorded throughout the selected
                  day
                </p>
              </div>
            )}
          </>
        )}

        {/* ── Check-In/Out Log tab (single-employee mode) ────────────────── */}
        {!isMultiMode && activeTab === "checkin-log" && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">
              Employee Check-In/Out Log
            </h3>
            {checkInLogsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={`skeleton-${i}`}
                    className="h-10 bg-muted rounded animate-pulse"
                  />
                ))}
              </div>
            ) : checkInLogs.length === 0 ? (
              <div
                className="text-center py-8 text-muted-foreground bg-card border border-border rounded-lg"
                data-ocid="checkin-log-empty_state"
              >
                No check-in/out records found for the selected date.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-primary/10 text-primary">
                      <th className="border border-border px-3 py-2 text-left">
                        Employee
                      </th>
                      <th className="border border-border px-3 py-2 text-left">
                        Date
                      </th>
                      <th className="border border-border px-3 py-2 text-left">
                        Check-In Time
                      </th>
                      <th className="border border-border px-3 py-2 text-left">
                        Check-In Location
                      </th>
                      <th className="border border-border px-3 py-2 text-left">
                        Check-Out Time
                      </th>
                      <th className="border border-border px-3 py-2 text-left">
                        Check-Out Location
                      </th>
                      <th className="border border-border px-3 py-2 text-left">
                        Method
                      </th>
                      <th className="border border-border px-3 py-2 text-left">
                        Duration
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {checkInLogs.map((log, i) => {
                      const checkInMs = log.recordedAt
                        ? Number(log.recordedAt) / 1_000_000
                        : null;
                      const checkOutMs = log.checkOutTime
                        ? Number(log.checkOutTime) / 1_000_000
                        : null;
                      const durationHrs =
                        checkInMs && checkOutMs
                          ? ((checkOutMs - checkInMs) / 3_600_000).toFixed(1)
                          : null;
                      const fmtTime = (ms: number | null) =>
                        ms
                          ? new Date(ms).toLocaleTimeString("en-IN", {
                              timeZone: "Asia/Kolkata",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—";
                      const fmtDate = (ms: number | null) =>
                        ms
                          ? new Date(ms).toLocaleDateString("en-IN", {
                              timeZone: "Asia/Kolkata",
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })
                          : "—";
                      return (
                        <tr
                          key={`log-${i}`}
                          className={i % 2 === 0 ? "bg-card" : "bg-muted/30"}
                          data-ocid={`checkin-log.item.${i + 1}`}
                        >
                          <td className="border border-border px-3 py-2">
                            {(log as AttendanceCheckIn & { userId?: string })
                              .userId ?? "—"}
                          </td>
                          <td className="border border-border px-3 py-2">
                            {fmtDate(checkInMs)}
                          </td>
                          <td className="border border-border px-3 py-2">
                            {fmtTime(checkInMs)}
                          </td>
                          <td className="border border-border px-3 py-2">
                            {log.gpsCoord?.lat != null ? (
                              <a
                                href={`https://www.google.com/maps?q=${log.gpsCoord.lat},${log.gpsCoord.lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary underline text-xs"
                              >
                                View on Map
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="border border-border px-3 py-2">
                            {checkOutMs ? fmtTime(checkOutMs) : "Not Yet"}
                          </td>
                          <td className="border border-border px-3 py-2">
                            {log.checkOutGps?.lat != null ? (
                              <a
                                href={`https://www.google.com/maps?q=${log.checkOutGps.lat},${log.checkOutGps.lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary underline text-xs"
                              >
                                View on Map
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="border border-border px-3 py-2">
                            {log.wasAutoCheckedOut ? (
                              <span className="text-orange-500 font-medium text-xs">
                                Auto-Checkout 9 PM
                              </span>
                            ) : (
                              <span className="text-green-600 text-xs">
                                Manual
                              </span>
                            )}
                          </td>
                          <td className="border border-border px-3 py-2">
                            {durationHrs ? `${durationHrs} hrs` : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── MULTI-EMPLOYEE compare mode (Admin/HR only, 2+ selected) ───── */}
        {isMultiMode && (
          <>
            {/* Loading */}
            {multiLoading && (
              <div className="space-y-3" data-ocid="trail-multi-loading-state">
                <Skeleton className="h-[360px] w-full rounded-lg" />
                <Skeleton className="h-12 w-full rounded-lg" />
              </div>
            )}

            {/* Error */}
            {multiError && !multiLoading && (
              <div
                className="bg-destructive/10 border border-destructive/30 rounded-lg p-8 flex flex-col items-center gap-3 text-center"
                data-ocid="trail-multi-error-state"
              >
                <AlertCircle className="w-8 h-8 text-destructive" />
                <p className="text-sm text-destructive font-medium">
                  {multiError}
                </p>
                <Button variant="outline" size="sm" onClick={loadMultiTrails}>
                  <RefreshCw className="w-4 h-4 mr-1.5" />
                  Retry
                </Button>
              </div>
            )}

            {/* Map + combined timeline */}
            {hasMultiData && !multiLoading && !multiError && (
              <>
                {/* Per-employee distance summary */}
                <div
                  className="flex flex-wrap gap-2 mb-3"
                  data-ocid="trail-multi-distance-summary"
                >
                  {multiTrails.map((t) => (
                    <div
                      key={t.empId}
                      className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-1.5 text-sm shadow-sm"
                    >
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0 border-2 border-white shadow-sm"
                        style={{ background: t.color }}
                      />
                      <span className="font-semibold text-foreground truncate max-w-[100px]">
                        {t.name}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {t.coords.length > 1
                          ? `${totalDistanceKm(t.coords).toFixed(2)} km`
                          : "No data"}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Legend */}
                <ColorLegend trails={multiTrails} />

                <div
                  className="flex flex-col md:flex-row gap-4"
                  style={{ minHeight: 380 }}
                >
                  {/* Map */}
                  <div
                    className="flex-1 md:flex-[65]"
                    style={{ height: "clamp(340px, 55vh, 520px)" }}
                  >
                    <MultiTrailMap
                      trails={multiTrails}
                      activeEntry={activeEntry}
                      onMarkerClick={(empId, coordIndex) =>
                        setActiveEntry((prev) =>
                          prev?.empId === empId &&
                          prev.coordIndex === coordIndex
                            ? null
                            : { empId, coordIndex },
                        )
                      }
                    />
                  </div>

                  {/* Combined timeline */}
                  <div
                    className="md:flex-[35] min-w-0"
                    style={{ height: "clamp(340px, 55vh, 520px)" }}
                  >
                    <div className="h-full bg-card border border-border rounded-lg flex flex-col overflow-hidden">
                      <div className="px-4 py-3 border-b border-border bg-muted/30 flex-shrink-0">
                        <p className="text-xs uppercase tracking-wider font-display text-muted-foreground">
                          Combined Timeline — {combinedTimeline.length} events
                        </p>
                      </div>
                      <div
                        className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin"
                        data-ocid="trail-multi-timeline-panel"
                      >
                        {combinedTimeline.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center pt-6">
                            No GPS events recorded for any selected employee on
                            this date.
                          </p>
                        ) : (
                          combinedTimeline.map((entry, globalIdx) => (
                            <TimelineItem
                              key={`${entry.empId}-${entry.coordIndex}-${globalIdx}`}
                              index={entry.coordIndex}
                              total={entry.total}
                              coord={entry.coord}
                              event={entry.event}
                              isActive={
                                activeEntry?.empId === entry.empId &&
                                activeEntry.coordIndex === entry.coordIndex
                              }
                              onClick={() =>
                                setActiveEntry((prev) =>
                                  prev?.empId === entry.empId &&
                                  prev.coordIndex === entry.coordIndex
                                    ? null
                                    : {
                                        empId: entry.empId,
                                        coordIndex: entry.coordIndex,
                                      },
                                )
                              }
                              color={entry.color}
                              empName={entry.empName}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Initial state for multi mode */}
            {!hasMultiData && !multiLoading && !multiError && (
              <div
                className="bg-card border border-border rounded-lg p-10 text-center"
                data-ocid="trail-multi-initial-state"
              >
                <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="font-display font-semibold text-foreground mb-1">
                  {selectedIds.length < 2
                    ? "Select at least 2 employees to compare trails"
                    : 'Click "Compare Trails" to view selected employees on the same map'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Each employee's trail is shown in a different colour for easy
                  comparison
                </p>
              </div>
            )}
          </>
        )}

        {/* Admin/HR single-employee initial state when nothing is selected yet */}
        {isAdminHR &&
          selectedIds.length === 1 &&
          !hasMultiData &&
          !multiLoading &&
          !multiError &&
          !hasSingleData &&
          !trailLoading &&
          !trailError && (
            <div
              className="bg-card border border-border rounded-lg p-10 text-center"
              data-ocid="trail-initial-state"
            >
              <Route className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="font-display font-semibold text-foreground mb-1">
                1 employee selected — click "Load Trail" or select more to
                compare
              </p>
            </div>
          )}
      </PageContent>
    </PortalLayout>
  );
}
