import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Bell,
  BookOpen,
  CalendarDays,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  FileText,
  Gift,
  HandCoins,
  History,
  Mail,
  MapPin,
  MapPinCheck,
  Package,
  Percent,
  Receipt,
  RefreshCw,
  Route,
  ShieldAlert,
  Store,
  Target,
  TrendingUp,
  UserCheck,
  UserMinus,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Role } from "../../backend";
import type { NotificationRecord } from "../../backend.d";
import { BirthdayFlash } from "../../components/BirthdayFlash";
import { KpiCard } from "../../components/KpiCard";
import { NotificationInbox } from "../../components/NotificationInbox";
import { OnLeaveBanner } from "../../components/OnLeaveBanner";
import { PendingActionsWidget } from "../../components/PendingActionsWidget";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { UpcomingBirthdaysWidget } from "../../components/UpcomingBirthdaysWidget";
import { useBirthdays } from "../../hooks/useBirthdays";
import { useDashboardData } from "../../hooks/useDashboardData";
import { usePendingCounts } from "../../hooks/usePendingCounts";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import type {
  AdditionalCharge,
  HrKpis,
  LeaveApplication,
  TaDaExpense,
  UserInfo,
} from "../../types";
import { UserStatus } from "../../types";
import { formatDateTime } from "../../utils/dateFormatter";
import BirthdayCalendarPage from "../shared/BirthdayCalendarPage";
import PersonalTaDaForm from "../shared/PersonalTaDaForm";

const MODULES = [
  {
    label: "Employee Management",
    desc: "Onboard, edit, manage employees",
    to: "/hr/employees",
    icon: Users,
    color: "text-primary",
  },
  {
    label: "Leave Management",
    desc: "Approve/reject leave applications",
    to: "/hr/leaves",
    icon: CalendarDays,
    color: "text-accent",
  },
  {
    label: "Stockist Master",
    desc: "Manage stockists and territory assignments",
    to: "/hr/stockist-master",
    icon: Store,
    color: "text-primary",
  },
  {
    label: "Attendance Tracking",
    desc: "Mark & view attendance records",
    to: "/hr/attendance",
    icon: Clock,
    color: "text-primary",
  },
  {
    label: "Payroll Processing",
    desc: "Process salaries & salary slips",
    to: "/hr/payroll",
    icon: DollarSign,
    color: "text-accent",
  },
  {
    label: "Expense Sheets",
    desc: "Monthly expense sheet management & payment",
    to: "/hr/expense-sheets",
    icon: Receipt,
    color: "text-primary",
  },
  {
    label: "Incentive & Bonus Sheets",
    desc: "Quarterly incentive & bonus sheet management",
    to: "/hr/incentive-bonus-sheets",
    icon: Gift,
    color: "text-accent",
  },
  {
    label: "Employee Advances",
    desc: "Manage advance payments & installment recovery",
    to: "/hr/employee-advances",
    icon: CreditCard,
    color: "text-primary",
  },
  {
    label: "TA/DA Expenses",
    desc: "Review and approve expense claims",
    to: "/hr/expenses",
    icon: Receipt,
    color: "text-primary",
  },
  {
    label: "TA/DA Summary",
    desc: "Weekly TA/DA summary report by employee role",
    to: "/hr/tada-summary",
    icon: TrendingUp,
    color: "text-accent",
  },
  {
    label: "Personal TA/DA",
    desc: "Submit your own travel and daily allowance claims",
    to: "/hr/personal-tada",
    icon: HandCoins,
    color: "text-accent",
  },
  {
    label: "Performance Reports",
    desc: "Employee performance analytics",
    to: "/hr/performance",
    icon: TrendingUp,
    color: "text-accent",
  },
  {
    label: "Document Management",
    desc: "Upload & manage employee docs",
    to: "/hr/documents",
    icon: FileText,
    color: "text-primary",
  },
  {
    label: "GPS Trail Viewer",
    desc: "View staff movement history by day",
    to: "/hr/gps-trail",
    icon: MapPin,
    color: "text-accent",
  },
  {
    label: "Location Check-In",
    desc: "Verify attendance at assigned location",
    to: "/hr/checkin",
    icon: MapPinCheck,
    color: "text-primary",
  },
  {
    label: "CRM Management",
    desc: "Approve CRM requests & business reports",
    to: "/hr/crm",
    icon: HandCoins,
    color: "text-accent",
  },
  {
    label: "Monthly Targets",
    desc: "Set & manage monthly sales targets for field staff",
    to: "/hr/monthly-targets",
    icon: Target,
    color: "text-primary",
  },
  {
    label: "Additional Charges",
    desc: "Assign temporary roles or areas to employees",
    to: "/hr/additional-charges",
    icon: UserCheck,
    color: "text-accent",
  },
  {
    label: "Target History",
    desc: "Audit log of all target adjustments",
    to: "/hr/targets/history",
    icon: History,
    color: "text-primary",
  },
  {
    label: "Target vs. Actual",
    desc: "Team performance vs targets",
    to: "/hr/target-performance",
    icon: TrendingUp,
    color: "text-accent",
  },
  {
    label: "Incentive Plans",
    desc: "Configure role-wise incentive slabs",
    to: "/hr/incentive-plans",
    icon: Gift,
    color: "text-accent",
  },
  {
    label: "Incentive Management",
    desc: "View, approve & export incentives",
    to: "/hr/incentives",
    icon: Percent,
    color: "text-primary",
  },
  {
    label: "Travel Plans",
    desc: "Track employee travel plan submissions",
    to: "/hr/travel-plans",
    icon: Route,
    color: "text-primary",
  },
  {
    label: "Gift Article Master",
    desc: "Manage gift articles for Doctor Call Entry",
    to: "/hr/gift-article-master",
    icon: Gift,
    color: "text-primary",
  },
  {
    label: "Booking Requests",
    desc: "Approve sample & gift article bookings",
    to: "/hr/booking",
    icon: Package,
    color: "text-accent",
  },
  {
    label: "Download Pricelist",
    desc: "View & download current product pricelist",
    to: "/shared/pricelist",
    icon: Download,
    color: "text-accent",
  },
  {
    label: "Download Pricelist",
    desc: "View & download current product pricelist",
    to: "/shared/pricelist",
    icon: Download,
    color: "text-accent",
  },
  {
    label: "Export & Reports",
    desc: "Download Excel exports for all staff data",
    to: "/hr/export",
    icon: Download,
    color: "text-primary",
  },
  {
    label: "Message Popup",
    desc: "Create and manage daily first-login messages",
    to: "/hr/messages",
    icon: Bell,
    color: "text-accent",
  },
  {
    label: "Official Letters",
    desc: "Create & print company letterhead letters",
    to: "/hr/official-letters",
    icon: Mail,
    color: "text-primary",
  },
  {
    label: "Cleanup Audit Log",
    desc: "Read-only record of all data cleanup actions",
    to: "/hr/data-cleanup-history",
    icon: History,
    color: "text-accent",
  },
  {
    label: "Absence Audit Trail",
    desc: "Auto-inactivation and reactivation event log",
    to: "/hr/absence-audit",
    icon: ShieldAlert,
    color: "text-primary",
  },
  {
    label: "Birthday Calendar",
    desc: "View employee and doctor birthdays by month",
    to: "/hr/birthday-calendar",
    icon: CalendarDays,
    color: "text-accent",
  },
  {
    label: "Sample Allocation",
    desc: "Allocate samples to MRs and view balance",
    to: "/hr/sample-allocation",
    icon: Package,
    color: "text-primary",
  },
  {
    label: "DCR Submission Rate Report",
    desc: "Per-MR DCR submission status, type, and doctor visit count",
    to: "/hr/dcr-submission-rate",
    icon: TrendingUp,
    color: "text-accent",
  },
  {
    label: "DCR Summary Report",
    desc: "Date-wise DCR submission status for all MRs",
    to: "/hr/sfa/dcr-summary",
    icon: FileText,
    color: "text-primary",
  },
  {
    label: "MTP vs Actual Report",
    desc: "Compare planned vs. actual MR tour schedules",
    to: "/hr/sfa/mtp-vs-actual",
    icon: TrendingUp,
    color: "text-accent",
  },
  {
    label: "JFW Summary Report",
    desc: "Joint Field Work summary for compliance review",
    to: "/hr/sfa/jfw-summary",
    icon: Users,
    color: "text-primary",
  },
  {
    label: "Sample Balance Report",
    desc: "Sample allocation and usage tracking per MR",
    to: "/hr/sfa/sample-balance",
    icon: Package,
    color: "text-accent",
  },
  {
    label: "Attendance Corrections",
    desc: "Review and approve auto-checkout correction requests",
    to: "/hr/attendance-corrections",
    icon: MapPinCheck,
    color: "text-primary",
  },
];

export default function HRPortal() {
  const { session } = useAuthStore();
  const birthdayData = useBirthdays();
  const currentUserId = String(session?.userId ?? "");
  const token = session?.token ?? "";

  const [employees, setEmployees] = useState<UserInfo[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<LeaveApplication[]>([]);
  const [pendingExpenses, setPendingExpenses] = useState<TaDaExpense[]>([]);
  const [recentActivity, setRecentActivity] = useState<NotificationRecord[]>(
    [],
  );
  const [expiringCharges, setExpiringCharges] = useState<
    (AdditionalCharge & { empName?: string })[]
  >([]);
  const [dismissedChargeIds, setDismissedChargeIds] = useState<Set<string>>(
    () => {
      const stored = sessionStorage.getItem("dismissed_charge_ids");
      return new Set(stored ? JSON.parse(stored) : []);
    },
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Phase-3 dashboard data
  const {
    data: dashData,
    loading: kpiLoading,
    refresh: kpiRefresh,
  } = useDashboardData(token);
  const { counts: pendingCounts } = usePendingCounts(token);

  const hrKpis: HrKpis | null =
    dashData?.__kind__ === "hr" ? dashData.hr : null;

  useEffect(() => {
    if (!session) return;
    async function load() {
      setLoadError(false);
      try {
        const [users, leaves, expenses, allCharges, notifications] =
          await Promise.all([
            api.listAllUsers(session!.token),
            api.getPendingLeavesForManager(session!.token),
            api.getPendingExpenses(session!.token),
            api.listAllAdditionalCharges(session!.token, { activeOnly: true }),
            api.getMyNotifications(session!.token),
          ]);
        setEmployees(users);
        if (leaves.__kind__ === "ok") setPendingLeaves(leaves.ok);
        setPendingExpenses(expenses);
        // Recent HR activity — take the last 10 notifications as activity log
        setRecentActivity(
          [...notifications]
            .sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
            .slice(0, 10),
        );
        const empMap = new Map(users.map((e) => [e.id, e.name]));
        const now = Date.now();
        const expiring = allCharges
          .filter((c) => {
            const ms = Number(c.effectiveTo) / 1_000_000;
            return ms > now && ms - now < 7 * 24 * 60 * 60 * 1000;
          })
          .map((c) => ({
            ...c,
            empName: empMap.get(c.employeeId) ?? `EMP-${String(c.employeeId)}`,
          }));
        setExpiringCharges(expiring);
      } catch (err) {
        console.error("[HRPortal] Dashboard load error:", err);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [session]);

  function dismissCharge(id: string) {
    setDismissedChargeIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      sessionStorage.setItem("dismissed_charge_ids", JSON.stringify([...next]));
      return next;
    });
  }

  const visibleExpiringCharges = expiringCharges.filter(
    (c) => !dismissedChargeIds.has(c.id),
  );

  const activeCount = employees.filter(
    (e) => e.status === UserStatus.Active,
  ).length;

  const pendingLeaveCount = Number(
    hrKpis?.pendingLeaveApplications ??
      pendingCounts?.leavePending ??
      pendingLeaves.length,
  );
  const pendingTadaCount = Number(
    hrKpis?.pendingTadaClaims ??
      pendingCounts?.tadaPending ??
      pendingExpenses.length,
  );
  const autoInactivatedCount = Number(hrKpis?.autoInactivatedPending ?? 0);
  const lateCheckInsCount = Number(hrKpis?.lateCheckInsToday ?? 0);

  const todayDate = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <PortalLayout portalRole={Role.HRManager}>
      <PageHeader
        title="HR Manager Dashboard"
        subtitle={`Krishkar Pharmaceuticals — ${todayDate}`}
        actions={
          <NotificationInbox
            token={token}
            portalType="hr"
            onNavigate={(_entityType, entityId) => {
              void entityId;
            }}
          />
        }
      />
      <PageContent>
        {/* Expiring Additional Charges Banner */}
        {visibleExpiringCharges.length > 0 && (
          <div className="mb-4 bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0" />
              <span className="text-sm font-medium text-orange-700">
                {visibleExpiringCharges.length} charge
                {visibleExpiringCharges.length > 1 ? "s" : ""} expiring soon
              </span>
              <a
                href="/hr/additional-charges"
                className="ml-auto text-xs text-orange-600 underline hover:text-orange-800"
              >
                View All Charges →
              </a>
            </div>
            {visibleExpiringCharges.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-2 bg-orange-100/50 rounded px-3 py-1.5"
                data-ocid={`expiry-banner-charge-${c.id}`}
              >
                <span className="text-xs text-orange-700">
                  <strong>{c.empName}</strong> —{" "}
                  {c.additionalRole ?? c.additionalArea} expires on{" "}
                  {new Date(
                    Number(c.effectiveTo) / 1_000_000,
                  ).toLocaleDateString("en-IN")}
                </span>
                <button
                  type="button"
                  aria-label="Dismiss"
                  onClick={() => dismissCharge(c.id)}
                  className="text-orange-500 hover:text-orange-700 flex-shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Birthday Flash */}
        <BirthdayFlash
          birthdays={birthdayData.todaysBirthdays}
          doctorBirthdays={birthdayData.doctorBirthdaysToday}
          currentUserId={currentUserId}
          isOwnBirthday={birthdayData.isCurrentUserBirthday}
        />

        <OnLeaveBanner />

        {/* Dashboard load error */}
        {loadError && (
          <div
            className="flex items-center gap-3 mb-4 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/30"
            data-ocid="hr-dashboard.error_state"
          >
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
            <p className="text-sm text-destructive flex-1">
              Failed to load dashboard data.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="text-xs font-semibold text-destructive underline underline-offset-2 hover:opacity-80"
            >
              Retry
            </button>
          </div>
        )}

        {/* HR KPI Cards section header */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground">
            HR KPIs — Live
          </h2>
          <button
            type="button"
            onClick={kpiRefresh}
            disabled={kpiLoading}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            data-ocid="hr-dashboard.kpi-refresh"
          >
            <RefreshCw
              className={`w-3 h-3 ${kpiLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>

        {/* HR KPI Cards */}
        <div
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6"
          data-ocid="hr-dashboard.kpi-grid"
        >
          <KpiCard
            title="Active Employees"
            value={
              loading
                ? "…"
                : Number(hrKpis?.totalActiveEmployees ?? activeCount)
            }
            target={loading ? undefined : employees.length || undefined}
            icon={<UserCheck className="w-4 h-4" />}
            accentColor="#0EA5E9"
            subtitle={`of ${loading ? "…" : employees.length} enrolled`}
          />
          <KpiCard
            title="On Leave Today"
            value={loading ? "…" : Number(hrKpis?.employeesOnLeaveToday ?? 0)}
            icon={<CalendarDays className="w-4 h-4" />}
            accentColor="#06B6D4"
            subtitle="approved leaves active"
          />
          <KpiCard
            title="Pending Leaves"
            value={loading ? "…" : pendingLeaveCount}
            icon={<FileText className="w-4 h-4" />}
            accentColor={pendingLeaveCount > 0 ? "#F97316" : "#10B981"}
            subtitle="awaiting approval"
          />
          <KpiCard
            title="Pending TA/DA"
            value={loading ? "…" : pendingTadaCount}
            icon={<Receipt className="w-4 h-4" />}
            accentColor={pendingTadaCount > 0 ? "#F97316" : "#10B981"}
            subtitle="claims to process"
          />
          <KpiCard
            title="Late Check-Ins"
            value={loading ? "…" : lateCheckInsCount}
            icon={<Clock className="w-4 h-4" />}
            accentColor={lateCheckInsCount > 0 ? "#F97316" : "#10B981"}
            subtitle="today"
          />
          <KpiCard
            title="Auto-Inactivated"
            value={loading ? "…" : autoInactivatedCount}
            icon={<UserMinus className="w-4 h-4" />}
            accentColor={autoInactivatedCount > 0 ? "#EF4444" : "#10B981"}
            subtitle="pending reactivation"
          />
          <KpiCard
            title="Upcoming Birthdays"
            value={loading ? "…" : birthdayData.upcomingBirthdays.length}
            icon={<Bell className="w-4 h-4" />}
            accentColor="#8B5CF6"
            subtitle="next 7 days"
          />
          <KpiCard
            title="Total Employees"
            value={loading ? "…" : employees.length}
            icon={<Users className="w-4 h-4" />}
            accentColor="#64748B"
            subtitle="all enrolled"
          />
        </div>

        {/* Attendance Summary Widget */}
        <Card
          className="p-4 mb-6 bg-card border border-border"
          data-ocid="hr-dashboard.attendance-summary"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs uppercase tracking-wider font-display font-semibold text-muted-foreground flex items-center gap-1.5">
              <MapPinCheck className="w-3.5 h-3.5 text-primary" />
              Attendance Summary — Today
            </h3>
            <span className="text-[10px] text-muted-foreground">
              As of{" "}
              {new Date().toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: "Checked In",
                value:
                  Number(hrKpis?.totalActiveEmployees ?? activeCount) -
                  Number(hrKpis?.employeesOnLeaveToday ?? 0),
                color: "text-emerald-600",
                bg: "bg-emerald-50 border-emerald-200",
                ocid: "hr-dashboard.attendance.checked-in",
              },
              {
                label: "Absent",
                value: 0,
                color: "text-red-600",
                bg: "bg-red-50 border-red-200",
                ocid: "hr-dashboard.attendance.absent",
              },
              {
                label: "On Leave",
                value: Number(hrKpis?.employeesOnLeaveToday ?? 0),
                color: "text-orange-600",
                bg: "bg-orange-50 border-orange-200",
                ocid: "hr-dashboard.attendance.on-leave",
              },
              {
                label: "Not Yet Checked In",
                value: 0,
                color: "text-sky-600",
                bg: "bg-sky-50 border-sky-200",
                ocid: "hr-dashboard.attendance.pending-checkin",
              },
            ].map((item) => (
              <div
                key={item.label}
                className={`rounded-lg border px-3 py-2.5 ${item.bg}`}
                data-ocid={item.ocid}
              >
                <p className={`text-2xl font-bold font-display ${item.color}`}>
                  {loading ? "—" : item.value}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </Card>

        {/* Pending Actions + Recent Activity row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <PendingActionsWidget
            title="Pending HR Actions"
            items={[
              {
                label: "Leave Approvals",
                count: pendingLeaveCount,
                urgency: "high",
                onClick: () => window.location.assign("/hr/leaves"),
              },
              {
                label: "TA/DA Processing",
                count: pendingTadaCount,
                urgency: "high",
                onClick: () => window.location.assign("/hr/expenses"),
              },
              {
                label: "Account Reactivations",
                count: autoInactivatedCount,
                urgency: "high",
                onClick: () => window.location.assign("/hr/absence-audit"),
              },
              {
                label: "Profile Updates Pending Review",
                count: 0,
                urgency: "medium",
                onClick: () => window.location.assign("/hr/employees"),
              },
            ]}
          />

          {/* Recent Activity Log */}
          <Card
            className="p-4 bg-card border border-border"
            data-ocid="hr-dashboard.recent-activity"
          >
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
              <History className="w-4 h-4 text-muted-foreground" />
              Recent HR Activity
            </h3>
            {recentActivity.length === 0 ? (
              <p
                className="text-xs text-muted-foreground text-center py-4"
                data-ocid="hr-dashboard.recent-activity.empty_state"
              >
                No recent activity to display
              </p>
            ) : (
              <ul
                className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin"
                data-ocid="hr-dashboard.recent-activity.list"
              >
                {recentActivity.map((n, idx) => (
                  <li
                    key={n.id}
                    className="flex items-start gap-2.5 py-1.5 border-b border-border last:border-0"
                    data-ocid={`hr-dashboard.recent-activity.item.${idx + 1}`}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground leading-snug truncate">
                        {n.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                        {n.body}
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0 whitespace-nowrap">
                      {formatDateTime(n.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Module cards */}
        <div className="mb-6">
          <h2 className="text-xs uppercase tracking-wider font-display text-muted-foreground mb-3">
            HR Modules
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {MODULES.map((mod) => (
              <Link
                key={mod.label}
                to={mod.to}
                className="bg-card border border-border rounded-lg p-4 hover:border-primary transition-colors group block"
                data-ocid={`hr-module-${mod.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <mod.icon className={`w-5 h-5 ${mod.color} mb-2`} />
                <p className="font-display font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                  {mod.label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 font-body">
                  {mod.desc}
                </p>
              </Link>
            ))}
          </div>
        </div>

        {/* Upcoming Birthdays Widget */}
        <div className="mt-4">
          <UpcomingBirthdaysWidget
            upcoming={birthdayData.upcomingBirthdays}
            upcomingDoctors={birthdayData.doctorBirthdaysToday}
            loading={birthdayData.loadingUpcoming}
            onViewAll={() => window.location.assign("/hr/birthday-calendar")}
          />
        </div>

        {/* HR's own Personal TA/DA */}
        <div className="bg-card border border-border rounded-lg p-5 mt-4">
          <PersonalTaDaForm roleLabel="HR" />
        </div>
      </PageContent>
    </PortalLayout>
  );
}
