import AuthTypes "../types/auth-users";
import HRTypes   "../types/hr-core";
import HolidayTypes "../types/company-holiday";
import AbsTypes  "../types/absence-inactivation";
import Lib       "../lib/absence-inactivation";
import Map    "mo:core/Map";
import List   "mo:core/List";
import Time   "mo:core/Time";
import Nat    "mo:core/Nat";

/// Public API mixin for the auto-absence-inactivation feature.
/// All state is injected; this mixin owns no state itself.
/// Settings CRUD is handled by admin-settings-api mixin — not duplicated here.
mixin (
  sessions                  : Map.Map<Text, AuthTypes.Session>,
  users                     : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
  attendance                : List.List<HRTypes.AttendanceRecord>,
  leaves                    : List.List<HRTypes.LeaveApplication>,
  companyHolidays           : List.List<HolidayTypes.CompanyHoliday>,
  absenceInactivationLog    : List.List<AbsTypes.AbsenceInactivationLogEntry>,
  absenceSettings           : AbsTypes.AbsenceSettings,
  nextAbsenceLogId          : { var value : Nat },
) {

  // ── Internal helpers ──────────────────────────────────────────────────────

  func absValidateSession(token : Text) : ?AuthTypes.Session {
    let now = Time.now();
    switch (sessions.get(token)) {
      case null null;
      case (?s) { if (s.expiresAt > now) ?s else null };
    }
  };

  func absIsAdminOrHR(role : AuthTypes.Role) : Bool {
    switch (role) {
      case (#Admin or #HRManager) true;
      case _ false;
    }
  };

  // ── Core absence check (called by timer and by manual API trigger) ────────

  // Internal synchronous helper — does the actual work and returns a summary.
  func runAbsenceCheckSync() : Text {
    if (not absenceSettings.absenceCheckEnabled) {
      return "Absence check is disabled in settings";
    };

    let now      = Time.now();
    let today    = Lib.nsToDate(now);
    let threshold = absenceSettings.consecutiveAbsenceThreshold;

    var inactivatedCount : Nat = 0;
    var warningCount     : Nat = 0;

    for ((_uid, employee) in users.entries()) {
      if (employee.status == #Active) {
        let isFieldRole = switch (employee.role) {
          case (#MR or #ASM or #RSM or #ZSM) true;
          case _ false;
        };
        if (isFieldRole) {
          let result = Lib.checkEmployee(
            employee, threshold, today,
            attendance, companyHolidays, leaves,
          );

          if (result.shouldInactivate and result.absentDates.size() > 0) {
            employee.status := #Inactive;

            let logId = nextAbsenceLogId.value;
            nextAbsenceLogId.value += 1;

            let entry : AbsTypes.AbsenceInactivationLogEntry = {
              id            = logId.toText();
              employeeId    = employee.id.toText();
              employeeName  = employee.name;
              employeeCode  = employee.employeeId;
              role          = Lib.roleToText(employee.role);
              hq            = Lib.primaryHqLabel(employee);
              inactivatedAt = now;
              absentDates   = result.absentDates;
              source        = "Auto-Inactivated: Consecutive Absence";
              var isReactivated = false;
              var reactivatedAt = null;
              var reactivatedBy = null;
            };
            absenceInactivationLog.add(entry);
            inactivatedCount += 1;
          } else {
            switch (result.warningDay) {
              case (?_day) { warningCount += 1 };
              case null {};
            };
          };
        };
      };
    };

    "Absence check completed for " # today
      # ". Inactivated: " # inactivatedCount.toText()
      # ", warnings: "    # warningCount.toText()
  };

  /// Timer callback — fires once every 86400 seconds (daily).
  /// This is the function passed to Timer.recurringTimer in main.mo.
  public func doRunAbsenceCheck() : async () {
    let _ = runAbsenceCheckSync();
  };

  // Convert internal mutable entry to the immutable shared view type.
  func toView(e : AbsTypes.AbsenceInactivationLogEntry) : AbsTypes.AbsenceInactivationLogView {
    {
      id            = e.id;
      employeeId    = e.employeeId;
      employeeName  = e.employeeName;
      employeeCode  = e.employeeCode;
      role          = e.role;
      hq            = e.hq;
      inactivatedAt = e.inactivatedAt;
      absentDates   = e.absentDates;
      source        = e.source;
      isReactivated = e.isReactivated;
      reactivatedAt = e.reactivatedAt;
      reactivatedBy = e.reactivatedBy;
    }
  };

  // ── Public API endpoints ──────────────────────────────────────────────────

  /// Return the full absence inactivation log.  HR / Admin only.
  public query func getAbsenceInactivationLog(token : Text) : async [AbsTypes.AbsenceInactivationLogView] {
    switch (absValidateSession(token)) {
      case null { [] };
      case (?s) {
        if (not absIsAdminOrHR(s.role)) return [];
        absenceInactivationLog.map<AbsTypes.AbsenceInactivationLogEntry, AbsTypes.AbsenceInactivationLogView>(toView).toArray()
      };
    }
  };

  /// Execute an immediate absence check (Admin only).
  /// Distinct from `triggerAbsenceCheckNow` in admin-settings which only signals intent.
  public func executeAbsenceCheckNow(token : Text) : async AbsTypes.AbsenceResult {
    switch (absValidateSession(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        if (s.role != #Admin) return #err("Unauthorized: Admin role required");
        let summary = runAbsenceCheckSync();
        #ok(summary)
      };
    }
  };

  /// Return all inactivation log entries for a specific employee.
  /// HR/Admin can query any employee; others can only query their own.
  public query func getEmployeeInactivationHistory(
    token      : Text,
    employeeId : Text,
  ) : async [AbsTypes.AbsenceInactivationLogView] {
    switch (absValidateSession(token)) {
      case null { [] };
      case (?s) {
        let callerIdText = s.userId.toText();
        let canView = absIsAdminOrHR(s.role) or callerIdText == employeeId;
        if (not canView) return [];
        absenceInactivationLog
          .filter(func(e : AbsTypes.AbsenceInactivationLogEntry) : Bool {
            e.employeeId == employeeId
          })
          .map<AbsTypes.AbsenceInactivationLogEntry, AbsTypes.AbsenceInactivationLogView>(toView)
          .toArray()
      };
    }
  };

  /// Mark a log entry as reactivated.  Called by HR/Admin after reactivating a user.
  public func markInactivationReactivated(
    token         : Text,
    logId         : Text,
    reactivatedBy : Text,
  ) : async AbsTypes.AbsenceResult {
    switch (absValidateSession(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        if (not absIsAdminOrHR(s.role)) return #err("Unauthorized: Admin or HRManager role required");
        switch (absenceInactivationLog.find(func(e : AbsTypes.AbsenceInactivationLogEntry) : Bool {
          e.id == logId
        })) {
          case null { #err("Log entry not found: " # logId) };
          case (?entry) {
            entry.isReactivated := true;
            entry.reactivatedAt := ?Time.now();
            entry.reactivatedBy := ?reactivatedBy;
            #ok("Inactivation log entry marked as reactivated")
          };
        }
      };
    }
  };
};
