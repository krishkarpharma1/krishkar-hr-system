import Types     "../types/target-history";
import AuthTypes  "../types/auth-users";
import AuthLib    "../lib/auth-users";
import Lib        "../lib/target-history";
import List       "mo:core/List";
import Map        "mo:core/Map";
import Time       "mo:core/Time";

/// Public API surface for Target Adjustment History.
/// Injected state: the append-only log list + session map.
mixin (
  sessions        : Map.Map<Text, AuthTypes.Session>,
  targetAdjLogs   : List.List<Types.TargetAdjustmentLog>,
) {

  // ── Role helpers ────────────────────────────────────────────────────────────

  func thIsAdminOrHR(role : AuthTypes.Role) : Bool {
    switch (role) {
      case (#Admin or #HRManager) { true };
      case _                      { false };
    }
  };

  // ── Public endpoints ─────────────────────────────────────────────────────────

  /// Admin/HR: query adjustment logs with optional filters.
  /// Returns read-only log entries sorted newest-first.
  public shared func getTargetAdjustmentLogs(
    token  : Text,
    filter : Types.TargetAdjustmentFilter,
  ) : async [Types.TargetAdjustmentLog] {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { [] };
      case (?session) {
        if (not thIsAdminOrHR(session.role)) { return [] };
        Lib.queryLogs(targetAdjLogs, filter)
      };
    }
  };

  /// Admin/HR: get full adjustment history for a specific employee.
  public shared func getTargetAdjustmentLogsForUser(
    token  : Text,
    userId : Types.UserId,
  ) : async [Types.TargetAdjustmentLog] {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { [] };
      case (?session) {
        // Admin/HR or the employee themselves
        if (not thIsAdminOrHR(session.role) and session.userId != userId) {
          return [];
        };
        Lib.getLogsForUser(targetAdjLogs, userId)
      };
    }
  };

  /// Admin/HR: export adjustment log as a flat array (Excel source data).
  /// Same as getTargetAdjustmentLogs but returns all matching rows.
  public shared func exportTargetAdjustmentLogs(
    token  : Text,
    filter : Types.TargetAdjustmentFilter,
  ) : async [Types.TargetAdjustmentLog] {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { [] };
      case (?session) {
        if (not thIsAdminOrHR(session.role)) { return [] };
        Lib.queryLogs(targetAdjLogs, filter)
      };
    }
  };
};
