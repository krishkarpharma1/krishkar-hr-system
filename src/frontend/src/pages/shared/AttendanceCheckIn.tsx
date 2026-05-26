/**
 * Shared Location-Based Attendance Check-In page.
 * Enforces single check-in and single check-out per day.
 * Works for MR, ASM, RSM, ZSM, HRManager, Admin portals.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";
import {
  CheckCircle2,
  Clock,
  Loader2,
  LogIn,
  LogOut as LogOutIcon,
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
  });
}

function roleFromString(role: string): Role {
  const map: Record<string, Role> = {
    MR: Role.MR,
    ASM: Role.ASM,
    RSM: Role.RSM,
    ZSM: Role.ZSM,
    HRManager: Role.HRManager,
    Admin: Role.Admin,
  };
  return map[role] ?? Role.HRManager;
}

export default function AttendanceCheckIn() {
  const { session } = useAuthStore();
  const _navigate = useNavigate();
  const { coords, error: gpsError, loading: gpsLoading, refreshGps } = useGps();

  const [todayRecord, setTodayRecord] = useState<CheckInRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<CheckInRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [showAutoCheckoutWarning, setShowAutoCheckoutWarning] = useState(false);

  const today = todayISO();

  const loadTodayCheckIn = useCallback(async () => {
    if (!session) return;
    try {
      const records = await api.getMyCheckIns(session.token);
      const todayCheckIn = records.find((r) => r.date === today) ?? null;
      setTodayRecord(todayCheckIn);
      setHistoryRecords(records.slice().reverse().slice(0, 10));

      // Check if yesterday's record has wasAutoCheckedOut === true
      const nowIST = new Date(
        new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
      );
      const yesterdayIST = new Date(nowIST);
      yesterdayIST.setDate(yesterdayIST.getDate() - 1);
      const yesterdayKey = yesterdayIST.toISOString().split("T")[0];
      const yesterdayRecord = records.find((r) => r.date === yesterdayKey);
      if (yesterdayRecord?.wasAutoCheckedOut === true) {
        const dismissed = localStorage.getItem(
          `autoCheckoutWarning_${yesterdayKey}`,
        );
        if (!dismissed) {
          setShowAutoCheckoutWarning(true);
        }
      }
    } catch {
      // silently fail
    } finally {
      setHistoryLoading(false);
    }
  }, [session, today]);

  useEffect(() => {
    if (session) loadTodayCheckIn();
  }, [session, loadTodayCheckIn]);

  const handleCheckIn = async () => {
    if (!session) return;
    if (!coords) {
      toast.error("GPS location is required to check in.");
      return;
    }
    // Prevent double-submit
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const result = await api.checkInAttendance(
        session.token,
        {
          lat: coords.lat,
          lng: coords.lng,
          timestamp: BigInt(Date.now()) * 1_000_000n,
        },
        today,
      );
      if ("alreadyCheckedIn" in result) {
        const time = formatTime(result.alreadyCheckedIn.recordedAt);
        toast.info(`You've already checked in today at ${time}.`);
        setTodayRecord(result.alreadyCheckedIn);
      } else if ("ok" in result) {
        const time = formatTime(result.ok.recordedAt);
        toast.success(
          result.ok.status === CheckInStatus.matched
            ? `Checked in at ${time} — ${result.ok.matchedLocation ?? "assigned location"}`
            : `Checked in at ${time}`,
        );
        setTodayRecord(result.ok);
      } else {
        toast.error("Check-in failed. Please try again.");
      }
      // Re-query from backend to confirm recorded state
      await loadTodayCheckIn();
    } catch {
      toast.error("Check-in failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckOut = async () => {
    if (!session) return;
    setCheckingOut(true);
    try {
      const coord = coords
        ? {
            lat: coords.lat,
            lng: coords.lng,
            timestamp: BigInt(Date.now()) * 1_000_000n,
          }
        : null;
      const result = await api.checkOutAttendance(session.token, coord, today);
      if (result.__kind__ === "ok") {
        toast.success("Checked out successfully.");
        setTodayRecord(result.ok);
        // After successful checkout, trigger DCR auto-fill for MR role only
        if (session.role === "MR") {
          await handleDcrAutoFillAfterCheckout();
        }
      } else if (result.__kind__ === "alreadyCheckedOut") {
        toast.info("You have already checked out today.");
      } else if (result.__kind__ === "notCheckedIn") {
        toast.warning("You haven't checked in today yet.");
      } else {
        toast.error(result.err);
      }
      await loadTodayCheckIn();
    } catch {
      toast.error("Check-out failed. Please try again.");
    } finally {
      setCheckingOut(false);
    }
  };

  /**
   * Called after a successful MR checkout.
   * Checks DCR settings and navigates to auto-fill preview if enabled,
   * or auto-submits if enableAutoSubmissionOnCheckout is true.
   */
  const handleDcrAutoFillAfterCheckout = async () => {
    if (!session) return;
    try {
      // Check DCR settings
      const settings = await api.getDcrSettings(session.token);
      const rawSettings = settings as unknown as Record<string, unknown>;
      const autoFillEnabled = rawSettings.enableAutoFillOnCheckout !== false;
      const autoSubmitEnabled =
        rawSettings.enableAutoSubmissionOnCheckout === true;

      if (!autoFillEnabled) {
        // Auto-fill disabled — nothing extra to do
        return;
      }

      if (autoSubmitEnabled) {
        // Auto-submit immediately without MR review
        toast.info("Your DCR for today is being submitted automatically.");
        const rawApi = api as unknown as Record<
          string,
          (...args: unknown[]) => Promise<unknown>
        >;
        if (typeof rawApi.submitAutoFilledDcr === "function") {
          await rawApi.submitAutoFilledDcr(session.token, {
            date: today,
            remarks: "",
            submissionType: "autoCheckout",
            mrReviewedAndEdited: false,
          });
          toast.success("Your DCR has been automatically submitted.");
        }
        return;
      }

      // Auto-fill enabled, auto-submit disabled — navigate to preview
      const rawApi = api as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      let _autoFillData: unknown = null;
      if (typeof rawApi.getAutoFillDcr === "function") {
        _autoFillData = await rawApi.getAutoFillDcr(session.token, today);
      }

      window.location.href = `/mr/dcr-auto-preview?date=${today}`;
    } catch {
      // Non-blocking — if auto-fill fails, checkout still succeeded
    }
  };

  const alreadyCheckedIn = !!todayRecord;
  const alreadyCheckedOut = alreadyCheckedIn && !!todayRecord?.checkOutTime;

  return (
    <PortalLayout portalRole={roleFromString(session?.role ?? "HRManager")}>
      <PageHeader
        title="Location-Based Check-In"
        subtitle="Verify your attendance at your assigned location"
      />
      <PageContent>
        {showAutoCheckoutWarning && (
          <div
            className="flex items-start gap-3 bg-amber-50 border border-amber-300 text-amber-800 px-4 py-3 rounded-lg mb-4"
            data-ocid="auto-checkout-warning"
          >
            <span className="text-lg" aria-hidden="true">
              ⚠
            </span>
            <div className="flex-1">
              <p className="font-semibold text-sm">Auto-Checkout Notice</p>
              <p className="text-sm">
                System Auto-Checked you out at 9:00 PM yesterday. Please
                remember to complete your daily work report manually.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const nowIST = new Date(
                  new Date().toLocaleString("en-US", {
                    timeZone: "Asia/Kolkata",
                  }),
                );
                const y = new Date(nowIST);
                y.setDate(y.getDate() - 1);
                const yesterdayKey = y.toISOString().split("T")[0];
                localStorage.setItem(
                  `autoCheckoutWarning_${yesterdayKey}`,
                  "dismissed",
                );
                setShowAutoCheckoutWarning(false);
              }}
              className="text-amber-600 hover:text-amber-800 font-bold text-xl leading-none"
              aria-label="Dismiss warning"
            >
              ×
            </button>
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Check-in / Check-out action card */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/30">
              <span className="text-xs uppercase tracking-wider font-display text-muted-foreground">
                Today's Attendance — {today}
              </span>
            </div>
            <div className="p-6 flex flex-col gap-5">
              {/* Status summary if already checked in */}
              {alreadyCheckedIn && todayRecord && (
                <div
                  className="rounded-lg border border-green-500/30 bg-green-500/8 p-4 space-y-2"
                  data-ocid="checkin-status-card"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Checked in today at{" "}
                        <span className="font-mono text-green-600">
                          {formatTime(todayRecord.recordedAt)}
                        </span>
                      </p>
                      {todayRecord.matchedLocation && (
                        <p className="text-xs text-muted-foreground">
                          {todayRecord.matchedLocation}
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="text-xs font-mono text-muted-foreground">
                    GPS: {todayRecord.gpsCoord.lat.toFixed(4)},{" "}
                    {todayRecord.gpsCoord.lng.toFixed(4)}
                  </p>
                  {alreadyCheckedOut && todayRecord.checkOutTime && (
                    <div className="flex items-center gap-2 pt-1 border-t border-green-500/20">
                      <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                      <p className="text-sm text-muted-foreground">
                        Checked out at{" "}
                        <span className="font-mono font-semibold text-foreground">
                          {formatTime(todayRecord.checkOutTime)}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* GPS status */}
              <div
                className={`rounded-lg p-4 border text-center ${
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
                    <span className="text-sm">Acquiring GPS location…</span>
                  </div>
                ) : gpsError ? (
                  <div className="space-y-2">
                    <XCircle className="w-5 h-5 text-destructive mx-auto" />
                    <p className="text-sm text-destructive">{gpsError}</p>
                    <Button variant="outline" size="sm" onClick={refreshGps}>
                      Retry GPS
                    </Button>
                  </div>
                ) : coords ? (
                  <div>
                    <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto mb-1" />
                    <p className="text-sm text-green-600 font-medium">
                      GPS Acquired
                    </p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                      {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Navigation className="w-4 h-4" />
                    <span className="text-sm">Waiting for GPS…</span>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              {!alreadyCheckedIn ? (
                <Button
                  onClick={handleCheckIn}
                  disabled={!coords || isSubmitting || gpsLoading}
                  className="w-full gap-2"
                  size="lg"
                  data-ocid="checkin-btn"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Checking in…
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" /> Check In Now
                    </>
                  )}
                </Button>
              ) : !alreadyCheckedOut ? (
                <Button
                  onClick={handleCheckOut}
                  disabled={checkingOut}
                  variant="outline"
                  className="w-full gap-2 border-primary/40 text-primary hover:bg-primary/5"
                  size="lg"
                  data-ocid="checkout-btn"
                >
                  {checkingOut ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Checking out…
                    </>
                  ) : (
                    <>
                      <LogOutIcon className="w-4 h-4" /> Check Out
                    </>
                  )}
                </Button>
              ) : (
                <div
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-muted/30 border border-border text-sm text-muted-foreground"
                  data-ocid="attendance-complete"
                >
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  Attendance complete for today
                </div>
              )}

              {alreadyCheckedIn && !alreadyCheckedOut && (
                <p className="text-xs text-center text-muted-foreground">
                  You have already checked in today. Check out when your day
                  ends.
                </p>
              )}
            </div>
          </div>

          {/* Recent history */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/30">
              <span className="text-xs uppercase tracking-wider font-display text-muted-foreground">
                Recent Check-In History
              </span>
            </div>
            {historyLoading ? (
              <div className="p-8 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : historyRecords.length === 0 ? (
              <div
                className="p-8 text-center text-muted-foreground"
                data-ocid="checkin-history-empty"
              >
                <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No check-in history found</p>
              </div>
            ) : (
              <div
                className="divide-y divide-border max-h-[420px] overflow-y-auto"
                data-ocid="checkin-history-list"
              >
                {historyRecords.map((ci, i) => (
                  <div
                    key={`${String(ci.recordedAt)}-${i}`}
                    className="px-4 py-3 flex items-start justify-between gap-3"
                    data-ocid="checkin-history-row"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-mono font-semibold text-foreground">
                          {ci.date}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] py-0 px-1.5 ${
                            ci.status === CheckInStatus.matched
                              ? "border-green-500/40 text-green-600 bg-green-500/8"
                              : "border-orange-500/40 text-orange-600 bg-orange-500/8"
                          }`}
                        >
                          {ci.status === CheckInStatus.matched
                            ? "Matched"
                            : "Unmatched"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        In: {formatTime(ci.recordedAt)}
                        {ci.checkOutTime &&
                          ` · Out: ${formatTime(ci.checkOutTime)}`}
                      </p>
                      {ci.matchedLocation && (
                        <p className="text-xs text-muted-foreground truncate">
                          {ci.matchedLocation}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground/60 shrink-0">
                      {ci.gpsCoord.lat.toFixed(3)},{ci.gpsCoord.lng.toFixed(3)}
                    </span>
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
