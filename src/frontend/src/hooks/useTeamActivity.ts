import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { MrDailyActivityRow } from "../types";

interface UseTeamActivityResult {
  rows: MrDailyActivityRow[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useTeamActivity(
  token: string | null | undefined,
  date: string,
): UseTeamActivityResult {
  const [rows, setRows] = useState<MrDailyActivityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!token || !date) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.getTeamDailyActivity(token, date);
      setRows(Array.isArray(result) ? result : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load team activity");
    } finally {
      setLoading(false);
    }
  }, [token, date]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { rows, loading, error, refresh: fetch };
}
