import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  ArrowLeftRight,
  BarChart2,
  BookOpen,
  Briefcase,
  Calendar,
  CheckCircle,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  MapPin,
  Package,
  RefreshCw,
  Stethoscope,
  Target,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { ChargeType, Role } from "../../backend";
import { BirthdayFlash } from "../../components/BirthdayFlash";
import { DoctorVisitTrendChart } from "../../components/DoctorVisitTrendChart";
import { GPSMap } from "../../components/GPSMap";
import type { EnrichedMarker } from "../../components/GPSMap";
import { KpiCard } from "../../components/KpiCard";
import { MissedVisitAlerts } from "../../components/MissedVisitAlerts";
import { MrActivityTable } from "../../components/MrActivityTable";
import { MrDoctorVisitWidget } from "../../components/MrDoctorVisitWidget";
import { NotificationInbox } from "../../components/NotificationInbox";
import { OnLeaveBanner } from "../../components/OnLeaveBanner";
import { PendingActionsWidget } from "../../components/PendingActionsWidget";
import type { PendingActionItem } from "../../components/PendingActionsWidget";
import {
  DataTable,
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { QuickActionsBar } from "../../components/QuickActionsBar";
import type { QuickAction } from "../../components/QuickActionsBar";
import { UpcomingBirthdaysWidget } from "../../components/UpcomingBirthdaysWidget";
import { useBirthdays } from "../../hooks/useBirthdays";
import { useDashboardData } from "../../hooks/useDashboardData";
import { usePendingCounts } from "../../hooks/usePendingCounts";
// useRsmDirectMrs and useRsmMrMode removed (V77-V82 rollback)
import { useTeamActivity } from "../../hooks/useTeamActivity";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import type {
  LeaveApplication,
  MrMonthlySummary,
  RsmKpis,
  TaDaExpense,
  TravelPlanInfo,
  UserInfo,
  DashboardAggregates as _DashboardAggregates,
} from "../../types";
import type { AdditionalCharge } from "../../types";
import BusinessReporting from "../crm/BusinessReporting";
import CrmRequests from "../crm/CrmRequests";
import SalesDashboard from "../crm/SalesDashboard";
import AdditionalRoleTab from "../shared/AdditionalRoleTab";
import BirthdayCalendarPage from "../shared/BirthdayCalendarPage";
import BookingManagement from "../shared/BookingManagement";
import DcrApproval from "../shared/DcrApproval";
import LeaveApprovalPanel from "../shared/LeaveApprovalPanel";
import MRPortalPanel from "../shared/MRPortalPanel";
import MtpApproval from "../shared/MtpApproval";
import PersonalTaDaForm from "../shared/PersonalTaDaForm";
import RSMMonthlyTargets from "./RSMMonthlyTargets";
// RsmMrModeDashboard removed (V77-V82 rollback)

// ASM group for hierarchy display
interface AsmMrGroup {
  asmId: bigint;
  asmName: string;
  mrs: Array<{ mrId: bigint; mrName: string }>;
}

type TabId =
  | "dashboard"
  | "team"
  | "gps"
  | "expenses"
  | "leaves"
  | "reports"
  | "travel-plans"
  | "dcr-approvals"
  | "mtp-approvals"
  | "direct-mr-reports"
  | "crm-requests"
  | "business-reports"
  | "sales-dashboard"
  | "booking"
  | "monthly-targets"
  | "birthday-calendar";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

// ─── Dashboard Action Button ───────────────────────────────────────────────
interface DashActionBtn {
  id: string;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Tailwind bg+hover classes for the button e.g. "bg-sky-600 hover:bg-sky-700" */
  colorClass: string;
  tabTarget?: TabId;
  href?: string;
  pendingCount?: number;
  checkedIn?: boolean;
}

interface DashButtonProps {
  btn: DashActionBtn;
  onClick: () => void;
}

function DashButton({ btn, onClick }: DashButtonProps) {
  const Icon = btn.icon;
  const hasBadge = typeof btn.pendingCount === "number" && btn.pendingCount > 0;
  const isCheckedIn = btn.checkedIn === true;

  return (
    <button
      type="button"
      onClick={onClick}
      data-ocid={`dashboard-btn-${btn.id}`}
      className={`relative flex flex-col items-start gap-2 p-5 rounded-2xl text-white font-semibold transition-all duration-200 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white/30 w-full min-h-[120px] ${btn.colorClass}`}
      aria-label={btn.label}
    >
      {/* Status badges top-right */}
      {hasBadge && (
        <span
          className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold rounded-full min-w-[22px] h-[22px] flex items-center justify-center px-1.5 shadow-lg"
          data-ocid={`dashboard-badge-${btn.id}`}
        >
          {btn.pendingCount}
        </span>
      )}
      {isCheckedIn && !hasBadge && (
        <span
          className="absolute top-3 right-3 bg-green-400 text-white text-[10px] font-bold rounded-full flex items-center gap-0.5 px-2 py-0.5 shadow"
          data-ocid={`dashboard-checkedin-${btn.id}`}
        >
          <CheckCircle2 className="w-3 h-3" /> In
        </span>
      )}

      {/* Icon */}
      <div className="rounded-xl bg-white/20 p-2 flex-shrink-0">
        <Icon className="w-7 h-7" />
      </div>

      {/* Label + subtitle */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold leading-tight truncate">{btn.label}</p>
        <p className="text-xs opacity-80 leading-snug mt-0.5 line-clamp-2">
          {btn.subtitle}
        </p>
      </div>
    </button>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function RSMPortal() {
  const { session } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const birthdayData = useBirthdays();
  const currentUserId = String(session?.userId ?? "");
  const [expensesSubTab, setExpensesSubTab] = useState<
    "approvals" | "personal"
  >("approvals");
  const [reportees, setReportees] = useState<UserInfo[]>([]);
  const [asmMrGroups, setAsmMrGroups] = useState<AsmMrGroup[]>([]);
  const [allMrs, setAllMrs] = useState<UserInfo[]>([]);
  const [enrichedPins, setEnrichedPins] = useState<EnrichedMarker[]>([]);
  const [badgeTick, setBadgeTick] = useState(0);
  const [expenses, setExpenses] = useState<TaDaExpense[]>([]);
  const [leaves, setLeaves] = useState<LeaveApplication[]>([]);
  const [mrSummaries, setMrSummaries] = useState<MrMonthlySummary[]>([]);
  const [travelPlans, setTravelPlans] = useState<TravelPlanInfo[]>([]);
  const [tpUserMap, setTpUserMap] = useState<Map<bigint, UserInfo>>(new Map());
  const [charges, setCharges] = useState<AdditionalCharge[]>([]);
  const [showMRPortal, setShowMRPortal] = useState(false);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [selfTerritory, setSelfTerritory] = useState("");
  const [dashLoadError, setDashLoadError] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsVisibilityKey, setGpsVisibilityKey] = useState(0);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const gpsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const token = session?.token ?? "";
  const currentMonth = new Date().toISOString().slice(0, 7);
  const todayISO = new Date().toISOString().slice(0, 10);

  // ── RSM-as-MR mode hook removed (V76 rollback) ─────────────────────────────
  const mrModeConfig = null;
  const isInMrMode = false;
  const switchToMrMode = () => {};
  const switchToRsmMode = () => {};
  const mrModeLoading = false;
  void mrModeConfig;
  void isInMrMode;
  void switchToMrMode;
  void switchToRsmMode;
  void mrModeLoading;

  // ── Phase 3 hooks ─────────────────────────────────────────────────────
  // ── Direct MRs hook removed (V76 rollback) ──────────────────────────────
  const directMrs: UserInfo[] = [];
  const hasDirectMrs = false;
  const rsmDirectMrsLoading = false;
  void directMrs;
  void rsmDirectMrsLoading;
  const { data: dashboardData, loading: dashKpiLoading } =
    useDashboardData(token);
  const { counts: pendingCounts, loading: pendingCountsLoading } =
    usePendingCounts(token);
  const {
    rows: teamActivityRows,
    loading: teamActivityLoading,
    refresh: refreshTeamActivity,
  } = useTeamActivity(token, todayISO);

  // Extract RSM KPIs from dashboard aggregates
  const rsmKpis: RsmKpis | null =
    dashboardData && dashboardData.__kind__ === "rsm"
      ? dashboardData.rsm
      : null;

  const activeMRCharge = charges.find(
    (c) =>
      c.chargeType === ChargeType.Role &&
      c.additionalRole === Role.MR &&
      Date.now() * 1_000_000 >= Number(c.effectiveFrom) &&
      Date.now() * 1_000_000 <= Number(c.effectiveTo),
  );

  useEffect(() => {
    if (!token) return;
    const uid = session?.userId ?? BigInt(0);
    setDashLoadError(false);
    Promise.all([
      api.getPendingLeavesForManager(token),
      api.getPendingExpenses(token),
      api.listAllMrSummaries(currentMonth),
      uid ? api.getActiveChargesForEmployee(token, uid) : Promise.resolve([]),
      api.getMyCheckIns(token),
      api.listSubmittedReports(),
      uid ? api.getUser(token, uid) : Promise.resolve(null),
    ])
      .then(([lv, ex, sums, ch, checkIns, _rpts, self]) => {
        if (lv.__kind__ === "ok") setLeaves(lv.ok);
        setExpenses(ex);
        setMrSummaries(sums);
        setCharges(ch as AdditionalCharge[]);
        // Check-in status
        const hasCheckedIn =
          Array.isArray(checkIns) &&
          checkIns.some((ci: { date?: string; checkInDate?: string }) => {
            const d = ci.date ?? ci.checkInDate ?? "";
            return d === todayISO;
          });
        setCheckedInToday(hasCheckedIn);
        if (self)
          setSelfTerritory((self as { territory?: string }).territory ?? "");
      })
      .catch((err) => {
        console.error("[RSMPortal] Dashboard load error:", err);
        setDashLoadError(true);
        toast.error("Failed to load dashboard data. Please refresh.");
      });
  }, [token, currentMonth, session?.userId, todayISO]);

  // ── GPS tab: fresh fetch on tab switch + auto-refresh every 30s ───────────
  const fetchGpsData = useCallback(() => {
    if (!token) return;
    setGpsLoading(true);
    setGpsError(null);
    // Use getMrsGroupedByAsmForManager to get hierarchy-scoped MR IDs
    // then fetch enriched pins (filtered by hierarchy on the GPS map side)
    api
      .getEnrichedLiveLocations(token)
      .then((enriched) => {
        setEnrichedPins(enriched as EnrichedMarker[]);
      })
      .catch(() => {
        setGpsError("Could not load team locations. Please try again.");
      })
      .finally(() => setGpsLoading(false));
  }, [token]);

  useEffect(() => {
    if (activeTab !== "gps") {
      if (gpsIntervalRef.current) {
        clearInterval(gpsIntervalRef.current);
        gpsIntervalRef.current = null;
      }
      return;
    }
    fetchGpsData();
    setGpsVisibilityKey((k) => k + 1);
    gpsIntervalRef.current = setInterval(fetchGpsData, 30_000);
    // Badge tick: refresh time-ago labels every 60s without re-fetching
    const tickInterval = setInterval(() => setBadgeTick((t) => t + 1), 60_000);
    return () => {
      if (gpsIntervalRef.current) {
        clearInterval(gpsIntervalRef.current);
        gpsIntervalRef.current = null;
      }
      clearInterval(tickInterval);
    };
  }, [activeTab, fetchGpsData]);

  // ── Team tab: fetch full RSM → ASM → MR hierarchy ────────────────────────
  useEffect(() => {
    if (!token || activeTab !== "team") return;
    const uid = session?.userId ?? BigInt(0);
    Promise.all([
      api.listReportees(token, uid), // direct ASMs
      api.getMrsGroupedByAsmForManager(token), // all MRs grouped by ASM
    ])
      .then(([asms, groups]) => {
        setReportees(asms);
        setAsmMrGroups(groups);
        // Build flat MR list for stats (partial objects — only id/name/role used downstream)
        const flat = groups.flatMap((g) =>
          g.mrs.map(
            (m) =>
              ({
                id: m.mrId,
                name: m.mrName,
                role: "MR",
                reportsTo: g.asmId,
              }) as unknown as UserInfo,
          ),
        );
        setAllMrs(flat);
      })
      .catch((err) => {
        console.error("[RSMPortal] Team data load error:", err);
        toast.error("Failed to load team data.");
      });
  }, [token, activeTab, session?.userId]);

  useEffect(() => {
    if (!token || activeTab !== "travel-plans") return;
    Promise.all([
      api.listAllTravelPlans(token, null, currentMonth),
      api.listAllUsers(token),
    ])
      .then(([plans, users]) => {
        setTravelPlans(plans);
        setTpUserMap(new Map(users.map((u) => [u.id, u])));
      })
      .catch((err) => {
        console.error("[RSMPortal] Travel plans load error:", err);
        toast.error("Failed to load travel plans.");
      });
  }, [token, activeTab, currentMonth]);

  async function handleApproveExpense(expenseId: bigint, approved: boolean) {
    try {
      const res = await api.approveExpense(token, expenseId, approved);
      if (res.__kind__ === "ok") {
        toast.success(approved ? "Expense approved" : "Expense rejected");
        setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
      } else {
        toast.error(res.err || "Failed to update expense");
      }
    } catch {
      toast.error("An error occurred. Please try again.");
    }
  }

  const territoryData = mrSummaries.reduce<
    Record<string, { calls: number; doctors: number; orders: number }>
  >((acc, s) => {
    const mr = allMrs.find((u) => u.id === s.mrId);
    const territory = mr?.territory || "Unknown";
    if (!acc[territory]) acc[territory] = { calls: 0, doctors: 0, orders: 0 };
    acc[territory].calls += Number(s.totalCalls);
    acc[territory].doctors += Number(s.uniqueDoctors);
    acc[territory].orders += Number(s.totalOrders);
    return acc;
  }, {});

  const territoryChartData = Object.entries(territoryData).map(
    ([territory, v]) => ({
      territory:
        territory.length > 12 ? `${territory.slice(0, 12)}…` : territory,
      ...v,
    }),
  );

  // Build greeting info
  const greeting = getGreeting();
  const firstName = (session?.name ?? "").split(" ")[0] || "—";
  const territory = selfTerritory;

  // Filter team activity rows to only direct MRs
  const directMrIds = new Set(directMrs.map((m) => String(m.id)));
  const directMrActivityRows = teamActivityRows.filter((r) =>
    directMrIds.has(String(r.mrId)),
  );

  // Quick action buttons for dashboard
  const quickActions: QuickAction[] = [
    {
      label: "GPS Tracking",
      icon: <MapPin className="w-4 h-4" />,
      onClick: () => setActiveTab("gps"),
      primary: true,
    },
    {
      label: "Leave Approvals",
      icon: <Calendar className="w-4 h-4" />,
      onClick: () => setActiveTab("leaves"),
    },
    {
      label: "Expenses",
      icon: <FileText className="w-4 h-4" />,
      onClick: () => setActiveTab("expenses"),
    },
    {
      label: "DCR Approvals",
      icon: <CheckCircle className="w-4 h-4" />,
      onClick: () => setActiveTab("dcr-approvals"),
    },
    {
      label: "MTP Approvals",
      icon: <Target className="w-4 h-4" />,
      onClick: () => setActiveTab("mtp-approvals"),
    },
    {
      label: "Download Pricelist",
      icon: <Briefcase className="w-4 h-4" />,
      onClick: () => {
        window.location.href = "/shared/pricelist";
      },
    },
  ];

  // Dashboard action buttons (legacy quick-link grid)
  const dashButtons: DashActionBtn[] = [
    {
      id: "attendance",
      label: "Attendance Check-In",
      subtitle: "Mark your attendance with GPS",
      icon: Clock,
      colorClass: "bg-sky-600 hover:bg-sky-700",
      href: "/rsm/checkin",
      checkedIn: checkedInToday,
    },
    {
      id: "live-locations",
      label: "Live Locations",
      subtitle: "Track your MRs live GPS positions",
      icon: MapPin,
      colorClass: "bg-green-600 hover:bg-green-700",
      tabTarget: "gps",
    },
    {
      id: "call-reports",
      label: "Call Reports",
      subtitle: "Doctor call records — last 30 days",
      icon: FileText,
      colorClass: "bg-orange-600 hover:bg-orange-700",
      href: "/rsm/call-reports",
    },
    {
      id: "mr-call-details",
      label: "MR Detail Report",
      subtitle: "Full call-level details per MR",
      icon: BarChart2,
      colorClass: "bg-violet-600 hover:bg-violet-700",
      href: "/rsm/mr-call-details",
    },
    {
      id: "missed-visits",
      label: "Missed Doctor Visits",
      subtitle: "Track MR-wise missed doctor visits",
      icon: Users,
      colorClass: "bg-red-600 hover:bg-red-700",
      href: "/rsm/missed-doctor-visits",
    },
    {
      id: "attendance-tracking",
      label: "Attendance Tracking",
      subtitle: "View team attendance records",
      icon: CheckCircle,
      colorClass: "bg-cyan-600 hover:bg-cyan-700",
      href: "/rsm/attendance-tracking",
    },
    {
      id: "leave-approval",
      label: "Leave Approval",
      subtitle: "Review & approve leave requests",
      icon: Calendar,
      colorClass: "bg-teal-600 hover:bg-teal-700",
      tabTarget: "leaves",
      pendingCount: leaves.length,
    },
    {
      id: "location-trail",
      label: "Location Trail",
      subtitle: "View daily GPS movement trails",
      icon: MapPin,
      colorClass: "bg-purple-600 hover:bg-purple-700",
      href: "/rsm/location-trail",
    },
    {
      id: "jfw",
      label: "Joint Field Work",
      subtitle: "Record & view JFW entries with MRs",
      icon: Users,
      colorClass: "bg-blue-700 hover:bg-blue-800",
      href: "/rsm/jfw",
    },
    {
      id: "team-kpi",
      label: "Team KPIs",
      subtitle: "Monthly KPI targets & achievement",
      icon: Target,
      colorClass: "bg-violet-700 hover:bg-violet-800",
      href: "/rsm/kpi",
    },
  ];

  function handleDashButtonClick(btn: DashActionBtn) {
    if (btn.href) {
      window.location.href = btn.href;
      return;
    }
    if (btn.tabTarget) {
      setActiveTab(btn.tabTarget);
    }
  }

  return (
    <PortalLayout portalRole={Role.RSM}>
      <PageHeader
        title="RSM Portal"
        subtitle="Regional Sales Management — Krishkar Pharmaceuticals"
        actions={
          <div className="flex items-center gap-2">
            <NotificationInbox
              token={token}
              portalType="rsm"
              onNavigate={(entityType, entityId) => {
                if (entityType === "doctorCall") {
                  setActiveTab("reports");
                  void entityId;
                }
              }}
            />
            {activeMRCharge ? (
              <Button
                onClick={() => setShowMRPortal(true)}
                className="bg-amber-500 hover:bg-amber-600 text-white font-semibold shadow-md"
                size="sm"
                data-ocid="btn-open-mr-portal"
              >
                <Stethoscope className="w-4 h-4 mr-1.5" />
                MR Portal
              </Button>
            ) : null}
          </div>
        }
      />
      {showMRPortal && activeMRCharge && (
        <MRPortalPanel
          charge={activeMRCharge}
          primaryRole="RSM"
          onClose={() => setShowMRPortal(false)}
        />
      )}
      <PageContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)}>
          <TabsList className="mb-6 flex-wrap h-auto gap-1 bg-card border border-border p-1">
            <TabsTrigger value="dashboard" data-ocid="tab-dashboard">
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="team" data-ocid="tab-team">
              Team View
            </TabsTrigger>
            <TabsTrigger value="gps" data-ocid="tab-gps">
              GPS Tracking
            </TabsTrigger>
            <TabsTrigger value="expenses" data-ocid="tab-expenses">
              Expenses{" "}
              {expenses.length > 0 && (
                <Badge className="ml-1 px-1.5 py-0 text-xs">
                  {expenses.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="leaves" data-ocid="tab-leaves">
              Leaves{" "}
              {leaves.length > 0 && (
                <Badge className="ml-1 px-1.5 py-0 text-xs">
                  {leaves.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="reports" data-ocid="tab-reports">
              Regional Reports
            </TabsTrigger>
            <TabsTrigger value="travel-plans" data-ocid="tab-travel-plans">
              Travel Plans
            </TabsTrigger>
            <TabsTrigger value="dcr-approvals" data-ocid="tab-dcr-approvals">
              DCR Approvals
            </TabsTrigger>
            <TabsTrigger value="mtp-approvals" data-ocid="tab-mtp-approvals">
              MTP Approvals
            </TabsTrigger>
            {/* Dynamic tabs: only shown when RSM has directly managed MRs */}
            {hasDirectMrs && (
              <TabsTrigger
                value="direct-mr-reports"
                data-ocid="tab-direct-mr-reports"
              >
                <Users className="w-3.5 h-3.5 mr-1" /> Direct MR Reports
              </TabsTrigger>
            )}
            <TabsTrigger value="crm-requests" data-ocid="tab-crm-requests">
              <TrendingUp className="w-3.5 h-3.5 mr-1" /> CRM Requests
            </TabsTrigger>
            <TabsTrigger
              value="business-reports"
              data-ocid="tab-business-reports"
            >
              <BookOpen className="w-3.5 h-3.5 mr-1" /> Business Reports
            </TabsTrigger>
            <TabsTrigger
              value="sales-dashboard"
              data-ocid="tab-sales-dashboard"
            >
              <BarChart2 className="w-3.5 h-3.5 mr-1" /> Sales Dashboard
            </TabsTrigger>
            <TabsTrigger value="booking" data-ocid="tab-booking">
              <Package className="w-3.5 h-3.5 mr-1" /> Booking
            </TabsTrigger>
            <TabsTrigger
              value="monthly-targets"
              data-ocid="tab-monthly-targets"
            >
              <Target className="w-3.5 h-3.5 mr-1" /> Monthly Targets
            </TabsTrigger>
            <TabsTrigger
              value="birthday-calendar"
              data-ocid="tab-birthday-calendar"
            >
              🎂 Birthdays
            </TabsTrigger>
          </TabsList>

          {/* ── DASHBOARD ────────────────────────────────────────────── */}
          <TabsContent value="dashboard" data-ocid="rsm-dashboard.tab">
            {/* Role Switcher Banner removed (V76 rollback) */}
            {/* MR Mode removed (V76 rollback) */}
            <>
              {/* 1. Birthday Flash */}
              <BirthdayFlash
                birthdays={birthdayData.todaysBirthdays}
                doctorBirthdays={birthdayData.doctorBirthdaysToday}
                currentUserId={currentUserId}
                isOwnBirthday={birthdayData.isCurrentUserBirthday}
              />
              <OnLeaveBanner />

              {/* Error state */}
              {dashLoadError && (
                <div
                  className="flex items-center gap-3 mb-4 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/30"
                  data-ocid="rsm-dashboard.error_state"
                >
                  <span className="text-sm text-destructive flex-1">
                    Failed to load dashboard data.
                  </span>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="text-xs font-semibold text-destructive underline underline-offset-2 hover:opacity-80"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Greeting */}
              <div className="mb-5">
                <h2 className="text-xl font-bold text-foreground font-display">
                  {greeting}, {firstName}!
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  RSM{territory ? ` | ${territory}` : ""}
                  {hasDirectMrs && !rsmDirectMrsLoading && (
                    <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 text-xs font-semibold">
                      <Users className="w-3 h-3" />
                      ASM Mode Active
                    </span>
                  )}
                </p>
              </div>

              {/* Quick Actions */}
              <div className="mb-5">
                <QuickActionsBar actions={quickActions} />
              </div>

              {/* 3. Region-Level KPI Cards */}
              <section className="mb-6" data-ocid="rsm-dashboard.kpi_section">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Region KPIs — {currentMonth}
                  </h3>
                  {dashKpiLoading && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                  )}
                </div>
                {dashKpiLoading && !rsmKpis ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <Skeleton key={i} className="h-24 rounded-xl" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <KpiCard
                      title="Doctor Calls vs Target"
                      value={Number(rsmKpis?.regionDoctorCallsCount ?? 0)}
                      target={Number(rsmKpis?.regionDoctorCallsTarget ?? 0)}
                      progressBar
                      icon={<Stethoscope className="w-4 h-4" />}
                      accentColor="#0EA5E9"
                      subtitle={`Target: ${Number(rsmKpis?.regionDoctorCallsTarget ?? 0)}`}
                    />
                    <KpiCard
                      title="Chemist Visits"
                      value={Number(rsmKpis?.regionChemistVisits ?? 0)}
                      icon={<Users className="w-4 h-4" />}
                      accentColor="#0D9488"
                    />
                    <KpiCard
                      title="DCR Submission Rate"
                      value={`${(rsmKpis?.regionDcrRate ?? 0).toFixed(1)}%`}
                      target={100}
                      progressBar
                      icon={<FileText className="w-4 h-4" />}
                      accentColor="#7C3AED"
                    />
                    <KpiCard
                      title="MRs Not Checked-In"
                      value={Number(rsmKpis?.mrsNotCheckedInToday ?? 0)}
                      icon={<AlertTriangle className="w-4 h-4" />}
                      accentColor={
                        Number(rsmKpis?.mrsNotCheckedInToday ?? 0) > 0
                          ? "#EF4444"
                          : "#22C55E"
                      }
                      subtitle="Today"
                    />
                    <KpiCard
                      title="Pending Approvals"
                      value={Number(rsmKpis?.pendingApprovals ?? 0)}
                      icon={<Clock className="w-4 h-4" />}
                      accentColor={
                        Number(rsmKpis?.pendingApprovals ?? 0) > 0
                          ? "#F97316"
                          : "#22C55E"
                      }
                    />
                    <KpiCard
                      title="MTP Adherence"
                      value={`${(rsmKpis?.mtpAdherenceRate ?? 0).toFixed(1)}%`}
                      target={100}
                      progressBar
                      icon={<Target className="w-4 h-4" />}
                      accentColor="#0369A1"
                    />
                  </div>
                )}
              </section>

              {/* 4. Direct MRs Section — only if hasDirectMrs */}
              {hasDirectMrs && (
                <section
                  className="mb-6"
                  data-ocid="rsm-dashboard.direct_mrs_section"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-bold">
                        Direct MRs
                      </span>
                      Field Activity Today
                    </h3>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={refreshTeamActivity}
                      disabled={teamActivityLoading}
                      data-ocid="rsm-dashboard.refresh_activity_button"
                    >
                      <RefreshCw
                        className={`w-3 h-3 mr-1 ${teamActivityLoading ? "animate-spin" : ""}`}
                      />
                      Refresh
                    </Button>
                  </div>
                  <Card className="bg-card border border-border p-0 overflow-hidden">
                    {teamActivityLoading ? (
                      <div className="p-4 space-y-2">
                        {[1, 2, 3].map((i) => (
                          <Skeleton key={i} className="h-10 rounded-lg" />
                        ))}
                      </div>
                    ) : (
                      <MrActivityTable
                        rows={directMrActivityRows}
                        onViewMr={(mrId) => {
                          window.location.href = `/rsm/mr-call-details?mrId=${String(mrId)}`;
                        }}
                      />
                    )}
                  </Card>
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      className="text-xs text-sky-600 hover:underline font-medium"
                      onClick={() => setActiveTab("direct-mr-reports")}
                      data-ocid="rsm-dashboard.view_direct_mr_reports_link"
                    >
                      View all Direct MR Reports →
                    </button>
                  </div>
                </section>
              )}

              {/* 5. Area Performance Summary */}
              <section
                className="mb-6"
                data-ocid="rsm-dashboard.area_performance_section"
              >
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Area Performance Summary
                </h3>
                <Card className="bg-card border border-border overflow-hidden">
                  {allMrs.length === 0 && reportees.length === 0 ? (
                    <div
                      className="p-6 text-center text-sm text-muted-foreground"
                      data-ocid="rsm-dashboard.area_performance.empty_state"
                    >
                      Load the Team View tab to see area performance data.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/40">
                            <th className="text-left py-2 px-3 font-medium text-muted-foreground text-xs">
                              Area / ASM
                            </th>
                            <th className="text-center py-2 px-3 font-medium text-muted-foreground text-xs">
                              Doctor Calls
                            </th>
                            <th className="text-center py-2 px-3 font-medium text-muted-foreground text-xs">
                              MRs
                            </th>
                            <th className="text-center py-2 px-3 font-medium text-muted-foreground text-xs whitespace-nowrap">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportees.map((asm, idx) => {
                            const asmGroup = asmMrGroups.find(
                              (g) => g.asmId === asm.id,
                            );
                            const mrCount = asmGroup?.mrs.length ?? 0;
                            const asmSummaries = mrSummaries.filter((s) =>
                              asmGroup?.mrs.some((m) => m.mrId === s.mrId),
                            );
                            const totalCalls = asmSummaries.reduce(
                              (sum, s) => sum + Number(s.totalCalls),
                              0,
                            );
                            return (
                              <tr
                                key={String(asm.id)}
                                className="border-b border-border hover:bg-accent/50 transition-colors"
                                data-ocid={`rsm-dashboard.area_row.${idx + 1}`}
                              >
                                <td className="py-2.5 px-3">
                                  <p className="font-medium text-foreground text-sm truncate max-w-[140px]">
                                    {asm.territory || asm.name}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    ASM: {asm.name}
                                  </p>
                                </td>
                                <td className="py-2.5 px-3 text-center font-semibold text-foreground">
                                  {totalCalls}
                                </td>
                                <td className="py-2.5 px-3 text-center text-muted-foreground">
                                  {mrCount}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <button
                                    type="button"
                                    className="text-xs text-sky-600 hover:underline font-medium"
                                    onClick={() => setActiveTab("team")}
                                    data-ocid={`rsm-dashboard.area_drill_down.${idx + 1}`}
                                  >
                                    View Details
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                          {reportees.length === 0 && (
                            <tr>
                              <td
                                colSpan={4}
                                className="py-6 text-center text-sm text-muted-foreground"
                              >
                                No ASM data loaded. Visit Team View tab.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </section>

              {/* 6. Combined Pending Approvals Widget */}
              <section
                className="mb-6"
                data-ocid="rsm-dashboard.pending_approvals_section"
              >
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Pending Approvals
                </h3>
                {pendingCountsLoading && !pendingCounts ? (
                  <Skeleton className="h-40 rounded-xl" />
                ) : (
                  <div className="space-y-3">
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">
                        RSM-Level Approvals
                      </p>
                      <PendingActionsWidget
                        title=""
                        items={[
                          {
                            label: "Leave Applications (from ASMs)",
                            count: Number(
                              pendingCounts?.rsmLevelLeavePending ?? 0,
                            ),
                            onClick: () => setActiveTab("leaves"),
                            urgency:
                              Number(pendingCounts?.rsmLevelLeavePending ?? 0) >
                              3
                                ? "high"
                                : "medium",
                          } satisfies PendingActionItem,
                          {
                            label: "TA/DA Claims (from ASMs)",
                            count: Number(
                              pendingCounts?.rsmLevelTadaPending ?? 0,
                            ),
                            onClick: () => setActiveTab("expenses"),
                            urgency: "medium",
                          } satisfies PendingActionItem,
                        ]}
                      />
                    </div>
                    {hasDirectMrs && (
                      <div>
                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1.5 px-1">
                          Direct MR Approvals
                        </p>
                        <PendingActionsWidget
                          title=""
                          items={[
                            {
                              label: "DCR Approvals",
                              count: Number(pendingCounts?.dcrPending ?? 0),
                              onClick: () => setActiveTab("dcr-approvals"),
                              urgency:
                                Number(pendingCounts?.dcrPending ?? 0) > 0
                                  ? "high"
                                  : "low",
                            } satisfies PendingActionItem,
                            {
                              label: "MTP Approvals",
                              count: Number(pendingCounts?.mtpPending ?? 0),
                              onClick: () => setActiveTab("mtp-approvals"),
                              urgency: "medium",
                            } satisfies PendingActionItem,
                            {
                              label: "Leave Applications (Direct MRs)",
                              count: Number(pendingCounts?.leavePending ?? 0),
                              onClick: () => setActiveTab("leaves"),
                              urgency:
                                Number(pendingCounts?.leavePending ?? 0) > 3
                                  ? "high"
                                  : "medium",
                            } satisfies PendingActionItem,
                            {
                              label: "TA/DA Claims (Direct MRs)",
                              count: Number(pendingCounts?.tadaPending ?? 0),
                              onClick: () => setActiveTab("expenses"),
                              urgency: "medium",
                            } satisfies PendingActionItem,
                          ]}
                        />
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* 7. Upcoming Birthdays Widget */}
              <div className="mb-6" data-ocid="rsm-dashboard.birthdays_section">
                <UpcomingBirthdaysWidget
                  upcoming={birthdayData.upcomingBirthdays}
                  upcomingDoctors={birthdayData.doctorBirthdaysToday}
                  loading={birthdayData.loadingUpcoming}
                  onViewAll={() => setActiveTab("birthday-calendar")}
                />
              </div>

              {/* Quick-access links */}
              <div className="mb-4 flex flex-wrap gap-2">
                <a
                  href="/rsm/call-reports"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                  data-ocid="rsm-dashboard.link-call-reports"
                >
                  <FileText className="w-3 h-3" /> Call Reports
                </a>
                <a
                  href="/rsm/mr-call-details"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-violet-500/10 text-violet-700 border border-violet-500/20 hover:bg-violet-500/20 transition-colors"
                  data-ocid="rsm-dashboard.link-mr-detail-report"
                >
                  <BarChart2 className="w-3 h-3" /> MR Detail Report
                </a>
                <a
                  href="/rsm/missed-doctor-visits"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-700 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                  data-ocid="rsm-dashboard.link-missed-visits"
                >
                  <Users className="w-3 h-3" /> Missed Visits
                </a>
                <a
                  href="/rsm/location-trail"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-700 border border-purple-500/20 hover:bg-purple-500/20 transition-colors"
                  data-ocid="rsm-dashboard.link-location-trail"
                >
                  <MapPin className="w-3 h-3" /> Location Trail
                </a>
                <a
                  href="/rsm/working-style-reports"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-teal-500/10 text-teal-700 border border-teal-500/20 hover:bg-teal-500/20 transition-colors"
                  data-ocid="rsm-dashboard.link-working-style"
                >
                  <TrendingUp className="w-3 h-3" /> Working Style
                </a>
                <a
                  href="/rsm/attendance-tracking"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-700 border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors"
                  data-ocid="rsm-dashboard.link-attendance"
                >
                  <CheckCircle className="w-3 h-3" /> Attendance Tracking
                </a>
                {hasDirectMrs && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("direct-mr-reports")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
                    data-ocid="rsm-dashboard.link-direct-mr-reports"
                  >
                    <Users className="w-3 h-3" /> Direct MR Reports
                  </button>
                )}
              </div>

              {/* Legacy action buttons grid */}
              <div
                className="grid grid-cols-2 gap-3"
                data-ocid="dashboard-actions-grid"
              >
                {dashButtons.map((btn) => (
                  <DashButton
                    key={btn.id}
                    btn={btn}
                    onClick={() => handleDashButtonClick(btn)}
                  />
                ))}
              </div>
            </>
          </TabsContent>

          {/* ── BIRTHDAY CALENDAR ────────────────────────────────── */}
          <TabsContent
            value="birthday-calendar"
            data-ocid="birthday-calendar-tab"
          >
            <BirthdayCalendarPage />
          </TabsContent>

          {/* ── DIRECT MR REPORTS (only visible when hasDirectMrs) ─── */}
          {hasDirectMrs && (
            <TabsContent
              value="direct-mr-reports"
              data-ocid="rsm-direct-mr-reports-tab"
            >
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 border border-amber-200 text-xs font-bold">
                    Direct MRs
                  </span>
                  <h2 className="font-display font-semibold text-sm text-foreground">
                    Reports for Directly Managed MRs
                  </h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    {
                      label: "MR Call Details",
                      href: "/rsm/mr-call-details",
                      ocid: "direct-mr-reports.link-call-details",
                    },
                    {
                      label: "DCR Summary",
                      href: "/rsm/dcr-summary",
                      ocid: "direct-mr-reports.link-dcr-summary",
                    },
                    {
                      label: "MTP vs Actual",
                      href: "/rsm/mtp-actual",
                      ocid: "direct-mr-reports.link-mtp-actual",
                    },
                    {
                      label: "Attendance Report",
                      href: "/rsm/attendance-tracking",
                      ocid: "direct-mr-reports.link-attendance",
                    },
                    {
                      label: "Leave Report",
                      href: "/rsm/leave-report",
                      ocid: "direct-mr-reports.link-leave",
                    },
                    {
                      label: "TA/DA Claims",
                      href: "/rsm/tada-report",
                      ocid: "direct-mr-reports.link-tada",
                    },
                    {
                      label: "Sample Balance",
                      href: "/rsm/sample-balance",
                      ocid: "direct-mr-reports.link-sample-balance",
                    },
                    {
                      label: "Doctor Coverage",
                      href: "/rsm/doctor-coverage",
                      ocid: "direct-mr-reports.link-doctor-coverage",
                    },
                    {
                      label: "Chemist Coverage",
                      href: "/rsm/chemist-coverage",
                      ocid: "direct-mr-reports.link-chemist-coverage",
                    },
                    {
                      label: "Expense Summary",
                      href: "/rsm/expense-summary",
                      ocid: "direct-mr-reports.link-expense-summary",
                    },
                  ].map((l) => (
                    <a
                      key={l.href}
                      href={l.href}
                      data-ocid={l.ocid}
                      className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/30 hover:bg-amber-50 hover:border-amber-200 transition-colors text-sm font-medium text-foreground"
                    >
                      <FileText className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      {l.label}
                    </a>
                  ))}
                </div>

                {/* Today's Direct MR Activity */}
                <div className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-display font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                      Today's Field Activity
                    </h3>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={refreshTeamActivity}
                      disabled={teamActivityLoading}
                    >
                      <RefreshCw
                        className={`w-3 h-3 mr-1 ${teamActivityLoading ? "animate-spin" : ""}`}
                      />
                      Refresh
                    </Button>
                  </div>
                  {teamActivityLoading ? (
                    <div className="space-y-2">
                      {[1, 2].map((i) => (
                        <Skeleton key={i} className="h-10 rounded-lg" />
                      ))}
                    </div>
                  ) : (
                    <MrActivityTable rows={directMrActivityRows} />
                  )}
                </div>
              </div>
            </TabsContent>
          )}

          {/* TEAM VIEW — RSM → ASMs → MRs hierarchy */}
          <TabsContent value="team">
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="font-display font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3">
                  ASMs Under Region ({reportees.length})
                </h3>
                <DataTable<UserInfo>
                  columns={[
                    { key: "name", label: "Name" },
                    { key: "empId", label: "Emp ID" },
                    { key: "territory", label: "Territory" },
                    { key: "phone", label: "Phone" },
                    { key: "status", label: "Status" },
                  ]}
                  data={reportees}
                  getKey={(item) => String(item.id)}
                  emptyMessage="No ASMs found. Load the Team tab to fetch data."
                  renderRow={(user) => (
                    <>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground text-sm">
                          {user.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {user.designation} · {user.role}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-muted-foreground">
                        {user.employeeId}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {user.territory || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {user.phone}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            user.status === "Active" ? "default" : "secondary"
                          }
                          className="text-xs"
                        >
                          {user.status}
                        </Badge>
                      </td>
                    </>
                  )}
                />
              </div>

              {/* MRs grouped by ASM */}
              {asmMrGroups.length > 0 ? (
                <div className="space-y-3">
                  {asmMrGroups.map((group) => (
                    <div
                      key={String(group.asmId)}
                      className="bg-card border border-border rounded-lg p-4"
                    >
                      <h3 className="font-display font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-bold border border-orange-200">
                          ASM
                        </span>
                        {group.asmName} — {group.mrs.length} MR
                        {group.mrs.length !== 1 ? "s" : ""}
                      </h3>
                      {group.mrs.length > 0 ? (
                        <div className="divide-y divide-border">
                          {group.mrs.map((mr) => (
                            <div
                              key={String(mr.mrId)}
                              className="flex items-center gap-3 py-2.5"
                            >
                              <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-bold border border-blue-200 flex-shrink-0">
                                MR
                              </span>
                              <span className="text-sm font-medium text-foreground">
                                {mr.mrName}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">
                          No MRs assigned to this ASM
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-card border border-border rounded-lg p-4">
                  <h3 className="font-display font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3">
                    MRs in Region ({allMrs.length})
                  </h3>
                  <DataTable<UserInfo>
                    columns={[
                      { key: "name", label: "Name" },
                      { key: "empId", label: "Emp ID" },
                      { key: "territory", label: "Territory" },
                      { key: "phone", label: "Phone" },
                      { key: "status", label: "Status" },
                    ]}
                    data={allMrs}
                    getKey={(item) => String(item.id)}
                    emptyMessage="No MRs found in region"
                    renderRow={(user) => (
                      <>
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground text-sm">
                            {user.name}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-muted-foreground">
                          {user.employeeId}
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground">
                          {user.territory || "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {user.phone}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              user.status === "Active" ? "default" : "secondary"
                            }
                            className="text-xs"
                          >
                            {user.status}
                          </Badge>
                        </td>
                      </>
                    )}
                  />
                </div>
              )}
            </div>
          </TabsContent>

          {/* GPS */}
          <TabsContent value="gps">
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                  {gpsLoading && (
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  )}
                  Regional Field Staff — {enrichedPins.length} tracked
                </h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={fetchGpsData}
                  disabled={gpsLoading}
                  data-ocid="btn-refresh-gps"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 mr-1 ${gpsLoading ? "animate-spin" : ""}`}
                  />
                  Refresh
                </Button>
              </div>

              {gpsError && (
                <div className="flex items-center justify-between gap-3 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3 mb-4">
                  <p className="text-sm font-medium">{gpsError}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={fetchGpsData}
                    disabled={gpsLoading}
                    className="flex-shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10"
                    data-ocid="rsm-gps.retry_button"
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    Retry
                  </Button>
                </div>
              )}

              {!gpsLoading && !gpsError && enrichedPins.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
                  <MapPin className="w-10 h-10 opacity-30" />
                  <p className="text-sm font-medium">
                    No MRs are currently active
                  </p>
                  <p className="text-xs text-center max-w-xs">
                    GPS pins will appear here once MRs check in with location
                    enabled.
                  </p>
                </div>
              ) : (
                <GPSMap
                  enrichedMarkers={enrichedPins}
                  height="380px"
                  visibilityKey={gpsVisibilityKey}
                  badgeTick={badgeTick}
                />
              )}
            </div>
          </TabsContent>

          {/* EXPENSE APPROVALS + MY TA/DA */}
          <TabsContent value="expenses">
            {/* Sub-tab switcher */}
            <div className="flex gap-2 mb-4">
              <Button
                variant={expensesSubTab === "approvals" ? "default" : "outline"}
                size="sm"
                onClick={() => setExpensesSubTab("approvals")}
                data-ocid="rsm-portal.expenses-tab-approvals"
              >
                Team Approvals
              </Button>
              <Button
                variant={expensesSubTab === "personal" ? "default" : "outline"}
                size="sm"
                onClick={() => setExpensesSubTab("personal")}
                data-ocid="rsm-portal.expenses-tab-personal"
              >
                My TA/DA
              </Button>
            </div>

            {expensesSubTab === "approvals" && (
              <DataTable<TaDaExpense>
                columns={[
                  { key: "date", label: "Date" },
                  { key: "route", label: "Route" },
                  { key: "km", label: "Km", className: "text-right" },
                  { key: "total", label: "Total (₹)", className: "text-right" },
                  { key: "status", label: "Status" },
                  { key: "actions", label: "Actions", className: "text-right" },
                ]}
                data={expenses}
                getKey={(item) => String(item.id)}
                emptyMessage="No pending expense claims"
                renderRow={(exp) => (
                  <>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {exp.date}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground truncate max-w-[180px]">
                      {exp.fromLocation?.trim() && exp.toLocation?.trim()
                        ? `${exp.fromLocation} → ${exp.toLocation}`
                        : "HQ"}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-mono text-foreground">
                      {String(exp.distanceKm)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-mono font-semibold text-foreground">
                      {String(exp.totalAmount)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs">
                        {exp.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-accent border-accent/30 hover:bg-accent/10"
                          onClick={() => handleApproveExpense(exp.id, true)}
                          data-ocid="btn-approve-expense"
                        >
                          <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                          onClick={() => handleApproveExpense(exp.id, false)}
                          data-ocid="btn-reject-expense"
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                        </Button>
                      </div>
                    </td>
                  </>
                )}
              />
            )}

            {expensesSubTab === "personal" && (
              <PersonalTaDaForm roleLabel="RSM" />
            )}
          </TabsContent>

          {/* LEAVE APPROVALS */}
          <TabsContent value="leaves">
            <LeaveApprovalPanel token={token} />
          </TabsContent>

          {/* REGIONAL REPORTS */}
          <TabsContent value="reports">
            <div className="space-y-4">
              {/* Quick-links to dedicated report pages */}
              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="font-display font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3">
                  Report Quick Access
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    {
                      label: "Call Reports",
                      href: "/rsm/call-reports",
                      ocid: "quick-link-call-reports",
                    },
                    {
                      label: "MR Detail Report",
                      href: "/rsm/mr-call-details",
                      ocid: "quick-link-mr-detail",
                    },
                    {
                      label: "Missed Visits",
                      href: "/rsm/missed-doctor-visits",
                      ocid: "quick-link-missed-visits",
                    },
                    {
                      label: "Attendance Tracking",
                      href: "/rsm/attendance-tracking",
                      ocid: "quick-link-attendance",
                    },
                    {
                      label: "Working Style",
                      href: "/rsm/working-style-reports",
                      ocid: "quick-link-working-style",
                    },
                    {
                      label: "Location Trail",
                      href: "/rsm/location-trail",
                      ocid: "quick-link-location-trail",
                    },
                  ].map((l) => (
                    <a
                      key={l.href}
                      href={l.href}
                      data-ocid={l.ocid}
                      className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition-colors text-sm font-medium text-foreground"
                    >
                      <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                      {l.label}
                    </a>
                  ))}
                </div>
              </div>

              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="font-display font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-4 flex items-center gap-1.5">
                  <BarChart2 className="w-4 h-4" /> Territory Comparison —{" "}
                  {currentMonth}
                </h3>
                {territoryChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={territoryChartData}
                      margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                      />
                      <XAxis
                        dataKey="territory"
                        tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: "6px",
                          fontSize: 12,
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar
                        dataKey="calls"
                        name="Total Calls"
                        fill="var(--chart-1)"
                        radius={[2, 2, 0, 0]}
                      />
                      <Bar
                        dataKey="doctors"
                        name="Doctors"
                        fill="var(--chart-3)"
                        radius={[2, 2, 0, 0]}
                      />
                      <Bar
                        dataKey="orders"
                        name="Orders"
                        fill="var(--chart-2)"
                        radius={[2, 2, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-10">
                    No data for {currentMonth}
                  </p>
                )}
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="font-display font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-4 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4" /> MR-wise Performance Trend
                </h3>
                {mrSummaries.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart
                      data={mrSummaries.map((s) => {
                        const mr = allMrs.find((u) => u.id === s.mrId);
                        return {
                          name: mr?.name?.split(" ")[0] ?? `MR#${s.mrId}`,
                          calls: Number(s.totalCalls),
                          orders: Number(s.totalOrders),
                        };
                      })}
                      margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                      />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: "6px",
                          fontSize: 12,
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line
                        type="monotone"
                        dataKey="calls"
                        name="Calls"
                        stroke="var(--chart-1)"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="orders"
                        name="Orders"
                        stroke="var(--chart-2)"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-10">
                    No performance data for {currentMonth}
                  </p>
                )}
              </div>
              <div className="mt-4">
                <MrDoctorVisitWidget reportees={allMrs} month={currentMonth} />
              </div>
              <div className="mt-4">
                <DoctorVisitTrendChart
                  managerId={Number(session?.userId ?? 0)}
                  managerRole="RSM"
                  token={token}
                />
              </div>
              <div className="mt-4">
                <MissedVisitAlerts
                  managerId={Number(session?.userId ?? 0)}
                  token={token}
                  managerRole="RSM"
                />
              </div>
            </div>
          </TabsContent>

          {/* TRAVEL PLANS */}
          <TabsContent value="travel-plans">
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" /> Team Travel Plans —{" "}
                  {currentMonth}
                </h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    Promise.all([
                      api.listAllTravelPlans(token, null, currentMonth),
                      api.listAllUsers(token),
                    ]).then(([plans, users]) => {
                      setTravelPlans(plans);
                      setTpUserMap(new Map(users.map((u) => [u.id, u])));
                    })
                  }
                >
                  Refresh
                </Button>
              </div>
              <DataTable<TravelPlanInfo>
                columns={[
                  { key: "employee", label: "Employee" },
                  { key: "date", label: "Date" },
                  { key: "station", label: "Planned Station" },
                  { key: "status", label: "Status" },
                  { key: "notes", label: "Notes" },
                ]}
                data={travelPlans}
                getKey={(item) => String(item.id)}
                emptyMessage="No travel plans submitted for this month"
                renderRow={(tp) => (
                  <>
                    <td className="px-4 py-3 text-sm font-body text-foreground">
                      {tpUserMap.get(tp.userId)?.name ?? String(tp.userId)}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {tp.date}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {tp.plannedStation}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs">
                        {tp.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground truncate max-w-[200px]">
                      {tp.notes || "—"}
                    </td>
                  </>
                )}
              />
            </div>
          </TabsContent>

          {/* DCR APPROVALS */}
          <TabsContent value="dcr-approvals" data-ocid="dcr-approvals-tab">
            <DcrApproval portalRole={Role.RSM} />
          </TabsContent>

          {/* MTP APPROVALS */}
          <TabsContent value="mtp-approvals" data-ocid="mtp-approvals-tab">
            <MtpApproval portalRole={Role.RSM} />
          </TabsContent>

          {/* CRM REQUESTS */}
          <TabsContent value="crm-requests">
            <CrmRequests />
          </TabsContent>

          {/* BUSINESS REPORTS */}
          <TabsContent value="business-reports">
            <BusinessReporting />
          </TabsContent>

          {/* SALES DASHBOARD */}
          <TabsContent value="sales-dashboard">
            <SalesDashboard />
          </TabsContent>

          {/* BOOKING */}
          <TabsContent value="booking">
            <BookingManagement />
          </TabsContent>

          {/* MONTHLY TARGETS */}
          <TabsContent value="monthly-targets">
            <RSMMonthlyTargets />
          </TabsContent>
        </Tabs>

        {/* Additional Role Charges */}
        {charges.filter((c) => c.chargeType === "Role" && c.additionalRole)
          .length > 0 && (
          <div className="mt-6 space-y-4">
            <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Target className="w-4 h-4" /> Additional Role Charge
            </h2>
            {charges
              .filter((c) => c.chargeType === "Role" && c.additionalRole)
              .map((charge) => (
                <AdditionalRoleTab
                  key={charge.id}
                  chargeRole={charge.additionalRole!}
                  chargeId={charge.id}
                  effectiveTo={charge.effectiveTo}
                />
              ))}
          </div>
        )}

        {/* Additional Area Charges info cards */}
        {charges.filter((c) => c.chargeType === "Area" && c.additionalArea)
          .length > 0 && (
          <div className="mt-4 space-y-2">
            {charges
              .filter((c) => c.chargeType === "Area" && c.additionalArea)
              .map((charge) => (
                <div
                  key={charge.id}
                  className="flex items-center gap-2 bg-accent/10 border border-accent/30 rounded-lg px-4 py-2.5"
                >
                  <MapPin className="w-4 h-4 text-accent flex-shrink-0" />
                  <span className="text-sm text-foreground">
                    <strong>Additional Area:</strong> {charge.additionalArea}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    Active until{" "}
                    {new Date(
                      Number(charge.effectiveTo) / 1_000_000,
                    ).toLocaleDateString("en-IN")}
                  </span>
                </div>
              ))}
          </div>
        )}
      </PageContent>
    </PortalLayout>
  );
}
