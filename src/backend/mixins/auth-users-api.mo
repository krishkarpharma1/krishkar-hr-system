import Types "../types/auth-users";
import LocTypes "../types/location-master";
import Lib "../lib/auth-users";
import EmpIdLib "../lib/employee-id";
import Map "mo:core/Map";
import List "mo:core/List";
import Time "mo:core/Time";

/// Public API mixin for authentication and user management.
/// Receives all state slices it needs as mixin parameters.
mixin (
  users           : Map.Map<Types.UserId, Types.UserRecord>,
  usernameIndex   : Map.Map<Text, Types.UserId>,
  sessions        : Map.Map<Text, Types.Session>,
  locations       : Map.Map<Types.UserId, Types.LocationRecord>,
  nextUserId      : { var value : Nat },
  empIdCounters   : Map.Map<Text, EmpIdLib.EmpIdCounter>,
  empIdConfigs    : Map.Map<Text, EmpIdLib.EmpIdConfig>,
  uidConfig       : EmpIdLib.UidConfig,
  hqs             : Map.Map<LocTypes.LocationId, LocTypes.HQRecord>,
  areas           : Map.Map<LocTypes.LocationId, LocTypes.AreaRecord>,
  stations        : Map.Map<LocTypes.LocationId, LocTypes.StationRecord>,
  reactivationLog : List.List<Types.ReactivationLogEntry>,
  userDobMap      : Map.Map<Text, Text>,
) {

  // ── Auth endpoints ─────────────────────────────────────────────────────────

  /// Login with username + password. Returns a session on success.
  public func login(username : Text, password : Text) : async Types.LoginResult {
    Lib.login(users, usernameIndex, sessions, username, password, Time.now())
  };

  /// Validate a session token. Returns session info or null.
  public query func whoami(token : Text) : async ?Types.Session {
    Lib.peekSession(sessions, token, Time.now())
  };

  /// Logout and invalidate the session token.
  public func logout(token : Text) : async () {
    Lib.logout(sessions, token)
  };

  // ── User management (Admin / HRManager) ───────────────────────────────────

  /// Create a new user account. Caller must be Admin or HRManager.
  public func createUser(token : Text, input : Types.CreateUserInput) : async Types.MutationResult {
    let now = Time.now();
    switch (Lib.validateSession(sessions, token, now)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        switch (session.role) {
          case (#Admin or #HRManager) {
            let id = nextUserId.value;
            let result = Lib.createUser(users, usernameIndex, uidConfig, userDobMap, id, input, now);
            switch (result) {
              case (#ok) { nextUserId.value += 1 };
              case (#err _) {};
            };
            result
          };
          case _ { #err("Unauthorized: Admin or HRManager role required") };
        }
      };
    }
  };

  /// Update an existing user. Caller must be Admin or HRManager.
  public func updateUser(token : Text, userId : Types.UserId, input : Types.UpdateUserInput) : async Types.MutationResult {
    let now = Time.now();
    switch (Lib.validateSession(sessions, token, now)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        switch (session.role) {
          case (#Admin or #HRManager) {
            Lib.updateUser(users, userDobMap, userId, input)
          };
          case _ { #err("Unauthorized: Admin or HRManager role required") };
        }
      };
    }
  };

  /// Deactivate a user account. Caller must be Admin.
  public func deactivateUser(token : Text, userId : Types.UserId) : async Types.MutationResult {
    switch (Lib.validateSession(sessions, token, Time.now())) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        switch (session.role) {
          case (#Admin) { Lib.deactivateUser(users, userId) };
          case _ { #err("Unauthorized: Admin role required") };
        }
      };
    }
  };

  /// Reactivate an inactive user account. Caller must be Admin or HRManager.
  public func reactivateUser(token : Text, userId : Types.UserId) : async Types.MutationResult {
    let now = Time.now();
    switch (Lib.validateSession(sessions, token, now)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        switch (session.role) {
          case (#Admin or #HRManager) {
            Lib.reactivateUser(users, reactivationLog, userId, session.userId, session.name, now)
          };
          case _ { #err("Unauthorized: Admin or HRManager role required") };
        }
      };
    }
  };

  /// Return all users with status = #Inactive. Admin and HRManager only.
  public query func getInactiveUsers(token : Text) : async [Types.UserInfo] {
    switch (Lib.peekSession(sessions, token, Time.now())) {
      case null { [] };
      case (?session) {
        switch (session.role) {
          case (#Admin or #HRManager) { Lib.getInactiveUsers(users, userDobMap) };
          case _ { [] };
        }
      };
    }
  };

  /// Return the full reactivation log. Admin and HRManager only.
  public query func getReactivationLog(token : Text) : async [Types.ReactivationLogEntry] {
    switch (Lib.peekSession(sessions, token, Time.now())) {
      case null { [] };
      case (?session) {
        switch (session.role) {
          case (#Admin or #HRManager) { Lib.getReactivationLog(reactivationLog) };
          case _ { [] };
        }
      };
    }
  };

  // ── User queries ───────────────────────────────────────────────────────────

  /// Get a single user's profile. Caller must be authenticated.
  public query func getUser(token : Text, userId : Types.UserId) : async ?Types.UserInfo {
    switch (Lib.peekSession(sessions, token, Time.now())) {
      case null  { null };
      case (?_)  { Lib.getUser(users, userDobMap, userId) };
    }
  };

  /// List all users. Admin and HRManager only.
  public query func listAllUsers(token : Text) : async [Types.UserInfo] {
    switch (Lib.peekSession(sessions, token, Time.now())) {
      case null { [] };
      case (?session) {
        switch (session.role) {
          case (#Admin or #HRManager) { Lib.listAll(users, userDobMap) };
          case _ { [] };
        }
      };
    }
  };

  /// List users by role. Admin and HRManager only.
  public query func listUsersByRole(token : Text, role : Types.Role) : async [Types.UserInfo] {
    switch (Lib.peekSession(sessions, token, Time.now())) {
      case null { [] };
      case (?session) {
        switch (session.role) {
          case (#Admin or #HRManager) { Lib.listByRole(users, userDobMap, role) };
          case _ { [] };
        }
      };
    }
  };

  /// List direct reportees of the given manager.
  public query func listReportees(token : Text, managerId : Types.UserId) : async [Types.UserInfo] {
    switch (Lib.peekSession(sessions, token, Time.now())) {
      case null { [] };
      case (?_) { Lib.listByManager(users, userDobMap, managerId) };
    }
  };

  /// List users in a given territory.
  public query func listUsersByTerritory(token : Text, territory : Text) : async [Types.UserInfo] {
    switch (Lib.peekSession(sessions, token, Time.now())) {
      case null { [] };
      case (?session) {
        switch (session.role) {
          case (#Admin or #HRManager or #ZSM or #RSM or #ASM) {
            Lib.listByTerritory(users, userDobMap, territory)
          };
          case _ { [] };
        }
      };
    }
  };

  // ── Location allotment queries ─────────────────────────────────────────────

  /// Get location allotment for a specific user. Admin/HRManager or the user themselves.
  public query func getUserLocationAllotment(
    token  : Text,
    userId : Types.UserId,
  ) : async ?Types.UserLocationAllotment {
    switch (Lib.peekSession(sessions, token, Time.now())) {
      case null { null };
      case (?session) {
        switch (session.role) {
          case (#Admin or #HRManager) {
            Lib.getUserLocationAllotment(users, userId)
          };
          case _ {
            if (session.userId == userId) Lib.getUserLocationAllotment(users, userId)
            else null
          };
        }
      };
    }
  };

  /// List all users with their location allotments. Admin and HRManager only.
  public query func listUsersWithAllotments(token : Text) : async [Types.UserLocationAllotment] {
    switch (Lib.peekSession(sessions, token, Time.now())) {
      case null { [] };
      case (?session) {
        switch (session.role) {
          case (#Admin or #HRManager) {
            Lib.listUsersWithAllotments(users)
          };
          case _ { [] };
        }
      };
    }
  };

  // ── GPS / Location ─────────────────────────────────────────────────────────

  /// Submit the caller's current GPS location. Caller must be authenticated field staff.
  public func submitLocation(token : Text, lat : Float, lng : Float) : async Types.MutationResult {
    let now = Time.now();
    switch (Lib.validateSession(sessions, token, now)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        let record : Types.LocationRecord = {
          userId     = session.userId;
          employeeId = session.employeeId;
          lat        = lat;
          lng        = lng;
          timestamp  = now;
        };
        Lib.submitLocation(locations, record);
        #ok
      };
    }
  };

  /// Get the latest GPS location for a specific employee.
  public query func getLocation(token : Text, userId : Types.UserId) : async ?Types.LocationRecord {
    switch (Lib.peekSession(sessions, token, Time.now())) {
      case null  { null };
      case (?session) {
        switch (session.role) {
          case (#Admin or #ZSM or #RSM or #ASM or #HRManager) {
            Lib.getLocation(locations, userId)
          };
          case _ {
            if (session.userId == userId) Lib.getLocation(locations, userId)
            else null
          };
        }
      };
    }
  };

  /// Get latest locations of all direct/indirect reportees. For ASM/RSM/ZSM/Admin.
  public query func getReporteeLocations(token : Text) : async [Types.LocationRecord] {
    switch (Lib.peekSession(sessions, token, Time.now())) {
      case null { [] };
      case (?session) {
        switch (session.role) {
          case (#Admin or #ZSM or #RSM or #ASM) {
            Lib.getReporteeLocations(users, locations, session.userId)
          };
          case _ { [] };
        }
      };
    }
  };

  /// Get all employee locations. Admin and ZSM only.
  public query func getAllLocations(token : Text) : async [Types.LocationRecord] {
    switch (Lib.peekSession(sessions, token, Time.now())) {
      case null { [] };
      case (?session) {
        switch (session.role) {
          case (#Admin or #ZSM) { Lib.getAllLocations(locations) };
          case _ { [] };
        }
      };
    }
  };

  // ── Password reset ─────────────────────────────────────────────────────────

  /// Reset another user's password to a random temporary password.
  public func resetUserPassword(token : Text, userId : Types.UserId) : async Types.PasswordResetResult {
    let now = Time.now();
    switch (Lib.validateSession(sessions, token, now)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        switch (session.role) {
          case (#Admin or #HRManager) {
            Lib.resetUserPassword(users, userId, now)
          };
          case _ { #err("Unauthorized: Admin or HRManager role required") };
        }
      };
    }
  };

  /// Reset the Admin account credentials: username = "admin", password = "Admin@1234".
  public func seedAdminPassword(token : Text) : async Types.MutationResult {
    switch (Lib.validateSession(sessions, token, Time.now())) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        switch (session.role) {
          case (#Admin) { Lib.seedAdminPassword(users, usernameIndex) };
          case _ { #err("Unauthorized: Admin role required") };
        }
      };
    }
  };

  /// No-auth Admin seed: resets the Admin account to username="admin", password="Admin@1234".
  public func adminSeed() : async Types.MutationResult {
    Lib.seedAdminPassword(users, usernameIndex)
  };

  // ── HQ Hierarchy ──────────────────────────────────────────────────────────

  /// Return all employees the caller is authorised to see, with per-HQ blocks
  /// and resolved names, for the HQ-wise Employee Hierarchy screen.
  /// Scope: Admin/HR → all; ZSM/RSM/ASM → all transitive reportees; MR → self only.
  public query func listEmployeesForHqHierarchy(token : Text) : async [Types.HqHierarchyEmployee] {
    Lib.listEmployeesForHqHierarchy(users, sessions, hqs, areas, stations, token, Time.now())
  };

  /// Return the full upward reporting chain for a given employee (employee → … → root).
  /// Each entry contains userId, name, and role as text.
  public query func getEmployeeReportingChain(token : Text, userId : Types.UserId) : async [Types.ReportingChainEntry] {
    Lib.getEmployeeReportingChain(users, sessions, token, userId, Time.now())
  };

  /// Return all employees whose role is not in the valid six-role hierarchy.
  /// Used by Admin portal to show warning banners for employees with invalid roles.
  /// Admin and HRManager only.
  public query func getInvalidRoleEmployees(token : Text) : async [{ id : Types.UserId; employeeId : Text; name : Text; rawRole : Text }] {
    switch (Lib.peekSession(sessions, token, Time.now())) {
      case null { [] };
      case (?session) {
        switch (session.role) {
          case (#Admin or #HRManager) { Lib.getInvalidRoleEmployees(users) };
          case _ { [] };
        }
      };
    }
  };
};
