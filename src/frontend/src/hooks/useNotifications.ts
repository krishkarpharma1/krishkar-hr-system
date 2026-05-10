import { useCallback, useEffect, useRef, useState } from "react";
import type { NotificationRecord } from "../backend.d";
import { api } from "../lib/api";

export interface UseNotificationsResult {
  notifications: NotificationRecord[];
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (ids: string[]) => Promise<void>;
  markAllRead: () => Promise<void>;
  clearAll: () => Promise<void>;
  refresh: () => void;
}

const POLL_INTERVAL_MS = 30_000;

export function useNotifications(token: string): UseNotificationsResult {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const [notifs, count] = await Promise.all([
        api.getMyNotifications(token),
        api.getUnreadNotificationCount(token),
      ]);
      setNotifications(notifs);
      setUnreadCount(Number(count));
    } catch {
      // silently ignore — polling will retry
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const refresh = useCallback(() => {
    void fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!token) return;
    void fetchAll();
    intervalRef.current = setInterval(() => void fetchAll(), POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [token, fetchAll]);

  const markAsRead = useCallback(
    async (ids: string[]) => {
      if (!token || ids.length === 0) return;
      try {
        await api.markNotificationsRead(ids, token);
        setNotifications((prev) =>
          prev.map((n) => (ids.includes(n.id) ? { ...n, isRead: true } : n)),
        );
        setUnreadCount((c) =>
          Math.max(
            0,
            c -
              ids.filter((id) => {
                const n = notifications.find((x) => x.id === id);
                return n && !n.isRead;
              }).length,
          ),
        );
      } catch {
        // ignore
      }
    },
    [token, notifications],
  );

  const markAllRead = useCallback(async () => {
    if (!token) return;
    try {
      await api.markAllNotificationsRead(token);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  }, [token]);

  const clearAll = useCallback(async () => {
    if (!token) return;
    try {
      await api.clearMyNotifications(token);
      setNotifications([]);
      setUnreadCount(0);
    } catch {
      // ignore
    }
  }, [token]);

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllRead,
    clearAll,
    refresh,
  };
}
