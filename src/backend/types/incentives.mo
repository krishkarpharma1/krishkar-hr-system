import CommonTypes "common";

module {
  public type UserId    = CommonTypes.UserId;
  public type Timestamp = CommonTypes.Timestamp;
  public type Role      = CommonTypes.Role;

  /// Period granularity — mirrors bottom-up-targets
  public type TargetPeriod = {
    #Monthly;
    #Quarterly;
    #HalfYearly;
    #Yearly;
  };

  /// How the incentive value is expressed
  public type IncentiveType = {
    #Fixed;              // absolute rupee amount (legacy — kept for history)
    #PercentOfSalary;    // percentage of employee's basic salary (legacy)
    #PercentOfTarget;    // NEW: percentage of monthly sales target (preferred)
  };

  /// One achievement tier within a plan
  public type IncentiveSlab = {
    minAchievementPct : Float;  // e.g. 80.0
    maxAchievementPct : Float;  // e.g. 89.99  (use 999.0 for "and above")
    incentiveType     : IncentiveType;
    value             : Float;  // rupees if Fixed; percentage if PercentOfSalary or PercentOfTarget
  };

  /// Role- and period-specific incentive plan configured by Admin/HR.
  /// month and year fields allow month-specific plans (0 = applies to all months for that period).
  public type IncentivePlan = {
    id        : Nat;
    role      : Role;
    period    : TargetPeriod;
    month     : Nat;      // 1-12 for month-specific plan; 0 = applies to all months
    year      : Nat;      // calendar year; 0 = applies to all years
    slabs     : [IncentiveSlab];  // ordered lowest → highest achievement
    isActive  : Bool;
    createdBy : UserId;
    createdAt : Timestamp;
    updatedAt : Timestamp;
  };

  /// Calculated incentive for one employee for one period
  public type IncentiveCalculationStatus = {
    #Calculated;   // auto-computed, awaiting HR review
    #HRApproved;   // HR reviewed and optionally adjusted
    #PaidOnSlip;   // included on the salary slip
  };

  public type IncentiveCalculation = {
    id               : Nat;
    userId           : UserId;
    role             : Role;
    period           : TargetPeriod;
    year             : Nat;
    month            : ?Nat;           // 1-12 for Monthly period, null otherwise
    targetAmount     : Float;
    aggregatedTarget : Float;          // bottom-up aggregated target (sum of subordinates' targets)
    actualAmount     : Float;
    achievementPct   : Float;
    slabApplied      : Text;           // human-readable range e.g. "90%-99%"
    incentiveAmount  : Float;          // final computed amount
    status           : IncentiveCalculationStatus;
    approvedBy       : ?UserId;
    adjustedAmount   : ?Float;         // HR-adjusted override
    notes            : ?Text;
    calculatedAt     : Timestamp;
  };

  /// Input for Admin/HR to configure a new incentive plan
  public type CreateIncentivePlanInput = {
    role     : Role;
    period   : TargetPeriod;
    month    : Nat;      // 1-12 for month-specific; 0 = all months
    year     : Nat;      // calendar year; 0 = all years
    slabs    : [IncentiveSlab];
  };

  /// Input to update an existing incentive plan
  public type UpdateIncentivePlanInput = {
    planId    : Nat;
    slabs     : ?[IncentiveSlab];
    isActive  : ?Bool;
  };

  /// Input for HR to approve / adjust an incentive calculation
  public type ApproveIncentiveInput = {
    calculationId  : Nat;
    adjustedAmount : ?Float;
    notes          : ?Text;
  };

  /// Filter used by incentive report and history queries
  public type IncentiveFilter = {
    userId   : ?UserId;
    role     : ?Role;
    period   : ?TargetPeriod;
    year     : ?Nat;
    month    : ?Nat;
    status   : ?IncentiveCalculationStatus;
  };
};
