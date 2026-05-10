import { useEffect, useRef } from "react";
import type { LocationRecord, UserInfo } from "../types";

// Leaflet CSS import via style injection
const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";

function ensureLeafletCSS() {
  if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = LEAFLET_CSS;
    document.head.appendChild(link);
  }
}

export interface StaffMarker {
  location: LocationRecord;
  user?: UserInfo;
}

/** Enriched marker with a lastReportedAt timestamp (nanoseconds bigint) for
 *  the time-ago badge. When provided, the badge overrides the raw timestamp
 *  from location. */
export interface EnrichedMarker {
  userId: bigint;
  name: string;
  role: string;
  lat: number;
  lng: number;
  /** nanoseconds since epoch (bigint) */
  lastReportedAt: bigint;
}

// ── Badge helpers ────────────────────────────────────────────────────────────

/** Returns ms since the lastReportedAt timestamp (bigint nanoseconds). */
function msSince(lastReportedAt: bigint): number {
  return Date.now() - Number(lastReportedAt / 1_000_000n);
}

export function badgeColor(lastReportedAt: bigint | null): string {
  if (lastReportedAt === null) return "#9ca3af"; // grey — no data today
  const diffMin = msSince(lastReportedAt) / 60_000;
  if (diffMin < 10) return "#22c55e"; // green
  if (diffMin < 30) return "#f59e0b"; // amber
  return "#ef4444"; // red
}

export function formatTimeAgo(lastReportedAt: bigint | null): string {
  if (lastReportedAt === null) return "No data today";
  const diffMs = msSince(lastReportedAt);
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

/** SVG pin with a colored circle for the role and a badge strip below. */
function createEnrichedSvg(
  pinColor: string,
  roleLabel: string,
  badgeCol: string,
  badgeText: string,
): string {
  const shortBadge =
    badgeText.length > 14 ? `${badgeText.slice(0, 13)}…` : badgeText;
  const badgeWidth = Math.max(56, shortBadge.length * 6.2 + 12);
  const totalW = Math.max(56, badgeWidth);
  const cx = totalW / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="54" viewBox="0 0 ${totalW} 54">
    <!-- pin circle -->
    <circle cx="${cx}" cy="15" r="13" fill="${pinColor}" stroke="white" stroke-width="2.5" opacity="0.96"/>
    <text x="${cx}" y="20" text-anchor="middle" fill="white" font-size="9" font-weight="700" font-family="monospace">${roleLabel.slice(0, 2)}</text>
    <!-- pin tail -->
    <path d="M${cx} 28 L${cx - 5} 22 Q${cx} 34 ${cx + 5} 22 Z" fill="${pinColor}" opacity="0.9"/>
    <!-- badge background -->
    <rect x="${(totalW - badgeWidth) / 2}" y="36" width="${badgeWidth}" height="15" rx="7" fill="${badgeCol}" opacity="0.93"/>
    <text x="${cx}" y="47" text-anchor="middle" fill="white" font-size="8.5" font-weight="600" font-family="monospace">${shortBadge}</text>
  </svg>`;
}

/** Simple pin SVG (legacy, for StaffMarker without lastReportedAt). */
function createSimpleSvg(color: string, label: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
    <circle cx="16" cy="16" r="14" fill="${color}" stroke="white" stroke-width="2.5" opacity="0.95"/>
    <text x="16" y="21" text-anchor="middle" fill="white" font-size="9" font-weight="700" font-family="monospace">${label.slice(0, 2)}</text>
    <path d="M16 30 L10 22 Q16 36 22 22 Z" fill="${color}" opacity="0.9"/>
  </svg>`;
}

// Role colors
const ROLE_PIN_COLORS: Record<string, string> = {
  MR: "#4e9eff",
  ASM: "#6be08a",
  RSM: "#f5a623",
  ZSM: "#c97cf0",
  HRManager: "#5ce0d5",
  Admin: "#e05c5c",
};

function pinColorForRole(role: string): string {
  return ROLE_PIN_COLORS[role] ?? "#4e9eff";
}

interface GPSMapProps {
  markers?: StaffMarker[];
  enrichedMarkers?: EnrichedMarker[];
  height?: string;
  className?: string;
  /** Pass a unique key or incrementing counter when the containing tab becomes
   *  visible so the map invalidates its size. Defaults to 0. */
  visibilityKey?: number;
  /** Tick counter that increments every 60s — triggers badge label re-render
   *  without re-fetching data. */
  badgeTick?: number;
}

export function GPSMap({
  markers = [],
  enrichedMarkers,
  height = "400px",
  className = "",
  visibilityKey = 0,
  badgeTick = 0,
}: GPSMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  const prevVisKeyRef = useRef<number>(visibilityKey);

  // ── Init map ────────────────────────────────────────────────────────────────
  useEffect(() => {
    ensureLeafletCSS();

    let isMounted = true;
    let resizeObserver: ResizeObserver | null = null;

    async function initMap() {
      if (!mapRef.current || mapInstanceRef.current) return;

      const L = await import("leaflet");

      if (!isMounted || !mapRef.current) return;

      if (
        mapRef.current.clientWidth === 0 ||
        mapRef.current.clientHeight === 0
      ) {
        resizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const { width, height: h } = entry.contentRect;
            if (width > 0 && h > 0) {
              resizeObserver?.disconnect();
              resizeObserver = null;
              if (isMounted && !mapInstanceRef.current) {
                doInit(L);
              }
            }
          }
        });
        resizeObserver.observe(mapRef.current);
        return;
      }

      doInit(L);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function doInit(L: any) {
      if (!mapRef.current || mapInstanceRef.current || !isMounted) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (L.Icon.Default.prototype as any)._getIconUrl = undefined;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const defaultCenter: [number, number] = [20.5937, 78.9629];
      const defaultZoom = 5;

      const map = L.map(mapRef.current, {
        center: defaultCenter,
        zoom: defaultZoom,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 18,
      }).addTo(map);

      mapInstanceRef.current = { map, L };

      requestAnimationFrame(() => {
        if (isMounted && mapInstanceRef.current) {
          mapInstanceRef.current.map.invalidateSize();
        }
        setTimeout(() => {
          if (isMounted && mapInstanceRef.current) {
            mapInstanceRef.current.map.invalidateSize();
          }
        }, 100);
      });
    }

    initMap();

    return () => {
      isMounted = false;
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
    };
  }, []);

  // ── Invalidate size on tab switch ─────────────────────────────────────────
  useEffect(() => {
    if (prevVisKeyRef.current === visibilityKey) return;
    prevVisKeyRef.current = visibilityKey;

    if (!mapInstanceRef.current) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.map.invalidateSize();
        }
        setTimeout(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.map.invalidateSize();
          }
        }, 150);
      });
    });
  }, [visibilityKey]);

  // ── Render enriched markers (with time-ago badges) ────────────────────────
  // Keep a ref to the latest enrichedMarkers so badgeTick can re-render icons
  // without the markers array being in the effect dependency list.
  const enrichedMarkersRef = useRef(enrichedMarkers);
  enrichedMarkersRef.current = enrichedMarkers;

  // Stable ref to the render logic so effects can call it without being
  // listed as deps (re-creating it every render would cause infinite loops).
  const renderEnrichedRef = useRef(
    (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mapInst: { map: any; L: any },
      data: EnrichedMarker[],
    ) => {
      const { map, L } = mapInst;
      map.invalidateSize();

      map.eachLayer((layer: unknown) => {
        if (
          (layer as Record<string, unknown>)?.options &&
          (layer as Record<string, unknown>)?._latlng
        ) {
          map.removeLayer(layer);
        }
      });

      if (data.length === 0) return;

      const bounds: [number, number][] = [];

      for (const m of data) {
        if (m.lat === 0 && m.lng === 0) continue;

        const pinColor = pinColorForRole(m.role);
        const bColor = badgeColor(m.lastReportedAt);
        const bText = formatTimeAgo(m.lastReportedAt);
        const svgHtml = createEnrichedSvg(pinColor, m.role, bColor, bText);

        const icon = L.divIcon({
          html: svgHtml,
          className: "",
          iconSize: [64, 54],
          iconAnchor: [32, 54],
          popupAnchor: [0, -54],
        });

        const lastTimeStr =
          m.lastReportedAt > 0n
            ? new Date(Number(m.lastReportedAt / 1_000_000n)).toLocaleString(
                "en-IN",
                { dateStyle: "short", timeStyle: "medium" },
              )
            : "No data today";

        const popupHtml = `
          <div style="font-family:sans-serif;min-width:190px;max-width:240px">
            <div style="font-weight:700;font-size:13px;margin-bottom:3px">${m.name}</div>
            <div style="font-size:11px;color:#666;margin-bottom:6px">${m.role}</div>
            <hr style="margin:4px 0;border:none;border-top:1px solid #eee"/>
            <div style="font-size:11px;color:#444;margin-bottom:2px">
              <strong>Last reported:</strong> ${lastTimeStr}
            </div>
            <div style="font-size:11px;color:#444;margin-bottom:2px">
              <strong>Coords:</strong> ${m.lat.toFixed(5)}, ${m.lng.toFixed(5)}
            </div>
            <div style="margin-top:6px;display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:600;background:${bColor};color:white">
              ${bText}
            </div>
          </div>`;

        L.marker([m.lat, m.lng], { icon }).bindPopup(popupHtml).addTo(map);
        bounds.push([m.lat, m.lng]);
      }

      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
      }
    },
  );

  // Re-render when data changes
  useEffect(() => {
    if (!enrichedMarkers) return;

    if (!mapInstanceRef.current) {
      const timer = setTimeout(() => {
        if (mapInstanceRef.current && enrichedMarkersRef.current) {
          renderEnrichedRef.current(
            mapInstanceRef.current,
            enrichedMarkersRef.current,
          );
        }
      }, 800);
      return () => clearTimeout(timer);
    }
    renderEnrichedRef.current(mapInstanceRef.current, enrichedMarkers);
  }, [enrichedMarkers]);

  // Re-render badge labels every tick (without re-fetching data)
  useEffect(() => {
    if (badgeTick === 0) return; // skip on mount — initial render handled above
    if (!mapInstanceRef.current || !enrichedMarkersRef.current) return;
    renderEnrichedRef.current(
      mapInstanceRef.current,
      enrichedMarkersRef.current,
    );
  }, [badgeTick]);

  // ── Render legacy StaffMarkers ─────────────────────────────────────────────
  useEffect(() => {
    // Skip if enriched mode is active
    if (enrichedMarkers !== undefined) return;

    if (!mapInstanceRef.current) {
      const timer = setTimeout(() => {
        if (!mapInstanceRef.current) return;
        renderLegacy();
      }, 800);
      return () => clearTimeout(timer);
    }
    renderLegacy();

    function renderLegacy() {
      if (!mapInstanceRef.current) return;
      const { map, L } = mapInstanceRef.current;
      map.invalidateSize();

      map.eachLayer((layer: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (
          (layer as Record<string, unknown>)?.options &&
          (layer as Record<string, unknown>)?._latlng
        ) {
          map.removeLayer(layer);
        }
      });

      if (markers.length === 0) return;

      const bounds: [number, number][] = [];

      for (const m of markers) {
        const { lat, lng } = m.location;
        if (lat === 0 && lng === 0) continue;

        const roleLabel = m.user?.role ?? "MR";
        const name = m.user?.name ?? `Employee ${m.location.employeeId}`;
        const lastSeen = new Date(
          Number(m.location.timestamp) / 1_000_000,
        ).toLocaleString("en-IN");

        const pinColor = pinColorForRole(roleLabel);
        const svgHtml = createSimpleSvg(pinColor, roleLabel);
        const icon = L.divIcon({
          html: svgHtml,
          className: "",
          iconSize: [32, 40],
          iconAnchor: [16, 40],
          popupAnchor: [0, -40],
        });

        const marker = L.marker([lat, lng], { icon });
        marker.bindPopup(
          `<div style="font-family:sans-serif;min-width:160px">
            <strong style="font-size:13px">${name}</strong><br/>
            <span style="color:#888;font-size:11px">${roleLabel}</span><br/>
            <hr style="margin:4px 0;border-color:#eee"/>
            <span style="font-size:11px">Last seen: ${lastSeen}</span><br/>
            <span style="font-size:11px">📍 ${lat.toFixed(4)}, ${lng.toFixed(4)}</span>
          </div>`,
        );
        marker.addTo(map);
        bounds.push([lat, lng]);
      }

      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, enrichedMarkers]);

  return (
    <div
      ref={mapRef}
      style={{ height }}
      className={`rounded-lg overflow-hidden border border-border ${className}`}
      data-ocid="gps-map"
    />
  );
}
