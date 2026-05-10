import { CalendarDays } from "lucide-react";
import type {
  DoctorBirthdayEntry,
  UpcomingBirthdayEntry,
} from "../hooks/useBirthdays";

interface UpcomingBirthdaysWidgetProps {
  upcoming: UpcomingBirthdayEntry[];
  upcomingDoctors?: DoctorBirthdayEntry[];
  loading?: boolean;
  onViewAll?: () => void;
}

export function UpcomingBirthdaysWidget({
  upcoming,
  upcomingDoctors = [],
  loading = false,
  onViewAll,
}: UpcomingBirthdaysWidgetProps) {
  const visibleEmployees = upcoming.slice(0, 5);

  return (
    <div
      className="bg-card border border-border rounded-xl p-4"
      data-ocid="upcoming-birthdays-widget"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs uppercase tracking-wider font-display font-semibold text-muted-foreground flex items-center gap-1.5">
          <CalendarDays className="w-3.5 h-3.5 text-sky-500" />
          Upcoming Birthdays
        </h3>
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="text-xs text-sky-600 hover:text-sky-800 hover:underline transition-colors font-medium"
            data-ocid="upcoming-birthdays-view-all"
          >
            View calendar →
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 rounded-md bg-muted/60 animate-pulse" />
          ))}
        </div>
      ) : visibleEmployees.length === 0 && upcomingDoctors.length === 0 ? (
        <div
          className="py-4 text-center text-xs text-muted-foreground"
          data-ocid="upcoming-birthdays-widget.empty_state"
        >
          <span className="text-2xl block mb-1">🎂</span>
          No upcoming birthdays in the next 7 days
        </div>
      ) : (
        <div className="space-y-1.5">
          {/* Employee birthdays */}
          {visibleEmployees.map((b) => (
            <div
              key={b.userId}
              className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 hover:bg-sky-50/60 transition-colors"
              data-ocid={`upcoming-birthday-row-${b.userId}`}
            >
              <div className="min-w-0 flex-1 flex items-center gap-1.5">
                <span className="text-sm flex-shrink-0">🎂</span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">
                    {b.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {b.role}
                    {b.hq ? ` • ${b.hq}` : ""}
                  </p>
                </div>
              </div>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                  b.daysUntilBirthday === 0
                    ? "bg-sky-500 text-white"
                    : b.daysUntilBirthday <= 2
                      ? "bg-sky-100 text-sky-700"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {b.daysUntilBirthday === 0
                  ? "Today! 🎉"
                  : b.daysUntilBirthday === 1
                    ? "Tomorrow"
                    : `in ${b.daysUntilBirthday}d`}
              </span>
            </div>
          ))}

          {/* Doctor birthdays */}
          {upcomingDoctors.slice(0, 3).map((d) => (
            <div
              key={d.doctorId}
              className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 hover:bg-teal-50/60 transition-colors border-l-2 border-teal-300"
              data-ocid={`upcoming-birthday-doctor-row-${d.doctorId}`}
            >
              <div className="min-w-0 flex-1 flex items-center gap-1.5">
                <span className="text-sm flex-shrink-0">🩺</span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">
                    Dr. {d.name}
                  </p>
                  <p className="text-[10px] text-teal-600 truncate">
                    {d.specialization ? `${d.specialization} • ` : ""}
                    {d.station}
                    {d.area ? ` (${d.area})` : ""}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 bg-teal-100 text-teal-700">
                Today 🩺
              </span>
            </div>
          ))}

          {upcoming.length > 5 && (
            <p className="text-[10px] text-muted-foreground text-center pt-1">
              +{upcoming.length - 5} more employees
            </p>
          )}
          {upcomingDoctors.length > 3 && (
            <p className="text-[10px] text-teal-600 text-center">
              +{upcomingDoctors.length - 3} more doctors
            </p>
          )}
        </div>
      )}
    </div>
  );
}
