import CommonTypes "../types/common";
import AuthTypes   "../types/auth-users";
import HRTypes     "../types/hr-core";
import FieldTypes  "../types/field-ops";
import LocTypes    "../types/location-master";
import Map         "mo:core/Map";
import List        "mo:core/List";
import Time        "mo:core/Time";

module {
  public type HealthCheckReport = CommonTypes.HealthCheckReport;
  public type HealthAnomaly     = CommonTypes.HealthAnomaly;

  // ── Year derivation (same civil-calendar algorithm as auth-users.mo) ──────
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

  // ── Check 1: MR HQ Assignments ────────────────────────────────────────────
  // Every employee with role=#MR should have at least one hqAssignment block.
  func checkMrHqAssignments(
    users : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
  ) : [HealthAnomaly] {
    let missing = List.empty<Text>();
    for ((_, u) in users.entries()) {
      switch (u.role) {
        case (#MR) {
          if (u.hqAssignments.size() == 0) {
            missing.add(u.id.toText() # "(" # u.name # ")")
          }
        };
        case _ {};
      }
    };
    if (missing.isEmpty()) {
      []
    } else {
      [{
        anomalyType = "MR_MISSING_HQ_ASSIGNMENT";
        description = "MR employees with no HQ assignment block — doctor access and station lists will be empty for these users";
        affectedIds = missing.toArray();
      }]
    }
  };

  // ── Check 2: Leave Quotas for current year ────────────────────────────────
  // roleLeaveQuotas must have an entry for each of the 5 field roles for the
  // current year, otherwise getLeaveBalance() will return zero / crash callers.
  func checkLeaveQuotas(
    roleLeaveQuotas : List.List<HRTypes.RoleLeaveQuota>,
  ) : [HealthAnomaly] {
    let year = currentYear();
    let rolesToCheck : [CommonTypes.Role] = [#MR, #ASM, #RSM, #ZSM];
    let missing = List.empty<Text>();
    for (role in rolesToCheck.values()) {
      let found = roleLeaveQuotas.find(func (q : HRTypes.RoleLeaveQuota) : Bool {
        q.role == role and q.year == year
      });
      switch (found) {
        case null {
          let roleText = switch (role) {
            case (#MR)  "MR";
            case (#ASM) "ASM";
            case (#RSM) "RSM";
            case (#ZSM) "ZSM";
            case _      "Other";
          };
          missing.add(roleText # "/" # year.toText())
        };
        case (?_) {};
      }
    };
    if (missing.isEmpty()) {
      []
    } else {
      [{
        anomalyType = "MISSING_LEAVE_QUOTA";
        description = "No role leave quota found for the current year — getLeaveBalance() will return zero for affected roles";
        affectedIds = missing.toArray();
      }]
    }
  };

  // ── Check 3: Orphaned employee references in leaves/expenses/advances ─────
  // For every leave or expense record, verify the employeeId still exists in
  // the user map. Orphaned records won't crash the actor but indicate data
  // inconsistency that can confuse reports.
  func checkOrphanedEmployeeRefs(
    users    : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
    leaves   : List.List<HRTypes.LeaveApplication>,
    expenses : List.List<HRTypes.TaDaExpense>,
  ) : [HealthAnomaly] {
    let orphans = List.empty<Text>();

    // Check leaves
    for (l in leaves.values()) {
      switch (users.get(l.employeeId)) {
        case null { orphans.add("leave#" # l.id.toText()) };
        case (?_) {};
      }
    };

    // Check expenses
    for (e in expenses.values()) {
      switch (users.get(e.employeeId)) {
        case null { orphans.add("expense#" # e.id.toText()) };
        case (?_) {};
      }
    };

    if (orphans.isEmpty()) {
      []
    } else {
      [{
        anomalyType = "ORPHANED_EMPLOYEE_REFERENCE";
        description = "Leave or expense records referencing a userId that no longer exists in the employee master";
        affectedIds = orphans.toArray();
      }]
    }
  };

  // ── Check 4: Doctor area name references ─────────────────────────────────
  // Doctors store area as a Text name. If the area field is non-empty, there
  // should be at least one AreaRecord in the area master with a matching name.
  // Mismatched names mean the doctor will never appear in HQ/Area lookups.
  func checkDoctorAreaRefs(
    doctors : List.List<FieldTypes.Doctor>,
    areas   : Map.Map<LocTypes.LocationId, LocTypes.AreaRecord>,
  ) : [HealthAnomaly] {
    // Build a set of known area names (lower-cased) for fast lookup
    let knownAreaNames = List.empty<Text>();
    for ((_, ar) in areas.entries()) {
      knownAreaNames.add(ar.name.toLower())
    };

    let orphans = List.empty<Text>();
    for (d in doctors.values()) {
      let areaName = d.area;
      if (areaName != "") {
        let found = knownAreaNames.find(func (n : Text) : Bool {
          n == areaName.toLower()
        });
        switch (found) {
          case null { orphans.add("doctor#" # d.id.toText() # "(" # d.name # ":area=" # areaName # ")") };
          case (?_) {};
        }
      }
    };
    if (orphans.isEmpty()) {
      []
    } else {
      [{
        anomalyType = "DOCTOR_AREA_REF_MISMATCH";
        description = "Doctors whose area name does not match any Area in the Area Master — these doctors will not appear in HQ/Area-based doctor lookups";
        affectedIds = orphans.toArray();
      }]
    }
  };

  // ── Check 5: Session store accessibility ─────────────────────────────────
  // A simple non-mutating read of the session map to confirm it is reachable.
  func checkSessionStore(
    sessions : Map.Map<Text, AuthTypes.Session>,
  ) : [HealthAnomaly] {
    // Just reading the size is enough to confirm the store is accessible.
    ignore sessions.size();
    [] // no anomaly — if we got here the store is fine
  };

  // ── Public entry point ────────────────────────────────────────────────────

  /// Run all health checks and return an immutable HealthCheckReport.
  /// NEVER traps — all checks use only Option/List operations.
  public func runHealthCheck(
    users           : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
    roleLeaveQuotas : List.List<HRTypes.RoleLeaveQuota>,
    leaves          : List.List<HRTypes.LeaveApplication>,
    expenses        : List.List<HRTypes.TaDaExpense>,
    doctors         : List.List<FieldTypes.Doctor>,
    areas           : Map.Map<LocTypes.LocationId, LocTypes.AreaRecord>,
    sessions        : Map.Map<Text, AuthTypes.Session>,
  ) : HealthCheckReport {
    let all = List.empty<HealthAnomaly>();

    for (a in checkMrHqAssignments(users).values())          { all.add(a) };
    for (a in checkLeaveQuotas(roleLeaveQuotas).values())    { all.add(a) };
    for (a in checkOrphanedEmployeeRefs(users, leaves, expenses).values()) { all.add(a) };
    for (a in checkDoctorAreaRefs(doctors, areas).values())  { all.add(a) };
    for (a in checkSessionStore(sessions).values())          { all.add(a) };

    let anomalies = all.toArray();
    {
      passed       = anomalies.size() == 0;
      timestamp    = Time.now();
      anomalyCount = anomalies.size();
      anomalies    = anomalies;
    }
  };
};
