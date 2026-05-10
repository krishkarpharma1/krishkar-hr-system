import CommonTypes "common";

module {
  public type UserId     = CommonTypes.UserId;
  public type LocationId = Nat;              // mirrors location-master LocationId
  public type Timestamp  = CommonTypes.Timestamp;
  public type Role       = CommonTypes.Role;
  public type UserStatus = CommonTypes.UserStatus;
  public type GpsCoord   = CommonTypes.GpsCoord;

  /// Salary components stored per employee
  public type SalaryComponents = {
    basic : Nat;         // monthly basic pay in paise/smallest unit
    hra : Nat;           // monthly HRA
    ta : Float;          // monthly TA fixed component (2 decimal places, e.g. 1250.50)
    pfPercent : Nat;     // PF deduction % (e.g. 12 = 12%)
    esiPercent : Nat;    // ESI deduction % (e.g. 1 = 1.75% rounded)
  };

  /// Per-HQ allotment block for an MR — stores Areas, Stations, and Ex-Stations
  /// for a single HQ assignment. Replaces the flat hqIds/areaIds for MR role.
  public type HqAssignment = {
    hqId        : LocationId;        // the HQ this block belongs to
    areaIds     : [LocationId];      // areas under this HQ allotted to the employee
    stationIds  : [LocationId];      // primary stations under this HQ
    exStationIds : [LocationId];     // ex-stations (out-of-HQ stations) under this HQ
  };

  /// Internal user record — contains mutable fields for admin edits
  public type UserRecord = {
    id : UserId;
    var username : Text;
    var passwordHash : Text;   // SHA-256 hex of password
    var role : Role;
    var status : UserStatus;
    var employeeId : Text;     // human-readable ID e.g. "EMP001"
    var name : Text;
    var email : Text;
    var phone : Text;
    var designation : Text;
    var department : Text;
    var territory : Text;      // kept for backward compatibility
     var reportsTo    : ?UserId;   // manager's UserId
     var joinDate     : Text;       // ISO date string e.g. "2024-01-15"
     var salary       : SalaryComponents;
    // ── Primary HQ (single, required for field roles) ─────────────────────────
    // ZSM → Zone-level HQ, RSM → Region-level HQ, ASM → Area-level HQ, MR → Station-level HQ
    // Admin and HRManager may leave this null.
    var primaryHqId  : ?LocationId;
    // ── Multi-select location allotments ─────────────────────────────────────
    var zoneIds      : [Nat];  // allotted zone IDs
    var stateIds     : [Nat];  // allotted state IDs (ZSM gets all states in zone)
    var territoryIds : [Nat];  // allotted territory IDs (RSM gets all HQs in territory)
    var hqIds        : [Nat];  // allotted HQ IDs (ASM gets all areas in HQ) — kept for backward compat
    var areaIds      : [Nat];  // allotted area IDs (MR works in area) — kept for backward compat
    // ── Per-HQ allotment blocks (new — replaces flat hqIds/areaIds for MR) ──
    var hqAssignments : [HqAssignment]; // structured HQ→Areas/Stations/ExStations blocks
    var migrationDone : Bool;           // true once old flat fields migrated to hqAssignments
    createdAt : Timestamp;
  };

  /// Public-facing user info (no password hash, no var fields)
  public type UserInfo = {
    id : UserId;
    username : Text;
    role : Role;
    status : UserStatus;
    employeeId : Text;
    name : Text;
    email : Text;
    phone : Text;
    designation : Text;
    department : Text;
    territory : Text;
    reportsTo : ?UserId;
    joinDate : Text;
    dateOfBirth : ?Text;   // ISO date "YYYY-MM-DD"; null for legacy records
    salary : SalaryComponents;
    primaryHqId  : ?LocationId;   // designated HQ at the role's level
    zoneIds      : [Nat];
    stateIds     : [Nat];
    territoryIds : [Nat];
    hqIds        : [Nat];
    areaIds      : [Nat];
    hqAssignments : [HqAssignment];  // structured per-HQ allotment blocks
    migrationDone : Bool;
    createdAt : Timestamp;
  };

  /// Location allotment summary for a single user (Admin/HR view)
  public type UserLocationAllotment = {
    userId       : UserId;
    employeeId   : Text;
    name         : Text;
    role         : Role;
    zoneIds      : [Nat];
    stateIds     : [Nat];
    territoryIds : [Nat];
    hqIds        : [Nat];
    areaIds      : [Nat];
    hqAssignments : [HqAssignment];  // structured per-HQ allotment blocks
  };

  /// Session token payload returned on successful login
  public type Session = {
    token : Text;        // random token used as session key
    userId : UserId;
    role : Role;
    employeeId : Text;
    name : Text;
    expiresAt : Timestamp;
  };

  /// Input for creating a new user (Admin / HRManager)
  public type CreateUserInput = {
    username : Text;
    password : Text;          // plain — will be hashed on write
    role : Role;
    employeeId : Text;
    name : Text;
    email : Text;
    phone : Text;
    designation : Text;
    department : Text;
    territory : Text;
    reportsTo : ?UserId;
    joinDate : Text;
    dateOfBirth : ?Text;      // ISO date "YYYY-MM-DD"; optional at creation
    salary : SalaryComponents;
    // Optional primary HQ — validated against role level on write
    primaryHqId  : ?LocationId;
    // Optional location allotments on creation
    zoneIds      : ?[Nat];
    stateIds     : ?[Nat];
    territoryIds : ?[Nat];
    hqIds        : ?[Nat];
    areaIds      : ?[Nat];
    hqAssignments : ?[HqAssignment];   // structured HQ→Areas/Stations/ExStations (MR)
  };

  /// Input for editing an existing user
  public type UpdateUserInput = {
    name : ?Text;
    email : ?Text;
    phone : ?Text;
    designation : ?Text;
    department : ?Text;
    territory : ?Text;
    reportsTo : ?(?UserId);
    joinDate : ?Text;
    dateOfBirth : ?Text;      // ISO date "YYYY-MM-DD"; null means no change
    salary : ?SalaryComponents;
    role : ?Role;
    status : ?UserStatus;
    newPassword : ?Text;      // if set, password is changed
    // Optional primary HQ update — validated against role level on write
    primaryHqId  : ?LocationId;
    // Optional location allotment updates
    zoneIds      : ?[Nat];
    stateIds     : ?[Nat];
    territoryIds : ?[Nat];
    hqIds        : ?[Nat];
    areaIds      : ?[Nat];
    hqAssignments : ?[HqAssignment];   // structured HQ→Areas/Stations/ExStations update (MR)
  };

  /// Per-HQ block with resolved names for the HQ hierarchy view
  public type HqHierarchyBlock = {
    hqId       : LocationId;
    hqName     : Text;
    areaNames  : [Text];
    stationNames : [Text];
  };

  /// Employee record for the HQ-wise hierarchy list
  public type HqHierarchyEmployee = {
    userId               : UserId;
    employeeCode         : Text;
    employeeName         : Text;
    role                 : Text;
    territory            : Text;
    status               : Text;            // "Active" | "Inactive"
    mobileNumber         : Text;
    reportingManagerId   : ?UserId;
    reportingManagerName : Text;
    primaryHqName        : Text;
    hqAssignments        : [HqHierarchyBlock];
  };

  /// Single node in an upward reporting chain
  public type ReportingChainEntry = {
    userId : UserId;
    name   : Text;
    role   : Text;
  };

  /// Log entry created each time an employee is reactivated
  public type ReactivationLogEntry = {
    employeeId       : UserId;
    employeeName     : Text;
    employeeCode     : Text;
    reactivatedAt    : Timestamp;
    reactivatedBy    : UserId;
    reactivatedByName : Text;
    needsReview      : Bool;  // true if role/HQ was missing after reactivation
  };

  /// GPS location snapshot submitted by a field employee
  public type LocationRecord = {
    userId : UserId;
    employeeId : Text;
    lat : Float;
    lng : Float;
    timestamp : Timestamp;
  };

  /// Result variants for login
  public type LoginResult = {
    #ok : Session;
    #err : Text;
  };

  /// Result variants for generic mutations
  public type MutationResult = {
    #ok;
    #err : Text;
  };

  /// Result variant for password reset — carries the plaintext temp password on success
  public type PasswordResetResult = {
    #ok : Text;   // plaintext temporary password (show once)
    #err : Text;
  };
};
