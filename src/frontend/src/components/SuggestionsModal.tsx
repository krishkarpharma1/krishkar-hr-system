import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  MessageSquare,
  Paperclip,
  Plus,
  Send,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { useAuthStore } from "../store/authStore";
import type {
  SuggestionPriority,
  SuggestionSubmission,
  SuggestionType,
} from "../types";
import { useAttachmentMailto } from "../utils/attachmentMailto";
import { formatDate } from "../utils/dateFormatter";

interface SuggestionsModalProps {
  open: boolean;
  onClose: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  Pending: "bg-amber-100 text-amber-800 border-amber-300",
  "Under Review": "bg-blue-100 text-blue-800 border-blue-300",
  Resolved: "bg-green-100 text-green-800 border-green-300",
  Closed: "bg-muted text-muted-foreground border-border",
};

const TYPE_OPTIONS: SuggestionType[] = [
  "Suggestion",
  "Query",
  "Complaint",
  "Feedback",
  "Other",
];

export function SuggestionsModal({ open, onClose }: SuggestionsModalProps) {
  const session = useAuthStore((s) => s.session);
  const [activeTab, setActiveTab] = useState<"submit" | "history">("submit");
  const [submissions, setSubmissions] = useState<SuggestionSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { buildMailto } = useAttachmentMailto();

  // Form state
  const [formType, setFormType] = useState<SuggestionType>("Suggestion");
  const [formSubject, setFormSubject] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPriority, setFormPriority] =
    useState<SuggestionPriority>("Normal");

  useEffect(() => {
    if (open && activeTab === "history" && session?.token) {
      loadSubmissions();
    }
  }, [open, activeTab, session?.token]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const loadSubmissions = async () => {
    if (!session?.token) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await api.getMySubmissions(session.token);
      // Mark unread replies as read
      const unreadIds = data
        .filter((s) => !s.isReadByEmployee && s.hrReply)
        .map((s) => s.id);
      if (unreadIds.length > 0) {
        await api.markSuggestionsAsRead(session.token, unreadIds);
      }
      setSubmissions(data.sort((a, b) => b.submittedAt - a.submittedAt));
    } catch (err) {
      console.error("[SuggestionsModal] loadSubmissions failed:", err);
      setLoadError("Could not load submission history. Tap to retry.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.token) return;
    if (!formSubject.trim() || !formDescription.trim()) {
      toast.error("Subject and description are required.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await api.submitSuggestion(session.token, {
        submissionType: formType,
        subject: formSubject.trim(),
        description: formDescription.trim(),
        priority: formPriority,
        attachmentUrl: undefined,
      });
      // Defensive null-check: guard against undefined/malformed responses
      if (!result || typeof result !== "object") {
        throw new Error("Invalid response from server");
      }
      if (result.ok) {
        toast.success(
          "Submitted successfully! HR will review your submission.",
        );
        setFormSubject("");
        setFormDescription("");
        setFormType("Suggestion");
        setFormPriority("Normal");
        setActiveTab("history");
        // Await loadSubmissions — if it fails, show error inside the modal
        // instead of letting the unhandled promise crash the page.
        try {
          await loadSubmissions();
        } catch (loadErr) {
          console.error(
            "[SuggestionsModal] post-submit loadSubmissions failed:",
            loadErr,
          );
          setLoadError("Could not load submission history. Tap to retry.");
        }
      } else {
        toast.error(result.error ?? "Failed to submit. Please try again.");
      }
    } catch (e) {
      console.error("[SuggestionsModal] submitSuggestion failed:", e);
      toast.error("Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  async function handleAttachment() {
    const userInfo = session
      ? await api.getUser(session.token, session.userId).catch(() => null)
      : null;
    const userTyped = userInfo as {
      designation?: string;
      hqAssignments?: { hqName?: string }[];
    } | null;
    const url = await buildMailto("suggestions", {
      employeeName: session?.name ?? "",
      name: session?.name ?? "",
      designation: userTyped?.designation ?? "",
      hq: userTyped?.hqAssignments?.[0]?.hqName ?? "",
      date: formatDate(new Date().toISOString().slice(0, 10)),
    });
    window.location.href = url;
  }

  if (!open) return null;

  return (
    <dialog
      open
      className="fixed inset-0 z-50 flex w-full h-full bg-transparent p-0 m-0 max-w-none max-h-none border-0"
      aria-label="Suggestions and Queries"
      data-ocid="suggestions.dialog"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
        aria-hidden="true"
        onClick={onClose}
        onKeyDown={(e) => e.key === "Enter" && onClose()}
        role="presentation"
      />

      {/* Panel — right-side drawer */}
      <div
        ref={panelRef}
        className="relative ml-auto w-full max-w-md h-full bg-card shadow-2xl flex flex-col border-l border-border overflow-hidden animate-in slide-in-from-right duration-300"
        data-ocid="suggestions.panel"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-card flex-shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            <h2 className="font-display font-bold text-base text-foreground">
              Suggestions & Queries
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            data-ocid="suggestions.close_button"
            className="rounded-lg p-1.5 hover:bg-muted transition-colors text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border flex-shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("submit")}
            data-ocid="suggestions.submit_tab"
            className={cn(
              "flex-1 py-3 text-sm font-body font-medium transition-colors flex items-center justify-center gap-2",
              activeTab === "submit"
                ? "text-primary border-b-2 border-primary bg-primary/5"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Plus className="w-4 h-4" />
            Submit New
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("history");
              if (session?.token) loadSubmissions();
            }}
            data-ocid="suggestions.history_tab"
            className={cn(
              "flex-1 py-3 text-sm font-body font-medium transition-colors flex items-center justify-center gap-2",
              activeTab === "history"
                ? "text-primary border-b-2 border-primary bg-primary/5"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Clock className="w-4 h-4" />
            My Submissions
            {submissions.filter((s) => !s.isReadByEmployee && s.hrReply)
              .length > 0 && (
              <span className="bg-destructive text-destructive-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {
                  submissions.filter((s) => !s.isReadByEmployee && s.hrReply)
                    .length
                }
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "submit" ? (
            <form
              onSubmit={handleSubmit}
              className="p-5 space-y-4"
              data-ocid="suggestions.submit_form"
            >
              <div className="space-y-1.5">
                <Label htmlFor="sg-type" className="font-body text-sm">
                  Type <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formType}
                  onValueChange={(v) => setFormType(v as SuggestionType)}
                >
                  <SelectTrigger
                    id="sg-type"
                    data-ocid="suggestions.type_select"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sg-subject" className="font-body text-sm">
                  Subject <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="sg-subject"
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value)}
                  placeholder="Brief subject of your submission"
                  maxLength={120}
                  required
                  data-ocid="suggestions.subject_input"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sg-desc" className="font-body text-sm">
                  Description <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="sg-desc"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Describe your suggestion, query, or complaint in detail..."
                  rows={5}
                  required
                  data-ocid="suggestions.description_textarea"
                  className="resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sg-priority" className="font-body text-sm">
                  Priority
                </Label>
                <Select
                  value={formPriority}
                  onValueChange={(v) =>
                    setFormPriority(v as SuggestionPriority)
                  }
                >
                  <SelectTrigger
                    id="sg-priority"
                    data-ocid="suggestions.priority_select"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Normal">Normal</SelectItem>
                    <SelectItem value="Urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Attachment */}
              <div className="space-y-1.5">
                <Label className="font-body text-sm">Attachment</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full border-primary/40 text-primary hover:bg-primary/5"
                  onClick={() => void handleAttachment()}
                  title="Tap to email your file to the company and your reporting managers. Your email app will open with all recipients pre-filled."
                  data-ocid="suggestions.attachment_button"
                >
                  <Paperclip className="w-3.5 h-3.5 mr-1.5" />
                  Attachment
                </Button>
                <p className="text-[11px] text-muted-foreground font-body">
                  Opens your email app with all recipients pre-filled.
                </p>
              </div>

              <Button
                type="submit"
                className="w-full gap-2"
                disabled={submitting}
                data-ocid="suggestions.submit_button"
              >
                <Send className="w-4 h-4" />
                {submitting ? "Submitting..." : "Submit"}
              </Button>
            </form>
          ) : (
            <div className="p-4 space-y-3" data-ocid="suggestions.history_list">
              {loading ? (
                <div
                  className="space-y-3"
                  data-ocid="suggestions.loading_state"
                >
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-20 rounded-lg bg-muted animate-pulse"
                    />
                  ))}
                </div>
              ) : loadError ? (
                <div
                  className="flex flex-col items-center py-16 text-center"
                  data-ocid="suggestions.error_state"
                >
                  <XCircle className="w-10 h-10 text-destructive mb-3" />
                  <p className="font-body text-sm text-foreground font-medium mb-1">
                    {loadError}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void loadSubmissions()}
                    className="mt-2"
                    data-ocid="suggestions.retry_button"
                  >
                    Retry
                  </Button>
                </div>
              ) : submissions.length === 0 ? (
                <div
                  className="flex flex-col items-center py-16 text-center"
                  data-ocid="suggestions.empty_state"
                >
                  <MessageSquare className="w-10 h-10 text-muted-foreground mb-3" />
                  <p className="font-body text-sm text-muted-foreground">
                    No submissions yet.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Use the Submit New tab to send your first query.
                  </p>
                </div>
              ) : (
                submissions.map((s, i) => (
                  <SubmissionCard
                    key={s.id}
                    submission={s}
                    index={i + 1}
                    expanded={expandedId === s.id}
                    onToggle={() =>
                      setExpandedId(expandedId === s.id ? null : s.id)
                    }
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}

function SubmissionCard({
  submission: s,
  index,
  expanded,
  onToggle,
}: {
  submission: SuggestionSubmission;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasUnreadReply = !s.isReadByEmployee && s.hrReply;
  return (
    <div
      className={cn(
        "rounded-lg border transition-colors",
        hasUnreadReply
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-card",
      )}
      data-ocid={`suggestions.history_item.${index}`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-4 py-3 flex items-start justify-between gap-2"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge variant="outline" className="text-xs py-0">
              {s.submissionType}
            </Badge>
            {s.priority === "Urgent" && (
              <Badge className="text-xs py-0 bg-destructive/10 text-destructive border-destructive/30">
                Urgent
              </Badge>
            )}
            <span
              className={cn(
                "text-xs px-2 py-0.5 rounded-full border font-body",
                STATUS_COLORS[s.status] ?? STATUS_COLORS.Closed,
              )}
            >
              {s.status}
            </span>
            {hasUnreadReply && (
              <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-bold">
                New Reply
              </span>
            )}
          </div>
          <p className="text-sm font-body font-medium text-foreground truncate">
            {s.subject}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date(s.submittedAt).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          <div>
            <p className="text-xs font-body font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Description
            </p>
            <p className="text-sm font-body text-foreground whitespace-pre-wrap">
              {s.description}
            </p>
          </div>
          {s.hrReply && (
            <div className="rounded-lg bg-primary/8 border border-primary/20 p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                <p className="text-xs font-body font-semibold text-primary uppercase tracking-wide">
                  HR Response
                  {s.hrReplyByName ? ` — ${s.hrReplyByName}` : ""}
                </p>
              </div>
              <p className="text-sm font-body text-foreground whitespace-pre-wrap">
                {s.hrReply}
              </p>
              {s.hrReplyAt && (
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(s.hrReplyAt).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              )}
            </div>
          )}
          {s.closingRemark && (
            <div>
              <p className="text-xs font-body font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Closing Remark
              </p>
              <p className="text-sm font-body text-muted-foreground">
                {s.closingRemark}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
