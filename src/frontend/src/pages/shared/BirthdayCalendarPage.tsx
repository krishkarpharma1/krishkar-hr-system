import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { CalendarBirthdayEntry } from "../../hooks/useBirthdays";
import { useBirthdays } from "../../hooks/useBirthdays";

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

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Static key arrays to avoid index-as-key linting errors
const SKELETON_CELLS = [
  "sk-0",
  "sk-1",
  "sk-2",
  "sk-3",
  "sk-4",
  "sk-5",
  "sk-6",
  "sk-7",
  "sk-8",
  "sk-9",
  "sk-10",
  "sk-11",
  "sk-12",
  "sk-13",
  "sk-14",
  "sk-15",
  "sk-16",
  "sk-17",
  "sk-18",
  "sk-19",
  "sk-20",
  "sk-21",
  "sk-22",
  "sk-23",
  "sk-24",
  "sk-25",
  "sk-26",
  "sk-27",
  "sk-28",
  "sk-29",
  "sk-30",
  "sk-31",
  "sk-32",
  "sk-33",
  "sk-34",
];
const EMPTY_CELLS = ["ec-0", "ec-1", "ec-2", "ec-3", "ec-4", "ec-5", "ec-6"];

interface DayCellBirthday {
  userId: string;
  name: string;
  role: string;
}

function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfWeek(month: number, year: number): number {
  return new Date(year, month - 1, 1).getDay();
}

function truncateName(name: string, max = 10): string {
  return name.length > max ? `${name.slice(0, max)}…` : name;
}

export default function BirthdayCalendarPage() {
  const {
    calendarBirthdays,
    doctorBirthdaysToday,
    calendarMonth,
    calendarYear,
    setCalendarMonth,
    loadingCalendar,
  } = useBirthdays();

  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  function prevMonth() {
    if (calendarMonth === 1) {
      setCalendarMonth(12, calendarYear - 1);
    } else {
      setCalendarMonth(calendarMonth - 1, calendarYear);
    }
    setSelectedDay(null);
  }

  function nextMonth() {
    if (calendarMonth === 12) {
      setCalendarMonth(1, calendarYear + 1);
    } else {
      setCalendarMonth(calendarMonth + 1, calendarYear);
    }
    setSelectedDay(null);
  }

  const daysInMonth = getDaysInMonth(calendarMonth, calendarYear);
  const firstDow = getFirstDayOfWeek(calendarMonth, calendarYear);
  const today = new Date();
  const isCurrentMonth =
    calendarMonth === today.getMonth() + 1 &&
    calendarYear === today.getFullYear();
  const todayDay = isCurrentMonth ? today.getDate() : -1;

  // Build a map: day -> list of birthdays
  const birthdaysByDay = new Map<number, CalendarBirthdayEntry[]>();
  for (const b of calendarBirthdays) {
    const day = b.dayOfMonth;
    if (!birthdaysByDay.has(day)) birthdaysByDay.set(day, []);
    birthdaysByDay.get(day)!.push(b);
  }

  const selectedBirthdays = selectedDay
    ? (birthdaysByDay.get(selectedDay) ?? [])
    : [];

  return (
    <div data-ocid="birthday-calendar-page">
      {/* Month navigation header */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={prevMonth}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-sky-700 hover:bg-sky-50 border border-sky-200 transition-colors"
          data-ocid="birthday-calendar-prev-month"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Prev</span>
        </button>

        <h2 className="text-base font-display font-bold text-foreground">
          🎂 {MONTH_NAMES[calendarMonth - 1]} {calendarYear}
        </h2>

        <button
          type="button"
          onClick={nextMonth}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-sky-700 hover:bg-sky-50 border border-sky-200 transition-colors"
          data-ocid="birthday-calendar-next-month"
          aria-label="Next month"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {loadingCalendar ? (
        <div className="grid grid-cols-7 gap-1">
          {DAY_NAMES.map((d) => (
            <div
              key={d}
              className="text-center text-[10px] font-bold text-muted-foreground py-1"
            >
              {d}
            </div>
          ))}
          {SKELETON_CELLS.map((k) => (
            <div
              key={k}
              className="h-16 rounded-lg bg-muted/40 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <>
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAY_NAMES.map((d) => (
              <div
                key={d}
                className="text-center text-[10px] font-bold text-muted-foreground py-1"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells before first day */}
            {EMPTY_CELLS.slice(0, firstDow).map((k) => (
              <div key={k} className="h-14 sm:h-16" />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const dayBirthdays = birthdaysByDay.get(day) ?? [];
              const isToday = day === todayDay;
              const isSelected = day === selectedDay;
              const hasBirthdays = dayBirthdays.length > 0;

              const visible: DayCellBirthday[] = dayBirthdays
                .slice(0, 2)
                .map((b) => ({
                  userId: b.userId,
                  name: b.name,
                  role: b.role,
                }));
              const extra = dayBirthdays.length - visible.length;

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => {
                    if (hasBirthdays)
                      setSelectedDay(day === selectedDay ? null : day);
                  }}
                  className={[
                    "relative h-14 sm:h-16 rounded-lg border p-1 text-left transition-all duration-150",
                    isSelected
                      ? "border-sky-400 bg-sky-50 ring-2 ring-sky-300"
                      : hasBirthdays
                        ? "border-sky-200 bg-sky-50/50 hover:border-sky-400 hover:bg-sky-50 cursor-pointer"
                        : "border-border bg-card hover:bg-muted/20",
                    isToday && !isSelected
                      ? "ring-2 ring-primary ring-offset-1"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-label={`${day} ${MONTH_NAMES[calendarMonth - 1]}${hasBirthdays ? `, ${dayBirthdays.length} birthday${dayBirthdays.length > 1 ? "s" : ""}` : ""}`}
                  data-ocid={`birthday-calendar-day-${day}`}
                >
                  {/* Day number */}
                  <span
                    className={`text-[11px] font-bold block leading-none mb-0.5 ${
                      isToday
                        ? "text-primary"
                        : hasBirthdays
                          ? "text-sky-700"
                          : "text-foreground"
                    }`}
                  >
                    {day}
                  </span>

                  {/* Birthday indicators */}
                  {visible.map((b) => (
                    <span
                      key={b.userId}
                      className="block text-[9px] leading-tight truncate text-sky-700 font-medium"
                      title={`${b.name} (${b.role})`}
                    >
                      🎂 {truncateName(b.name)}
                    </span>
                  ))}
                  {extra > 0 && (
                    <span className="text-[9px] text-sky-500 font-bold">
                      +{extra} more
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Detail panel for selected day */}
          {selectedDay !== null && selectedBirthdays.length > 0 && (
            <div
              className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-4"
              data-ocid="birthday-calendar-day-detail"
            >
              <h3 className="text-sm font-display font-bold text-sky-800 mb-3">
                🎂 Birthdays on {MONTH_NAMES[calendarMonth - 1]} {selectedDay}
              </h3>
              <div className="space-y-2">
                {selectedBirthdays.map((b) => (
                  <div
                    key={b.userId}
                    className="flex items-center gap-3 rounded-lg bg-white border border-sky-100 px-3 py-2"
                    data-ocid={`birthday-detail-card-${b.userId}`}
                  >
                    <span className="text-xl">🎂</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        {b.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {b.role}
                        {b.hq ? ` • ${b.hq}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Doctor Birthdays Today */}
      {doctorBirthdaysToday.length > 0 && (
        <div
          className="mt-4 rounded-xl border border-teal-200 bg-teal-50 p-4"
          data-ocid="birthday-calendar-doctors-today"
        >
          <h3 className="text-sm font-display font-bold text-teal-800 mb-3">
            🩺 Doctor Birthdays Today — Visit Opportunity
          </h3>
          <div className="space-y-2">
            {doctorBirthdaysToday.map((d) => (
              <div
                key={d.doctorId}
                className="flex items-center gap-3 rounded-lg bg-white border border-teal-100 px-3 py-2"
                data-ocid={`birthday-calendar-doctor-card-${d.doctorId}`}
              >
                <span className="text-xl">🩺</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    Dr. {d.name}
                  </p>
                  <p className="text-xs text-teal-600">
                    {d.specialization ? `${d.specialization} • ` : ""}
                    {d.station}
                    {d.area ? ` (${d.area})` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loadingCalendar && calendarBirthdays.length === 0 && (
        <div
          className="mt-4 py-8 text-center text-sm text-muted-foreground"
          data-ocid="birthday-calendar.empty_state"
        >
          <span className="text-3xl block mb-2">🎂</span>
          No birthdays recorded for {MONTH_NAMES[calendarMonth - 1]}{" "}
          {calendarYear}.
          <p className="text-xs mt-1 text-muted-foreground/70">
            Add Date of Birth to employee profiles to see birthdays here.
          </p>
        </div>
      )}
    </div>
  );
}
