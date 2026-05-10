import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart2,
  BookOpen,
  Calendar,
  CheckCircle,
  DollarSign,
  Download,
  ExternalLink,
  FileText,
  MapPin,
  Package,
  RefreshCw,
  Stethoscope,
  Target,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
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
import type { StaffMarker } from "../../components/GPSMap";
import { KpiCard } from "../../components/KpiCard";
import { MissedVisitAlerts } from "../../components/MissedVisitAlerts";
import { MrDoctorVisitWidget } from "../../components/MrDoctorVisitWidget";
import { MyIncentiveWidget } from "../../components/MyIncentiveWidget";
import { NotificationInbox } from "../../components/NotificationInbox";
import { OnLeaveBanner } from "../../components/OnLeaveBanner";
import { PendingActionsWidget } from "../../components/PendingActionsWidget";
import {
  DataTable,
  PageContent,
  PageHeader,
  PortalLayout,
  StatCard,
} from "../../components/PortalLayout";
import { UpcomingBirthdaysWidget } from "../../components/UpcomingBirthdaysWidget";
import { useBirthdays } from "../../hooks/useBirthdays";
import { useDashboardData } from "../../hooks/useDashboardData";
import { usePendingCounts } from "../../hooks/usePendingCounts";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import type {
  AdditionalCharge,
  LeaveApplication,
  LocationRecord,
  MrMonthlySummary,
  TaDaExpense,
  TravelPlanInfo,
  UserInfo,
  ZsmKpis,
} from "../../types";
import { formatDate } from "../../utils/dateFormatter";
import BusinessReporting from "../crm/BusinessReporting";
import CrmRequests from "../crm/CrmRequests";
import SalesDashboard from "../crm/SalesDashboard";
import AdditionalRoleTab from "../shared/AdditionalRoleTab";
import BirthdayCalendarPage from "../shared/BirthdayCalendarPage";
import BookingManagement from "../shared/BookingManagement";
import LeaveApprovalPanel from "../shared/LeaveApprovalPanel";
import MRPortalPanel from "../shared/MRPortalPanel";
import PersonalTaDaForm from "../shared/PersonalTaDaForm";
import ZSMMonthlyTargets from "./ZSMMonthlyTargets";

type TabId =
  | "dashboard"
  | "team"
  | "gps"
  | "reports"
  | "expenses"
  | "leaves"
  | "performance"
  | "travel-plans"
  | "crm-requests"
  | "business-reports"
  | "sales-dashboard"
  | "booking"
  | "monthly-targets"
  | "birthday-calendar";

// Region performance summary derived from RSM + ASM + MR data
interface RegionRow {
  rsmId: bigint;
  regionName: string;
  rsmName: string;
  doctorCalls: number;
  doctorCallsTarget: number;
  chemistVisits: number;
  dcrRate: number;
  mrsNotCheckedIn: number;
}

export default function ZSMPortal() {
  const { session } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const birthdayData = useBirthdays();
  const currentUserId = String(session?.userId ?? "");
  const [reportees, setReportees] = useState<UserInfo[]>([]);
  const [allZoneUsers, setAllZoneUsers] = useState<UserInfo[]>([]);
  const [expenseSubTab, setExpenseSubTab] = useState<"approvals" | "personal">(
    "approvals",
  );
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [expenses, setExpenses] = useState<TaDaExpense[]>([]);
  const [leaves, setLeaves] = useState<LeaveApplication[]>([]);
  const [mrSummaries, setMrSummaries] = useState<MrMonthlySummary[]>([]);
  const [travelPlans, setTravelPlans] = useState<TravelPlanInfo[]>([]);
  const [tpUserMap, setTpUserMap] = useState<Map<bigint, UserInfo>>(new Map());

  const [charges, setCharges] = useState<AdditionalCharge[]>([]);
  const [showMRPortal, setShowMRPortal] = useState(false);

  const token = session?.token ?? "";
  const currentMonth = new Date().toISOString().slice(0, 7);

  // Phase-3 dashboard data
  const {
    data: dashData,
    loading: kpiLoading,
    refresh: kpiRefresh,
  } = useDashboardData(token);
  const { counts: pendingCounts } = usePendingCounts(token);

  const zsmKpis: ZsmKpis | null =
    dashData?.__kind__ === "zsm" ? dashData.zsm : null;

  const activeMRCharge = charges.find(
    (c) =>
      c.chargeType === ChargeType.Role &&
      c.additionalRole === Role.MR &&
      Date.now() * 1_000_000 >= Number(c.effectiveFrom) &&
      Date.now() * 1_000_000 <= Number(c.effectiveTo),
  );

  useEffect(() => {
    if (!token) return;
    Promise.all([
      api.getReporteeLocations(token),
      api.getPendingLeavesForManager(token),
      api.getPendingExpenses(token),
      api.listAllMrSummaries(currentMonth),
      session?.userId
        ? api.getActiveChargesForEmployee(token, session.userId)
        : Promise.resolve([]),
    ]).then(([locs, lv, ex, sums, ch]) => {
      setLocations(locs);
      if (lv.__kind__ === "ok") setLeaves(lv.ok);
      setExpenses(ex);
      setMrSummaries(sums);
      setCharges(ch as AdditionalCharge[]);
    });
  }, [token, currentMonth, session?.userId]);

  useEffect(() => {
    if (!token || activeTab !== "team") return;
    const uid = session?.userId ?? BigInt(0);
    Promise.all([
      api.listReportees(token, uid),
      api.listUsersByRole(token, Role.ASM),
      api.listUsersByRole(token, Role.MR),
    ]).then(([rsms, asms, mrs]) => {
      setReportees(rsms);
      setAllZoneUsers([...asms, ...mrs]);
    });
  }, [token, activeTab, session?.userId]);

  useEffect(() => {
    if (!token || activeTab !== "travel-plans") return;
    Promise.all([
      api.listAllTravelPlans(token, null, currentMonth),
      api.listAllUsers(token),
    ]).then(([plans, users]) => {
      setTravelPlans(plans);
      setTpUserMap(new Map(users.map((u) => [u.id, u])));
    });
  }, [token, activeTab, currentMonth]);

  const rsmList = reportees.filter((u) => u.role === Role.RSM);
  const asmList = allZoneUsers.filter((u) => u.role === Role.ASM);

  const allLocMarkers: StaffMarker[] = locations.map((loc) => ({
    location: loc,
    user: [...reportees, ...allZoneUsers].find((u) => u.id === loc.userId),
  }));

  const territoryData = mrSummaries.reduce<
    Record<string, { calls: number; doctors: number; orders: number }>
  >((acc, s) => {
    const mr = allZoneUsers.find((u) => u.id === s.mrId);
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

  const rsmPerformanceData = rsmList.map((rsm) => {
    const asmUnder = asmList.filter((a) => a.reportsTo === rsm.id);
    const mrUnder = allZoneUsers.filter(
      (m) => m.role === Role.MR && asmUnder.some((a) => a.id === m.reportsTo),
    );
    const mrSums = mrSummaries.filter((s) =>
      mrUnder.some((m) => m.id === s.mrId),
    );
    return {
      name: rsm.name.length > 14 ? `${rsm.name.slice(0, 14)}…` : rsm.name,
      asms: asmUnder.length,
      mrs: mrUnder.length,
      calls: mrSums.reduce((a, s) => a + Number(s.totalCalls), 0),
      orders: mrSums.reduce((a, s) => a + Number(s.totalOrders), 0),
    };
  });

  // Build region performance table rows
  const regionRows: RegionRow[] = rsmList.map((rsm) => {
    const asmUnder = asmList.filter((a) => a.reportsTo === rsm.id);
    const mrUnder = allZoneUsers.filter(
      (m) => m.role === Role.MR && asmUnder.some((a) => a.id === m.reportsTo),
    );
    const mrSums = mrSummaries.filter((s) =>
      mrUnder.some((m) => m.id === s.mrId),
    );
    return {
      rsmId: rsm.id,
      regionName: rsm.territory || rsm.name,
      rsmName: rsm.name,
      doctorCalls: mrSums.reduce((a, s) => a + Number(s.totalCalls), 0),
      doctorCallsTarget: mrUnder.length * 25,
      chemistVisits: mrSums.reduce((a, s) => a + Number(s.uniqueDoctors), 0),
      dcrRate:
        mrUnder.length > 0
          ? Math.min(
              100,
              Math.round((mrSums.length / (mrUnder.length * 22)) * 100),
            )
          : 0,
      mrsNotCheckedIn: 0,
    };
  });

  async function handleApproveExpense(expenseId: bigint, approved: boolean) {
    const res = await api.approveExpense(token, expenseId, approved);
    if (res.__kind__ === "ok") {
      toast.success(approved ? "Expense approved" : "Expense rejected");
      setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
    } else {
      toast.error(res.err);
    }
  }

  const pendingLeaveCount = Number(pendingCounts?.leavePending ?? 0);
  const pendingTadaCount = Number(pendingCounts?.tadaPending ?? 0);
  const pendingMtpCount = Number(pendingCounts?.mtpPending ?? 0);

  return (
    <PortalLayout portalRole={Role.ZSM}>
      <PageHeader
        title="ZSM Portal"
        subtitle="Zonal Sales Management — Krishkar Pharmaceuticals"
        actions={
          <div className="flex items-center gap-2">
            <NotificationInbox
              token={token}
              portalType="zsm"
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
          primaryRole="ZSM"
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
              My RSMs
            </TabsTrigger>
            <TabsTrigger value="gps" data-ocid="tab-gps">
              GPS Tracking
            </TabsTrigger>
            <TabsTrigger value="reports" data-ocid="tab-reports">
              Call Reports
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

          {/* ── DASHBOARD ─────────────────────────────────────────────── */}
          <TabsContent value="dashboard" data-ocid="zsm-dashboard.section">
            {/* Birthday flash */}
            <BirthdayFlash
              birthdays={birthdayData.todaysBirthdays}
              doctorBirthdays={birthdayData.doctorBirthdaysToday}
              currentUserId={currentUserId}
              isOwnBirthday={birthdayData.isCurrentUserBirthday}
            />
            <OnLeaveBanner />

            {/* KPI header row */}
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground">
                Zone KPIs — {currentMonth}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={kpiRefresh}
                disabled={kpiLoading}
                data-ocid="zsm-dashboard.kpi-refresh"
                className="h-7 text-xs"
              >
                <RefreshCw
                  className={`w-3 h-3 mr-1 ${kpiLoading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
            </div>

            {/* Zone-Level KPI Cards */}
            <div
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6"
              data-ocid="zsm-dashboard.kpi-grid"
            >
              <KpiCard
                title="Doctor Calls"
                value={
                  kpiLoading ? "…" : Number(zsmKpis?.zoneDoctorCallsCount ?? 0)
                }
                target={
                  kpiLoading
                    ? undefined
                    : Number(zsmKpis?.zoneDoctorCallsTarget ?? 0) || undefined
                }
                progressBar={!kpiLoading && !!zsmKpis?.zoneDoctorCallsTarget}
                icon={<Stethoscope className="w-4 h-4" />}
                accentColor="#0EA5E9"
                subtitle="vs zone target"
              />
              <KpiCard
                title="Chemist Visits"
                value={
                  kpiLoading ? "…" : Number(zsmKpis?.zoneChemistVisits ?? 0)
                }
                icon={<Users className="w-4 h-4" />}
                accentColor="#06B6D4"
                subtitle="zone this month"
              />
              <KpiCard
                title="DCR Rate"
                value={
                  kpiLoading
                    ? "…"
                    : `${Math.round((zsmKpis?.zoneDcrRate ?? 0) * 100) / 100}%`
                }
                target={100}
                progressBar={!kpiLoading}
                icon={<FileText className="w-4 h-4" />}
                accentColor="#10B981"
                subtitle="on-time submissions"
              />
              <KpiCard
                title="MRs Not Checked-In"
                value={
                  kpiLoading ? "…" : Number(zsmKpis?.mrsNotCheckedInToday ?? 0)
                }
                icon={<MapPin className="w-4 h-4" />}
                accentColor={
                  Number(zsmKpis?.mrsNotCheckedInToday ?? 0) > 0
                    ? "#EF4444"
                    : "#10B981"
                }
                subtitle="today"
              />
              <KpiCard
                title="Pending Approvals"
                value={
                  kpiLoading ? "…" : Number(zsmKpis?.pendingApprovals ?? 0)
                }
                icon={<Target className="w-4 h-4" />}
                accentColor={
                  Number(zsmKpis?.pendingApprovals ?? 0) > 0
                    ? "#F97316"
                    : "#10B981"
                }
                subtitle="across zone"
              />
              <KpiCard
                title="MTP Adherence"
                value={
                  kpiLoading
                    ? "…"
                    : `${Math.round((zsmKpis?.mtpAdherenceRate ?? 0) * 100) / 100}%`
                }
                target={100}
                progressBar={!kpiLoading}
                icon={<TrendingUp className="w-4 h-4" />}
                accentColor="#8B5CF6"
                subtitle="planned vs actual"
              />
            </div>

            {/* Region Performance Summary */}
            <div
              className="bg-card border border-border rounded-xl mb-6 overflow-hidden"
              data-ocid="zsm-dashboard.region-table"
            >
              <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
                <h3 className="text-xs uppercase tracking-wider font-display font-semibold text-muted-foreground flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-primary" />
                  Region Performance Summary — {currentMonth}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {regionRows.length} regions
                </span>
              </div>
              {regionRows.length === 0 ? (
                <div
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                  data-ocid="zsm-dashboard.region-table.empty_state"
                >
                  <p>Visit the Team tab to load RSM data, then return here.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/10">
                        <th className="px-4 py-2.5 text-left text-xs font-display font-semibold text-muted-foreground uppercase tracking-wide">
                          Region / RSM
                        </th>
                        <th className="px-4 py-2.5 text-right text-xs font-display font-semibold text-muted-foreground uppercase tracking-wide">
                          Dr Calls
                        </th>
                        <th className="px-4 py-2.5 text-right text-xs font-display font-semibold text-muted-foreground uppercase tracking-wide">
                          Chemist
                        </th>
                        <th className="px-4 py-2.5 text-right text-xs font-display font-semibold text-muted-foreground uppercase tracking-wide">
                          DCR %
                        </th>
                        <th className="px-4 py-2.5 text-right text-xs font-display font-semibold text-muted-foreground uppercase tracking-wide">
                          Not Checked-In
                        </th>
                        <th className="px-4 py-2.5 text-right text-xs font-display font-semibold text-muted-foreground uppercase tracking-wide">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {regionRows.map((row, idx) => (
                        <tr
                          key={String(row.rsmId)}
                          className="hover:bg-muted/20 transition-colors"
                          data-ocid={`zsm-dashboard.region-table.item.${idx + 1}`}
                        >
                          <td className="px-4 py-3">
                            <p className="font-medium text-foreground text-sm">
                              {row.regionName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {row.rsmName} · RSM
                            </p>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-foreground text-sm">
                            <span>{row.doctorCalls}</span>
                            {row.doctorCallsTarget > 0 && (
                              <span className="text-xs text-muted-foreground ml-1">
                                /{row.doctorCallsTarget}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-foreground text-sm">
                            {row.chemistVisits}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${row.dcrRate >= 80 ? "bg-emerald-100 text-emerald-700" : row.dcrRate >= 60 ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"}`}
                            >
                              {row.dcrRate}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className={`text-sm font-mono font-semibold ${row.mrsNotCheckedIn > 0 ? "text-destructive" : "text-muted-foreground"}`}
                            >
                              {row.mrsNotCheckedIn}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => setActiveTab("performance")}
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                              data-ocid={`zsm-dashboard.region-table.view-details.${idx + 1}`}
                            >
                              View Details <ExternalLink className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pending Approvals + Birthdays row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              <PendingActionsWidget
                title="Pending Approvals"
                items={[
                  {
                    label: "Leave Applications",
                    count: pendingLeaveCount,
                    urgency: "high",
                    onClick: () => setActiveTab("leaves"),
                  },
                  {
                    label: "TA/DA Claims",
                    count: pendingTadaCount,
                    urgency: "medium",
                    onClick: () => setActiveTab("expenses"),
                  },
                  {
                    label: "MTP Approvals",
                    count: pendingMtpCount,
                    urgency: "medium",
                    onClick: () => setActiveTab("travel-plans"),
                  },
                ]}
              />
              <UpcomingBirthdaysWidget
                upcoming={birthdayData.upcomingBirthdays}
                upcomingDoctors={birthdayData.doctorBirthdaysToday}
                loading={birthdayData.loadingUpcoming}
                onViewAll={() => setActiveTab("birthday-calendar")}
              />
            </div>

            {/* Doctor Visit Trend */}
            <div className="mt-4">
              <DoctorVisitTrendChart
                managerId={Number(session?.userId ?? 0)}
                managerRole="ZSM"
                token={token}
              />
            </div>

            {/* MR Doctor Visit Widget */}
            <div className="mt-4">
              <MrDoctorVisitWidget
                reportees={allZoneUsers.filter((u) => u.role === Role.MR)}
                month={currentMonth}
              />
            </div>

            {/* Missed Visit Alerts */}
            <div className="mt-4">
              <MissedVisitAlerts
                managerId={Number(session?.userId ?? 0)}
                token={token}
                managerRole="ZSM"
              />
            </div>

            {/* My Incentive */}
            <div className="mt-4">
              <MyIncentiveWidget />
            </div>

            {/* Downloads */}
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href="/shared/pricelist"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                data-ocid="zsm-dashboard.pricelist-btn"
              >
                <Download className="w-4 h-4" />
                Download Pricelist
              </a>
            </div>
          </TabsContent>

          {/* ── BIRTHDAY CALENDAR ────────────────────────────────── */}
          <TabsContent
            value="birthday-calendar"
            data-ocid="birthday-calendar-tab"
          >
            <BirthdayCalendarPage />
          </TabsContent>

          {/* MY RSMs */}
          <TabsContent value="team">
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="font-display font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3">
                  RSMs in Zone ({reportees.length})
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
                  emptyMessage="Switch to the Team tab to load RSM list."
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
              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="font-display font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3">
                  ASMs in Zone ({asmList.length})
                </h3>
                <DataTable<UserInfo>
                  columns={[
                    { key: "name", label: "Name" },
                    { key: "empId", label: "Emp ID" },
                    { key: "territory", label: "Territory" },
                    { key: "phone", label: "Phone" },
                    { key: "status", label: "Status" },
                  ]}
                  data={asmList}
                  getKey={(item) => String(item.id)}
                  emptyMessage="No ASMs loaded yet."
                  renderRow={(user) => (
                    <>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground text-sm">
                          {user.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {user.designation}
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
            </div>
          </TabsContent>

          {/* GPS */}
          <TabsContent value="gps">
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                  Zonal Field Staff — {locations.length} tracked
                </h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    api.getReporteeLocations(token).then(setLocations)
                  }
                  data-ocid="btn-refresh-gps"
                >
                  Refresh
                </Button>
              </div>
              <GPSMap markers={allLocMarkers} height="380px" />
            </div>
          </TabsContent>

          {/* CALL REPORTS */}
          <TabsContent value="reports">
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="font-display font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-1.5">
                <FileText className="w-4 h-4" /> Zonal Call Reports — MTD
                Summary
              </h3>
              <DataTable<MrMonthlySummary>
                columns={[
                  { key: "mrId", label: "MR" },
                  {
                    key: "calls",
                    label: "Total Calls",
                    className: "text-right",
                  },
                  { key: "doctors", label: "Doctors", className: "text-right" },
                  { key: "orders", label: "Orders", className: "text-right" },
                  {
                    key: "value",
                    label: "Order Value (₹)",
                    className: "text-right",
                  },
                ]}
                data={mrSummaries}
                getKey={(item) => String(item.mrId)}
                emptyMessage="No call report summaries available for this month."
                renderRow={(s) => {
                  const mr = allZoneUsers.find((u) => u.id === s.mrId);
                  return (
                    <>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground text-sm">
                          {mr?.name ?? `MR #${s.mrId}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {mr?.territory || "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-foreground">
                        {String(s.totalCalls)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-foreground">
                        {String(s.uniqueDoctors)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-foreground">
                        {String(s.totalOrders)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">
                        {Number(s.totalOrderValue).toLocaleString("en-IN")}
                      </td>
                    </>
                  );
                }}
              />
            </div>
          </TabsContent>

          {/* EXPENSE APPROVALS + Personal TA/DA */}
          <TabsContent value="expenses">
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setExpenseSubTab("approvals")}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${expenseSubTab === "approvals" ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}
                  data-ocid="zsm-expenses.tab-approvals"
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
                  data-ocid="zsm-expenses.tab-personal"
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
                    {
                      key: "total",
                      label: "Total (₹)",
                      className: "text-right",
                    },
                    { key: "status", label: "Status" },
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
                        {formatDate(exp.date)}
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
                        ₹{Number(exp.totalAmount).toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs">
                          {String(
                            (exp.status as unknown as { __kind__?: string })
                              .__kind__ ?? exp.status,
                          )}
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

              {expenseSubTab === "personal" && (
                <PersonalTaDaForm roleLabel="ZSM" />
              )}
            </div>
          </TabsContent>

          {/* LEAVE APPROVALS */}
          <TabsContent value="leaves">
            <LeaveApprovalPanel token={token} />
          </TabsContent>

          {/* PERFORMANCE */}
          <TabsContent value="performance">
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="font-display font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-4 flex items-center gap-1.5">
                  <BarChart2 className="w-4 h-4" /> RSM-wise Zone Performance —{" "}
                  {currentMonth}
                </h3>
                {rsmPerformanceData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={rsmPerformanceData}
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
                      <Bar
                        dataKey="calls"
                        name="Total Calls"
                        fill="var(--chart-1)"
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
                    No RSM performance data — visit Team tab first to load data.
                  </p>
                )}
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="font-display font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-4 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4" /> Territory Coverage —{" "}
                  {currentMonth}
                </h3>
                {territoryChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart
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
                        dataKey="doctors"
                        name="Doctors Covered"
                        stroke="var(--chart-3)"
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
                    No territory performance data for {currentMonth}
                  </p>
                )}
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
                      {formatDate(tp.date)}
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
            <ZSMMonthlyTargets />
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
                    {formatDate(Number(charge.effectiveTo) / 1_000_000)}
                  </span>
                </div>
              ))}
          </div>
        )}
      </PageContent>
    </PortalLayout>
  );
}
