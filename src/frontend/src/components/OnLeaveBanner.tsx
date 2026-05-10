import { cn } from "@/lib/utils";
import { CalendarX, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { useAuthStore } from "../store/authStore";
import type { OnLeaveEmployee } from "../types";

const LEAVE_TYPE_STYLES: Record<string, string> = {
  Casual: "bg-blue-100 text-blue-800 border-blue-300",
  CL: "bg-blue-100 text-blue-800 border-blue-300",
  Sick: "bg-red-100 text-red-800 border-red-300",
  SL: "bg-red-100 text-red-800 border-red-300",
  "Un-Paid": "bg-muted text-muted-foreground border-border",
  UPL: "bg-muted text-muted-foreground border-border",
};

function leaveTypeStyle(type: string): string {
  const key = Object.keys(LEAVE_TYPE_STYLES).find((k) =>
    type.toLowerCase().includes(k.toLowerCase()),
  );
  return key
    ? LEAVE_TYPE_STYLES[key]
    : "bg-muted text-muted-foreground border-border";
}

interface LeaveDetailPopoverProps {
  employee: OnLeaveEmployee;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement>;
}

function LeaveDetailPopover({
  employee,
  onClose,
  anchorRef,
}: LeaveDetailPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose, anchorRef]);

  return (
    <div
      ref={popoverRef}
      role="tooltip"
      data-ocid="on_leave_banner.popover"
      className="absolute bottom-full mb-2 left-0 z-50 bg-card border border-border rounded-xl shadow-lg p-4 w-72 text-sm font-body"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="font-semibold text-foreground">
            {employee.employeeName}
          </p>
          <p className="text-xs text-muted-foreground">{employee.role}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="p-0.5 rounded hover:bg-muted text-muted-foreground"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="space-y-2 text-sm">
        <Row label="Leave Type" value={employee.leaveType} />
        <Row
          label="Period"
          value={`${formatDate(employee.fromDate)} – ${formatDate(employee.toDate)}`}
        />
        {employee.reason && <Row label="Reason" value={employee.reason} />}
        {employee.approvedByName && (
          <Row label="Approved By" value={employee.approvedByName} />
        )}
        {employee.approvedAt && (
          <Row
            label="Approved On"
            value={new Date(employee.approvedAt).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          />
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground flex-shrink-0 w-24">{label}:</span>
      <span className="text-foreground font-medium">{value}</span>
    </div>
  );
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
    });
  } catch {
    return dateStr;
  }
}

export function OnLeaveBanner() {
  const session = useAuthStore((s) => s.session);
  const [employees, setEmployees] = useState<OnLeaveEmployee[]>([]);
  const [selectedEmployee, setSelectedEmployee] =
    useState<OnLeaveEmployee | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const selectedButtonRef = useRef<HTMLButtonElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!session?.token) return;
    try {
      const data = await api.getOnLeaveEmployeesForUser(session.token);
      setEmployees(data);
    } catch {
      // silently fail — don't block dashboard
    }
  }, [session?.token]);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [load]);

  if (dismissed || employees.length === 0) return null;

  return (
    <section
      className="relative bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 mb-4 flex items-start gap-3"
      aria-label="Team members on leave today"
      data-ocid="on_leave_banner.section"
    >
      {/* Pulsing dot */}
      <div className="flex-shrink-0 mt-0.5 relative">
        <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <CalendarX className="w-4 h-4 text-amber-700 flex-shrink-0" />
          <span className="text-xs font-display font-bold text-amber-800 uppercase tracking-wide">
            On Leave Today
          </span>
          <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-bold">
            {employees.length}
          </span>
        </div>

        {/* Horizontal scroll on mobile, wrap on desktop */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin md:flex-wrap md:overflow-x-visible">
          {employees.map((emp) => (
            <div key={emp.employeeId} className="relative flex-shrink-0">
              <button
                type="button"
                ref={
                  selectedEmployee?.employeeId === emp.employeeId
                    ? selectedButtonRef
                    : undefined
                }
                onClick={() =>
                  setSelectedEmployee(
                    selectedEmployee?.employeeId === emp.employeeId
                      ? null
                      : emp,
                  )
                }
                data-ocid="on_leave_banner.employee_card"
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-colors",
                  "bg-amber-100 border-amber-300 hover:bg-amber-200 active:bg-amber-300",
                  selectedEmployee?.employeeId === emp.employeeId &&
                    "ring-2 ring-amber-500",
                )}
              >
                {/* Blinking name dot indicator */}
                <span className="relative flex-shrink-0">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block animate-pulse" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-body font-semibold text-amber-900 truncate max-w-[100px]">
                    {emp.employeeName}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span
                      className={cn(
                        "text-xs px-1.5 py-0 rounded border font-body",
                        leaveTypeStyle(emp.leaveType),
                      )}
                    >
                      {emp.leaveType}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-3 h-3 text-amber-600 flex-shrink-0" />
              </button>

              {selectedEmployee?.employeeId === emp.employeeId && (
                <LeaveDetailPopover
                  employee={emp}
                  onClose={() => setSelectedEmployee(null)}
                  anchorRef={
                    selectedButtonRef as React.RefObject<HTMLButtonElement>
                  }
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss leave banner"
        data-ocid="on_leave_banner.close_button"
        className="flex-shrink-0 p-1 rounded-lg hover:bg-amber-200 text-amber-600 transition-colors mt-0.5"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </section>
  );
}
