import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, Download, Package, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Role } from "../../backend";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import type { BookingRequestInfo } from "../../types";
import { BookingStatus } from "../../types";

const STATUS_BADGE: Record<BookingStatus, string> = {
  [BookingStatus.Pending]: "bg-yellow-100 text-yellow-700 border-yellow-300",
  [BookingStatus.Approved]: "bg-green-100 text-green-700 border-green-300",
  [BookingStatus.Rejected]:
    "bg-destructive/10 text-destructive border-destructive/30",
};

function RejectModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4">
      <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md shadow-lg">
        <h3 className="font-display font-semibold text-foreground text-base mb-3">
          Reject Booking Request
        </h3>
        <label
          htmlFor="booking-reject-reason-input"
          className="text-sm font-body text-muted-foreground mb-1 block"
        >
          Rejection Reason
        </label>
        <Textarea
          id="booking-reject-reason-input"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Enter reason for rejection..."
          className="mb-4 min-h-[80px]"
          data-ocid="booking-reject-reason"
        />
        <div className="flex gap-2 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onClose();
              setReason("");
            }}
            data-ocid="booking-reject-cancel"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!reason.trim()}
            onClick={() => {
              onConfirm(reason.trim());
              setReason("");
            }}
            data-ocid="booking-reject-confirm"
          >
            Reject Request
          </Button>
        </div>
      </div>
    </div>
  );
}

function exportToCsv(data: BookingRequestInfo[]) {
  const headers = [
    "ID",
    "User",
    "Role",
    "Item",
    "Qty",
    "Use",
    "Target Date",
    "Status",
    "Notes",
    "Submitted",
    "Decision Date",
  ];
  const rows = data.map((r) => [
    String(r.id),
    r.userName,
    r.userRole,
    r.itemName,
    String(r.quantity),
    r.intendedUse,
    r.targetDate,
    r.status,
    r.notes ?? "",
    new Date(Number(r.createdAt) / 1_000_000).toLocaleDateString("en-IN"),
    r.updatedAt
      ? new Date(Number(r.updatedAt) / 1_000_000).toLocaleDateString("en-IN")
      : "",
  ]);
  const csv = [headers, ...rows]
    .map((row) =>
      row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `booking-requests-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

interface BookingTableProps {
  data: BookingRequestInfo[];
  loading: boolean;
  emptyMsg: string;
  emptyOcid: string;
  showActions?: boolean;
  onApprove?: (id: bigint) => void;
  onReject?: (id: bigint) => void;
  actionLoading?: boolean;
}

function BookingTable({
  data,
  loading,
  emptyMsg,
  emptyOcid,
  showActions,
  onApprove,
  onReject,
  actionLoading,
}: BookingTableProps) {
  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground text-sm font-body">
        Loading...
      </div>
    );
  }
  if (data.length === 0) {
    return (
      <div
        className="p-10 text-center font-body flex flex-col items-center gap-3 text-muted-foreground"
        data-ocid={emptyOcid}
      >
        <Package className="w-10 h-10 opacity-30" />
        <p className="text-sm">{emptyMsg}</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto max-h-[520px] overflow-y-auto scrollbar-thin">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-card">
          <tr className="border-b border-border bg-muted/20">
            <th className="px-4 py-2 text-left font-display text-xs text-muted-foreground uppercase tracking-wider">
              Employee
            </th>
            <th className="px-4 py-2 text-left font-display text-xs text-muted-foreground uppercase tracking-wider">
              Item
            </th>
            <th className="px-4 py-2 text-center font-display text-xs text-muted-foreground uppercase tracking-wider">
              Qty
            </th>
            <th className="px-4 py-2 text-center font-display text-xs text-muted-foreground uppercase tracking-wider">
              Use
            </th>
            <th className="px-4 py-2 text-left font-display text-xs text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
              Target Date
            </th>
            <th className="px-4 py-2 text-center font-display text-xs text-muted-foreground uppercase tracking-wider">
              Status
            </th>
            <th className="px-4 py-2 text-left font-display text-xs text-muted-foreground uppercase tracking-wider hidden md:table-cell">
              Notes
            </th>
            <th className="px-4 py-2 text-left font-display text-xs text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
              Submitted
            </th>
            {showActions && (
              <th className="px-4 py-2 text-center font-display text-xs text-muted-foreground uppercase tracking-wider">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((r) => (
            <tr
              key={String(r.id)}
              className="hover:bg-muted/10"
              data-ocid="booking-approval-row"
            >
              <td className="px-4 py-3">
                <p className="font-body text-foreground text-sm font-medium max-w-[120px] truncate">
                  {r.userName}
                </p>
                <p className="text-xs text-muted-foreground font-mono">
                  {r.userRole}
                </p>
              </td>
              <td className="px-4 py-3 font-body text-foreground font-medium max-w-[140px] truncate">
                {r.itemName}
              </td>
              <td className="px-4 py-3 text-center font-mono text-foreground text-xs">
                {String(r.quantity)}
              </td>
              <td className="px-4 py-3 text-center">
                <span
                  className={`text-xs px-2 py-0.5 rounded border font-body ${
                    r.intendedUse === "Sample"
                      ? "bg-primary/10 text-primary border-primary/30"
                      : "bg-accent/10 text-accent border-accent/30"
                  }`}
                >
                  {r.intendedUse}
                </span>
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground font-mono whitespace-nowrap hidden sm:table-cell">
                {r.targetDate}
              </td>
              <td className="px-4 py-3 text-center">
                <span
                  className={`text-xs px-2 py-0.5 rounded border font-display ${STATUS_BADGE[r.status as BookingStatus]}`}
                >
                  {r.status}
                </span>
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground max-w-[160px] truncate hidden md:table-cell">
                {r.status === BookingStatus.Rejected && r.rejectionReason
                  ? `✕ ${r.rejectionReason}`
                  : (r.notes ?? "—")}
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground font-mono whitespace-nowrap hidden lg:table-cell">
                {new Date(Number(r.createdAt) / 1_000_000).toLocaleDateString(
                  "en-IN",
                )}
              </td>
              {showActions && (
                <td className="px-4 py-3">
                  <div className="flex gap-2 justify-center">
                    <Button
                      type="button"
                      size="sm"
                      className="text-xs px-3 h-7"
                      disabled={actionLoading}
                      onClick={() => onApprove?.(r.id)}
                      data-ocid="booking-approve-btn"
                    >
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Approve
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-xs px-3 h-7 text-destructive border-destructive/40 hover:bg-destructive/10"
                      disabled={actionLoading}
                      onClick={() => onReject?.(r.id)}
                      data-ocid="booking-reject-btn"
                    >
                      <XCircle className="w-3 h-3 mr-1" />
                      Reject
                    </Button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function BookingApproval() {
  const { session } = useAuthStore();
  const [allBookings, setAllBookings] = useState<BookingRequestInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectTarget, setRejectTarget] = useState<bigint | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterUser, setFilterUser] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 5000);
  };

  const loadData = useCallback(async () => {
    if (!session) return;
    try {
      const data = await api.listAllBookingRequests(session.token);
      setAllBookings(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const pending = allBookings.filter((b) => b.status === BookingStatus.Pending);
  const processed = allBookings.filter(
    (b) => b.status !== BookingStatus.Pending,
  );

  const filteredAll = allBookings.filter((b) => {
    if (filterStatus !== "all" && b.status !== filterStatus) return false;
    if (
      filterUser &&
      !b.userName.toLowerCase().includes(filterUser.toLowerCase())
    )
      return false;
    if (filterDateFrom && b.targetDate < filterDateFrom) return false;
    if (filterDateTo && b.targetDate > filterDateTo) return false;
    return true;
  });

  const handleApprove = async (id: bigint) => {
    if (!session) return;
    setActionLoading(true);
    try {
      const res = await api.approveBookingRequest(session.token, id);
      if (res.__kind__ === "ok") {
        showToast("Booking request approved", true);
        await loadData();
      } else {
        showToast(res.err, false);
      }
    } catch {
      showToast("Failed to approve request", false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id: bigint, reason: string) => {
    if (!session) return;
    setActionLoading(true);
    setRejectTarget(null);
    try {
      const res = await api.rejectBookingRequest(session.token, id, reason);
      if (res.__kind__ === "ok") {
        showToast("Booking request rejected", true);
        await loadData();
      } else {
        showToast(res.err, false);
      }
    } catch {
      showToast("Failed to reject request", false);
    } finally {
      setActionLoading(false);
    }
  };

  const isAdmin = session?.role === "Admin";
  const portalRole = isAdmin ? Role.Admin : Role.HRManager;

  return (
    <PortalLayout portalRole={portalRole}>
      <PageHeader
        title="Booking Requests"
        subtitle="Approve and manage sample & gift article requests"
      />
      <PageContent>
        {/* Toast */}
        {toast && (
          <div
            className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg border shadow-lg text-sm font-body flex items-center gap-2 ${
              toast.ok
                ? "bg-green-50 border-green-300 text-green-700"
                : "bg-destructive/10 border-destructive/30 text-destructive"
            }`}
          >
            {toast.ok ? (
              <CheckCircle className="w-4 h-4 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 shrink-0" />
            )}
            {toast.msg}
          </div>
        )}

        <RejectModal
          open={rejectTarget !== null}
          onClose={() => setRejectTarget(null)}
          onConfirm={(reason) =>
            rejectTarget !== null && handleReject(rejectTarget, reason)
          }
        />

        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="mb-4 flex-wrap h-auto">
            <TabsTrigger value="pending" data-ocid="booking-tab-pending">
              Pending Approvals
              {pending.length > 0 && (
                <span className="ml-1.5 bg-destructive text-destructive-foreground rounded-full text-[10px] px-1.5 py-0.5 font-mono">
                  {pending.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" data-ocid="booking-tab-history">
              Approved / Rejected
            </TabsTrigger>
            <TabsTrigger value="all" data-ocid="booking-tab-all">
              All Records
            </TabsTrigger>
          </TabsList>

          {/* Pending */}
          <TabsContent value="pending">
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/30">
                <span className="text-xs uppercase tracking-wider font-display text-muted-foreground">
                  Pending booking requests — awaiting HR / Admin approval
                </span>
              </div>
              <BookingTable
                data={pending}
                loading={loading}
                emptyMsg="No pending booking requests"
                emptyOcid="booking-empty-pending"
                showActions
                onApprove={handleApprove}
                onReject={(id) => setRejectTarget(id)}
                actionLoading={actionLoading}
              />
            </div>
          </TabsContent>

          {/* History */}
          <TabsContent value="history">
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/30">
                <span className="text-xs uppercase tracking-wider font-display text-muted-foreground">
                  Processed booking requests
                </span>
              </div>
              <BookingTable
                data={processed}
                loading={loading}
                emptyMsg="No processed requests yet"
                emptyOcid="booking-empty-history"
              />
            </div>
          </TabsContent>

          {/* All with filters */}
          <TabsContent value="all">
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/30 flex flex-wrap items-center gap-3">
                <span className="text-xs uppercase tracking-wider font-display text-muted-foreground shrink-0">
                  Filters:
                </span>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger
                    className="h-8 text-xs w-[130px]"
                    data-ocid="booking-filter-status"
                  >
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value={BookingStatus.Pending}>
                      Pending
                    </SelectItem>
                    <SelectItem value={BookingStatus.Approved}>
                      Approved
                    </SelectItem>
                    <SelectItem value={BookingStatus.Rejected}>
                      Rejected
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  className="h-8 text-xs w-[140px]"
                  placeholder="Employee name"
                  value={filterUser}
                  onChange={(e) => setFilterUser(e.target.value)}
                  data-ocid="booking-filter-user"
                />
                <Input
                  type="date"
                  className="h-8 text-xs w-[140px]"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  title="From date"
                  data-ocid="booking-filter-date-from"
                />
                <Input
                  type="date"
                  className="h-8 text-xs w-[140px]"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  title="To date"
                  data-ocid="booking-filter-date-to"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs ml-auto"
                  onClick={() => exportToCsv(filteredAll)}
                  data-ocid="booking-export-csv"
                >
                  <Download className="w-3 h-3 mr-1" />
                  Export CSV
                </Button>
              </div>
              <BookingTable
                data={filteredAll}
                loading={loading}
                emptyMsg="No records match the current filters"
                emptyOcid="booking-empty-all"
              />
            </div>
          </TabsContent>
        </Tabs>
      </PageContent>
    </PortalLayout>
  );
}
