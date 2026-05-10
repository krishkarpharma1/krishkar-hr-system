import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Download, Edit } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Role } from "../../backend";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import type { AttendanceRecord, UserInfo } from "../../types";
import { AttendanceStatus } from "../../types";

// ── Status display config ─────────────────────────────────────────────────
const STATUS_CONFIG: Record<
  AttendanceStatus,
  { label: string; shortLabel: string; color: string; bg: string }
> = {
  [AttendanceStatus.present]: {
    label: "Present",
    shortLabel: "P",
    color: "text-emerald-700",
    bg: "bg-emerald-100 border-emerald-300",
  },
  [AttendanceStatus.absent]: {
    label: "Absent",
    shortLabel: "A",
    color: "text-destructive",
    bg: "bg-destructive/10 border-destructive/30",
  },
  [AttendanceStatus.halfDay]: {
    label: "Half Day",
    shortLabel: "H",
    color: "text-yellow-600",
    bg: "bg-yellow-100 border-yellow-300",
  },
  [AttendanceStatus.onLeave]: {
    label: "On Leave",
    shortLabel: "L",
    color: "text-primary",
    bg: "bg-primary/10 border-primary/30",
  },
  [AttendanceStatus.onLeaveCL]: {
    label: "Casual Leave",
    shortLabel: "CL",
    color: "text-blue-700",
    bg: "bg-blue-100 border-blue-300",
  },
  [AttendanceStatus.onLeaveSL]: {
    label: "Sick Leave",
    shortLabel: "SL",
    color: "text-teal-700",
    bg: "bg-teal-100 border-teal-300",
  },
  [AttendanceStatus.onLeaveUPL]: {
    label: "Leave Without Pay",
    shortLabel: "LWP",
    color: "text-purple-700",
    bg: "bg-purple-100 border-purple-300",
  },
  [AttendanceStatus.onLeaveLWP]: {
    label: "Leave Without Pay",
    shortLabel: "LWP",
    color: "text-purple-700",
    bg: "bg-purple-100 border-purple-300",
  },
  [AttendanceStatus.onLeaveCO]: {
    label: "Compensatory Off",
    shortLabel: "CO",
    color: "text-indigo-700",
    bg: "bg-indigo-100 border-indigo-300",
  },
  [AttendanceStatus.onLeaveML]: {
    label: "Maternity Leave",
    shortLabel: "ML",
    color: "text-pink-700",
    bg: "bg-pink-100 border-pink-300",
  },
  [AttendanceStatus.onLeavePL]: {
    label: "Privilege Leave",
    shortLabel: "PL",
    color: "text-violet-700",
    bg: "bg-violet-100 border-violet-300",
  },
  // EL and FL leave types removed (V77-V82 rollback)
  [AttendanceStatus.weeklyOff]: {
    label: "Weekly Off",
    shortLabel: "WO",
    color: "text-muted-foreground",
    bg: "bg-muted/40 border-border",
  },
  [AttendanceStatus.companyHoliday]: {
    label: "Company Holiday",
    shortLabel: "CH",
    color: "text-muted-foreground",
    bg: "bg-muted/40 border-border",
  },
};

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

const todayStr = new Date().toISOString().split("T")[0];

// Only manually settable statuses for the correction modal
const CORRECTABLE_STATUSES: AttendanceStatus[] = [
  AttendanceStatus.present,
  AttendanceStatus.absent,
  AttendanceStatus.halfDay,
  AttendanceStatus.onLeave,
  AttendanceStatus.onLeaveCL,
  AttendanceStatus.onLeaveSL,
  AttendanceStatus.onLeaveUPL,
  AttendanceStatus.weeklyOff,
  AttendanceStatus.companyHoliday,
];

export default function AttendanceTracking() {
  const { session } = useAuthStore();
  const [employees, setEmployees] = useState<UserInfo[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>("");
  const initDate = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(initDate.getMonth() + 1);
  const [year, setYear] = useState(initDate.getFullYear());
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Attendance summary from backend
  const [summary, setSummary] = useState<{
    present: bigint;
    absent: bigint;
    leaves: bigint;
    holidays: bigint;
    weeklyOffs: bigint;
  } | null>(null);

  // Correction modal state
  const [correctionModal, setCorrectionModal] = useState<{
    date: string;
    currentStatus: AttendanceStatus | null;
  } | null>(null);
  const [correctionStatus, setCorrectionStatus] = useState<AttendanceStatus>(
    AttendanceStatus.present,
  );
  const [correctionReason, setCorrectionReason] = useState("");
  const [correcting, setCorrecting] = useState(false);

  useEffect(() => {
    if (!session) return;
    api
      .listAllUsers(session.token)
      .then(setEmployees)
      .catch(() => {});
  }, [session]);

  const fetchAttendance = useCallback(async () => {
    if (!session || !selectedEmpId) return;
    setLoading(true);
    try {
      const empId = BigInt(selectedEmpId);
      const [att, sum] = await Promise.all([
        api.getEmployeeMonthlyAttendance(
          session.token,
          empId,
          BigInt(month),
          BigInt(year),
        ),
        api.getAttendanceSummaryForEmployee(
          session.token,
          empId,
          BigInt(month),
          BigInt(year),
        ),
      ]);
      setRecords(att);
      setSummary(sum);
    } catch {
      toast.error("Failed to load attendance");
    } finally {
      setLoading(false);
    }
  }, [session, selectedEmpId, month, year]);

  useEffect(() => {
    if (!selectedEmpId) return;
    fetchAttendance();
  }, [fetchAttendance, selectedEmpId]);

  const totalDays = useMemo(
    () => new Date(year, month, 0).getDate(),
    [month, year],
  );
  const firstDayOffset = useMemo(
    () => new Date(year, month - 1, 1).getDay(),
    [year, month],
  );

  const recordsByDate = useMemo(
    () =>
      records.reduce<Record<string, AttendanceRecord>>((acc, r) => {
        acc[r.date] = r;
        return acc;
      }, {}),
    [records],
  );

  const padDate = (d: number) =>
    `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const openCorrectionModal = (
    date: string,
    current: AttendanceStatus | null,
  ) => {
    setCorrectionModal({ date, currentStatus: current });
    setCorrectionStatus(current ?? AttendanceStatus.present);
    setCorrectionReason("");
  };

  const handleCorrection = async () => {
    if (!session || !selectedEmpId || !correctionModal) return;
    if (!correctionReason.trim()) {
      toast.error("Please enter a reason for the correction");
      return;
    }
    setCorrecting(true);
    try {
      const res = await api.correctAttendance(session.token, {
        date: correctionModal.date,
        employeeId: BigInt(selectedEmpId),
        newStatus: correctionStatus,
        reason: correctionReason,
      });
      if (res.__kind__ === "err") {
        toast.error(res.err);
        return;
      }
      toast.success("Attendance corrected");
      setCorrectionModal(null);
      await fetchAttendance();
    } catch {
      toast.error("Failed to correct attendance");
    } finally {
      setCorrecting(false);
    }
  };

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };

  // Excel export
  const handleExportExcel = async () => {
    if (!selectedEmpId || records.length === 0) {
      toast.error("No data to export");
      return;
    }
    try {
      const { utils, writeFile } = await import("xlsx");
      const emp = employees.find((e) => String(e.id) === selectedEmpId);
      const empName = emp?.name ?? "Employee";

      // Build a row per day
      const rows = Array.from({ length: totalDays }).map((_, i) => {
        const day = i + 1;
        const dateStr = padDate(day);
        const rec = recordsByDate[dateStr];
        const dayOfWeek = new Date(year, month - 1, day).getDay();
        const isSun = dayOfWeek === 0;
        return {
          Date: dateStr,
          Day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dayOfWeek],
          Status: rec
            ? STATUS_CONFIG[rec.status].label
            : isSun
              ? "Weekly Off"
              : "Absent",
          "Check-In": rec?.checkInTime ?? "",
          "Correction Remark": rec?.correctionRemark ?? "",
        };
      });

      const ws = utils.json_to_sheet(rows);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, `Attendance ${empName}`);
      writeFile(
        wb,
        `Attendance_${empName}_${MONTH_NAMES[month - 1]}_${year}.xlsx`,
      );
      toast.success("Exported successfully");
    } catch {
      toast.error("Export failed");
    }
  };

  // Summary stats derived from backend summary
  const summaryStats = summary
    ? [
        {
          label: "Present",
          value: String(summary.present),
          color: "text-emerald-700",
        },
        {
          label: "Absent",
          value: String(summary.absent),
          color: "text-destructive",
        },
        {
          label: "Leaves",
          value: String(summary.leaves),
          color: "text-blue-700",
        },
        {
          label: "Holidays",
          value: String(summary.holidays),
          color: "text-muted-foreground",
        },
        {
          label: "Weekly Offs",
          value: String(summary.weeklyOffs),
          color: "text-muted-foreground",
        },
      ]
    : [];

  return (
    <PortalLayout portalRole={Role.HRManager}>
      <PageHeader
        title="Attendance Tracking"
        subtitle="Consolidated monthly attendance view with auto-recorded check-ins and leave days"
        actions={
          selectedEmpId ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              data-ocid="export-attendance-btn"
            >
              <Download className="w-4 h-4 mr-1" /> Export Excel
            </Button>
          ) : undefined
        }
      />
      <PageContent>
        {/* Controls */}
        <div className="flex flex-wrap gap-3 mb-6 items-center">
          <Select value={selectedEmpId} onValueChange={setSelectedEmpId}>
            <SelectTrigger
              className="w-[220px]"
              data-ocid="attendance-emp-select"
            >
              <SelectValue placeholder="Select employee…" />
            </SelectTrigger>
            <SelectContent>
              {employees.map((e) => (
                <SelectItem key={String(e.id)} value={String(e.id)}>
                  {e.name} ({e.employeeId})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={prevMonth}
              data-ocid="prev-month"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="font-display text-sm font-medium text-foreground min-w-[130px] text-center">
              {MONTH_NAMES[month - 1]} {year}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={nextMonth}
              data-ocid="next-month"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {loading && (
          <div className="text-center text-muted-foreground text-sm py-4">
            Loading attendance…
          </div>
        )}

        {selectedEmpId && !loading && (
          <>
            {/* Summary tiles */}
            {summaryStats.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
                {summaryStats.map((s) => (
                  <div
                    key={s.label}
                    className="bg-card border border-border rounded-lg p-3 text-center"
                  >
                    <p className={`font-display font-bold text-2xl ${s.color}`}>
                      {s.value}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
                <p className="text-xs uppercase tracking-wider font-display text-muted-foreground">
                  Attendance Calendar
                </p>
                <p className="text-xs text-muted-foreground">
                  Hover a day to see correction option
                </p>
              </div>
              <div className="p-4">
                {/* Day headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                    (d) => (
                      <div
                        key={d}
                        className="text-center text-xs font-display text-muted-foreground py-1"
                      >
                        {d}
                      </div>
                    ),
                  )}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: firstDayOffset }, (_, i) => (
                    <div key={`spacer-att-${i + 1}`} />
                  ))}
                  {Array.from({ length: totalDays }).map((_, i) => {
                    const d = i + 1;
                    const dateStr = padDate(d);
                    const rec = recordsByDate[dateStr];
                    const cfg = rec ? STATUS_CONFIG[rec.status] : null;
                    const isToday = dateStr === todayStr;
                    const dayOfWeek = new Date(year, month - 1, d).getDay();
                    const isSunday = dayOfWeek === 0;

                    return (
                      <div key={dateStr} className="group relative">
                        <div
                          className={cn(
                            "w-full aspect-square rounded flex flex-col items-center justify-center text-xs transition-colors border",
                            cfg
                              ? `${cfg.bg}`
                              : isSunday
                                ? "bg-muted/40 border-border"
                                : "border-border",
                            isToday && "ring-1 ring-primary",
                          )}
                        >
                          <span
                            className={cn(
                              "font-mono text-sm",
                              cfg
                                ? cfg.color
                                : isSunday
                                  ? "text-muted-foreground"
                                  : "text-foreground",
                            )}
                          >
                            {d}
                          </span>
                          {cfg && (
                            <span
                              className={cn(
                                "text-[9px] font-display font-bold",
                                cfg.color,
                              )}
                            >
                              {cfg.shortLabel}
                            </span>
                          )}
                          {!cfg && isSunday && (
                            <span className="text-[9px] font-display text-muted-foreground">
                              WO
                            </span>
                          )}
                        </div>
                        {/* Correction trigger */}
                        <button
                          type="button"
                          className="absolute top-0.5 right-0.5 hidden group-hover:flex items-center justify-center w-4 h-4 rounded bg-primary/80 hover:bg-primary transition-colors z-10"
                          title="Manual Correction"
                          onClick={() =>
                            openCorrectionModal(dateStr, rec?.status ?? null)
                          }
                          data-ocid={`correct-${dateStr}`}
                        >
                          <Edit className="w-2.5 h-2.5 text-primary-foreground" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Legend */}
              <div className="px-4 py-2 border-t border-border bg-muted/20 flex gap-3 flex-wrap">
                {Object.entries(STATUS_CONFIG).map(([s, c]) => (
                  <div key={s} className="flex items-center gap-1.5">
                    <div className={cn("w-3 h-3 rounded border", c.bg)} />
                    <span className="text-xs text-muted-foreground">
                      {c.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {!selectedEmpId && (
          <div
            className="bg-card border border-border rounded-lg p-10 text-center text-muted-foreground text-sm"
            data-ocid="attendance-empty"
          >
            Select an employee to view attendance tracking
          </div>
        )}
      </PageContent>

      {/* ── Manual Correction Modal ── */}
      <Dialog
        open={correctionModal !== null}
        onOpenChange={(o) => !o && setCorrectionModal(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Manual Attendance Correction</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Date:{" "}
              <span className="font-mono font-semibold text-foreground">
                {correctionModal?.date}
              </span>
            </p>
            {correctionModal?.currentStatus && (
              <p className="text-xs text-muted-foreground">
                Current status:{" "}
                <span className="font-medium text-foreground">
                  {STATUS_CONFIG[correctionModal.currentStatus].label}
                </span>
              </p>
            )}
            <div className="flex flex-col gap-1.5">
              <Label>New Status</Label>
              <Select
                value={correctionStatus}
                onValueChange={(v) =>
                  setCorrectionStatus(v as AttendanceStatus)
                }
              >
                <SelectTrigger data-ocid="correction-status-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CORRECTABLE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_CONFIG[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="correction-reason">
                Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="correction-reason"
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                placeholder="Enter reason for correction…"
                rows={3}
                data-ocid="correction-reason-input"
              />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button
                variant="outline"
                onClick={() => setCorrectionModal(null)}
                data-ocid="correction-cancel"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCorrection}
                disabled={correcting}
                data-ocid="correction-save"
              >
                {correcting ? "Saving…" : "Save Correction"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
