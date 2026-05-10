import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Bell, Cake, Check, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { NotificationRecord } from "../backend.d";
import { NotificationType } from "../backend.d";
import { useNotifications } from "../hooks/useNotifications";

interface NotificationInboxProps {
  token: string;
  onNavigate?: (entityType: string, entityId: string) => void;
  portalType: "asm" | "rsm" | "zsm" | "hr" | "admin";
}

function timeAgo(createdAt: bigint): string {
  const ms = Number(createdAt) / 1_000_000;
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function NotifIcon({ type }: { type: NotificationType }) {
  if (type === NotificationType.birthday)
    return <Cake className="w-4 h-4 text-pink-500 shrink-0" />;
  if (
    type === NotificationType.absenceWarningDay1 ||
    type === NotificationType.absenceWarningDay2 ||
    type === NotificationType.autoInactivated
  )
    return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
  return <Bell className="w-4 h-4 text-sky-500 shrink-0" />;
}

function NotificationRow({
  notification,
  onRead,
  onNavigate,
}: {
  notification: NotificationRecord;
  onRead: (id: string) => void;
  onNavigate?: (entityType: string, entityId: string) => void;
}) {
  function handleClick() {
    if (!notification.isRead) onRead(notification.id);
    if (
      notification.relatedEntityType &&
      notification.relatedEntityId &&
      onNavigate
    ) {
      onNavigate(notification.relatedEntityType, notification.relatedEntityId);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      data-ocid={`notification-row-${notification.id}`}
      className={`w-full text-left px-3 py-2.5 flex items-start gap-2.5 border-b border-border/40 transition-colors hover:bg-sky-50/60 focus:outline-none focus:bg-sky-50/60 ${
        notification.isRead
          ? "bg-background"
          : "bg-sky-50 border-l-2 border-l-sky-500"
      }`}
    >
      <div className="mt-0.5">
        <NotifIcon type={notification.notificationType} />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={`text-xs font-semibold leading-snug truncate ${
            notification.isRead ? "text-foreground" : "text-sky-700"
          }`}
        >
          {notification.title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-snug">
          {notification.body}
        </p>
        <p className="text-[10px] text-muted-foreground/70 mt-1">
          {timeAgo(notification.createdAt)}
        </p>
      </div>
      {!notification.isRead && (
        <span className="w-2 h-2 rounded-full bg-sky-500 mt-1 shrink-0" />
      )}
    </button>
  );
}

export function NotificationInbox({
  token,
  onNavigate,
  portalType: _portalType,
}: NotificationInboxProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllRead,
    clearAll,
  } = useNotifications(token);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handle(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [open]);

  function handleRead(id: string) {
    void markAsRead([id]);
  }

  function handleMarkAll(e: React.MouseEvent) {
    e.stopPropagation();
    void markAllRead();
  }

  function handleClearAll(e: React.MouseEvent) {
    e.stopPropagation();
    void clearAll();
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        type="button"
        aria-label="Notifications"
        aria-expanded={open}
        data-ocid="notification-bell-btn"
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center justify-center w-9 h-9 rounded-lg hover:bg-muted/60 active:bg-muted transition-colors text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-sky-500 text-white text-[10px] font-bold rounded-full px-1 shadow"
            data-ocid="notification-unread-badge"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute right-0 top-11 z-50 bg-card border border-border rounded-xl shadow-xl overflow-hidden flex flex-col"
          style={{ width: "min(320px, calc(100vw - 1rem))" }}
          data-ocid="notification-dropdown"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-card sticky top-0">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-sky-500" />
              <span className="text-sm font-semibold text-foreground font-display">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="text-[10px] bg-sky-100 text-sky-700 rounded-full px-1.5 py-0.5 font-semibold">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAll}
                  data-ocid="notification-mark-all-read"
                  className="flex items-center gap-1 text-[10px] text-sky-600 hover:text-sky-800 px-1.5 py-1 rounded hover:bg-sky-50 transition-colors"
                  title="Mark all as read"
                >
                  <Check className="w-3 h-3" />
                  All read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  data-ocid="notification-clear-all"
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive px-1.5 py-1 rounded hover:bg-destructive/10 transition-colors"
                  title="Clear all notifications"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                data-ocid="notification-close-btn"
                className="flex items-center justify-center w-6 h-6 rounded hover:bg-muted/60 transition-colors text-muted-foreground"
                aria-label="Close notifications"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div
            className="overflow-y-auto"
            style={{ maxHeight: "min(384px, 60vh)" }}
          >
            {isLoading && notifications.length === 0 ? (
              <div className="p-3 space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-2.5">
                    <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-3/4" />
                      <Skeleton className="h-2.5 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-10 px-4 text-center"
                data-ocid="notification-empty-state"
              >
                <Bell className="w-8 h-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">
                  No notifications yet
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  You'll be notified of team activity here
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <NotificationRow
                  key={n.id}
                  notification={n}
                  onRead={handleRead}
                  onNavigate={onNavigate}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
