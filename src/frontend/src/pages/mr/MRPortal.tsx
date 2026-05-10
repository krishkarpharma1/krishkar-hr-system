import { useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Download,
  FileText,
  MapPin,
  Package,
  RefreshCw,
  Settings,
  ShoppingCart,
  Stethoscope,
  Target,
  TrendingUp,
  UserCog,
  UserRoundCheck,
  X,
} from "lucide-react";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Role } from "../../backend";
import type { NotificationRecord } from "../../backend.d";
import { BirthdayFlash } from "../../components/BirthdayFlash";
import { KpiCard } from "../../components/KpiCard";
import { MyIncentiveWidget } from "../../components/MyIncentiveWidget";
import { OnLeaveBanner } from "../../components/OnLeaveBanner";
import type { PendingActionItem } from "../../components/PendingActionsWidget";
import { PendingActionsWidget } from "../../components/PendingActionsWidget";
import {
  PageContent,
  PageHeader,
  PortalLayout,
  StatCard,
} from "../../components/PortalLayout";
import type { QuickAction } from "../../components/QuickActionsBar";
import { QuickActionsBar } from "../../components/QuickActionsBar";
import { RecentActivityFeed } from "../../components/RecentActivityFeed";
import { UpcomingBirthdaysWidget } from "../../components/UpcomingBirthdaysWidget";
import { useBirthdays } from "../../hooks/useBirthdays";
import { useDashboardData } from "../../hooks/useDashboardData";
import { isMobileDevice } from "../../hooks/useGps";
import { usePendingCounts } from "../../hooks/usePendingCounts";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import type {
  AdditionalCharge,
  DcrReminderStatus,
  MrMonthlySummary,
  TravelPlanInfo,
  UserInfo,
  WorkingStyleRecord,
} from "../../types";
import { formatDate } from "../../utils/dateFormatter";
import AdditionalRoleTab from "../shared/AdditionalRoleTab";
import DoctorCallModal from "./DoctorCallModal";

interface MissedDoctorItem {
  doctorName: string;
  visitCount: number;
}

// 5 primary colored action buttons
interface QuickActionBtn {
  id: string;
  label: string;
  completedLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Tailwind bg class for active state e.g. "bg-sky-500 hover:bg-sky-600" */
  activeClass: string;
  /** Tailwind text+border classes for completed (muted) state */
  doneClass: string;
  navigate?: string;
  modalAction?: "doctorCall";
  isCompleted?: boolean;
}

const SECONDARY_ACTIONS = [
  { label: "My Monthly Target", path: "/mr/monthly-targets", icon: Target },
  { label: "My KPIs", path: "/mr/kpi", icon: TrendingUp },
  { label: "Daily Call Report (DCR)", path: "/mr/dcr", icon: ClipboardList },
  { label: "Call Reports (30 Days)", path: "/mr/call-reports", icon: FileText },
  { label: "Travel Plan / MTP", path: "/mr/travel-plans", icon: CalendarPlus },
  {
    label: "Field Visit Reports",
    path: "/mr/jfw-reports",
    icon: ClipboardList,
  },
  { label: "Sample Balance", path: "/mr/sfa/sample-balance", icon: Package },
  { label: "Sample Ledger", path: "/mr/sample-ledger", icon: Package },
  { label: "Add Doctor", path: "/mr/doctors", icon: Stethoscope },
  { label: "Add Chemist", path: "/mr/chemists", icon: ShoppingCart },
  {
    label: "Chemist Visit Entry",
    path: "/mr/chemist-call",
    icon: ShoppingCart,
  },
  { label: "Stockist Visit Entry", path: "/mr/stockist-call", icon: Package },
  { label: "Submit Expense", path: "/mr/expenses", icon: MapPin },
  { label: "Booking Requests", path: "/mr/booking", icon: Package },
  { label: "My Reports Export", path: "/mr/my-reports", icon: Download },
  { label: "Download Pricelist", path: "/shared/pricelist", icon: Download },
];

const MAX_TICKER_NAMES = 5;

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

function getFirstName(fullName: string): string {
  return fullName.split(" ")[0] ?? fullName;
}

function getMonthDateRange(): { firstDay: string; lastDay: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDate = new Date(year, month, 0).getDate();
  const lastDay = `${year}-${String(month).padStart(2, "0")}-${String(lastDate).padStart(2, "0")}`;
  return { firstDay, lastDay };
}

// ── DCR status badge ──────────────────────────────────────────────────────

interface DcrStatusBadgeProps {
  submitted: boolean;
  isLate?: boolean;
  approved?: boolean;
}

function DcrStatusBadge({ submitted, isLate, approved }: DcrStatusBadgeProps) {
  if (!submitted) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
        Not Submitted
      </span>
    );
  }
  if (approved) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 border border-green-200">
        Approved ✓
      </span>
    );
  }
  if (isLate) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-200">
        Late
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-700 border border-sky-200">
      Submitted
    </span>
  );
}

// ── KPI Skeleton ──────────────────────────────────────────────────────────

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton indices are stable
          key={i}
          className="h-28 rounded-xl bg-muted/60 animate-pulse"
        />
      ))}
    </div>
  );
}

export default function MRPortal() {
  const session = useAuthStore((s) => s.session);
  const navigate = useNavigate();
  const birthdayData = useBirthdays();
  const currentUserId = String(session?.userId ?? "");

  const [summary, setSummary] = useState<MrMonthlySummary | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [charges, setCharges] = useState<AdditionalCharge[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [missedDoctors, setMissedDoctors] = useState<MissedDoctorItem[]>([]);
  const [showDoctorCallModal, setShowDoctorCallModal] = useState(false);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [workingStyleSubmitted, setWorkingStyleSubmitted] = useState(false);

  // GPS permission warning banner
  const [gpsPermissionDenied, setGpsPermissionDenied] = useState(false);
  const [showGpsBannerDismissed, setShowGpsBannerDismissed] = useState(false);

  // Notification permission banner
  const [notifPermission, setNotifPermission] =
    useState<NotificationPermission | null>(null);
  const [notifBannerDismissed, setNotifBannerDismissed] = useState(
    () => sessionStorage.getItem("mr_notif_banner_dismissed") === "1",
  );

  // DCR reminder status for today
  const [dcrStatus, setDcrStatus] = useState<DcrReminderStatus | null>(null);

  // SFA reminder banners
  const [showDcrReminderBanner, setShowDcrReminderBanner] = useState(false);
  const [showMtpReminderBanner, setShowMtpReminderBanner] = useState(false);
  const [mtpDeadlineDate, setMtpDeadlineDate] = useState<string>("");
  const [mtpDaysLeft, setMtpDaysLeft] = useState(0);
  const [mtpNextMonth, setMtpNextMonth] = useState<string>("");

  // Today's tour plan from MTP
  const [todayTourPlan, setTodayTourPlan] = useState<TravelPlanInfo | null>(
    null,
  );
  const [tourPlanLoading, setTourPlanLoading] = useState(false);

  // Recent activity from notifications
  const [recentActivity, setRecentActivity] = useState<NotificationRecord[]>(
    [],
  );

  // ── SFA KPI data ─────────────────────────────────────────────────────────
  const { firstDay, lastDay } = getMonthDateRange();
  const {
    data: dashboardData,
    loading: kpiLoading,
    error: kpiError,
    refresh: refreshKpi,
  } = useDashboardData(session?.token, firstDay, lastDay);

  // ── Pending counts ────────────────────────────────────────────────────────
  const { counts: pendingCounts } = usePendingCounts(session?.token);

  // ── MR KPIs ───────────────────────────────────────────────────────────────
  const mrKpis = dashboardData?.__kind__ === "mr" ? dashboardData.mr : null;

  // Check GPS permission on mount and when the page regains visibility
  useEffect(() => {
    if (!isMobileDevice()) return;

    function checkGpsPermission() {
      if ("permissions" in navigator) {
        navigator.permissions
          .query({ name: "geolocation" as PermissionName })
          .then((result) => {
            setGpsPermissionDenied(result.state === "denied");
            result.onchange = () => {
              setGpsPermissionDenied(result.state === "denied");
              if (result.state !== "denied") setShowGpsBannerDismissed(false);
            };
          })
          .catch(() => setGpsPermissionDenied(false));
      } else {
        const geo = (navigator as Navigator).geolocation;
        if (geo) {
          geo.getCurrentPosition(
            () => setGpsPermissionDenied(false),
            (err) => setGpsPermissionDenied(err.code === err.PERMISSION_DENIED),
            { timeout: 3000, maximumAge: 60_000 },
          );
        }
      }
    }

    checkGpsPermission();
    document.addEventListener("visibilitychange", checkGpsPermission);
    window.addEventListener("focus", checkGpsPermission);
    return () => {
      document.removeEventListener("visibilitychange", checkGpsPermission);
      window.removeEventListener("focus", checkGpsPermission);
    };
  }, []);

  // Check notification permission on mount
  useEffect(() => {
    if (!("Notification" in window)) return;
    setNotifPermission(Notification.permission);
  }, []);

  function handleEnableNotifications() {
    if (!("Notification" in window)) return;
    Notification.requestPermission().then((perm) => {
      setNotifPermission(perm);
      if (perm !== "default") {
        sessionStorage.setItem("mr_notif_banner_dismissed", "1");
        setNotifBannerDismissed(true);
      }
    });
  }

  function dismissNotifBanner() {
    sessionStorage.setItem("mr_notif_banner_dismissed", "1");
    setNotifBannerDismissed(true);
  }

  // Stable date constants — computed once at mount
  const todayDate = new Date();
  const currentMonth = todayDate.getMonth() + 1;
  const currentYear = todayDate.getFullYear();

  useEffect(() => {
    if (!session) return;
    const today = new Date();
    const todayISOStr = today.toISOString().slice(0, 10);
    const month = today.toISOString().slice(0, 7);
    const empId = session.employeeId ?? "";

    setLoadError(false);
    setLoading(true);

    Promise.all([
      api.getMrMonthlySummary(session.userId, month),
      api.getUser(session.token, session.userId),
      api.getActiveChargesForEmployee(session.token, session.userId),
      api.getMyCheckIns(session.token),
      empId ? api.getTodayWorkingStyle(empId) : Promise.resolve(null),
    ])
      .then(([s, uInfo, ch, checkIns, ws]) => {
        setSummary(s);
        if (uInfo) setUserInfo(uInfo);
        setCharges(ch);
        const hasCheckedInToday =
          Array.isArray(checkIns) &&
          checkIns.some((ci: { date?: string; checkInDate?: string }) => {
            const d = ci.date ?? ci.checkInDate ?? "";
            return d === todayISOStr;
          });
        setCheckedInToday(hasCheckedInToday);
        if (ws) {
          const wsRecord = ws as WorkingStyleRecord;
          const wsDate = new Date(Number(wsRecord.date) / 1_000_000)
            .toISOString()
            .slice(0, 10);
          setWorkingStyleSubmitted(wsDate === todayISOStr);
        }
      })
      .catch((err) => {
        console.error("[MRPortal] Dashboard load error:", err);
        setLoadError(true);
        toast.error("Failed to load dashboard data. Please refresh.");
      })
      .finally(() => setLoading(false));

    fetchMissedDoctors(session.token, session.userId);
    fetchDcrStatus(session.token, todayISOStr);
    fetchTodayTourPlan(session.token, todayISOStr);
    fetchRecentActivity(session.token);
    checkSfaReminders(session.token, session.userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const fetchMissedDoctors = async (token: string, userId: bigint) => {
    try {
      const rawApi = api as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof rawApi.getMissedDoctorsForMR === "function") {
        const res = await rawApi.getMissedDoctorsForMR(
          token,
          userId,
          BigInt(currentMonth),
          BigInt(currentYear),
        );
        const result = res as {
          __kind__: string;
          ok?: Array<{
            doctorId: bigint;
            doctorName: string;
            visitCount: bigint;
          }>;
        };
        if (result.__kind__ === "ok" && Array.isArray(result.ok)) {
          setMissedDoctors(
            result.ok
              .filter((d) => Number(d.visitCount) < 2)
              .map((d) => ({
                doctorName: d.doctorName,
                visitCount: Number(d.visitCount),
              })),
          );
        }
      }
    } catch {
      // ignore — ticker is non-critical
    }
  };

  const fetchDcrStatus = async (token: string, date: string) => {
    try {
      const result = await api.getDcrReminderStatus(token, date);
      setDcrStatus(result);
    } catch {
      // non-critical — silently fall back to null
    }
  };

  const fetchTodayTourPlan = async (token: string, date: string) => {
    setTourPlanLoading(true);
    try {
      const month = date.slice(0, 7); // YYYY-MM
      const plans = await api.listMyTravelPlans(token, month);
      const todayPlan = plans.find((p: TravelPlanInfo) => p.date === date);
      setTodayTourPlan(todayPlan ?? null);
    } catch {
      // non-critical
    } finally {
      setTourPlanLoading(false);
    }
  };

  const checkSfaReminders = async (token: string, userId: bigint) => {
    const dcrKey = `dcrReminderTriggeredToday=${new Date().toISOString().slice(0, 10)}`;
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    const mtpKey = `mtpReminderTriggeredThisMonth=${currentYear}-${String(currentMonth).padStart(2, "0")}`;

    try {
      const rawApi = api as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      if (typeof rawApi.getSfaReminderSettings !== "function") return;

      const settingsResult = (await rawApi.getSfaReminderSettings(token)) as {
        __kind__: string;
        ok?: {
          dcrReminderEnabled: boolean;
          dcrReminderHour: bigint;
          mtpReminderEnabled: boolean;
          mtpDeadlineDay: bigint;
          mtpReminderDaysBeforeDeadline: bigint;
        };
      };
      if (settingsResult.__kind__ !== "ok" || !settingsResult.ok) return;
      const settings = settingsResult.ok;

      // ── DCR Reminder ──────────────────────────────────────────────────────
      if (
        settings.dcrReminderEnabled &&
        today.getHours() >= Number(settings.dcrReminderHour) &&
        !sessionStorage.getItem(dcrKey)
      ) {
        const todayStr = today.toISOString().slice(0, 10);
        const dcrRes = (await rawApi.getDcrUnsubmittedMRs(token, todayStr)) as {
          __kind__: string;
          ok?: bigint[];
        };
        if (dcrRes.__kind__ === "ok" && Array.isArray(dcrRes.ok)) {
          const unsubmitted = dcrRes.ok as bigint[];
          if (unsubmitted.some((id) => id === userId)) {
            // Fire in-app notification
            await rawApi.createDcrReminder(token, userId).catch(() => null);
            setShowDcrReminderBanner(true);
          }
        }
        sessionStorage.setItem(dcrKey, "1");
      }

      // ── MTP Reminder ──────────────────────────────────────────────────────
      const deadlineDay = Number(settings.mtpDeadlineDay);
      const daysBeforeDeadline = deadlineDay - currentDay;
      if (
        settings.mtpReminderEnabled &&
        daysBeforeDeadline >= 0 &&
        daysBeforeDeadline <= Number(settings.mtpReminderDaysBeforeDeadline) &&
        !sessionStorage.getItem(mtpKey)
      ) {
        // Next month for which MTP is needed
        const nextMonthDate = new Date(currentYear, currentMonth, 1);
        const nextMonth = BigInt(nextMonthDate.getMonth() + 1);
        const nextYear = BigInt(nextMonthDate.getFullYear());
        const nextMonthLabel = nextMonthDate.toLocaleDateString("en-IN", {
          month: "long",
          year: "numeric",
        });
        const deadlineDateStr = `${String(deadlineDay).padStart(2, "0")}-${String(currentMonth).padStart(2, "0")}-${currentYear}`;

        const mtpRes = (await rawApi.getMtpUnsubmittedMRs(
          token,
          nextMonth,
          nextYear,
        )) as {
          __kind__: string;
          ok?: bigint[];
        };
        if (mtpRes.__kind__ === "ok" && Array.isArray(mtpRes.ok)) {
          const unsubmitted = mtpRes.ok as bigint[];
          if (unsubmitted.some((id) => id === userId)) {
            await rawApi.createMtpReminder(token, userId).catch(() => null);
            setMtpDaysLeft(daysBeforeDeadline);
            setMtpDeadlineDate(deadlineDateStr);
            setMtpNextMonth(nextMonthLabel);
            setShowMtpReminderBanner(true);
          }
        }
        sessionStorage.setItem(mtpKey, "1");
      }
    } catch {
      // non-critical — reminder banners fail silently
    }
  };

  const fetchRecentActivity = async (token: string) => {
    try {
      const notifications = await api.getMyNotifications(token);
      // Sort newest first and take last 5
      const sorted = [...notifications].sort(
        (a, b) => Number(b.createdAt) - Number(a.createdAt),
      );
      setRecentActivity(sorted.slice(0, 5));
    } catch {
      // non-critical
    }
  };

  const activeRoleCharges = charges.filter(
    (c) => c.chargeType === "Role" && c.additionalRole,
  );

  // Ticker: limit to first 5 names then show "…and X more"
  const tickerVisible = missedDoctors.slice(0, MAX_TICKER_NAMES);
  const tickerExtra = missedDoctors.length - MAX_TICKER_NAMES;
  const tickerNamesText = tickerVisible
    .map(
      (d) =>
        `Dr. ${d.doctorName} (${d.visitCount === 0 ? "0 visits" : "1 visit"})`,
    )
    .join("   •   ");
  const tickerSuffix = tickerExtra > 0 ? `   •   …and ${tickerExtra} more` : "";
  const tickerText = tickerNamesText + tickerSuffix;

  // Primary action buttons definition
  const primaryActions: QuickActionBtn[] = [
    {
      id: "attendance",
      label: "Attendance Check-In",
      completedLabel: "Checked In ✓",
      icon: UserRoundCheck,
      activeClass: "bg-sky-600 hover:bg-sky-700 text-white border-transparent",
      doneClass: "bg-sky-100 text-sky-700 border-sky-300",
      navigate: "/mr/checkin",
      isCompleted: checkedInToday,
    },
    {
      id: "working-style",
      label: "Working Style",
      completedLabel: "Submitted ✓",
      icon: ClipboardList,
      activeClass:
        "bg-orange-500 hover:bg-orange-600 text-white border-transparent",
      doneClass: "bg-orange-100 text-orange-700 border-orange-300",
      navigate: "/mr/working-style",
      isCompleted: workingStyleSubmitted,
    },
    {
      id: "doctor-call",
      label: "Doctor Call",
      completedLabel: "Doctor Call",
      icon: Stethoscope,
      activeClass:
        "bg-green-600 hover:bg-green-700 text-white border-transparent",
      doneClass: "bg-green-100 text-green-700 border-green-300",
      modalAction: "doctorCall",
      isCompleted: false,
    },
    {
      id: "travel-plan",
      label: "Travel Plan",
      completedLabel: "Travel Plan",
      icon: CalendarPlus,
      activeClass:
        "bg-violet-600 hover:bg-violet-700 text-white border-transparent",
      doneClass: "bg-violet-100 text-violet-700 border-violet-300",
      navigate: "/mr/travel-plans",
      isCompleted: false,
    },
    {
      id: "leave",
      label: "Leave Application",
      completedLabel: "Leave Application",
      icon: CalendarDays,
      activeClass: "bg-red-600 hover:bg-red-700 text-white border-transparent",
      doneClass: "bg-red-100 text-red-700 border-red-300",
      navigate: "/mr/leave",
      isCompleted: false,
    },
  ];

  function handlePrimaryAction(btn: QuickActionBtn) {
    if (btn.modalAction === "doctorCall") {
      setShowDoctorCallModal(true);
      return;
    }
    if (btn.navigate) {
      navigate({ to: btn.navigate });
    }
  }

  // ── Pending Actions items ─────────────────────────────────────────────────
  const pendingActionItems: PendingActionItem[] = [
    {
      label: "Leave Applications Pending",
      count: Number(pendingCounts?.leavePending ?? 0),
      urgency: "high",
      onClick: () => {
        window.location.href = "/mr/leave";
      },
    },
    {
      label: "TA/DA Claims Pending",
      count: Number(pendingCounts?.tadaPending ?? 0),
      urgency: "medium",
      onClick: () => {
        window.location.href = "/mr/expenses";
      },
    },
    {
      label: "DCR Rejected — Resubmit",
      count: 0,
      urgency: "high",
      onClick: () => {
        window.location.href = "/mr/dcr";
      },
    },
    {
      label: "MTP Pending Approval",
      count: Number(pendingCounts?.mtpPending ?? 0),
      urgency: "medium",
      onClick: () => {
        window.location.href = "/mr/travel-plans";
      },
    },
    {
      label: "Today's DCR Not Submitted",
      count:
        dcrStatus && !dcrStatus.dcrSubmitted && dcrStatus.checkedIn ? 1 : 0,
      urgency: "low",
      onClick: () => {
        window.location.href = "/mr/dcr";
      },
    },
  ];

  // ── Quick Actions bar ─────────────────────────────────────────────────────
  const dcrDone = dcrStatus?.dcrSubmitted ?? false;
  const quickActions: QuickAction[] = [
    {
      label: "New Doctor Call",
      icon: <Stethoscope className="w-4 h-4" />,
      onClick: () => setShowDoctorCallModal(true),
      primary: true,
    },
    {
      label: "New Chemist Visit",
      icon: <ShoppingCart className="w-4 h-4" />,
      onClick: () => {
        window.location.href = "/mr/chemist-call";
      },
      primary: true,
    },
    {
      label: dcrDone ? "DCR Submitted ✓" : "Submit DCR",
      icon: <ClipboardList className="w-4 h-4" />,
      onClick: () => {
        window.location.href = "/mr/dcr";
      },
      primary: !dcrDone,
    },
    {
      label: checkedInToday ? "Check-Out" : "Check-In",
      icon: <UserRoundCheck className="w-4 h-4" />,
      onClick: () => {
        window.location.href = "/mr/checkin";
      },
      primary: !checkedInToday,
    },
    {
      label: "New TA/DA Claim",
      icon: <FileText className="w-4 h-4" />,
      onClick: () => {
        window.location.href = "/mr/expenses";
      },
      primary: false,
    },
  ];

  // ── Activity feed from notifications ─────────────────────────────────────
  function notifTypeToActivityType(notifType: string): string {
    const t = notifType.toLowerCase();
    if (t.includes("doctor") || t.includes("call")) return "doctor_call";
    if (t.includes("chemist")) return "chemist_visit";
    if (t.includes("stockist")) return "stockist_visit";
    if (t.includes("dcr")) return "dcr";
    if (t.includes("leave")) return "leave";
    if (t.includes("attendance") || t.includes("checkin")) return "attendance";
    return "default";
  }

  const activityItems = recentActivity.map((n) => ({
    id: n.id,
    type: notifTypeToActivityType(String(n.notificationType)),
    description: n.body,
    timestamp: Number(n.createdAt) / 1_000_000,
  }));

  return (
    <PortalLayout portalRole={Role.MR}>
      {/* ── Missed Doctors Scrolling Ticker ───────────────────────────────── */}
      {missedDoctors.length > 0 && (
        <div
          className="w-full bg-destructive flex items-center overflow-hidden flex-shrink-0"
          style={{ height: "36px" }}
          data-ocid="missed-doctors-ticker"
        >
          <div className="flex-shrink-0 flex items-center gap-1 px-2.5 bg-destructive/80 h-full border-r border-white/20">
            <AlertTriangle className="w-3.5 h-3.5 text-white flex-shrink-0" />
            <span className="text-white text-xs font-bold whitespace-nowrap hidden sm:inline">
              MISSED DOCTORS
            </span>
          </div>
          <div className="flex-1 overflow-hidden relative">
            <div
              className="whitespace-nowrap font-bold text-white"
              style={{
                fontSize: "clamp(0.65rem, 2.5vw, 0.8rem)",
                animation: "ticker-scroll 35s linear infinite",
                display: "inline-block",
                willChange: "transform",
              }}
            >
              ⚠ {tickerText} &nbsp;&nbsp;&nbsp;&nbsp; ⚠ {tickerText}
            </div>
          </div>
          <a
            href="/mr/reports"
            className="flex-shrink-0 px-2.5 h-full flex items-center text-white text-xs underline underline-offset-2 hover:text-white/80 transition-colors border-l border-white/20 whitespace-nowrap"
            data-ocid="ticker-view-all"
          >
            View All
          </a>
          <style>{`
            @keyframes ticker-scroll {
              0% { transform: translateX(100%); }
              100% { transform: translateX(-100%); }
            }
            @media (prefers-reduced-motion: reduce) {
              [data-ocid="missed-doctors-ticker"] div[style] {
                animation: none !important;
                transform: translateX(0) !important;
              }
            }
          `}</style>
        </div>
      )}

      <PageHeader
        title={`${getGreeting()}, ${getFirstName(session?.name ?? "—")}`}
        subtitle={`${todayDate.toLocaleDateString("en-IN", { weekday: "long" })}, ${formatDate(todayDate.getTime())}`}
      />

      <PageContent>
        {/* ── Notification Permission Banner ── */}
        {notifPermission === "default" && !notifBannerDismissed && (
          <div
            className="flex items-start gap-3 mb-4 px-4 py-3 rounded-xl bg-sky-50 border border-sky-300"
            data-ocid="mr-notif-permission-banner"
          >
            <Bell className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-sky-800">
                Enable notifications
              </p>
              <p className="text-xs text-sky-700 mt-0.5">
                Receive alerts when your team submits Doctor Calls and other
                field activities.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleEnableNotifications}
                className="flex items-center gap-1 text-xs font-semibold text-sky-700 bg-sky-100 hover:bg-sky-200 border border-sky-300 rounded px-2.5 py-1 transition-colors"
                data-ocid="mr-notif-enable-btn"
              >
                Enable
              </button>
              <button
                type="button"
                onClick={dismissNotifBanner}
                className="p-1 rounded-full hover:bg-sky-200 transition-colors"
                aria-label="Dismiss notification permission prompt"
                data-ocid="mr-notif-banner-dismiss"
              >
                <X className="w-3.5 h-3.5 text-sky-600" />
              </button>
            </div>
          </div>
        )}

        {/* ── GPS Permission Warning Banner ── */}
        {gpsPermissionDenied && !showGpsBannerDismissed && (
          <div
            className="flex items-start gap-3 mb-4 px-4 py-3 rounded-xl bg-amber-50 border border-amber-300"
            data-ocid="mr-gps-denied-banner"
          >
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800">
                Location permission is off.
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                Doctor Call entries will not have GPS data. Tap here to fix.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  toast.info(
                    "To enable location: Open your device Settings → Apps → Browser → Permissions → Location → Allow.",
                    { duration: 10000 },
                  );
                }}
                className="flex items-center gap-1 text-xs font-semibold text-amber-800 underline underline-offset-2 hover:opacity-80 transition-opacity"
                data-ocid="mr-gps-banner-fix-link"
              >
                <Settings className="w-3.5 h-3.5" />
                Fix
              </button>
              <button
                type="button"
                onClick={() => setShowGpsBannerDismissed(true)}
                className="p-1 rounded-full hover:bg-amber-200 transition-colors"
                aria-label="Dismiss GPS warning"
                data-ocid="mr-gps-banner-dismiss"
              >
                <X className="w-3.5 h-3.5 text-amber-600" />
              </button>
            </div>
          </div>
        )}

        {/* ── Dashboard load error ── */}
        {loadError && !loading && (
          <div
            className="flex items-center gap-3 mb-4 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/30"
            data-ocid="mr-dashboard.error_state"
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

        {/* ── DCR Reminder Banner ── */}
        {showDcrReminderBanner && (
          <div
            className="flex items-start gap-3 mb-4 px-4 py-3 rounded-xl bg-amber-50 border border-amber-300"
            data-ocid="mr-dcr-reminder-banner"
          >
            <ClipboardCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800">
                Reminder: Submit your DCR for today
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                Your reporting manager is monitoring DCR submissions. Please
                submit before the deadline.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  window.location.href = "/mr/dcr";
                }}
                className="flex items-center gap-1 text-xs font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-400 rounded px-2.5 py-1 transition-colors whitespace-nowrap"
                data-ocid="mr-dcr-reminder-banner.submit_button"
              >
                Submit DCR Now →
              </button>
              <button
                type="button"
                onClick={() => setShowDcrReminderBanner(false)}
                className="p-1 rounded-full hover:bg-amber-200 transition-colors"
                aria-label="Dismiss DCR reminder"
                data-ocid="mr-dcr-reminder-banner.close_button"
              >
                <X className="w-3.5 h-3.5 text-amber-600" />
              </button>
            </div>
          </div>
        )}

        {/* ── MTP Reminder Banner ── */}
        {showMtpReminderBanner && (
          <div
            className="flex items-start gap-3 mb-4 px-4 py-3 rounded-xl bg-sky-50 border border-sky-300"
            data-ocid="mr-mtp-reminder-banner"
          >
            <CalendarPlus className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-sky-800">
                Reminder: Submit your MTP for {mtpNextMonth}
              </p>
              <p className="text-xs text-sky-700 mt-0.5">
                Deadline: {mtpDeadlineDate}. You have{" "}
                <strong>
                  {mtpDaysLeft} day{mtpDaysLeft !== 1 ? "s" : ""}
                </strong>{" "}
                remaining.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  window.location.href = "/mr/travel-plans";
                }}
                className="flex items-center gap-1 text-xs font-semibold text-sky-700 bg-sky-100 hover:bg-sky-200 border border-sky-300 rounded px-2.5 py-1 transition-colors whitespace-nowrap"
                data-ocid="mr-mtp-reminder-banner.submit_button"
              >
                Submit MTP Now →
              </button>
              <button
                type="button"
                onClick={() => setShowMtpReminderBanner(false)}
                className="p-1 rounded-full hover:bg-sky-200 transition-colors"
                aria-label="Dismiss MTP reminder"
                data-ocid="mr-mtp-reminder-banner.close_button"
              >
                <X className="w-3.5 h-3.5 text-sky-600" />
              </button>
            </div>
          </div>
        )}

        {/* ── 1. Birthday Flash ── */}
        <BirthdayFlash
          birthdays={birthdayData.todaysBirthdays.filter(
            (b) => b.userId === currentUserId,
          )}
          doctorBirthdays={birthdayData.doctorBirthdaysToday}
          currentUserId={currentUserId}
          isOwnBirthday={birthdayData.isCurrentUserBirthday}
        />

        {/* ── On-Leave Banner ── */}
        <OnLeaveBanner />

        {/* ── 2. SFA KPI Cards ── */}
        <section className="mb-5" data-ocid="mr-kpi.section">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-semibold text-xs uppercase tracking-wider text-muted-foreground">
              This Month's KPIs
            </h2>
            {kpiError && (
              <button
                type="button"
                onClick={refreshKpi}
                className="flex items-center gap-1 text-xs text-sky-600 hover:text-sky-800 transition-colors"
                data-ocid="mr-kpi.retry_button"
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
            )}
          </div>

          {kpiLoading ? (
            <KpiSkeleton />
          ) : kpiError ? (
            <div
              className="flex items-center gap-2 py-4 px-4 rounded-xl bg-destructive/10 border border-destructive/20 mb-2"
              data-ocid="mr-kpi.error_state"
            >
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
              <p className="text-sm text-destructive">
                Could not load KPI data.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <KpiCard
                title="Doctor Calls"
                value={Number(mrKpis?.doctorCallsCount ?? 0)}
                target={Number(mrKpis?.doctorCallsTarget ?? 0)}
                progressBar={true}
                icon={<Stethoscope className="w-4 h-4" />}
                accentColor="#0EA5E9"
                subtitle="vs monthly target"
              />
              <KpiCard
                title="Chemist Visits"
                value={Number(mrKpis?.chemistVisitsCount ?? 0)}
                target={Number(mrKpis?.chemistVisitsTarget ?? 0)}
                icon={<ShoppingCart className="w-4 h-4" />}
                accentColor="#10B981"
              />
              <KpiCard
                title="Stockist Visits"
                value={Number(mrKpis?.stockistVisitsCount ?? 0)}
                target={Number(mrKpis?.stockistVisitsTarget ?? 0)}
                icon={<Package className="w-4 h-4" />}
                accentColor="#8B5CF6"
              />
              <KpiCard
                title="Sample Balance"
                value={Number(mrKpis?.sampleBalanceCount ?? 0)}
                icon={<Package className="w-4 h-4" />}
                accentColor="#F59E0B"
                subtitle="units remaining"
              />
              <KpiCard
                title="DCR Rate"
                value={`${Math.round((mrKpis?.dcrSubmissionRate ?? 0) * 100) / 100}%`}
                target={100}
                progressBar={true}
                icon={<ClipboardList className="w-4 h-4" />}
                accentColor="#EC4899"
                subtitle="submission rate"
              />
              <KpiCard
                title="MTP Adherence"
                value={`${Math.round((mrKpis?.mtpAdherenceRate ?? 0) * 100) / 100}%`}
                target={100}
                progressBar={true}
                icon={<CalendarPlus className="w-4 h-4" />}
                accentColor="#6366F1"
                subtitle="plan vs actual"
              />
            </div>
          )}
        </section>

        {/* ── 3 & 4. Today's Activity + Tour Plan (side by side on desktop) ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          {/* 3. Today's Activity Summary */}
          <div
            className="bg-card border border-border rounded-xl p-4"
            data-ocid="mr-today-activity.card"
          >
            <h3 className="text-xs uppercase tracking-wider font-display font-semibold text-muted-foreground mb-3">
              Today's Activity
            </h3>

            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-6 rounded-md bg-muted/60 animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Check-In Status */}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <UserRoundCheck className="w-3.5 h-3.5 shrink-0" />
                    Check-In Status
                  </span>
                  {checkedInToday ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                      <CheckCircle2 className="w-3 h-3" />
                      Checked In
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                      Not Checked In
                    </span>
                  )}
                </div>

                {/* Doctor Calls today */}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Stethoscope className="w-3.5 h-3.5 shrink-0" />
                    Doctor Calls Today
                  </span>
                  <span className="text-xs font-bold text-sky-700">
                    {summary ? "—" : "0"}
                  </span>
                </div>

                {/* Chemist Visits today */}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
                    Chemist Visits Today
                  </span>
                  <span className="text-xs font-bold text-emerald-700">0</span>
                </div>

                {/* DCR Status */}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <ClipboardList className="w-3.5 h-3.5 shrink-0" />
                    DCR Status
                  </span>
                  <DcrStatusBadge
                    submitted={dcrStatus?.dcrSubmitted ?? false}
                  />
                </div>

                {/* Submit DCR quick shortcut */}
                {!dcrStatus?.dcrSubmitted && (
                  <button
                    type="button"
                    onClick={() => {
                      window.location.href = "/mr/dcr";
                    }}
                    className="w-full mt-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-sky-500 text-white hover:bg-sky-600 active:scale-95 transition-all"
                    data-ocid="mr-today-activity.submit_dcr_button"
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                    Submit Today's DCR
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 4. Today's Tour Plan */}
          <div
            className="bg-card border border-border rounded-xl p-4"
            data-ocid="mr-tour-plan.card"
          >
            <h3 className="text-xs uppercase tracking-wider font-display font-semibold text-muted-foreground mb-3">
              Today's Tour Plan
            </h3>

            {tourPlanLoading ? (
              <div className="space-y-2">
                <div className="h-5 w-3/4 rounded bg-muted/60 animate-pulse" />
                <div className="h-5 w-1/2 rounded bg-muted/60 animate-pulse" />
              </div>
            ) : todayTourPlan ? (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground">
                      Planned Station
                    </p>
                    <p className="text-sm font-semibold text-foreground truncate">
                      {todayTourPlan.plannedStation || "—"}
                    </p>
                  </div>
                </div>
                {todayTourPlan.notes && (
                  <div className="flex items-start gap-2">
                    <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {todayTourPlan.notes}
                    </p>
                  </div>
                )}
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 border border-green-200">
                  Approved MTP ✓
                </span>
              </div>
            ) : (
              <div
                className="flex flex-col items-center justify-center py-4 text-center"
                data-ocid="mr-tour-plan.empty_state"
              >
                <CalendarPlus className="w-8 h-8 text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">
                  No tour plan for today
                </p>
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = "/mr/travel-plans";
                  }}
                  className="mt-2 text-xs text-sky-600 hover:text-sky-800 hover:underline transition-colors font-medium"
                  data-ocid="mr-tour-plan.create_button"
                >
                  Create MTP →
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── 6. Quick Actions Bar ── */}
        <div className="mb-5" data-ocid="mr-quick-actions.section">
          <h2 className="font-display font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-3">
            Quick Actions
          </h2>
          <QuickActionsBar actions={quickActions} />
        </div>

        {/* ── Primary Action Buttons (kept for backward compat + additional actions) ── */}
        <div className="mb-6">
          <h2 className="font-display font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-3">
            Field Actions
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {primaryActions.map((btn) => {
              const Icon = btn.icon;
              const isDone = btn.isCompleted;
              return (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => handlePrimaryAction(btn)}
                  data-ocid={`primary-action-${btn.id}`}
                  className={`relative flex flex-col items-center justify-center gap-2.5 rounded-xl font-semibold text-sm transition-all duration-200 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 border-2 ${isDone ? btn.doneClass : btn.activeClass}`}
                  style={{ minHeight: "88px", padding: "14px 8px" }}
                  aria-label={isDone ? btn.completedLabel : btn.label}
                >
                  {isDone && (
                    <CheckCircle2 className="absolute top-2 right-2 w-4 h-4 opacity-70" />
                  )}
                  <Icon className="w-7 h-7 shrink-0" />
                  <span className="text-center leading-tight text-xs font-semibold">
                    {isDone ? btn.completedLabel : btn.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Stats (existing) ── */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
          <StatCard
            label="Calls This Month"
            value={
              loading
                ? "…"
                : loadError
                  ? "—"
                  : summary
                    ? Number(summary.totalCalls).toString()
                    : "0"
            }
            icon={FileText}
            data-ocid="stat-calls-month"
          />
          <StatCard
            label="Doctors Covered"
            value={
              loading
                ? "…"
                : loadError
                  ? "—"
                  : summary
                    ? Number(summary.uniqueDoctors).toString()
                    : "0"
            }
            icon={Stethoscope}
            data-ocid="stat-doctors-covered"
          />
          <StatCard
            label="Orders Submitted"
            value={
              loading
                ? "…"
                : loadError
                  ? "—"
                  : summary
                    ? Number(summary.totalOrders).toString()
                    : "0"
            }
            icon={ShoppingCart}
            data-ocid="stat-orders"
          />
          <StatCard
            label="Order Value (₹)"
            value={
              loading
                ? "…"
                : loadError
                  ? "—"
                  : summary
                    ? `₹${Number(summary.totalOrderValue).toLocaleString("en-IN")}`
                    : "₹0"
            }
            icon={TrendingUp}
            data-ocid="stat-order-value"
          />
          <StatCard
            label="Territory"
            value={loading ? "…" : loadError ? "—" : userInfo?.territory || "—"}
            icon={MapPin}
            data-ocid="stat-territory"
          />
        </div>

        {/* ── 5 & 7 & 8. Widgets row: Pending Actions + Upcoming Birthdays + Recent Activity ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {/* 5. Pending Actions */}
          <PendingActionsWidget
            items={pendingActionItems}
            title="Pending Actions"
          />

          {/* 7. Upcoming Birthdays */}
          <UpcomingBirthdaysWidget
            upcoming={birthdayData.upcomingBirthdays}
            upcomingDoctors={birthdayData.doctorBirthdaysToday}
            loading={birthdayData.loadingUpcoming}
            onViewAll={() => {
              window.location.href = "/mr/birthdays";
            }}
          />

          {/* 8. Recent Activity Feed */}
          <RecentActivityFeed
            activities={activityItems}
            title="Recent Activity"
            maxItems={5}
          />
        </div>

        {/* ── Lower grid: Secondary Actions + Incentive ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Secondary Actions */}
          <div className="bg-card border border-border rounded-lg p-5">
            <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3">
              More Actions
            </h2>
            <div className="space-y-1">
              {SECONDARY_ACTIONS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => navigate({ to: item.path })}
                    className="w-full flex items-center gap-2.5 bg-muted/20 hover:bg-muted/50 border border-border rounded-md px-3 py-2.5 text-sm font-body text-foreground transition-colors group"
                    data-ocid={`secondary-action-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <Icon className="w-4 h-4 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                    <span className="flex-1 text-left">{item.label}</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* My Incentive */}
          <MyIncentiveWidget />
        </div>

        {/* ── Additional Role Charges ── */}
        {activeRoleCharges.length > 0 && (
          <div className="mt-6 space-y-4">
            <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <UserCog className="w-4 h-4" /> Additional Role Charge
            </h2>
            {activeRoleCharges.map((charge) => (
              <AdditionalRoleTab
                key={charge.id}
                chargeRole={charge.additionalRole!}
                chargeId={charge.id}
                effectiveTo={charge.effectiveTo}
              />
            ))}
          </div>
        )}

        {/* ── Additional Area Charges info ── */}
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

      {/* Doctor Call modal */}
      <DoctorCallModal
        open={showDoctorCallModal}
        onOpenChange={setShowDoctorCallModal}
      />
    </PortalLayout>
  );
}
