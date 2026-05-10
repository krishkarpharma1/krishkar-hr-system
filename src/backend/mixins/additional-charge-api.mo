import Types    "../types/additional-charge";
import AuthTypes "../types/auth-users";
import CommonTypes "../types/common";
import AuthLib   "../lib/auth-users";
import Lib       "../lib/additional-charge";
import Map       "mo:core/Map";
import List      "mo:core/List";
import Time      "mo:core/Time";
import Runtime   "mo:core/Runtime";
import NotifTypes "../types/notifications";

/// Public API mixin for the Additional Charge feature.
/// Allows Admin/HR to assign employees extra roles or areas with effective dates.
mixin (
  sessions        : Map.Map<Text, AuthTypes.Session>,
  users           : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
  charges         : List.List<Types.AdditionalCharge>,
  nextChargeIdRef : { var value : Nat },
  notifications   : Map.Map<Text, NotifTypes.NotificationRecord>,
  rsmMrNotifIdRef : { var value : Nat },
) {

  func acIsAdminOrHR(role : AuthTypes.Role) : Bool {
    switch (role) {
      case (#Admin or #HRManager) { true };
      case _ { false };
    }
  };

  func isManagerOf(callerId : AuthTypes.UserId, employeeId : AuthTypes.UserId) : Bool {
    // Walk reportsTo chain of employeeId to see if callerId appears
    var current : ?AuthTypes.UserId = switch (users.get(employeeId)) {
      case (?u) { u.reportsTo };
      case null { null };
    };
    var depth = 0;
    label walk loop {
      if (depth > 10) break walk;
      switch (current) {
        case null { break walk };
        case (?mid) {
          if (mid == callerId) return true;
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

  /// Assign an additional charge (role or area) to an employee (Admin/HR only).
  public shared func assignAdditionalCharge(
    token : Text,
    input : Types.AssignAdditionalChargeInput,
  ) : async { #ok : Types.AdditionalCharge; #err : Text } {
    switch (AuthLib.validateSession(sessions, token, Time.now())) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        if (not acIsAdminOrHR(session.role)) {
          return #err("Access denied: Admin or HR required");
        };
        // Validate that target employee exists
        switch (users.get(input.employeeId)) {
          case null { return #err("Employee not found") };
          case (?_) {};
        };
        // Validate charge type fields
        switch (input.chargeType) {
          case (#Role) {
            switch (input.additionalRole) {
              case null { return #err("additionalRole is required for a Role charge") };
              case (?_) {};
            };
            // HQ+Area are optional for a Role charge — if one is set, both must be set
            switch (input.additionalHqId, input.additionalAreaId) {
              case (?_, null) { return #err("additionalAreaId is required when additionalHqId is set") };
              case (null, ?_) { return #err("additionalHqId is required when additionalAreaId is set") };
              case _ {};
            };
          };
          case (#Area) {
            switch (input.additionalHqId) {
              case null { return #err("additionalHqId is required for an Area charge") };
              case (?_) {};
            };
            switch (input.additionalAreaId) {
              case null { return #err("additionalAreaId is required for an Area charge") };
              case (?_) {};
            };
          };
        };
        let charge = Lib.assignCharge(
          charges, input, session.userId, Time.now(), nextChargeIdRef
        );
        #ok(charge)
      };
    }
  };

  /// Edit the effective dates or remarks of an existing charge (Admin/HR only).
  public shared func updateAdditionalCharge(
    token : Text,
    input : Types.UpdateAdditionalChargeInput,
  ) : async CommonTypes.MutationResult {
    switch (AuthLib.validateSession(sessions, token, Time.now())) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        if (not acIsAdminOrHR(session.role)) {
          return #err("Access denied: Admin or HR required");
        };
        if (Lib.updateCharge(charges, input, Time.now())) {
          #ok
        } else {
          #err("Additional charge not found")
        }
      };
    }
  };

  /// Remove an additional charge (Admin/HR only).
  public shared func removeAdditionalCharge(
    token    : Text,
    chargeId : Text,
  ) : async CommonTypes.MutationResult {
    switch (AuthLib.validateSession(sessions, token, Time.now())) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        if (not acIsAdminOrHR(session.role)) {
          return #err("Access denied: Admin or HR required");
        };
        if (Lib.removeCharge(charges, chargeId)) {
          #ok
        } else {
          #err("Additional charge not found")
        }
      };
    }
  };

  /// Get all currently active charges for a specific employee.
  /// Accessible by the employee themselves, their manager, Admin, or HR.
  public shared func getActiveChargesForEmployee(
    token      : Text,
    employeeId : AuthTypes.UserId,
  ) : async [Types.AdditionalCharge] {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { [] };
      case (?session) {
        let allowed = acIsAdminOrHR(session.role) or
                      session.userId == employeeId or
                      isManagerOf(session.userId, employeeId);
        if (not allowed) return [];
        Lib.getActiveChargesForEmployee(charges, employeeId, Time.now())
      };
    }
  };

  /// Get all charges (active + expired + pending) for a specific employee.
  /// Accessible by the employee themselves, their manager, Admin, or HR.
  public shared func getAllChargesForEmployee(
    token      : Text,
    employeeId : AuthTypes.UserId,
  ) : async [Types.AdditionalCharge] {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { [] };
      case (?session) {
        let allowed = acIsAdminOrHR(session.role) or
                      session.userId == employeeId or
                      isManagerOf(session.userId, employeeId);
        if (not allowed) return [];
        Lib.getAllChargesForEmployee(charges, employeeId)
      };
    }
  };

  /// List all additional charges across the organisation with optional filters (Admin/HR only).
  public shared func listAllAdditionalCharges(
    token  : Text,
    filter : Types.AdditionalChargeFilter,
  ) : async [Types.AdditionalCharge] {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { [] };
      case (?session) {
        if (not acIsAdminOrHR(session.role)) { return [] };
        Lib.listAllCharges(charges, filter, Time.now())
      };
    }
  };

  /// Get all charges that are expiring within the next N days (Admin/HR alert feed).
  public shared func getExpiringCharges(
    token     : Text,
    daysAhead : Nat,
  ) : async [Types.AdditionalCharge] {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { [] };
      case (?session) {
        if (not acIsAdminOrHR(session.role)) { return [] };
        Lib.getExpiringCharges(charges, Time.now(), daysAhead)
      };
    }
  };

  /// Get the list of additional {hqId, areaId} pairs currently active for an employee.
  /// Includes areas from both #Area charges AND #Role charges that have an area set.
  /// Used when the employee submits field reports to allow selection from additional areas.
  public shared func getActiveAdditionalAreas(
    token      : Text,
    employeeId : AuthTypes.UserId,
  ) : async [Types.AdditionalAreaInfo] {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { [] };
      case (?session) {
        let allowed = acIsAdminOrHR(session.role) or
                      session.userId == employeeId or
                      isManagerOf(session.userId, employeeId);
        if (not allowed) return [];
        Lib.getActiveAdditionalAreas(charges, employeeId, Time.now())
      };
    }
  };

  /// Returns the first active additional (hqId, areaId) for an employee regardless of
  /// charge type — returns null if no active charge carries an area assignment.
  /// Useful for single-area lookups (e.g. checking if a Role charge also grants area access).
  public shared func getActiveChargeAreaForEmployee(
    token      : Text,
    employeeId : AuthTypes.UserId,
  ) : async ?(Nat, Nat) {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { null };
      case (?session) {
        let allowed = acIsAdminOrHR(session.role) or
                      session.userId == employeeId or
                      isManagerOf(session.userId, employeeId);
        if (not allowed) return null;
        Lib.getActiveChargeArea(charges, employeeId, Time.now())
      };
    }
  };

  /// Get the effective roles for an employee (primary + active additional roles).
  /// Used by other domains to check access permissions.
  public shared func getEffectiveRoles(
    token      : Text,
    employeeId : AuthTypes.UserId,
  ) : async [AuthTypes.Role] {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { [] };
      case (?session) {
        let allowed = acIsAdminOrHR(session.role) or
                      session.userId == employeeId or
                      isManagerOf(session.userId, employeeId);
        if (not allowed) return [];
        let primaryRole : AuthTypes.Role = switch (users.get(employeeId)) {
          case (?u) { u.role };
          case null { return [] };
        };
        Lib.effectiveRoles(charges, employeeId, primaryRole, Time.now())
      };
    }
  };
};
