import Common "common";

module {
  public type UserId    = Common.UserId;
  public type Timestamp = Common.Timestamp;

  /// Context tag attached to any submission made by an RSM operating in MR mode.
  /// Stored on TravelPlanRecord, DcrRecord, and CallReport so reports can distinguish
  /// RSM-as-MR activity from native MR activity.
  public type MrModeContext = {
    roleContext         : Text;    // always "RSM_ACTING_MR"
    mrTerritoryHqId     : Text;    // HQ/Station ID the RSM is covering
    submitterEmployeeId : Text;    // RSM's employeeId (stringified UserId)
  };

  /// Config snapshot returned to the frontend to drive the role-switcher widget.
  public type RsmMrModeConfig = {
    mrTerritoryHqId : Text;
    gradeLevel      : Text;   // "MR" — used for TA/DA rate lookup
    isActive        : Bool;
    chargeId        : Text;   // AdditionalCharge ID backing this assignment
  };

  /// Notification payload for RSM MR-assignment events.
  public type RsmMrAssignmentNotification = {
    rsmId         : UserId;
    zsmId         : ?UserId;
    rsmName       : Text;
    territoryName : Text;
    startDate     : Text;   // DD-MM-YYYY
  };
};
