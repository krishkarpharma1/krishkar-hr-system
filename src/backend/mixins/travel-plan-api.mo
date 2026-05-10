import TravelPlanLib  "../lib/travel-plan";
import AuthLib        "../lib/auth-users";
import Types          "../types/travel-plan";
import AuthTypes      "../types/auth-users";
import LocTypes       "../types/location-master";
import ExportTypes    "../types/exports";
import Map            "mo:core/Map";
import List           "mo:core/List";
import Time           "mo:core/Time";
import Runtime        "mo:core/Runtime";

mixin (
  sessions          : Map.Map<Text, AuthTypes.Session>,
  users             : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
  travelPlans       : List.List<Types.TravelPlanRecord>,
  roleHierarchyConf : { var value : Types.RoleHierarchyConfig },
  nextTravelPlanId  : { var val : Nat },
  stations          : Map.Map<LocTypes.LocationId, LocTypes.StationRecord>,
  areas             : Map.Map<LocTypes.LocationId, LocTypes.AreaRecord>,
  hqs               : Map.Map<LocTypes.LocationId, LocTypes.HQRecord>,
) {

  // ── Helpers ──────────────────────────────────────────────────────────────

  private func requireSessionTP(token : Text) : ?AuthTypes.Session {
    AuthLib.validateSession(sessions, token, Time.now())
  };

  private func peekSessionTP(token : Text) : ?AuthTypes.Session {
    AuthLib.peekSession(sessions, token, Time.now())
  };

  private func isManagerOrAbove(role : Types.Role) : Bool {
    switch (role) {
      case (#ASM or #RSM or #ZSM or #HRManager or #Admin) { true };
      case _ { false };
    }
  };

  // ── Public API ────────────────────────────────────────────────────────────

  /// Create a new travel plan for the current user
  public shared ({ caller = _ }) func createTravelPlan(
    token : Text,
    input : Types.CreateTravelPlanInput,
  ) : async { #ok : Types.TravelPlanId; #err : Text } {
    switch (requireSessionTP(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        let id = TravelPlanLib.createTravelPlan(
          travelPlans, session.userId, input, nextTravelPlanId, Time.now()
        );
        #ok(id)
      };
    }
  };

  /// Update an existing travel plan (Draft only, owner only)
  public shared ({ caller = _ }) func updateTravelPlan(
    token : Text,
    id    : Types.TravelPlanId,
    input : Types.CreateTravelPlanInput,
  ) : async Types.MutationResult {
    switch (requireSessionTP(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        TravelPlanLib.updateTravelPlan(travelPlans, id, session.userId, input, Time.now())
      };
    }
  };

  /// Submit a travel plan (Draft -> Submitted, owner only)
  public shared ({ caller = _ }) func submitTravelPlan(
    token : Text,
    id    : Types.TravelPlanId,
  ) : async Types.MutationResult {
    switch (requireSessionTP(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        TravelPlanLib.submitTravelPlan(travelPlans, id, session.userId, Time.now())
      };
    }
  };

  /// Get a travel plan by ID (authenticated)
  public query func getTravelPlan(
    token : Text,
    id    : Types.TravelPlanId,
  ) : async ?Types.TravelPlanInfo {
    switch (peekSessionTP(token)) {
      case null  { null };
      case (?_)  { TravelPlanLib.getTravelPlan(travelPlans, id) };
    }
  };

  /// List own travel plans, optionally filtered by month "YYYY-MM"
  public query func listMyTravelPlans(
    token : Text,
    month : ?Text,
  ) : async [Types.TravelPlanInfo] {
    switch (peekSessionTP(token)) {
      case null        { [] };
      case (?session)  {
        TravelPlanLib.listMyTravelPlans(travelPlans, session.userId, month)
      };
    }
  };

  /// List all employees' travel plans (ASM and above / HR / Admin only)
  public query func listAllTravelPlans(
    token  : Text,
    userId : ?Nat,
    month  : ?Text,
  ) : async [Types.TravelPlanInfo] {
    switch (peekSessionTP(token)) {
      case null { [] };
      case (?session) {
        if (not isManagerOrAbove(session.role)) { return [] };
        TravelPlanLib.listAllTravelPlans(travelPlans, userId, month)
      };
    }
  };

  /// Get the planned station for the calling user on a given date
  public query func getMyStationForDate(
    token : Text,
    date  : Text,
  ) : async ?Text {
    switch (peekSessionTP(token)) {
      case null        { null };
      case (?session)  {
        TravelPlanLib.getStationForDate(travelPlans, session.userId, date)
      };
    }
  };

  /// Get the current role hierarchy configuration (any authenticated user)
  public query func getRoleHierarchyConfig(
    token : Text,
  ) : async Types.RoleHierarchyConfig {
    switch (peekSessionTP(token)) {
      case null    { TravelPlanLib.getRoleHierarchyConfig(roleHierarchyConf) };
      case (?_)    { TravelPlanLib.getRoleHierarchyConfig(roleHierarchyConf) };
    }
  };

  /// Update the role hierarchy config (Admin only)
  public shared ({ caller = _ }) func setRoleHierarchyConfig(
    token     : Text,
    roleOrder : [Types.Role],
  ) : async Types.MutationResult {
    switch (requireSessionTP(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        switch (session.role) {
          case (#Admin) {
            TravelPlanLib.setRoleHierarchyConfig(roleHierarchyConf, roleOrder)
          };
          case _ { #err("Unauthorized: Admin role required") };
        }
      };
    }
  };

  /// Return the list of users who have a higher role than the calling user.
  public query func getHigherAuthoritiesForMe(
    token : Text,
  ) : async [{ userId : Nat; userName : Text; role : Types.Role }] {
    switch (peekSessionTP(token)) {
      case null { [] };
      case (?session) {
        let higherRoles = TravelPlanLib.getHigherAuthorities(
          roleHierarchyConf.value, session.role
        );
        let result = List.empty<{ userId : Nat; userName : Text; role : Types.Role }>();
        for ((_, user) in users.entries()) {
          if (user.status == #Active) {
            let isHigher = switch (higherRoles.find(func(r : Types.Role) : Bool { r == user.role })) {
              case null  { false };
              case (?_)  { true };
            };
            if (isHigher) {
              result.add({
                userId   = user.id;
                userName = user.name;
                role     = user.role;
              });
            };
          };
        };
        result.toArray()
      };
    }
  };

  // ── MTP vs Actual Report ───────────────────────────────────────────────────

  public query func getMtpVsActualData(
    token : Text,
    mrId  : Nat,
    month : Nat,
    year  : Nat,
  ) : async [(Text, Text, Text)] {
    switch (peekSessionTP(token)) {
      case null { [] };
      case (?_) {
        TravelPlanLib.getMtpSummaryForReport(travelPlans, mrId, month, year)
      };
    }
  };

  // ── Export: Travel Plans ───────────────────────────────────────────────────

  public query func exportTravelPlans(
    token  : Text,
    filter : ExportTypes.ExportFilter,
  ) : async [ExportTypes.TravelPlanExportRow] {
    Runtime.trap("not implemented");
  };
};
