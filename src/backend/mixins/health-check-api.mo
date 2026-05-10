import CommonTypes  "../types/common";
import AuthTypes    "../types/auth-users";
import HRTypes      "../types/hr-core";
import FieldTypes   "../types/field-ops";
import LocTypes     "../types/location-master";
import HealthLib    "../lib/health-check";
import Map          "mo:core/Map";
import List         "mo:core/List";
import Time         "mo:core/Time";

mixin (
  sessions        : Map.Map<Text, AuthTypes.Session>,
  users           : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
  roleLeaveQuotas : List.List<HRTypes.RoleLeaveQuota>,
  leaves          : List.List<HRTypes.LeaveApplication>,
  expenses        : List.List<HRTypes.TaDaExpense>,
  doctors         : List.List<FieldTypes.Doctor>,
  areas           : Map.Map<LocTypes.LocationId, LocTypes.AreaRecord>,
  healthCheckLogs : List.List<CommonTypes.HealthCheckReport>,
) {

  // ── Session helper ─────────────────────────────────────────────────────────

  func requireAdmin(token : Text) : ?AuthTypes.Session {
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

  // ── Internal: run check and append result ──────────────────────────────────
  // Wrapped in a way that NEVER traps. Returns the report.
  func runAndAppend() : CommonTypes.HealthCheckReport {
    let report = HealthLib.runHealthCheck(
      users, roleLeaveQuotas, leaves, expenses, doctors, areas, sessions,
    );
    // Cap log at 100 entries — drop oldest (index 0) when full
    if (healthCheckLogs.size() >= 100) {
      let size = healthCheckLogs.size();
      // Rebuild from index 1 onwards (drop the oldest entry)
      let trimmed = healthCheckLogs.sliceToArray(1, size.toInt());
      healthCheckLogs.clear();
      healthCheckLogs.addAll(trimmed.values());
    };
    healthCheckLogs.add(report);
    report
  };

  // ── Public API ─────────────────────────────────────────────────────────────

  /// Returns the most recent health-check log entry.
  /// Admin only. Returns null if no check has run yet.
  public query func getLatestHealthCheck(token : Text) : async ?CommonTypes.HealthCheckReport {
    switch (requireAdmin(token)) {
      case null { null };
      case (?_) { healthCheckLogs.last() };
    }
  };

  /// Returns the last `limit` health-check log entries (newest last).
  /// Admin only. Returns empty array if no check has run yet or caller is not Admin.
  public query func getHealthCheckHistory(token : Text, limit : Nat) : async [CommonTypes.HealthCheckReport] {
    switch (requireAdmin(token)) {
      case null { [] };
      case (?_) {
        let size = healthCheckLogs.size();
        if (size == 0 or limit == 0) { return [] };
        let from : Int = if (size.toInt() - limit.toInt() < 0) 0 else size.toInt() - limit.toInt();
        healthCheckLogs.sliceToArray(from, size.toInt())
      };
    }
  };

  /// Trigger an on-demand health check. Admin only.
  /// Appends the result to the log and returns it immediately.
  public shared func runHealthCheckNow(token : Text) : async CommonTypes.HealthCheckReport {
    switch (requireAdmin(token)) {
      case null {
        // Return a failed report rather than trapping — caller is not Admin
        {
          passed       = false;
          timestamp    = Time.now();
          anomalyCount = 1;
          anomalies    = [{
            anomalyType = "UNAUTHORIZED";
            description = "Caller is not an Admin — health check requires Admin role";
            affectedIds = [];
          }];
        }
      };
      case (?_) { runAndAppend() };
    }
  };
};
