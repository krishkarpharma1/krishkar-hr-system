import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Bell,
  CheckCircle2,
  Edit2,
  FileText,
  Image,
  Loader2,
  Plus,
  Trash2,
  Video,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Role } from "../../backend";
import type { AdminMessageInfo } from "../../backend.d";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";

// ── Helpers ───────────────────────────────────────────────────────────────────

function detectFileType(url: string): "image" | "video" | "document" {
  if (/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(url)) return "image";
  if (/\.(mp4|webm|ogg|mov|avi)$/i.test(url)) return "video";
  return "document";
}

function AttachmentIcon({ url }: { url: string }) {
  const type = detectFileType(url);
  if (type === "image") return <Image className="w-4 h-4 text-accent" />;
  if (type === "video") return <Video className="w-4 h-4 text-primary" />;
  return <FileText className="w-4 h-4 text-muted-foreground" />;
}

// ── Form component ─────────────────────────────────────────────────────────

interface MessageFormData {
  title: string;
  content: string;
  scheduledDate: string;
  attachmentUrls: string[];
}

const DEFAULT_FORM: MessageFormData = {
  title: "",
  content: "",
  scheduledDate: "",
  attachmentUrls: [],
};

interface MessageFormProps {
  initial?: Partial<MessageFormData>;
  onSubmit: (data: MessageFormData) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
  portalRole?: Role;
}

function MessageForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
}: MessageFormProps) {
  const [form, setForm] = useState<MessageFormData>({
    ...DEFAULT_FORM,
    ...initial,
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof MessageFormData, v: string | string[]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const dataUrl = evt.target?.result as string;
        setForm((f) => ({
          ...f,
          attachmentUrls: [...f.attachmentUrls, dataUrl],
        }));
        setUploading(false);
      };
      reader.onerror = () => {
        toast.error("Failed to read file");
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error("Failed to upload file");
      setUploading(false);
    }
    // reset input
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeAttachment = (idx: number) => {
    setForm((f) => ({
      ...f,
      attachmentUrls: f.attachmentUrls.filter((_, i) => i !== idx),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      toast.error("Title and content are required");
      return;
    }
    setSaving(true);
    try {
      await onSubmit(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="msg-title">Title *</Label>
        <Input
          id="msg-title"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Message title visible to all users"
          data-ocid="msg-title-input"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="msg-content">Content *</Label>
        <Textarea
          id="msg-content"
          value={form.content}
          onChange={(e) => set("content", e.target.value)}
          placeholder="Write the message body here…"
          rows={4}
          data-ocid="msg-content-input"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="msg-date">Scheduled Date (optional)</Label>
        <Input
          id="msg-date"
          type="date"
          value={form.scheduledDate}
          onChange={(e) => set("scheduledDate", e.target.value)}
          data-ocid="msg-scheduled-date"
        />
        <p className="text-xs text-muted-foreground">
          Leave blank to show to all users immediately once active.
        </p>
      </div>

      {/* Attachments */}
      <div className="space-y-2">
        <Label>Attachments (image, video, document)</Label>
        {form.attachmentUrls.length > 0 && (
          <ul className="space-y-1.5 mb-2">
            {form.attachmentUrls.map((url, i) => (
              <li
                key={`att-${i}-${url.slice(0, 20)}`}
                className="flex items-center gap-2 bg-muted/40 rounded-md px-3 py-2 text-sm"
              >
                <AttachmentIcon url={url} />
                <span className="flex-1 min-w-0 truncate font-mono text-xs text-muted-foreground">
                  {url.startsWith("data:") ? `Attachment ${i + 1}` : url}
                </span>
                <button
                  type="button"
                  onClick={() => removeAttachment(i)}
                  className="text-destructive hover:text-destructive/80 flex-shrink-0"
                  aria-label="Remove attachment"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
            onChange={handleFileChange}
            data-ocid="msg-file-input"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            data-ocid="msg-attach-btn"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            {uploading ? "Uploading…" : "Attach File"}
          </Button>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={saving} data-ocid="msg-submit-btn">
          {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          {submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

interface Props {
  portalRole?: Role;
}

export default function AdminMessageManagement({
  portalRole = Role.Admin,
}: Props) {
  const { session } = useAuthStore();
  const [messages, setMessages] = useState<AdminMessageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingMsg, setEditingMsg] = useState<AdminMessageInfo | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadMessages = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const result = await api.listAdminMessages(session.token);
      if (result.__kind__ === "ok") {
        setMessages(
          result.ok.sort((a, b) => Number(b.createdAt) - Number(a.createdAt)),
        );
      }
    } catch {
      toast.error("Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const handleCreate = async (data: MessageFormData) => {
    if (!session) return;
    const result = await api.createAdminMessage(session.token, {
      title: data.title,
      content: data.content,
      attachmentUrls: data.attachmentUrls,
      scheduledDate: data.scheduledDate || undefined,
    });
    if (result.__kind__ === "ok") {
      toast.success("Message created");
      setShowCreate(false);
      await loadMessages();
    } else {
      toast.error(result.err);
    }
  };

  const handleEdit = async (data: MessageFormData) => {
    if (!session || !editingMsg) return;
    const result = await api.updateAdminMessage(session.token, {
      id: editingMsg.id,
      title: data.title,
      content: data.content,
      attachmentUrls: data.attachmentUrls,
      scheduledDate: data.scheduledDate || undefined,
    });
    if (result.__kind__ === "ok") {
      toast.success("Message updated");
      setEditingMsg(null);
      await loadMessages();
    } else {
      toast.error(result.err);
    }
  };

  const handleToggle = async (msg: AdminMessageInfo) => {
    if (!session) return;
    setTogglingId(msg.id);
    try {
      if (msg.isActive) {
        const r = await api.deactivateAdminMessage(session.token, msg.id);
        if (r.__kind__ === "ok") toast.success("Message deactivated");
        else toast.error(r.err);
      } else {
        const r = await api.updateAdminMessage(session.token, {
          id: msg.id,
          isActive: true,
        });
        if (r.__kind__ === "ok") toast.success("Message activated");
        else toast.error(r.err);
      }
      await loadMessages();
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!session) return;
    setDeletingId(id);
    try {
      const r = await api.deleteAdminMessage(session.token, id);
      if (r.__kind__ === "ok") {
        toast.success("Message deleted");
        await loadMessages();
      } else {
        toast.error(r.err);
      }
    } finally {
      setDeletingId(null);
    }
  };

  const activeMsg = messages.find((m) => m.isActive);

  return (
    <PortalLayout portalRole={portalRole}>
      <PageHeader
        title="Message Popup Management"
        subtitle="Create and manage daily popup messages shown to all users on first login"
      />
      <PageContent>
        {/* Active message notice */}
        {activeMsg && (
          <div className="mb-5 bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-start gap-3">
            <Bell className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-display font-semibold text-foreground">
                Active message: {activeMsg.title}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {activeMsg.content}
              </p>
            </div>
          </div>
        )}

        {/* Create form */}
        {showCreate ? (
          <div className="bg-card border border-border rounded-lg p-5 mb-6">
            <h2 className="font-display font-semibold text-foreground mb-4">
              New Message
            </h2>
            <MessageForm
              onSubmit={handleCreate}
              onCancel={() => setShowCreate(false)}
              submitLabel="Create Message"
            />
          </div>
        ) : (
          <div className="mb-6">
            <Button
              onClick={() => setShowCreate(true)}
              data-ocid="create-message-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create New Message
            </Button>
          </div>
        )}

        {/* Edit form */}
        {editingMsg && (
          <div className="bg-card border border-primary/30 rounded-lg p-5 mb-6">
            <h2 className="font-display font-semibold text-foreground mb-4">
              Edit Message
            </h2>
            <MessageForm
              initial={{
                title: editingMsg.title,
                content: editingMsg.content,
                scheduledDate: editingMsg.scheduledDate ?? "",
                attachmentUrls: [...editingMsg.attachmentUrls],
              }}
              onSubmit={handleEdit}
              onCancel={() => setEditingMsg(null)}
              submitLabel="Save Changes"
            />
          </div>
        )}

        {/* Messages list */}
        <div className="space-y-3">
          <h2 className="text-xs uppercase tracking-wider font-display text-muted-foreground">
            All Messages ({messages.length})
          </h2>

          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          )}

          {!loading && messages.length === 0 && (
            <div
              className="bg-card border border-border rounded-lg p-8 text-center"
              data-ocid="messages-empty-state"
            >
              <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-body text-muted-foreground">
                No messages yet. Create one above.
              </p>
            </div>
          )}

          {!loading &&
            messages.map((msg) => (
              <div
                key={msg.id}
                className="bg-card border border-border rounded-lg p-4"
                data-ocid={`message-row-${msg.id}`}
              >
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-display font-semibold text-sm text-foreground truncate">
                        {msg.title}
                      </span>
                      <Badge
                        variant={msg.isActive ? "default" : "secondary"}
                        className="text-xs shrink-0"
                      >
                        {msg.isActive ? "Active" : "Inactive"}
                      </Badge>
                      {msg.scheduledDate && (
                        <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                          Scheduled: {msg.scheduledDate}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground font-body line-clamp-2">
                      {msg.content}
                    </p>
                    {msg.attachmentUrls.length > 0 && (
                      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                        {msg.attachmentUrls.map((url, i) => (
                          <span
                            key={`${msg.id}-att-${i}`}
                            className="inline-flex items-center gap-1 text-xs bg-muted/60 px-2 py-0.5 rounded"
                          >
                            <AttachmentIcon url={url} />
                            Attachment {i + 1}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-1.5 font-mono">
                      Created by {msg.createdBy} •{" "}
                      {new Date(
                        Number(msg.createdAt) / 1_000_000,
                      ).toLocaleDateString("en-IN")}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggle(msg)}
                      disabled={togglingId === msg.id}
                      data-ocid={`toggle-msg-${msg.id}`}
                    >
                      {togglingId === msg.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : msg.isActive ? (
                        <XCircle className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-primary" />
                      )}
                      {msg.isActive ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingMsg(msg)}
                      disabled={!!editingMsg}
                      data-ocid={`edit-msg-${msg.id}`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(msg.id)}
                      disabled={deletingId === msg.id}
                      data-ocid={`delete-msg-${msg.id}`}
                    >
                      {deletingId === msg.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </PageContent>
    </PortalLayout>
  );
}
