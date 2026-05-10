import Common "common";

module {
  public type UserId    = Common.UserId;
  public type Timestamp = Common.Timestamp;
  public type Role      = Common.Role;

  // ── IDs ──────────────────────────────────────────────────────────────────
  public type TravelPlanId = Nat;

  // ── Status ───────────────────────────────────────────────────────────────
  public type TravelPlanStatus = {
    #Draft;
    #Submitted;
  };

  // ── Working Mode ─────────────────────────────────────────────────────────
  public type WorkingMode = {
    #WorkingAlone;
    #WorkingWith;
  };

  /// Station source — whether the station was auto-filled from TP or manually entered
  public type WorkingStationSource = {
    #AsPerTP;
    #OtherStation;
  };

  // ── Role Hierarchy Config ─────────────────────────────────────────────────
  /// Defines the ordered role hierarchy used for "Working With" authority lookup.
  /// Default order: [#MR, #ASM, #RSM, #ZSM, #HRManager, #Admin]
  public type RoleHierarchyConfig = {
    roleOrder : [Role];
  };

  // ── Travel Plan Record ───────────────────────────────────────────────────
  public type TravelPlanRecord = {
    id                   : TravelPlanId;
    userId               : UserId;
    var date             : Text;           // ISO date "YYYY-MM-DD"
    var plannedStation   : Text;
    var notes            : Text;
    var status           : TravelPlanStatus;
    createdAt            : Timestamp;
    var updatedAt        : Timestamp;
  };

  /// Public/shared view of TravelPlanRecord (no mutable fields)
  public type TravelPlanInfo = {
    id             : TravelPlanId;
    userId         : UserId;
    date           : Text;
    plannedStation : Text;
    notes          : Text;
    status         : TravelPlanStatus;
    createdAt      : Timestamp;
    updatedAt      : Timestamp;
  };

  // ── Input types ──────────────────────────────────────────────────────────
  public type CreateTravelPlanInput = {
    date           : Text;
    plannedStation : Text;
    notes          : Text;
  };

  public type MutationResult = Common.MutationResult;
};
