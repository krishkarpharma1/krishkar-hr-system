import AuthTypes "../types/auth-users";
import FieldTypes "../types/field-ops";
import Map "mo:core/Map";
import List "mo:core/List";
import Nat "mo:core/Nat";
import Time "mo:core/Time";

/// Birthday query mixin — exposes read-only birthday queries for portals.
/// No new stable state required: reads from existing users and doctors maps.
mixin (
  users        : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
  doctors      : List.List<FieldTypes.Doctor>,
  sessions     : Map.Map<Text, AuthTypes.Session>,
  userDobMap   : Map.Map<Text, Text>,
  doctorDobMap : Map.Map<Text, Text>,
) {

  // ── Internal date helpers ─────────────────────────────────────────────────

  /// Derive (month, day) as Nat values from a nanosecond IC timestamp.
  /// Uses the proleptic Gregorian calendar algorithm.
  private func monthDayFromNs(nowNs : Int) : (Nat, Nat) {
    let secs : Int = nowNs / 1_000_000_000;
    let days : Int = secs / 86400;
    let z    : Int = days + 719468;
    let era  : Int = (if (z >= 0) z else z - 146096) / 146097;
    let doe  : Int = z - era * 146097;
    let yoe  : Int = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let doy  : Int = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp   : Int = (5 * doy + 2) / 153;
    let m    : Int = if (mp < 10) mp + 3 else mp - 9;
    let d    : Int = doy - (153 * mp + 2) / 5 + 1;
    let month : Nat = if (m > 0) m.toNat() else 1;
    let day   : Nat = if (d > 0) d.toNat() else 1;
    (month, day)
  };

  /// Derive the year from a nanosecond IC timestamp.
  private func yearFromNs(nowNs : Int) : Nat {
    let secs : Int = nowNs / 1_000_000_000;
    let days : Int = secs / 86400;
    let z    : Int = days + 719468;
    let era  : Int = (if (z >= 0) z else z - 146096) / 146097;
    let doe  : Int = z - era * 146097;
    let yoe  : Int = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y    : Int = yoe + era * 400;
    let doy  : Int = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp   : Int = (5 * doy + 2) / 153;
    let m    : Int = if (mp < 10) mp + 3 else mp - 9;
    let yr   : Int = if (m <= 2) y + 1 else y;
    if (yr > 0) yr.toNat() else 2026
  };

  /// Extract (month, day) from a "YYYY-MM-DD" date string.
  /// Returns null if the format is invalid.
  private func parseDobMonthDay(dob : Text) : ?(Nat, Nat) {
    // Expect exactly "YYYY-MM-DD" — 10 characters
    if (dob.size() != 10) return null;
    let chars = dob.toArray();
    // months at index 5,6; day at index 8,9
    let mChar0 = chars[5];
    let mChar1 = chars[6];
    let dChar0 = chars[8];
    let dChar1 = chars[9];
    // Verify separators
    if (chars[4] != '-' or chars[7] != '-') return null;
    // Parse digits
    let m0 = mChar0.toNat32().toNat();
    let m1 = mChar1.toNat32().toNat();
    let d0 = dChar0.toNat32().toNat();
    let d1 = dChar1.toNat32().toNat();
    let zero : Nat = '0'.toNat32().toNat();
    // Validate character range
    if (m0 < zero or m0 > zero + 9) return null;
    if (m1 < zero or m1 > zero + 9) return null;
    if (d0 < zero or d0 > zero + 9) return null;
    if (d1 < zero or d1 > zero + 9) return null;
    let month = (m0 - zero) * 10 + (m1 - zero);
    let day   = (d0 - zero) * 10 + (d1 - zero);
    if (month < 1 or month > 12) return null;
    if (day   < 1 or day   > 31) return null;
    ?(month, day)
  };

  /// Compute the role text from a Role variant.
  private func roleText(role : AuthTypes.Role) : Text {
    switch (role) {
      case (#Admin)     { "Admin" };
      case (#HRManager) { "HR Manager" };
      case (#ZSM)       { "ZSM" };
      case (#RSM)       { "RSM" };
      case (#ASM)       { "ASM" };
      case (#MR)        { "MR" };
    }
  };

  /// Resolve the primary HQ name for a user (first hqAssignment block if present).
  private func primaryHqText(user : AuthTypes.UserRecord) : Text {
    if (user.hqAssignments.size() > 0) {
      user.hqAssignments[0].hqId.toText()
    } else if (user.hqIds.size() > 0) {
      user.hqIds[0].toText()
    } else {
      ""
    }
  };

  /// Collect all transitive reportee user IDs (BFS) including the seed itself.
  private func hierarchyIds(managerId : AuthTypes.UserId) : [AuthTypes.UserId] {
    let visited = List.empty<AuthTypes.UserId>();
    let queue   = List.empty<AuthTypes.UserId>();
    queue.add(managerId);
    label bfs loop {
      switch (queue.removeLast()) {
        case null    { break bfs };
        case (?uid) {
          if (not visited.contains(uid)) {
            visited.add(uid);
            for ((_, u) in users.entries()) {
              switch (u.reportsTo) {
                case (?mid) { if (mid == uid) { queue.add(u.id) } };
                case null   {};
              }
            }
          }
        };
      }
    };
    visited.toArray()
  };

  // ── Internal birthday fetch helpers ───────────────────────────────────────

  /// Return all active employees whose birthday (month+day) matches (month, day).
  private func employeeBirthdaysOnDay(
    month : Nat,
    day   : Nat,
  ) : [{ userId : Text; name : Text; role : Text; hq : Text; employeeId : Text }] {
    let result = List.empty<{ userId : Text; name : Text; role : Text; hq : Text; employeeId : Text }>();
    for ((_, u) in users.entries()) {
      if (u.status == #Active) {
        switch (userDobMap.get(u.id.toText())) {
          case null {};
          case (?dob) {
            switch (parseDobMonthDay(dob)) {
              case null {};
              case (?(bMonth, bDay)) {
                if (bMonth == month and bDay == day) {
                  result.add({
                    userId     = u.id.toText();
                    name       = u.name;
                    role       = roleText(u.role);
                    hq         = primaryHqText(u);
                    employeeId = u.employeeId;
                  });
                }
              };
            }
          };
        }
      }
    };
    result.toArray()
  };

  /// Return active employees whose birthday falls in the given month.
  private func employeeBirthdaysInMonth(
    month : Nat,
  ) : [{ userId : Text; name : Text; role : Text; hq : Text; dayOfMonth : Nat; month : Nat }] {
    let result = List.empty<{ userId : Text; name : Text; role : Text; hq : Text; dayOfMonth : Nat; month : Nat }>();
    for ((_, u) in users.entries()) {
      if (u.status == #Active) {
        switch (userDobMap.get(u.id.toText())) {
          case null {};
          case (?dob) {
            switch (parseDobMonthDay(dob)) {
              case null {};
              case (?(bMonth, bDay)) {
                if (bMonth == month) {
                  result.add({
                    userId     = u.id.toText();
                    name       = u.name;
                    role       = roleText(u.role);
                    hq         = primaryHqText(u);
                    dayOfMonth = bDay;
                    month      = bMonth;
                  });
                }
              };
            }
          };
        }
      }
    };
    // Sort by day of month ascending
    result.sortInPlace(func(
      a : { userId : Text; name : Text; role : Text; hq : Text; dayOfMonth : Nat; month : Nat },
      b : { userId : Text; name : Text; role : Text; hq : Text; dayOfMonth : Nat; month : Nat },
    ) : { #less; #equal; #greater } {
      if (a.dayOfMonth < b.dayOfMonth) #less
      else if (a.dayOfMonth == b.dayOfMonth) #equal
      else #greater
    });
    result.toArray()
  };

  /// Compute how many days until the next occurrence of (bMonth, bDay) from today.
  /// Year-agnostic: always looks at the next upcoming date within the next 365 days.
  private func daysUntil(
    todayMonth : Nat,
    todayDay   : Nat,
    todayYear  : Nat,
    bMonth     : Nat,
    bDay       : Nat,
  ) : Nat {
    // Approximate — treats every month as 30 days for ordering, then corrects using
    // simple day-of-year calculation (365 days / no leap year adjustment needed for display).
    let todayDoy = approxDayOfYear(todayMonth, todayDay);
    let bDoy     = approxDayOfYear(bMonth, bDay);
    if (bDoy >= todayDoy) {
      bDoy - todayDoy
    } else {
      365 - todayDoy + bDoy
    }
  };

  /// Approximate day-of-year using fixed 30/31 day months (display accuracy only).
  private func approxDayOfYear(month : Nat, day : Nat) : Nat {
    let daysInMonth = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    var doy : Nat = 0;
    var m : Nat = 1;
    while (m < month) {
      if (m < daysInMonth.size()) {
        doy += daysInMonth[m];
      };
      m += 1;
    };
    doy + day
  };

  // ── Public API ────────────────────────────────────────────────────────────

  /// Return all active employees whose birthday (month+day) matches today.
  /// Used by portals to show birthday flash banners — all-company view.
  /// Accessible to any authenticated session.
  public query func getBirthdaysToday(
    token : Text,
  ) : async [{ userId : Text; name : Text; role : Text; hq : Text; employeeId : Text }] {
    switch (sessions.get(token)) {
      case null { [] };
      case (?s) {
        if (Time.now() > s.expiresAt) return [];
        let (month, day) = monthDayFromNs(Time.now());
        employeeBirthdaysOnDay(month, day)
      };
    }
  };

  /// Return active employees with today's birthday, scoped to the logged-in
  /// user's downward reporting hierarchy.
  /// - MR:              only themselves
  /// - ASM/RSM/ZSM:    themselves + all transitive reportees
  /// - HR/Admin:        full company
  public query func getBirthdaysForHierarchy(
    token : Text,
  ) : async [{ userId : Text; name : Text; role : Text; hq : Text; employeeId : Text }] {
    switch (sessions.get(token)) {
      case null { [] };
      case (?s) {
        if (Time.now() > s.expiresAt) return [];
        let (month, day) = monthDayFromNs(Time.now());
        let all = employeeBirthdaysOnDay(month, day);
        // HR and Admin see everyone
        switch (s.role) {
          case (#Admin or #HRManager) { all };
          case _ {
            // Build the set of IDs in this manager's hierarchy (including themselves)
            let ids = hierarchyIds(s.userId);
            all.filter(func(
              e : { userId : Text; name : Text; role : Text; hq : Text; employeeId : Text }
            ) : Bool {
              let uidNat = switch (Nat.fromText(e.userId)) { case (?n) n; case null 0 };
              ids.any(func(id : AuthTypes.UserId) : Bool { id == uidNat })
            })
          };
        }
      };
    }
  };

  /// Return all active employees whose birthday falls in the given month and year.
  /// Sorted by day of month ascending. Accessible to: HR, Admin, RSM, ZSM.
  public query func getBirthdayCalendar(
    month : Nat,
    year  : Nat,
    token : Text,
  ) : async [{ userId : Text; name : Text; role : Text; hq : Text; dayOfMonth : Nat; month : Nat }] {
    switch (sessions.get(token)) {
      case null { [] };
      case (?s) {
        if (Time.now() > s.expiresAt) return [];
        switch (s.role) {
          case (#Admin or #HRManager or #ZSM or #RSM) {
            employeeBirthdaysInMonth(month)
          };
          case _ { [] };
        }
      };
    }
  };

  /// Return active employees whose birthday falls within the next `daysAhead` days
  /// (default 7), scoped to the logged-in user's reporting hierarchy.
  public query func getUpcomingBirthdays(
    daysAhead : Nat,
    token     : Text,
  ) : async [{ userId : Text; name : Text; role : Text; hq : Text; daysUntilBirthday : Nat; birthdayDate : Text }] {
    switch (sessions.get(token)) {
      case null { [] };
      case (?s) {
        if (Time.now() > s.expiresAt) return [];
        let now = Time.now();
        let (todayMonth, todayDay) = monthDayFromNs(now);
        let todayYear = yearFromNs(now);
        let window = if (daysAhead == 0) 7 else daysAhead;

        // Collect hierarchy IDs if not HR/Admin
        let useHierarchy = switch (s.role) {
          case (#Admin or #HRManager) { false };
          case _ { true };
        };
        let ids = if (useHierarchy) hierarchyIds(s.userId) else [];

        let result = List.empty<{ userId : Text; name : Text; role : Text; hq : Text; daysUntilBirthday : Nat; birthdayDate : Text }>();
        for ((_, u) in users.entries()) {
          if (u.status == #Active) {
            // Hierarchy filter
            let inScope = if (useHierarchy) {
              ids.any(func(id : AuthTypes.UserId) : Bool { id == u.id })
            } else { true };
            if (inScope) {
              switch (userDobMap.get(u.id.toText())) {
                case null {};
                case (?dob) {
                  switch (parseDobMonthDay(dob)) {
                    case null {};
                    case (?(bMonth, bDay)) {
                      let diff = daysUntil(todayMonth, todayDay, todayYear, bMonth, bDay);
                      if (diff <= window) {
                        result.add({
                          userId             = u.id.toText();
                          name               = u.name;
                          role               = roleText(u.role);
                          hq                 = primaryHqText(u);
                          daysUntilBirthday  = diff;
                          birthdayDate       = bMonth.toText() # "-" # bDay.toText();
                        });
                      }
                    };
                  }
                };
              }
            }
          }
        };
        // Sort by daysUntilBirthday ascending
        result.sortInPlace(func(
          a : { userId : Text; name : Text; role : Text; hq : Text; daysUntilBirthday : Nat; birthdayDate : Text },
          b : { userId : Text; name : Text; role : Text; hq : Text; daysUntilBirthday : Nat; birthdayDate : Text },
        ) : { #less; #equal; #greater } {
          if (a.daysUntilBirthday < b.daysUntilBirthday) #less
          else if (a.daysUntilBirthday == b.daysUntilBirthday) #equal
          else #greater
        });
        result.toArray()
      };
    }
  };

  /// Return doctors with today's birthday (for MR portal visit reminder).
  /// Scoped to all doctors (filtering by MR territory is done frontend-side).
  /// Accessible to any authenticated session.
  public query func getDoctorBirthdaysToday(
    token : Text,
  ) : async [{ doctorId : Text; name : Text; specialization : Text; station : Text; area : Text }] {
    switch (sessions.get(token)) {
      case null { [] };
      case (?s) {
        if (Time.now() > s.expiresAt) return [];
        let (month, day) = monthDayFromNs(Time.now());
        let result = List.empty<{ doctorId : Text; name : Text; specialization : Text; station : Text; area : Text }>();
        for (d in doctors.values()) {
          if (d.isActive) {
            switch (doctorDobMap.get(d.id.toText())) {
              case null {};
              case (?dob) {
                switch (parseDobMonthDay(dob)) {
                  case null {};
                  case (?(bMonth, bDay)) {
                    if (bMonth == month and bDay == day) {
                      result.add({
                        doctorId      = d.id.toText();
                        name          = d.name;
                        specialization = d.specialization;
                        station       = d.station;
                        area          = d.area;
                      });
                    }
                  };
                }
              };
            }
          }
        };
        result.toArray()
      };
    }
  };
};
