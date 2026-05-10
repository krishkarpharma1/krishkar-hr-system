import { RefreshCw, X } from "lucide-react";
import { useAppUpdate } from "../hooks/useAppUpdate";

/**
 * AppUpdatePopup — fixed bottom-center toast shown when a new service worker
 * version is waiting. Sky blue / white theme consistent with the app.
 */
export function AppUpdatePopup() {
  const { updateAvailable, triggerUpdate, dismissUpdate } = useAppUpdate();

  if (!updateAvailable) return null;

  return (
    <div
      role="alertdialog"
      aria-live="polite"
      aria-label="App update available"
      data-ocid="app-update-popup"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] w-[calc(100vw-2rem)] max-w-sm"
    >
      <div className="flex items-start gap-3 rounded-xl bg-sky-600 text-white shadow-lg px-4 py-3 border border-sky-500">
        {/* Icon */}
        <div className="flex-shrink-0 mt-0.5 w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
          <RefreshCw className="w-4 h-4 text-white" aria-hidden="true" />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold leading-tight text-white">
            App Update Available
          </p>
          <p className="text-xs text-sky-100 leading-snug mt-0.5">
            A new version is ready. Reload to get the latest update.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
          <button
            type="button"
            onClick={triggerUpdate}
            data-ocid="app-update-reload-btn"
            aria-label="Reload now to apply update"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white text-sky-700 hover:bg-sky-50 active:bg-sky-100 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Reload Now
          </button>
          <button
            type="button"
            onClick={dismissUpdate}
            data-ocid="app-update-dismiss-btn"
            aria-label="Dismiss update notification"
            className="p-1.5 rounded-lg text-sky-200 hover:text-white hover:bg-white/15 active:bg-white/25 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
