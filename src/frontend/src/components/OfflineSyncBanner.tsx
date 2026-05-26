import { useEffect, useState } from "react";
import { useConnectivity } from "../hooks/useConnectivity";
import { useOfflineDcrSync } from "../hooks/useOfflineDcrSync";
import { useOfflineDcrQueue } from "../store/offlineDcrQueue";
export function OfflineSyncBanner() {
  const { isOnline } = useConnectivity();
  const { isSyncing, triggerSync } = useOfflineDcrSync();
  const pendingCount = useOfflineDcrQueue((s) => s.pendingCount);
  const [successVisible, setSuccessVisible] = useState(false);
  const [failedCount, setFailedCount] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const handleSuccess = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d?.count > 0) {
        setSuccessVisible(true);
        setTimeout(() => setSuccessVisible(false), 4000);
      }
    };
    const handleFailed = (e: Event) => {
      const d = (e as CustomEvent).detail;
      setFailedCount(d?.count || 0);
    };
    window.addEventListener("dcr-sync-success", handleSuccess);
    window.addEventListener("dcr-sync-failed", handleFailed);
    return () => {
      window.removeEventListener("dcr-sync-success", handleSuccess);
      window.removeEventListener("dcr-sync-failed", handleFailed);
    };
  }, []);
  useEffect(() => {
    if (isOnline) setDismissed(false);
  }, [isOnline]);
  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex flex-col pointer-events-none">
      {!isOnline && !dismissed && (
        <div className="pointer-events-auto flex items-center gap-2 bg-amber-50 border-b border-amber-300 px-4 py-2 text-sm text-amber-900">
          <svg
            aria-hidden="true"
            className="w-4 h-4 shrink-0 text-amber-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M12 12h.01M3 3l18 18"
            />
          </svg>
          <span className="flex-1">
            No internet connection. Doctor calls will be saved offline and
            synced automatically when you reconnect.
            {pendingCount > 0 && (
              <span className="ml-1 font-semibold">
                ({pendingCount} pending)
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="ml-2 text-amber-600 hover:text-amber-800"
            aria-label="Dismiss"
          >
            <svg
              aria-hidden="true"
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}
      {isOnline && isSyncing && pendingCount > 0 && (
        <div className="pointer-events-auto flex items-center gap-2 bg-blue-50 border-b border-blue-300 px-4 py-2 text-sm text-blue-900">
          <svg
            aria-hidden="true"
            className="w-4 h-4 shrink-0 animate-spin text-blue-600"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8z"
            />
          </svg>
          <span>
            Syncing {pendingCount} offline doctor call
            {pendingCount !== 1 ? "s" : ""}...
          </span>
        </div>
      )}
      {successVisible && (
        <div className="pointer-events-auto flex items-center gap-2 bg-green-50 border-b border-green-300 px-4 py-2 text-sm text-green-900">
          <svg
            aria-hidden="true"
            className="w-4 h-4 shrink-0 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          <span className="flex-1">
            Your offline doctor calls have been synced successfully.
          </span>
          <button
            type="button"
            onClick={() => setSuccessVisible(false)}
            className="ml-2 text-green-600 hover:text-green-800"
            aria-label="Dismiss"
          >
            <svg
              aria-hidden="true"
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}
      {failedCount > 0 && (
        <div className="pointer-events-auto flex items-center gap-2 bg-red-50 border-b border-red-300 px-4 py-2 text-sm text-red-900">
          <svg
            aria-hidden="true"
            className="w-4 h-4 shrink-0 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="flex-1">
            {failedCount} doctor call{failedCount !== 1 ? "s" : ""} failed to
            sync. Please retry manually.
          </span>
          <button
            type="button"
            onClick={() => {
              setFailedCount(0);
              triggerSync();
            }}
            className="pointer-events-auto ml-2 rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={() => setFailedCount(0)}
            className="ml-1 text-red-600 hover:text-red-800"
            aria-label="Dismiss"
          >
            <svg
              aria-hidden="true"
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
