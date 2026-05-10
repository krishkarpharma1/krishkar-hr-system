import { Button } from "@/components/ui/button";
import { FileText, Video, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AdminMessageInfo } from "../backend.d";
import { api } from "../lib/api";
import { useAuthStore } from "../store/authStore";

// ── Helpers ──────────────────────────────────────────────────────────────────

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function detectType(url: string): "image" | "video" | "document" {
  if (/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(url)) return "image";
  if (url.startsWith("data:image/")) return "image";
  if (/\.(mp4|webm|ogg|mov|avi)$/i.test(url)) return "video";
  if (url.startsWith("data:video/")) return "video";
  return "document";
}

function AttachmentPreview({ url, index }: { url: string; index: number }) {
  const type = detectType(url);

  if (type === "image") {
    return (
      <div className="rounded-lg overflow-hidden border border-border">
        <img
          src={url}
          alt={`Attachment ${index + 1}`}
          className="w-full max-h-64 object-contain bg-muted/30"
        />
      </div>
    );
  }

  if (type === "video") {
    return (
      <div className="rounded-lg overflow-hidden border border-border bg-muted/30">
        <video
          src={url}
          controls
          className="w-full max-h-64"
          aria-label={`Video attachment ${index + 1}`}
        >
          <track kind="captions" />
        </video>
      </div>
    );
  }

  // Document
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 bg-muted/40 hover:bg-muted/70 transition-colors rounded-lg px-4 py-3 text-sm text-primary font-body"
      aria-label={`Download document ${index + 1}`}
    >
      <FileText className="w-4 h-4 flex-shrink-0" />
      <span className="truncate flex-1">
        {url.startsWith("data:") ? `Document ${index + 1}` : url}
      </span>
      <Video className="w-4 h-4 flex-shrink-0 opacity-0" aria-hidden />
    </a>
  );
}

// ── Popup ─────────────────────────────────────────────────────────────────────

export function AdminMessagePopup() {
  const { session } = useAuthStore();
  const [message, setMessage] = useState<AdminMessageInfo | null>(null);
  const [visible, setVisible] = useState(false);
  const dismissedRef = useRef(false);
  const today = todayString();

  useEffect(() => {
    if (!session?.token || dismissedRef.current) return;

    const lsKey = `admin-msg-dismissed-${today}`;
    if (localStorage.getItem(lsKey)) return;

    let cancelled = false;

    async function check() {
      try {
        const msg = await api.getActiveAdminMessage(session!.token, today);
        if (!msg || cancelled) return;

        // Check if user has already dismissed today
        const seen = await api.hasUserSeenMessageToday(
          session!.token,
          msg.id,
          today,
        );
        if (seen || cancelled) return;

        // Respect scheduledDate — only show on the right day
        if (msg.scheduledDate && msg.scheduledDate !== today) return;

        setMessage(msg);
        setVisible(true);
      } catch {
        // silently fail — popup is informational, never block the portal
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [session, today]);

  const handleDismiss = async () => {
    if (!session?.token || !message) return;
    dismissedRef.current = true;
    setVisible(false);

    // Record in localStorage as immediate backup
    localStorage.setItem(`admin-msg-dismissed-${today}`, "1");

    // Record on backend (best-effort)
    try {
      await api.recordMessageDismissal(session.token, message.id, today);
    } catch {
      // ignore
    }
  };

  if (!visible || !message) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm"
        aria-hidden="true"
        onClick={handleDismiss}
        onKeyDown={(e) => e.key === "Escape" && handleDismiss()}
        role="presentation"
      />

      {/* Modal */}
      <dialog
        open
        aria-labelledby="admin-popup-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-transparent border-0 w-full h-full max-w-none max-h-none"
        data-ocid="admin-message-popup"
      >
        <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-start gap-3 px-5 py-4 border-b border-border bg-primary/5">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-display uppercase tracking-wider text-primary mb-0.5">
                Message from Admin
              </p>
              <h2
                id="admin-popup-title"
                className="font-display font-bold text-base text-foreground leading-snug"
              >
                {message.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dismiss message"
              data-ocid="admin-popup-dismiss-btn"
              className="p-1.5 -mr-1 -mt-1 rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <p className="text-sm font-body text-foreground leading-relaxed whitespace-pre-wrap">
              {message.content}
            </p>

            {message.attachmentUrls.length > 0 && (
              <div className="space-y-2">
                {message.attachmentUrls.map((url, i) => (
                  <AttachmentPreview
                    key={`popup-att-${i}-${url.slice(5, 25)}`}
                    url={url}
                    index={i}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-border bg-muted/20 flex justify-end">
            <Button
              onClick={handleDismiss}
              data-ocid="admin-popup-close-btn"
              size="sm"
            >
              Got it
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
