import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Role } from "../../backend.d";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { api } from "../../lib/api";
import { handleSessionError } from "../../lib/sessionErrorHandler";
import { useAuthStore } from "../../store/authStore";
import type { TravelPlanInfo, UserInfo } from "../../types";
import { formatDate, formatDateTime } from "../../utils/dateFormatter";

interface MtpApprovalProps {
  portalRole: Role;
}

interface RejectModalProps {
  plan: GroupedMtp;
  onClose: () => void;
  onConfirm: (comment: string) => Promise<void>;
}

interface GroupedMtp {
  userId: bigint;
  mrName: string;
  month: string;
  plans: TravelPlanInfo[];
  status: string;
  submittedAt?: string | null;
}

function groupPlansByMrAndMonth(
  plans: TravelPlanInfo[],
  userMap: Map<bigint, UserInfo>,
): GroupedMtp[] {
  const map = new Map<string, GroupedMtp>();
  for (const p of plans) {
    const month = p.date.slice(0, 7);
    const key = `${String(p.userId)}_${month}`;
    if (!map.has(key)) {
      const user = userMap.get(p.userId);
      map.set(key, {
        userId: p.userId,
        mrName: user?.name ?? `Employee #${p.userId}`,
        month,
        plans: [],
        status: p.status,
        submittedAt: null,
      });
    }
    map.get(key)!.plans.push(p);
    if (
      (p.status as string) === "Submitted" ||
      (p.status as string) === "Approved"
    ) {
      const g = map.get(key)!;
      g.status = p.status as string;
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    b.month.localeCompare(a.month),
  );
}

function statusClass(status: string) {
  if (status === "Approved")
    return "bg-green-50 text-green-700 border-green-200";
  if (status === "Rejected") return "bg-red-50 text-red-700 border-red-200";
  if (status === "Submitted") return "bg-blue-50 text-blue-700 border-blue-200";
  return "bg-muted text-muted-foreground border-border";
}

function dayOfWeek(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("en-IN", { weekday: "short" });
}

/** Extract Area/Beat Plan from encoded MTP notes field */
function decodeMtpArea(notes: string | undefined | null): string {
  if (!notes) return "";
  const idx = notes.indexOf("|area=");
  if (idx === -1) return "";
  const start = idx + 6;
  const end = notes.indexOf("|", start);
  return end === -1 ? notes.slice(start) : notes.slice(start, end);
}

/** Extract activity notes from encoded MTP notes field, falling back to raw */
function decodeMtpActivityNotes(notes: string | undefined | null): string {
  if (!notes) return "";
  const marker = "|notes=";
  const idx = notes.indexOf(marker);
  if (idx === -1) return notes;
  const raw = notes.slice(idx + marker.length);
  // strip trailing ] if present
  return raw.endsWith("]") ? raw.slice(0, -1) : raw;
}

function RejectModal({ plan, onClose, onConfirm }: RejectModalProps) {
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    if (!comment.trim()) {
      toast.error("Please enter a rejection comment.");
      return;
    }
    setLoading(true);
    try {
      await onConfirm(comment);
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <dialog
      open
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/30 backdrop-blur-sm m-0 max-w-none w-full h-full border-none bg-transparent"
      aria-labelledby="mtp-reject-title"
      data-ocid="mtp-approval.dialog"
    >
      <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-sm p-5 space-y-4">
        <h2
          id="mtp-reject-title"
          className="font-display font-semibold text-base text-foreground"
        >
          Reject MTP
        </h2>
        <p className="text-sm text-muted-foreground">
          Rejecting <strong>{plan.mrName}</strong>&apos;s MTP for{" "}
          <strong>{plan.month}</strong>. The MR will be notified to revise and
          resubmit.
        </p>
        <div>
          <label
            htmlFor="mtp-reject-comment"
            className="block text-sm font-medium mb-1.5"
          >
            Rejection Comment <span className="text-destructive">*</span>
          </label>
          <textarea
            id="mtp-reject-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="State the reason for rejection so the MR can correct it\u2026"
            rows={3}
            data-ocid="mtp-approval.reject-comment-input"
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={loading}
            data-ocid="mtp-approval.cancel_button"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={loading || !comment.trim()}
            data-ocid="mtp-approval.confirm-reject-btn"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
            Confirm Reject
          </Button>
        </div>
      </div>
    </dialog>
  );
}

export default function MtpApproval({ portalRole }: MtpApprovalProps) {
  const session = useAuthStore((s) => s.session);
  const token = session?.token ?? "";

  const now = new Date();
  const currentMonthValue = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [monthFilter, setMonthFilter] = useState(currentMonthValue);
  const [plans, setPlans] = useState<TravelPlanInfo[]>([]);
  const [userMap, setUserMap] = useState<Map<bigint, UserInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<GroupedMtp | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setLoadError(false);
    try {
      const [allPlans, users] = await Promise.all([
        api.listAllTravelPlans(token, null, monthFilter),
        api.listAllUsers(token),
      ]);
      setPlans(allPlans);
      setUserMap(new Map(users.map((u) => [u.id, u])));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      handleSessionError(msg, () => {
        setLoadError(true);
        toast.error("Failed to load MTP data.");
      });
    } finally {
      setLoading(false);
    }
  }, [token, monthFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleApprove(group: GroupedMtp) {
    const key = `${String(group.userId)}_${group.month}`;
    setActionLoading(key);
    try {
      const submitted = group.plans.filter(
        (p) =>
          (p.status as string) === "Submitted" ||
          (p.status as string) === "Draft",
      );
      await Promise.all(
        submitted.map((p) => api.submitTravelPlan(token, p.id)),
      );
      toast.success(`MTP approved for ${group.mrName}`);
      setPlans((prev) =>
        prev.map((p) =>
          p.userId === group.userId && p.date.startsWith(group.month)
            ? { ...p, status: "Submitted" as TravelPlanInfo["status"] }
            : p,
        ),
      );
      await loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      handleSessionError(msg, () => toast.error("Failed to approve MTP."));
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(group: GroupedMtp, comment: string) {
    try {
      const submitted = group.plans.filter(
        (p) => (p.status as string) === "Submitted",
      );
      await Promise.all(
        submitted.map((p) =>
          api.updateTravelPlan(token, p.id, {
            date: p.date,
            plannedStation: p.plannedStation,
            notes: `REJECTED: ${comment}`,
            gpsLocation: null,
          } as Parameters<typeof api.updateTravelPlan>[2]),
        ),
      );
      toast.success(`MTP rejected for ${group.mrName}`);
      await loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      handleSessionError(msg, () => toast.error("Failed to reject MTP."));
    }
  }

  const grouped = groupPlansByMrAndMonth(plans, userMap);
  const pendingCount = grouped.filter((g) => g.status === "Submitted").length;

  return (
    <PortalLayout portalRole={portalRole}>
      <PageHeader
        title="MTP Approvals"
        subtitle="Review and approve Monthly Tour Programs submitted by your team"
      />
      <PageContent>
        {pendingCount > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 mb-4 text-sm text-amber-800">
            <span className="font-semibold">{pendingCount}</span> MTP
            {pendingCount !== 1 ? "s" : ""} pending approval
          </div>
        )}

        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <label
            htmlFor="mtp-month-filter"
            className="text-sm text-muted-foreground whitespace-nowrap"
          >
            Month:
          </label>
          <input
            id="mtp-month-filter"
            type="month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            data-ocid="mtp-approvals.month-filter"
            className="bg-background border border-input rounded-md px-3 py-1.5 text-sm h-9 focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            data-ocid="mtp-approvals.refresh-btn"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
          </Button>
        </div>

        {loadError && (
          <div
            className="flex items-center gap-3 bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 mb-4"
            data-ocid="mtp-approvals.error_state"
          >
            <p className="text-sm text-destructive flex-1">
              Failed to load MTP data.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={loadData}
              className="border-destructive/40 text-destructive"
              data-ocid="mtp-approvals.retry-btn"
            >
              Retry
            </Button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading MTPs\u2026</span>
          </div>
        ) : grouped.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2 bg-card border border-border rounded-xl"
            data-ocid="mtp-approvals.empty_state"
          >
            <CheckCircle className="w-8 h-8 opacity-30" />
            <p className="text-sm">
              No MTP submissions for{" "}
              {new Date(`${monthFilter}-01`).toLocaleDateString("en-IN", {
                month: "long",
                year: "numeric",
              })}
              .
            </p>
          </div>
        ) : (
          <div className="space-y-3" data-ocid="mtp-approvals.list">
            {grouped.map((group, idx) => {
              const key = `${String(group.userId)}_${group.month}`;
              const isExpanded = expandedKey === key;
              const isPending = group.status === "Submitted";
              const isApproved = group.status === "Approved";

              return (
                <div
                  key={key}
                  data-ocid={`mtp-approvals.item.${idx + 1}`}
                  className={`bg-card border rounded-xl overflow-hidden transition-colors ${
                    isPending ? "border-amber-200" : "border-border"
                  }`}
                >
                  <div
                    className={`flex items-center gap-3 px-4 py-3 transition-colors ${isPending ? "bg-amber-50/50" : ""}`}
                  >
                    <button
                      type="button"
                      className="flex-1 min-w-0 text-left cursor-pointer hover:opacity-80 focus:outline-none"
                      onClick={() => setExpandedKey(isExpanded ? null : key)}
                      aria-expanded={isExpanded}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">
                          {group.mrName}
                        </span>
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${statusClass(group.status)}`}
                        >
                          {group.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                        <span>
                          {new Date(`${group.month}-01`).toLocaleDateString(
                            "en-IN",
                            { month: "long", year: "numeric" },
                          )}
                        </span>
                        <span>{group.plans.length} days planned</span>
                      </div>
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      {isPending && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs text-green-700 border-green-300 hover:bg-green-50 gap-1"
                            onClick={() => handleApprove(group)}
                            disabled={actionLoading === key}
                            data-ocid={`mtp-approvals.approve-btn.${idx + 1}`}
                          >
                            {actionLoading === key ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle className="w-3.5 h-3.5" />
                            )}
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 gap-1"
                            onClick={() => setRejectModal(group)}
                            disabled={actionLoading === key}
                            data-ocid={`mtp-approvals.reject-btn.${idx + 1}`}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Reject
                          </Button>
                        </>
                      )}
                      {isApproved && (
                        <span className="text-xs text-green-700 font-medium flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Approved
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="shrink-0 focus:outline-none"
                      onClick={() => setExpandedKey(isExpanded ? null : key)}
                      aria-label={isExpanded ? "Collapse" : "Expand"}
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-border">
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-xs">
                          <thead>
                            <tr className="bg-muted/30">
                              <th className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">
                                Date
                              </th>
                              <th className="px-3 py-2 text-left font-semibold text-muted-foreground">
                                Day
                              </th>
                              <th className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">
                                Planned Station
                              </th>
                              <th className="px-3 py-2 text-left font-semibold text-muted-foreground">
                                Area / Beat Plan
                              </th>
                              <th className="px-3 py-2 text-left font-semibold text-muted-foreground">
                                Notes
                              </th>
                              <th className="px-3 py-2 text-left font-semibold text-muted-foreground">
                                Status
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.plans
                              .sort((a, b) => a.date.localeCompare(b.date))
                              .map((p) => (
                                <tr
                                  key={String(p.id)}
                                  className="border-b border-border/50 hover:bg-muted/10"
                                >
                                  {/* td 1: Date (DD-MM-YYYY) */}
                                  <td className="px-3 py-2 font-medium whitespace-nowrap">
                                    {formatDate(p.date)}
                                  </td>
                                  {/* td 2: Day of week */}
                                  <td className="px-3 py-2 text-muted-foreground">
                                    {dayOfWeek(p.date)}
                                  </td>
                                  {/* td 3: Planned Station */}
                                  <td className="px-3 py-2 max-w-[120px] truncate">
                                    {p.plannedStation || "\u2014"}
                                  </td>
                                  {/* td 5: Area / Beat Plan (decoded from notes) */}
                                  <td className="px-3 py-2 text-muted-foreground max-w-[160px] truncate">
                                    {decodeMtpArea(p.notes) || "\u2014"}
                                  </td>
                                  {/* td 6: Activity notes (decoded) */}
                                  <td className="px-3 py-2 text-muted-foreground max-w-[200px]">
                                    <span className="line-clamp-1">
                                      {p.notes?.startsWith("REJECTED:") ? (
                                        <span className="text-red-600">
                                          {p.notes}
                                        </span>
                                      ) : (
                                        decodeMtpActivityNotes(p.notes) ||
                                        "\u2014"
                                      )}
                                    </span>
                                  </td>
                                  {/* td 7: Status badge */}
                                  <td className="px-3 py-2">
                                    <Badge
                                      variant="outline"
                                      className="text-[10px]"
                                    >
                                      {p.status}
                                    </Badge>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </PageContent>

      {rejectModal && (
        <RejectModal
          plan={rejectModal}
          onClose={() => setRejectModal(null)}
          onConfirm={async (comment) => {
            await handleReject(rejectModal, comment);
          }}
        />
      )}
    </PortalLayout>
  );
}
