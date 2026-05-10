import CommonTypes "common";

module {
  public type UserId    = CommonTypes.UserId;
  public type Timestamp = CommonTypes.Timestamp;
  public type Role      = CommonTypes.Role;

  /// Whether the charge adds an extra role or an extra territory/area
  public type ChargeType = {
    #Role;  // employee temporarily acts in a higher/different role
    #Area;  // employee gets additional territory/area coverage
  };

  /// Status of a charge based on effective dates
  public type ChargeStatus = {
    #Active;  // current date is within effectiveFrom..effectiveTo
    #Expired; // effectiveTo is in the past
    #Pending; // effectiveFrom is in the future
  };

  /// Structured HQ + multi-Area assignment inside an Additional Charge record.
  /// One block per HQ; each block can hold multiple Area IDs under that HQ.
  public type AdditionalHqAssignment = {
    hqId    : Nat;        // HQ from location master
    areaIds : [Nat];      // one or more Areas under this HQ
  };

  /// One additional charge assignment
  public type AdditionalCharge = {
    id             : Text;        // unique charge ID (e.g. "AC-001")
    employeeId     : UserId;
    chargeType     : ChargeType;
    additionalRole : ?Role;       // set when chargeType = #Role
    additionalArea : ?Text;       // deprecated free-text area name — kept for backward compat
    additionalHqId : ?Nat;        // HQ ID from location master when chargeType = #Area
    additionalAreaId : ?Nat;      // Area ID from location master when chargeType = #Area
    // ── Multi-HQ / Multi-Area (new) ──────────────────────────────────────────
    additionalHqAssignments : [AdditionalHqAssignment]; // one block per HQ, each with multi-area
    effectiveFrom  : Timestamp;
    effectiveTo    : Timestamp;
    remarks        : ?Text;
    assignedBy     : UserId;      // Admin or HR
    assignedAt     : Timestamp;
    updatedAt      : Timestamp;
  };

  /// Input to create a new additional charge
  public type AssignAdditionalChargeInput = {
    employeeId     : UserId;
    chargeType     : ChargeType;
    additionalRole : ?Role;
    additionalArea : ?Text;       // deprecated — use additionalHqAssignments for Area charges
    additionalHqId : ?Nat;        // deprecated single-HQ field — kept for backward compat
    additionalAreaId : ?Nat;      // deprecated single-area field — kept for backward compat
    additionalHqAssignments : ?[AdditionalHqAssignment]; // new multi-HQ multi-Area
    effectiveFrom  : Timestamp;
    effectiveTo    : Timestamp;
    remarks        : ?Text;
  };

  /// Input to edit an existing charge's dates, remarks, or area assignments
  public type UpdateAdditionalChargeInput = {
    chargeId       : Text;
    effectiveFrom  : ?Timestamp;
    effectiveTo    : ?Timestamp;
    remarks        : ?Text;
    additionalHqAssignments : ?[AdditionalHqAssignment]; // replace all HQ/Area blocks
  };

  /// Filter for listAllAdditionalCharges
  public type AdditionalChargeFilter = {
    employeeId  : ?UserId;
    chargeType  : ?ChargeType;
    role        : ?Role;
    area        : ?Text;
    areaId      : ?Nat;           // filter by location master area ID
    hqId        : ?Nat;           // filter by location master HQ ID
    activeOnly  : Bool;           // if true, only return currently active charges
    fromDate    : ?Timestamp;     // effectiveFrom >= fromDate
    toDate      : ?Timestamp;     // effectiveTo <= toDate
  };

  /// Pair of HQ + Area IDs returned by getActiveAdditionalAreas
  public type AdditionalAreaInfo = {
    hqId   : Nat;
    areaId : Nat;
  };
};
