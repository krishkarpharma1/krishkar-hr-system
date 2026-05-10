import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import type { DashboardAggregates } from "../types";

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

interface UseDashboardDataResult {
  data: DashboardAggregates | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useDashboardData(
  token: string | null | undefined,
  fromDate?: string,
  toDate?: string,
): UseDashboardDataResult {
  const [data, setData] = useState<DashboardAggregates | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const now = new Date();
      const firstDay =
        fromDate ??
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const lastDay = toDate ?? now.toISOString().slice(0, 10);
      const result = await api.getDashboardAggregates(token, firstDay, lastDay);
      setData(result ?? null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to load dashboard data",
      );
    } finally {
      setLoading(false);
    }
  }, [token, fromDate, toDate]);

  // Initial fetch + auto-refresh
  useEffect(() => {
    void fetch();
    timerRef.current = setInterval(() => {
      void fetch();
    }, REFRESH_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetch]);

  // Refresh on window focus
  useEffect(() => {
    const handler = () => {
      void fetch();
    };
    window.addEventListener("focus", handler);
    return () => window.removeEventListener("focus", handler);
  }, [fetch]);

  return { data, loading, error, refresh: fetch };
}
