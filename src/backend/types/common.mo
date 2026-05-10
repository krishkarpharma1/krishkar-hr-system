module {
  public type UserId = Nat;
  public type Timestamp = Int; // nanoseconds from Time.now()

  public type Role = {
    #Admin;
    #HRManager;
    #ZSM;
    #RSM;
    #ASM;
    #MR;
  };

  /// Employees whose stored role does not match the valid six-role hierarchy.
  /// Returned by getInvalidRoleEmployees() for Admin review.
  public type InvalidRoleEmployee = {
    id         : UserId;
    employeeId : Text;
    name       : Text;
    rawRole    : Text;   // the unknown role string (e.g. "NSM")
  };

  public type UserStatus = {
    #Active;
    #Inactive;
  };

  /// GPS coordinate with timestamp — shared across all domains
  public type GpsCoord = {
    lat       : Float;
    lng       : Float;
    timestamp : Int;  // nanoseconds from Time.now()
  };

  /// Result variants for generic mutations
  public type MutationResult = {
    #ok;
    #err : Text;
  };

  // ── Health-check types ────────────────────────────────────────────────────

  /// A single anomaly found during a health-check run
  public type HealthAnomaly = {
    anomalyType  : Text;      // e.g. "MR_MISSING_HQ_ASSIGNMENT"
    description  : Text;      // human-readable explanation
    affectedIds  : [Text];    // stringified IDs of affected records
  };

  /// Result of one health-check run — immutable snapshot
  public type HealthCheckReport = {
    passed       : Bool;
    timestamp    : Int;       // nanoseconds from Time.now()
    anomalyCount : Nat;
    anomalies    : [HealthAnomaly];
  };

  // ── Auto-repair types ────────────────────────────────────────────────────

  /// Record of a single auto-repair run — stored in rolling repairLogs state
  public type RepairLog = {
    repairType  : Text;   // e.g. "MISSING_LEAVE_QUOTA"
    triggeredBy : Text;   // username of Admin who triggered the repair
    timestamp   : Int;    // nanoseconds from Time.now()
    fixedCount  : Nat;    // number of records repaired
    details     : Text;   // human-readable summary of what was fixed
  };

  /// Result returned by runAutoRepair()
  public type RepairResult = {
    repairedTypes : [Text];           // anomaly type strings that were processed
    fixedCounts   : [(Text, Nat)];    // (anomalyType, fixedCount) per type run
    updatedReport : HealthCheckReport; // fresh health check run after all repairs
  };

  /// Generic filter used across all export / report queries
  public type ExportFilter = {
    userId    : ?Text;   // filter by user ID (text form)
    startDate : ?Text;   // ISO date "YYYY-MM-DD"
    endDate   : ?Text;   // ISO date "YYYY-MM-DD"
    month     : ?Text;   // "YYYY-MM"
    role      : ?Text;   // e.g. "MR", "ASM" …
  };
};
