import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import type { PendingApprovalCounts } from "../types";

const REFRESH_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

interface UsePendingCountsResult {
  counts: PendingApprovalCounts | null;
  loading: boolean;
  refresh: () => void;
}

export function usePendingCounts(
  token: string | null | undefined,
): UsePendingCountsResult {
  const [counts, setCounts] = useState<PendingApprovalCounts | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const result = await api.getPendingApprovalCounts(token);
      setCounts(result ?? null);
    } catch {
      // Silently fail — widget is non-critical
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetch();
    timerRef.current = setInterval(() => {
      void fetch();
    }, REFRESH_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetch]);

  return { counts, loading, refresh: fetch };
}
