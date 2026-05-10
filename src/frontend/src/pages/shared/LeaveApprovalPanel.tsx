import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  CalendarDays,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Paperclip,
  User,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { useEmployeeNames } from "../../lib/nameResolver";
import { useAuthStore } from "../../store/authStore";
import { LeaveStatus } from "../../types";
import type { LeaveApplication } from "../../types";

interface ActionState {
  leaveId: bigint;
  mode: "approve" | "reject";
  remark: string;
  submitting: boolean;
}

interface LeaveCardProps {
  leave: LeaveApplication;
  onAction: (leaveId: bigint, mode: "approve" | "reject") => void;
  action: ActionState | null;
  onRemarkChange: (remark: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  employeeName: string;
}

const LEAVE_TYPE_LABELS: Record<string, string> = {
  casual: "Casual Leave (CL)",
  sick: "Sick Leave (SL)",
  pl: "Privilege Leave (PL)",
  ml: "Maternity Leave (ML)",
  lwp: "Leave Without Pay (LWP)",
  co: "Compensatory Off (CO)",
  // legacy backward-compat
  unpaid: "Leave Without Pay (LWP)",
};

function LeaveCard({
  leave,
  onAction,
  action,
  onRemarkChange,
  onConfirm,
  onCancel,
  employeeName,
}: LeaveCardProps) {
  const isActive = action?.leaveId === leave.id;

  return (
    <div
      className="bg-background border border-border rounded-lg p-4 space-y-3"
      data-ocid={`leave-card-${leave.id}`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              <User className="w-3 h-3" />
              {employeeName}
            </span>
            <Badge variant="secondary" className="text-xs capitalize">
              {LEAVE_TYPE_LABELS[String(leave.leaveType)] ??
                String(leave.leaveType)}
            </Badge>
            <Badge
              variant="outline"
              className="text-xs capitalize border-amber-300 text-amber-700 bg-amber-50"
            >
              <Clock className="w-3 h-3 mr-1" />
              {leave.status}
            </Badge>
          </div>

          {/* Date range */}
          <div className="flex items-center gap-1.5 mt-2 text-sm text-foreground">
            <CalendarDays className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <span className="font-medium">{leave.fromDate}</span>
            <span className="text-muted-foreground">→</span>
            <span className="font-medium">{leave.toDate}</span>
            <span className="text-muted-foreground text-xs ml-1">
              ({String(leave.numDays)} day
              {Number(leave.numDays) !== 1 ? "s" : ""})
            </span>
          </div>
        </div>

        {/* Action buttons */}
        {!isActive && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-3 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
              onClick={() => onAction(leave.id, "approve")}
              data-ocid={`btn-approve-leave-${leave.id}`}
            >
              <CheckCircle className="w-3.5 h-3.5 mr-1" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-3 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => onAction(leave.id, "reject")}
              data-ocid={`btn-reject-leave-${leave.id}`}
            >
              <XCircle className="w-3.5 h-3.5 mr-1" />
              Reject
            </Button>
          </div>
        )}
      </div>

      {/* Reason */}
      <div className="flex items-start gap-1.5 text-sm">
        <FileText className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
        <p className="text-muted-foreground leading-snug">{leave.reason}</p>
      </div>

      {/* Notes */}
      {leave.notes && (
        <p className="text-xs text-muted-foreground bg-muted/40 rounded px-2.5 py-1.5 italic">
          Note: {leave.notes}
        </p>
      )}

      {/* Attachment */}
      {leave.attachmentUrl && (
        <a
          href={leave.attachmentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <Paperclip className="w-3 h-3" />
          View Attachment
        </a>
      )}

      {/* Inline action form */}
      {isActive && (
        <div
          className="border border-border rounded-lg p-3 bg-muted/20 space-y-3"
          data-ocid="leave-action-form"
        >
          <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
            {action?.mode === "approve" ? (
              <CheckCircle className="w-4 h-4 text-emerald-600" />
            ) : (
              <XCircle className="w-4 h-4 text-destructive" />
            )}
            {action?.mode === "approve" ? "Approve" : "Reject"} Leave —{" "}
            <span className="text-muted-foreground font-normal text-xs">
              {employeeName}
            </span>
          </p>
          <div className="space-y-1">
            <label
              htmlFor={`remark-${leave.id}`}
              className="text-xs text-muted-foreground"
            >
              Remark / Comment{" "}
              <span className="text-muted-foreground/70">
                {action?.mode === "approve" ? "(optional)" : "(recommended)"}
              </span>
            </label>
            <Textarea
              id={`remark-${leave.id}`}
              value={action?.remark ?? ""}
              onChange={(e) => onRemarkChange(e.target.value)}
              placeholder={
                action?.mode === "approve"
                  ? "Add a note for the employee (optional)…"
                  : "Provide a reason for rejection…"
              }
              className="min-h-[72px] text-sm resize-none"
              data-ocid="leave-remark-textarea"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={onConfirm}
              disabled={action?.submitting}
              className={
                action?.mode === "approve"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white h-8 px-4"
                  : "bg-destructive hover:bg-destructive/90 text-destructive-foreground h-8 px-4"
              }
              data-ocid="btn-confirm-leave-action"
            >
              {action?.submitting
                ? "Saving…"
                : action?.mode === "approve"
                  ? "Confirm Approval"
                  : "Confirm Rejection"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onCancel}
              disabled={action?.submitting}
              className="h-8 px-3 text-muted-foreground"
              data-ocid="btn-cancel-leave-action"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

interface LeaveApprovalPanelProps {
  token: string;
}

export default function LeaveApprovalPanel({ token }: LeaveApprovalPanelProps) {
  const { session } = useAuthStore();
  const [leaves, setLeaves] = useState<LeaveApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [currentAction, setCurrentAction] = useState<ActionState | null>(null);
  const { getEmployeeNameByUid } = useEmployeeNames();

  const currentUserId = session?.userId ?? BigInt(0);

  useEffect(() => {
    if (!token) return;
    loadLeaves();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function loadLeaves() {
    setLoading(true);
    try {
      const res = await api.getPendingLeavesForManager(token);
      if (res.__kind__ === "ok") {
        setLeaves(res.ok.filter((l) => l.status === LeaveStatus.pending));
      }
    } finally {
      setLoading(false);
    }
  }

  function handleStartAction(leaveId: bigint, mode: "approve" | "reject") {
    setCurrentAction({ leaveId, mode, remark: "", submitting: false });
  }

  function handleRemarkChange(remark: string) {
    setCurrentAction((prev) => (prev ? { ...prev, remark } : null));
  }

  async function handleConfirm() {
    if (!currentAction) return;
    setCurrentAction((prev) => (prev ? { ...prev, submitting: true } : null));

    const status =
      currentAction.mode === "approve"
        ? LeaveStatus.approved
        : LeaveStatus.rejected;

    try {
      const res = await api.updateLeaveStatus(token, {
        leaveId: String(currentAction.leaveId),
        status: status as unknown as Parameters<
          typeof api.updateLeaveStatus
        >[1]["status"],
        approverId: currentUserId,
        remark: currentAction.remark || undefined,
      });

      if (res.__kind__ === "ok") {
        toast.success(
          currentAction.mode === "approve"
            ? "Leave approved successfully"
            : "Leave rejected",
        );
        setLeaves((prev) => prev.filter((l) => l.id !== currentAction.leaveId));
        setCurrentAction(null);
      } else {
        toast.error(res.err || "Failed to update leave status");
        setCurrentAction((prev) =>
          prev ? { ...prev, submitting: false } : null,
        );
      }
    } catch {
      toast.error("An error occurred. Please try again.");
      setCurrentAction((prev) =>
        prev ? { ...prev, submitting: false } : null,
      );
    }
  }

  function handleCancel() {
    setCurrentAction(null);
  }

  const pendingCount = leaves.length;

  return (
    <div
      className="bg-card border border-border rounded-lg overflow-hidden"
      data-ocid="leave-approval-panel"
    >
      {/* Panel header */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors text-left"
        onClick={() => setCollapsed((c) => !c)}
        data-ocid="leave-panel-toggle"
      >
        <div className="flex items-center gap-3">
          <CalendarDays className="w-4 h-4 text-muted-foreground" />
          <span className="font-display font-semibold text-sm">
            Leave Approvals
          </span>
          {loading ? (
            <span className="text-xs text-muted-foreground">Loading…</span>
          ) : (
            <Badge
              className={
                pendingCount > 0
                  ? "bg-destructive text-destructive-foreground text-xs px-2 py-0"
                  : "bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs px-2 py-0"
              }
              data-ocid="leave-pending-count"
            >
              {pendingCount > 0 ? `${pendingCount} Pending` : "All Clear"}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!loading && !collapsed && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={(e) => {
                e.stopPropagation();
                loadLeaves();
              }}
              data-ocid="btn-refresh-leaves"
            >
              Refresh
            </Button>
          )}
          {collapsed ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Panel body */}
      {!collapsed && (
        <div className="px-4 pb-4 border-t border-border">
          {loading ? (
            <div className="space-y-3 pt-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-24 bg-muted/40 rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : pendingCount === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2"
              data-ocid="leave-empty-state"
            >
              <CheckCircle className="w-8 h-8 opacity-30" />
              <p className="text-sm">No pending leave requests</p>
              <p className="text-xs opacity-70">
                All leave applications have been reviewed
              </p>
            </div>
          ) : (
            <div className="space-y-3 pt-3 max-h-[520px] overflow-y-auto scrollbar-thin pr-1">
              {leaves.map((leave) => (
                <LeaveCard
                  key={String(leave.id)}
                  leave={leave}
                  onAction={handleStartAction}
                  action={
                    currentAction?.leaveId === leave.id ? currentAction : null
                  }
                  onRemarkChange={handleRemarkChange}
                  onConfirm={handleConfirm}
                  onCancel={handleCancel}
                  employeeName={getEmployeeNameByUid(String(leave.employeeId))}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
