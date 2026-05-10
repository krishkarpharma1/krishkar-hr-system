import { Button } from "@/components/ui/button";
import { AlertTriangle, Info, MapPin, RefreshCw, Shield } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { isGpsRequired, isMobileDevice, useGps } from "../hooks/useGps";

interface GpsGateProps {
  children: React.ReactNode;
}

type BrowserType =
  | "android-chrome"
  | "ios-safari"
  | "desktop-chrome"
  | "firefox"
  | "other";

function detectBrowser(): BrowserType {
  const ua = navigator.userAgent;
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isChrome = /Chrome/i.test(ua) && !/Edg/i.test(ua);
  const isEdge = /Edg/i.test(ua);
  const isFirefox = /Firefox/i.test(ua);
  const isSafari = /Safari/i.test(ua) && !isChrome;

  if (isAndroid && isChrome) return "android-chrome";
  if (isIOS && isSafari) return "ios-safari";
  if (isChrome || isEdge) return "desktop-chrome";
  if (isFirefox) return "firefox";
  return "other";
}

interface InstructionStep {
  title: string;
  steps: string[];
  extra?: string;
}

function getBrowserInstructions(browser: BrowserType): InstructionStep {
  switch (browser) {
    case "android-chrome":
      return {
        title: "Enable GPS on Android Chrome",
        steps: [
          "Tap the lock icon or ⓘ in the address bar",
          "Tap 'Permissions' or 'Site settings'",
          "Tap 'Location'",
          "Select 'Allow'",
          "Reload the page",
        ],
        extra:
          "If you don't see the lock icon, open Chrome menu → Settings → Site Settings → Location",
      };
    case "ios-safari":
      return {
        title: "Enable Location on iPhone/iPad",
        steps: [
          "Open the Settings app",
          "Scroll down and tap 'Safari'",
          "Tap 'Location'",
          "Select 'Allow'",
          "Return to this page",
        ],
      };
    case "firefox":
      return {
        title: "Enable Location on Firefox",
        steps: [
          "Click the shield icon or lock icon in the address bar",
          "Look for Location permissions",
          "Remove the block on Location",
          "Reload the page",
        ],
      };
    case "desktop-chrome":
      return {
        title: "Enable Location on Chrome / Edge",
        steps: [
          "Click the lock icon 🔒 to the left of the website address",
          "Click 'Location'",
          "Select 'Allow'",
          "Reload the page",
        ],
        extra:
          "Alternatively, click the location icon 📍 in the address bar and select 'Always allow'",
      };
    default:
      return {
        title: "Enable Location in Your Browser",
        steps: [
          "Click the lock icon or ⓘ in your browser's address bar",
          "Find 'Location' or 'Permissions'",
          "Change the setting to Allow",
          "Reload this page",
        ],
      };
  }
}

// ── Desktop non-blocking banner ───────────────────────────────────────────────

function DesktopLocationBanner({
  note,
  error,
  onRetry,
  loading,
}: {
  note: string | null;
  error: string | null;
  onRetry: () => void;
  loading: boolean;
}) {
  // Map raw error strings to user-friendly messages
  function friendlyMessage(raw: string | null): string {
    if (!raw) return "";
    const lower = raw.toLowerCase();
    if (lower.includes("denied") || lower.includes("permission"))
      return "Location access was denied. Please enable location in your browser settings.";
    if (lower.includes("timeout") || lower.includes("timed out"))
      return "Location request timed out. Trying IP-based location fallback…";
    return "Could not get your location. You can continue without location tracking on desktop.";
  }

  const message =
    note ??
    (error ? friendlyMessage(error) : null) ??
    "Precise location is unavailable on this device. You can continue — an approximate location will be used if available.";

  return (
    <div
      className="w-full bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 flex items-start gap-3 text-sm"
      data-ocid="desktop-location-banner"
      role="note"
    >
      <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-foreground text-xs leading-relaxed">{message}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        disabled={loading}
        aria-label="Retry location"
        className="opacity-60 hover:opacity-100 transition-opacity shrink-0"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
      </button>
    </div>
  );
}

// ── Main GpsGate ──────────────────────────────────────────────────────────────

/**
 * Desktop deadline (ms): after this time, a desktop device is always let
 * through regardless of whether geolocation has resolved.
 */
const DESKTOP_GATE_DEADLINE_MS = 5000;

/** After this many ms on mobile loading screen, show a "Skip (Desktop User)" button. */
const MOBILE_SKIP_BUTTON_DELAY_MS = 5000;

export function GpsGate({ children }: GpsGateProps) {
  const { coords, error, locationNote, loading, refreshGps } = useGps();
  const mobile = isMobileDevice();

  /**
   * isGpsRequired() already returns false for non-mobile devices.
   * We keep gpsRequired as the canonical gate flag — desktops are always false.
   */
  const gpsRequired = isGpsRequired();

  /**
   * Hard deadline for desktops: after DESKTOP_GATE_DEADLINE_MS we flip this
   * flag so the loading banner disappears and children render unconditionally,
   * even if geolocation is still pending in the background.
   */
  const [desktopDeadlineReached, setDesktopDeadlineReached] = useState(false);
  const deadlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track whether the deadline timer has been started so we only start it once
  const deadlineStartedRef = useRef(false);

  /** Show "Skip (Desktop User)" button on mobile after a delay if GPS not yet resolved */
  const [showSkipButton, setShowSkipButton] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const skipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Start the desktop deadline timer the first time loading becomes true
  // (that means capturePosition fired and GPS check is in progress).
  // Also cancel it early when we get coords, a note, or an error.
  useEffect(() => {
    // Only relevant for desktop / non-gps-required path
    if (mobile || gpsRequired) return;

    // If already resolved, ensure timer is cancelled
    if (coords || locationNote || error) {
      if (deadlineTimerRef.current) {
        clearTimeout(deadlineTimerRef.current);
        deadlineTimerRef.current = null;
      }
      return;
    }

    // Start the timer once when loading begins
    if (loading && !deadlineStartedRef.current) {
      deadlineStartedRef.current = true;
      deadlineTimerRef.current = setTimeout(() => {
        setDesktopDeadlineReached(true);
      }, DESKTOP_GATE_DEADLINE_MS);
    }

    return () => {
      if (deadlineTimerRef.current) {
        clearTimeout(deadlineTimerRef.current);
        deadlineTimerRef.current = null;
      }
    };
  }, [mobile, gpsRequired, loading, coords, locationNote, error]);

  // Show "Skip" button after delay on loading screen (mobile or any GPS-required device)
  useEffect(() => {
    if (coords || !loading) {
      if (skipTimerRef.current) {
        clearTimeout(skipTimerRef.current);
        skipTimerRef.current = null;
      }
      return;
    }
    if (!skipTimerRef.current) {
      skipTimerRef.current = setTimeout(() => {
        setShowSkipButton(true);
      }, MOBILE_SKIP_BUTTON_DELAY_MS);
    }
    return () => {
      if (skipTimerRef.current) {
        clearTimeout(skipTimerRef.current);
        skipTimerRef.current = null;
      }
    };
  }, [loading, coords]);

  // ── User opted to skip GPS (desktop user on mobile-detected device) ────────
  if (skipped) {
    return (
      <>
        <div className="w-full px-4 pt-3">
          <DesktopLocationBanner
            note="Continuing without GPS location. Location will not be recorded for this session."
            error={null}
            onRetry={refreshGps}
            loading={loading}
          />
        </div>
        {children}
      </>
    );
  }

  // ── Always pass through if we have coords ──────────────────────────────────
  if (coords) {
    return <>{children}</>;
  }

  // ── Desktop / non-GPS-required path ───────────────────────────────────────
  // Desktops are NEVER blocked. isGpsRequired() already guarantees this, but
  // we also hard-check !mobile as a safety net against any policy misconfiguration.
  if (!gpsRequired || !mobile) {
    // Deadline reached OR location resolved to error/note → show banner + children
    if (desktopDeadlineReached || !loading || locationNote || error) {
      const showBanner = !!(locationNote || error || desktopDeadlineReached);
      return (
        <>
          {showBanner && (
            <div className="w-full px-4 pt-3">
              <DesktopLocationBanner
                note={
                  locationNote ??
                  (desktopDeadlineReached && !locationNote && !error
                    ? "Precise location unavailable on this device. Continuing without GPS."
                    : null)
                }
                error={!locationNote ? error : null}
                onRetry={refreshGps}
                loading={loading}
              />
            </div>
          )}
          {children}
        </>
      );
    }

    // Still loading and within deadline — show subtle inline banner but render children
    return (
      <>
        <div
          className="w-full px-4 pt-3"
          data-ocid="desktop-gps-loading-banner"
        >
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 border border-border rounded-md text-xs text-muted-foreground">
            <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
            <span>Getting your location, please wait…</span>
          </div>
        </div>
        {children}
      </>
    );
  }

  // ── Mobile / all-devices policy: GPS is required ───────────────────────────

  const browser = detectBrowser();
  const instructions = getBrowserInstructions(browser);

  // Friendly error messages based on error type
  function getFriendlyMobileError(raw: string | null): string {
    if (!raw) return "";
    const lower = raw.toLowerCase();
    if (lower.includes("denied") || lower.includes("permission"))
      return "Location access was denied. Please enable location in your browser settings.";
    if (lower.includes("timeout") || lower.includes("timed out"))
      return "Location request timed out. Please check your GPS signal and try again.";
    return raw;
  }

  if (loading) {
    return (
      <div
        className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center p-6"
        data-ocid="gps-loading-screen"
      >
        <div className="w-full max-w-sm flex flex-col items-center gap-5 text-center">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center">
              <MapPin className="w-9 h-9 text-primary animate-pulse" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-card border-2 border-border rounded-full flex items-center justify-center">
              <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-display font-bold text-foreground">
              Getting your location…
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Please allow location access when prompted by your browser. GPS
              location is required to use the Krishkar HR System on mobile.
            </p>
          </div>

          <div className="w-full bg-primary/5 border border-primary/20 rounded-xl p-4 text-left">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="space-y-1 min-w-0">
                <p className="text-sm font-semibold text-foreground font-body">
                  Why do we need your location?
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  GPS coordinates are recorded with every activity for security
                  and compliance.
                </p>
              </div>
            </div>
          </div>

          {showSkipButton && (
            <button
              type="button"
              onClick={() => setSkipped(true)}
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors mt-2"
              data-ocid="gps-skip-btn"
            >
              Skip (Desktop User)
            </button>
          )}
        </div>
      </div>
    );
  }

  // Mobile GPS blocked / error — show instructions
  return (
    <div
      className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center p-5 overflow-y-auto"
      data-ocid="gps-block-screen"
    >
      <div className="w-full max-w-sm flex flex-col items-center gap-5 text-center py-6">
        <div className="w-20 h-20 rounded-full bg-destructive/10 border-2 border-destructive/20 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-10 h-10 text-destructive" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl md:text-2xl font-display font-bold text-foreground">
            GPS Location Required
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Please enable GPS on your device to continue. GPS location is
            mandatory for all mobile staff.
          </p>
        </div>

        {error && (
          <div className="w-full rounded-xl bg-destructive/8 border border-destructive/20 px-4 py-3 text-sm text-destructive text-left leading-relaxed">
            <p>{getFriendlyMobileError(error)}</p>
          </div>
        )}

        <Button
          onClick={refreshGps}
          className="w-full gap-2.5 min-h-[48px] text-sm font-semibold"
          data-ocid="gps-retry-btn"
          size="lg"
        >
          <RefreshCw className="w-4 h-4" />
          Retry Location Access
        </Button>

        <div className="w-full text-xs text-muted-foreground bg-muted/50 border border-border rounded-xl p-4 text-left space-y-3">
          <p className="font-semibold text-foreground text-sm">
            {instructions.title}
          </p>
          <ol className="list-decimal list-inside space-y-1.5 leading-relaxed">
            {instructions.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          {instructions.extra && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong>Tip:</strong> {instructions.extra}
              </p>
            </div>
          )}
        </div>

        {showSkipButton && (
          <button
            type="button"
            onClick={() => setSkipped(true)}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
            data-ocid="gps-skip-btn"
          >
            Skip (Desktop User)
          </button>
        )}
      </div>
    </div>
  );
}
