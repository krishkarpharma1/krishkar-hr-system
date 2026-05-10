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
import {
  Calendar,
  CheckCircle,
  CheckCircle2,
  Download,
  FileText,
  Plus,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { LeaveType, Role } from "../../backend";
import type { ApplyLeaveInput, RoleLeaveQuota } from "../../backend.d";
import {
  DataTable,
  PageContent,
  PageHeader,
  PortalLayout,
  SectionCard,
} from "../../components/PortalLayout";
import { useCompanyProfile } from "../../hooks/useCompanyProfile";
import { useGps } from "../../hooks/useGps";
import { api } from "../../lib/api";
import { buildBrandingExcelRows } from "../../lib/brandingHtml";
import { useAuthStore } from "../../store/authStore";
import type { LeaveApplication, LeaveExportRow } from "../../types";
import type { UserInfo } from "../../types";
import { LeaveStatus } from "../../types";

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
  casual: "Casual Leave (CL)",
  sick: "Sick Leave (SL)",
  pl: "Privilege Leave (PL)",
  ml: "Maternity Leave (ML)",
  lwp: "Leave Without Pay (LWP)",
  co: "Compensatory Off (CO)",
  earnedLeave: "Earned Leave (EL)",
  fieldLeave: "Field Leave",
  // legacy backward-compat
  unpaid: "Leave Without Pay (LWP)",
};
const ROLES = ["MR", "ASM", "RSM", "ZSM", "HRManager", "Admin"] as const;
type QuotaRole = (typeof ROLES)[number];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 3 }, (_, i) => String(CURRENT_YEAR - i));
const MONTHS = MONTH_NAMES.map((m, i) => ({ label: m, value: String(i + 1) }));
const LEAVE_OPTIONS = [
  { value: LeaveType.casual, label: "Casual Leave (CL)" },
  { value: LeaveType.sick, label: "Sick Leave (SL)" },
  { value: LeaveType.pl, label: "Privilege Leave (PL)" },
  { value: LeaveType.ml, label: "Maternity Leave (ML)" },
  { value: LeaveType.lwp, label: "Leave Without Pay (LWP)" },
  { value: LeaveType.co, label: "Compensatory Off (CO)" },
  // EL and Field Leave — only if backend exports them
  ...((LeaveType as Record<string, string>).earnedLeave
    ? [
        {
          value: (LeaveType as Record<string, string>).earnedLeave,
          label: "Earned Leave (EL)",
        },
      ]
    : []),
  ...((LeaveType as Record<string, string>).fieldLeave
    ? [
        {
          value: (LeaveType as Record<string, string>).fieldLeave,
          label: "Field Leave",
        },
      ]
    : []),
];

type TabId = "team" | "my";

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
  else if (leaveType === "pl") allotted = Number(quota.plTotal ?? 0);
  else if (leaveType === "ml") allotted = Number(quota.mlTotal ?? 0);
  else if (leaveType === "lwp") allotted = Number(quota.lwpTotal ?? 0);
  else if (leaveType === "co") allotted = Number(quota.coTotal ?? 0);
  else if (leaveType === "earnedLeave")
    allotted = Number(
      (quota as unknown as Record<string, bigint | undefined>).elTotal ?? 0,
    );
  else if (leaveType === "fieldLeave")
    allotted = Number(
      (quota as unknown as Record<string, bigint | undefined>).flTotal ?? 0,
    );
  else if (leaveType === "unpaid") allotted = Number(quota.lwpTotal ?? 0);
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

export default function LeaveManagement() {
  const { session } = useAuthStore();
  const { companyProfile } = useCompanyProfile();
  const { coords: gpsCoords } = useGps();

  const [activeTab, setActiveTab] = useState<TabId>("team");

  // Team leave filters
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterMonth, setFilterMonth] = useState("all");
  const [filterYear, setFilterYear] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");

  const [leaves, setLeaves] = useState<LeaveApplication[]>([]);
  const [myLeaves, setMyLeaves] = useState<LeaveApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [myLoading, setMyLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [quotaMap, setQuotaMap] = useState<
    Partial<Record<QuotaRole, RoleLeaveQuota>>
  >({});
  const [myQuota, setMyQuota] = useState<RoleLeaveQuota | undefined>();
  const [employeeRoleMap, setEmployeeRoleMap] = useState<Map<bigint, string>>(
    new Map(),
  );

  // Approve/reject dialog
  const [actionLeave, setActionLeave] = useState<{
    leave: LeaveApplication;
    mode: "approve" | "reject";
  } | null>(null);
  const [remark, setRemark] = useState("");
  const [acting, setActing] = useState(false);

  // Apply leave form
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [applyLeaveType, setApplyLeaveType] = useState<LeaveType>(
    LeaveType.casual,
  );
  const [applyFromDate, setApplyFromDate] = useState("");
  const [applyToDate, setApplyToDate] = useState("");
  const [applyReason, setApplyReason] = useState("");
  const [applyRemarks, setApplyRemarks] = useState("");
  const [applying, setApplying] = useState(false);

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
          const map = new Map<bigint, string>();
          for (const u of users) map.set(u.id, String(u.role));
          setEmployeeRoleMap(map);
        })
        .catch(() => {}),
      api
        .getRoleLeaveQuota(session.token, Role.HRManager, year)
        .then((res) => {
          if (res.__kind__ === "ok") setMyQuota(res.ok);
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

  const loadTeamLeaves = useCallback(async () => {
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

  const loadMyLeaves = useCallback(async () => {
    if (!session) return;
    setMyLoading(true);
    try {
      const res = await api.getMyLeaves(session.token);
      // getMyLeaves returns array directly
      setMyLeaves(Array.isArray(res) ? res : []);
    } catch {
      toast.error("Failed to load your leave applications");
    } finally {
      setMyLoading(false);
    }
  }, [session]);

  useEffect(() => {
    loadTeamLeaves();
  }, [loadTeamLeaves]);
  useEffect(() => {
    if (activeTab === "my") loadMyLeaves();
  }, [activeTab, loadMyLeaves]);

  const filtered = leaves.filter((l) => {
    if (!search) return true;
    const empStr = String(l.employeeId).toLowerCase();
    return empStr.includes(search.toLowerCase());
  });

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
      await loadTeamLeaves();
    } catch {
      toast.error("Action failed");
    } finally {
      setActing(false);
    }
  };

  function calcDays(from: string, to: string): number {
    if (!from || !to) return 0;
    const d1 = new Date(from).getTime();
    const d2 = new Date(to).getTime();
    if (d2 < d1) return 0;
    return Math.round((d2 - d1) / 86400000) + 1;
  }

  async function handleApplyLeave() {
    if (!applyFromDate || !applyToDate) {
      toast.error("Select start and end dates");
      return;
    }
    if (!applyReason.trim()) {
      toast.error("Reason is required");
      return;
    }
    const numDays = calcDays(applyFromDate, applyToDate);
    if (numDays <= 0) {
      toast.error("End date must be on or after start date");
      return;
    }
    if (!session) return;
    setApplying(true);
    try {
      const input: ApplyLeaveInput = {
        leaveType: applyLeaveType,
        fromDate: applyFromDate,
        toDate: applyToDate,
        numDays: BigInt(numDays),
        reason: applyReason,
        notes: applyRemarks || undefined,
        gpsLocation: gpsCoords
          ? {
              lat: gpsCoords.lat,
              lng: gpsCoords.lng,
              timestamp: BigInt(gpsCoords.timestamp),
            }
          : undefined,
      };
      const res = await api.applyLeaveV2(session.token, input);
      if (res.__kind__ === "err") {
        toast.error(res.err);
        return;
      }
      toast.success("Leave application submitted. Pending Admin approval.");
      setShowApplyForm(false);
      setApplyFromDate("");
      setApplyToDate("");
      setApplyReason("");
      setApplyRemarks("");
      await loadMyLeaves();
    } catch (e) {
      toast.error(String(e) || "Failed to submit leave");
    } finally {
      setApplying(false);
    }
  }

  const handleExport = async () => {
    if (!session) return;
    setExporting(true);
    try {
      const filter = buildFilter();
      const res = await api.getLeaveExportRows(session.token, filter);
      if (res.__kind__ === "err") {
        toast.error(res.err);
        return;
      }
      const rows = res.ok as LeaveExportRow[];
      if (rows.length === 0) {
        toast.warning("No data for the selected filters");
        return;
      }
      const data = rows.map((r) => ({
        "Leave ID": r.leaveId,
        "Employee ID": r.employeeId,
        "Employee Name": r.employeeName,
        Role: r.role,
        "Leave Type": LEAVE_TYPE_LABELS[r.leaveType] ?? r.leaveType,
        "From Date": r.fromDate,
        "To Date": r.toDate,
        Days: Number(r.numDays),
        Reason: r.reason,
        Status: r.status,
        "Approver Name": r.approverName ?? "",
        Remark: r.remark ?? "",
        "Applied At": r.appliedAt,
        "Allotted (Role Config)": (() => {
          const quota = quotaMap[r.role as QuotaRole];
          if (!quota) return "—";
          if (r.leaveType === "casual") return Number(quota.casualTotal);
          if (r.leaveType === "sick") return Number(quota.sickTotal);
          if (r.leaveType === "pl") return Number(quota.plTotal ?? 0);
          if (r.leaveType === "ml") return Number(quota.mlTotal ?? 0);
          if (r.leaveType === "lwp") return Number(quota.lwpTotal ?? 0);
          if (r.leaveType === "co") return Number(quota.coTotal ?? 0);
          if (r.leaveType === "earnedLeave")
            return Number(
              (quota as unknown as Record<string, bigint | undefined>)
                .elTotal ?? 0,
            );
          if (r.leaveType === "fieldLeave")
            return Number(
              (quota as unknown as Record<string, bigint | undefined>)
                .flTotal ?? 0,
            );
          if (r.leaveType === "unpaid") return Number(quota.lwpTotal ?? 0);
          return "—";
        })(),
      }));
      const brandingRows = buildBrandingExcelRows(companyProfile ?? null);
      const allRows = [...brandingRows, ...data] as Record<string, unknown>[];
      const ws = XLSX.utils.json_to_sheet(allRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Leave Records");
      XLSX.writeFile(
        wb,
        `leave-records-${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
      toast.success(`Exported ${data.length} rows`);
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
  function getMyUsedLeaves(leaveType: string): number {
    return myLeaves
      .filter(
        (l) =>
          String(l.leaveType) === leaveType &&
          String(l.status) === LeaveStatus.approved,
      )
      .reduce((sum, l) => sum + Number(l.numDays), 0);
  }

  const teamCols = [
    { key: "emp", label: "Employee" },
    { key: "type", label: "Type & Balance" },
    { key: "dates", label: "Period / Days" },
    { key: "reason", label: "Reason" },
    { key: "status", label: "Status" },
    { key: "remark", label: "Remark" },
    { key: "applied", label: "Applied" },
    { key: "actions", label: "Actions", className: "text-right" },
  ];

  return (
    <PortalLayout portalRole={Role.HRManager}>
      <PageHeader
        title="Leave Management"
        subtitle="Review team leave applications and manage your own leave"
        actions={
          <div className="flex items-center gap-2">
            {activeTab === "team" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadTeamLeaves}
                  disabled={loading}
                  data-ocid="refresh-leaves-btn"
                >
                  <RefreshCw
                    className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`}
                  />{" "}
                  Refresh
                </Button>
                <Button
                  size="sm"
                  onClick={handleExport}
                  disabled={exporting || loading}
                  data-ocid="export-leaves-btn"
                >
                  <Download className="w-4 h-4 mr-1" />
                  {exporting ? "Exporting…" : "Export Excel"}
                </Button>
              </>
            )}
            {activeTab === "my" && (
              <Button
                size="sm"
                onClick={() => setShowApplyForm((v) => !v)}
                data-ocid="btn-apply-leave"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                {showApplyForm ? "Cancel" : "Apply for Leave"}
              </Button>
            )}
          </div>
        }
      />
      <PageContent>
        {/* Tabs */}
        <div className="flex gap-0 border-b border-border mb-5">
          {(
            [
              { id: "team" as TabId, label: "Team Leave Applications" },
              { id: "my" as TabId, label: "My Leave Applications" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              data-ocid={`tab-leave-${t.id}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === "team" && (
          <>
            {/* Filter bar */}
            <div className="bg-card border border-border rounded-lg p-4 mb-5 flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[180px]">
                <p className="text-xs text-muted-foreground mb-1 font-display uppercase tracking-wide">
                  Search Employee
                </p>
                <Input
                  placeholder="Search…"
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
                  <SelectTrigger
                    className="w-[130px] h-9"
                    data-ocid="filter-role"
                  >
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
                  <SelectTrigger
                    className="w-[120px] h-9"
                    data-ocid="filter-month"
                  >
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
                  <SelectTrigger
                    className="w-[100px] h-9"
                    data-ocid="filter-year"
                  >
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
                    <SelectItem value={LeaveStatus.approved}>
                      Approved
                    </SelectItem>
                    <SelectItem value={LeaveStatus.rejected}>
                      Rejected
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1 font-display uppercase tracking-wide">
                  Leave Type
                </p>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger
                    className="w-[130px] h-9"
                    data-ocid="filter-type"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value={LeaveType.casual}>
                      Casual Leave (CL)
                    </SelectItem>
                    <SelectItem value={LeaveType.sick}>
                      Sick Leave (SL)
                    </SelectItem>
                    <SelectItem value={LeaveType.pl}>
                      Privilege Leave (PL)
                    </SelectItem>
                    <SelectItem value={LeaveType.ml}>
                      Maternity Leave (ML)
                    </SelectItem>
                    <SelectItem value={LeaveType.lwp}>
                      Leave Without Pay (LWP)
                    </SelectItem>
                    <SelectItem value={LeaveType.co}>
                      Compensatory Off (CO)
                    </SelectItem>
                    {(LeaveType as Record<string, string>).earnedLeave && (
                      <SelectItem
                        value={
                          (LeaveType as Record<string, string>).earnedLeave
                        }
                      >
                        Earned Leave (EL)
                      </SelectItem>
                    )}
                    {(LeaveType as Record<string, string>).fieldLeave && (
                      <SelectItem
                        value={(LeaveType as Record<string, string>).fieldLeave}
                      >
                        Field Leave
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-9 self-end"
                onClick={loadTeamLeaves}
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
                  {filtered.length} application
                  {filtered.length !== 1 ? "s" : ""}
                </span>
              </div>
            )}
            {loading && (
              <div className="space-y-2" data-ocid="leaves-loading">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
              </div>
            )}
            {!loading && (
              <DataTable
                columns={teamCols}
                data={filtered}
                getKey={(l) => String(l.id)}
                loading={false}
                emptyMessage="No leave applications match the selected filters"
                renderRow={(l) => {
                  const roleKey = (employeeRoleMap.get(l.employeeId) ??
                    "") as QuotaRole;
                  const quota = quotaMap[roleKey];
                  const usedCount = getUsedLeaves(
                    l.employeeId,
                    String(l.leaveType),
                  );
                  return (
                    <>
                      <td className="px-4 py-3 font-body">
                        <p className="text-sm text-foreground font-medium">
                          EMP-{String(l.employeeId)}
                        </p>
                        {roleKey && (
                          <p className="text-xs text-muted-foreground font-mono">
                            {roleKey}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          ID: {String(l.id)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-mono capitalize">
                          {LEAVE_TYPE_LABELS[String(l.leaveType)] ??
                            String(l.leaveType)}
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
                          {String(l.numDays)} day
                          {Number(l.numDays) !== 1 ? "s" : ""}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-body max-w-[160px] truncate">
                        {l.reason}
                      </td>
                      <td className="px-4 py-3">
                        {leaveStatusBadge(String(l.status))}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-body max-w-[140px] truncate">
                        {l.approverRemark ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                        {new Date(
                          Number(l.appliedAt) / 1_000_000,
                        ).toLocaleDateString("en-IN")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {String(l.status) === LeaveStatus.pending && (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              onClick={() =>
                                setActionLeave({ leave: l, mode: "approve" })
                              }
                              title="Approve"
                              data-ocid={`approve-leave-${l.id}`}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() =>
                                setActionLeave({ leave: l, mode: "reject" })
                              }
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
                }}
              />
            )}
          </>
        )}

        {activeTab === "my" && (
          <>
            {/* My leave balance */}
            {myQuota && (
              <SectionCard title="My Leave Balance">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {[
                    {
                      label: "Casual Leave (CL)",
                      key: "casual",
                      allotted: Number(myQuota.casualTotal),
                    },
                    {
                      label: "Sick Leave (SL)",
                      key: "sick",
                      allotted: Number(myQuota.sickTotal),
                    },
                    {
                      label: "Privilege Leave (PL)",
                      key: "pl",
                      allotted: Number(myQuota.plTotal ?? 0),
                    },
                    {
                      label: "Maternity Leave (ML)",
                      key: "ml",
                      allotted: Number(myQuota.mlTotal ?? 0),
                    },
                    {
                      label: "Leave Without Pay (LWP)",
                      key: "lwp",
                      allotted: Number(myQuota.lwpTotal ?? 0),
                    },
                    {
                      label: "Compensatory Off (CO)",
                      key: "co",
                      allotted: Number(myQuota.coTotal ?? 0),
                    },
                    {
                      label: "Earned Leave (EL)",
                      key: "earnedLeave",
                      allotted: Number(
                        (
                          myQuota as unknown as Record<
                            string,
                            bigint | undefined
                          >
                        ).elTotal ?? 0,
                      ),
                    },
                    {
                      label: "Field Leave",
                      key: "fieldLeave",
                      allotted: Number(
                        (
                          myQuota as unknown as Record<
                            string,
                            bigint | undefined
                          >
                        ).flTotal ?? 0,
                      ),
                    },
                  ].map(({ label, key, allotted }) => {
                    const used = getMyUsedLeaves(key);
                    const remaining = Math.max(0, allotted - used);
                    return (
                      <div
                        key={key}
                        className="bg-muted/30 rounded-lg p-3 text-center"
                      >
                        <p className="text-xs text-muted-foreground font-display mb-1">
                          {label}
                        </p>
                        <p className="text-2xl font-bold font-display text-foreground">
                          {remaining}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">
                          remaining / {allotted}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
            )}

            {/* Apply leave form */}
            {showApplyForm && (
              <SectionCard title="New Leave Application">
                <div className="grid gap-4 max-w-xl">
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      Leave Type <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={applyLeaveType}
                      onValueChange={(v) => setApplyLeaveType(v as LeaveType)}
                    >
                      <SelectTrigger data-ocid="apply-leave-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LEAVE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">
                        Start Date <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        type="date"
                        value={applyFromDate}
                        onChange={(e) => setApplyFromDate(e.target.value)}
                        data-ocid="apply-from-date"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">
                        End Date <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        type="date"
                        value={applyToDate}
                        onChange={(e) => setApplyToDate(e.target.value)}
                        data-ocid="apply-to-date"
                      />
                    </div>
                  </div>
                  {applyFromDate && applyToDate && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded px-3 py-2">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        {calcDays(applyFromDate, applyToDate)} day(s) applied
                      </span>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      Reason <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      value={applyReason}
                      onChange={(e) => setApplyReason(e.target.value)}
                      placeholder="Reason for leave…"
                      rows={3}
                      data-ocid="apply-reason"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Remarks (optional)</Label>
                    <Input
                      value={applyRemarks}
                      onChange={(e) => setApplyRemarks(e.target.value)}
                      placeholder="Additional remarks…"
                      data-ocid="apply-remarks"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleApplyLeave}
                      disabled={applying}
                      data-ocid="btn-submit-leave"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1.5" />
                      {applying ? "Submitting…" : "Submit Application"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowApplyForm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </SectionCard>
            )}

            {/* My leave history */}
            <SectionCard title={`My Leave Applications (${myLeaves.length})`}>
              {myLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-14 rounded-lg" />
                  ))}
                </div>
              ) : myLeaves.length === 0 ? (
                <div
                  className="py-10 text-center text-muted-foreground text-sm"
                  data-ocid="my-leaves-empty"
                >
                  <p>No leave applications yet.</p>
                  <Button
                    size="sm"
                    className="mt-3"
                    onClick={() => setShowApplyForm(true)}
                    data-ocid="btn-apply-leave-empty"
                  >
                    <Plus className="w-4 h-4 mr-1.5" /> Apply for Leave
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {myLeaves.map((l) => (
                    <div
                      key={String(l.id)}
                      className="py-3 flex items-center gap-4"
                      data-ocid={`my-leave-row-${l.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-mono">
                            {LEAVE_TYPE_LABELS[String(l.leaveType)] ??
                              String(l.leaveType)}
                          </span>
                          {leaveStatusBadge(String(l.status))}
                        </div>
                        <p className="text-sm font-body text-foreground mt-1">
                          {l.fromDate} → {l.toDate}{" "}
                          <span className="text-muted-foreground text-xs">
                            ({String(l.numDays)} day
                            {Number(l.numDays) !== 1 ? "s" : ""})
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {l.reason}
                        </p>
                        {l.approverRemark && (
                          <p className="text-xs text-muted-foreground italic mt-0.5">
                            Remark: {l.approverRemark}
                          </p>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono text-right shrink-0">
                        {new Date(
                          Number(l.appliedAt) / 1_000_000,
                        ).toLocaleDateString("en-IN")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
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
                    EMP-{String(actionLeave.leave.employeeId)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Type:</span>{" "}
                    <span className="capitalize">
                      {LEAVE_TYPE_LABELS[String(actionLeave.leave.leaveType)] ??
                        String(actionLeave.leave.leaveType)}
                    </span>
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
