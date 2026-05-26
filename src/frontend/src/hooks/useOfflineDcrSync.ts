import { useCallback, useEffect, useRef, useState } from "react";
import {
  getAllPendingRecords,
  incrementRetryCount,
  updateRecordStatus,
  useOfflineDcrQueue,
} from "../store/offlineDcrQueue";
import { useConnectivity } from "./useConnectivity";
type SyncResult = "success" | "partial" | "failed" | null;
export function useOfflineDcrSync() {
  const { isOnline } = useConnectivity();
  const prevOnlineRef = useRef(isOnline);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult>(null);
  const refreshPendingCount = useOfflineDcrQueue((s) => s.refreshPendingCount);
  const syncPendingRecords = useCallback(async () => {
    const pending = await getAllPendingRecords();
    if (pending.length === 0) return;
    setIsSyncing(true);
    let syncedCount = 0;
    let failedCount = 0;
    for (const record of pending) {
      try {
        await updateRecordStatus(record.id, "syncing");
        // Dynamic import to avoid circular deps; rawFormData holds the original API payload
        const apiModule = await import("../lib/api");
        const apiClient = apiModule.api as Record<
          string,
          ((...args: unknown[]) => Promise<unknown>) | undefined
        >;
        const submitFn =
          apiClient.createCallReport ??
          apiClient.submitDoctorCall ??
          apiClient.saveDcrVisit;
        if (submitFn) {
          await submitFn(record.rawFormData);
        }
        await updateRecordStatus(record.id, "synced");
        syncedCount++;
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message.toLowerCase()
            : String(err).toLowerCase();
        if (
          msg.includes("already exists") ||
          msg.includes("duplicate") ||
          msg.includes("conflict")
        ) {
          await updateRecordStatus(record.id, "already-synced");
        } else {
          await incrementRetryCount(record.id);
          const updated = await getAllPendingRecords();
          const current = updated.find((r) => r.id === record.id);
          if (!current || current.retryCount >= 3) {
            await updateRecordStatus(record.id, "failed");
            failedCount++;
          }
        }
      }
    }
    await refreshPendingCount();
    setIsSyncing(false);
    if (failedCount === 0 && syncedCount > 0) {
      setLastSyncResult("success");
      window.dispatchEvent(
        new CustomEvent("dcr-sync-success", { detail: { count: syncedCount } }),
      );
    } else if (failedCount > 0 && syncedCount > 0) {
      setLastSyncResult("partial");
      window.dispatchEvent(
        new CustomEvent("dcr-sync-success", { detail: { count: syncedCount } }),
      );
      window.dispatchEvent(
        new CustomEvent("dcr-sync-failed", { detail: { count: failedCount } }),
      );
    } else if (failedCount > 0) {
      setLastSyncResult("failed");
      window.dispatchEvent(
        new CustomEvent("dcr-sync-failed", { detail: { count: failedCount } }),
      );
    }
  }, [refreshPendingCount]);
  useEffect(() => {
    if (isOnline && !prevOnlineRef.current) syncPendingRecords();
    prevOnlineRef.current = isOnline;
  }, [isOnline, syncPendingRecords]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only effect
  useEffect(() => {
    if (isOnline) syncPendingRecords();
  }, []);
  return { isSyncing, lastSyncResult, triggerSync: syncPendingRecords };
}
