import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, MapPin, Radio, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Role } from "../../backend";
import {
  type EnrichedMarker,
  GPSMap,
  badgeColor,
  formatTimeAgo,
} from "../../components/GPSMap";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";

// ── Badge freshness ring colors (sidebar list) ───────────────────────────────
function freshnessRingStyle(lastReportedAt: bigint): React.CSSProperties {
  return { backgroundColor: badgeColor(lastReportedAt) };
}

export default function AdminGPSMap() {
  const { session } = useAuthStore();
  const [pins, setPins] = useState<EnrichedMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapError, setMapError] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [selected, setSelected] = useState<EnrichedMarker | null>(null);
  /** Increments every 60s to trigger badge label re-computation without
   *  re-fetching GPS data from the backend. */
  const [badgeTick, setBadgeTick] = useState(0);
  /** Increments when the map tab becomes visible. */
  const [visibilityKey] = useState(0);
  const mapRef = useRef<HTMLDivElement>(null);

  const loadLocations = useCallback(() => {
    if (!session?.token) return;
    setLoading(true);
    api
      .getEnrichedLiveLocations(session.token)
      .then((locs) => {
        setPins(locs.map((l) => ({ ...l })));
        setLastRefresh(new Date());
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        setMapError(true);
      });
  }, [session?.token]);

  // Initial load
  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  // Auto-refresh GPS data every 60 s
  useEffect(() => {
    const timer = setInterval(loadLocations, 60_000);
    return () => clearInterval(timer);
  }, [loadLocations]);

  // Tick badges every 60 s (separate from data refresh — pure label update)
  useEffect(() => {
    const timer = setInterval(() => setBadgeTick((t) => t + 1), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Role summary for the stats bar
  const roleSummary = pins.reduce<Record<string, number>>((acc, p) => {
    acc[p.role] = (acc[p.role] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <PortalLayout portalRole={Role.Admin}>
      <PageHeader
        title="GPS Live Map"
        subtitle={
          lastRefresh
            ? `Last updated: ${lastRefresh.toLocaleTimeString()}`
            : "Loading…"
        }
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={loadLocations}
            disabled={loading}
            data-ocid="btn-refresh-map"
          >
            <RefreshCw
              className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        }
      />
      <PageContent className="flex flex-col gap-4">
        {/* Stats bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-sm font-display text-foreground">
            <Radio className="w-4 h-4 text-accent animate-pulse" />
            <span>{pins.length} staff located</span>
          </div>
          {Object.entries(roleSummary).map(([role, count]) => (
            <Badge
              key={role}
              variant="secondary"
              className="text-xs font-display"
            >
              {role}: {count}
            </Badge>
          ))}
          {/* Badge freshness legend */}
          <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" />
              &lt;10 min
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400" />
              10–30 min
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" />
              &gt;30 min
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-muted-foreground/40" />
              No data
            </span>
          </div>
        </div>

        {/* Map + sidebar layout */}
        <div
          className="flex gap-4 flex-1 min-h-0"
          style={{ height: "calc(100vh - 240px)" }}
        >
          {/* Map */}
          <div className="flex-1 rounded-lg overflow-hidden border border-border bg-card relative">
            {mapError ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                <AlertTriangle className="w-8 h-8" />
                <p className="text-sm font-body">
                  Could not load live locations. Check your connection and try
                  again.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setMapError(false);
                    loadLocations();
                  }}
                  data-ocid="gps-map.retry_button"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry
                </Button>
              </div>
            ) : (
              <div ref={mapRef} className="w-full h-full">
                <GPSMap
                  enrichedMarkers={pins}
                  height="100%"
                  visibilityKey={visibilityKey}
                  badgeTick={badgeTick}
                />
              </div>
            )}
            {loading && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-card/90 border border-border rounded-full px-3 py-1 text-xs font-display text-muted-foreground flex items-center gap-1.5">
                <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
                Fetching locations…
              </div>
            )}
          </div>

          {/* Sidebar list */}
          <div
            className="w-64 flex-shrink-0 bg-card border border-border rounded-lg overflow-y-auto"
            data-ocid="gps-staff-list"
          >
            <div className="px-4 py-3 border-b border-border bg-muted/40 sticky top-0">
              <p className="text-xs font-display uppercase tracking-wider text-muted-foreground">
                Staff List
              </p>
            </div>
            {pins.length === 0 && !loading && (
              <div className="px-4 py-8 text-center text-muted-foreground text-sm font-body">
                No locations available
              </div>
            )}
            {pins.map((pin, idx) => {
              const timeAgo = formatTimeAgo(pin.lastReportedAt);
              const bColor = badgeColor(pin.lastReportedAt);
              const isSelected = selected?.userId === pin.userId;
              return (
                <button
                  type="button"
                  key={String(pin.userId)}
                  className={`w-full text-left px-4 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${isSelected ? "bg-primary/10 border-l-2 border-l-primary" : ""}`}
                  onClick={() => setSelected(pin)}
                  data-ocid={`gps-staff-row.item.${idx + 1}`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={freshnessRingStyle(pin.lastReportedAt)}
                    />
                    <span className="text-xs font-body text-foreground truncate flex-1">
                      {pin.name}
                    </span>
                    <span className="text-xs font-display text-muted-foreground flex-shrink-0">
                      {pin.role}
                    </span>
                  </div>
                  <div className="mt-1 pl-4">
                    <span
                      className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: bColor }}
                    >
                      {timeAgo}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected info bar */}
        {selected && (
          <div className="bg-card border border-border rounded-lg px-5 py-3 flex items-center gap-4 text-sm">
            <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="font-body text-foreground">
              <strong>{selected.name}</strong>
              <span className="text-muted-foreground ml-2 text-xs">
                {selected.role}
              </span>
            </span>
            <span className="font-mono text-muted-foreground text-xs">
              {selected.lat.toFixed(6)}, {selected.lng.toFixed(6)}
            </span>
            <span
              className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full text-white"
              style={{ backgroundColor: badgeColor(selected.lastReportedAt) }}
            >
              {formatTimeAgo(selected.lastReportedAt)}
            </span>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setSelected(null)}
              aria-label="Close"
              data-ocid="gps-selected.close_button"
            >
              ✕
            </button>
          </div>
        )}
      </PageContent>
    </PortalLayout>
  );
}
