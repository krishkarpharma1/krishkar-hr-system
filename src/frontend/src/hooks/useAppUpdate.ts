import { useCallback, useEffect, useState } from "react";

/**
 * useAppUpdate — detects when a new service worker version is waiting and
 * provides a triggerUpdate() function to activate it immediately.
 *
 * Flow:
 *  1. On mount, check navigator.serviceWorker.ready for an existing waiting SW.
 *  2. Listen for 'updatefound' on the registration; when the new SW reaches
 *     'installed' state (waiting), set updateAvailable = true.
 *  3. Also listen for 'controllerchange' — fired after the new SW takes over —
 *     and reload the page so the user gets the fresh assets.
 *  4. triggerUpdate() posts SKIP_WAITING to the waiting SW, which then fires
 *     'controllerchange' → page reloads.
 */
export function useAppUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | null = null;
    let newWorker: ServiceWorker | null = null;

    function onStateChange() {
      if (
        newWorker?.state === "installed" &&
        navigator.serviceWorker.controller
      ) {
        // A new SW is installed and waiting — a previous SW is still in control
        setUpdateAvailable(true);
      }
    }

    function onUpdateFound() {
      if (!registration) return;
      newWorker = registration.installing;
      newWorker?.addEventListener("statechange", onStateChange);
    }

    function onControllerChange() {
      // New SW has taken control — reload to get fresh assets
      window.location.reload();
    }

    navigator.serviceWorker.ready.then((reg) => {
      registration = reg;

      // Check if there is already a waiting SW from a previous updatefound cycle
      if (reg.waiting && navigator.serviceWorker.controller) {
        setUpdateAvailable(true);
      }

      reg.addEventListener("updatefound", onUpdateFound);
    });

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );

    return () => {
      registration?.removeEventListener("updatefound", onUpdateFound);
      newWorker?.removeEventListener("statechange", onStateChange);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
    };
  }, []);

  const triggerUpdate = useCallback(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready.then((reg) => {
      if (reg.waiting) {
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
        // controllerchange listener will reload the page
      }
    });
  }, []);

  const dismissUpdate = useCallback(() => {
    setDismissed(true);
  }, []);

  return {
    updateAvailable: updateAvailable && !dismissed,
    triggerUpdate,
    dismissUpdate,
  };
}
