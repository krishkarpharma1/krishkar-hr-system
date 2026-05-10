import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Loader2,
  MapPin,
  Navigation,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Role } from "../../backend";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { useGps } from "../../hooks/useGps";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import type { AttendanceCheckIn as CheckInRecord } from "../../types";
import { CheckInStatus } from "../../types";

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function formatTime(ts: bigint) {
  return new Date(Number(ts) / 1_000_000).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function AttendanceCheckIn() {
  const { session } = useAuthStore();
  const { coords, error: gpsError, loading: gpsLoading, refreshGps } = useGps();
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([]);
  const [checking, setChecking] = useState(false);
  const [lastResult, setLastResult] = useState<CheckInRecord | null>(null);

  const fetchCheckIns = useCallback(async () => {
    if (!session) return;
    try {
      const records = await api.getMyCheckIns(session.token);
      setCheckIns(records.filter((r) => r.date === todayISO()));
    } catch {
      // silently fail
    }
  }, [session]);

  useEffect(() => {
    if (session) fetchCheckIns();
  }, [session, fetchCheckIns]);

  const handleCheckIn = async () => {
    if (!session || !coords) return;
    setChecking(true);
    try {
      const result = await api.checkInAttendance(
        session.token,
        {
          lat: coords.lat,
          lng: coords.lng,
          timestamp: BigInt(Date.now()) * 1_000_000n,
        },
        todayISO(),
      );
      // Handle new discriminated union return type
      const record =
        "__kind__" in result
          ? result.__kind__ === "ok"
            ? result.ok
            : result.__kind__ === "alreadyCheckedIn"
              ? result.alreadyCheckedIn
              : null
          : (result as import("../../types").AttendanceCheckIn | null);
      setLastResult(record);
      await fetchCheckIns();
      if (record) {
        if (record.status === CheckInStatus.matched) {
          toast.success(
            `Checked in at ${record.matchedLocation ?? "assigned location"}`,
          );
        } else {
          toast.warning(
            `Checked in but no matching location found (${record.distance.toFixed(1)} km away)`,
          );
        }
      } else if ("__kind__" in result && result.__kind__ === "err") {
        toast.error(result.err);
      }
    } catch {
      toast.error("Check-in failed. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  const isMatched = lastResult?.status === CheckInStatus.matched;

  // Portal role is HRManager since route is under /hr,
  // but this page is for all staff — use the session role for the layout
  const portalRole =
    session?.role === "MR"
      ? Role.MR
      : session?.role === "ASM"
        ? Role.ASM
        : session?.role === "RSM"
          ? Role.RSM
          : session?.role === "ZSM"
            ? Role.ZSM
            : Role.HRManager;

  return (
    <PortalLayout portalRole={portalRole}>
      <PageHeader
        title="Location-Based Check-In"
        subtitle="Verify your attendance at your assigned location"
      />
      <PageContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Check-in card */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/30">
              <span className="text-xs uppercase tracking-wider font-display text-muted-foreground">
                Check-In Now
              </span>
            </div>
            <div className="p-6 flex flex-col items-center gap-4">
              {/* GPS Status */}
              <div
                className={`w-full rounded-lg p-4 border text-center ${
                  gpsError
                    ? "bg-destructive/10 border-destructive/30"
                    : coords
                      ? "bg-green-500/10 border-green-500/30"
                      : "bg-muted/30 border-border"
                }`}
                data-ocid="gps-status-panel"
              >
                {gpsLoading ? (
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm font-body">
                      Acquiring GPS location…
                    </span>
                  </div>
                ) : gpsError ? (
                  <div>
                    <XCircle className="w-5 h-5 text-destructive mx-auto mb-1" />
                    <p className="text-sm text-destructive font-body">
                      {gpsError}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={refreshGps}
                    >
                      Retry GPS
                    </Button>
                  </div>
                ) : coords ? (
                  <div>
                    <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto mb-1" />
                    <p className="text-sm text-green-500 font-body font-medium">
                      GPS Location Acquired
                    </p>
                    <p className="text-xs text-muted-foreground font-mono mt-1">
                      {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Navigation className="w-4 h-4" />
                    <span className="text-sm font-body">Waiting for GPS…</span>
                  </div>
                )}
              </div>

              {/* Date */}
              <div className="text-center">
                <p className="text-xs text-muted-foreground font-body">
                  Today's Date
                </p>
                <p className="text-sm font-mono text-foreground">
                  {todayISO()}
                </p>
              </div>

              {/* Check-in button */}
              <Button
                onClick={handleCheckIn}
                disabled={!coords || checking || gpsLoading}
                className="w-full"
                size="lg"
                data-ocid="checkin-btn"
              >
                {checking ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying
                    location…
                  </>
                ) : (
                  <>
                    <MapPin className="w-4 h-4 mr-2" /> Check In Now
                  </>
                )}
              </Button>

              {/* Last result */}
              {lastResult && (
                <div
                  className={`w-full rounded-lg p-4 border text-center ${
                    isMatched
                      ? "bg-green-500/10 border-green-500/30"
                      : "bg-orange-500/10 border-orange-500/30"
                  }`}
                  data-ocid="checkin-result"
                >
                  {isMatched ? (
                    <>
                      <Badge className="bg-green-500 text-white hover:bg-green-600 mb-2">
                        ✓ Location Verified
                      </Badge>
                      <p className="text-sm font-body text-foreground font-medium">
                        {lastResult.matchedLocation ?? "Assigned Location"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Within {lastResult.distance.toFixed(1)} km of assigned
                        area
                      </p>
                    </>
                  ) : (
                    <>
                      <Badge
                        variant="outline"
                        className="border-orange-500 text-orange-500 mb-2"
                      >
                        ⚠ Location Unmatched
                      </Badge>
                      <p className="text-sm font-body text-foreground font-medium">
                        Check-in recorded
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {lastResult.distance.toFixed(1)} km from nearest
                        assigned location
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Today's check-ins */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider font-display text-muted-foreground">
                Today's Check-Ins
              </span>
              <span className="text-xs font-mono text-muted-foreground">
                {todayISO()}
              </span>
            </div>

            {checkIns.length === 0 ? (
              <div
                className="p-8 text-center text-muted-foreground"
                data-ocid="checkin-history-empty"
              >
                <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-body">No check-ins recorded today</p>
                <p className="text-xs mt-1">
                  Your check-in history will appear here
                </p>
              </div>
            ) : (
              <div
                className="divide-y divide-border max-h-80 overflow-y-auto scrollbar-thin"
                data-ocid="checkin-history-list"
              >
                {checkIns.map((ci, i) => (
                  <div
                    key={`${String(ci.recordedAt)}-${i}`}
                    className="px-4 py-3 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          className={`text-xs ${
                            ci.status === CheckInStatus.matched
                              ? "bg-green-500/20 text-green-600 hover:bg-green-500/30 border border-green-500/30"
                              : "bg-orange-500/20 text-orange-600 hover:bg-orange-500/30 border border-orange-500/30"
                          }`}
                          variant="outline"
                        >
                          {ci.status === CheckInStatus.matched
                            ? "✓ Matched"
                            : "⚠ Unmatched"}
                        </Badge>
                        <span className="text-xs font-mono text-muted-foreground">
                          {formatTime(ci.recordedAt)}
                        </span>
                      </div>
                      {ci.matchedLocation && (
                        <p className="text-sm font-body text-foreground truncate">
                          {ci.matchedLocation}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground font-mono">
                        {ci.gpsCoord.lat.toFixed(4)},{" "}
                        {ci.gpsCoord.lng.toFixed(4)} · {ci.distance.toFixed(1)}{" "}
                        km
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </PageContent>
    </PortalLayout>
  );
}
