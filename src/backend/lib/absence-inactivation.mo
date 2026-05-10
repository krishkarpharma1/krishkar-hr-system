import HRTypes      "../types/hr-core";
import HolidayTypes "../types/company-holiday";
import AuthTypes    "../types/auth-users";
import List  "mo:core/List";
import Map   "mo:core/Map";
import Int   "mo:core/Int";
import Text  "mo:core/Text";
import Nat   "mo:core/Nat";

/// Stateless domain logic for the auto-absence-inactivation feature.
/// All functions are pure (read from injected state, return values — never mutate).
module {

  // ── Date helpers ──────────────────────────────────────────────────────────

  /// Convert a nanosecond timestamp to the number of whole days since the
  /// Unix epoch (1970-01-01).  1 day = 86_400_000_000_000 ns.
  public func epochDays(ns : Int) : Int {
    ns / 86_400_000_000_000
  };

  // Zero-pad a non-negative Int to at least `width` digits.
  func padIntPositive(n : Int, width : Nat) : Text {
    let absN : Nat = Int.abs(n);
    let s = absN.toText();
    let sz = s.size();
    if (sz >= width) s
    else {
      var pad = "";
      var i = sz;
      while (i < width) { pad #= "0"; i += 1 };
      pad # s
    }
  };

  /// Derive "YYYY-MM-DD" from a nanosecond timestamp.
  /// Uses the Gregorian proleptic calendar algorithm (Euclidean Affine).
  public func nsToDate(ns : Int) : Text {
    let d   : Int = epochDays(ns);
    let z   : Int = d + 719468;
    let era : Int = (if (z >= 0) z else z - 146096) / 146097;
    let doe : Int = z - era * 146097;
    let yoe : Int = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y   : Int = yoe + era * 400;
    let doy : Int = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp  : Int = (5 * doy + 2) / 153;
    let day : Int = doy - (153 * mp + 2) / 5 + 1;
    let mon : Int = if (mp < 10) mp + 3 else mp - 9;
    let yr  : Int = if (mon <= 2) y + 1 else y;

    padIntPositive(yr, 4) # "-" # padIntPositive(mon, 2) # "-" # padIntPositive(day, 2)
  };

  /// Parse "YYYY-MM-DD" → epoch-days (Int).  Returns null on malformed input.
  public func dateToEpochDays(date : Text) : ?Int {
    // Collect parts from "YYYY-MM-DD" by iterating the split iterator
    let parts = date.split(#char '-');
    let partList = List.empty<Text>();
    for (p in parts) { partList.add(p) };
    if (partList.size() < 3) return null;
    let yrText = partList.at(0);
    let moText = partList.at(1);
    let dyText = partList.at(2);
    switch (Int.fromText(yrText), Int.fromText(moText), Int.fromText(dyText)) {
      case (?yr, ?mo, ?dy) {
        let y   : Int = if (mo <= 2) yr - 1 else yr;
        let era : Int = (if (y >= 0) y else y - 399) / 400;
        let yoe : Int = y - era * 400;
        let doy : Int = (153 * (if (mo > 2) mo - 3 else mo + 9) + 2) / 5 + dy - 1;
        let doe : Int = yoe * 365 + yoe / 4 - yoe / 100 + doy;
        ?(era * 146097 + doe - 719468)
      };
      case _ null;
    }
  };

  /// Return true if the date (as epoch-day integer) falls on a Sunday.
  /// (Unix epoch 1970-01-01 was a Thursday = day 4 of the week.)
  public func epochDayIsSunday(d : Int) : Bool {
    let rem  = (d + 4) % 7;
    let norm : Int = if (rem < 0) rem + 7 else rem;
    norm == 0
  };

  /// Given a "YYYY-MM-DD" date string, subtract `n` days and return the resulting
  /// "YYYY-MM-DD" string.
  public func subtractDays(date : Text, n : Int) : ?Text {
    switch (dateToEpochDays(date)) {
      case null  null;
      case (?d)  ?(nsToDate((d - n) * 86_400_000_000_000));
    }
  };

  // ── Working-day predicates ────────────────────────────────────────────────

  /// Return true if the "YYYY-MM-DD" date is a Sunday (weekly off).
  public func isWeeklyOff(date : Text) : Bool {
    switch (dateToEpochDays(date)) {
      case null false;
      case (?d) epochDayIsSunday(d);
    }
  };

  /// Return true if `date` matches any active CompanyHoliday.
  /// The holiday's `date` field is a nanosecond timestamp.
  public func isCompanyHoliday(
    date     : Text,
    holidays : List.List<HolidayTypes.CompanyHoliday>,
  ) : Bool {
    switch (
      holidays.find(func(h : HolidayTypes.CompanyHoliday) : Bool {
        h.isActive and nsToDate(h.date) == date
      })
    ) {
      case (?_) true;
      case null false;
    }
  };

  /// Return true if the employee has an approved leave covering `date`.
  public func isApprovedLeave(
    employeeId : Nat,
    date       : Text,
    leaves     : List.List<HRTypes.LeaveApplication>,
  ) : Bool {
    switch (
      leaves.find(func(l : HRTypes.LeaveApplication) : Bool {
        l.employeeId == employeeId
          and l.status == #approved
          and l.fromDate <= date
          and l.toDate   >= date
      })
    ) {
      case (?_) true;
      case null false;
    }
  };

  /// Return true if the date is a working day for the employee
  /// (not Sunday, not a company holiday, no approved leave).
  public func isWorkingDay(
    date       : Text,
    employeeId : Nat,
    holidays   : List.List<HolidayTypes.CompanyHoliday>,
    leaves     : List.List<HRTypes.LeaveApplication>,
  ) : Bool {
    not isWeeklyOff(date)
      and not isCompanyHoliday(date, holidays)
      and not isApprovedLeave(employeeId, date, leaves)
  };

  /// Return true if the employee checked in on `date` (#present or #halfDay).
  public func hasCheckedIn(
    employeeId : Nat,
    date       : Text,
    attendance : List.List<HRTypes.AttendanceRecord>,
  ) : Bool {
    switch (
      attendance.find(func(a : HRTypes.AttendanceRecord) : Bool {
        a.employeeId == employeeId and a.date == date
      })
    ) {
      case null false;
      case (?rec) {
        switch (rec.status) {
          case (#present or #halfDay) true;
          case _ false;
        }
      };
    }
  };

  // ── Streak detection ──────────────────────────────────────────────────────

  /// Collect consecutive unexcused absent **working** days ending on `fromDate`
  /// (inclusive), going backwards up to `maxDaysBack` calendar days.
  ///
  /// - Non-working days (Sunday / holiday / approved leave) are skipped — they
  ///   do NOT break the streak.
  /// - Streak stops at the first working day that has a check-in.
  /// - Returns absent working-day dates newest-first.
  public func getConsecutiveAbsentDays(
    employeeId  : Nat,
    fromDate    : Text,
    maxDaysBack : Nat,
    attendance  : List.List<HRTypes.AttendanceRecord>,
    holidays    : List.List<HolidayTypes.CompanyHoliday>,
    leaves      : List.List<HRTypes.LeaveApplication>,
  ) : [Text] {
    let result  = List.empty<Text>();
    var cursor  = fromDate;
    var stepped : Nat = 0;
    let limit   : Nat = maxDaysBack + 7; // small buffer for holiday gaps

    label scan loop {
      if (stepped > limit) break scan;
      let working = isWorkingDay(cursor, employeeId, holidays, leaves);
      if (working) {
        if (hasCheckedIn(employeeId, cursor, attendance)) {
          break scan   // streak broken by a check-in
        } else {
          result.add(cursor)  // unexcused absent working day
        }
      };
      switch (subtractDays(cursor, 1)) {
        case null    { break scan };
        case (?prev) { cursor := prev };
      };
      stepped += 1;
    };
    result.toArray()
  };

  // ── Per-employee check ────────────────────────────────────────────────────

  public type AbsenceCheckResult = {
    absentDates      : [Text];
    shouldInactivate : Bool;
    warningDay       : ?Nat;   // 1 or 2 for progressive warnings
  };

  public func checkEmployee(
    employee   : AuthTypes.UserRecord,
    threshold  : Nat,
    fromDate   : Text,
    attendance : List.List<HRTypes.AttendanceRecord>,
    holidays   : List.List<HolidayTypes.CompanyHoliday>,
    leaves     : List.List<HRTypes.LeaveApplication>,
  ) : AbsenceCheckResult {
    let maxBack = threshold + 14;
    let absentDates = getConsecutiveAbsentDays(
      employee.id, fromDate, maxBack,
      attendance, holidays, leaves,
    );
    let count = absentDates.size();
    if (count >= threshold) {
      { absentDates; shouldInactivate = true;  warningDay = null   }
    } else if (count == 0) {
      { absentDates; shouldInactivate = false; warningDay = null   }
    } else {
      { absentDates; shouldInactivate = false; warningDay = ?count }
    }
  };

  // ── Utility helpers ───────────────────────────────────────────────────────

  /// Return HR and Admin user IDs from the users map.
  public func getHrAndAdminIds(
    users : Map.Map<Nat, AuthTypes.UserRecord>,
  ) : [Nat] {
    let result = List.empty<Nat>();
    for ((_uid, u) in users.entries()) {
      if (u.status == #Active) {
        switch (u.role) {
          case (#Admin or #HRManager) { result.add(u.id) };
          case _ {};
        };
      };
    };
    result.toArray()
  };

  /// Build the primary HQ/territory display label for an employee.
  public func primaryHqLabel(employee : AuthTypes.UserRecord) : Text {
    if (employee.territory.size() > 0) employee.territory
    else if (employee.hqAssignments.size() > 0)
      "HQ-" # employee.hqAssignments[0].hqId.toText()
    else "Unknown HQ"
  };

  /// Convert a Role variant to a display string.
  public func roleToText(role : AuthTypes.Role) : Text {
    switch (role) {
      case (#MR)        "MR";
      case (#ASM)       "ASM";
      case (#RSM)       "RSM";
      case (#ZSM)       "ZSM";
      case (#HRManager) "HR Manager";
      case (#Admin)     "Admin";
    }
  };
};
