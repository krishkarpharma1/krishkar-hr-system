import CommonTypes "common";
import AuthTypes    "auth-users";

module {
  public type UserId    = CommonTypes.UserId;
  public type Timestamp = CommonTypes.Timestamp;
  public type Role      = CommonTypes.Role;
  public type UserRecord = AuthTypes.UserRecord;

  /// Period granularity for a sales target
  public type TargetPeriod = {
    #Monthly;
    #Quarterly;
    #HalfYearly;
    #Yearly;
  };

  /// Whether the target value was auto-aggregated or manually set
  public type CalculationStatus = {
    #AutoCalculated;
    #ManuallyOverridden;
  };

  /// Stored/shared target record — one per (userId, period, year) combination
  public type BottomUpTarget = {
    id                : Nat;
    userId            : UserId;
    role              : Role;
    period            : TargetPeriod;
    year              : Nat;
    targetAmount      : Nat;        // in rupees, whole numbers
    calculationStatus : CalculationStatus;
    isOverridden      : Bool;
    overrideReason    : ?Text;
    createdAt         : Timestamp;
    createdBy         : UserId;
    lastModifiedAt    : Timestamp;
    lastModifiedBy    : UserId;
  };

  /// Input for Admin/HR to assign a base MR-level target
  public type CreateBottomUpTargetInput = {
    userId      : UserId;
    period      : TargetPeriod;
    year        : Nat;
    targetAmount : Nat;
    description : ?Text;
  };

  /// Input for Admin to manually override an auto-calculated target
  public type OverrideBottomUpTargetInput = {
    targetId       : Nat;
    newAmount      : Nat;
    overrideReason : Text;
  };

  /// Hierarchical node for frontend tree display
  /// children holds the immediate reportees of this employee
  public type TargetHierarchyNode = {
    userId         : UserId;
    name           : Text;
    role           : Role;
    territory      : ?Text;
    area           : ?Text;
    monthly        : Nat;
    quarterly      : Nat;
    halfYearly     : Nat;
    yearly         : Nat;
    status         : CalculationStatus;
    isOverridden   : Bool;
    overrideReason : ?Text;
    children       : [TargetHierarchyNode];
  };

  /// Flat row for the Bottom-Up Target Summary Excel report
  public type BottomUpTargetSummaryRow = {
    level         : Text;   // e.g. "MR", "ASM", "RSM", "ZSM", "National"
    employeeName  : Text;
    territory     : Text;
    area          : Text;
    monthly       : Nat;
    quarterly     : Nat;
    halfYearly    : Nat;
    yearly        : Nat;
    status        : Text;
    overrideNotes : Text;
  };

  /// Color-coded performance status for Target vs. Actual dashboard
  public type PerformanceStatus = {
    #OnTrack;        // achievement % >= elapsed % of period (green)
    #SlightlyBehind; // achievement % slightly below elapsed (yellow)
    #SignificantlyBehind; // achievement % significantly behind (red)
  };

  /// One row in the Target vs. Actual Performance view
  public type PerformanceRow = {
    userId               : UserId;
    employeeId           : Text;
    name                 : Text;
    role                 : Role;
    territory            : ?Text;
    area                 : ?Text;
    targetAmount         : Float;       // assigned target for the period
    actualSales          : Float;       // actual sales/business to date
    achievementPct       : Float;       // actualSales / targetAmount * 100
    remainingTarget      : Float;       // targetAmount - actualSales
    projectedAchievement : Float;       // dailyAvg * totalDaysInPeriod
    performanceStatus    : PerformanceStatus;
  };

  /// Filter for Target vs. Actual queries
  public type PerformanceFilter = {
    managerId    : UserId;    // manager perspective (or 0 for Admin/HR full view)
    period       : TargetPeriod;
    year         : Nat;
    month        : ?Nat;      // required when period = #Monthly
    drillDownFrom : ?UserId;  // optional: filter to a specific subordinate manager's team
  };
};
