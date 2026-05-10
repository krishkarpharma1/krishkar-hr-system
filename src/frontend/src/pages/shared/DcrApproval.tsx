import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Role } from "../../backend.d";
import type { DcrInfo } from "../../backend.d";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { api } from "../../lib/api";
import {
  handleResultError,
  handleSessionError,
} from "../../lib/sessionErrorHandler";
import { useAuthStore } from "../../store/authStore";
import type { UserInfo } from "../../types";
import { formatDate, formatDateTime } from "../../utils/dateFormatter";

type StatusFilter =
  | "All"
  | "Submitted"
  | "Late"
  | "Approved"
  | "Rejected"
  | "Not Submitted";

interface DcrApprovalProps {
  portalRole: Role;
}

const STATUS_FILTERS: StatusFilter[] = [
  "All",
  "Submitted",
  "Late",
  "Approved",
  "Rejected",
  "Not Submitted",
];

function statusBadgeClass(status: string, isLate?: boolean) {
  if (isLate || status === "Late")
    return "bg-orange-50 text-orange-700 border-orange-200";
  if (status === "Approved")
    return "bg-green-50 text-green-700 border-green-200";
  if (status === "Rejected") return "bg-red-50 text-red-700 border-red-200";
  if (status === "Submitted") return "bg-blue-50 text-blue-700 border-blue-200";
  return "bg-muted text-muted-foreground border-border";
}

interface ApprovalModalProps {
  dcr: DcrInfo;
  action: "approve" | "reject";
  onClose: () => void;
  onConfirm: (remark: string) => Promise<void>;
}

function ApprovalModal({
  dcr,
  action,
  onClose,
  onConfirm,
}: ApprovalModalProps) {
  const [remark, setRemark] = useState("");
  const [loading, setLoading] = useState(false);
  const isReject = action === "reject";

  async function handleConfirm() {
    if (isReject && !remark.trim()) {
      toast.error("Please enter a rejection remark.");
      return;
    }
    setLoading(true);
    try {
      await onConfirm(remark);
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <dialog
      open
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/30 backdrop-blur-sm m-0 max-w-none w-full h-full border-none bg-transparent"
      aria-labelledby="dcr-approval-title"
      data-ocid="dcr-approval.dialog"
    >
      <div className="bg-card border border-border rounded-xl shadow-lg w-full max-w-sm p-5 space-y-4">
        <h2
          id="dcr-approval-title"
          className="font-display font-semibold text-base text-foreground"
        >
          {isReject ? "Reject DCR" : "Approve DCR"}
        </h2>
        <p className="text-sm text-muted-foreground">
          DCR submitted by <strong>MR #{String(dcr.mrId)}</strong> on{" "}
          {formatDate(dcr.date)} — {dcr.workingType as string}
        </p>
        <div>
          <label
            htmlFor="dcr-approval-remark"
            className="block text-sm font-medium mb-1.5"
          >
            {isReject ? (
              <>
                Rejection Remark <span className="text-destructive">*</span>
              </>
            ) : (
              "Remark (optional)"
            )}
          </label>
          <textarea
            id="dcr-approval-remark"
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder={
              isReject
                ? "State the reason for rejection…"
                : "Any note for the MR…"
            }
            rows={3}
            data-ocid="dcr-approval.remark-input"
            className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={loading}
            data-ocid="dcr-approval.cancel_button"
          >
            Cancel
          </Button>
          <Button
            variant={isReject ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={loading || (isReject && !remark.trim())}
            data-ocid={
              isReject
                ? "dcr-approval.reject-confirm-btn"
                : "dcr-approval.approve-confirm-btn"
            }
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
            {isReject ? "Confirm Reject" : "Confirm Approve"}
          </Button>
        </div>
      </div>
    </dialog>
  );
}

function exportToCsv(dcrs: DcrInfo[]) {
  const header = [
    "Date",
    "MR Name",
    "Working Type",
    "Doctors",
    "Chemists",
    "Stockists",
    "Station",
    "Area",
    "Status",
    "Late",
    "Submitted At",
    "Manager Remark",
  ].join(",");
  const rows = dcrs.map((d) =>
    [
      formatDate(d.date),
      `"MR #${String(d.mrId)}"`,
      d.workingType as string,
      Number(d.totalDoctorsVisited),
      Number(d.totalChemistsVisited),
      Number(d.totalStockistsVisited),
      `"${d.stationCovered ?? ""}"`,
      `"${d.areaCovered ?? ""}"`,
      d.status as string,
      d.isLate ? "Yes" : "No",
      d.submittedAt ? formatDateTime(d.submittedAt) : "",
      `"${d.approverRemark ?? ""}"`,
    ].join(","),
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `DCR_Approvals_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DcrApproval({ portalRole }: DcrApprovalProps) {
  const session = useAuthStore((s) => s.session);
  const token = session?.token ?? "";
  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const today = now.toISOString().slice(0, 10);

  const [dcrs, setDcrs] = useState<DcrInfo[]>([]);
  const [mrs, setMrs] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedMrId, setSelectedMrId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [fromDate, setFromDate] = useState(firstOfMonth);
  const [toDate, setToDate] = useState(today);
  const [actionModal, setActionModal] = useState<{
    dcr: DcrInfo;
    action: "approve" | "reject";
  } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setLoadError(false);
    try {
      const [mrList] = await Promise.all([
        api.listReportees(token, session!.userId),
      ]);
      setMrs(mrList);

      const rawApi = api as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof rawApi.listTeamDcrs !== "function") {
        setDcrs([]);
        return;
      }
      const mrIds = selectedMrId
        ? [Number(selectedMrId)]
        : mrList.map((m) => Number(m.id));
      const data = (await rawApi.listTeamDcrs(
        token,
        mrIds,
        fromDate,
        toDate,
      )) as DcrInfo[];
      setDcrs(data.sort((a, b) => b.date.localeCompare(a.date)));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      handleSessionError(msg, () => {
        setLoadError(true);
        toast.error("Failed to load DCR data. Please try again.");
      });
    } finally {
      setLoading(false);
    }
  }, [token, session, selectedMrId, fromDate, toDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleApprove(dcr: DcrInfo, remark: string) {
    const rawApi = api as unknown as Record<
      string,
      (...args: unknown[]) => Promise<unknown>
    >;
    if (typeof rawApi.approveDcr !== "function") {
      toast.error("DCR approval is not available yet.");
      return;
    }
    try {
      const res = (await rawApi.approveDcr(token, {
        dcrId: dcr.id,
        status: "Approved",
        remark,
      })) as { __kind__: string; err?: string };
      if (res.__kind__ === "err") {
        handleResultError(
          res.err ?? "Error",
          toast.error,
          "Failed to approve DCR",
        );
        return;
      }
      toast.success(`DCR for MR #${String(dcr.mrId)} approved`);
      setDcrs((prev) =>
        prev.map((d) =>
          d.id === dcr.id
            ? {
                ...d,
                status: "Approved" as DcrInfo["status"],
                approverRemark: remark,
              }
            : d,
        ),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      handleSessionError(msg, () =>
        toast.error("Failed to approve. Try again."),
      );
    }
  }

  async function handleReject(dcr: DcrInfo, remark: string) {
    const rawApi = api as unknown as Record<
      string,
      (...args: unknown[]) => Promise<unknown>
    >;
    if (typeof rawApi.approveDcr !== "function") {
      toast.error("DCR approval is not available yet.");
      return;
    }
    try {
      const res = (await rawApi.approveDcr(token, {
        dcrId: dcr.id,
        status: "Rejected",
        remark,
      })) as { __kind__: string; err?: string };
      if (res.__kind__ === "err") {
        handleResultError(
          res.err ?? "Error",
          toast.error,
          "Failed to reject DCR",
        );
        return;
      }
      toast.success(`DCR for MR #${String(dcr.mrId)} rejected`);
      setDcrs((prev) =>
        prev.map((d) =>
          d.id === dcr.id
            ? {
                ...d,
                status: "Rejected" as DcrInfo["status"],
                approverRemark: remark,
              }
            : d,
        ),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      handleSessionError(msg, () =>
        toast.error("Failed to reject. Try again."),
      );
    }
  }

  const filtered = dcrs.filter((d) => {
    if (statusFilter === "All") return true;
    if (statusFilter === "Late") return d.isLate;
    return (d.status as string) === statusFilter;
  });

  const pendingCount = dcrs.filter(
    (d) => (d.status as string) === "Submitted",
  ).length;
  const approvedTodayCount = dcrs.filter(
    (d) => (d.status as string) === "Approved" && d.date === today,
  ).length;
  const lateCount = dcrs.filter((d) => d.isLate).length;

  return (
    <PortalLayout portalRole={portalRole}>
      <PageHeader
        title="DCR Approvals"
        subtitle="Review and approve Daily Call Reports from your team"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportToCsv(filtered)}
            data-ocid="dcr-approvals.export-btn"
            className="gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>
        }
      />
      <PageContent>
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            {
              label: "Pending",
              value: pendingCount,
              color: "text-amber-600",
              bg: "bg-amber-50 border-amber-200",
            },
            {
              label: "Approved Today",
              value: approvedTodayCount,
              color: "text-green-600",
              bg: "bg-green-50 border-green-200",
            },
            {
              label: "Late Submissions",
              value: lateCount,
              color: "text-orange-600",
              bg: "bg-orange-50 border-orange-200",
            },
          ].map((s) => (
            <div
              key={s.label}
              className={`rounded-xl border px-4 py-3 text-center ${s.bg}`}
            >
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-card border border-border rounded-xl p-4 mb-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* MR filter */}
            <select
              value={selectedMrId}
              onChange={(e) => setSelectedMrId(e.target.value)}
              data-ocid="dcr-approvals.mr-filter"
              className="bg-background border border-input rounded-md px-3 py-1.5 text-sm h-9 focus:outline-none focus:ring-2 focus:ring-ring min-w-[160px]"
            >
              <option value="">All MRs</option>
              {mrs.map((m) => (
                <option key={String(m.id)} value={String(m.id)}>
                  {m.name}
                </option>
              ))}
            </select>
            {/* Date range */}
            <input
              type="date"
              value={fromDate}
              max={toDate}
              onChange={(e) => setFromDate(e.target.value)}
              data-ocid="dcr-approvals.from-date"
              className="bg-background border border-input rounded-md px-3 py-1.5 text-sm h-9 focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <input
              type="date"
              value={toDate}
              min={fromDate}
              onChange={(e) => setToDate(e.target.value)}
              data-ocid="dcr-approvals.to-date"
              className="bg-background border border-input rounded-md px-3 py-1.5 text-sm h-9 focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loading}
              data-ocid="dcr-approvals.refresh-btn"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
          {/* Status filter pills */}
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                data-ocid={`dcr-approvals.status-filter-${s.toLowerCase().replace(/\s+/g, "-")}`}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  statusFilter === s
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border text-foreground hover:bg-muted/40"
                }`}
              >
                {s}
                {s === "Submitted" && pendingCount > 0 && (
                  <span className="ml-1 bg-amber-500 text-white text-[10px] rounded-full px-1">
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {loadError && (
          <div
            className="flex items-center gap-3 bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 mb-4"
            data-ocid="dcr-approvals.error_state"
          >
            <p className="text-sm text-destructive flex-1">
              Failed to load DCR data.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={loadData}
              className="border-destructive/40 text-destructive"
              data-ocid="dcr-approvals.retry-btn"
            >
              Retry
            </Button>
          </div>
        )}

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading DCR records…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2"
              data-ocid="dcr-approvals.empty_state"
            >
              <CheckCircle className="w-8 h-8 opacity-30" />
              <p className="text-sm">
                No DCR records match the selected filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground text-left whitespace-nowrap">
                      MR Name
                    </th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground text-left whitespace-nowrap">
                      Date
                    </th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground text-left">
                      Working Type
                    </th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground text-center">
                      Drs
                    </th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground text-center">
                      Chems
                    </th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground text-left">
                      Status
                    </th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground text-left whitespace-nowrap">
                      Submitted At
                    </th>
                    <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((dcr, idx) => {
                    const isPending = (dcr.status as string) === "Submitted";
                    const key = String(dcr.id);
                    const isExpanded = expandedId === key;
                    // Look up MR name from list
                    const mr = mrs.find((m) => m.id === dcr.mrId);
                    const mrLabel = mr?.name ?? `MR #${String(dcr.mrId)}`;
                    return (
                      <>
                        <tr
                          key={key}
                          data-ocid={`dcr-approvals.item.${idx + 1}`}
                          className={`border-b border-border transition-colors ${
                            isPending
                              ? "bg-amber-50/40 hover:bg-amber-50/70"
                              : "hover:bg-muted/20"
                          } cursor-pointer`}
                          onClick={() => setExpandedId(isExpanded ? null : key)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ")
                              setExpandedId(isExpanded ? null : key);
                          }}
                          tabIndex={0}
                        >
                          <td className="px-3 py-2.5 font-medium text-sm text-foreground whitespace-nowrap">
                            {mrLabel}
                          </td>
                          <td className="px-3 py-2.5 text-xs font-mono whitespace-nowrap">
                            {formatDate(dcr.date)}
                          </td>
                          <td className="px-3 py-2.5 text-xs">
                            {dcr.workingType as string}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-center font-mono">
                            {Number(dcr.totalDoctorsVisited)}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-center font-mono">
                            {Number(dcr.totalChemistsVisited)}
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${statusBadgeClass(dcr.status as string, dcr.isLate)}`}
                            >
                              {dcr.isLate &&
                              (dcr.status as string) === "Submitted"
                                ? "Late"
                                : (dcr.status as string)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                            {dcr.submittedAt
                              ? formatDateTime(dcr.submittedAt)
                              : "—"}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <div
                              className="flex items-center justify-end gap-1.5"
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => e.stopPropagation()}
                            >
                              {isPending && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-green-700 border-green-300 hover:bg-green-50"
                                    onClick={() =>
                                      setActionModal({ dcr, action: "approve" })
                                    }
                                    data-ocid={`dcr-approvals.approve-btn.${idx + 1}`}
                                  >
                                    <CheckCircle className="w-3.5 h-3.5 mr-1" />
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                                    onClick={() =>
                                      setActionModal({ dcr, action: "reject" })
                                    }
                                    data-ocid={`dcr-approvals.reject-btn.${idx + 1}`}
                                  >
                                    <XCircle className="w-3.5 h-3.5 mr-1" />
                                    Reject
                                  </Button>
                                </>
                              )}
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                              )}
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr
                            key={`${key}-details`}
                            className="bg-muted/10 border-b border-border"
                          >
                            <td colSpan={8} className="px-4 py-3">
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                {dcr.stationCovered && (
                                  <div>
                                    <span className="text-muted-foreground">
                                      Station:{" "}
                                    </span>
                                    <span className="font-medium">
                                      {dcr.stationCovered}
                                    </span>
                                  </div>
                                )}
                                {dcr.areaCovered && (
                                  <div>
                                    <span className="text-muted-foreground">
                                      Area:{" "}
                                    </span>
                                    <span className="font-medium">
                                      {dcr.areaCovered}
                                    </span>
                                  </div>
                                )}
                                <div>
                                  <span className="text-muted-foreground">
                                    Stockists:{" "}
                                  </span>
                                  <span className="font-medium">
                                    {Number(dcr.totalStockistsVisited)}
                                  </span>
                                </div>
                                {dcr.remarks && (
                                  <div className="sm:col-span-3">
                                    <span className="text-muted-foreground">
                                      Remarks:{" "}
                                    </span>
                                    <span>{dcr.remarks}</span>
                                  </div>
                                )}
                                {dcr.approverRemark && (
                                  <div className="sm:col-span-3 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                                    <span className="text-amber-700 font-medium">
                                      Manager note:{" "}
                                    </span>
                                    <span className="text-amber-800">
                                      {dcr.approverRemark}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer summary */}
        {!loading && filtered.length > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            Showing{" "}
            <span className="font-semibold text-foreground">
              {filtered.length}
            </span>{" "}
            records
          </p>
        )}
      </PageContent>

      {/* Approval modal */}
      {actionModal && (
        <ApprovalModal
          dcr={actionModal.dcr}
          action={actionModal.action}
          onClose={() => setActionModal(null)}
          onConfirm={async (remark) => {
            if (actionModal.action === "approve") {
              await handleApprove(actionModal.dcr, remark);
            } else {
              await handleReject(actionModal.dcr, remark);
            }
          }}
        />
      )}
    </PortalLayout>
  );
}
