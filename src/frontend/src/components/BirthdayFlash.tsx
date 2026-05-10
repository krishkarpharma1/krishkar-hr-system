import { X } from "lucide-react";
import { useEffect, useState } from "react";
import type { BirthdayEntry, DoctorBirthdayEntry } from "../hooks/useBirthdays";

interface BirthdayFlashProps {
  birthdays: BirthdayEntry[];
  doctorBirthdays?: DoctorBirthdayEntry[];
  currentUserId: string;
  isOwnBirthday: boolean;
}

function dismissKey(userId: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `birthday_dismissed_${userId}_${today}`;
}

function doctorDismissKey(doctorId: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `birthday_doctor_dismissed_${doctorId}_${today}`;
}

function isDismissed(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function setDismissedStorage(key: string) {
  try {
    sessionStorage.setItem(key, "1");
  } catch {
    // ignore
  }
}

export function BirthdayFlash({
  birthdays,
  doctorBirthdays = [],
  currentUserId,
  isOwnBirthday,
}: BirthdayFlashProps) {
  const [dismissed, setDismissedState] = useState<Set<string>>(new Set());

  useEffect(() => {
    const initial = new Set<string>();
    for (const b of birthdays) {
      if (isDismissed(dismissKey(b.userId))) initial.add(b.userId);
    }
    for (const d of doctorBirthdays) {
      if (isDismissed(doctorDismissKey(d.doctorId)))
        initial.add(`doctor_${d.doctorId}`);
    }
    if (initial.size > 0) setDismissedState(initial);
  }, [birthdays, doctorBirthdays]);

  function handleDismiss(id: string, isDoctor = false) {
    const key = isDoctor ? doctorDismissKey(id) : dismissKey(id);
    setDismissedStorage(key);
    const mapKey = isDoctor ? `doctor_${id}` : id;
    setDismissedState((prev) => {
      const next = new Set(prev);
      next.add(mapKey);
      return next;
    });
  }

  const visibleBirthdays = birthdays.filter((b) => !dismissed.has(b.userId));
  const visibleDoctorBirthdays = doctorBirthdays.filter(
    (d) => !dismissed.has(`doctor_${d.doctorId}`),
  );

  if (visibleBirthdays.length === 0 && visibleDoctorBirthdays.length === 0) {
    return null;
  }

  return (
    <div className="mb-4 space-y-2" data-ocid="birthday-flash-section">
      {/* Employee birthdays */}
      {visibleBirthdays.map((b) => {
        const isOwn = b.userId === currentUserId || isOwnBirthday;
        return (
          <div
            key={b.userId}
            className="relative flex items-start gap-3 rounded-xl border border-sky-300 bg-gradient-to-r from-sky-50 to-blue-50 px-4 py-3 shadow-sm"
            data-ocid={`birthday-flash-card-${b.userId}`}
          >
            <div
              className="text-2xl flex-shrink-0 select-none animate-bounce"
              aria-hidden="true"
            >
              🎂
            </div>
            <div className="flex-1 min-w-0">
              {isOwn ? (
                <>
                  <p className="text-sm font-bold text-sky-800">
                    Happy Birthday, {b.name}! 🎉
                  </p>
                  <p className="text-xs text-sky-600 mt-0.5">
                    Wishing you a wonderful day!
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-bold text-sky-800">
                    Today is <span className="text-sky-900">{b.name}</span>
                    's Birthday!
                  </p>
                  <p className="text-xs text-sky-600 mt-0.5">
                    {b.role}
                    {b.hq ? ` • ${b.hq}` : ""} — Wish them well!
                  </p>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => handleDismiss(b.userId)}
              className="flex-shrink-0 rounded-full p-1 hover:bg-sky-200 transition-colors"
              aria-label={`Dismiss birthday notification for ${b.name}`}
              data-ocid={`birthday-flash-dismiss-${b.userId}`}
            >
              <X className="w-3.5 h-3.5 text-sky-500" />
            </button>
          </div>
        );
      })}

      {/* Doctor birthdays */}
      {visibleDoctorBirthdays.map((d) => (
        <div
          key={d.doctorId}
          className="relative flex items-start gap-3 rounded-xl border border-teal-300 bg-gradient-to-r from-teal-50 to-cyan-50 px-4 py-3 shadow-sm"
          data-ocid={`birthday-flash-doctor-${d.doctorId}`}
        >
          <div
            className="text-2xl flex-shrink-0 select-none animate-bounce"
            aria-hidden="true"
          >
            🩺
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-teal-800">
              Today is Dr. <span className="text-teal-900">{d.name}</span>
              's Birthday!
            </p>
            <p className="text-xs text-teal-600 mt-0.5">
              {d.specialization ? `${d.specialization} • ` : ""}
              {d.station}
              {d.area ? ` (${d.area})` : ""} — A great opportunity to make a
              visit!
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleDismiss(d.doctorId, true)}
            className="flex-shrink-0 rounded-full p-1 hover:bg-teal-200 transition-colors"
            aria-label={`Dismiss birthday notification for Dr. ${d.name}`}
            data-ocid={`birthday-flash-doctor-dismiss-${d.doctorId}`}
          >
            <X className="w-3.5 h-3.5 text-teal-500" />
          </button>
        </div>
      ))}
    </div>
  );
}
