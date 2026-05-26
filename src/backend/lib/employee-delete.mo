import AuthTypes "../types/auth-users";
import EDTypes   "../types/employee-delete";
import Map       "mo:core/Map";
import List      "mo:core/List";
import Time      "mo:core/Time";

/// Domain logic for employee deletion (archive strategy).
/// Caller passes in all relevant state collections; this module has no stable state.
module {

  public type UserRecord  = AuthTypes.UserRecord;
  public type UserId      = AuthTypes.UserId;

  /// Delete (archive) an employee by ID.
  /// - Only Admin and HRManager callers may proceed.
  /// - HRManager may not delete an Admin account.
  /// - The employee is removed from `users`; the username index entry is removed.
  /// - Returns a summary of archived data for the audit log.
  public func deleteEmployee(
    users          : Map.Map<UserId, UserRecord>,
    usernameIndex  : Map.Map<Text, UserId>,
    employeeId     : Text,
    callerRole     : AuthTypes.Role,
    callerId       : UserId,
    now            : Int,
  ) : EDTypes.EmployeeDeletionResult {

    // ── Role guard ──────────────────────────────────────────────────────────
    switch (callerRole) {
      case (#Admin or #HRManager) {};
      case _ {
        return #err({ code = "UNAUTHORIZED"; message = "Admin or HR role required to delete an employee" });
      };
    };

    // ── Find the target employee ─────────────────────────────────────────────
    var targetId : ?UserId = null;
    for ((uid, u) in users.entries()) {
      if (u.employeeId == employeeId) { targetId := ?uid };
    };

    let tid = switch (targetId) {
      case null {
        return #err({ code = "NOT_FOUND"; message = "Employee not found: " # employeeId });
      };
      case (?id) id;
    };

    let target = switch (users.get(tid)) {
      case null {
        return #err({ code = "NOT_FOUND"; message = "Employee record missing: " # employeeId });
      };
      case (?u) u;
    };

    // ── HRManager may not delete an Admin account ────────────────────────────
    if (callerRole == #HRManager and target.role == #Admin) {
      return #err({
        code    = "FORBIDDEN";
        message = "HR cannot delete an Admin-level account";
      });
    };

    // ── Self-deletion guard ──────────────────────────────────────────────────
    if (tid == callerId) {
      return #err({
        code    = "FORBIDDEN";
        message = "Cannot delete your own account";
      });
    };

    // ── Archive: remove from users map and username index ────────────────────
    let empName = target.name;
    users.remove(tid);
    usernameIndex.remove(target.username);

    #ok({
      employeeId = employeeId;
      archivedAt = now;
    })
  };
};
