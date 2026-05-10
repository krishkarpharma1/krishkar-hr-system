import Types     "../types/monthly-targets";
import AuthTypes  "../types/auth-users";
import CrmTypes   "../types/crm";
import LocTypes   "../types/location-master";
import FieldTypes "../types/field-ops";
import List       "mo:core/List";
import Map        "mo:core/Map";

module {
  public type MonthlyTarget            = Types.MonthlyTarget;
  public type SetMonthlyTargetInput    = Types.SetMonthlyTargetInput;
  public type BulkSetMonthlyTargetsInput = Types.BulkSetMonthlyTargetsInput;
  public type MonthlyTargetFilter      = Types.MonthlyTargetFilter;
  public type TargetVsActual           = Types.TargetVsActual;
  public type TargetRevision           = Types.TargetRevision;
  public type UserId                   = Types.UserId;
  public type Timestamp                = Types.Timestamp;
  public type UserRecord               = AuthTypes.UserRecord;

  /// Compose the composite ID for a monthly target.
  func makeId(userId : UserId, year : Nat, month : Nat) : Text {
    userId.toText() # "-" # year.toText() # "-" # month.toText()
  };

  /// Set or revise a monthly target for one employee.
  /// Creates a new record if none exists for userId+month+year;
  /// otherwise updates the existing record and appends a revision entry.
  public func setTarget(
    targets  : List.List<MonthlyTarget>,
    input    : SetMonthlyTargetInput,
    callerId : UserId,
    now      : Timestamp,
  ) : MonthlyTarget {
    let id = makeId(input.userId, input.year, input.month);
    let existing = targets.findIndex(func(t : MonthlyTarget) : Bool { t.id == id });
    switch (existing) {
      case (?idx) {
        let old = targets.at(idx);
        let revision : TargetRevision = {
          revisedAt      = now;
          revisedBy      = callerId;
          previousAmount = old.targetAmount;
          newAmount      = input.targetAmount;
          remarks        = input.remarks;
        };
        let updated : MonthlyTarget = {
          old with
          targetAmount     = input.targetAmount;
          doctorCallTarget = switch (input.doctorCallTarget) { case (?v) v; case null old.doctorCallTarget };
          chemistTarget    = switch (input.chemistTarget)    { case (?v) v; case null old.chemistTarget    };
          stockistTarget   = switch (input.stockistTarget)   { case (?v) v; case null old.stockistTarget   };
          newDoctorsTarget = switch (input.newDoctorsTarget) { case (?v) v; case null old.newDoctorsTarget };
          productTargets   = switch (input.productTargets)   { case (?pts) pts; case null old.productTargets };
          remarks          = input.remarks;
          revisionHistory  = old.revisionHistory.concat([revision]);
          updatedAt        = now;
          updatedBy        = callerId;
        };
        targets.put(idx, updated);
        updated
      };
      case null {
        let target : MonthlyTarget = {
          id               = id;
          userId           = input.userId;
          role             = #MR; // will be overwritten by mixin with real role
          month            = input.month;
          year             = input.year;
          targetAmount     = input.targetAmount;
          doctorCallTarget = switch (input.doctorCallTarget) { case (?v) v; case null 0 };
          chemistTarget    = switch (input.chemistTarget)    { case (?v) v; case null 0 };
          stockistTarget   = switch (input.stockistTarget)   { case (?v) v; case null 0 };
          newDoctorsTarget = switch (input.newDoctorsTarget) { case (?v) v; case null 0 };
          productTargets   = switch (input.productTargets)   { case (?pts) pts; case null [] };
          remarks          = input.remarks;
          revisionHistory  = [];
          createdAt        = now;
          createdBy        = callerId;
          updatedAt        = now;
          updatedBy        = callerId;
        };
        targets.add(target);
        target
      };
    }
  };

  /// Set or revise a monthly target with an explicit role (used from mixin).
  public func setTargetWithRole(
    targets  : List.List<MonthlyTarget>,
    input    : SetMonthlyTargetInput,
    role     : AuthTypes.Role,
    callerId : UserId,
    now      : Timestamp,
  ) : MonthlyTarget {
    let id = makeId(input.userId, input.year, input.month);
    let existing = targets.findIndex(func(t : MonthlyTarget) : Bool { t.id == id });
    switch (existing) {
      case (?idx) {
        let old = targets.at(idx);
        let revision : TargetRevision = {
          revisedAt      = now;
          revisedBy      = callerId;
          previousAmount = old.targetAmount;
          newAmount      = input.targetAmount;
          remarks        = input.remarks;
        };
        let updated : MonthlyTarget = {
          old with
          targetAmount     = input.targetAmount;
          doctorCallTarget = switch (input.doctorCallTarget) { case (?v) v; case null old.doctorCallTarget };
          chemistTarget    = switch (input.chemistTarget)    { case (?v) v; case null old.chemistTarget    };
          stockistTarget   = switch (input.stockistTarget)   { case (?v) v; case null old.stockistTarget   };
          newDoctorsTarget = switch (input.newDoctorsTarget) { case (?v) v; case null old.newDoctorsTarget };
          productTargets   = switch (input.productTargets)   { case (?pts) pts; case null old.productTargets };
          remarks          = input.remarks;
          revisionHistory  = old.revisionHistory.concat([revision]);
          updatedAt        = now;
          updatedBy        = callerId;
        };
        targets.put(idx, updated);
        updated
      };
      case null {
        let target : MonthlyTarget = {
          id               = id;
          userId           = input.userId;
          role             = role;
          month            = input.month;
          year             = input.year;
          targetAmount     = input.targetAmount;
          doctorCallTarget = switch (input.doctorCallTarget) { case (?v) v; case null 0 };
          chemistTarget    = switch (input.chemistTarget)    { case (?v) v; case null 0 };
          stockistTarget   = switch (input.stockistTarget)   { case (?v) v; case null 0 };
          newDoctorsTarget = switch (input.newDoctorsTarget) { case (?v) v; case null 0 };
          productTargets   = switch (input.productTargets)   { case (?pts) pts; case null [] };
          remarks          = input.remarks;
          revisionHistory  = [];
          createdAt        = now;
          createdBy        = callerId;
          updatedAt        = now;
          updatedBy        = callerId;
        };
        targets.add(target);
        target
      };
    }
  };

  /// Set or revise monthly targets for multiple employees at once.
  /// Returns the count of records created or updated.
  public func bulkSetTargets(
    targets  : List.List<MonthlyTarget>,
    users    : Map.Map<UserId, UserRecord>,
    input    : BulkSetMonthlyTargetsInput,
    callerId : UserId,
    now      : Timestamp,
  ) : Nat {
    var count = 0;
    for (row in input.rows.values()) {
      let role : AuthTypes.Role = switch (users.get(row.userId)) {
        case (?u) { u.role };
        case null { #MR };
      };
      let rowInput : SetMonthlyTargetInput = {
        userId           = row.userId;
        month            = input.month;
        year             = input.year;
        targetAmount     = row.targetAmount;
        doctorCallTarget = row.doctorCallTarget;
        chemistTarget    = row.chemistTarget;
        stockistTarget   = row.stockistTarget;
        newDoctorsTarget = row.newDoctorsTarget;
        productTargets   = null;
        remarks          = row.remarks;
      };
      ignore setTargetWithRole(targets, rowInput, role, callerId, now);
      count += 1;
    };
    count
  };

  /// Retrieve a single monthly target by employee + month + year.
  public func getTarget(
    targets : List.List<MonthlyTarget>,
    userId  : UserId,
    month   : Nat,
    year    : Nat,
  ) : ?MonthlyTarget {
    let id = makeId(userId, year, month);
    targets.find(func(t : MonthlyTarget) : Bool { t.id == id })
  };

  /// List monthly targets with optional filters.
  public func listTargets(
    targets  : List.List<MonthlyTarget>,
    users    : Map.Map<UserId, UserRecord>,
    filter   : MonthlyTargetFilter,
  ) : [MonthlyTarget] {
    targets.filter(func(t : MonthlyTarget) : Bool {
      switch (filter.userId)  { case (?uid) { if (t.userId != uid) return false }; case null {} };
      switch (filter.role)    { case (?r)   { if (t.role   != r)   return false }; case null {} };
      switch (filter.month)   { case (?m)   { if (t.month  != m)   return false }; case null {} };
      switch (filter.year)    { case (?y)   { if (t.year   != y)   return false }; case null {} };
      // Territory / area filter — resolve from user record
      switch (filter.territory) {
        case (?terr) {
          switch (users.get(t.userId)) {
            case (?u) {
              if (u.territory != terr) return false
            };
            case null { return false };
          }
        };
        case null {};
      };
      true
    }).toArray()
  };

  /// Return the full revision history for a specific employee + month + year.
  public func getRevisionHistory(
    targets : List.List<MonthlyTarget>,
    userId  : UserId,
    month   : Nat,
    year    : Nat,
  ) : [TargetRevision] {
    let id = makeId(userId, year, month);
    switch (targets.find(func(t : MonthlyTarget) : Bool { t.id == id })) {
      case (?t) { t.revisionHistory };
      case null { [] };
    }
  };

  /// Compute target vs. actual for one employee for a given month/year.
  /// Actual sales are summed from crmBusinessReports.
  public func getTargetVsActual(
    targets            : List.List<MonthlyTarget>,
    users              : Map.Map<UserId, UserRecord>,
    territories        : Map.Map<Nat, LocTypes.TerritoryRecord>,
    areas              : Map.Map<Nat, LocTypes.AreaRecord>,
    crmBusinessReports : List.List<CrmTypes.BusinessReport>,
    userId             : UserId,
    month              : Nat,
    year               : Nat,
  ) : TargetVsActual {
    let id = makeId(userId, year, month);
    let targetAmount : Float = switch (targets.find(func(t : MonthlyTarget) : Bool { t.id == id })) {
      case (?t) { t.targetAmount };
      case null { 0.0 };
    };

    // Sum actual sales from business reports
    var actualAmount : Float = 0.0;
    for (r in crmBusinessReports.values()) {
      if (r.userId == userId and r.month == month and r.year == year) {
        actualAmount += r.actualSales;
      };
    };

    let achievementPct = if (targetAmount > 0.0) {
      (actualAmount / targetAmount) * 100.0
    } else { 0.0 };

    let remainingTarget = if (targetAmount > actualAmount) targetAmount - actualAmount else 0.0;

    // Resolve name, role, territory, area from user record
    let (empId, name, role, territory, area) : (Text, Text, AuthTypes.Role, ?Text, ?Text) =
      switch (users.get(userId)) {
        case (?u) {
          let terrName : ?Text = if (u.territoryIds.size() > 0) {
            switch (territories.get(u.territoryIds[0])) {
              case (?t) { ?t.name };
              case null { null };
            }
          } else { null };
          let areaName : ?Text = if (u.areaIds.size() > 0) {
            switch (areas.get(u.areaIds[0])) {
              case (?a) { ?a.name };
              case null { null };
            }
          } else { null };
          (u.employeeId, u.name, u.role, terrName, areaName)
        };
        case null { ("", "", #MR, null, null) };
      };

    {
      userId          = userId;
      employeeId      = empId;
      name            = name;
      role            = role;
      territory       = territory;
      area            = area;
      month           = month;
      year            = year;
      targetAmount    = targetAmount;
      actualAmount    = actualAmount;
      achievementPct  = achievementPct;
      remainingTarget = remainingTarget;
    }
  };

  /// Compute target vs. actual for an entire team (manager view or Admin/HR).
  /// Pass null for rootId to get all field staff (Admin/HR view).
  public func getTeamTargetVsActual(
    targets            : List.List<MonthlyTarget>,
    users              : Map.Map<UserId, UserRecord>,
    territories        : Map.Map<Nat, LocTypes.TerritoryRecord>,
    areas              : Map.Map<Nat, LocTypes.AreaRecord>,
    crmBusinessReports : List.List<CrmTypes.BusinessReport>,
    rootId             : ?UserId,
    month              : Nat,
    year               : Nat,
  ) : [TargetVsActual] {
    // Collect eligible user IDs
    let eligibleIds = List.empty<UserId>();
    for ((uid, u) in users.entries()) {
      let isFieldStaff = switch (u.role) {
        case (#MR or #ASM or #RSM or #ZSM) { true };
        case _ { false };
      };
      if (isFieldStaff) {
        let shouldInclude = switch (rootId) {
          case null { true }; // Admin/HR: all field staff
          case (?rid) { isSubordinate(users, uid, rid) };
        };
        if (shouldInclude) { eligibleIds.add(uid) };
      };
    };

    // Build TargetVsActual for each
    let results = List.empty<TargetVsActual>();
    for (uid in eligibleIds.values()) {
      results.add(getTargetVsActual(
        targets, users, territories, areas, crmBusinessReports, uid, month, year
      ));
    };
    results.toArray()
  };

  /// Get all monthly targets for one employee (dashboard use).
  public func getTargetsForUser(
    targets : List.List<MonthlyTarget>,
    userId  : UserId,
  ) : [MonthlyTarget] {
    targets.filter(func(t : MonthlyTarget) : Bool { t.userId == userId }).toArray()
  };

  /// Get the monthly target amount for a specific employee + month + year.
  /// Used by incentive calculation.
  public func getTargetAmount(
    targets : List.List<MonthlyTarget>,
    userId  : UserId,
    month   : Nat,
    year    : Nat,
  ) : Float {
    let id = makeId(userId, year, month);
    switch (targets.find(func(t : MonthlyTarget) : Bool { t.id == id })) {
      case (?t) { t.targetAmount };
      case null { 0.0 };
    }
  };

  // ── New SFA KPI helpers ────────────────────────────────────────────────────

  /// Count new doctors added by an MR in a given month/year.
  /// A doctor is considered "new for this MR" if doctor.createdBy == mrId
  /// and the doctor's createdAt timestamp falls within the given month/year.
  /// Timestamps are Int nanoseconds since epoch (Internet Computer Time.now()).
  public func getNewDoctorsAddedThisMonth(
    mrId    : UserId,
    month   : Nat,
    year    : Nat,
    doctors : List.List<FieldTypes.Doctor>,
  ) : Nat {
    var count : Nat = 0;
    for (doc in doctors.values()) {
      if (doc.createdBy == mrId) {
        let ts : Int = doc.createdAt;
        // Convert nanoseconds to seconds
        let secs : Int = ts / 1_000_000_000;
        // Civil calendar: days since Unix epoch
        let days : Int = secs / 86400;
        let z    : Int = days + 719468;
        let era  : Int = (if (z >= 0) z else z - 146096) / 146097;
        let doe  : Int = z - era * 146097;
        let yoe  : Int = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
        let y    : Int = yoe + era * 400;
        let doy  : Int = doe - (365 * yoe + yoe / 4 - yoe / 100);
        let mp   : Int = (5 * doy + 2) / 153;
        let m    : Int = if (mp < 10) mp + 3 else mp - 9;
        let docYear : Int = if (m <= 2) y + 1 else y;
        let docMonth : Nat = if (m > 0) m.toNat() else 1;
        let docYearNat : Nat = if (docYear > 0) docYear.toNat() else 0;
        if (docYearNat == year and docMonth == month) {
          count += 1;
        };
      };
    };
    count
  };

  /// Compute KPI achievement percentages for an MR for a given month.
  /// Returns 0.0 for any KPI where the target is 0.
  public func getMRKpiAchievement(
    target              : MonthlyTarget,
    actualDoctorCalls   : Nat,
    actualChemistVisits : Nat,
    actualStockistVisits : Nat,
    actualNewDoctors    : Nat,
  ) : {
    doctorCallPct  : Float;
    chemistPct     : Float;
    stockistPct    : Float;
    newDoctorsPct  : Float;
  } {
    let pct = func(actual : Nat, tgt : Nat) : Float {
      if (tgt == 0) { 0.0 } else {
        (actual.toFloat() / tgt.toFloat()) * 100.0
      }
    };
    {
      doctorCallPct  = pct(actualDoctorCalls,    target.doctorCallTarget);
      chemistPct     = pct(actualChemistVisits,  target.chemistTarget);
      stockistPct    = pct(actualStockistVisits, target.stockistTarget);
      newDoctorsPct  = pct(actualNewDoctors,     target.newDoctorsTarget);
    }
  };

  // ── Private helpers ────────────────────────────────────────────────────────

  /// Check if `uid` is a direct or indirect subordinate of `managerId`.
  func isSubordinate(
    users     : Map.Map<UserId, UserRecord>,
    uid       : UserId,
    managerId : UserId,
  ) : Bool {
    // Walk reportsTo chain upward
    var current : ?UserId = switch (users.get(uid)) {
      case (?u) { u.reportsTo };
      case null { null };
    };
    var depth = 0;
    label walk loop {
      if (depth > 10) break walk; // guard against cycles
      switch (current) {
        case null { break walk };
        case (?mid) {
          if (mid == managerId) return true;
          current := switch (users.get(mid)) {
            case (?u) { u.reportsTo };
            case null { null };
          };
          depth += 1;
        };
      };
    };
    false
  };
};
