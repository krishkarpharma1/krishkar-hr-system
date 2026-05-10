import EmpIdLib  "../lib/employee-id";
import AuthTypes  "../types/auth-users";
import AuthLib    "../lib/auth-users";
import Map        "mo:core/Map";
import Time       "mo:core/Time";
import Nat        "mo:core/Nat";

/// Public API surface for Auto-Generated Employee ID management.
/// Injected state: users map, per-role ID counters and config map, and new UID config.
mixin (
  sessions       : Map.Map<Text, AuthTypes.Session>,
  users          : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
  empIdCounters  : Map.Map<Text, EmpIdLib.EmpIdCounter>,
  empIdConfigs   : Map.Map<Text, EmpIdLib.EmpIdConfig>,
  uidConfig      : EmpIdLib.UidConfig,
  userDobMap     : Map.Map<Text, Text>,
) {

  // ── Role helpers ─────────────────────────────────────────────────────────────

  func empIsAdmin(role : AuthTypes.Role) : Bool {
    switch (role) {
      case (#Admin) { true };
      case _        { false };
    }
  };

  func empIsAdminOrHR(role : AuthTypes.Role) : Bool {
    switch (role) {
      case (#Admin or #HRManager) { true };
      case _                      { false };
    }
  };

  // ── UID Company Prefix (new format) ──────────────────────────────────────────

  /// Any authenticated user: get the current company prefix used for new UIDs.
  public shared func getUidCompanyPrefix(
    token : Text,
  ) : async Text {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { "KP" };
      case (?_) { EmpIdLib.getCompanyPrefix(uidConfig) };
    }
  };

  /// Admin: set the company prefix for future UIDs.
  public shared func setUidCompanyPrefix(
    token  : Text,
    prefix : Text,
  ) : async { #ok; #err : Text } {
    switch (AuthLib.validateSession(sessions, token, Time.now())) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        if (not empIsAdmin(session.role)) {
          return #err("Access denied: Admin only");
        };
        if (prefix.size() == 0) {
          return #err("Prefix must not be empty");
        };
        EmpIdLib.setCompanyPrefix(uidConfig, prefix);
        #ok
      };
    }
  };

  // ── Bulk UID migration (new format) ──────────────────────────────────────────

  /// Admin: bulk-assign new UID format (KP-YYYY-NNN) to all employees that either
  /// have an empty employeeId or still have the old per-role format (e.g. MR001).
  /// Returns the number of employees updated.
  public shared func bulkMigrateUids(
    token : Text,
  ) : async { #ok : Nat; #err : Text } {
    switch (AuthLib.validateSession(sessions, token, Time.now())) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        if (not empIsAdmin(session.role)) {
          return #err("Access denied: Admin only");
        };
        let now = Time.now();
        let secs : Int = now / 1_000_000_000;
        let days : Int = secs / 86400;
        let z : Int = days + 719468;
        let era : Int = (if (z >= 0) z else z - 146096) / 146097;
        let doe : Int = z - era * 146097;
        let yoe : Int = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
        let y : Int = yoe + era * 400;
        let doy : Int = doe - (365 * yoe + yoe / 4 - yoe / 100);
        let mp : Int = (5 * doy + 2) / 153;
        let m : Int = if (mp < 10) mp + 3 else mp - 9;
        let yr : Int = if (m <= 2) y + 1 else y;
        let currentYear : Nat = if (yr > 0) yr.toNat() else 2026;
        let count = EmpIdLib.bulkMigrateUids(users, uidConfig, currentYear);
        #ok(count)
      };
    }
  };

  // ── Admin configuration (legacy per-role format) ──────────────────────────────

  /// Admin: list current Employee ID configurations for all role prefixes.
  public shared func listEmpIdConfigs(
    token : Text,
  ) : async [EmpIdLib.EmpIdConfig] {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { [] };
      case (?session) {
        if (not empIsAdmin(session.role)) { return [] };
        EmpIdLib.listConfigs(empIdConfigs)
      };
    }
  };

  /// Admin: save or update the prefix / starting number for a role.
  public shared func saveEmpIdConfig(
    token  : Text,
    config : EmpIdLib.EmpIdConfig,
  ) : async { #ok; #err : Text } {
    switch (AuthLib.validateSession(sessions, token, Time.now())) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        if (not empIsAdmin(session.role)) {
          return #err("Access denied: Admin only");
        };
        EmpIdLib.saveConfig(empIdConfigs, empIdCounters, config);
        #ok
      };
    }
  };

  // ── Bulk assignment (one-time legacy migration) ───────────────────────────────

  /// Admin: bulk-assign auto-generated IDs (legacy per-role format) to all existing
  /// employees whose employeeId field is currently empty.
  /// Returns the number of employees updated.
  public shared func bulkAssignEmployeeIds(
    token : Text,
  ) : async { #ok : Nat; #err : Text } {
    switch (AuthLib.validateSession(sessions, token, Time.now())) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        if (not empIsAdmin(session.role)) {
          return #err("Access denied: Admin only");
        };
        let count = EmpIdLib.bulkAssignMissingIds(users, empIdCounters, empIdConfigs);
        #ok(count)
      };
    }
  };

  // ── Read helpers ─────────────────────────────────────────────────────────────

  /// Any authenticated user: look up a user by their Employee ID or UID string.
  public shared func getUserByEmployeeId(
    token      : Text,
    employeeId : Text,
  ) : async ?AuthTypes.UserInfo {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { null };
      case (?_session) {
        var found : ?AuthTypes.UserInfo = null;
        for ((_, u) in users.entries()) {
          if (u.employeeId == employeeId) {
            found := ?AuthLib.toUserInfo(u, userDobMap);
          };
        };
        found
      };
    }
  };

  /// Any authenticated user: look up a user by UID (alias for getUserByEmployeeId).
  public shared func getUserByUID(
    token : Text,
    uid   : Text,
  ) : async ?AuthTypes.UserInfo {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { null };
      case (?_session) {
        var found : ?AuthTypes.UserInfo = null;
        for ((_, u) in users.entries()) {
          if (u.employeeId == uid) {
            found := ?AuthLib.toUserInfo(u, userDobMap);
          };
        };
        found
      };
    }
  };
};
