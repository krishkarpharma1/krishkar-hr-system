import AuthLib  "../lib/auth-users";
import DelLib   "../lib/employee-delete";
import AuthTypes "../types/auth-users";
import EDTypes   "../types/employee-delete";
import EmpIdLib  "../lib/employee-id";
import LocTypes  "../types/location-master";
import Map  "mo:core/Map";
import List "mo:core/List";
import Time "mo:core/Time";

/// Public API mixin for employee deletion and deletion audit log.
mixin (
  users           : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
  usernameIndex   : Map.Map<Text, AuthTypes.UserId>,
  sessions        : Map.Map<Text, AuthTypes.Session>,
  deletionLog     : List.List<EDTypes.EmployeeDeletionAuditEntry>,
) {

  /// Delete an employee by their employee ID (e.g. "KP-2024-001").
  /// Caller must have an active Admin or HRManager session.
  /// HRManager may not delete an Admin account.
  public func deleteEmployee(
    sessionToken : Text,
    employeeId   : Text,
  ) : async EDTypes.EmployeeDeletionResult {
    let now = Time.now();
    switch (AuthLib.validateSession(sessions, sessionToken, now)) {
      case null { #err({ code = "UNAUTHORIZED"; message = "Invalid or expired session" }) };
      case (?session) {
        // Find employee name before deletion for audit trail
        var empName : Text = "";
        for ((_, u) in users.entries()) {
          if (u.employeeId == employeeId) { empName := u.name };
        };

        let result = DelLib.deleteEmployee(
          users, usernameIndex,
          employeeId, session.role, session.userId,
          now,
        );

        switch (result) {
          case (#ok(ok)) {
            // Record deletion in audit log
            deletionLog.add({
              deletedEmployeeId   = employeeId;
              deletedEmployeeName = empName;
              deletedByUserId     = session.userId.toText();
              deletedAt           = now;
              dataArchivedSummary = "Employee removed from active users. Username index entry removed.";
            });
          };
          case (#err _) {};
        };
        result
      };
    }
  };

  /// Retrieve the deletion audit log.
  /// Caller must have an active Admin or HRManager session.
  public query func getDeletedEmployeesLog(
    sessionToken : Text,
  ) : async { #ok : [EDTypes.EmployeeDeletionAuditEntry]; #err : Text } {
    switch (AuthLib.peekSession(sessions, sessionToken, Time.now())) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        switch (session.role) {
          case (#Admin or #HRManager) {
            #ok(deletionLog.toArray())
          };
          case _ { #err("Admin or HR role required") };
        }
      };
    }
  };
};
