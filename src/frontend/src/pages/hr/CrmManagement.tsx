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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Download,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Role } from "../../backend";
import { CrmStatus } from "../../backend.d";
import type { BusinessReportInfo, CrmRequestInfo } from "../../backend.d";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { useCompanyProfile } from "../../hooks/useCompanyProfile";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";

type CrmRequestId = bigint;

const STATUS_BADGE: Record<CrmStatus, string> = {
  [CrmStatus.Pending]: "bg-yellow-100 text-yellow-700 border-yellow-300",
  [CrmStatus.Approved]: "bg-green-100 text-green-700 border-green-300",
  [CrmStatus.Rejected]:
    "bg-destructive/10 text-destructive border-destructive/30",
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const YEARS = Array.from({ length: 5 }, (_, i) =>
  String(new Date().getFullYear() - i),
);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20">
      <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md shadow-lg mx-4">
        <h3 className="font-display font-semibold text-foreground text-base mb-3">
          Reject CRM Request
        </h3>
        <Label className="text-sm font-body text-muted-foreground mb-1 block">
          Rejection Reason
        </Label>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Enter reason for rejection..."
          className="mb-4 min-h-[80px]"
          data-ocid="crm-reject-reason"
        />
        <div className="flex gap-2 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            data-ocid="crm-reject-cancel"
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
            data-ocid="crm-reject-confirm"
          >
            Reject Request
          </Button>
        </div>
      </div>
    </div>
  );
}

function CommitmentsRow({
  commitments,
}: { commitments: CrmRequestInfo["productCommitments"] }) {
  const [open, setOpen] = useState(false);
  if (commitments.length === 0)
    return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-primary underline flex items-center gap-1 hover:text-primary/80"
        data-ocid="crm-commitments-toggle"
      >
        {commitments.length} product{commitments.length !== 1 ? "s" : ""}
        {open ? (
          <ChevronUp className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )}
      </button>
      {open && (
        <ul className="mt-1 space-y-0.5 pl-2 border-l border-border">
          {commitments.map((c) => (
            <li key={String(c.productId)} className="text-xs text-foreground">
              {c.productName} —{" "}
              <span className="text-muted-foreground">
                Qty: {String(c.expectedQuantity)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function exportToCsv(data: CrmRequestInfo[], companyName?: string) {
  const brandingRows = companyName ? [[companyName], [""], [""]] : [];
  const headers = [
    "ID",
    "Employee ID",
    "Doctor",
    "Amount",
    "Status",
    "Products",
    "Submitted",
    "Decision Date",
  ];
  const rows = data.map((r) => [
    String(r.id),
    String(r.userId),
    r.doctorName,
    r.crmAmount.toFixed(2),
    r.status,
    r.productCommitments.length,
    new Date(Number(r.createdAt) / 1_000_000).toLocaleDateString("en-IN"),
    r.approvedAt
      ? new Date(Number(r.approvedAt) / 1_000_000).toLocaleDateString("en-IN")
      : "",
  ]);
  const allRows = [...brandingRows, headers, ...rows];
  const csv = allRows.map((row) => row.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `crm-requests-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CrmManagement() {
  const { session } = useAuthStore();
  const { companyProfile } = useCompanyProfile();
  const [allCrm, setAllCrm] = useState<CrmRequestInfo[]>([]);
  const [businessReports, setBusinessReports] = useState<BusinessReportInfo[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [rejectTarget, setRejectTarget] = useState<CrmRequestId | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterEmployee, setFilterEmployee] = useState("");
  const [filterDoctor, setFilterDoctor] = useState("");
  const [reportMonth, setReportMonth] = useState(
    String(new Date().getMonth() + 1),
  );
  const [reportYear, setReportYear] = useState(
    String(new Date().getFullYear()),
  );

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = useCallback(async () => {
    if (!session) return;
    try {
      const [crm, reports] = await Promise.all([
        api.listAllCrmRequests(session.token, null),
        api.listAllBusinessReports(
          session.token,
          null,
          BigInt(reportMonth),
          BigInt(reportYear),
        ),
      ]);
      setAllCrm(crm);
      setBusinessReports(reports);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [session, reportMonth, reportYear]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const pending = allCrm.filter((r) => r.status === CrmStatus.Pending);
  const processed = allCrm.filter((r) => r.status !== CrmStatus.Pending);

  const filteredAll = allCrm.filter((r) => {
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (filterEmployee && !String(r.userId).includes(filterEmployee))
      return false;
    if (
      filterDoctor &&
      !r.doctorName.toLowerCase().includes(filterDoctor.toLowerCase())
    )
      return false;
    return true;
  });

  const handleApprove = async (id: bigint) => {
    if (!session) return;
    setActionLoading(true);
    try {
      const res = await api.approveCrmRequest(session.token, id);
      if (res.__kind__ === "ok") {
        showToast("CRM request approved successfully", true);
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
      const res = await api.rejectCrmRequest(session.token, id, reason);
      if (res.__kind__ === "ok") {
        showToast("CRM request rejected", true);
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

  return (
    <PortalLayout portalRole={Role.HRManager}>
      <PageHeader
        title="CRM Management"
        subtitle="Approve, review and track CRM money requests"
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
              <CheckCircle className="w-4 h-4" />
            ) : (
              <XCircle className="w-4 h-4" />
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
            <TabsTrigger value="pending" data-ocid="crm-tab-pending">
              Pending Approvals
              {pending.length > 0 && (
                <span className="ml-1.5 bg-destructive text-destructive-foreground rounded-full text-[10px] px-1.5 py-0.5 font-mono">
                  {pending.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" data-ocid="crm-tab-history">
              Approved / Rejected
            </TabsTrigger>
            <TabsTrigger value="all" data-ocid="crm-tab-all">
              All Records
            </TabsTrigger>
            <TabsTrigger value="business" data-ocid="crm-tab-business">
              Business Reports
            </TabsTrigger>
          </TabsList>

          {/* Pending Approvals */}
          <TabsContent value="pending">
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/30">
                <span className="text-xs uppercase tracking-wider font-display text-muted-foreground">
                  Pending CRM Requests — require HR approval before managers can
                  view
                </span>
              </div>
              {loading ? (
                <div className="p-8 text-center text-muted-foreground text-sm font-body">
                  Loading...
                </div>
              ) : pending.length === 0 ? (
                <div
                  className="p-8 text-center text-muted-foreground text-sm font-body"
                  data-ocid="crm-empty-pending"
                >
                  No pending CRM requests
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto scrollbar-thin">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card">
                      <tr className="border-b border-border bg-muted/20">
                        <th className="px-4 py-2 text-left font-display text-xs text-muted-foreground uppercase tracking-wider">
                          Employee ID
                        </th>
                        <th className="px-4 py-2 text-left font-display text-xs text-muted-foreground uppercase tracking-wider">
                          Doctor
                        </th>
                        <th className="px-4 py-2 text-right font-display text-xs text-muted-foreground uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-4 py-2 text-left font-display text-xs text-muted-foreground uppercase tracking-wider">
                          Products
                        </th>
                        <th className="px-4 py-2 text-left font-display text-xs text-muted-foreground uppercase tracking-wider">
                          Notes
                        </th>
                        <th className="px-4 py-2 text-left font-display text-xs text-muted-foreground uppercase tracking-wider">
                          Submitted
                        </th>
                        <th className="px-4 py-2 text-center font-display text-xs text-muted-foreground uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {pending.map((r) => (
                        <tr
                          key={String(r.id)}
                          className="hover:bg-muted/10"
                          data-ocid="crm-pending-row"
                        >
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                            EMP-{String(r.userId)}
                          </td>
                          <td className="px-4 py-3 font-body text-foreground font-medium max-w-[140px] truncate">
                            {r.doctorName}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-foreground font-semibold">
                            ₹{r.crmAmount.toFixed(2)}
                          </td>
                          <td className="px-4 py-3">
                            <CommitmentsRow
                              commitments={r.productCommitments}
                            />
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground max-w-[160px] truncate">
                            {r.requestNotes ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground font-mono whitespace-nowrap">
                            {new Date(
                              Number(r.createdAt) / 1_000_000,
                            ).toLocaleDateString("en-IN")}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2 justify-center">
                              <Button
                                type="button"
                                size="sm"
                                className="text-xs px-3 h-7"
                                disabled={actionLoading}
                                onClick={() => handleApprove(r.id)}
                                data-ocid="crm-approve-btn"
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
                                onClick={() => setRejectTarget(r.id)}
                                data-ocid="crm-reject-btn"
                              >
                                <XCircle className="w-3 h-3 mr-1" />
                                Reject
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Approved / Rejected History */}
          <TabsContent value="history">
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/30">
                <span className="text-xs uppercase tracking-wider font-display text-muted-foreground">
                  Processed CRM Requests
                </span>
              </div>
              {loading ? (
                <div className="p-8 text-center text-muted-foreground text-sm font-body">
                  Loading...
                </div>
              ) : processed.length === 0 ? (
                <div
                  className="p-8 text-center text-muted-foreground text-sm font-body"
                  data-ocid="crm-empty-history"
                >
                  No processed requests yet
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto scrollbar-thin">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card">
                      <tr className="border-b border-border bg-muted/20">
                        <th className="px-4 py-2 text-left font-display text-xs text-muted-foreground uppercase tracking-wider">
                          Employee ID
                        </th>
                        <th className="px-4 py-2 text-left font-display text-xs text-muted-foreground uppercase tracking-wider">
                          Doctor
                        </th>
                        <th className="px-4 py-2 text-right font-display text-xs text-muted-foreground uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-4 py-2 text-center font-display text-xs text-muted-foreground uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-2 text-left font-display text-xs text-muted-foreground uppercase tracking-wider">
                          Decision
                        </th>
                        <th className="px-4 py-2 text-left font-display text-xs text-muted-foreground uppercase tracking-wider">
                          Decision Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {processed.map((r) => (
                        <tr
                          key={String(r.id)}
                          className="hover:bg-muted/10"
                          data-ocid="crm-history-row"
                        >
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                            EMP-{String(r.userId)}
                          </td>
                          <td className="px-4 py-3 font-body text-foreground font-medium max-w-[140px] truncate">
                            {r.doctorName}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-foreground">
                            ₹{r.crmAmount.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`text-xs px-2 py-0.5 rounded border font-display ${STATUS_BADGE[r.status]}`}
                            >
                              {r.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground max-w-[160px] truncate">
                            {r.status === CrmStatus.Rejected
                              ? (r.rejectionReason ?? "—")
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground font-mono whitespace-nowrap">
                            {r.approvedAt
                              ? new Date(
                                  Number(r.approvedAt) / 1_000_000,
                                ).toLocaleDateString("en-IN")
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>

          {/* All Records with filters */}
          <TabsContent value="all">
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/30 flex flex-wrap items-center gap-3">
                <span className="text-xs uppercase tracking-wider font-display text-muted-foreground shrink-0">
                  Filters:
                </span>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger
                    className="h-8 text-xs w-[130px]"
                    data-ocid="crm-filter-status"
                  >
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value={CrmStatus.Pending}>Pending</SelectItem>
                    <SelectItem value={CrmStatus.Approved}>Approved</SelectItem>
                    <SelectItem value={CrmStatus.Rejected}>Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  className="h-8 text-xs w-[140px]"
                  placeholder="Employee ID"
                  value={filterEmployee}
                  onChange={(e) => setFilterEmployee(e.target.value)}
                  data-ocid="crm-filter-employee"
                />
                <Input
                  className="h-8 text-xs w-[140px]"
                  placeholder="Doctor name"
                  value={filterDoctor}
                  onChange={(e) => setFilterDoctor(e.target.value)}
                  data-ocid="crm-filter-doctor"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs ml-auto"
                  onClick={() =>
                    exportToCsv(filteredAll, companyProfile?.companyName)
                  }
                  data-ocid="crm-export-csv"
                >
                  <Download className="w-3 h-3 mr-1" />
                  Export CSV
                </Button>
              </div>
              {loading ? (
                <div className="p-8 text-center text-muted-foreground text-sm font-body">
                  Loading...
                </div>
              ) : filteredAll.length === 0 ? (
                <div
                  className="p-8 text-center text-muted-foreground text-sm font-body"
                  data-ocid="crm-empty-all"
                >
                  No records match the current filters
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto scrollbar-thin">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card">
                      <tr className="border-b border-border bg-muted/20">
                        <th className="px-4 py-2 text-left font-display text-xs text-muted-foreground uppercase tracking-wider">
                          Employee
                        </th>
                        <th className="px-4 py-2 text-left font-display text-xs text-muted-foreground uppercase tracking-wider">
                          Doctor
                        </th>
                        <th className="px-4 py-2 text-right font-display text-xs text-muted-foreground uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-4 py-2 text-center font-display text-xs text-muted-foreground uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-4 py-2 text-center font-display text-xs text-muted-foreground uppercase tracking-wider">
                          Products
                        </th>
                        <th className="px-4 py-2 text-left font-display text-xs text-muted-foreground uppercase tracking-wider">
                          Submitted
                        </th>
                        <th className="px-4 py-2 text-left font-display text-xs text-muted-foreground uppercase tracking-wider">
                          Decision
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredAll.map((r) => (
                        <tr
                          key={String(r.id)}
                          className="hover:bg-muted/10"
                          data-ocid="crm-all-row"
                        >
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                            EMP-{String(r.userId)}
                          </td>
                          <td className="px-4 py-3 font-body text-foreground font-medium max-w-[140px] truncate">
                            {r.doctorName}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-foreground">
                            ₹{r.crmAmount.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`text-xs px-2 py-0.5 rounded border font-display ${STATUS_BADGE[r.status]}`}
                            >
                              {r.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                            {r.productCommitments.length}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground font-mono whitespace-nowrap">
                            {new Date(
                              Number(r.createdAt) / 1_000_000,
                            ).toLocaleDateString("en-IN")}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground font-mono whitespace-nowrap">
                            {r.approvedAt
                              ? new Date(
                                  Number(r.approvedAt) / 1_000_000,
                                ).toLocaleDateString("en-IN")
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Business Reports */}
          <TabsContent value="business">
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/30 flex flex-wrap items-center gap-3">
                <span className="text-xs uppercase tracking-wider font-display text-muted-foreground shrink-0">
                  Business Reports
                </span>
                <div className="flex items-center gap-2 ml-auto">
                  <Select value={reportMonth} onValueChange={setReportMonth}>
                    <SelectTrigger
                      className="h-8 text-xs w-[100px]"
                      data-ocid="crm-report-month"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m, i) => (
                        <SelectItem key={m} value={String(i + 1)}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={reportYear} onValueChange={setReportYear}>
                    <SelectTrigger
                      className="h-8 text-xs w-[90px]"
                      data-ocid="crm-report-year"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {YEARS.map((y) => (
                        <SelectItem key={y} value={y}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {businessReports.length === 0 ? (
                <div
                  className="p-8 text-center text-muted-foreground text-sm font-body"
                  data-ocid="crm-empty-reports"
                >
                  No business reports for the selected period
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto scrollbar-thin">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card">
                      <tr className="border-b border-border bg-muted/20">
                        <th className="px-4 py-2 text-left font-display text-xs text-muted-foreground uppercase tracking-wider">
                          Employee
                        </th>
                        <th className="px-4 py-2 text-left font-display text-xs text-muted-foreground uppercase tracking-wider">
                          Doctor
                        </th>
                        <th className="px-4 py-2 text-center font-display text-xs text-muted-foreground uppercase tracking-wider">
                          Month/Year
                        </th>
                        <th className="px-4 py-2 text-right font-display text-xs text-muted-foreground uppercase tracking-wider">
                          Actual Sales
                        </th>
                        <th className="px-4 py-2 text-center font-display text-xs text-muted-foreground uppercase tracking-wider">
                          Prescriptions
                        </th>
                        <th className="px-4 py-2 text-center font-display text-xs text-muted-foreground uppercase tracking-wider">
                          Linked CRM
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {businessReports.map((r) => {
                        const linked =
                          r.linkedCrmRequestId !== undefined
                            ? allCrm.find((c) => c.id === r.linkedCrmRequestId)
                            : undefined;
                        return (
                          <tr
                            key={String(r.id)}
                            className="hover:bg-muted/10"
                            data-ocid="crm-business-row"
                          >
                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                              EMP-{String(r.userId)}
                            </td>
                            <td className="px-4 py-3 font-body text-foreground font-medium max-w-[140px] truncate">
                              {r.doctorName}
                            </td>
                            <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                              {MONTHS[Number(r.month) - 1]} {String(r.year)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-foreground font-semibold">
                              ₹{r.actualSales.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                              {String(r.prescriptionCount)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {linked ? (
                                <span
                                  className={`text-xs px-2 py-0.5 rounded border font-display ${STATUS_BADGE[linked.status]}`}
                                >
                                  ₹{linked.crmAmount.toFixed(0)} •{" "}
                                  {linked.status}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  —
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Cross-reference summary */}
            {businessReports.length > 0 && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-card border border-border rounded-lg px-4 py-3">
                  <p className="text-xs text-muted-foreground font-body uppercase tracking-wider mb-1">
                    Total Actual Sales
                  </p>
                  <p className="text-xl font-display font-bold text-foreground">
                    ₹
                    {businessReports
                      .reduce((s, r) => s + r.actualSales, 0)
                      .toFixed(2)}
                  </p>
                </div>
                <div className="bg-card border border-border rounded-lg px-4 py-3">
                  <p className="text-xs text-muted-foreground font-body uppercase tracking-wider mb-1">
                    Total Prescriptions
                  </p>
                  <p className="text-xl font-display font-bold text-foreground">
                    {businessReports.reduce(
                      (s, r) => s + Number(r.prescriptionCount),
                      0,
                    )}
                  </p>
                </div>
                <div className="bg-card border border-border rounded-lg px-4 py-3">
                  <p className="text-xs text-muted-foreground font-body uppercase tracking-wider mb-1">
                    Reports Count
                  </p>
                  <p className="text-xl font-display font-bold text-foreground">
                    {businessReports.length}
                  </p>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </PageContent>
    </PortalLayout>
  );
}
