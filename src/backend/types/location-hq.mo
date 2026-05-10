import CommonTypes "common";

module {
  public type LocationId = Nat;
  public type UserId     = CommonTypes.UserId;
  public type Role       = CommonTypes.Role;

  /// The four pharma hierarchy levels mapped to roles:
  ///   Zone  → ZSM
  ///   Region → RSM
  ///   Area   → ASM
  ///   Station → MR
  public type LocationLevel = {
    #Zone;
    #Region;
    #Area;
    #Station;
  };

  /// Resolved hierarchy path from a location up to the Zone root.
  public type LocationHierarchyPath = {
    locationId   : LocationId;
    locationName : Text;
    level        : LocationLevel;
    zoneId       : ?LocationId;
    zoneName     : ?Text;
    regionId     : ?LocationId;
    regionName   : ?Text;
    areaId       : ?LocationId;
    areaName     : ?Text;
    stationId    : ?LocationId;
    stationName  : ?Text;
  };

  /// Summary of a location at its role-appropriate level, for dropdowns.
  public type PrimaryHqInfo = {
    id    : LocationId;
    name  : Text;
    level : LocationLevel;
  };

  /// Employee flagged because their primaryHqId does not match the expected
  /// level for their role (returned by getInvalidHqEmployees for Admin review).
  public type InvalidHqEmployee = {
    userId        : UserId;
    employeeId    : Text;
    name          : Text;
    role          : Text;
    primaryHqId   : ?LocationId;
    expectedLevel : LocationLevel;
    reason        : Text;
  };

  /// A user with their primaryHqId and the resolved HQ name for list views.
  public type UserWithPrimaryHq = {
    userId      : UserId;
    employeeId  : Text;
    name        : Text;
    role        : Text;
    primaryHqId : ?LocationId;
    hqName      : Text;
  };
};
