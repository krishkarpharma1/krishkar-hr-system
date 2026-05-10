module {

  /// Log entry created each time an employee is auto-inactivated due to
  /// consecutive absence. Updated (isReactivated / reactivatedAt / reactivatedBy)
  /// when HR/Admin reactivates the account.
  public type AbsenceInactivationLogEntry = {
    id             : Text;            // unique log ID (stringified counter)
    employeeId     : Text;            // stringified UserId
    employeeName   : Text;
    employeeCode   : Text;
    role           : Text;            // e.g. "MR", "ASM", "RSM"
    hq             : Text;            // primary HQ name / territory
    inactivatedAt  : Int;             // nanoseconds timestamp
    absentDates    : [Text];          // "YYYY-MM-DD" consecutive absent dates that triggered inactivation
    source         : Text;            // always "Auto-Inactivated: Consecutive Absence"
    var isReactivated : Bool;
    var reactivatedAt : ?Int;
    var reactivatedBy : ?Text;        // HR/Admin name who reactivated
  };

  /// Settings that control the absence-inactivation behaviour.
  /// All fields are mutable so Admin can update them at runtime.
  public type AbsenceSettings = {
    var consecutiveAbsenceThreshold  : Nat;   // default 3
    var absenceCheckEnabled          : Bool;  // default true
    var excludeLongTermLeave         : Bool;  // default true
    var warningNotificationsEnabled  : Bool;  // default true
  };

  /// Immutable public-facing view of an AbsenceInactivationLogEntry
  /// (used as the shared return type for query API functions).
  public type AbsenceInactivationLogView = {
    id             : Text;
    employeeId     : Text;
    employeeName   : Text;
    employeeCode   : Text;
    role           : Text;
    hq             : Text;
    inactivatedAt  : Int;
    absentDates    : [Text];
    source         : Text;
    isReactivated  : Bool;
    reactivatedAt  : ?Int;
    reactivatedBy  : ?Text;
  };

  /// Lightweight result used by absence-inactivation API calls
  public type AbsenceResult = {
    #ok : Text;
    #err : Text;
  };
};
