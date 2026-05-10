import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart2,
  CheckCircle,
  ClipboardList,
  FileText,
  PhoneCall,
  Plane,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Role } from "../../backend";
import {
  DataTable,
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import { LeaveStatus } from "../../types";
import type {
  CallReportInfo,
  LeaveApplication,
  TaDaExpense,
} from "../../types";
import { ReportStatus } from "../../types";
import { formatDate } from "../../utils/dateFormatter";

// ─── Leave tab ────────────────────────────────────────────────────────────────

const LEAVE_COLS = [
  { key: "empId", label: "Employee ID" },
  { key: "type", label: "Leave Type" },
  { key: "from", label: "From" },
  { key: "to", label: "To" },
  { key: "reason", label: "Reason" },
  { key: "status", label: "Status" },
  { key: "actions", label: "Actions", className: "text-right" },
];

const LEAVE_STATUS_COLORS: Record<LeaveStatus, string> = {
  [LeaveStatus.pending]: "bg-chart-2/20 text-chart-2 border-chart-2/30",
  [LeaveStatus.approved]: "bg-accent/20 text-accent border-accent/30",
  [LeaveStatus.rejected]:
    "bg-destructive/20 text-destructive border-destructive/30",
};

function LeaveTab({
  token,
  approverId,
}: { token: string; approverId: bigint }) {
  const [leaves, setLeaves] = useState<LeaveApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<bigint | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api
      .getPendingLeavesForManager(token)
      .then((res) => {
        if (res.__kind__ === "ok") setLeaves(res.ok);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(leaveId: bigint, approve: boolean) {
    setActing(leaveId);
    const status = approve ? LeaveStatus.approved : LeaveStatus.rejected;
    const result = await api.updateLeaveStatus(token, {
      leaveId: String(leaveId),
      status: status as unknown as Parameters<
        typeof api.updateLeaveStatus
      >[1]["status"],
      approverId,
      remark: undefined,
    });
    if (result.__kind__ === "ok") {
      toast.success(approve ? "Leave approved" : "Leave rejected");
      load();
    } else {
      toast.error(result.err);
    }
    setActing(null);
  }

  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        <Badge variant="secondary" className="text-xs">
          {leaves.length} pending
        </Badge>
      </div>
      <DataTable
        columns={LEAVE_COLS}
        data={leaves}
        getKey={(l) => String(l.id)}
        loading={loading}
        emptyMessage="No pending leave applications"
        renderRow={(l) => (
          <>
            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
              {String(l.employeeId)}
            </td>
            <td className="px-4 py-3">
              <span className="capitalize text-sm font-body text-foreground">
                {l.leaveType}
              </span>
            </td>
            <td className="px-4 py-3 text-sm font-mono text-foreground">
              {formatDate(l.fromDate)}
            </td>
            <td className="px-4 py-3 text-sm font-mono text-foreground">
              {formatDate(l.toDate)}
            </td>
            <td
              className="px-4 py-3 text-sm text-muted-foreground max-w-[200px] truncate"
              title={l.reason}
            >
              {l.reason}
            </td>
            <td className="px-4 py-3">
              <span
                className={`text-xs px-2 py-0.5 rounded border font-display ${LEAVE_STATUS_COLORS[l.status]}`}
              >
                {l.status}
              </span>
            </td>
            <td className="px-4 py-3 text-right">
              {l.status === LeaveStatus.pending && (
                <div className="flex items-center justify-end gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-accent hover:text-accent"
                    disabled={acting === l.id}
                    onClick={() => decide(l.id, true)}
                    data-ocid={`btn-approve-leave-${String(l.id)}`}
                    aria-label="Approve leave"
                  >
                    <CheckCircle className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-destructive hover:text-destructive"
                    disabled={acting === l.id}
                    onClick={() => decide(l.id, false)}
                    data-ocid={`btn-reject-leave-${String(l.id)}`}
                    aria-label="Reject leave"
                  >
                    <XCircle className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </td>
          </>
        )}
      />
    </>
  );
}

// ─── Expense tab ──────────────────────────────────────────────────────────────

const EXPENSE_COLS = [
  { key: "empId", label: "Employee ID" },
  { key: "date", label: "Date" },
  { key: "from", label: "From" },
  { key: "to", label: "To" },
  { key: "km", label: "KM" },
  { key: "ta", label: "TA (₹)" },
  { key: "da", label: "DA (₹)" },
  { key: "total", label: "Total (₹)" },
  { key: "purpose", label: "Purpose" },
  { key: "actions", label: "Actions", className: "text-right" },
];

function ExpenseTab({ token }: { token: string }) {
  const [expenses, setExpenses] = useState<TaDaExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<bigint | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api
      .getPendingExpenses(token)
      .then((e) => {
        setExpenses(e);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(expenseId: bigint, approve: boolean) {
    setActing(expenseId);
    const result = await api.approveExpense(token, expenseId, approve);
    if (result.__kind__ === "ok") {
      toast.success(approve ? "Expense approved" : "Expense rejected");
      load();
    } else {
      toast.error(result.err);
    }
    setActing(null);
  }

  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        <Badge variant="secondary" className="text-xs">
          {expenses.length} pending
        </Badge>
        <span className="text-xs text-muted-foreground font-body">
          TA: ₹2.75/km | DA: ₹250 or ₹300/day
        </span>
      </div>
      <DataTable
        columns={EXPENSE_COLS}
        data={expenses}
        getKey={(e) => String(e.id)}
        loading={loading}
        emptyMessage="No pending expense claims"
        renderRow={(e) => (
          <>
            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
              {String(e.employeeId)}
            </td>
            <td className="px-4 py-3 font-mono text-sm text-foreground">
              {formatDate(e.date)}
            </td>
            <td className="px-4 py-3 text-sm text-muted-foreground">
              {e.fromLocation}
            </td>
            <td className="px-4 py-3 text-sm text-muted-foreground">
              {e.toLocation}
            </td>
            <td className="px-4 py-3 text-sm text-right text-foreground font-mono">
              {String(e.distanceKm)}
            </td>
            <td className="px-4 py-3 text-sm text-right text-foreground font-mono">
              {String(e.travelAmount)}
            </td>
            <td className="px-4 py-3 text-sm text-right text-foreground font-mono">
              {String(e.dailyAllowance)}
            </td>
            <td className="px-4 py-3 text-sm text-right font-mono font-semibold text-foreground">
              ₹{String(e.totalAmount)}
            </td>
            <td
              className="px-4 py-3 text-sm text-muted-foreground max-w-[150px] truncate"
              title={e.purpose}
            >
              {e.purpose}
            </td>
            <td className="px-4 py-3 text-right">
              <div className="flex items-center justify-end gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-accent hover:text-accent"
                  disabled={acting === e.id}
                  onClick={() => decide(e.id, true)}
                  data-ocid={`btn-approve-expense-${String(e.id)}`}
                  aria-label="Approve expense"
                >
                  <CheckCircle className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-destructive hover:text-destructive"
                  disabled={acting === e.id}
                  onClick={() => decide(e.id, false)}
                  data-ocid={`btn-reject-expense-${String(e.id)}`}
                  aria-label="Reject expense"
                >
                  <XCircle className="w-4 h-4" />
                </Button>
              </div>
            </td>
          </>
        )}
      />
    </>
  );
}

// ─── Call Reports tab ─────────────────────────────────────────────────────────

const REPORT_STATUS_COLORS: Partial<Record<ReportStatus, string>> = {
  [ReportStatus.Submitted]: "bg-chart-2/20 text-chart-2 border-chart-2/30",
  [ReportStatus.Approved]: "bg-accent/20 text-accent border-accent/30",
  [ReportStatus.Rejected]:
    "bg-destructive/20 text-destructive border-destructive/30",
  [ReportStatus.Draft]: "bg-muted text-muted-foreground border-border",
};

const REPORT_COLS = [
  { key: "mrId", label: "MR ID" },
  { key: "date", label: "Date" },
  { key: "type", label: "Work Type" },
  { key: "doctors", label: "Doctors" },
  { key: "samples", label: "Samples" },
  { key: "remarks", label: "Remarks" },
  { key: "status", label: "Status" },
  { key: "actions", label: "Actions", className: "text-right" },
];

function CallReportsTab() {
  const { session } = useAuthStore();
  const [reports, setReports] = useState<CallReportInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<bigint | null>(null);
  const [noteModal, setNoteModal] = useState<{
    reportId: bigint;
    approve: boolean;
  } | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    api
      .listSubmittedReports()
      .then((r) => {
        setReports(r);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submitReview() {
    if (!noteModal || !session?.userId) return;
    setActing(noteModal.reportId);
    const result = await api.reviewCallReport(
      session.userId,
      noteModal.reportId,
      noteModal.approve,
      note,
    );
    if (result.__kind__ === "ok") {
      toast.success(noteModal.approve ? "Report approved" : "Report rejected");
      setNoteModal(null);
      setNote("");
      load();
    } else {
      toast.error(result.err);
    }
    setActing(null);
  }

  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        <Badge variant="secondary" className="text-xs">
          {reports.filter((r) => r.status === ReportStatus.Submitted).length}{" "}
          awaiting review
        </Badge>
        <Badge variant="outline" className="text-xs">
          {reports.length} total submitted
        </Badge>
      </div>
      <DataTable
        columns={REPORT_COLS}
        data={reports}
        getKey={(r) => String(r.id)}
        loading={loading}
        emptyMessage="No submitted call reports"
        renderRow={(r) => (
          <>
            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
              {String(r.mrId)}
            </td>
            <td className="px-4 py-3 font-mono text-sm text-foreground">
              {formatDate(r.date)}
            </td>
            <td className="px-4 py-3 text-sm text-foreground capitalize">
              {r.workType}
            </td>
            <td className="px-4 py-3 text-sm text-right text-foreground">
              {r.doctorsVisited.length}
            </td>
            <td className="px-4 py-3 text-sm text-right text-foreground">
              {r.samplesDistributed.length}
            </td>
            <td
              className="px-4 py-3 text-sm text-muted-foreground max-w-[180px] truncate"
              title={r.remarks}
            >
              {r.remarks || "—"}
            </td>
            <td className="px-4 py-3">
              <span
                className={`text-xs px-2 py-0.5 rounded border font-display ${REPORT_STATUS_COLORS[r.status] ?? "bg-muted text-muted-foreground border-border"}`}
              >
                {r.status}
              </span>
            </td>
            <td className="px-4 py-3 text-right">
              {r.status === ReportStatus.Submitted && (
                <div className="flex items-center justify-end gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-accent hover:text-accent"
                    disabled={acting === r.id}
                    onClick={() =>
                      setNoteModal({ reportId: r.id, approve: true })
                    }
                    data-ocid={`btn-approve-report-${String(r.id)}`}
                    aria-label="Approve report"
                  >
                    <CheckCircle className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-destructive hover:text-destructive"
                    disabled={acting === r.id}
                    onClick={() =>
                      setNoteModal({ reportId: r.id, approve: false })
                    }
                    data-ocid={`btn-reject-report-${String(r.id)}`}
                    aria-label="Reject report"
                  >
                    <XCircle className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </td>
          </>
        )}
      />

      {/* Review note modal */}
      {noteModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="bg-card border border-border rounded-lg w-full max-w-md shadow-xl p-6 space-y-4"
            data-ocid="report-review-modal"
          >
            <h3 className="font-display font-semibold text-foreground">
              {noteModal.approve ? "Approve Report" : "Reject Report"}
            </h3>
            <p className="text-sm text-muted-foreground font-body">
              Add a review note (optional for approval, recommended for
              rejection):
            </p>
            <textarea
              className="w-full bg-background border border-input rounded px-3 py-2 text-sm font-body text-foreground resize-none h-24 focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="Enter review notes…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              data-ocid="field-review-note"
            />
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setNoteModal(null);
                  setNote("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant={noteModal.approve ? "default" : "destructive"}
                onClick={submitReview}
                disabled={acting !== null}
                data-ocid="btn-confirm-review"
              >
                {noteModal.approve ? "Approve" : "Reject"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminReports() {
  const { session } = useAuthStore();

  if (!session?.token) return null;

  return (
    <PortalLayout portalRole={Role.Admin}>
      <PageHeader
        title="Reports & Approvals"
        subtitle="Manage leave applications, TA/DA claims, and field call reports"
      />
      <PageContent>
        {/* Quick links to new report pages */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          <a
            href="/admin/doctor-calls-30d"
            className="flex items-center gap-3 bg-card border border-border rounded-lg p-4 hover:border-primary transition-colors group"
            data-ocid="admin-reports.doctor-calls-30d-link"
          >
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <PhoneCall className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-display font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                Doctor Call Report — Last 30 Days
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                MR-wise calls with multi-MR select &amp; compact PDF export
              </p>
            </div>
          </a>
          <a
            href="/admin/dcr-submission-rate"
            className="flex items-center gap-3 bg-card border border-border rounded-lg p-4 hover:border-primary transition-colors group"
            data-ocid="admin-reports.dcr-submission-rate-link"
          >
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
              <BarChart2 className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="font-display font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                DCR Submission Rate Report
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Per-MR submission status, type &amp; doctors visited
              </p>
            </div>
          </a>
        </div>

        <Tabs defaultValue="leaves" data-ocid="reports-tabs">
          <TabsList className="mb-4" data-ocid="reports-tab-list">
            <TabsTrigger
              value="leaves"
              data-ocid="tab-leaves"
              className="flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Leave Applications
            </TabsTrigger>
            <TabsTrigger
              value="expenses"
              data-ocid="tab-expenses"
              className="flex items-center gap-2"
            >
              <Plane className="w-4 h-4" />
              TA/DA Expenses
            </TabsTrigger>
            <TabsTrigger
              value="reports"
              data-ocid="tab-reports"
              className="flex items-center gap-2"
            >
              <ClipboardList className="w-4 h-4" />
              Call Reports
            </TabsTrigger>
          </TabsList>

          <TabsContent value="leaves">
            <LeaveTab token={session.token} approverId={session.userId} />
          </TabsContent>
          <TabsContent value="expenses">
            <ExpenseTab token={session.token} />
          </TabsContent>
          <TabsContent value="reports">
            <CallReportsTab />
          </TabsContent>
        </Tabs>
      </PageContent>
    </PortalLayout>
  );
}
