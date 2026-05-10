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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  FileText,
  Filter,
  MessageSquare,
  RefreshCw,
  X,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Role } from "../../backend";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { api } from "../../lib/api";
import { buildBrandingExcelRows } from "../../lib/brandingHtml";
import { useAuthStore } from "../../store/authStore";
import type {
  AddSuggestionReplyInput,
  SuggestionFilter,
  SuggestionStatus,
  SuggestionSubmission,
  SuggestionType,
  UpdateSuggestionStatusInput,
} from "../../types";
import { formatDate, formatDateTime } from "../../utils/dateFormatter";

// ── Types ─────────────────────────────────────────────────────────────────

type SortKey = "submittedAt" | "status" | "priority" | "submittedByName";
type SortDir = "asc" | "desc";

interface FilterState {
  type: string;
  role: string;
  priority: string;
  status: string;
  employeeName: string;
  fromDate: string;
  toDate: string;
}

const EMPTY_FILTER: FilterState = {
  type: "all",
  role: "all",
  priority: "all",
  status: "all",
  employeeName: "",
  fromDate: "",
  toDate: "",
};

// ── Helpers ───────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  Suggestion: "bg-blue-100 text-blue-700",
  Query: "bg-purple-100 text-purple-700",
  Complaint: "bg-red-100 text-red-700",
  Feedback: "bg-green-100 text-green-700",
  Other: "bg-muted text-muted-foreground",
};

const STATUS_COLORS: Record<SuggestionStatus, string> = {
  Pending: "bg-amber-100 text-amber-700",
  "Under Review": "bg-blue-100 text-blue-700",
  Resolved: "bg-green-100 text-green-700",
  Closed: "bg-muted text-muted-foreground",
};

const STATUS_ICONS: Record<
  SuggestionStatus,
  React.FC<{ className?: string }>
> = {
  Pending: Clock,
  "Under Review": RefreshCw,
  Resolved: CheckCircle,
  Closed: XCircle,
};

const ROLE_BADGE_COLORS: Record<string, string> = {
  MR: "bg-sky-100 text-sky-700",
  ASM: "bg-indigo-100 text-indigo-700",
  RSM: "bg-violet-100 text-violet-700",
  ZSM: "bg-fuchsia-100 text-fuchsia-700",
  HRManager: "bg-teal-100 text-teal-700",
  Admin: "bg-rose-100 text-rose-700",
};

function fmt(ts: number) {
  return formatDate(ts);
}

function fmtFull(ts: number) {
  return formatDateTime(ts);
}

function matchesFilter(s: SuggestionSubmission, f: FilterState): boolean {
  if (f.type !== "all" && s.submissionType !== f.type) return false;
  if (f.role !== "all" && s.submittedByRole !== f.role) return false;
  if (f.priority !== "all" && s.priority !== f.priority) return false;
  if (f.status !== "all" && s.status !== f.status) return false;
  if (
    f.employeeName.trim() &&
    !s.submittedByName
      .toLowerCase()
      .includes(f.employeeName.trim().toLowerCase())
  )
    return false;
  if (f.fromDate) {
    const from = new Date(f.fromDate).getTime();
    if (s.submittedAt < from) return false;
  }
  if (f.toDate) {
    const to = new Date(`${f.toDate}T23:59:59`).getTime();
    if (s.submittedAt > to) return false;
  }
  return true;
}

// ── Detail Panel ──────────────────────────────────────────────────────────

interface DetailPanelProps {
  submission: SuggestionSubmission;
  onClose: () => void;
  onSaved: (updated: SuggestionSubmission) => void;
}

function DetailPanel({ submission, onClose, onSaved }: DetailPanelProps) {
  const { session } = useAuthStore();
  const [status, setStatus] = useState<SuggestionStatus>(submission.status);
  const [remark, setRemark] = useState(submission.closingRemark ?? "");
  const [reply, setReply] = useState(submission.hrReply ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const StatusIcon = STATUS_ICONS[status];

  async function handleSave() {
    if (!session?.token) return;
    setSaving(true);
    setError(null);
    try {
      const statusInput: UpdateSuggestionStatusInput = {
        id: submission.id,
        status,
        closingRemark: remark || undefined,
      };
      await api.updateSuggestionStatus(session.token, statusInput);

      if (reply.trim() && reply.trim() !== (submission.hrReply ?? "")) {
        const replyInput: AddSuggestionReplyInput = {
          id: submission.id,
          reply: reply.trim(),
        };
        await api.addSuggestionReply(session.token, replyInput);
      }

      const updated: SuggestionSubmission = {
        ...submission,
        status,
        closingRemark: remark || undefined,
        hrReply: reply.trim() || undefined,
        hrReplyAt: reply.trim() ? Date.now() : submission.hrReplyAt,
      };
      onSaved(updated);
    } catch (e) {
      setError("Failed to save changes. Please try again.");
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      open
      className="fixed inset-0 z-50 flex p-0 m-0 w-full h-full max-w-none max-h-none border-0 bg-transparent"
      data-ocid="suggestions.dialog"
    >
      <button
        type="button"
        aria-label="Close panel"
        className="flex-1 bg-black/40 border-0 cursor-default"
        onClick={onClose}
      />
      <div className="w-full max-w-md bg-card border-l border-border shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <MessageSquare className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="font-display font-semibold text-sm truncate">
              Submission #{submission.id}
            </span>
          </div>
          <button
            type="button"
            aria-label="Close detail panel"
            data-ocid="suggestions.close_button"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-muted transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-xs text-muted-foreground block mb-0.5">
                Submitted By
              </span>
              <span className="font-semibold text-foreground">
                {submission.submittedByName}
              </span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block mb-0.5">
                Role
              </span>
              <span
                className={cn(
                  "text-xs font-semibold px-2 py-0.5 rounded",
                  ROLE_BADGE_COLORS[submission.submittedByRole] ??
                    "bg-muted text-foreground",
                )}
              >
                {submission.submittedByRole}
              </span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block mb-0.5">
                Employee ID
              </span>
              <span className="font-mono text-xs">
                {submission.submittedByEmployeeId}
              </span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block mb-0.5">
                Date
              </span>
              <span className="text-xs">{fmtFull(submission.submittedAt)}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block mb-0.5">
                Type
              </span>
              <span
                className={cn(
                  "text-xs font-semibold px-2 py-0.5 rounded",
                  TYPE_COLORS[submission.submissionType],
                )}
              >
                {submission.submissionType}
              </span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block mb-0.5">
                Priority
              </span>
              <span
                className={cn(
                  "text-xs font-semibold px-2 py-0.5 rounded",
                  submission.priority === "Urgent"
                    ? "bg-red-100 text-red-700"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {submission.priority}
              </span>
            </div>
          </div>

          {/* Subject + description */}
          <div className="space-y-2">
            <div>
              <span className="text-xs text-muted-foreground block mb-0.5">
                Subject
              </span>
              <p className="text-sm font-semibold text-foreground">
                {submission.subject}
              </p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block mb-0.5">
                Description
              </span>
              <p className="text-sm text-foreground bg-muted/30 rounded-md p-2 whitespace-pre-wrap border border-border">
                {submission.description}
              </p>
            </div>
          </div>

          {/* Status update */}
          <div className="space-y-2 border-t border-border pt-4">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Update Status
            </Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as SuggestionStatus)}
            >
              <SelectTrigger
                className="h-9"
                data-ocid="suggestions.status.select"
              >
                <div className="flex items-center gap-2">
                  <StatusIcon className="w-3.5 h-3.5" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                {(
                  [
                    "Pending",
                    "Under Review",
                    "Resolved",
                    "Closed",
                  ] as SuggestionStatus[]
                ).map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Remark */}
          <div className="space-y-1.5">
            <Label
              htmlFor="panel-remark"
              className="text-xs text-muted-foreground"
            >
              Closing Remark (optional)
            </Label>
            <Textarea
              id="panel-remark"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="Add a closing remark…"
              className="min-h-[64px] text-sm resize-none"
              data-ocid="suggestions.remark.textarea"
            />
          </div>

          {/* Reply */}
          <div className="space-y-1.5">
            <Label
              htmlFor="panel-reply"
              className="text-xs text-muted-foreground"
            >
              Reply / Response
            </Label>
            {submission.hrReply && (
              <div className="text-xs text-muted-foreground bg-green-50 border border-green-200 rounded p-2 mb-1">
                <span className="font-semibold text-green-700">
                  Previous reply:
                </span>{" "}
                {submission.hrReply}
              </div>
            )}
            <Textarea
              id="panel-reply"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Write a reply to this submission…"
              className="min-h-[80px] text-sm resize-none"
              data-ocid="suggestions.reply.textarea"
            />
            {submission.hrReplyAt && (
              <p className="text-xs text-muted-foreground">
                Last reply: {fmtFull(submission.hrReplyAt)}
                {submission.hrReplyByName
                  ? ` by ${submission.hrReplyByName}`
                  : ""}
              </p>
            )}
          </div>

          {/* Quick action buttons */}
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              className="text-green-700 border-green-200 hover:bg-green-50 text-xs"
              data-ocid="suggestions.resolve_button"
              onClick={() => setStatus("Resolved")}
            >
              <CheckCircle className="w-3.5 h-3.5 mr-1" />
              Mark Resolved
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-muted-foreground border-border hover:bg-muted text-xs"
              data-ocid="suggestions.close_action_button"
              onClick={() => setStatus("Closed")}
            >
              <XCircle className="w-3.5 h-3.5 mr-1" />
              Mark Closed
            </Button>
          </div>

          {error && (
            <p
              className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md"
              data-ocid="suggestions.error_state"
            >
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex gap-2 flex-shrink-0 bg-muted/20">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            data-ocid="suggestions.save_button"
            className="flex-1"
          >
            {saving ? (
              <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : null}
            Save Changes
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onClose}
            data-ocid="suggestions.cancel_button"
          >
            Cancel
          </Button>
        </div>
      </div>
    </dialog>
  );
}

// ── Skeleton rows ─────────────────────────────────────────────────────────

const SKELETON_ROWS = ["sk-1", "sk-2", "sk-3", "sk-4", "sk-5", "sk-6"] as const;
const SKELETON_COLS = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

// ── Main Page ─────────────────────────────────────────────────────────────

interface Props {
  portalRole?: "Admin" | "HRManager";
}

export default function SuggestionsManagement({ portalRole }: Props) {
  const { session } = useAuthStore();
  const role = (portalRole ?? session?.role ?? "Admin") as
    | "Admin"
    | "HRManager";

  const [submissions, setSubmissions] = useState<SuggestionSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<FilterState>(EMPTY_FILTER);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("submittedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [selected, setSelected] = useState<SuggestionSubmission | null>(null);
  const [exporting, setExporting] = useState(false);

  const companyProfileRef = useRef<
    import("../../backend.d").CompanyProfile | null
  >(null);

  const load = useCallback(async () => {
    if (!session?.token) return;
    setLoading(true);
    setError(null);
    try {
      const apiFilter: SuggestionFilter = {};
      if (filter.type !== "all")
        apiFilter.submissionType = filter.type as SuggestionType;
      if (filter.role !== "all") apiFilter.role = filter.role;
      if (filter.priority !== "all")
        apiFilter.priority = filter.priority as "Normal" | "Urgent";
      if (filter.status !== "all")
        apiFilter.status = filter.status as SuggestionStatus;
      if (filter.employeeName.trim())
        apiFilter.employeeName = filter.employeeName.trim();
      if (filter.fromDate)
        apiFilter.fromDate = new Date(filter.fromDate).getTime();
      if (filter.toDate)
        apiFilter.toDate = new Date(`${filter.toDate}T23:59:59`).getTime();

      const data = await api.getAllSubmissions(session.token, apiFilter);
      setSubmissions(data);
    } catch {
      setError("Failed to load submissions. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [session?.token, filter]);

  useEffect(() => {
    load();
  }, [load]);

  // Load company profile for Excel branding
  useEffect(() => {
    if (!session?.token) return;
    api
      .getCompanyProfile(session.token)
      .then((p) => {
        companyProfileRef.current = p ?? null;
      })
      .catch(() => {});
  }, [session?.token]);

  async function handleOpenDetail(s: SuggestionSubmission) {
    setSelected(s);
    if (!s.isReadByHR && session?.token) {
      try {
        await api.markSuggestionsAsRead(session.token, [s.id]);
        setSubmissions((prev) =>
          prev.map((x) => (x.id === s.id ? { ...x, isReadByHR: true } : x)),
        );
      } catch {
        // ignore
      }
    }
  }

  function handleSaved(updated: SuggestionSubmission) {
    setSubmissions((prev) =>
      prev.map((x) => (x.id === updated.id ? updated : x)),
    );
    setSelected(null);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  // Filter + sort
  const visible = submissions
    .filter((s) => matchesFilter(s, filter))
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === "submittedAt") cmp = a.submittedAt - b.submittedAt;
      else if (sortKey === "status") cmp = a.status.localeCompare(b.status);
      else if (sortKey === "priority")
        cmp = a.priority.localeCompare(b.priority);
      else if (sortKey === "submittedByName")
        cmp = a.submittedByName.localeCompare(b.submittedByName);
      return sortDir === "asc" ? cmp : -cmp;
    });

  const unreadCount = submissions.filter((s) => !s.isReadByHR).length;

  function handleExport() {
    setExporting(true);
    try {
      const brandingRows = buildBrandingExcelRows(companyProfileRef.current);
      const dataRows = visible.map((s, i) => ({
        "#": i + 1,
        "Employee Name": s.submittedByName,
        "Employee ID": s.submittedByEmployeeId,
        Role: s.submittedByRole,
        Type: s.submissionType,
        Subject: s.subject,
        Description: s.description,
        Priority: s.priority,
        Status: s.status,
        "Date Submitted": fmt(s.submittedAt),
        "Has Reply": s.hrReply ? "Yes" : "No",
        "HR Reply": s.hrReply ?? "",
        "Closing Remark": s.closingRemark ?? "",
      }));

      const allRows = [
        ...brandingRows,
        { "#": "Suggestions & Queries Report" },
        ...dataRows,
        {
          "#": "",
          "Employee Name": "Krishkar Pharmaceuticals : Empowering Health",
        },
      ];

      const ws = XLSX.utils.json_to_sheet(allRows, { skipHeader: false });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Suggestions & Queries");
      const today = new Date().toISOString().split("T")[0];
      XLSX.writeFile(wb, `Suggestions_Queries_${today}.xlsx`);
    } catch (e) {
      console.error("Export failed", e);
    } finally {
      setExporting(false);
    }
  }

  function resetFilters() {
    setFilter(EMPTY_FILTER);
  }

  const hasActiveFilters = Object.entries(filter).some(([k, v]) => {
    if (k === "type" || k === "role" || k === "priority" || k === "status")
      return v !== "all";
    return v !== "";
  });

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return null;
    return sortDir === "asc" ? (
      <ChevronUp className="w-3 h-3 inline-block ml-0.5" />
    ) : (
      <ChevronDown className="w-3 h-3 inline-block ml-0.5" />
    );
  }

  function handleRowKeyDown(
    e: React.KeyboardEvent<HTMLTableRowElement>,
    s: SuggestionSubmission,
  ) {
    if (e.key === "Enter" || e.key === " ") handleOpenDetail(s);
  }

  return (
    <PortalLayout portalRole={role === "Admin" ? Role.Admin : Role.HRManager}>
      <PageHeader
        title="Suggestions & Queries Management"
        subtitle="Review, respond to, and manage employee submissions"
      />
      <PageContent>
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setFiltersOpen((o) => !o)}
            data-ocid="suggestions.filter.toggle"
            className={cn(hasActiveFilters && "border-primary text-primary")}
          >
            <Filter className="w-3.5 h-3.5 mr-1.5" />
            Filters
            {hasActiveFilters && (
              <span className="ml-1.5 bg-primary text-primary-foreground text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                !
              </span>
            )}
          </Button>
          {hasActiveFilters && (
            <Button
              size="sm"
              variant="ghost"
              onClick={resetFilters}
              data-ocid="suggestions.filter.reset_button"
              className="text-muted-foreground"
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Clear
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={load}
            data-ocid="suggestions.refresh_button"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Refresh
          </Button>
          <div className="ml-auto flex items-center gap-2">
            {unreadCount > 0 && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold border border-amber-200">
                {unreadCount} unread
              </span>
            )}
            <Button
              size="sm"
              onClick={handleExport}
              disabled={exporting || visible.length === 0}
              data-ocid="suggestions.export_button"
              className="bg-[#00BCD4] hover:bg-[#00ACC1] text-white border-0"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Export Excel
            </Button>
          </div>
        </div>

        {/* Filter bar */}
        {filtersOpen && (
          <div
            className="bg-card border border-border rounded-lg p-4 mb-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
            data-ocid="suggestions.filter.panel"
          >
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select
                value={filter.type}
                onValueChange={(v) => setFilter((f) => ({ ...f, type: v }))}
              >
                <SelectTrigger
                  className="h-8 text-xs"
                  data-ocid="suggestions.filter.type"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {[
                    "Suggestion",
                    "Query",
                    "Complaint",
                    "Feedback",
                    "Other",
                  ].map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Role</Label>
              <Select
                value={filter.role}
                onValueChange={(v) => setFilter((f) => ({ ...f, role: v }))}
              >
                <SelectTrigger
                  className="h-8 text-xs"
                  data-ocid="suggestions.filter.role"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {["MR", "ASM", "RSM", "ZSM", "HRManager", "Admin"].map(
                    (r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Priority</Label>
              <Select
                value={filter.priority}
                onValueChange={(v) => setFilter((f) => ({ ...f, priority: v }))}
              >
                <SelectTrigger
                  className="h-8 text-xs"
                  data-ocid="suggestions.filter.priority"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="Normal">Normal</SelectItem>
                  <SelectItem value="Urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select
                value={filter.status}
                onValueChange={(v) => setFilter((f) => ({ ...f, status: v }))}
              >
                <SelectTrigger
                  className="h-8 text-xs"
                  data-ocid="suggestions.filter.status"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {["Pending", "Under Review", "Resolved", "Closed"].map(
                    (s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 col-span-2 sm:col-span-1">
              <Label className="text-xs">Employee Name</Label>
              <div className="relative">
                <Input
                  placeholder="Search by name…"
                  value={filter.employeeName}
                  onChange={(e) =>
                    setFilter((f) => ({
                      ...f,
                      employeeName: e.target.value,
                    }))
                  }
                  className="h-8 text-xs pr-7"
                  data-ocid="suggestions.filter.search_input"
                />
                {filter.employeeName && (
                  <button
                    type="button"
                    onClick={() =>
                      setFilter((f) => ({ ...f, employeeName: "" }))
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Clear name filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">From Date</Label>
              <Input
                type="date"
                value={filter.fromDate}
                onChange={(e) =>
                  setFilter((f) => ({ ...f, fromDate: e.target.value }))
                }
                className="h-8 text-xs"
                data-ocid="suggestions.filter.from_date"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">To Date</Label>
              <Input
                type="date"
                value={filter.toDate}
                onChange={(e) =>
                  setFilter((f) => ({ ...f, toDate: e.target.value }))
                }
                className="h-8 text-xs"
                data-ocid="suggestions.filter.to_date"
              />
            </div>

            <div className="flex items-end col-span-2 sm:col-span-1">
              <Button
                size="sm"
                onClick={load}
                className="h-8 text-xs w-full"
                data-ocid="suggestions.filter.apply_button"
              >
                Apply Filters
              </Button>
            </div>
          </div>
        )}

        {/* Stats bar */}
        <div className="flex flex-wrap gap-3 mb-4 text-xs">
          <span className="text-muted-foreground">
            Showing{" "}
            <strong className="text-foreground">{visible.length}</strong> of{" "}
            <strong className="text-foreground">{submissions.length}</strong>{" "}
            submissions
          </span>
          {(
            [
              "Pending",
              "Under Review",
              "Resolved",
              "Closed",
            ] as SuggestionStatus[]
          ).map((s) => {
            const count = visible.filter((x) => x.status === s).length;
            if (!count) return null;
            return (
              <span
                key={s}
                className={cn(
                  "px-2 py-0.5 rounded-full font-semibold",
                  STATUS_COLORS[s],
                )}
              >
                {s}: {count}
              </span>
            );
          })}
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-ocid="suggestions.table">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-xs uppercase tracking-wider">
                  <th className="px-3 py-2.5 text-left font-display text-muted-foreground w-8">
                    #
                  </th>
                  <th className="px-3 py-2.5 text-left font-display text-muted-foreground whitespace-nowrap">
                    <button
                      type="button"
                      className="hover:text-foreground select-none whitespace-nowrap"
                      onClick={() => toggleSort("submittedByName")}
                    >
                      Employee <SortIcon col="submittedByName" />
                    </button>
                  </th>
                  <th className="px-3 py-2.5 text-left font-display text-muted-foreground whitespace-nowrap hidden sm:table-cell">
                    Role
                  </th>
                  <th className="px-3 py-2.5 text-left font-display text-muted-foreground hidden md:table-cell">
                    Type
                  </th>
                  <th className="px-3 py-2.5 text-left font-display text-muted-foreground max-w-[200px]">
                    Subject
                  </th>
                  <th className="px-3 py-2.5 text-left font-display text-muted-foreground hidden lg:table-cell whitespace-nowrap">
                    <button
                      type="button"
                      className="hover:text-foreground select-none whitespace-nowrap"
                      onClick={() => toggleSort("priority")}
                    >
                      Priority <SortIcon col="priority" />
                    </button>
                  </th>
                  <th className="px-3 py-2.5 text-left font-display text-muted-foreground whitespace-nowrap">
                    <button
                      type="button"
                      className="hover:text-foreground select-none whitespace-nowrap"
                      onClick={() => toggleSort("status")}
                    >
                      Status <SortIcon col="status" />
                    </button>
                  </th>
                  <th className="px-3 py-2.5 text-left font-display text-muted-foreground hidden md:table-cell whitespace-nowrap">
                    <button
                      type="button"
                      className="hover:text-foreground select-none whitespace-nowrap"
                      onClick={() => toggleSort("submittedAt")}
                    >
                      Date <SortIcon col="submittedAt" />
                    </button>
                  </th>
                  <th className="px-3 py-2.5 text-left font-display text-muted-foreground hidden lg:table-cell">
                    Reply
                  </th>
                  <th className="px-3 py-2.5 text-left font-display text-muted-foreground">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading &&
                  SKELETON_ROWS.map((rowId) => (
                    <tr key={rowId}>
                      {SKELETON_COLS.map((colId) => (
                        <td key={`${rowId}-${colId}`} className="px-3 py-2.5">
                          <Skeleton className="h-4 w-full rounded" />
                        </td>
                      ))}
                    </tr>
                  ))}

                {!loading && error && (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center">
                      <div
                        className="text-sm text-destructive space-y-2"
                        data-ocid="suggestions.error_state"
                      >
                        <p>{error}</p>
                        <Button size="sm" variant="outline" onClick={load}>
                          Retry
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}

                {!loading && !error && visible.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-10 text-center"
                      data-ocid="suggestions.empty_state"
                    >
                      <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground font-body">
                        {hasActiveFilters
                          ? "No submissions match your filters."
                          : "No submissions yet."}
                      </p>
                      {hasActiveFilters && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={resetFilters}
                          className="mt-2"
                        >
                          Clear Filters
                        </Button>
                      )}
                    </td>
                  </tr>
                )}

                {!loading &&
                  !error &&
                  visible.map((s, idx) => (
                    <tr
                      key={s.id}
                      tabIndex={0}
                      className={cn(
                        "hover:bg-muted/30 cursor-pointer transition-colors",
                        !s.isReadByHR &&
                          "border-l-2 border-l-amber-400 bg-amber-50/30",
                      )}
                      onClick={() => handleOpenDetail(s)}
                      onKeyDown={(e) => handleRowKeyDown(e, s)}
                      data-ocid={`suggestions.item.${idx + 1}`}
                    >
                      <td className="px-3 py-2.5 text-muted-foreground text-xs font-mono">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="font-semibold text-xs text-foreground truncate max-w-[120px]">
                            {s.submittedByName}
                            {!s.isReadByHR && (
                              <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-amber-500 align-middle" />
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {s.submittedByEmployeeId}
                          </p>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 hidden sm:table-cell">
                        <span
                          className={cn(
                            "text-xs font-semibold px-1.5 py-0.5 rounded whitespace-nowrap",
                            ROLE_BADGE_COLORS[s.submittedByRole] ??
                              "bg-muted text-foreground",
                          )}
                        >
                          {s.submittedByRole}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 hidden md:table-cell">
                        <span
                          className={cn(
                            "text-xs font-semibold px-1.5 py-0.5 rounded",
                            TYPE_COLORS[s.submissionType],
                          )}
                        >
                          {s.submissionType}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 max-w-[180px]">
                        <p
                          className="text-xs text-foreground truncate"
                          title={s.subject}
                        >
                          {s.subject.length > 40
                            ? `${s.subject.slice(0, 40)}…`
                            : s.subject}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 hidden lg:table-cell">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs border-0",
                            s.priority === "Urgent"
                              ? "bg-red-100 text-red-700"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {s.priority}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            "text-xs font-semibold px-1.5 py-0.5 rounded whitespace-nowrap",
                            STATUS_COLORS[s.status],
                          )}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground hidden md:table-cell whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {fmt(s.submittedAt)}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 hidden lg:table-cell">
                        <span
                          className={cn(
                            "text-xs font-semibold w-2 h-2 rounded-full inline-block",
                            s.hrReply
                              ? "bg-green-500"
                              : "bg-muted-foreground/30",
                          )}
                          title={s.hrReply ? "Has reply" : "No reply"}
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-2"
                          data-ocid={`suggestions.open_modal_button.${idx + 1}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetail(s);
                          }}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </PageContent>

      {selected && (
        <DetailPanel
          submission={selected}
          onClose={() => setSelected(null)}
          onSaved={handleSaved}
        />
      )}
    </PortalLayout>
  );
}
