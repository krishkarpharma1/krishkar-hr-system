/**
 * My Attendance View — employee self-service monthly attendance calendar.
 * Shows Present, Leave (CL/SL/UPL), Absent, Weekly Off, Company Holiday.
 */
import { Button } from "@/components/ui/button";
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Role } from "../../backend.d";
import type { AttendanceRecord, CompanyHoliday } from "../../backend.d";
import { AttendanceStatus } from "../../backend.d";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";

interface Props {
  portalRole: Role;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const MONTH_SHORT = [
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
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type DayStatus =
  | "present"
  | "cl"
  | "sl"
  | "upl"
  | "absent"
  | "weekly_off"
  | "company_holiday"
  | "future"
  | "unknown";

interface DayInfo {
  day: number;
  status: DayStatus;
  checkInTime?: string;
  holidayName?: string;
  leaveId?: bigint;
}

const STATUS_CONFIG: Record<
  DayStatus,
  { label: string; short: string; bg: string; text: string; border: string }
> = {
  present: {
    label: "Present",
    short: "P",
    bg: "bg-green-100",
    text: "text-green-700",
    border: "border-green-200",
  },
  cl: {
    label: "Casual Leave",
    short: "CL",
    bg: "bg-blue-100",
    text: "text-blue-700",
    border: "border-blue-200",
  },
  sl: {
    label: "Sick Leave",
    short: "SL",
    bg: "bg-teal-100",
    text: "text-teal-700",
    border: "border-teal-200",
  },
  upl: {
    label: "Un-Paid Leave",
    short: "UPL",
    bg: "bg-orange-100",
    text: "text-orange-700",
    border: "border-orange-200",
  },
  absent: {
    label: "Absent",
    short: "A",
    bg: "bg-red-100",
    text: "text-red-700",
    border: "border-red-200",
  },
  weekly_off: {
    label: "Weekly Off (Paid)",
    short: "WO",
    bg: "bg-muted/40",
    text: "text-muted-foreground",
    border: "border-border",
  },
  company_holiday: {
    label: "Company Holiday",
    short: "CH",
    bg: "bg-purple-100",
    text: "text-purple-700",
    border: "border-purple-200",
  },
  future: {
    label: "—",
    short: "—",
    bg: "bg-transparent",
    text: "text-muted-foreground/40",
    border: "border-transparent",
  },
  unknown: {
    label: "—",
    short: "—",
    bg: "bg-muted/20",
    text: "text-muted-foreground",
    border: "border-border/50",
  },
};

function mapAttendanceStatus(s: AttendanceStatus): DayStatus {
  switch (s) {
    case AttendanceStatus.present:
      return "present";
    case AttendanceStatus.onLeaveCL:
      return "cl";
    case AttendanceStatus.onLeaveSL:
      return "sl";
    case AttendanceStatus.onLeaveUPL:
      return "upl";
    case AttendanceStatus.onLeave:
      return "cl"; // generic leave → treat as CL display
    case AttendanceStatus.weeklyOff:
      return "weekly_off";
    case AttendanceStatus.companyHoliday:
      return "company_holiday";
    case AttendanceStatus.absent:
      return "absent";
    default:
      return "unknown";
  }
}

function isSunday(year: number, month: number, day: number): boolean {
  return new Date(year, month, day).getDay() === 0;
}

export default function MyAttendanceView({ portalRole }: Props) {
  const { session } = useAuthStore();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [holidays, setHolidays] = useState<CompanyHoliday[]>([]);
  const [loading, setLoading] = useState(true);

  const todayCheckIn = useMemo(() => {
    const todayStr = now.toISOString().split("T")[0];
    return records.find(
      (r) => r.date === todayStr && r.status === AttendanceStatus.present,
    );
  }, [records, now]);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [recs, hols] = await Promise.all([
        api.getMyMonthlyAttendance(
          session.token,
          BigInt(month + 1),
          BigInt(year),
        ),
        api.getActiveHolidays(session.token),
      ]);
      setRecords(recs);
      setHolidays(hols);
    } catch {
      toast.error("Failed to load attendance data");
    } finally {
      setLoading(false);
    }
  }, [session, month, year]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePrev = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };
  const handleNext = () => {
    // don't allow future months beyond current
    const target = new Date(year, month + 1, 1);
    if (target > now) return;
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };

  const canGoNext = useMemo(() => {
    const target = new Date(year, month + 1, 1);
    return target <= now;
  }, [year, month, now]);

  // Build holiday date set for this month (ms timestamps)
  const holidayDates = useMemo(() => {
    const map = new Map<number, string>(); // day -> name
    for (const h of holidays) {
      const d = new Date(Number(h.date));
      if (d.getFullYear() === year && d.getMonth() === month) {
        map.set(d.getDate(), h.name);
      }
    }
    return map;
  }, [holidays, year, month]);

  // Build attendance record map day -> record
  const recordMap = useMemo(() => {
    const map = new Map<number, AttendanceRecord>();
    for (const r of records) {
      const d = new Date(r.date);
      if (d.getFullYear() === year && d.getMonth() === month) {
        map.set(d.getDate(), r);
      }
    }
    return map;
  }, [records, year, month]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = now.getDate();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  // Build day info array
  const days: DayInfo[] = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const isFuture = isCurrentMonth
        ? day > today
        : year > now.getFullYear() ||
          (year === now.getFullYear() && month > now.getMonth());
      const rec = recordMap.get(day);
      const holName = holidayDates.get(day);
      const isSun = isSunday(year, month, day);

      if (rec) {
        return {
          day,
          status: mapAttendanceStatus(rec.status),
          checkInTime: rec.checkInTime,
          holidayName: holName,
          leaveId: rec.leaveApplicationId,
        };
      }
      if (isFuture) return { day, status: "future" as DayStatus };
      if (holName)
        return {
          day,
          status: "company_holiday" as DayStatus,
          holidayName: holName,
        };
      if (isSun) return { day, status: "weekly_off" as DayStatus };
      return { day, status: "absent" as DayStatus };
    });
  }, [
    daysInMonth,
    recordMap,
    holidayDates,
    isCurrentMonth,
    today,
    year,
    month,
    now,
  ]);

  // Summary counts
  const summary = useMemo(() => {
    const counts = {
      present: 0,
      cl: 0,
      sl: 0,
      upl: 0,
      absent: 0,
      wo: 0,
      ch: 0,
    };
    for (const d of days) {
      if (d.status === "present") counts.present++;
      else if (d.status === "cl") counts.cl++;
      else if (d.status === "sl") counts.sl++;
      else if (d.status === "upl") counts.upl++;
      else if (d.status === "absent") counts.absent++;
      else if (d.status === "weekly_off") counts.wo++;
      else if (d.status === "company_holiday") counts.ch++;
    }
    return counts;
  }, [days]);

  // Calendar grid setup
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const paddedCells: (DayInfo | null)[] = [
    ...Array(firstDayOfMonth).fill(null),
    ...days,
  ];
  while (paddedCells.length % 7 !== 0) paddedCells.push(null);

  return (
    <PortalLayout portalRole={portalRole}>
      <PageHeader
        title="My Attendance"
        subtitle="Your monthly attendance record"
      />
      <PageContent>
        <div className="space-y-5 max-w-4xl">
          {/* Today check-in status */}
          {isCurrentMonth && todayCheckIn && (
            <div
              className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3"
              data-ocid="today-checkin-banner"
            >
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
              <p className="text-sm text-green-800 font-medium">
                Checked in today at{" "}
                <span className="font-mono font-bold">
                  {todayCheckIn.checkInTime ?? "—"}
                </span>
              </p>
            </div>
          )}

          {/* Month selector */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePrev}
              className="h-8 w-8"
              data-ocid="attendance-prev-month"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-base font-display font-semibold min-w-[160px] text-center">
              {MONTH_NAMES[month]} {year}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={handleNext}
              disabled={!canGoNext}
              className="h-8 w-8"
              data-ocid="attendance-next-month"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: "Present",
                value: summary.present,
                color: "text-green-700",
                bg: "bg-green-50 border-green-200",
              },
              {
                label: "Leave (CL+SL+UPL)",
                value: summary.cl + summary.sl + summary.upl,
                color: "text-blue-700",
                bg: "bg-blue-50 border-blue-200",
              },
              {
                label: "Absent",
                value: summary.absent,
                color: "text-red-700",
                bg: "bg-red-50 border-red-200",
              },
              {
                label: "Holidays & WO",
                value: summary.wo + summary.ch,
                color: "text-muted-foreground",
                bg: "bg-muted/30 border-border",
              },
            ].map((s) => (
              <div
                key={s.label}
                className={`rounded-lg border px-4 py-3 ${s.bg}`}
                data-ocid={`attendance-summary-${s.label.split(" ")[0].toLowerCase()}`}
              >
                <p className={`text-2xl font-display font-bold ${s.color}`}>
                  {s.value}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {s.label}
                </p>
              </div>
            ))}
          </div>

          {/* Leave breakdown */}
          {(summary.cl > 0 || summary.sl > 0 || summary.upl > 0) && (
            <div className="flex gap-3 flex-wrap">
              {summary.cl > 0 && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 border border-blue-200 font-medium">
                  CL: {summary.cl} day{summary.cl !== 1 ? "s" : ""}
                </span>
              )}
              {summary.sl > 0 && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-teal-100 text-teal-700 border border-teal-200 font-medium">
                  SL: {summary.sl} day{summary.sl !== 1 ? "s" : ""}
                </span>
              )}
              {summary.upl > 0 && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 border border-orange-200 font-medium">
                  UPL: {summary.upl} day{summary.upl !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}

          {/* Calendar grid */}
          <div
            className="bg-card border border-border rounded-lg overflow-hidden"
            data-ocid="attendance-calendar"
          >
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
              <span className="text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground">
                Attendance Calendar — {MONTH_SHORT[month]} {year}
              </span>
              {loading && (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              )}
            </div>
            <div className="p-3 sm:p-4">
              {/* Day headers */}
              <div className="grid grid-cols-7 mb-2">
                {DAY_NAMES.map((d) => (
                  <div
                    key={d}
                    className={`text-center text-[11px] font-display font-semibold pb-1.5 ${d === "Sun" ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    {d}
                  </div>
                ))}
              </div>
              {/* Weeks */}
              {Array.from({ length: paddedCells.length / 7 }, (_, wi) => {
                const firstCell = paddedCells[wi * 7];
                const weekKey = firstCell
                  ? `week-${firstCell.day}`
                  : `week-pad-${wi * 7}`;
                const weekCells = paddedCells.slice(wi * 7, wi * 7 + 7);
                return (
                  <div key={weekKey} className="grid grid-cols-7 gap-1 mb-1">
                    {weekCells.map((cell, ci) => {
                      if (!cell) {
                        const emptyKey = `empty-week${wi}-col${ci + 1}`;
                        return <div key={emptyKey} className="h-12 sm:h-14" />;
                      }
                      const cfg = STATUS_CONFIG[cell.status];
                      const isToday = isCurrentMonth && cell.day === today;
                      return (
                        <div
                          key={`day-${cell.day}`}
                          className={`h-12 sm:h-14 rounded-lg border flex flex-col items-center justify-center gap-0.5 transition-colors
                            ${cfg.bg} ${cfg.border}
                            ${isToday ? "ring-2 ring-primary ring-offset-1" : ""}
                          `}
                          title={cell.holidayName ?? cfg.label}
                          data-ocid={`attendance-day-${cell.day}`}
                        >
                          <span
                            className={`text-[11px] font-display font-semibold ${isToday ? "text-primary" : "text-muted-foreground"}`}
                          >
                            {cell.day}
                          </span>
                          {cell.status !== "future" && (
                            <span
                              className={`text-[10px] font-bold leading-none ${cfg.text}`}
                            >
                              {cfg.short}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3">
            {(
              [
                "present",
                "cl",
                "sl",
                "upl",
                "absent",
                "weekly_off",
                "company_holiday",
              ] as DayStatus[]
            ).map((s) => {
              const cfg = STATUS_CONFIG[s];
              return (
                <span
                  key={s}
                  className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}
                >
                  <span className="font-bold">{cfg.short}</span>
                  {cfg.label}
                </span>
              );
            })}
          </div>

          {/* Absent days note */}
          {summary.absent > 0 && (
            <p className="text-xs text-muted-foreground">
              * Absent days are calculated as working days with no check-in and
              no approved leave.
            </p>
          )}
        </div>
      </PageContent>
    </PortalLayout>
  );
}
