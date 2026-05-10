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
import {
  Calendar,
  CheckCircle2,
  FileText,
  Info,
  Loader2,
  MapPin,
  Paperclip,
  Plus,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LeaveType, Role } from "../../backend";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { useGps } from "../../hooks/useGps";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import { LeaveStatus } from "../../types";
import type { LeaveApplication } from "../../types";
import { useAttachmentMailto } from "../../utils/attachmentMailto";
import { formatDate } from "../../utils/dateFormatter";

// ── Types ───────────────────────────────────────────────────────────────────

// ── Constants ────────────────────────────────────────────────────────────────

const LEAVE_TYPE_OPTIONS: { value: LeaveType; label: string }[] = [
  { value: LeaveType.casual, label: "Casual Leave (CL)" },
  { value: LeaveType.sick, label: "Sick Leave (SL)" },
  { value: LeaveType.pl, label: "Privilege Leave (PL)" },
  { value: LeaveType.ml, label: "Maternity Leave (ML)" },
  { value: LeaveType.lwp, label: "Leave Without Pay (LWP)" },
  { value: LeaveType.co, label: "Compensatory Off (CO)" },
];

const LEAVE_TYPE_LABELS: Record<string, string> = {
  [LeaveType.casual]: "Casual Leave (CL)",
  [LeaveType.sick]: "Sick Leave (SL)",
  [LeaveType.pl]: "Privilege Leave (PL)",
  [LeaveType.ml]: "Maternity Leave (ML)",
  [LeaveType.lwp]: "Leave Without Pay (LWP)",
  [LeaveType.co]: "Compensatory Off (CO)",
  // legacy backward-compat
  [LeaveType.unpaid]: "Leave Without Pay (LWP)",
};

const STATUS_BADGE: Record<
  string,
  {
    variant: "outline" | "secondary" | "destructive";
    icon: React.ReactNode;
    cls: string;
  }
> = {
  [LeaveStatus.pending]: {
    variant: "outline",
    icon: <Calendar className="w-3 h-3" />,
    cls: "text-amber-600 border-amber-300 bg-amber-50",
  },
  [LeaveStatus.approved]: {
    variant: "outline",
    icon: <CheckCircle2 className="w-3 h-3" />,
    cls: "text-emerald-600 border-emerald-300 bg-emerald-50",
  },
  [LeaveStatus.rejected]: {
    variant: "outline",
    icon: <XCircle className="w-3 h-3" />,
    cls: "text-red-600 border-red-300 bg-red-50",
  },
};

// ── Approval chain messages ────────────────────────────────────────────────

const APPROVAL_CHAIN_MSG: Partial<Record<Role, string>> = {
  [Role.ASM]:
    "Your leave will be sent to your RSM for recommendation, then HR/Admin for final approval.",
  [Role.RSM]:
    "Your leave will be sent to your ZSM for recommendation, then HR/Admin for final approval.",
  [Role.ZSM]:
    "Your leave will be sent directly to HR/Admin for final approval.",
};

// ── Helper ───────────────────────────────────────────────────────────────────

function daysBetween(from: string, to: string): number {
  if (!from || !to) return 0;
  const diff = new Date(to).getTime() - new Date(from).getTime();
  return Math.max(0, Math.floor(diff / 86400000) + 1);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function GpsStatusBadge({
  coords,
  onRefresh,
  loading,
}: {
  coords: { lat: number; lng: number } | null;
  onRefresh: () => void;
  loading?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-mono ${
        coords
          ? "border-emerald-300 bg-emerald-50 text-emerald-600"
          : "border-orange-300 bg-orange-50 text-orange-500"
      }`}
      data-ocid="gps-status-leave"
    >
      <MapPin className="w-3 h-3" />
      {coords
        ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
        : "Location not available"}
      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        className="ml-0.5 opacity-70 hover:opacity-100 transition-opacity"
        aria-label="Refresh location"
      >
        <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
      </button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface MRLeaveProps {
  portalRole?: Role;
}

export default function MRLeave({ portalRole = Role.MR }: MRLeaveProps) {
  const session = useAuthStore((s) => s.session);
  const { coords: gpsCoords, loading: gpsLoading, refreshGps } = useGps();
  const { buildMailto } = useAttachmentMailto();

  const [tab, setTab] = useState<"list" | "apply">("list");
  const [statusFilter, setStatusFilter] = useState<"all" | LeaveStatus>("all");
  const [leaves, setLeaves] = useState<LeaveApplication[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const today = new Date().toISOString().slice(0, 10);
  const [leaveType, setLeaveType] = useState<LeaveType>(LeaveType.casual);
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const days = daysBetween(fromDate, toDate);

  // ── Load data ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!session) return;
    setDataLoading(true);
    Promise.all([api.getMyLeaves(session.token)])
      .then(([leavesRes]) => {
        if (leavesRes.__kind__ === "ok") setLeaves(leavesRes.ok);
      })
      .catch(() => {})
      .finally(() => setDataLoading(false));
  }, [session]);

  // ── Attachment email ──────────────────────────────────────────────────────

  async function handleAttachment() {
    const leaveTypeLabel = LEAVE_TYPE_LABELS[leaveType] ?? leaveType;
    const dateDisplay = formatDate(fromDate);
    const userInfo = session
      ? await api.getUser(session.token, session.userId).catch(() => null)
      : null;
    const userTyped = userInfo as {
      designation?: string;
      hqAssignments?: { hqName?: string }[];
    } | null;
    const designation = userTyped?.designation ?? "";
    const hq = userTyped?.hqAssignments?.[0]?.hqName ?? "";

    const url = await buildMailto("leaveApplication", {
      employeeName: session?.name ?? "",
      name: session?.name ?? "",
      designation,
      hq,
      leaveType: leaveTypeLabel,
      date: dateDisplay,
    });
    window.location.href = url;
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleApply() {
    if (!session) return;
    if (!reason.trim()) {
      toast.error("Please provide a reason for leave");
      return;
    }
    if (fromDate > toDate) {
      toast.error("End date must be on or after start date");
      return;
    }

    const gpsLocation = gpsCoords
      ? {
          lat: gpsCoords.lat,
          lng: gpsCoords.lng,
          timestamp: BigInt(Date.now()),
        }
      : undefined;

    setSubmitting(true);
    try {
      const res = await api.applyLeaveV2(session.token, {
        leaveType,
        fromDate,
        toDate,
        numDays: BigInt(days),
        reason: reason.trim(),
        notes: notes.trim() || undefined,
        attachmentUrl: undefined,
        gpsLocation,
      });

      if (res.__kind__ === "err") {
        toast.error(`Application failed: ${res.err}`);
        return;
      }

      toast.success("Leave application submitted successfully");
      setReason("");
      setNotes("");
      setFromDate(today);
      setToDate(today);
      setTab("list");
      // Refresh leaves list
      const [leavesRes] = await Promise.all([api.getMyLeaves(session.token)]);
      if (leavesRes.__kind__ === "ok") setLeaves(leavesRes.ok);
    } catch {
      toast.error("Failed to submit leave application");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Filtered leaves ───────────────────────────────────────────────────────

  const filteredLeaves =
    statusFilter === "all"
      ? leaves
      : leaves.filter((l) => l.status === statusFilter);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <PortalLayout portalRole={portalRole}>
      <PageHeader
        title="Leave Management"
        subtitle="Apply for leave and track your applications"
        actions={
          <div className="flex gap-2">
            <Button
              variant={tab === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setTab("list")}
              data-ocid="tab-leave-list"
            >
              My Leaves
            </Button>
            <Button
              variant={tab === "apply" ? "default" : "outline"}
              size="sm"
              onClick={() => setTab("apply")}
              data-ocid="tab-apply-leave"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Apply Leave
            </Button>
          </div>
        }
      />

      <PageContent>
        {tab === "list" ? (
          <div className="space-y-4">
            {/* Status filter tabs */}
            <div
              className="flex gap-2 flex-wrap"
              data-ocid="leave-status-filter"
            >
              {(
                [
                  ["all", "All"],
                  [LeaveStatus.pending, "Pending"],
                  [LeaveStatus.approved, "Approved"],
                  [LeaveStatus.rejected, "Rejected"],
                ] as const
              ).map(([val, label]) => (
                <Button
                  key={val}
                  variant={statusFilter === val ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(val)}
                >
                  {label}
                  {val !== "all" && (
                    <span className="ml-1.5 text-xs opacity-70">
                      ({leaves.filter((l) => l.status === val).length})
                    </span>
                  )}
                </Button>
              ))}
            </div>

            {/* Leave cards (mobile-friendly) */}
            {dataLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="bg-card border border-border rounded-lg p-4 h-24 animate-pulse"
                  />
                ))}
              </div>
            ) : filteredLeaves.length === 0 ? (
              <div
                className="bg-card border border-dashed border-border rounded-lg p-10 text-center"
                data-ocid="leave-empty-state"
              >
                <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-display font-medium text-foreground">
                  No leave applications
                </p>
                <p className="text-xs text-muted-foreground mt-1 font-body">
                  {statusFilter === "all"
                    ? "You haven't submitted any leave applications yet."
                    : `No ${statusFilter} applications found.`}
                </p>
                <Button
                  size="sm"
                  className="mt-4"
                  onClick={() => setTab("apply")}
                >
                  Apply for Leave
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredLeaves.map((leave) => {
                  const badge =
                    STATUS_BADGE[leave.status] ??
                    STATUS_BADGE[LeaveStatus.pending];
                  const numDays = daysBetween(leave.fromDate, leave.toDate);
                  const hasRemark =
                    leave.approverRemark &&
                    (leave.status === LeaveStatus.approved ||
                      leave.status === LeaveStatus.rejected);

                  return (
                    <div
                      key={leave.id.toString()}
                      className="bg-card border border-border rounded-lg p-4 space-y-2"
                      data-ocid="leave-card"
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="space-y-1 min-w-0">
                          <p className="font-display font-semibold text-sm text-foreground">
                            {LEAVE_TYPE_LABELS[leave.leaveType] ??
                              leave.leaveType}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {leave.fromDate} → {leave.toDate}
                            <span className="ml-2 font-body text-foreground/70">
                              ({numDays} day{numDays !== 1 ? "s" : ""})
                            </span>
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={`flex items-center gap-1 text-xs ${badge.cls}`}
                        >
                          {badge.icon}
                          <span className="capitalize">{leave.status}</span>
                        </Badge>
                      </div>

                      {leave.reason && (
                        <p className="text-xs text-muted-foreground font-body border-t border-border/50 pt-2">
                          <span className="text-foreground/60 font-medium">
                            Reason:
                          </span>{" "}
                          {leave.reason}
                        </p>
                      )}

                      {hasRemark && (
                        <div
                          className={`flex items-start gap-2 text-xs rounded px-3 py-2 font-body ${
                            leave.status === LeaveStatus.approved
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-red-50 text-red-700 border border-red-200"
                          }`}
                          data-ocid="leave-approver-remark"
                        >
                          <span className="font-medium mt-0.5 flex-shrink-0">
                            Manager's comment:
                          </span>
                          <span>{leave.approverRemark}</span>
                        </div>
                      )}

                      {leave.attachmentUrl && (
                        <a
                          href={leave.attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-primary underline-offset-2 hover:underline"
                          data-ocid="leave-attachment-link"
                        >
                          <Paperclip className="w-3 h-3" />
                          View Attachment
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* ── Apply Leave Form ─────────────────────────────────────────── */
          <div className="max-w-lg space-y-5">
            {/* Approval chain info banner — shown for manager roles */}
            {APPROVAL_CHAIN_MSG[portalRole] && (
              <div className="flex items-start gap-2.5 bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 text-xs text-primary font-body">
                <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>{APPROVAL_CHAIN_MSG[portalRole]}</span>
              </div>
            )}
            <div className="bg-card border border-border rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                  Leave Application Form
                </h3>
                <GpsStatusBadge
                  coords={gpsCoords}
                  onRefresh={refreshGps}
                  loading={gpsLoading}
                />
              </div>

              {/* Leave Type */}
              <div>
                <Label
                  htmlFor="leave-type"
                  className="text-xs mb-1.5 block font-medium"
                >
                  Leave Type <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={leaveType}
                  onValueChange={(v) => setLeaveType(v as LeaveType)}
                >
                  <SelectTrigger id="leave-type" data-ocid="leave-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAVE_TYPE_OPTIONS.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label
                    htmlFor="leave-from"
                    className="text-xs mb-1.5 block font-medium"
                  >
                    Start Date <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="leave-from"
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    data-ocid="leave-from"
                    className="h-10"
                  />
                </div>
                <div>
                  <Label
                    htmlFor="leave-to"
                    className="text-xs mb-1.5 block font-medium"
                  >
                    End Date <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="leave-to"
                    type="date"
                    value={toDate}
                    min={fromDate}
                    onChange={(e) => setToDate(e.target.value)}
                    data-ocid="leave-to"
                    className="h-10"
                  />
                </div>
              </div>

              {/* Auto-calculated days */}
              <div
                className={`flex items-center justify-between text-xs rounded-md px-3 py-2.5 border ${
                  days > 0
                    ? "bg-primary/5 border-primary/20 text-primary"
                    : "bg-muted/30 border-border text-muted-foreground"
                }`}
                data-ocid="leave-days-display"
              >
                <span className="font-body">Number of Days</span>
                <span className="font-display font-bold text-base">
                  {days > 0 ? `${days} day${days !== 1 ? "s" : ""}` : "—"}
                </span>
              </div>

              {/* Reason */}
              <div>
                <Label
                  htmlFor="leave-reason"
                  className="text-xs mb-1.5 block font-medium"
                >
                  Reason <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="leave-reason"
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Describe the reason for your leave..."
                  data-ocid="leave-reason"
                  className="resize-none"
                />
              </div>

              {/* Supporting Notes (optional) */}
              <div>
                <Label
                  htmlFor="leave-notes"
                  className="text-xs mb-1.5 block font-medium"
                >
                  Supporting Notes{" "}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </Label>
                <Textarea
                  id="leave-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional details..."
                  data-ocid="leave-notes"
                  className="resize-none"
                />
              </div>

              {/* Attachment */}
              <div>
                <Label className="text-xs mb-1.5 block font-medium">
                  Attachment
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full border-primary/40 text-primary hover:bg-primary/5"
                  onClick={() => void handleAttachment()}
                  title="Tap to email your file to the company and your reporting managers. Your email app will open with all recipients pre-filled."
                  data-ocid="leave-attachment-button"
                >
                  <Paperclip className="w-3.5 h-3.5 mr-1.5" />
                  Attachment
                </Button>
                <p className="text-[11px] text-muted-foreground mt-1.5 font-body">
                  Opens your email app with all recipients pre-filled.
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleApply}
                disabled={submitting || days <= 0 || !reason.trim()}
                data-ocid="submit-leave"
                className="flex-1 sm:flex-none"
              >
                {submitting && (
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                )}
                {submitting ? "Submitting..." : "Submit Application"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setTab("list")}
                disabled={submitting}
              >
                Cancel
              </Button>
            </div>

            {!gpsCoords && (
              <p className="text-xs text-amber-600 font-body flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                GPS location will not be attached to this application. Enable
                location for better tracking.
              </p>
            )}
          </div>
        )}
      </PageContent>
    </PortalLayout>
  );
}
