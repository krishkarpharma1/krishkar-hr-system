/// health-repair.mo — auto-repair functions for common data anomalies.
///
/// All functions are PURELY DEFENSIVE:
///   - Never trap on a single bad record — wrap per-record work in option checks
///   - Never mutate state that isn't explicitly passed in
///   - Return a RepairLog describing what was fixed
///
import CommonTypes "../types/common";
import AuthTypes   "../types/auth-users";
import HRTypes     "../types/hr-core";
import FieldTypes  "../types/field-ops";
import LocTypes    "../types/location-master";
import HRLib       "../lib/hr-core";
import Map         "mo:core/Map";
import List        "mo:core/List";
import Time        "mo:core/Time";

module {
  public type RepairLog    = CommonTypes.RepairLog;
  public type Role         = CommonTypes.Role;

  // ── Civil-calendar year derivation (same algorithm as health-check.mo) ────
  func currentYear() : Nat {
    let now  : Int = Time.now();
    let secs : Int = now / 1_000_000_000;
    let days : Int = secs / 86400;
    let z    : Int = days + 719468;
    let era  : Int = (if (z >= 0) z else z - 146096) / 146097;
    let doe  : Int = z - era * 146097;
    let yoe  : Int = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y    : Int = yoe + era * 400;
    let doy  : Int = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp   : Int = (5 * doy + 2) / 153;
    let m    : Int = if (mp < 10) mp + 3 else mp - 9;
    let yr   : Int = if (m <= 2) y + 1 else y;
    if (yr > 0) yr.toNat() else 2026
  };

  // ── Quota defaults ────────────────────────────────────────────────────────
  func quotaFor(role : Role, year : Nat) : HRTypes.RoleLeaveQuota {
    switch (role) {
      case (#MR)        { { role; year; casualTotal = 12; sickTotal = 6;  unpaidTotal = 0; plTotal = 15; mlTotal = 0; lwpTotal = 0; coTotal = 5 } };
      case (#ASM)       { { role; year; casualTotal = 12; sickTotal = 6;  unpaidTotal = 0; plTotal = 15; mlTotal = 0; lwpTotal = 0; coTotal = 5 } };
      case (#RSM)       { { role; year; casualTotal = 12; sickTotal = 8;  unpaidTotal = 0; plTotal = 18; mlTotal = 0; lwpTotal = 0; coTotal = 5 } };
      case (#ZSM)       { { role; year; casualTotal = 12; sickTotal = 8;  unpaidTotal = 0; plTotal = 18; mlTotal = 0; lwpTotal = 0; coTotal = 5 } };
      case (#HRManager) { { role; year; casualTotal = 15; sickTotal = 10; unpaidTotal = 0; plTotal = 21; mlTotal = 0; lwpTotal = 0; coTotal = 7 } };
      case (#Admin)     { { role; year; casualTotal = 15; sickTotal = 10; unpaidTotal = 0; plTotal = 21; mlTotal = 0; lwpTotal = 0; coTotal = 7 } };
    }
  };

  // ── Repair 1: seed missing leave quotas for the current year ─────────────
  /// For every role, check whether a quota exists for this year.
  /// If missing, seed it. Never replaces an existing quota.
  /// Returns (fixedCount, RepairLog).
  public func repairMissingLeaveQuotas(
    roleLeaveQuotas : List.List<HRTypes.RoleLeaveQuota>,
    triggeredBy     : Text,
  ) : (Nat, RepairLog) {
    let year    = currentYear();
    let allRoles : [Role] = [#MR, #ASM, #RSM, #ZSM, #HRManager, #Admin];
    var fixed : Nat = 0;
    let seeded = List.empty<Text>();

    for (role in allRoles.values()) {
      // Defensive: use Option — never trap on quota lookup
      switch (HRLib.getRoleLeaveQuota(roleLeaveQuotas, role, year)) {
        case null {
          let quota = quotaFor(role, year);
          ignore HRLib.setRoleLeaveQuota(roleLeaveQuotas, quota);
          fixed += 1;
          let roleText = switch (role) {
            case (#MR)        "MR";
            case (#ASM)       "ASM";
            case (#RSM)       "RSM";
            case (#ZSM)       "ZSM";
            case (#HRManager) "HRManager";
            case (#Admin)     "Admin";
          };
          seeded.add(roleText # "/" # year.toText());
        };
        case (?_) {};
      };
    };

    let details = if (fixed == 0)
      "All leave quotas for year " # year.toText() # " already present — nothing to seed"
    else
      "Seeded leave quotas: " # seeded.toArray().size().toText() # " entries for year " # year.toText();

    let log : RepairLog = {
      repairType  = "MISSING_LEAVE_QUOTA";
      triggeredBy = triggeredBy;
      timestamp   = Time.now();
      fixedCount  = fixed;
      details     = details;
    };
    (fixed, log)
  };

  // ── Repair 2: remove leave and expense records with unknown employeeId ────
  /// Scans all leave applications and expense records; removes any whose
  /// employeeId does not match an existing user. Defensive — skips any record
  /// that cannot be evaluated safely.
  public func repairOrphanedEmployeeRefs(
    users       : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
    leaves      : List.List<HRTypes.LeaveApplication>,
    expenses    : List.List<HRTypes.TaDaExpense>,
    triggeredBy : Text,
  ) : (Nat, RepairLog) {
    var fixed : Nat = 0;
    let removedIds = List.empty<Text>();

    // Collect leave IDs to remove first (avoid mutating while iterating)
    let leaveIdsToRemove = List.empty<Nat>();
    for (l in leaves.values()) {
      switch (users.get(l.employeeId)) {
        case null {
          leaveIdsToRemove.add(l.id);
          removedIds.add("leave#" # l.id.toText());
        };
        case (?_) {};
      };
    };

    // Collect expense IDs to remove
    let expenseIdsToRemove = List.empty<Nat>();
    for (e in expenses.values()) {
      switch (users.get(e.employeeId)) {
        case null {
          expenseIdsToRemove.add(e.id);
          removedIds.add("expense#" # e.id.toText());
        };
        case (?_) {};
      };
    };

    // Rebuild leaves list without orphans — retain only valid ones
    if (leaveIdsToRemove.size() > 0) {
      let toRemove = leaveIdsToRemove.toArray();
      let valid = leaves.filter(func(l : HRTypes.LeaveApplication) : Bool {
        not toRemove.any(func(rid : Nat) : Bool { rid == l.id })
      });
      leaves.clear();
      leaves.append(valid);
      fixed += leaveIdsToRemove.size();
    };

    // Rebuild expenses list without orphans
    if (expenseIdsToRemove.size() > 0) {
      let toRemove = expenseIdsToRemove.toArray();
      let valid = expenses.filter(func(e : HRTypes.TaDaExpense) : Bool {
        not toRemove.any(func(rid : Nat) : Bool { rid == e.id })
      });
      expenses.clear();
      expenses.append(valid);
      fixed += expenseIdsToRemove.size();
    };

    let details = if (fixed == 0)
      "No orphaned employee references found in leave or expense records"
    else
      "Removed " # fixed.toText() # " orphaned records: " #
      removedIds.sliceToArray(0, (if (removedIds.size() > 10) 10 else removedIds.size()).toInt()).size().toText() # " shown";

    let log : RepairLog = {
      repairType  = "ORPHANED_EMPLOYEE_REFERENCE";
      triggeredBy = triggeredBy;
      timestamp   = Time.now();
      fixedCount  = fixed;
      details     = details;
    };
    (fixed, log)
  };

  // ── Repair 3: clear invalid area references on doctor records ─────────────
  /// Doctors whose area field does not case-insensitively match any area in
  /// the Area Master have their area field cleared to "" so they still appear
  /// in the master list but no longer generate mismatch anomalies.
  public func repairDoctorAreaRefs(
    doctors     : List.List<FieldTypes.Doctor>,
    areas       : Map.Map<LocTypes.LocationId, LocTypes.AreaRecord>,
    triggeredBy : Text,
  ) : (Nat, RepairLog) {
    // Build a flat set of known area names (lower-cased) from area master
    let knownNames = List.empty<Text>();
    for ((_, ar) in areas.entries()) {
      knownNames.add(ar.name.toLower())
    };

    var fixed : Nat = 0;
    let fixedIds = List.empty<Text>();

    doctors.mapInPlace(func(d : FieldTypes.Doctor) : FieldTypes.Doctor {
      let areaName = d.area;
      if (areaName != "") {
        let found = knownNames.find(func(n : Text) : Bool { n == areaName.toLower() });
        switch (found) {
          case null {
            // Defensive in-place clear of invalid area reference
            d.area := "";
            fixed += 1;
            fixedIds.add("doctor#" # d.id.toText() # "(" # d.name # ")");
          };
          case (?_) {};
        };
      };
      d
    });

    let details = if (fixed == 0)
      "All doctor area references are valid — nothing to repair"
    else
      "Cleared invalid area references on " # fixed.toText() # " doctor records";

    let log : RepairLog = {
      repairType  = "DOCTOR_AREA_REF_MISMATCH";
      triggeredBy = triggeredBy;
      timestamp   = Time.now();
      fixedCount  = fixed;
      details     = details;
    };
    (fixed, log)
  };

  // ── Repair 4: migrate MR flat hq/area fields to per-HQ blocks ─────────────
  /// For MR employees whose hqAssignments is empty but who have legacy flat
  /// hqIds/areaIds, convert them to the single-block format used by V42+.
  /// Idempotent — sets migrationDone=true so it never runs twice.
  public func repairMrHqAssignments(
    users       : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
    triggeredBy : Text,
  ) : (Nat, RepairLog) {
    var fixed : Nat = 0;
    let fixedNames = List.empty<Text>();

    for ((_, u) in users.entries()) {
      // Defensive: only process MR employees that haven't been migrated yet
      if (u.role == #MR and not u.migrationDone and u.hqAssignments.size() == 0) {
        // Group areaIds under their parent hqId; one block per hqId
        let blockMap = Map.empty<Nat, [Nat]>();
        for (aId in u.areaIds.values()) {
          let hId : Nat = if (u.hqIds.size() > 0) u.hqIds[0] else 0;
          switch (blockMap.get(hId)) {
            case (?existing) { blockMap.add(hId, existing.concat([aId])) };
            case null        { blockMap.add(hId, [aId]) };
          };
        };

        let blocks = List.empty<AuthTypes.HqAssignment>();
        for (hId in u.hqIds.values()) {
          let aIds = switch (blockMap.get(hId)) { case (?a) a; case null [] };
          blocks.add({ hqId = hId; areaIds = aIds; stationIds = []; exStationIds = [] });
        };

        u.hqAssignments := blocks.toArray();
        u.migrationDone := true;
        fixed += 1;
        fixedNames.add(u.name # "(id=" # u.id.toText() # ")");
      };
    };

    let details = if (fixed == 0)
      "No MR records needed HQ assignment migration"
    else
      "Migrated legacy hq/area fields to hqAssignment blocks for " # fixed.toText() # " MR employees";

    let log : RepairLog = {
      repairType  = "MR_MISSING_HQ_ASSIGNMENT";
      triggeredBy = triggeredBy;
      timestamp   = Time.now();
      fixedCount  = fixed;
      details     = details;
    };
    (fixed, log)
  };
};
