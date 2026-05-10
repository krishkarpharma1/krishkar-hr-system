import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  BarChart2,
  Bell,
  BookOpen,
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  Download,
  FileText,
  Gift,
  GitBranch,
  HandCoins,
  HeartPulse,
  History,
  IdCard,
  Info,
  Layers,
  MapPin,
  Package,
  PackageSearch,
  Percent,
  RefreshCw,
  RotateCcw,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Target,
  TrendingUp,
  UserCheck,
  UserMinus,
  UserX,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Role, UserStatus } from "../../backend";
import { BirthdayFlash } from "../../components/BirthdayFlash";
import { KpiCard } from "../../components/KpiCard";
import { NotificationInbox } from "../../components/NotificationInbox";
import { OnLeaveBanner } from "../../components/OnLeaveBanner";
import {
  DataTable,
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { UpcomingBirthdaysWidget } from "../../components/UpcomingBirthdaysWidget";
import { useBirthdays } from "../../hooks/useBirthdays";
import { useDashboardData } from "../../hooks/useDashboardData";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import type {
  AdditionalCharge,
  AdminKpis,
  SystemAlert,
  UserInfo,
} from "../../types";
import { ROLE_LABELS } from "../../types";
import { formatDateTime } from "../../utils/dateFormatter";
import AbsenceSettingsSection from "../hr/AbsenceSettingsSection";
import PersonalTaDaForm from "../shared/PersonalTaDaForm";

const ROLE_COLORS: Record<string, string> = {
  Admin: "bg-primary/20 text-primary border-primary/30",
  HRManager: "bg-accent/20 text-accent border-accent/30",
  ZSM: "bg-chart-3/20 text-chart-3 border-chart-3/30",
  RSM: "bg-chart-4/20 text-chart-4 border-chart-4/30",
  ASM: "bg-chart-1/20 text-chart-1 border-chart-1/30",
  MR: "bg-muted text-muted-foreground border-border",
};

// Quick config items for the Admin Dashboard shortcuts
const QUICK_CONFIG_ITEMS = [
  {
    label: "Product Master",
    icon: PackageSearch,
    to: "/admin/product-master",
    ocid: "admin-config.product-master",
  },
  {
    label: "Sample Allocation",
    icon: Layers,
    to: "/admin/sample-allocation",
    ocid: "admin-config.sample-allocation",
  },
  {
    label: "Monthly Targets",
    icon: Target,
    to: "/admin/monthly-targets",
    ocid: "admin-config.monthly-targets",
  },
  {
    label: "Late Check-In Settings",
    icon: Clock,
    to: "/admin/gps-settings",
    ocid: "admin-config.late-checkin-settings",
  },
  {
    label: "Absence Threshold",
    icon: UserMinus,
    to: "/admin/absence-audit",
    ocid: "admin-config.absence-settings",
  },
  {
    label: "Holiday Calendar",
    icon: Calendar,
    to: "/admin/leave-quota",
    ocid: "admin-config.holiday-calendar",
  },
  {
    label: "Location Master",
    icon: MapPin,
    to: "/admin/location-master",
    ocid: "admin-config.location-master",
  },
  {
    label: "Notification Settings",
    icon: Bell,
    to: "/admin/notification-settings",
    ocid: "admin-config.notification-settings",
  },
  {
    label: "Document Header/Footer",
    icon: FileText,
    to: "/admin/document-config",
    ocid: "admin-config.doc-header-footer",
  },
];

// Full quick links (existing) for below the dashboard
const ALL_QUICK_LINKS = [
  {
    label: "DCR Edit Requests",
    icon: FileText,
    to: "/admin/dcr-edit-requests",
    desc: "Approve or reject MR requests to edit submitted DCRs",
  },
  {
    label: "Attendance Corrections",
    icon: CheckCircle,
    to: "/admin/attendance-corrections",
    desc: "Review auto-checkout attendance correction requests",
  },
  {
    label: "Sample Ledger",
    icon: Package,
    to: "/admin/sample-ledger",
    desc: "Consolidated sample issuance and return ledger",
  },
  {
    label: "Stockist Master",
    icon: Building2,
    to: "/admin/stockist-master",
    desc: "Manage stockists and territory assignments",
  },
  {
    label: "Leave Management",
    icon: Calendar,
    to: "/admin/leave-management",
    desc: "All leave applications including HR",
  },
  {
    label: "User Management",
    icon: Users,
    to: "/admin/users",
    desc: "Create & manage staff accounts",
  },
  {
    label: "GPS Live Map",
    icon: MapPin,
    to: "/admin/locations",
    desc: "Live field staff locations",
  },
  {
    label: "GPS Trail Viewer",
    icon: Activity,
    to: "/hr/gps-trail",
    desc: "Staff movement history by day",
  },
  {
    label: "Product Pricelist",
    icon: Download,
    to: "/shared/pricelist",
    desc: "View & download current product pricelist",
  },
  {
    label: "Reports & Approvals",
    icon: FileText,
    to: "/admin/reports",
    desc: "Leaves, expenses, call reports",
  },
  {
    label: "Product Master",
    icon: PackageSearch,
    to: "/admin/products",
    desc: "Manage pharmaceutical products",
  },
  {
    label: "Product Master (SFA)",
    icon: PackageSearch,
    to: "/admin/product-master",
    desc: "Full product catalogue with code, MRP, pack size",
  },
  {
    label: "Sample Allocation",
    icon: Layers,
    to: "/admin/sample-allocation",
    desc: "Allocate samples to MRs by month",
  },
  {
    label: "Location Master",
    icon: Layers,
    to: "/admin/location-master",
    desc: "Zone → State → Territory → HQ → Area",
  },
  {
    label: "Station Master",
    icon: MapPin,
    to: "/admin/station-master",
    desc: "Manage stations linked to each HQ",
  },
  {
    label: "DA Configuration",
    icon: Percent,
    to: "/admin/da-config",
    desc: "Role-wise Daily Allowance rates",
  },
  {
    label: "Leave Quota Config",
    icon: Calendar,
    to: "/admin/leave-quota",
    desc: "Per-role leave entitlements (Casual, Sick, Un-Paid)",
  },
  {
    label: "Role Hierarchy",
    icon: GitBranch,
    to: "/admin/role-hierarchy",
    desc: "Configure 'Working With' authority order",
  },
  {
    label: "Gift Article Master",
    icon: Gift,
    to: "/admin/gift-article-master",
    desc: "Manage gift articles for Doctor Call Entry",
  },
  {
    label: "Booking Requests",
    icon: PackageSearch,
    to: "/admin/booking",
    desc: "Approve sample & gift article requests",
  },
  {
    label: "Monthly Targets",
    icon: Target,
    to: "/admin/monthly-targets",
    desc: "Set & manage monthly sales targets for field staff",
  },
  {
    label: "Additional Charges",
    icon: UserCheck,
    to: "/admin/additional-charges",
    desc: "Assign temporary roles or areas to employees",
  },
  {
    label: "Target History",
    icon: History,
    to: "/admin/targets/history",
    desc: "Audit log of all target changes",
  },
  {
    label: "Target vs. Actual",
    icon: TrendingUp,
    to: "/admin/target-performance",
    desc: "Team performance vs targets",
  },
  {
    label: "Incentive Plans",
    icon: Gift,
    to: "/admin/incentive-plans",
    desc: "Configure role-wise incentive slabs",
  },
  {
    label: "Incentive Management",
    icon: Percent,
    to: "/admin/incentives",
    desc: "View, approve & export incentives",
  },
  {
    label: "Employee ID Config",
    icon: IdCard,
    to: "/admin/employee-id-config",
    desc: "Configure UID format (KP-2026-001) and legacy IDs",
  },
  {
    label: "Clean Trial Data",
    icon: ShieldAlert,
    to: "/admin/clean-trial-data",
    desc: "Erase test data before final launch",
  },
  {
    label: "Cleanup Audit Log",
    icon: History,
    to: "/admin/data-cleanup-history",
    desc: "Read-only record of all cleanup actions",
  },
  {
    label: "System Health",
    icon: HeartPulse,
    to: "/admin/system-health",
    desc: "Startup anomaly detection and data integrity monitoring",
  },
  {
    label: "GPS Settings",
    icon: ShieldCheck,
    to: "/admin/gps-settings",
    desc: "GPS enforcement toggle and per-employee override exceptions",
  },
  {
    label: "Export & Reports",
    icon: Download,
    to: "/admin/export",
    desc: "Download Excel exports for all data",
  },
  {
    label: "Message Popup",
    icon: Bell,
    to: "/admin/messages",
    desc: "Manage daily first-login notifications",
  },
  {
    label: "Notification Settings",
    icon: Bell,
    to: "/admin/notification-settings",
    desc: "Doctor Call notifications, cascade levels, quiet hours",
  },
  {
    label: "Company Profile",
    icon: Building2,
    to: "/admin/company-profile",
    desc: "Logo, address and branding for all reports",
  },
  {
    label: "Expense Claim Summary",
    icon: HandCoins,
    to: "/admin/expense-claim-summary",
    desc: "Total claimed per MR vs. field activity for any period",
  },
  {
    label: "Document Config",
    icon: FileText,
    to: "/admin/document-config",
    desc: "PDF header/footer, logo, confidentiality notice",
  },
  {
    label: "Official Letters",
    icon: FileText,
    to: "/admin/official-letters",
    desc: "Create & print company letterhead letters",
  },
  {
    label: "System Activity",
    icon: BarChart2,
    to: "/admin/users",
    desc: "Audit trail & system stats",
  },
  {
    label: "Personal TA/DA",
    icon: HandCoins,
    to: "/admin/personal-tada",
    desc: "Submit your own travel and daily allowance claims",
  },
  {
    label: "Absence Audit Trail",
    icon: UserMinus,
    to: "/admin/absence-audit",
    desc: "Auto-inactivation and reactivation event log",
  },
  {
    label: "DCR Summary",
    icon: BarChart2,
    to: "/admin/sfa/dcr-summary",
    desc: "Date-wise DCR status for all MRs",
  },
  {
    label: "MTP vs Actual",
    icon: TrendingUp,
    to: "/admin/sfa/mtp-vs-actual",
    desc: "Planned vs. actual tour schedule comparison",
  },
  {
    label: "Doctor-Product Coverage",
    icon: FileText,
    to: "/admin/sfa/doctor-product-coverage",
    desc: "Products detailed per doctor and frequency",
  },
  {
    label: "Chemist/Stockist Coverage",
    icon: Activity,
    to: "/admin/sfa/chemist-coverage",
    desc: "Visit coverage broken down by station",
  },
  {
    label: "Sample Balance Report",
    icon: Layers,
    to: "/admin/sfa/sample-balance",
    desc: "Opening allocation, used, and remaining per MR",
  },
  {
    label: "JFW Summary",
    icon: Clock,
    to: "/admin/sfa/jfw-summary",
    desc: "Joint field work entries with ratings",
  },
];

// Severity to Tailwind classes
function alertSeverityClass(severity: string): {
  border: string;
  bg: string;
  icon: string;
  text: string;
} {
  switch (severity) {
    case "error":
      return {
        border: "border-red-300",
        bg: "bg-red-50",
        icon: "text-red-600",
        text: "text-red-800",
      };
    case "warning":
      return {
        border: "border-orange-300",
        bg: "bg-orange-50",
        icon: "text-orange-600",
        text: "text-orange-800",
      };
    default:
      return {
        border: "border-sky-300",
        bg: "bg-sky-50",
        icon: "text-sky-600",
        text: "text-sky-800",
      };
  }
}

function AlertIcon({ severity }: { severity: string }) {
  if (severity === "error") return <AlertTriangle className="w-4 h-4" />;
  if (severity === "warning") return <AlertTriangle className="w-4 h-4" />;
  return <Info className="w-4 h-4" />;
}

export default function AdminPortal() {
  const { session } = useAuthStore();
  const birthdayData = useBirthdays();
  const currentUserId = String(session?.userId ?? "");
  const token = session?.token ?? "";

  const [users, setUsers] = useState<UserInfo[]>([]);
  const [systemAlerts, setSystemAlerts] = useState<SystemAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsError, setAlertsError] = useState(false);
  const [expiringCharges, setExpiringCharges] = useState<
    (AdditionalCharge & { empName?: string })[]
  >([]);
  const [dismissedChargeIds, setDismissedChargeIds] = useState<Set<string>>(
    () => {
      const stored = sessionStorage.getItem("admin_dismissed_charge_ids");
      return new Set(stored ? JSON.parse(stored) : []);
    },
  );
  const [loading, setLoading] = useState(true);

  // Phase-3 dashboard data
  const {
    data: dashData,
    loading: kpiLoading,
    refresh: kpiRefresh,
  } = useDashboardData(token);

  const adminKpis: AdminKpis | null =
    dashData?.__kind__ === "admin" ? dashData.admin : null;

  useEffect(() => {
    if (!session?.token) return;
    Promise.all([
      api.listAllUsers(session.token),
      api.listAllAdditionalCharges(session.token, { activeOnly: true }),
    ])
      .then(([u, allCharges]) => {
        setUsers(u);
        const empMap = new Map(u.map((e) => [e.id, e.name]));
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
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [session?.token]);

  // Fetch system alerts
  async function fetchAlerts() {
    if (!token) return;
    setAlertsLoading(true);
    setAlertsError(false);
    try {
      const alerts = await api.getSystemAlerts(token);
      setSystemAlerts(alerts);
    } catch {
      setAlertsError(true);
    } finally {
      setAlertsLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    setAlertsLoading(true);
    setAlertsError(false);
    api
      .getSystemAlerts(token)
      .then(setSystemAlerts)
      .catch(() => setAlertsError(true))
      .finally(() => setAlertsLoading(false));
  }, [token]);

  function dismissCharge(id: string) {
    setDismissedChargeIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      sessionStorage.setItem(
        "admin_dismissed_charge_ids",
        JSON.stringify([...next]),
      );
      return next;
    });
  }

  const visibleExpiringCharges = expiringCharges.filter(
    (c) => !dismissedChargeIds.has(c.id),
  );

  const total = users.length;
  const active = users.filter((u) => u.status === UserStatus.Active).length;
  const inactive = users.filter((u) => u.status === UserStatus.Inactive).length;
  const mrs = users.filter((u) => u.role === Role.MR).length;

  const roleCounts = Object.values(Role).map((r) => ({
    role: r,
    count: users.filter((u) => u.role === r).length,
  }));

  const recentUsers = [...users]
    .sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
    .slice(0, 8);

  const cols = [
    { key: "empId", label: "Employee UID" },
    { key: "name", label: "Name" },
    { key: "role", label: "Role" },
    { key: "designation", label: "Designation" },
    { key: "dept", label: "Department" },
    { key: "status", label: "Status" },
    { key: "joined", label: "Joined" },
  ];

  const totalPending = Number(adminKpis?.totalPendingApprovals ?? 0);
  const autoInactivated = Number(adminKpis?.autoInactivatedPending ?? 0);

  return (
    <PortalLayout portalRole={Role.Admin}>
      <PageHeader
        title="Admin Dashboard"
        subtitle="Krishkar Pharmaceuticals — System Overview"
        actions={
          <NotificationInbox
            token={token}
            portalType="admin"
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
                href="/admin/additional-charges"
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

        {/* ── SYSTEM-WIDE KPI OVERVIEW ─────────────────────────────────── */}
        <div
          className="flex items-center justify-between mb-3"
          data-ocid="admin-dashboard.kpi-header"
        >
          <h2 className="text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground">
            System-Wide KPIs — Live
          </h2>
          <button
            type="button"
            onClick={kpiRefresh}
            disabled={kpiLoading}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            data-ocid="admin-dashboard.kpi-refresh"
          >
            <RefreshCw
              className={`w-3 h-3 ${kpiLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>

        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4"
          data-ocid="admin-dashboard.kpi-grid"
        >
          <KpiCard
            title="Total Active Users"
            value={
              loading
                ? "…"
                : kpiLoading
                  ? "…"
                  : Number(adminKpis?.totalActiveUsers ?? active)
            }
            target={loading ? undefined : total || undefined}
            icon={<UserCheck className="w-4 h-4" />}
            accentColor="#0EA5E9"
            subtitle={`of ${loading ? "…" : total} enrolled`}
          />
          <KpiCard
            title="Doctor Calls Today"
            value={kpiLoading ? "…" : Number(adminKpis?.doctorCallsToday ?? 0)}
            icon={<Activity className="w-4 h-4" />}
            accentColor="#06B6D4"
            subtitle={`${kpiLoading ? "…" : Number(adminKpis?.doctorCallsThisMonth ?? 0)} this month`}
          />
          <KpiCard
            title="Chemist Visits Today"
            value={
              kpiLoading ? "…" : Number(adminKpis?.chemistVisitsToday ?? 0)
            }
            icon={<Users className="w-4 h-4" />}
            accentColor="#10B981"
            subtitle={`${kpiLoading ? "…" : Number(adminKpis?.chemistVisitsThisMonth ?? 0)} this month`}
          />
          <KpiCard
            title="Attendance Rate"
            value={
              kpiLoading
                ? "…"
                : `${Math.round((adminKpis?.attendanceRateToday ?? 0) * 100) / 100}%`
            }
            target={100}
            progressBar={!kpiLoading}
            icon={<MapPin className="w-4 h-4" />}
            accentColor="#8B5CF6"
            subtitle="today"
          />
          <KpiCard
            title="Total Pending Approvals"
            value={kpiLoading ? "…" : totalPending}
            icon={<FileText className="w-4 h-4" />}
            accentColor={totalPending > 0 ? "#F97316" : "#10B981"}
            subtitle="across all roles"
          />
          <KpiCard
            title="Auto-Inactivated Pending"
            value={kpiLoading ? "…" : autoInactivated}
            icon={<UserX className="w-4 h-4" />}
            accentColor={autoInactivated > 0 ? "#EF4444" : "#10B981"}
            subtitle="requires reactivation"
          />
          <KpiCard
            title="Inactive Users"
            value={loading ? "…" : inactive}
            icon={<UserMinus className="w-4 h-4" />}
            accentColor="#64748B"
            subtitle="all time"
          />
          <KpiCard
            title="Field MRs"
            value={loading ? "…" : mrs}
            icon={<MapPin className="w-4 h-4" />}
            accentColor="#0284C7"
            subtitle="active field force"
          />
        </div>

        {/* Users by Role pills */}
        <div
          className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6"
          data-ocid="admin-dashboard.role-distribution"
        >
          {roleCounts.map(({ role, count }) => (
            <div
              key={role}
              className="bg-card border border-border rounded-lg px-4 py-3 flex items-center justify-between"
              data-ocid={`admin-dashboard.role-count.${role.toLowerCase()}`}
            >
              <span className="text-sm font-display text-muted-foreground">
                {ROLE_LABELS[role]}
              </span>
              <span className="font-display font-bold text-lg text-foreground">
                {count}
              </span>
            </div>
          ))}
        </div>

        {/* ── QUICK CONFIG ACCESS ──────────────────────────────────────── */}
        <h2 className="text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Quick Configuration
        </h2>
        <div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6"
          data-ocid="admin-dashboard.quick-config"
        >
          {QUICK_CONFIG_ITEMS.map((item) => (
            <a
              key={item.label}
              href={item.to}
              data-ocid={item.ocid}
              className="bg-card border border-border rounded-xl p-3 flex flex-col items-start gap-2 hover:bg-primary/5 hover:border-primary/40 transition-colors group"
            >
              <div className="p-1.5 rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors">
                <item.icon className="w-4 h-4 text-primary" />
              </div>
              <span className="text-xs font-display font-medium text-foreground leading-tight">
                {item.label}
              </span>
            </a>
          ))}
          {/* Settings shortcut */}
          <a
            href="/admin/company-profile"
            data-ocid="admin-config.company-settings"
            className="bg-card border border-border rounded-xl p-3 flex flex-col items-start gap-2 hover:bg-primary/5 hover:border-primary/40 transition-colors group"
          >
            <div className="p-1.5 rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors">
              <Settings className="w-4 h-4 text-primary" />
            </div>
            <span className="text-xs font-display font-medium text-foreground leading-tight">
              Company Settings
            </span>
          </a>
        </div>

        {/* ── REAL-TIME ALERT PANEL ──────────────────────────────────────── */}
        <Card
          className="p-4 mb-6 bg-card border border-border"
          data-ocid="admin-dashboard.alert-panel"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs uppercase tracking-wider font-display font-semibold text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
              System Alerts
            </h3>
            <button
              type="button"
              onClick={() => void fetchAlerts()}
              disabled={alertsLoading}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              data-ocid="admin-dashboard.alerts-refresh"
            >
              <RefreshCw
                className={`w-3 h-3 ${alertsLoading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>

          {alertsError ? (
            <div
              className="flex items-center gap-2 py-3"
              data-ocid="admin-dashboard.alert-panel.error_state"
            >
              <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
              <p className="text-xs text-destructive flex-1">
                Could not load alerts.
              </p>
              <button
                type="button"
                onClick={() => void fetchAlerts()}
                className="text-xs font-medium text-destructive underline"
                data-ocid="admin-dashboard.alerts-retry"
              >
                Retry
              </button>
            </div>
          ) : alertsLoading ? (
            <div
              className="space-y-2"
              data-ocid="admin-dashboard.alert-panel.loading_state"
            >
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-12 rounded-lg bg-muted/60 animate-pulse"
                />
              ))}
            </div>
          ) : systemAlerts.length === 0 ? (
            <div
              className="flex items-center gap-2 py-3 text-emerald-600"
              data-ocid="admin-dashboard.alert-panel.empty_state"
            >
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <p className="text-sm font-medium">All systems normal</p>
            </div>
          ) : (
            <div
              className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin"
              data-ocid="admin-dashboard.alert-panel.list"
            >
              {systemAlerts.map((alert, idx) => {
                const cls = alertSeverityClass(alert.severity);
                return (
                  <div
                    key={String(alert.alertId)}
                    className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${cls.border} ${cls.bg}`}
                    data-ocid={`admin-dashboard.alert-panel.item.${idx + 1}`}
                  >
                    <span className={`flex-shrink-0 mt-0.5 ${cls.icon}`}>
                      <AlertIcon severity={alert.severity} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-xs font-medium leading-snug ${cls.text}`}
                      >
                        {alert.message}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formatDateTime(alert.createdAt)} · {alert.alertType}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Upcoming Birthdays Widget */}
        <div className="mb-6">
          <UpcomingBirthdaysWidget
            upcoming={birthdayData.upcomingBirthdays}
            upcomingDoctors={birthdayData.doctorBirthdaysToday}
            loading={birthdayData.loadingUpcoming}
            onViewAll={() => window.location.assign("/admin/birthday-calendar")}
          />
        </div>

        {/* ── ALL QUICK LINKS ────────────────────────────────────────────── */}
        <h2 className="text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          All Admin Functions
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {ALL_QUICK_LINKS.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              data-ocid={`admin-quicklink-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              className="bg-card border border-border rounded-lg p-4 flex flex-col gap-1.5 hover:bg-muted/30 transition-colors group"
            >
              <item.icon className="w-5 h-5 text-primary group-hover:text-primary/80" />
              <span className="text-sm font-display font-medium text-foreground">
                {item.label}
              </span>
              <span className="text-xs text-muted-foreground font-body">
                {item.desc}
              </span>
            </Link>
          ))}
        </div>

        {/* Recently Added Employees */}
        <div className="mb-2 flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-display font-semibold text-muted-foreground uppercase tracking-wider">
            Recently Added Employees
          </h2>
        </div>
        <DataTable
          columns={cols}
          data={recentUsers}
          getKey={(u) => String(u.id)}
          loading={loading}
          emptyMessage="No employees found"
          renderRow={(u) => (
            <>
              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                {u.employeeId}
              </td>
              <td className="px-4 py-3 font-body text-foreground font-medium">
                {u.name}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`text-xs px-2 py-0.5 rounded border font-display ${ROLE_COLORS[u.role] ?? "bg-muted text-muted-foreground border-border"}`}
                >
                  {u.role}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-foreground">
                {u.designation}
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">
                {u.department}
              </td>
              <td className="px-4 py-3">
                <Badge
                  variant={
                    u.status === UserStatus.Active ? "default" : "secondary"
                  }
                  className="text-xs"
                >
                  {u.status}
                </Badge>
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                {u.joinDate}
              </td>
            </>
          )}
        />

        {/* Admin's own Personal TA/DA */}
        <div className="bg-card border border-border rounded-lg p-5 mt-6">
          <PersonalTaDaForm roleLabel="Admin" />
        </div>

        {/* Absence Auto-Inactivation Settings */}
        <div className="mt-6">
          <AbsenceSettingsSection />
        </div>
      </PageContent>
    </PortalLayout>
  );
}
