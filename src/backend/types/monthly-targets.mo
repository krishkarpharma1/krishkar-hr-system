import CommonTypes "common";

module {
  public type UserId    = CommonTypes.UserId;
  public type Timestamp = CommonTypes.Timestamp;
  public type Role      = CommonTypes.Role;

  /// Roles eligible to have a monthly sales target assigned
  /// Admin and HRManager are explicitly excluded
  public type FieldRole = {
    #MR;
    #ASM;
    #RSM;
    #ZSM;
  };

  /// Optional per-product target breakdown inside a monthly target
  public type ProductTarget = {
    productId   : Text;
    productName : Text;
    targetQty   : Float;
  };

  /// One revision entry — recorded whenever a target is created or edited
  public type TargetRevision = {
    revisedAt    : Timestamp;
    revisedBy    : UserId;     // Admin or HR user ID
    previousAmount : Float;
    newAmount    : Float;
    remarks      : ?Text;
  };

  /// Primary monthly target record for a single employee + month + year
  public type MonthlyTarget = {
    id              : Text;       // composite: "<userId>-<year>-<month>"
    userId          : UserId;
    role            : Role;
    month           : Nat;        // 1-12
    year            : Nat;        // e.g. 2026
    targetAmount    : Float;      // current active target value
    doctorCallTarget  : Nat;      // monthly doctor call count target
    chemistTarget     : Nat;      // monthly chemist visit target
    stockistTarget    : Nat;      // monthly stockist visit target
    newDoctorsTarget  : Nat;      // monthly new doctors added target
    productTargets  : [ProductTarget];
    remarks         : ?Text;
    revisionHistory : [TargetRevision];
    createdAt       : Timestamp;
    createdBy       : UserId;
    updatedAt       : Timestamp;
    updatedBy       : UserId;
  };

  /// Input for setting or revising a monthly target (single employee)
  public type SetMonthlyTargetInput = {
    userId           : UserId;
    month            : Nat;
    year             : Nat;
    targetAmount     : Float;
    doctorCallTarget : ?Nat;
    chemistTarget    : ?Nat;
    stockistTarget   : ?Nat;
    newDoctorsTarget : ?Nat;
    productTargets   : ?[ProductTarget];
    remarks          : ?Text;
  };

  /// One row in a bulk target upload / table-entry
  public type BulkTargetRow = {
    userId           : UserId;
    targetAmount     : Float;
    doctorCallTarget : ?Nat;
    chemistTarget    : ?Nat;
    stockistTarget   : ?Nat;
    newDoctorsTarget : ?Nat;
    remarks          : ?Text;
  };

  /// Input for setting targets for multiple employees at once for one month/year
  public type BulkSetMonthlyTargetsInput = {
    month : Nat;
    year  : Nat;
    rows  : [BulkTargetRow];
  };

  /// Filter for listMonthlyTargets and export
  public type MonthlyTargetFilter = {
    userId    : ?UserId;
    role      : ?Role;
    month     : ?Nat;
    year      : ?Nat;
    territory : ?Text;
    area      : ?Text;
  };

  /// Combined target + actual data for one employee (Target vs. Achievement view)
  public type TargetVsActual = {
    userId         : UserId;
    employeeId     : Text;
    name           : Text;
    role           : Role;
    territory      : ?Text;
    area           : ?Text;
    month          : Nat;
    year           : Nat;
    targetAmount   : Float;
    actualAmount   : Float;
    achievementPct : Float;
    remainingTarget : Float;
  };
};
