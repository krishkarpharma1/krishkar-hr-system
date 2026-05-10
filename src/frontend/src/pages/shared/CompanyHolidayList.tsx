/**
 * Read-only Company Holiday List — visible on all portals.
 * HR and Admin see a link to the management page.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
  Search,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Role } from "../../backend";
import type { CompanyHoliday } from "../../backend.d";
import { HolidayType } from "../../backend.d";
import {
  PageContent,
  PageHeader,
  PortalLayout,
} from "../../components/PortalLayout";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import { formatDate as sharedFormatDate } from "../../utils/dateFormatter";

interface Props {
  portalRole: Role;
}

const MONTH_NAMES = [
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

function formatDate(ts: bigint): string {
  return sharedFormatDate(ts);
}
function dayOfWeek(ts: bigint): string {
  return DAY_NAMES[new Date(Number(ts)).getDay()];
}
function isUpcoming(ts: bigint): boolean {
  const now = Date.now();
  const diff = Number(ts) - now;
  return diff > 0 && diff <= 30 * 24 * 60 * 60 * 1000;
}
function isPast(ts: bigint): boolean {
  return Number(ts) < Date.now();
}

const HOLIDAY_TYPE_LABELS: Record<HolidayType, string> = {
  [HolidayType.NationalHoliday]: "National",
  [HolidayType.FestivalHoliday]: "Festival",
  [HolidayType.RegionalHoliday]: "Regional",
  [HolidayType.OptionalHoliday]: "Optional",
};

const HOLIDAY_TYPE_COLORS: Record<HolidayType, string> = {
  [HolidayType.NationalHoliday]: "bg-blue-100 text-blue-700 border-blue-200",
  [HolidayType.FestivalHoliday]:
    "bg-orange-100 text-orange-700 border-orange-200",
  [HolidayType.RegionalHoliday]:
    "bg-purple-100 text-purple-700 border-purple-200",
  [HolidayType.OptionalHoliday]: "bg-muted text-muted-foreground border-border",
};

function applicableToLabel(h: CompanyHoliday): string {
  const a = h.applicableTo;
  if (a.__kind__ === "AllEmployees") return "All Employees";
  if (a.__kind__ === "SpecificRoles")
    return `Roles: ${a.SpecificRoles.join(", ")}`;
  if (a.__kind__ === "SpecificTerritories")
    return `Territories: ${a.SpecificTerritories.join(", ")}`;
  return "—";
}

// ── Calendar View ────────────────────────────────────────────────────────────
function CalendarView({
  holidays,
  year,
  month,
  onPrev,
  onNext,
}: {
  holidays: CompanyHoliday[];
  year: number;
  month: number; // 0-indexed
  onPrev: () => void;
  onNext: () => void;
}) {
  const holidayDays = useMemo(() => {
    const set = new Set<number>();
    for (const h of holidays) {
      const d = new Date(Number(h.date));
      if (d.getFullYear() === year && d.getMonth() === month) {
        set.add(d.getDate());
      }
    }
    return set;
  }, [holidays, year, month]);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // pad to complete weeks
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <Button
          variant="ghost"
          size="icon"
          onClick={onPrev}
          className="h-8 w-8"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-sm font-display font-semibold">
          {MONTH_NAMES[month]} {year}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={onNext}
          className="h-8 w-8"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
      <div className="p-3">
        {/* day labels */}
        <div className="grid grid-cols-7 mb-1">
          {DAY_NAMES.map((d) => (
            <div
              key={d}
              className={`text-center text-[11px] font-display font-semibold pb-1 ${d === "Sun" ? "text-destructive" : "text-muted-foreground"}`}
            >
              {d}
            </div>
          ))}
        </div>
        {/* weeks */}
        {Array.from({ length: cells.length / 7 }, (_, wi) => {
          const weekStart = cells[wi * 7];
          const weekKey = `week-${weekStart !== null ? weekStart : `pad-${wi}`}`;
          return (
            <div key={weekKey} className="grid grid-cols-7">
              {cells.slice(wi * 7, wi * 7 + 7).map((day, ci) => {
                const isSun = ci === 0;
                const isHol = day !== null && holidayDays.has(day);
                const cellKey =
                  day !== null ? `day-${day}` : `empty-week${wi}-col${ci + 1}`;
                return (
                  <div
                    key={cellKey}
                    className={`h-9 flex items-center justify-center rounded text-xs font-body relative
                      ${!day ? "opacity-0" : ""}
                      ${isSun && day ? "text-destructive font-semibold" : "text-foreground"}
                      ${isHol ? "bg-primary/15 ring-1 ring-primary/40 font-bold text-primary" : ""}
                    `}
                    title={
                      isHol ? "Company Holiday" : isSun ? "Weekly Off" : ""
                    }
                  >
                    {day}
                    {isHol && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-primary/15 ring-1 ring-primary/40 inline-block" />{" "}
            Holiday
          </span>
          <span className="flex items-center gap-1.5 text-destructive">
            Sun = Weekly Off
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function CompanyHolidayList({ portalRole }: Props) {
  const { session } = useAuthStore();
  const [holidays, setHolidays] = useState<CompanyHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCalendar, setShowCalendar] = useState(false);
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const data = await api.getActiveHolidays(session.token);
      // sort by date ascending
      data.sort((a, b) => (a.date < b.date ? -1 : 1));
      setHolidays(data);
    } catch {
      toast.error("Failed to load company holidays");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  const upcoming = useMemo(
    () => holidays.filter((h) => isUpcoming(h.date)),
    [holidays],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return holidays;
    return holidays.filter(
      (h) =>
        h.name.toLowerCase().includes(q) ||
        formatDate(h.date).toLowerCase().includes(q),
    );
  }, [holidays, search]);

  const handleCalPrev = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear((y) => y - 1);
    } else setCalMonth((m) => m - 1);
  };
  const handleCalNext = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear((y) => y + 1);
    } else setCalMonth((m) => m + 1);
  };

  return (
    <PortalLayout portalRole={portalRole}>
      <PageHeader
        title="Company Holidays"
        subtitle="Official company holiday calendar for the year"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCalendar((v) => !v)}
            data-ocid="toggle-calendar-view"
          >
            <CalendarDays className="w-3.5 h-3.5 mr-1.5" />
            {showCalendar ? "Table View" : "Calendar View"}
          </Button>
        }
      />
      <PageContent>
        <div className="space-y-4 max-w-5xl">
          {/* Upcoming holidays */}
          {upcoming.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-xs font-display font-semibold text-amber-800 uppercase tracking-wider mb-2">
                Upcoming Holidays (next 30 days)
              </p>
              <div className="flex flex-wrap gap-2">
                {upcoming.map((h) => (
                  <span
                    key={String(h.id)}
                    className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-medium"
                    data-ocid="upcoming-holiday-badge"
                  >
                    <CalendarDays className="w-3 h-3" />
                    {h.name} — {formatDate(h.date)} ({dayOfWeek(h.date)})
                    <Badge className="ml-1 text-[10px] py-0 px-1.5 bg-amber-500 text-white border-0">
                      Upcoming
                    </Badge>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or date…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
              data-ocid="holiday-search"
            />
          </div>

          {/* Calendar or Table */}
          {showCalendar ? (
            <CalendarView
              holidays={holidays}
              year={calYear}
              month={calMonth}
              onPrev={handleCalPrev}
              onNext={handleCalNext}
            />
          ) : (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/30">
                <span className="text-xs font-display font-semibold uppercase tracking-wider text-muted-foreground">
                  All Holidays ({filtered.length})
                </span>
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : filtered.length === 0 ? (
                <div
                  className="py-12 text-center"
                  data-ocid="holiday-list-empty"
                >
                  <CalendarDays className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-40" />
                  <p className="text-sm text-muted-foreground">
                    {search
                      ? "No holidays match your search."
                      : "No holidays found."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table
                    className="w-full text-sm min-w-[700px]"
                    data-ocid="holiday-table"
                  >
                    <thead>
                      <tr className="bg-muted/40 border-b border-border">
                        {[
                          "Sr.No.",
                          "Holiday Name",
                          "Date",
                          "Day",
                          "Type",
                          "Applicable To",
                        ].map((h) => (
                          <th
                            key={h}
                            className="px-4 py-2.5 text-left text-xs font-display text-muted-foreground uppercase tracking-wider"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filtered.map((h, i) => (
                        <tr
                          key={String(h.id)}
                          className={`hover:bg-muted/20 transition-colors ${isPast(h.date) ? "opacity-60" : ""}`}
                          data-ocid={`holiday-row-${h.id}`}
                        >
                          <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                            {i + 1}
                          </td>
                          <td className="px-4 py-3 font-body font-medium text-foreground">
                            {h.name}
                            {isUpcoming(h.date) && (
                              <Badge className="ml-2 text-[10px] py-0 px-1.5 bg-amber-500 text-white border-0">
                                Upcoming
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono">
                            {formatDate(h.date)}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {dayOfWeek(h.date)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full border font-medium ${HOLIDAY_TYPE_COLORS[h.holidayType]}`}
                            >
                              {HOLIDAY_TYPE_LABELS[h.holidayType]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {applicableToLabel(h)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Info note for non-admin/hr */}
          {portalRole !== Role.Admin && portalRole !== Role.HRManager && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-4 py-3 border border-border">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-muted-foreground" />
              For adding or editing holidays, please contact HR or Admin.
            </div>
          )}
        </div>
      </PageContent>
    </PortalLayout>
  );
}
