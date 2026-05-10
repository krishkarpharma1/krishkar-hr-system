/// health-repair-api.mo — public API for Admin-triggered auto-repair.
///
/// One public function: runAutoRepair(token, repairTypes)
///   - Requires Admin session
///   - Runs each requested repair (or all if repairTypes=[])
///   - Appends each RepairLog to the rolling repairLogs state (capped at 200)
///   - Runs a fresh health check after all repairs
///   - Returns RepairResult { repairedTypes, fixedCounts, updatedReport }
///
import CommonTypes   "../types/common";
import AuthTypes     "../types/auth-users";
import HRTypes       "../types/hr-core";
import FieldTypes    "../types/field-ops";
import LocTypes      "../types/location-master";
import HealthLib     "../lib/health-check";
import RepairLib     "../lib/health-repair";
import Map           "mo:core/Map";
import List          "mo:core/List";
import Time          "mo:core/Time";

mixin (
  sessions        : Map.Map<Text, AuthTypes.Session>,
  users           : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
  roleLeaveQuotas : List.List<HRTypes.RoleLeaveQuota>,
  leaves          : List.List<HRTypes.LeaveApplication>,
  expenses        : List.List<HRTypes.TaDaExpense>,
  doctors         : List.List<FieldTypes.Doctor>,
  areas           : Map.Map<LocTypes.LocationId, LocTypes.AreaRecord>,
  healthCheckLogs : List.List<CommonTypes.HealthCheckReport>,
  repairLogs      : List.List<CommonTypes.RepairLog>,
) {

  // ── Session helper ─────────────────────────────────────────────────────────

  func requireAdminSession(token : Text) : ?AuthTypes.Session {
    switch (sessions.get(token)) {
      case null { null };
      case (?s) {
        if (s.expiresAt <= Time.now()) { null }
        else {
          switch (s.role) {
            case (#Admin) ?s;
            case _        null;
          }
        }
      };
    }
  };

  // ── Internal: append a RepairLog, cap at 200 ──────────────────────────────

  func appendRepairLog(log : CommonTypes.RepairLog) {
    if (repairLogs.size() >= 200) {
      let size = repairLogs.size();
      let trimmed = repairLogs.sliceToArray(1, size.toInt());
      repairLogs.clear();
      repairLogs.addAll(trimmed.values());
    };
    repairLogs.add(log);
  };

  // ── Internal: run fresh health check and append to healthCheckLogs ────────

  func runAndAppendHealthCheck() : CommonTypes.HealthCheckReport {
    let report = HealthLib.runHealthCheck(
      users, roleLeaveQuotas, leaves, expenses, doctors, areas, sessions,
    );
    if (healthCheckLogs.size() >= 100) {
      let size = healthCheckLogs.size();
      let trimmed = healthCheckLogs.sliceToArray(1, size.toInt());
      healthCheckLogs.clear();
      healthCheckLogs.addAll(trimmed.values());
    };
    healthCheckLogs.add(report);
    report
  };

  // ── Public API ─────────────────────────────────────────────────────────────

  /// Run one or more auto-repair operations.
  ///
  /// - `repairTypes`: subset of anomaly type strings to fix, e.g.
  ///   ["MISSING_LEAVE_QUOTA", "ORPHANED_EMPLOYEE_REFERENCE"].
  ///   Pass [] to run ALL repair types.
  /// - Requires Admin session token.
  /// - Returns RepairResult with per-type fixed counts and a fresh health report.
  public shared func runAutoRepair(
    token       : Text,
    repairTypes : [Text],
  ) : async CommonTypes.RepairResult {
    switch (requireAdminSession(token)) {
      case null {
        // Return a safe error result — never trap
        let unauthorizedReport : CommonTypes.HealthCheckReport = {
          passed       = false;
          timestamp    = Time.now();
          anomalyCount = 1;
          anomalies    = [{
            anomalyType = "UNAUTHORIZED";
            description = "Caller is not an Admin — auto-repair requires Admin role";
            affectedIds = [];
          }];
        };
        return {
          repairedTypes  = [];
          fixedCounts    = [];
          updatedReport  = unauthorizedReport;
        };
      };
      case (?s) {
        let triggeredBy = s.name;
        let runAll = repairTypes.size() == 0;

        func shouldRun(t : Text) : Bool {
          runAll or repairTypes.any(func(r : Text) : Bool { r == t })
        };

        let repairedTypes = List.empty<Text>();
        let fixedCounts   = List.empty<(Text, Nat)>();

        // ── Repair 1: MISSING_LEAVE_QUOTA ───────────────────────────────────
        if (shouldRun("MISSING_LEAVE_QUOTA")) {
          let (count, log) = RepairLib.repairMissingLeaveQuotas(roleLeaveQuotas, triggeredBy);
          appendRepairLog(log);
          repairedTypes.add("MISSING_LEAVE_QUOTA");
          fixedCounts.add(("MISSING_LEAVE_QUOTA", count));
        };

        // ── Repair 2: ORPHANED_EMPLOYEE_REFERENCE ────────────────────────────
        if (shouldRun("ORPHANED_EMPLOYEE_REFERENCE")) {
          let (count, log) = RepairLib.repairOrphanedEmployeeRefs(users, leaves, expenses, triggeredBy);
          appendRepairLog(log);
          repairedTypes.add("ORPHANED_EMPLOYEE_REFERENCE");
          fixedCounts.add(("ORPHANED_EMPLOYEE_REFERENCE", count));
        };

        // ── Repair 3: DOCTOR_AREA_REF_MISMATCH ──────────────────────────────
        if (shouldRun("DOCTOR_AREA_REF_MISMATCH")) {
          let (count, log) = RepairLib.repairDoctorAreaRefs(doctors, areas, triggeredBy);
          appendRepairLog(log);
          repairedTypes.add("DOCTOR_AREA_REF_MISMATCH");
          fixedCounts.add(("DOCTOR_AREA_REF_MISMATCH", count));
        };

        // ── Repair 4: MR_MISSING_HQ_ASSIGNMENT ──────────────────────────────
        if (shouldRun("MR_MISSING_HQ_ASSIGNMENT")) {
          let (count, log) = RepairLib.repairMrHqAssignments(users, triggeredBy);
          appendRepairLog(log);
          repairedTypes.add("MR_MISSING_HQ_ASSIGNMENT");
          fixedCounts.add(("MR_MISSING_HQ_ASSIGNMENT", count));
        };

        // ── Fresh health check after all repairs ─────────────────────────────
        let updatedReport = runAndAppendHealthCheck();

        {
          repairedTypes = repairedTypes.toArray();
          fixedCounts   = fixedCounts.toArray();
          updatedReport = updatedReport;
        };
      };
    }
  };

  /// Returns the last `limit` repair log entries (newest last).
  /// Admin only. Returns empty array if no repairs have run yet.
  public query func getRepairHistory(token : Text, limit : Nat) : async [CommonTypes.RepairLog] {
    switch (requireAdminSession(token)) {
      case null { [] };
      case (?_) {
        let size = repairLogs.size();
        if (size == 0 or limit == 0) { return [] };
        let from : Int = if (size.toInt() - limit.toInt() < 0) 0 else size.toInt() - limit.toInt();
        repairLogs.sliceToArray(from, size.toInt())
      };
    }
  };
};
