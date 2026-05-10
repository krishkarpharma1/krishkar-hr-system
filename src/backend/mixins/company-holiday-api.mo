import HolidayTypes    "../types/company-holiday";
import HRCoreTypes     "../types/hr-core";
import AuthTypes       "../types/auth-users";
import CompanyHolidayLib "../lib/company-holiday";
import Map             "mo:core/Map";
import List            "mo:core/List";
import Time            "mo:core/Time";

mixin (
  sessions         : Map.Map<Text, AuthTypes.Session>,
  companyHolidays  : List.List<HolidayTypes.CompanyHoliday>,
  nextHolidayId    : { var value : Nat },
  // attendance and nextAttendId are needed for auto-marking holidays in attendance
  attendance       : List.List<HRCoreTypes.AttendanceRecord>,
  nextAttendId     : { var value : Nat },
  // users for iterating all employees when auto-marking
  users            : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
) {

  // ── Session helpers ────────────────────────────────────────────────────────

  func holidayRequireSession(token : Text) : ?AuthTypes.Session {
    switch (sessions.get(token)) {
      case (?s) { if (s.expiresAt > Time.now()) ?s else null };
      case null { null };
    };
  };

  func holidayRequireHROrAdmin(token : Text) : ?AuthTypes.Session {
    switch (holidayRequireSession(token)) {
      case null { null };
      case (?s) {
        switch (s.role) {
          case (#Admin or #HRManager) ?s;
          case _                      { null };
        }
      };
    }
  };

  // ── Auto-mark holiday in attendance for all employees ─────────────────────

  func autoMarkHolidayAttendance(holidayDate : Int, holidayId : Nat) {
    // Convert nanosecond timestamp to ISO date
    let secs : Int = holidayDate / 1_000_000_000;
    let days : Int = secs / 86400;
    let z    : Int = days + 719468;
    let era  : Int = (if (z >= 0) z else z - 146096) / 146097;
    let doe  : Int = z - era * 146097;
    let yoe  : Int = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y    : Int = yoe + era * 400;
    let doy  : Int = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp   : Int = (5 * doy + 2) / 153;
    let d    : Int = doy - (153 * mp + 2) / 5 + 1;
    let m    : Int = if (mp < 10) mp + 3 else mp - 9;
    let yr   : Int = if (m <= 2) y + 1 else y;
    let ys = yr.toText();
    let ms = if (m < 10) "0" # m.toText() else m.toText();
    let ds = if (d < 10) "0" # d.toText() else d.toText();
    let dateStr = ys # "-" # ms # "-" # ds;

    // For each active employee, upsert an attendance record for this date
    for ((_uid, u) in users.entries()) {
      if (u.status == #Active) {
        let empId = u.id;
        let idx = attendance.findIndex(func(r : HRCoreTypes.AttendanceRecord) : Bool {
          r.employeeId == empId and r.date == dateStr
        });
        switch (idx) {
          case (?i) {
            let old = attendance.at(i);
            // Only override if not already marked as present or check-in
            switch (old.status) {
              case (#present) {}; // don't override a real check-in
              case _ {
                attendance.put(i, { old with status = #companyHoliday; holidayId = ?holidayId });
              };
            };
          };
          case null {
            let rec : HRCoreTypes.AttendanceRecord = {
              id                 = nextAttendId.value;
              employeeId         = empId;
              date               = dateStr;
              status             = #companyHoliday;
              checkInTime        = null;
              checkInGps         = null;
              leaveApplicationId = null;
              holidayId          = ?holidayId;
              correctedBy        = null;
              correctionRemark   = null;
              correctionAt       = null;
              recordedAt         = Time.now();
            };
            nextAttendId.value += 1;
            attendance.add(rec);
          };
        };
      };
    };
  };

  /// Add a new company holiday (HR/Admin only).
  public shared func addCompanyHoliday(
    token : Text,
    input : HolidayTypes.CreateHolidayInput,
  ) : async { #ok : Nat; #err : Text } {
    switch (holidayRequireHROrAdmin(token)) {
      case null { #err("Unauthorized: HR or Admin role required") };
      case (?s) {
        let createdBy = s.userId.toText();
        switch (CompanyHolidayLib.addHoliday(companyHolidays, nextHolidayId, input, createdBy)) {
          case (#ok(id)) {
            autoMarkHolidayAttendance(input.date, id);
            #ok(id)
          };
          case (#err(e)) { #err(e) };
        }
      };
    }
  };

  /// Update an existing company holiday (HR/Admin only).
  public shared func updateCompanyHoliday(
    token : Text,
    input : HolidayTypes.UpdateHolidayInput,
  ) : async { #ok; #err : Text } {
    switch (holidayRequireHROrAdmin(token)) {
      case null { #err("Unauthorized: HR or Admin role required") };
      case (?_) { CompanyHolidayLib.updateHoliday(companyHolidays, input) };
    }
  };

  /// Permanently delete a company holiday record (HR/Admin only).
  public shared func deleteCompanyHoliday(
    token : Text,
    id    : Nat,
  ) : async { #ok; #err : Text } {
    switch (holidayRequireHROrAdmin(token)) {
      case null { #err("Unauthorized: HR or Admin role required") };
      case (?_) { CompanyHolidayLib.deleteHoliday(companyHolidays, id) };
    }
  };

  /// Soft-deactivate a company holiday (HR/Admin only).
  public shared func deactivateCompanyHoliday(
    token : Text,
    id    : Nat,
  ) : async { #ok; #err : Text } {
    switch (holidayRequireHROrAdmin(token)) {
      case null { #err("Unauthorized: HR or Admin role required") };
      case (?_) { CompanyHolidayLib.deactivateHoliday(companyHolidays, id) };
    }
  };

  /// Return the full list of company holidays.
  public query func getCompanyHolidays(token : Text) : async [HolidayTypes.CompanyHoliday] {
    switch (holidayRequireSession(token)) {
      case null { [] };
      case (?_) { CompanyHolidayLib.getAll(companyHolidays) };
    }
  };

  /// Return only active company holidays.
  public query func getActiveHolidays(token : Text) : async [HolidayTypes.CompanyHoliday] {
    switch (holidayRequireSession(token)) {
      case null { [] };
      case (?_) { CompanyHolidayLib.getActive(companyHolidays) };
    }
  };

  /// Return true when the given date falls on an active company holiday.
  public query func isHoliday(token : Text, date : Int) : async Bool {
    switch (holidayRequireSession(token)) {
      case null { false };
      case (?_) { CompanyHolidayLib.isHolidayDate(companyHolidays, date) };
    }
  };

  /// Return export-ready rows for the holiday list (HR/Admin only).
  public query func getHolidaysForExport(token : Text) : async [HolidayTypes.HolidayExportRow] {
    switch (holidayRequireHROrAdmin(token)) {
      case null { [] };
      case (?_) { CompanyHolidayLib.getExportRows(companyHolidays) };
    }
  };
};
