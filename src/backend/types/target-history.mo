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

  /// Immutable, append-only audit log entry for every target create / override.
  public type TargetAdjustmentLog = {
    id            : Nat;
    userId        : UserId;
    role          : Role;
    period        : TargetPeriod;
    year          : Nat;
    month         : ?Nat;          // 1-12 when period = #Monthly, null otherwise
    previousValue : Float;         // 0.0 when the target is newly created
    newValue      : Float;
    reason        : ?Text;         // optional note supplied by the admin
    changedBy     : UserId;
    changedAt     : Timestamp;
  };

  /// Filter used by the search / export queries on the history screen
  public type TargetAdjustmentFilter = {
    userId      : ?UserId;
    role        : ?Role;
    period      : ?TargetPeriod;
    year        : ?Nat;
    changedBy   : ?UserId;
    startDate   : ?Text;   // ISO "YYYY-MM-DD" – compared against changedAt
    endDate     : ?Text;
  };
};
