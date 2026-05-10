import Types    "../types/additional-charge";
import AuthTypes "../types/auth-users";
import List      "mo:core/List";
import Map       "mo:core/Map";
import Time      "mo:core/Time";

module {
  public type AdditionalCharge            = Types.AdditionalCharge;
  public type AssignAdditionalChargeInput = Types.AssignAdditionalChargeInput;
  public type UpdateAdditionalChargeInput = Types.UpdateAdditionalChargeInput;
  public type AdditionalChargeFilter      = Types.AdditionalChargeFilter;
  public type ChargeStatus                = Types.ChargeStatus;
  public type UserId                      = Types.UserId;
  public type Timestamp                   = Types.Timestamp;

  let NANOS_PER_DAY : Int = 86_400_000_000_000;

  /// Assign a new additional charge to an employee.
  /// Returns the created charge record.
  public func assignCharge(
    charges          : List.List<AdditionalCharge>,
    input            : AssignAdditionalChargeInput,
    callerId         : UserId,
    now              : Timestamp,
    nextChargeIdRef  : { var value : Nat },
  ) : AdditionalCharge {
    let chargeId = "AC-" # nextChargeIdRef.value.toText();
    nextChargeIdRef.value += 1;
    let charge : AdditionalCharge = {
      id               = chargeId;
      employeeId       = input.employeeId;
      chargeType       = input.chargeType;
      additionalRole   = input.additionalRole;
      additionalArea   = input.additionalArea;
      additionalHqId   = input.additionalHqId;
      additionalAreaId = input.additionalAreaId;
      additionalHqAssignments = switch (input.additionalHqAssignments) { case (?a) a; case null [] };
      effectiveFrom    = input.effectiveFrom;
      effectiveTo      = input.effectiveTo;
      remarks          = input.remarks;
      assignedBy       = callerId;
      assignedAt       = now;
      updatedAt        = now;
    };
    charges.add(charge);
    charge
  };

  /// Update effective dates or remarks on an existing charge.
  public func updateCharge(
    charges : List.List<AdditionalCharge>,
    input   : UpdateAdditionalChargeInput,
    now     : Timestamp,
  ) : Bool {
    var found = false;
    charges.mapInPlace(func(c : AdditionalCharge) : AdditionalCharge {
      if (c.id == input.chargeId) {
        found := true;
        {
          c with
          effectiveFrom = switch (input.effectiveFrom) { case (?ef) ef; case null c.effectiveFrom };
          effectiveTo   = switch (input.effectiveTo)   { case (?et) et; case null c.effectiveTo   };
          remarks       = switch (input.remarks)        { case (?r)  ?r; case null c.remarks       };
          updatedAt     = now;
        }
      } else { c }
    });
    found
  };

  /// Remove an additional charge by ID (hard delete).
  public func removeCharge(
    charges  : List.List<AdditionalCharge>,
    chargeId : Text,
  ) : Bool {
    let before = charges.size();
    let filtered = charges.filter(func(c : AdditionalCharge) : Bool { c.id != chargeId });
    let after = filtered.size();
    if (after < before) {
      charges.clear();
      charges.append(filtered);
      true
    } else {
      false
    }
  };

  /// Compute the current status of a charge given the current time.
  public func chargeStatus(charge : AdditionalCharge, now : Timestamp) : ChargeStatus {
    if (now < charge.effectiveFrom)    { #Pending }
    else if (now > charge.effectiveTo) { #Expired }
    else                               { #Active  }
  };

  /// Get all currently active charges for an employee (effectiveFrom <= now <= effectiveTo).
  public func getActiveChargesForEmployee(
    charges    : List.List<AdditionalCharge>,
    employeeId : UserId,
    now        : Timestamp,
  ) : [AdditionalCharge] {
    charges.filter(func(c : AdditionalCharge) : Bool {
      c.employeeId == employeeId and chargeStatus(c, now) == #Active
    }).toArray()
  };

  /// Get all charges for an employee — active, expired, and pending.
  public func getAllChargesForEmployee(
    charges    : List.List<AdditionalCharge>,
    employeeId : UserId,
  ) : [AdditionalCharge] {
    charges.filter(func(c : AdditionalCharge) : Bool {
      c.employeeId == employeeId
    }).toArray()
  };

  /// List all charges with optional filters (Admin/HR report).
  public func listAllCharges(
    charges : List.List<AdditionalCharge>,
    filter  : AdditionalChargeFilter,
    now     : Timestamp,
  ) : [AdditionalCharge] {
    charges.filter(func(c : AdditionalCharge) : Bool {
      switch (filter.employeeId) {
        case (?eid) { if (c.employeeId != eid) return false };
        case null {};
      };
      switch (filter.chargeType) {
        case (?ct) { if (c.chargeType != ct) return false };
        case null {};
      };
      switch (filter.role) {
        case (?r) {
          switch (c.additionalRole) {
            case (?cr) { if (cr != r) return false };
            case null  { return false };
          }
        };
        case null {};
      };
      switch (filter.area) {
        case (?a) {
          switch (c.additionalArea) {
            case (?ca) { if (ca != a) return false };
            case null  { return false };
          }
        };
        case null {};
      };
      if (filter.activeOnly and chargeStatus(c, now) != #Active) return false;
      switch (filter.fromDate) {
        case (?fd) { if (c.effectiveFrom < fd) return false };
        case null {};
      };
      switch (filter.toDate) {
        case (?td) { if (c.effectiveTo > td) return false };
        case null {};
      };
      true
    }).toArray()
  };

  /// Return the set of roles an employee currently has (primary + active additional roles).
  public func effectiveRoles(
    charges     : List.List<AdditionalCharge>,
    employeeId  : UserId,
    primaryRole : AuthTypes.Role,
    now         : Timestamp,
  ) : [AuthTypes.Role] {
    let roles = List.empty<AuthTypes.Role>();
    roles.add(primaryRole);
    for (c in charges.values()) {
      if (c.employeeId == employeeId and chargeStatus(c, now) == #Active) {
        switch (c.additionalRole) {
          case (?r) {
            if (roles.find(func(existingRole : AuthTypes.Role) : Bool { existingRole == r }) == null) {
              roles.add(r)
            };
          };
          case null {};
        };
      };
    };
    roles.toArray()
  };

  /// Return the list of {hqId, areaId} pairs from all currently active charges
  /// that carry an area — includes both #Area charges AND #Role charges where
  /// additionalHqId + additionalAreaId have been set.
  /// Used when the employee submits field reports to allow selection from additional areas.
  public func getActiveAdditionalAreas(
    charges    : List.List<AdditionalCharge>,
    employeeId : UserId,
    now        : Timestamp,
  ) : [Types.AdditionalAreaInfo] {
    let result = List.empty<Types.AdditionalAreaInfo>();
    for (c in charges.values()) {
      if (c.employeeId == employeeId and chargeStatus(c, now) == #Active) {
        switch (c.additionalHqId, c.additionalAreaId) {
          case (?hid, ?aid) {
            result.add({ hqId = hid; areaId = aid });
          };
          case _ {};
        };
      };
    };
    result.toArray()
  };

  /// Returns the first active additional area (hqId, areaId) for an employee,
  /// regardless of whether it came from a #Role or #Area charge type.
  /// Returns null if no active charge carries an area.
  public func getActiveChargeArea(
    charges    : List.List<AdditionalCharge>,
    employeeId : UserId,
    now        : Timestamp,
  ) : ?(Nat, Nat) {
    for (c in charges.values()) {
      if (c.employeeId == employeeId and chargeStatus(c, now) == #Active) {
        switch (c.additionalHqId, c.additionalAreaId) {
          case (?hid, ?aid) { return ?(hid, aid) };
          case _ {};
        };
      };
    };
    null
  };

  /// Return the additional areas an employee is currently covering.
  public func effectiveAdditionalAreas(
    charges    : List.List<AdditionalCharge>,
    employeeId : UserId,
    now        : Timestamp,
  ) : [Text] {
    let areaNames = List.empty<Text>();
    for (c in charges.values()) {
      if (c.employeeId == employeeId and chargeStatus(c, now) == #Active) {
        switch (c.additionalArea) {
          case (?a) { areaNames.add(a) };
          case null {};
        };
      };
    };
    areaNames.toArray()
  };

  /// Return all charges that expire within `daysAhead` days from now.
  public func getExpiringCharges(
    charges   : List.List<AdditionalCharge>,
    now       : Timestamp,
    daysAhead : Nat,
  ) : [AdditionalCharge] {
    let cutoff : Timestamp = now + daysAhead.toInt() * NANOS_PER_DAY;
    charges.filter(func(c : AdditionalCharge) : Bool {
      // Active charge expiring within the window
      chargeStatus(c, now) == #Active and c.effectiveTo <= cutoff
    }).toArray()
  };
};
