import { Button } from "@/components/ui/button";
import { AlertCircle, MapPin, RefreshCw, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import type { Role } from "../../backend.d";
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
  StatCard,
} from "../../components/PortalLayout";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";

interface LiveLocationsPageProps {
  portalRole: Role;
  title: string;
  subtitle: string;
  /** Pass an incrementing counter when the containing tab becomes visible so
   *  the embedded GPSMap invalidates its size. Forwarded straight to GPSMap. */
  visibilityKey?: number;
}

export default function LiveLocationsPage({
  portalRole,
  title,
  subtitle,
  visibilityKey = 0,
}: LiveLocationsPageProps) {
  const { session } = useAuthStore();
  const [pins, setPins] = useState<EnrichedMarker[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  /** Increments every 60s to trigger badge label re-computation without
   *  re-fetching GPS data. */
  const [badgeTick, setBadgeTick] = useState(0);

  const token = session?.token ?? "";

  // Initial load
  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    api
      .getEnrichedLiveLocations(token)
      .then((locs) => {
        setPins(locs);
        setLastRefreshed(new Date());
      })
      .catch((err: unknown) => {
        console.error("LiveLocationsPage fetch error:", err);
        setError(
          "Could not load team locations. Please check your connection and try again.",
        );
        setPins([]);
      })
      .finally(() => setLoading(false));
  }, [token]);

  // Auto-refresh GPS data every 60 s
  useEffect(() => {
    if (!token) return;
    const timer = setInterval(() => {
      api
        .getEnrichedLiveLocations(token)
        .then((locs) => {
          setPins(locs);
          setLastRefreshed(new Date());
          setRefreshFailed(false);
        })
        .catch(() => setRefreshFailed(true));
    }, 60_000);
    return () => clearInterval(timer);
  }, [token]);

  // Tick badges every 60 s — pure label update, no data fetch
  useEffect(() => {
    const timer = setInterval(() => setBadgeTick((t) => t + 1), 60_000);
    return () => clearInterval(timer);
  }, []);

  function handleRefresh() {
    if (!token) return;
    setLoading(true);
    setRefreshFailed(false);
    api
      .getEnrichedLiveLocations(token)
      .then((locs) => {
        setPins(locs);
        setError(null);
        setRefreshFailed(false);
        setLastRefreshed(new Date());
      })
      .catch((err: unknown) => {
        console.error("LiveLocationsPage refresh error:", err);
        setRefreshFailed(true);
      })
      .finally(() => setLoading(false));
  }

  return (
    <PortalLayout portalRole={portalRole}>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <div className="flex items-center gap-2">
            {refreshFailed && (
              <span className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">
                <WifiOff className="w-3 h-3 shrink-0" />
                Showing cached data
              </span>
            )}
            {lastRefreshed && !refreshFailed && (
              <span className="text-xs text-muted-foreground hidden sm:inline">
                Updated{" "}
                {lastRefreshed.toLocaleTimeString("en-IN", {
                  timeStyle: "short",
                })}
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handleRefresh}
              disabled={loading}
              data-ocid="btn-refresh-locations"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`}
              />
              {loading ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
        }
      />
      <PageContent>
        {/* Freshness legend */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4 flex-wrap">
          <span className="font-medium text-foreground">GPS Freshness:</span>
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
            No data today
          </span>
        </div>

        {/* Initial load error */}
        {error && (
          <div
            className="flex items-start gap-3 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3 mb-6"
            data-ocid="live-locations.error_state"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{error}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRefresh}
              disabled={loading}
              className="flex-shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10"
              data-ocid="live-locations.retry_button"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Retry
            </Button>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Total Tracked"
            value={loading ? "…" : pins.length}
            icon={MapPin}
          />
          <StatCard
            label="Live (< 10 min)"
            value={
              loading
                ? "…"
                : pins.filter(
                    (p) =>
                      Date.now() - Number(p.lastReportedAt / 1_000_000n) <
                      600_000,
                  ).length
            }
            icon={MapPin}
          />
        </div>

        {/* Map */}
        <div className="bg-card border border-border rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <MapPin className="w-4 h-4" /> Live Field Locations —{" "}
              {pins.length} tracked
            </h3>
          </div>
          <GPSMap
            enrichedMarkers={pins}
            height="420px"
            visibilityKey={visibilityKey}
            badgeTick={badgeTick}
          />
        </div>

        {/* Staff list with last-reported-time badges */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-display font-semibold text-sm text-foreground">
              Field Staff Summary
            </h3>
          </div>
          <div className="divide-y divide-border max-h-72 overflow-y-auto scrollbar-thin">
            {pins.map((pin, idx) => {
              const bColor = badgeColor(pin.lastReportedAt);
              const timeAgo = formatTimeAgo(pin.lastReportedAt);
              const lastTimeStr =
                pin.lastReportedAt > 0n
                  ? new Date(
                      Number(pin.lastReportedAt / 1_000_000n),
                    ).toLocaleString("en-IN", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })
                  : null;
              return (
                <div
                  key={String(pin.userId)}
                  className="flex items-center justify-between px-4 py-3"
                  data-ocid={`location-row.item.${idx + 1}`}
                >
                  <div className="min-w-0 flex-1 flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: bColor }}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {pin.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {pin.role}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <span
                      className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full text-white mb-1"
                      style={{ backgroundColor: bColor }}
                    >
                      {timeAgo}
                    </span>
                    {lastTimeStr && (
                      <p className="text-[10px] text-muted-foreground">
                        {lastTimeStr}
                      </p>
                    )}
                    {pin.lat !== 0 && pin.lng !== 0 && (
                      <a
                        href={`https://maps.google.com/?q=${pin.lat},${pin.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        View on Maps
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
            {pins.length === 0 && !loading && (
              <div
                className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2"
                data-ocid="live-locations.empty_state"
              >
                <MapPin className="w-8 h-8 opacity-30" />
                <p className="text-sm">No MRs are currently active</p>
                <p className="text-xs text-center max-w-xs">
                  GPS pins will appear here once field staff check in with
                  location enabled.
                </p>
              </div>
            )}
          </div>
        </div>
      </PageContent>
    </PortalLayout>
  );
}
