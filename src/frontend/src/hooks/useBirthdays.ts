import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuthStore } from "../store/authStore";

export interface BirthdayEntry {
  userId: string;
  name: string;
  role: string;
  hq: string;
  employeeId: string;
}

export interface UpcomingBirthdayEntry {
  userId: string;
  name: string;
  role: string;
  hq: string;
  birthdayDate: string;
  daysUntilBirthday: number;
}

export interface CalendarBirthdayEntry {
  userId: string;
  name: string;
  role: string;
  hq: string;
  dayOfMonth: number;
  month: number;
}

export interface DoctorBirthdayEntry {
  doctorId: string;
  name: string;
  specialization: string;
  station: string;
  area: string;
}

interface UseBirthdaysResult {
  todaysBirthdays: BirthdayEntry[];
  doctorBirthdaysToday: DoctorBirthdayEntry[];
  isCurrentUserBirthday: boolean;
  upcomingBirthdays: UpcomingBirthdayEntry[];
  calendarBirthdays: CalendarBirthdayEntry[];
  calendarMonth: number;
  calendarYear: number;
  setCalendarMonth: (month: number, year: number) => void;
  loadingToday: boolean;
  loadingUpcoming: boolean;
  loadingCalendar: boolean;
}

export function useBirthdays(): UseBirthdaysResult {
  const { session } = useAuthStore();
  const token = session?.token ?? "";
  const currentUserId = String(session?.userId ?? "");

  const now = new Date();
  const [calendarMonth, setCalendarMonthState] = useState(now.getMonth() + 1);
  const [calendarYear, setCalendarYearState] = useState(now.getFullYear());

  const [todaysBirthdays, setTodaysBirthdays] = useState<BirthdayEntry[]>([]);
  const [doctorBirthdaysToday, setDoctorBirthdaysToday] = useState<
    DoctorBirthdayEntry[]
  >([]);
  const [upcomingBirthdays, setUpcomingBirthdays] = useState<
    UpcomingBirthdayEntry[]
  >([]);
  const [calendarBirthdays, setCalendarBirthdays] = useState<
    CalendarBirthdayEntry[]
  >([]);

  const [loadingToday, setLoadingToday] = useState(false);
  const [loadingUpcoming, setLoadingUpcoming] = useState(false);
  const [loadingCalendar, setLoadingCalendar] = useState(false);

  // Fetch today's birthdays (hierarchy-aware)
  useEffect(() => {
    if (!token) return;
    setLoadingToday(true);
    Promise.all([
      (
        api as unknown as Record<
          string,
          (...args: unknown[]) => Promise<unknown>
        >
      )
        .getBirthdaysToday?.(token)
        .catch(() => []),
      (
        api as unknown as Record<
          string,
          (...args: unknown[]) => Promise<unknown>
        >
      )
        .getDoctorBirthdaysToday?.(token)
        .catch(() => []),
    ])
      .then(([employees, doctors]) => {
        const empArr =
          (employees as Array<{
            userId: string;
            name: string;
            role: string;
            hq: string;
            employeeId: string;
          }>) ?? [];
        setTodaysBirthdays(
          empArr.map((e) => ({
            userId: e.userId,
            name: e.name,
            role: e.role,
            hq: e.hq,
            employeeId: e.employeeId,
          })),
        );
        const docArr =
          (doctors as Array<{
            doctorId: string;
            name: string;
            specialization: string;
            station: string;
            area: string;
          }>) ?? [];
        setDoctorBirthdaysToday(
          docArr.map((d) => ({
            doctorId: d.doctorId,
            name: d.name,
            specialization: d.specialization,
            station: d.station,
            area: d.area,
          })),
        );
      })
      .finally(() => setLoadingToday(false));
  }, [token]);

  // Fetch upcoming birthdays (7 days ahead)
  useEffect(() => {
    if (!token) return;
    setLoadingUpcoming(true);
    const rawApi = api as unknown as Record<
      string,
      (...args: unknown[]) => Promise<unknown>
    >;
    rawApi
      .getUpcomingBirthdays?.(BigInt(7), token)
      .then((res) => {
        const arr =
          (res as Array<{
            userId: string;
            name: string;
            role: string;
            hq: string;
            birthdayDate: string;
            daysUntilBirthday: bigint;
          }>) ?? [];
        setUpcomingBirthdays(
          arr.map((e) => ({
            userId: e.userId,
            name: e.name,
            role: e.role,
            hq: e.hq,
            birthdayDate: e.birthdayDate,
            daysUntilBirthday: Number(e.daysUntilBirthday),
          })),
        );
      })
      .catch(() => {})
      .finally(() => setLoadingUpcoming(false));
  }, [token]);

  // Fetch calendar data
  const fetchCalendar = useCallback(
    (month: number, year: number) => {
      if (!token) return;
      setLoadingCalendar(true);
      const rawApi = api as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      rawApi
        .getBirthdayCalendar?.(BigInt(month), BigInt(year), token)
        .then((res) => {
          const arr =
            (res as Array<{
              userId: string;
              name: string;
              role: string;
              hq: string;
              dayOfMonth: bigint;
              month: bigint;
            }>) ?? [];
          setCalendarBirthdays(
            arr.map((e) => ({
              userId: e.userId,
              name: e.name,
              role: e.role,
              hq: e.hq,
              dayOfMonth: Number(e.dayOfMonth),
              month: Number(e.month),
            })),
          );
        })
        .catch(() => {})
        .finally(() => setLoadingCalendar(false));
    },
    [token],
  );

  useEffect(() => {
    fetchCalendar(calendarMonth, calendarYear);
  }, [fetchCalendar, calendarMonth, calendarYear]);

  const setCalendarMonth = useCallback((month: number, year: number) => {
    setCalendarMonthState(month);
    setCalendarYearState(year);
  }, []);

  const isCurrentUserBirthday = todaysBirthdays.some(
    (b) => b.userId === currentUserId,
  );

  return {
    todaysBirthdays,
    doctorBirthdaysToday,
    isCurrentUserBirthday,
    upcomingBirthdays,
    calendarBirthdays,
    calendarMonth,
    calendarYear,
    setCalendarMonth,
    loadingToday,
    loadingUpcoming,
    loadingCalendar,
  };
}
