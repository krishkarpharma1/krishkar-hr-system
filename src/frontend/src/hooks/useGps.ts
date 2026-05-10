import { useCallback, useEffect, useRef } from "react";
import { create } from "zustand";
import { api } from "../lib/api";
import { useAuthStore } from "../store/authStore";

export interface GpsCoords {
  lat: number;
  lng: number;
  accuracy: number | null; // metres — null if not reported
  timestamp: number;
}

// ── GPS enforcement threshold ─────────────────────────────────────────────────
/** Minimum acceptable GPS accuracy in metres (lower = better). */
export const GPS_ACCURACY_THRESHOLD_M = 100;

/** Upper bound for "weak but acceptable" GPS — above this = fail. */
export const GPS_ACCURACY_WEAK_MAX_M = 200;

// ── Device detection ──────────────────────────────────────────────────────────

/** True when running on a real mobile device (phone/tablet with GPS). */
export function isMobileDevice(): boolean {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** Read the admin-configured location enforcement policy. */
export function getLocationPolicy(): "mobile-only" | "all-devices" {
  try {
    const val = localStorage.getItem("locationEnforcementPolicy");
    if (val === "all-devices") return "all-devices";
  } catch {
    // ignore
  }
  return "mobile-only";
}

/** Save the admin-configured location enforcement policy. */
export function setLocationPolicy(policy: "mobile-only" | "all-devices") {
  try {
    localStorage.setItem("locationEnforcementPolicy", policy);
  } catch {
    // ignore
  }
}

/**
 * True when GPS/location should be strictly enforced (block portal access).
 * Desktop devices are NEVER GPS-blocked — isMobileDevice() always wins.
 */
export function isGpsRequired(): boolean {
  if (!isMobileDevice()) return false;
  const policy = getLocationPolicy();
  return policy === "mobile-only" || policy === "all-devices";
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface GpsState {
  coords: GpsCoords | null;
  error: string | null;
  permissionState: PermissionState | null; // "granted" | "denied" | "prompt" | null
  locationNote: string | null;
  loading: boolean;
  setCoords: (coords: GpsCoords) => void;
  setError: (error: string) => void;
  setPermissionState: (state: PermissionState | null) => void;
  setLocationNote: (note: string | null) => void;
  setLoading: (loading: boolean) => void;
  clearGps: () => void;
}

export const useGpsStore = create<GpsState>((set) => ({
  coords: null,
  error: null,
  permissionState: null,
  locationNote: null,
  loading: false,
  setCoords: (coords) =>
    set({ coords, error: null, locationNote: null, loading: false }),
  setError: (error) => set({ error, loading: false }),
  setPermissionState: (permissionState) => set({ permissionState }),
  setLocationNote: (locationNote) => set({ locationNote }),
  setLoading: (loading) => set({ loading }),
  clearGps: () =>
    set({
      coords: null,
      error: null,
      permissionState: null,
      locationNote: null,
      loading: false,
    }),
}));

/** Read current GPS coords from anywhere without subscribing to re-renders. */
export function getGpsCoords(): GpsCoords | null {
  return useGpsStore.getState().coords;
}

/** Check current permission state without subscribing. */
export function getGpsPermissionState(): PermissionState | null {
  return useGpsStore.getState().permissionState;
}

// ── Accuracy helpers ──────────────────────────────────────────────────────────

export type GpsAccuracyStatus =
  | "verified"
  | "weak"
  | "failed"
  | "fetching"
  | "idle";

export function computeAccuracyStatus(
  accuracy: number | null | undefined,
): "verified" | "weak" | "failed" {
  if (accuracy == null) return "verified"; // unknown = treat as ok
  if (accuracy <= GPS_ACCURACY_THRESHOLD_M) return "verified";
  if (accuracy <= GPS_ACCURACY_WEAK_MAX_M) return "weak";
  return "failed";
}

// ── Device-specific error messages ───────────────────────────────────────────

function getErrorMessage(
  code: number,
  PERMISSION_DENIED: number,
  POSITION_UNAVAILABLE: number,
  TIMEOUT: number,
): string {
  const mobile = isMobileDevice();
  if (code === PERMISSION_DENIED) {
    return mobile
      ? "Please enable GPS on your device to continue. Tap the lock icon in your browser's address bar and allow Location access."
      : "Location access denied. You can allow it in your browser settings, or continue without precise coordinates.";
  }
  if (code === POSITION_UNAVAILABLE) {
    return mobile
      ? "Unable to get your GPS location. Please check your device GPS signal and try again."
      : "Location services are not available on this device. Your report will be submitted without precise coordinates.";
  }
  if (code === TIMEOUT) {
    return mobile
      ? "GPS location timed out. Please check your device GPS signal and try again."
      : "Location request timed out. Your report will be submitted without precise coordinates.";
  }
  return "Unable to retrieve your location.";
}

// ── Timeouts (ms) ─────────────────────────────────────────────────────────────

const DESKTOP_HIGH_ACCURACY_TIMEOUT = 4000;
const DESKTOP_LOW_ACCURACY_TIMEOUT = 4000;
const MOBILE_HIGH_ACCURACY_TIMEOUT = 15000;

// ── capturePosition ───────────────────────────────────────────────────────────

async function capturePosition(
  token: string | undefined,
  setCoords: (c: GpsCoords) => void,
  setError: (e: string) => void,
  setLocationNote: (n: string | null) => void,
  setLoading: (l: boolean) => void,
  setPermissionState: (s: PermissionState | null) => void,
  isBackground = false,
) {
  if (!navigator.geolocation) {
    if (!isBackground) {
      if (isMobileDevice()) {
        setError("Geolocation is not supported by this browser.");
      } else {
        setLocationNote(
          "Location services are not supported by this browser. Continuing without location.",
        );
        setLoading(false);
      }
    }
    return;
  }

  if (!isBackground) {
    setLoading(true);
  }

  // Query permission state before attempting to get position
  if ("permissions" in navigator && !isBackground) {
    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((result) => {
        setPermissionState(result.state);
        result.onchange = () => {
          setPermissionState(result.state);
        };
      })
      .catch(() => {
        // ignore — permissions API not available
      });
  }

  const mobile = isMobileDevice();
  const highAccuracyTimeout = mobile
    ? MOBILE_HIGH_ACCURACY_TIMEOUT
    : DESKTOP_HIGH_ACCURACY_TIMEOUT;

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const coords: GpsCoords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy ?? null,
        timestamp: Date.now(),
      };

      if (!isBackground) {
        setCoords(coords);
        setLocationNote(null);
        setPermissionState("granted");
      }

      if (token) {
        try {
          if (isBackground) {
            await api.captureGpsBackground(
              token,
              coords.lat,
              coords.lng,
              position.coords.accuracy ?? undefined,
            );
          } else {
            await api.submitLocation(token, coords.lat, coords.lng);
            await api.captureGpsBackground(
              token,
              coords.lat,
              coords.lng,
              position.coords.accuracy ?? undefined,
            );
          }
        } catch {
          // Location submission failure is non-blocking
        }
      }
    },
    (err) => {
      if (isBackground) return;

      // Track denied state
      if (err.code === err.PERMISSION_DENIED) {
        setPermissionState("denied");
      }

      if (mobile) {
        setError(
          getErrorMessage(
            err.code,
            err.PERMISSION_DENIED,
            err.POSITION_UNAVAILABLE,
            err.TIMEOUT,
          ),
        );
      } else {
        // On desktop: try low-accuracy fallback
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const coords: GpsCoords = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy ?? null,
              timestamp: Date.now(),
            };
            setCoords(coords);
            setPermissionState("granted");
            setLocationNote("Location: Approximate (desktop device)");
            if (token) {
              try {
                await api.submitLocation(token, coords.lat, coords.lng);
                await api.captureGpsBackground(
                  token,
                  coords.lat,
                  coords.lng,
                  position.coords.accuracy ?? undefined,
                );
              } catch {
                // non-blocking
              }
            }
          },
          () => {
            setLocationNote(
              "Precise location unavailable on this device. Continuing without GPS coordinates.",
            );
            setLoading(false);
          },
          {
            enableHighAccuracy: false,
            timeout: DESKTOP_LOW_ACCURACY_TIMEOUT,
            maximumAge: 60000,
          },
        );
      }
    },
    { enableHighAccuracy: true, timeout: highAccuracyTimeout, maximumAge: 0 },
  );
}

// ── useGps hook ───────────────────────────────────────────────────────────────

export function useGps() {
  const coords = useGpsStore((s) => s.coords);
  const error = useGpsStore((s) => s.error);
  const permissionState = useGpsStore((s) => s.permissionState);
  const locationNote = useGpsStore((s) => s.locationNote);
  const loading = useGpsStore((s) => s.loading);
  const setCoords = useGpsStore((s) => s.setCoords);
  const setError = useGpsStore((s) => s.setError);
  const setPermissionState = useGpsStore((s) => s.setPermissionState);
  const setLocationNote = useGpsStore((s) => s.setLocationNote);
  const setLoading = useGpsStore((s) => s.setLoading);
  const session = useAuthStore((s) => s.session);

  const tokenRef = useRef(session?.token);
  tokenRef.current = session?.token;

  const refreshGps = useCallback(() => {
    capturePosition(
      tokenRef.current,
      setCoords,
      setError,
      setLocationNote,
      setLoading,
      setPermissionState,
      false,
    );
  }, [setCoords, setError, setLocationNote, setLoading, setPermissionState]);

  const hasCoords = !!coords;
  const hasNote = !!locationNote;

  // Auto-trigger on mount if no coords and no desktop note yet
  useEffect(() => {
    if (!hasCoords && !hasNote) {
      capturePosition(
        tokenRef.current,
        setCoords,
        setError,
        setLocationNote,
        setLoading,
        setPermissionState,
        false,
      );
    }
  }, [
    hasCoords,
    hasNote,
    setCoords,
    setError,
    setLocationNote,
    setLoading,
    setPermissionState,
  ]);

  return { coords, error, permissionState, locationNote, loading, refreshGps };
}

/**
 * Background GPS capture hook — starts a 3-minute interval when the user is
 * authenticated and stops it on logout or unmount. Call once in the App root.
 */
export function useBackgroundGpsCapture() {
  const session = useAuthStore((s) => s.session);
  const isAuthenticated = !!session?.token;

  const tokenRef = useRef(session?.token);
  tokenRef.current = session?.token;

  const noopSet = useCallback(() => {}, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    const runCapture = () => {
      const token = tokenRef.current;
      if (token) {
        capturePosition(
          token,
          noopSet as (c: GpsCoords) => void,
          noopSet,
          noopSet,
          noopSet,
          noopSet as (s: PermissionState | null) => void,
          true,
        );
      }
    };

    const intervalId = setInterval(runCapture, 180_000); // 3 minutes
    return () => clearInterval(intervalId);
  }, [isAuthenticated, noopSet]);
}
