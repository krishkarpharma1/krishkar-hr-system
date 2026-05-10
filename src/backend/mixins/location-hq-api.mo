import Types "../types/location-hq";
import AuthTypes "../types/auth-users";
import LocTypes "../types/location-master";
import Lib "../lib/location-hq";
import AuthLib "../lib/auth-users";
import Map "mo:core/Map";
import Time "mo:core/Time";

/// Public API mixin for Location HQ domain.
/// Provides role-level HQ binding, validation, hierarchy queries, and scoping helpers.
mixin (
  sessions    : Map.Map<Text, AuthTypes.Session>,
  users       : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
  zones       : Map.Map<Types.LocationId, LocTypes.ZoneRecord>,
  states      : Map.Map<Types.LocationId, LocTypes.StateRecord>,
  territories : Map.Map<Types.LocationId, LocTypes.TerritoryRecord>,
  hqs         : Map.Map<Types.LocationId, LocTypes.HQRecord>,
  areas       : Map.Map<Types.LocationId, LocTypes.AreaRecord>,
  stations    : Map.Map<Types.LocationId, LocTypes.StationRecord>,
) {

  // ── Auth helpers ──────────────────────────────────────────────────────────

  private func lhq_isAuthenticated(token : Text) : Bool {
    switch (sessions.get(token)) {
      case null { false };
      case (?_) { true };
    }
  };

  private func lhq_isAdminOrHR(token : Text) : Bool {
    switch (sessions.get(token)) {
      case null { false };
      case (?s) { s.role == #Admin or s.role == #HRManager };
    }
  };

  // ── Role → level queries ──────────────────────────────────────────────────

  /// Return all active locations at the level appropriate for the given role.
  /// E.g. getLocationsForRole(token, #MR) returns all active Stations.
  public query func getLocationsForRole(token : Text, role : Types.Role) : async [Types.PrimaryHqInfo] {
    if (not lhq_isAuthenticated(token)) { return [] };
    Lib.getLocationsForRole(role, zones, states, areas, stations)
  };

  /// Return all active locations at a specific level.
  /// Useful for Admin/HR dropdowns.
  public query func getLocationsByLevel(token : Text, level : Types.LocationLevel) : async [Types.PrimaryHqInfo] {
    if (not lhq_isAuthenticated(token)) { return [] };
    Lib.getLocationsByLevel(level, zones, states, areas, stations)
  };

  // ── Hierarchy query ───────────────────────────────────────────────────────

  /// Return the full hierarchy path (Zone → Region → Area → Station) for any location ID.
  public query func getLocationHierarchy(token : Text, locationId : Types.LocationId) : async ?Types.LocationHierarchyPath {
    if (not lhq_isAuthenticated(token)) { return null };
    Lib.getLocationHierarchy(locationId, zones, states, territories, hqs, areas, stations)
  };

  // ── Employees by HQ ───────────────────────────────────────────────────────

  /// Return all employees whose primaryHqId matches the given hqId.
  /// Multiple employees sharing the same HQ (combined HQ) are all returned.
  public query func getEmployeesByHq(token : Text, hqId : Types.LocationId) : async [Types.UserWithPrimaryHq] {
    if (not lhq_isAuthenticated(token)) { return [] };
    Lib.getEmployeesByHq(users, hqId, zones, states, areas, stations)
  };

  // ── Subordinates in hierarchy ─────────────────────────────────────────────

  /// Return IDs of all employees within a manager's location hierarchy scope.
  /// Complements the reporting-manager chain with HQ-based location scoping.
  public query func getSubordinatesInHierarchy(token : Text, managerId : AuthTypes.UserId) : async [AuthTypes.UserId] {
    if (not lhq_isAuthenticated(token)) { return [] };
    Lib.getSubordinatesInHierarchy(users, managerId, zones, states, territories, hqs, areas, stations)
  };

  // ── Invalid HQ employees ──────────────────────────────────────────────────

  /// Return employees whose primaryHqId does not match the expected level for their role.
  /// Admin/HR only — for review and correction.
  public query func getInvalidHqEmployees(token : Text) : async [Types.InvalidHqEmployee] {
    if (not lhq_isAdminOrHR(token)) { return [] };
    Lib.getInvalidHqEmployees(users, zones, states, areas, stations)
  };

  // ── Set primary HQ ────────────────────────────────────────────────────────

  /// Set the primaryHqId for an employee, validated against their role's expected level.
  /// Admin and HR only. Combined HQ (multiple employees sharing one HQ) is allowed.
  public func setPrimaryHq(
    token    : Text,
    userId   : AuthTypes.UserId,
    hqId     : Types.LocationId,
  ) : async AuthTypes.MutationResult {
    if (not lhq_isAdminOrHR(token)) { return #err("Unauthorized: Admin or HR role required") };
    switch (users.get(userId)) {
      case null { return #err("Employee not found") };
      case (?u) {
        // Validate the HQ level matches the employee's role
        let validation = Lib.validatePrimaryHqForRole(u.role, hqId, zones, states, areas, stations);
        switch (validation) {
          case (#err(msg)) { return #err(msg) };
          case (#ok) {
            u.primaryHqId := ?hqId;
            #ok
          };
        };
      };
    }
  };

  /// Clear the primaryHqId for an employee (Admin and HR only).
  public func clearPrimaryHq(
    token  : Text,
    userId : AuthTypes.UserId,
  ) : async AuthTypes.MutationResult {
    if (not lhq_isAdminOrHR(token)) { return #err("Unauthorized: Admin or HR role required") };
    switch (users.get(userId)) {
      case null { return #err("Employee not found") };
      case (?u) {
        u.primaryHqId := null;
        #ok
      };
    }
  };

  // ── Validate HQ for role ──────────────────────────────────────────────────

  /// Validate that a given location is appropriate for a given role.
  /// Returns #ok if valid. Used by the employee creation/update form for live feedback.
  public query func validateHqForRole(
    token    : Text,
    role     : Types.Role,
    hqId     : Types.LocationId,
  ) : async { #ok; #err : Text } {
    if (not lhq_isAuthenticated(token)) { return #err("Unauthorized") };
    Lib.validatePrimaryHqForRole(role, hqId, zones, states, areas, stations)
  };
};
