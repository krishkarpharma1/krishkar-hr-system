import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  BarChart2,
  BookOpen,
  Calendar,
  CheckCircle,
  CheckCircle2,
  Clock,
  Download,
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
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { ChargeType, ReportStatus, Role } from "../../backend";
import { BirthdayFlash } from "../../components/BirthdayFlash";
import { DoctorVisitTrendChart } from "../../components/DoctorVisitTrendChart";
import { GPSMap } from "../../components/GPSMap";
import type { EnrichedMarker } from "../../components/GPSMap";
import { KpiCard } from "../../components/KpiCard";
import { MissedVisitAlerts } from "../../components/MissedVisitAlerts";
import { MrActivityTable } from "../../components/MrActivityTable";
import { MrDoctorVisitWidget } from "../../components/MrDoctorVisitWidget";
import { MyIncentiveWidget as _MyIncentiveWidget } from "../../components/MyIncentiveWidget";
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
import { useTeamActivity } from "../../hooks/useTeamActivity";
import { api } from "../../lib/api";
import { useEmployeeNames } from "../../lib/nameResolver";
import { useAuthStore } from "../../store/authStore";
import type {
  CallReportInfo,
  LeaveApplication,
  LocationRecord,
  MrMonthlySummary,
  TaDaExpense,
  TravelPlanInfo,
  UserInfo,
} from "../../types";
import type { AdditionalCharge } from "../../types";
import { formatDate } from "../../utils/dateFormatter";
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
import ASMMonthlyTargets from "./ASMMonthlyTargets";
import ASMWorkingStyleReports from "./ASMWorkingStyleReports";

type TabId =
  | "dashboard"
  | "my-mrs"
  | "gps"
  | "reports"
  | "expenses"
  | "leaves"
  | "performance"
  | "travel-plans"
  | "dcr-approvals"
  | "mtp-approvals"
  | "crm-requests"
  | "business-reports"
  | "sales-dashboard"
  | "booking"
  | "monthly-targets"
  | "working-style"
  | "birthday-calendar";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

// ─── MR Performance Alert Card ─────────────────────────────────────────────
interface AlertCardProps {
  title: string;
  mrNames: string[];
  icon: React.ReactNode;
  colorClass: string;
}

function MrAlertCard({ title, mrNames, icon, colorClass }: AlertCardProps) {
  if (mrNames.length === 0) return null;
  return (
    <div className={`rounded-xl border p-3 ${colorClass}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="flex-shrink-0">{icon}</span>
        <span className="text-sm font-semibold">{title}</span>
        <span className="ml-auto text-xs font-bold rounded-full bg-current/20 px-2 py-0.5">
          {mrNames.length}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {mrNames.map((name) => (
          <span
            key={name}
            className="text-xs bg-white/60 rounded-full px-2 py-0.5 font-medium"
          >
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function ASMPortal() {
  const { session } = useAuthStore();
  const { getEmployeeName } = useEmployeeNames();
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const birthdayData = useBirthdays();
  const currentUserId = String(session?.userId ?? "");
  const [reportees, setReportees] = useState<UserInfo[]>([]);
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [enrichedPins, setEnrichedPins] = useState<EnrichedMarker[]>([]);
  const [badgeTick, setBadgeTick] = useState(0);
  const [reports, setReports] = useState<CallReportInfo[]>([]);
  const [expenses, setExpenses] = useState<TaDaExpense[]>([]);
  const [leaves, setLeaves] = useState<LeaveApplication[]>([]);
  const [mrSummaries, setMrSummaries] = useState<MrMonthlySummary[]>([]);
  const [travelPlans, setTravelPlans] = useState<TravelPlanInfo[]>([]);
  const [tpUserMap, setTpUserMap] = useState<Map<bigint, UserInfo>>(new Map());
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsVisibilityKey, setGpsVisibilityKey] = useState(0);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [charges, setCharges] = useState<AdditionalCharge[]>([]);
  const [showMRPortal, setShowMRPortal] = useState(false);
  const [dashReportCount, setDashReportCount] = useState(0);
  const [selfTerritory, setSelfTerritory] = useState("");
  const [expenseSubTab, setExpenseSubTab] = useState<"approvals" | "personal">(
    "approvals",
  );
  const gpsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const token = session?.token ?? "";
  const userId = session?.userId ?? BigInt(0);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const todayISO = new Date().toISOString().slice(0, 10);

  // ── SFA Dashboard hooks ──────────────────────────────────────────────────
  const {
    data: dashData,
    loading: dashLoading,
    error: dashError,
    refresh: refreshDash,
  } = useDashboardData(token, undefined, undefined);
  const { counts: pendingCounts } = usePendingCounts(token);
  const {
    rows: activityRows,
    loading: activityLoading,
    error: activityError,
    refresh: refreshActivity,
  } = useTeamActivity(token, todayISO);

  const activeMRCharge = charges.find(
    (c) =>
      c.chargeType === ChargeType.Role &&
      c.additionalRole === Role.MR &&
      Date.now() * 1_000_000 >= Number(c.effectiveFrom) &&
      Date.now() * 1_000_000 <= Number(c.effectiveTo),
  );

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setLoadError(false);
    Promise.all([
      api.listReportees(token, userId),
      api.getReporteeLocations(token),
      api.getPendingLeavesForManager(token),
      api.getPendingExpenses(token),
      api.getActiveChargesForEmployee(token, userId),
      api.getMyCheckIns(token),
      api.listSubmittedReports(),
      api.getUser(token, userId),
    ])
      .then(([r, l, lv, ex, ch, checkIns, rpts, self]) => {
        setReportees(r);
        setLocations(l);
        if (lv.__kind__ === "ok") setLeaves(lv.ok);
        setExpenses(ex);
        setCharges(ch);
        const hasCheckedIn =
          Array.isArray(checkIns) &&
          checkIns.some((ci: { date?: string; checkInDate?: string }) => {
            const d = ci.date ?? ci.checkInDate ?? "";
            return d === todayISO;
          });
        void hasCheckedIn; // checkedInToday no longer displayed on new dashboard
        const pending = (rpts as CallReportInfo[]).filter(
          (r) => r.status === ReportStatus.Submitted,
        );
        setDashReportCount(pending.length);
        setReports(rpts as CallReportInfo[]);
        if (self) setSelfTerritory(self.territory);
      })
      .catch((err) => {
        console.error("[ASMPortal] Dashboard load error:", err);
        setLoadError(true);
        toast.error("Failed to load dashboard data. Please refresh.");
      })
      .finally(() => setLoading(false));
  }, [token, userId, todayISO]);

  // ── GPS tab: fresh fetch on tab switch + auto-refresh every 30s ───────────
  const fetchGpsData = useCallback(() => {
    if (!token) return;
    setGpsLoading(true);
    setGpsError(null);
    Promise.all([
      api.getEnrichedLiveLocations(token),
      api.getReporteeLocations(token),
      api.listReportees(token, userId),
    ])
      .then(([enriched, locs, reps]) => {
        setEnrichedPins(enriched as EnrichedMarker[]);
        setLocations(locs);
        setReportees(reps);
      })
      .catch(() => {
        setGpsError("Could not load team locations. Please try again.");
      })
      .finally(() => setGpsLoading(false));
  }, [token, userId]);

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

  useEffect(() => {
    if (!token || activeTab !== "performance") return;
    api
      .listAllMrSummaries(currentMonth)
      .then(setMrSummaries)
      .catch((err) => {
        console.error("[ASMPortal] Performance data error:", err);
      });
  }, [token, activeTab, currentMonth]);

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
        console.error("[ASMPortal] Travel plans load error:", err);
        toast.error("Failed to load travel plans.");
      });
  }, [token, activeTab, currentMonth]);

  async function handleApproveReport(reportId: bigint, approved: boolean) {
    try {
      const res = await api.reviewCallReport(
        userId,
        reportId,
        approved,
        approved ? "Approved" : "Rejected",
      );
      if (res.__kind__ === "ok") {
        const report = reports.find((r) => r.id === reportId);
        const mrName = report ? getEmployeeName(report.mrId) : "";
        toast.success(
          approved
            ? `Report approved${mrName ? ` for ${mrName}` : ""}`
            : `Report rejected${mrName ? ` for ${mrName}` : ""}`,
        );
        setReports((prev) => prev.filter((r) => r.id !== reportId));
        setDashReportCount((c) => Math.max(0, c - 1));
      } else {
        toast.error(res.err || "Failed to update report");
      }
    } catch {
      toast.error("An error occurred. Please try again.");
    }
  }

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

  const pendingReports = reports.filter(
    (r) => r.status === ReportStatus.Submitted,
  );

  const perfChartData = mrSummaries.map((s) => {
    const mr = reportees.find((r) => r.id === s.mrId);
    return {
      name: mr?.name?.split(" ")[0] ?? `MR ${s.mrId}`,
      calls: Number(s.totalCalls),
      doctors: Number(s.uniqueDoctors),
      orders: Number(s.totalOrders),
    };
  });

  const greeting = getGreeting();
  const firstName = (session?.name ?? "").split(" ")[0] || "—";
  const territory = selfTerritory;

  // Suppress unused import warning for MyIncentiveWidget (used in other portals)
  void _MyIncentiveWidget;

  return (
    <PortalLayout portalRole={Role.ASM}>
      <PageHeader
        title="ASM Portal"
        subtitle="Area Sales Management — Krishkar Pharmaceuticals"
        actions={
          <div className="flex items-center gap-2">
            <NotificationInbox
              token={token}
              portalType="asm"
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
          primaryRole="ASM"
          onClose={() => setShowMRPortal(false)}
        />
      )}
      <PageContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)}>
          <TabsList className="mb-6 flex-wrap h-auto gap-1 bg-card border border-border p-1">
            <TabsTrigger value="dashboard" data-ocid="tab-dashboard">
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="my-mrs" data-ocid="tab-my-mrs">
              My MRs
            </TabsTrigger>
            <TabsTrigger value="gps" data-ocid="tab-gps">
              GPS Tracking
            </TabsTrigger>
            <TabsTrigger value="reports" data-ocid="tab-reports">
              Reports{" "}
              {pendingReports.length > 0 && (
                <Badge className="ml-1 px-1.5 py-0 text-xs">
                  {pendingReports.length}
                </Badge>
              )}
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
            <TabsTrigger value="performance" data-ocid="tab-performance">
              Performance
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
            <TabsTrigger value="working-style" data-ocid="tab-working-style">
              <TrendingUp className="w-3.5 h-3.5 mr-1" /> Working Style
            </TabsTrigger>
            <TabsTrigger
              value="birthday-calendar"
              data-ocid="tab-birthday-calendar"
            >
              🎂 Birthdays
            </TabsTrigger>
          </TabsList>

          {/* ── DASHBOARD ────────────────────────────────────────────── */}
          <TabsContent value="dashboard" data-ocid="asm-dashboard.tab">
            {/* ── Birthday Flash ── */}
            <BirthdayFlash
              birthdays={birthdayData.todaysBirthdays}
              doctorBirthdays={birthdayData.doctorBirthdaysToday}
              currentUserId={currentUserId}
              isOwnBirthday={birthdayData.isCurrentUserBirthday}
            />
            {/* ── On-Leave Banner ── */}
            <OnLeaveBanner />

            {/* ── Load Error ── */}
            {(loadError || dashError) && (
              <div
                className="flex items-center gap-3 mb-4 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/30"
                data-ocid="asm-dashboard.error_state"
              >
                <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
                <span className="text-sm text-destructive flex-1">
                  Failed to load dashboard data.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    void refreshDash();
                  }}
                  className="text-xs font-semibold text-destructive underline underline-offset-2 hover:opacity-80"
                >
                  Retry
                </button>
              </div>
            )}

            {/* ── Greeting ── */}
            <div className="mb-5">
              <h2 className="text-xl font-bold text-foreground font-display">
                {greeting}, {firstName}!
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                ASM{territory ? ` | ${territory}` : ""} &mdash;{" "}
                {formatDate(todayISO)}
              </p>
            </div>

            {/* ── Section: Team KPI Cards ── */}
            <div className="mb-6" data-ocid="asm-dashboard.kpi_section">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-sky-500" />
                  Team Performance — {currentMonth}
                </h3>
                {dashLoading && (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                )}
                <button
                  type="button"
                  onClick={() => {
                    void refreshDash();
                  }}
                  className="text-xs text-sky-600 hover:underline flex items-center gap-1"
                  data-ocid="asm-dashboard.kpi_refresh"
                >
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </div>

              {dashLoading && !dashData ? (
                <div
                  className="grid grid-cols-2 sm:grid-cols-3 gap-3"
                  data-ocid="asm-dashboard.kpi_loading_state"
                >
                  {["calls", "chemist", "dcr", "checkin", "leaves", "tada"].map(
                    (key) => (
                      <Skeleton key={key} className="h-28 rounded-xl" />
                    ),
                  )}
                </div>
              ) : (
                (() => {
                  const kpis =
                    dashData?.__kind__ === "asm" ? dashData.asm : null;
                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <KpiCard
                        title="Team Doctor Calls"
                        value={kpis ? Number(kpis.teamDoctorCallsCount) : 0}
                        target={
                          kpis ? Number(kpis.teamDoctorCallsTarget) : undefined
                        }
                        progressBar={!!kpis?.teamDoctorCallsTarget}
                        icon={<Users className="w-4 h-4" />}
                        accentColor="#0EA5E9"
                      />
                      <KpiCard
                        title="Team Chemist Visits"
                        value={kpis ? Number(kpis.teamChemistVisits) : 0}
                        icon={<Package className="w-4 h-4" />}
                        accentColor="#8B5CF6"
                      />
                      <KpiCard
                        title="DCR On-Time Rate"
                        value={kpis ? Number(kpis.teamDcrOnTimeCount) : 0}
                        target={kpis ? Number(kpis.teamDcrExpected) : undefined}
                        progressBar={!!kpis?.teamDcrExpected}
                        icon={<FileText className="w-4 h-4" />}
                        accentColor="#10B981"
                      />
                      <KpiCard
                        title="MRs Not Checked In"
                        value={kpis ? Number(kpis.mrsNotCheckedInToday) : 0}
                        icon={<XCircle className="w-4 h-4" />}
                        accentColor={
                          kpis && Number(kpis.mrsNotCheckedInToday) > 0
                            ? "#EF4444"
                            : "#6B7280"
                        }
                        subtitle="Today"
                      />
                      <KpiCard
                        title="Pending Leaves"
                        value={
                          pendingCounts?.leavePending !== undefined
                            ? Number(pendingCounts.leavePending)
                            : kpis
                              ? Number(kpis.pendingLeaveCount)
                              : 0
                        }
                        icon={<Calendar className="w-4 h-4" />}
                        accentColor={
                          (pendingCounts?.leavePending !== undefined
                            ? Number(pendingCounts.leavePending)
                            : kpis
                              ? Number(kpis.pendingLeaveCount)
                              : 0) > 0
                            ? "#F97316"
                            : "#6B7280"
                        }
                      />
                      <KpiCard
                        title="Pending TA/DA Claims"
                        value={
                          pendingCounts?.tadaPending !== undefined
                            ? Number(pendingCounts.tadaPending)
                            : kpis
                              ? Number(kpis.pendingTadaCount)
                              : 0
                        }
                        icon={<TrendingUp className="w-4 h-4" />}
                        accentColor="#F59E0B"
                      />
                    </div>
                  );
                })()
              )}
            </div>

            {/* ── Section: MR Performance Alerts ── */}
            {(() => {
              const notCheckedIn = activityRows
                .filter((r) => !r.checkInStatus)
                .map((r) => r.mrName);
              const noDcrMrs = activityRows
                .filter((r) => r.dcrStatusToday === "NotSubmitted")
                .map((r) => r.mrName);
              const hasAlerts = notCheckedIn.length > 0 || noDcrMrs.length > 0;
              if (!hasAlerts) return null;
              return (
                <div className="mb-6" data-ocid="asm-dashboard.alerts_section">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-3">
                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                    MR Performance Alerts
                  </h3>
                  <div className="space-y-2">
                    <MrAlertCard
                      title="Not Checked In Today"
                      mrNames={notCheckedIn}
                      icon={<XCircle className="w-4 h-4 text-red-600" />}
                      colorClass="bg-red-50 border-red-200 text-red-800"
                    />
                    <MrAlertCard
                      title="DCR Not Submitted"
                      mrNames={noDcrMrs}
                      icon={<FileText className="w-4 h-4 text-orange-600" />}
                      colorClass="bg-orange-50 border-orange-200 text-orange-800"
                    />
                  </div>
                </div>
              );
            })()}

            {/* ── Section: MR Daily Activity Table ── */}
            <div className="mb-6" data-ocid="asm-dashboard.activity_section">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-sky-500" />
                  Team Activity Today — {formatDate(todayISO)}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    void refreshActivity();
                  }}
                  className="text-xs text-sky-600 hover:underline flex items-center gap-1"
                  data-ocid="asm-dashboard.activity_refresh"
                >
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </div>
              <Card className="p-0 overflow-hidden border border-border">
                {activityLoading ? (
                  <div
                    className="p-4 space-y-2"
                    data-ocid="asm-dashboard.activity_loading_state"
                  >
                    {["act-a", "act-b", "act-c"].map((key) => (
                      <Skeleton key={key} className="h-10 rounded" />
                    ))}
                  </div>
                ) : activityError ? (
                  <div
                    className="flex items-center gap-3 p-4 text-sm text-destructive"
                    data-ocid="asm-dashboard.activity_error_state"
                  >
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1">
                      Could not load team activity.
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        void refreshActivity();
                      }}
                      className="text-xs underline hover:opacity-80"
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  <MrActivityTable
                    rows={activityRows}
                    onViewMr={() => setActiveTab("my-mrs")}
                  />
                )}
              </Card>
            </div>

            {/* ── Section: Pending Approvals + Upcoming Birthdays (side by side on md+) ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div data-ocid="asm-dashboard.pending_approvals_section">
                <PendingActionsWidget
                  title="Pending Approvals"
                  items={[
                    {
                      label: "Leave Applications",
                      count:
                        pendingCounts?.leavePending !== undefined
                          ? Number(pendingCounts.leavePending)
                          : leaves.length,
                      onClick: () => setActiveTab("leaves"),
                      urgency: "high",
                    } satisfies PendingActionItem,
                    {
                      label: "TA/DA Claims",
                      count:
                        pendingCounts?.tadaPending !== undefined
                          ? Number(pendingCounts.tadaPending)
                          : expenses.length,
                      onClick: () => setActiveTab("expenses"),
                      urgency: "high",
                    } satisfies PendingActionItem,
                    {
                      label: "MTP Submissions",
                      count:
                        pendingCounts?.mtpPending !== undefined
                          ? Number(pendingCounts.mtpPending)
                          : 0,
                      onClick: () => setActiveTab("mtp-approvals"),
                      urgency: "medium",
                    } satisfies PendingActionItem,
                    {
                      label: "DCR Approvals",
                      count:
                        pendingCounts?.dcrPending !== undefined
                          ? Number(pendingCounts.dcrPending)
                          : dashReportCount,
                      onClick: () => setActiveTab("dcr-approvals"),
                      urgency: "medium",
                    } satisfies PendingActionItem,
                  ]}
                />
              </div>
              <div data-ocid="asm-dashboard.birthdays_section">
                <UpcomingBirthdaysWidget
                  upcoming={birthdayData.upcomingBirthdays}
                  loading={birthdayData.loadingUpcoming}
                  onViewAll={() => setActiveTab("birthday-calendar")}
                />
              </div>
            </div>

            {/* ── Section: Quick Actions ── */}
            <div
              className="mb-4"
              data-ocid="asm-dashboard.quick_actions_section"
            >
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-3">
                Quick Actions
              </h3>
              <QuickActionsBar
                actions={[
                  {
                    label: "View Team Attendance",
                    icon: <CheckCircle className="w-4 h-4" />,
                    onClick: () => setActiveTab("gps"),
                    primary: true,
                  } satisfies QuickAction,
                  {
                    label: "Review Pending Approvals",
                    icon: <FileText className="w-4 h-4" />,
                    onClick: () => setActiveTab("leaves"),
                    primary: true,
                  } satisfies QuickAction,
                  {
                    label: "Submit JFW Entry",
                    icon: <Users className="w-4 h-4" />,
                    onClick: () => {
                      window.location.href = "/asm/jfw";
                    },
                  } satisfies QuickAction,
                  {
                    label: "MR Call Details Report",
                    icon: <BarChart2 className="w-4 h-4" />,
                    onClick: () => {
                      window.location.href = "/asm/call-reports";
                    },
                  } satisfies QuickAction,
                  {
                    label: "Sample Ledger",
                    icon: <Package className="w-4 h-4" />,
                    onClick: () => {
                      window.location.href = "/asm/sample-ledger";
                    },
                  } satisfies QuickAction,
                  {
                    label: "Download Pricelist",
                    icon: <Download className="w-4 h-4" />,
                    onClick: () => {
                      window.location.href = "/shared/pricelist";
                    },
                  } satisfies QuickAction,
                  {
                    label: "Download Pricelist",
                    icon: <Download className="w-4 h-4" />,
                    onClick: () => {
                      window.location.href = "/shared/pricelist";
                    },
                  } satisfies QuickAction,
                ]}
              />
            </div>
          </TabsContent>

          {/* ── BIRTHDAY CALENDAR ─────────────────────────────────── */}
          <TabsContent
            value="birthday-calendar"
            data-ocid="birthday-calendar-tab"
          >
            <BirthdayCalendarPage />
          </TabsContent>

          {/* MY MRs */}
          <TabsContent value="my-mrs">
            <DataTable<UserInfo>
              columns={[
                { key: "name", label: "Name" },
                { key: "empId", label: "Emp ID" },
                { key: "territory", label: "Territory" },
                { key: "phone", label: "Phone" },
                { key: "gps", label: "Last GPS" },
                { key: "status", label: "Status" },
              ]}
              data={reportees}
              getKey={(item) => String(item.id)}
              loading={loading}
              emptyMessage="No MRs assigned to your area"
              renderRow={(mr) => {
                const loc = locations.find((l) => l.userId === mr.id);
                const lastSeen = loc
                  ? new Date(
                      Number(loc.timestamp) / 1_000_000,
                    ).toLocaleDateString("en-IN")
                  : "—";
                return (
                  <>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground text-sm">
                        {mr.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {mr.designation}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-muted-foreground">
                      {mr.employeeId}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {mr.territory || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {mr.phone}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {loc ? (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-accent" />
                          {lastSeen}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50">
                          No data
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          mr.status === "Active" ? "default" : "secondary"
                        }
                        className="text-xs"
                      >
                        {mr.status}
                      </Badge>
                    </td>
                  </>
                );
              }}
            />
          </TabsContent>

          {/* GPS TRACKING */}
          <TabsContent value="gps">
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                  {gpsLoading && (
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  )}
                  Live MR Locations — {enrichedPins.length} tracked
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
                    data-ocid="asm-gps.retry_button"
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

              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-40 overflow-y-auto scrollbar-thin">
                {reportees.map((mr) => {
                  const loc = locations.find((l) => l.userId === mr.id);
                  return (
                    <div
                      key={String(mr.id)}
                      className="bg-muted/30 rounded px-3 py-2 text-xs"
                    >
                      <p className="font-medium text-foreground truncate">
                        {mr.name}
                      </p>
                      <p className="text-muted-foreground">
                        {loc
                          ? `${loc.lat.toFixed(3)}, ${loc.lng.toFixed(3)}`
                          : "No GPS"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          {/* REPORT APPROVALS */}
          <TabsContent value="reports">
            <DataTable<CallReportInfo>
              columns={[
                { key: "date", label: "Date" },
                { key: "mr", label: "MR" },
                { key: "type", label: "Work Type" },
                { key: "doctors", label: "Doctors" },
                { key: "status", label: "Status" },
                { key: "actions", label: "Actions", className: "text-right" },
              ]}
              data={reports.filter((r) => r.status === ReportStatus.Submitted)}
              getKey={(item) => String(item.id)}
              emptyMessage="No submitted reports pending review"
              renderRow={(report) => (
                <>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {report.date}
                  </td>
                  <td className="px-4 py-3 text-sm font-body text-foreground">
                    {getEmployeeName(report.mrId)}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {report.workType}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {report.doctorsVisited.length}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs">
                      {report.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-accent border-accent/30 hover:bg-accent/10"
                        onClick={() => handleApproveReport(report.id, true)}
                        data-ocid="btn-approve-report"
                      >
                        <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                        onClick={() => handleApproveReport(report.id, false)}
                        data-ocid="btn-reject-report"
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                      </Button>
                    </div>
                  </td>
                </>
              )}
            />
          </TabsContent>

          {/* EXPENSE APPROVALS */}
          <TabsContent value="expenses">
            {/* Sub-tabs: Team Expense Approvals vs Personal TA/DA */}
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setExpenseSubTab("approvals")}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${expenseSubTab === "approvals" ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}
                  data-ocid="asm-expenses.tab-approvals"
                >
                  Team Expense Approvals{" "}
                  {expenses.length > 0 && (
                    <span className="ml-1 bg-destructive text-white text-xs rounded-full px-1.5 py-0.5">
                      {expenses.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setExpenseSubTab("personal")}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${expenseSubTab === "personal" ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}
                  data-ocid="asm-expenses.tab-personal"
                >
                  My Personal TA/DA
                </button>
              </div>

              {expenseSubTab === "approvals" && (
                <DataTable<TaDaExpense>
                  columns={[
                    { key: "date", label: "Date" },
                    { key: "route", label: "Route" },
                    { key: "km", label: "Km", className: "text-right" },
                    { key: "ta", label: "TA (₹)", className: "text-right" },
                    { key: "da", label: "DA (₹)", className: "text-right" },
                    {
                      key: "total",
                      label: "Total (₹)",
                      className: "text-right",
                    },
                    {
                      key: "actions",
                      label: "Actions",
                      className: "text-right",
                    },
                  ]}
                  data={expenses}
                  getKey={(item) => String(item.id)}
                  emptyMessage="No pending expense claims"
                  renderRow={(exp) => (
                    <>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {exp.date}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground truncate max-w-[160px]">
                        {exp.fromLocation?.trim() && exp.toLocation?.trim()
                          ? `${exp.fromLocation} → ${exp.toLocation}`
                          : "HQ"}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-mono text-foreground">
                        {String(exp.distanceKm)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-mono text-foreground">
                        {String(exp.travelAmount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-mono text-foreground">
                        {String(exp.dailyAllowance)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-mono font-semibold text-foreground">
                        {String(exp.totalAmount)}
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

              {expenseSubTab === "personal" && (
                <PersonalTaDaForm roleLabel="ASM" />
              )}
            </div>
          </TabsContent>

          {/* LEAVE APPROVALS */}
          <TabsContent value="leaves">
            <LeaveApprovalPanel token={token} />
          </TabsContent>

          {/* PERFORMANCE */}
          <TabsContent value="performance">
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                  <BarChart2 className="inline w-4 h-4 mr-1" />
                  MR Performance — {currentMonth}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {mrSummaries.length} MRs
                </span>
              </div>
              {perfChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart
                    data={perfChartData}
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
                    <Bar
                      dataKey="calls"
                      name="Total Calls"
                      fill="var(--chart-1)"
                      radius={[2, 2, 0, 0]}
                    />
                    <Bar
                      dataKey="doctors"
                      name="Doctors Visited"
                      fill="var(--chart-3)"
                      radius={[2, 2, 0, 0]}
                    />
                    <Bar
                      dataKey="orders"
                      name="Chemist Orders"
                      fill="var(--chart-2)"
                      radius={[2, 2, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-sm gap-2">
                  <Clock className="w-8 h-8 opacity-40" />
                  <p>No performance data for {currentMonth}</p>
                </div>
              )}
            </div>
            <div className="mt-4">
              <MrDoctorVisitWidget reportees={reportees} month={currentMonth} />
            </div>
            <div className="mt-4">
              <DoctorVisitTrendChart
                managerId={Number(userId)}
                managerRole="ASM"
                token={token}
              />
            </div>
            <div className="mt-4">
              <MissedVisitAlerts
                managerId={Number(userId)}
                token={token}
                managerRole="ASM"
              />
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
                    ])
                      .then(([plans, users]) => {
                        setTravelPlans(plans);
                        setTpUserMap(new Map(users.map((u) => [u.id, u])));
                      })
                      .catch(() => {})
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
            <DcrApproval portalRole={Role.ASM} />
          </TabsContent>

          {/* MTP APPROVALS */}
          <TabsContent value="mtp-approvals" data-ocid="mtp-approvals-tab">
            <MtpApproval portalRole={Role.ASM} />
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
            <ASMMonthlyTargets />
          </TabsContent>

          {/* WORKING STYLE REPORTS */}
          <TabsContent value="working-style">
            <ASMWorkingStyleReports />
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
