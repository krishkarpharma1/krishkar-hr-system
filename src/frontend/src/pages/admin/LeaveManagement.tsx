import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { CheckCircle, FileText, RefreshCw, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { LeaveType, Role } from "../../backend";
import type { RoleLeaveQuota } from "../../backend.d";
import { ExportButton } from "../../components/ExportButton";
import {
  DataTable,
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { useCompanyProfile } from "../../hooks/useCompanyProfile";
import { api } from "../../lib/api";
import { exportToExcel, logExportToAuditTrail } from "../../lib/exportUtils";
import { useAuthStore } from "../../store/authStore";
import { LeaveStatus } from "../../types";
import type { LeaveApplication, UserInfo } from "../../types";

const MONTH_NAMES = [
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
const LEAVE_TYPE_LABELS: Record<string, string> = {
  casual: "Casual Leave",
  sick: "Sick Leave",
  unpaid: "Un-Paid Leave",
};
const ROLES = ["MR", "ASM", "RSM", "ZSM", "HRManager", "Admin"] as const;
type QuotaRole = (typeof ROLES)[number];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 3 }, (_, i) => String(CURRENT_YEAR - i));
const MONTHS = MONTH_NAMES.map((m, i) => ({ label: m, value: String(i + 1) }));

function leaveStatusBadge(s: string) {
  if (s === LeaveStatus.approved)
    return (
      <span className="text-xs bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-mono">
        Approved
      </span>
    );
  if (s === LeaveStatus.rejected)
    return (
      <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded font-mono">
        Rejected
      </span>
    );
  return (
    <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded font-mono">
      Pending
    </span>
  );
}

function LeaveBalancePills({
  quota,
  leaveType,
  used,
}: { quota: RoleLeaveQuota | undefined; leaveType: string; used: number }) {
  if (!quota) return null;
  let allotted = 0;
  if (leaveType === "casual") allotted = Number(quota.casualTotal);
  else if (leaveType === "sick") allotted = Number(quota.sickTotal);
  else if (leaveType === "unpaid") allotted = Number(quota.unpaidTotal);
  const remaining = Math.max(0, allotted - used);
  return (
    <div className="flex items-center gap-1 mt-1 flex-wrap">
      <span className="text-[10px] bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded font-mono">
        Allotted: {allotted}
      </span>
      <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-mono">
        Used: {used}
      </span>
      <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-mono">
        Remaining: {remaining}
      </span>
    </div>
  );
}

export default function AdminLeaveManagement() {
  const { session } = useAuthStore();
  const { companyProfile } = useCompanyProfile();

  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterMonth, setFilterMonth] = useState("all");
  const [filterYear, setFilterYear] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");

  const [leaves, setLeaves] = useState<LeaveApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [quotaMap, setQuotaMap] = useState<
    Partial<Record<QuotaRole, RoleLeaveQuota>>
  >({});
  const [employeeRoleMap, setEmployeeRoleMap] = useState<Map<bigint, string>>(
    new Map(),
  );
  const [employeeNameMap, setEmployeeNameMap] = useState<Map<bigint, string>>(
    new Map(),
  );

  const [actionLeave, setActionLeave] = useState<{
    leave: LeaveApplication;
    mode: "approve" | "reject";
  } | null>(null);
  const [remark, setRemark] = useState("");
  const [acting, setActing] = useState(false);

  useEffect(() => {
    if (!session) return;
    const year = BigInt(CURRENT_YEAR);
    Promise.all([
      Promise.all(
        ROLES.map((r) =>
          api
            .getRoleLeaveQuota(session.token, r as Role, year)
            .then((res) => ({ role: r, res }))
            .catch(() => ({ role: r, res: null })),
        ),
      ),
      api
        .listAllUsers(session.token)
        .then((users: UserInfo[]) => {
          const roleMap = new Map<bigint, string>();
          const nameMap = new Map<bigint, string>();
          for (const u of users) {
            roleMap.set(u.id, String(u.role));
            nameMap.set(u.id, u.name);
          }
          setEmployeeRoleMap(roleMap);
          setEmployeeNameMap(nameMap);
        })
        .catch(() => {}),
    ]).then(([results]) => {
      const map: Partial<Record<QuotaRole, RoleLeaveQuota>> = {};
      for (const { role: r, res } of results) {
        if (res && res.__kind__ === "ok") map[r as QuotaRole] = res.ok;
      }
      setQuotaMap(map);
    });
  }, [session]);

  const buildFilter = useCallback(
    () => ({
      role:
        filterRole !== "all"
          ? (filterRole as (typeof Role)[keyof typeof Role])
          : undefined,
      month: filterMonth !== "all" ? BigInt(filterMonth) : undefined,
      year: filterYear !== "all" ? BigInt(filterYear) : undefined,
      status:
        filterStatus !== "all" ? (filterStatus as LeaveStatus) : undefined,
      leaveType: filterType !== "all" ? (filterType as LeaveType) : undefined,
    }),
    [filterRole, filterMonth, filterYear, filterStatus, filterType],
  );

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const filter = buildFilter();
      const res = await api.getAllLeaves(session.token, filter);
      if (res.__kind__ === "err") {
        toast.error(res.err);
        return;
      }
      setLeaves(res.ok);
    } catch {
      toast.error("Failed to load leave applications");
    } finally {
      setLoading(false);
    }
  }, [session, buildFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = leaves.filter((l) => {
    if (!search) return true;
    const name = employeeNameMap.get(l.employeeId) ?? "";
    const empStr = String(l.employeeId);
    return (
      name.toLowerCase().includes(search.toLowerCase()) ||
      empStr.includes(search)
    );
  });

  // Separate HR leaves for visual distinction
  const hrLeaves = filtered.filter(
    (l) => employeeRoleMap.get(l.employeeId) === "HRManager",
  );
  const otherLeaves = filtered.filter(
    (l) => employeeRoleMap.get(l.employeeId) !== "HRManager",
  );

  const handleAction = async () => {
    if (!session || !actionLeave) return;
    setActing(true);
    try {
      const status =
        actionLeave.mode === "approve"
          ? LeaveStatus.approved
          : LeaveStatus.rejected;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await api.updateLeaveStatus(session.token, {
        leaveId: String(actionLeave.leave.id),
        status: status as any,
        approverId: session.userId as unknown as bigint,
        remark: remark || undefined,
      });
      if (res.__kind__ === "err") {
        toast.error(res.err);
        return;
      }
      toast.success(
        actionLeave.mode === "approve" ? "Leave approved" : "Leave rejected",
      );
      setActionLeave(null);
      setRemark("");
      await load();
    } catch {
      toast.error("Action failed");
    } finally {
      setActing(false);
    }
  };

  const handleExport = async () => {
    if (!session) return;
    setExporting(true);
    try {
      const data = filtered.map((leave) => ({
        employeeCode: String(leave.employeeId ?? ""),
        employeeName:
          employeeNameMap.get(leave.employeeId) ??
          String(leave.employeeId ?? ""),
        role: employeeRoleMap.get(leave.employeeId) ?? "",
        leaveType:
          LEAVE_TYPE_LABELS[String(leave.leaveType)] ??
          String(leave.leaveType ?? ""),
        fromDate: leave.fromDate ?? "",
        toDate: leave.toDate ?? "",
        days: Number(leave.numDays ?? 0),
        reason: leave.reason ?? "",
        status: String(leave.status ?? ""),
        approvedBy: leave.approvedBy ? String(leave.approvedBy) : "",
        approvalDate: "",
      }));
      const activeFilters = [
        search && `Search: ${search}`,
        filterRole !== "all" && `Role: ${filterRole}`,
        filterType !== "all" && `Leave Type: ${filterType}`,
        filterStatus !== "all" && `Status: ${filterStatus}`,
        filterMonth !== "all" &&
          `Month: ${MONTH_NAMES[Number(filterMonth) - 1]}`,
        filterYear !== "all" && `Year: ${filterYear}`,
      ]
        .filter(Boolean)
        .join(" | ");
      exportToExcel({
        reportName: "Leave Report",
        columns: [
          { key: "employeeCode", label: "Employee Code", type: "text" },
          { key: "employeeName", label: "Employee Name", type: "text" },
          { key: "role", label: "Role", type: "text" },
          { key: "leaveType", label: "Leave Type", type: "text" },
          { key: "fromDate", label: "From Date", type: "date" },
          { key: "toDate", label: "To Date", type: "date" },
          { key: "days", label: "Days", type: "number" },
          { key: "reason", label: "Reason", type: "text" },
          { key: "status", label: "Status", type: "text" },
          { key: "approvedBy", label: "Approved By", type: "text" },
          { key: "approvalDate", label: "Approval Date", type: "date" },
        ],
        data,
        activeFilters: activeFilters || "",
        companyName: companyProfile?.companyName ?? "Krishkar Pharmaceuticals",
      });
      logExportToAuditTrail(
        {
          userId: String(session?.userId ?? ""),
          userName: String(session?.name ?? ""),
          role: String(session?.role ?? ""),
        },
        "Leave Report",
        activeFilters || "",
        data.length,
      );
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  function getUsedLeaves(empId: bigint, leaveType: string): number {
    return leaves
      .filter(
        (l) =>
          l.employeeId === empId &&
          String(l.leaveType) === leaveType &&
          String(l.status) === LeaveStatus.approved,
      )
      .reduce((sum, l) => sum + Number(l.numDays), 0);
  }

  const cols = [
    { key: "emp", label: "Employee" },
    { key: "type", label: "Type & Balance" },
    { key: "dates", label: "Period / Days" },
    { key: "reason", label: "Reason" },
    { key: "status", label: "Status" },
    { key: "remark", label: "Remark" },
    { key: "applied", label: "Applied" },
    { key: "actions", label: "Actions", className: "text-right" },
  ];

  function renderRow(l: LeaveApplication) {
    const roleKey = (employeeRoleMap.get(l.employeeId) ?? "") as QuotaRole;
    const quota = quotaMap[roleKey];
    const usedCount = getUsedLeaves(l.employeeId, String(l.leaveType));
    const empName =
      employeeNameMap.get(l.employeeId) ?? `EMP-${String(l.employeeId)}`;
    return (
      <>
        <td className="px-4 py-3 font-body">
          <p className="text-sm text-foreground font-medium">{empName}</p>
          {roleKey && (
            <p className="text-xs text-muted-foreground font-mono">{roleKey}</p>
          )}
        </td>
        <td className="px-4 py-3">
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-mono capitalize">
            {LEAVE_TYPE_LABELS[String(l.leaveType)] ?? String(l.leaveType)}
          </span>
          <LeaveBalancePills
            quota={quota}
            leaveType={String(l.leaveType)}
            used={usedCount}
          />
        </td>
        <td className="px-4 py-3 text-xs text-muted-foreground font-body">
          <p className="text-foreground text-sm">
            {l.fromDate} → {l.toDate}
          </p>
          <p className="text-muted-foreground">
            {String(l.numDays)} day{Number(l.numDays) !== 1 ? "s" : ""}
          </p>
        </td>
        <td className="px-4 py-3 text-xs text-muted-foreground font-body max-w-[160px] truncate">
          {l.reason}
        </td>
        <td className="px-4 py-3">{leaveStatusBadge(String(l.status))}</td>
        <td className="px-4 py-3 text-xs text-muted-foreground font-body max-w-[140px] truncate">
          {l.approverRemark ?? "—"}
        </td>
        <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
          {new Date(Number(l.appliedAt) / 1_000_000).toLocaleDateString(
            "en-IN",
          )}
        </td>
        <td className="px-4 py-3 text-right">
          {String(l.status) === LeaveStatus.pending && (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                onClick={() => setActionLeave({ leave: l, mode: "approve" })}
                title="Approve"
                data-ocid={`approve-leave-${l.id}`}
              >
                <CheckCircle className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setActionLeave({ leave: l, mode: "reject" })}
                title="Reject"
                data-ocid={`reject-leave-${l.id}`}
              >
                <XCircle className="w-4 h-4" />
              </Button>
            </div>
          )}
        </td>
      </>
    );
  }

  return (
    <PortalLayout portalRole={Role.Admin}>
      <PageHeader
        title="Leave Management"
        subtitle="Consolidated view of all leave applications across all roles"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={load}
              disabled={loading}
              data-ocid="refresh-leaves-btn"
            >
              <RefreshCw
                className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`}
              />{" "}
              Refresh
            </Button>
            <ExportButton
              onClick={handleExport}
              disabled={filtered.length === 0 || exporting}
              tooltip={
                filtered.length === 0
                  ? "No data to export"
                  : filterRole !== "all" ||
                      filterType !== "all" ||
                      filterStatus !== "all" ||
                      filterMonth !== "all" ||
                      filterYear !== "all" ||
                      search
                    ? "Exports currently filtered data"
                    : "Export all data"
              }
              isLoading={exporting}
              data-ocid="export-leaves-btn"
            />
          </div>
        }
      />
      <PageContent>
        {/* Filter bar */}
        <div className="bg-card border border-border rounded-lg p-4 mb-5 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <p className="text-xs text-muted-foreground mb-1 font-display uppercase tracking-wide">
              Search Employee
            </p>
            <Input
              placeholder="Search name or ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9"
              data-ocid="leave-search"
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1 font-display uppercase tracking-wide">
              Role
            </p>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-[130px] h-9" data-ocid="filter-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1 font-display uppercase tracking-wide">
              Month
            </p>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-[120px] h-9" data-ocid="filter-month">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                {MONTHS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1 font-display uppercase tracking-wide">
              Year
            </p>
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-[100px] h-9" data-ocid="filter-year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {YEARS.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1 font-display uppercase tracking-wide">
              Status
            </p>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger
                className="w-[120px] h-9"
                data-ocid="filter-status"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value={LeaveStatus.pending}>Pending</SelectItem>
                <SelectItem value={LeaveStatus.approved}>Approved</SelectItem>
                <SelectItem value={LeaveStatus.rejected}>Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1 font-display uppercase tracking-wide">
              Leave Type
            </p>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[130px] h-9" data-ocid="filter-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value={LeaveType.casual}>Casual</SelectItem>
                <SelectItem value={LeaveType.sick}>Sick</SelectItem>
                <SelectItem value={LeaveType.unpaid}>Un-Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9 self-end"
            onClick={load}
            disabled={loading}
            data-ocid="apply-filters-btn"
          >
            Apply Filters
          </Button>
        </div>

        {!loading && (
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-display text-muted-foreground uppercase tracking-wider">
              {filtered.length} application{filtered.length !== 1 ? "s" : ""}
              {hrLeaves.length > 0 && (
                <span className="ml-2 text-primary">
                  · {hrLeaves.length} from HR
                </span>
              )}
            </span>
          </div>
        )}

        {loading && (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        )}

        {!loading && (
          <>
            {/* HR leaves section — distinct styling */}
            {hrLeaves.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-display font-semibold text-primary uppercase tracking-wider">
                    HR Manager Leave Applications
                  </span>
                  <span className="bg-primary/10 text-primary text-xs font-mono px-1.5 py-0.5 rounded">
                    {hrLeaves.length}
                  </span>
                </div>
                <DataTable
                  columns={cols}
                  data={hrLeaves}
                  getKey={(l) => String(l.id)}
                  loading={false}
                  emptyMessage=""
                  renderRow={renderRow}
                />
              </div>
            )}

            {/* Field staff leaves */}
            <div>
              {hrLeaves.length > 0 && otherLeaves.length > 0 && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider">
                    Field Staff Leave Applications
                  </span>
                  <span className="bg-muted text-muted-foreground text-xs font-mono px-1.5 py-0.5 rounded">
                    {otherLeaves.length}
                  </span>
                </div>
              )}
              <DataTable
                columns={cols}
                data={hrLeaves.length > 0 ? otherLeaves : filtered}
                getKey={(l) => String(l.id)}
                loading={false}
                emptyMessage="No leave applications match the selected filters"
                renderRow={renderRow}
              />
            </div>
          </>
        )}

        {/* Approve/Reject dialog */}
        <Dialog
          open={!!actionLeave}
          onOpenChange={() => {
            setActionLeave(null);
            setRemark("");
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {actionLeave?.mode === "approve"
                  ? "Approve Leave Application"
                  : "Reject Leave Application"}
              </DialogTitle>
            </DialogHeader>
            {actionLeave && (
              <div className="space-y-3 py-1">
                <div className="bg-muted/30 rounded-lg p-3 text-sm font-body space-y-1.5">
                  <p>
                    <span className="text-muted-foreground">Employee:</span>{" "}
                    {employeeNameMap.get(actionLeave.leave.employeeId) ??
                      `EMP-${String(actionLeave.leave.employeeId)}`}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Role:</span>{" "}
                    {employeeRoleMap.get(actionLeave.leave.employeeId) ?? "—"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Type:</span>{" "}
                    {LEAVE_TYPE_LABELS[String(actionLeave.leave.leaveType)] ??
                      String(actionLeave.leave.leaveType)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Period:</span>{" "}
                    {actionLeave.leave.fromDate} → {actionLeave.leave.toDate} (
                    {String(actionLeave.leave.numDays)} days)
                  </p>
                  <p>
                    <span className="text-muted-foreground">Reason:</span>{" "}
                    {actionLeave.leave.reason}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">
                    {actionLeave.mode === "approve"
                      ? "Approval Remark (optional)"
                      : "Rejection Reason (optional)"}
                  </Label>
                  <Textarea
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    placeholder="Add a remark or reason…"
                    rows={3}
                    data-ocid="action-remark"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setActionLeave(null);
                  setRemark("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant={
                  actionLeave?.mode === "approve" ? "default" : "destructive"
                }
                onClick={handleAction}
                disabled={acting}
                data-ocid="confirm-leave-action"
              >
                {acting
                  ? "Processing…"
                  : actionLeave?.mode === "approve"
                    ? "Approve"
                    : "Reject"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageContent>
    </PortalLayout>
  );
}
