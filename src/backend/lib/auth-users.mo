import Types "../types/auth-users";
import LocTypes "../types/location-master";
import EmpIdLib "employee-id";
import Map "mo:core/Map";
import List "mo:core/List";
import Nat "mo:core/Nat";
import Char "mo:core/Char";

module {
  // ── Type aliases for brevity ──────────────────────────────────────────────
  public type UserId               = Types.UserId;
  public type UserRecord           = Types.UserRecord;
  public type UserInfo             = Types.UserInfo;
  public type UserLocationAllotment = Types.UserLocationAllotment;
  public type Session              = Types.Session;
  public type CreateUserInput      = Types.CreateUserInput;
  public type UpdateUserInput      = Types.UpdateUserInput;
  public type LocationRecord       = Types.LocationRecord;
  public type LoginResult          = Types.LoginResult;
  public type MutationResult       = Types.MutationResult;
  public type PasswordResetResult  = Types.PasswordResetResult;

  // ── Session duration: 8 hours in nanoseconds ─────────────────────────────
  let SESSION_TTL : Int = 28_800_000_000_000;

  // ── Password helpers ──────────────────────────────────────────────────────

  /// Simple deterministic hash — folds chars with a prime mixer.
  /// Not cryptographic but suitable for ICP where native SHA-256 is unavailable.
  public func hashPassword(plain : Text) : Text {
    var h : Nat = 5381;
    for (c in plain.toIter()) {
      let code : Nat = c.toNat32().toNat();
      h := (h * 33 + code) % 0xFFFF_FFFF_FFFF_FFFF;
    };
    h.toText()
  };

  /// Verify a plain-text password against a stored hash.
  public func verifyPassword(plain : Text, hash : Text) : Bool {
    hashPassword(plain) == hash
  };

  // ── Session helpers ───────────────────────────────────────────────────────

  /// Generate a pseudo-unique session token combining a hash with current time.
  public func generateToken(now : Int) : Text {
    var h : Nat = 0xDEAD_BEEF_CAFE;
    let seed = "kp_hr_salt_" # now.toText();
    for (c in seed.toIter()) {
      let code : Nat = c.toNat32().toNat();
      h := (h * 31 + code) % 0xFFFF_FFFF_FFFF_FFFF;
    };
    h.toText()
  };

  /// Build a Session record from a UserRecord.
  public func makeSession(user : UserRecord, token : Text, now : Int) : Session {
    {
      token      = token;
      userId     = user.id;
      role       = user.role;
      employeeId = user.employeeId;
      name       = user.name;
      expiresAt  = now + SESSION_TTL;
    }
  };

  // ── User conversions ──────────────────────────────────────────────────────

  /// Strip mutable fields and password hash to produce a shareable UserInfo.
  /// dobMap is the external Map<Text, Text> keyed by userId.toText() -> "YYYY-MM-DD".
  public func toUserInfo(user : UserRecord, dobMap : Map.Map<Text, Text>) : UserInfo {
    {
      id           = user.id;
      username     = user.username;
      role         = user.role;
      status       = user.status;
      employeeId   = user.employeeId;
      name         = user.name;
      email        = user.email;
      phone        = user.phone;
      designation  = user.designation;
      department   = user.department;
      territory    = user.territory;
      reportsTo    = user.reportsTo;
      joinDate     = user.joinDate;
      dateOfBirth  = dobMap.get(user.id.toText());
      salary       = user.salary;
      primaryHqId  = user.primaryHqId;
      zoneIds      = user.zoneIds;
      stateIds     = user.stateIds;
      territoryIds = user.territoryIds;
      hqIds        = user.hqIds;
      areaIds      = user.areaIds;
      hqAssignments = user.hqAssignments;
      migrationDone = user.migrationDone;
      createdAt    = user.createdAt;
    }
  };

  /// Build a UserLocationAllotment from a UserRecord.
  public func toLocationAllotment(user : UserRecord) : UserLocationAllotment {
    {
      userId       = user.id;
      employeeId   = user.employeeId;
      name         = user.name;
      role         = user.role;
      zoneIds      = user.zoneIds;
      stateIds     = user.stateIds;
      territoryIds = user.territoryIds;
      hqIds        = user.hqIds;
      areaIds      = user.areaIds;
      hqAssignments = user.hqAssignments;
    }
  };

  /// Return the per-HQ allotment blocks for a user (MR-focused).
  public func getHqAssignments(
    users  : Map.Map<UserId, UserRecord>,
    userId : UserId,
  ) : [Types.HqAssignment] {
    switch (users.get(userId)) {
      case null  { [] };
      case (?u)  { u.hqAssignments };
    }
  };

  // ── CRUD operations ───────────────────────────────────────────────────────

  /// Derive the current 4-digit year from a nanosecond timestamp.
  func yearFromNow(now : Int) : Nat {
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
    if (yr > 0) yr.toNat() else 2026
  };

  /// Create a new UserRecord and insert it into users + usernameIndex.
  /// Automatically assigns a new UID in [CompanyPrefix]-[Year]-[Seq] format
  /// if employeeId is empty, using the provided UidConfig.
  /// dobMap is the external dateOfBirth storage map (keyed by userId.toText()).
  public func createUser(
    users         : Map.Map<UserId, UserRecord>,
    usernameIndex : Map.Map<Text, UserId>,
    uidConfig     : EmpIdLib.UidConfig,
    dobMap        : Map.Map<Text, Text>,
    nextId        : Nat,
    input         : CreateUserInput,
    now           : Int,
  ) : MutationResult {
    switch (usernameIndex.get(input.username)) {
      case (?_) { return #err("Username already exists") };
      case null  {};
    };
    // Auto-generate UID if not provided — use new company-wide format
    let assignedEmpId = if (input.employeeId == "") {
      let year = yearFromNow(now);
      EmpIdLib.generateUID(uidConfig, year)
    } else {
      input.employeeId
    };
    let record : UserRecord = {
      id               = nextId;
      var username     = input.username;
      var passwordHash = hashPassword(input.password);
      var role         = input.role;
      var status       = #Active;
      var employeeId   = assignedEmpId;
      var name         = input.name;
      var email        = input.email;
      var phone        = input.phone;
      var designation  = input.designation;
      var department   = input.department;
      var territory    = input.territory;
     var reportsTo    = input.reportsTo;
      var joinDate     = input.joinDate;
      var salary       = input.salary;
      var primaryHqId  = input.primaryHqId;
      var zoneIds      = switch (input.zoneIds)      { case (?v) v; case null [] };
      var stateIds     = switch (input.stateIds)     { case (?v) v; case null [] };
      var territoryIds = switch (input.territoryIds) { case (?v) v; case null [] };
      var hqIds        = switch (input.hqIds)        { case (?v) v; case null [] };
      var areaIds      = switch (input.areaIds)      { case (?v) v; case null [] };
      var hqAssignments = switch (input.hqAssignments) { case (?v) v; case null [] };
      var migrationDone = switch (input.hqAssignments) { case (?_) true; case null false };
      createdAt        = now;
    };
    users.add(nextId, record);
    usernameIndex.add(input.username, nextId);
    // Store DOB in external map if provided
    switch (input.dateOfBirth) {
      case (?dob) { dobMap.add(nextId.toText(), dob) };
      case null {};
    };
    #ok
  };

  /// Update fields of an existing user. Returns #err if not found.
  /// dobMap is the external dateOfBirth storage map (keyed by userId.toText()).
  public func updateUser(
    users  : Map.Map<UserId, UserRecord>,
    dobMap : Map.Map<Text, Text>,
    userId : UserId,
    input  : UpdateUserInput,
  ) : MutationResult {
    switch (users.get(userId)) {
      case null { #err("User not found") };
      case (?user) {
        switch (input.name)        { case (?v) { user.name        := v }; case null {} };
        switch (input.email)       { case (?v) { user.email       := v }; case null {} };
        switch (input.phone)       { case (?v) { user.phone       := v }; case null {} };
        switch (input.designation) { case (?v) { user.designation := v }; case null {} };
        switch (input.department)  { case (?v) { user.department  := v }; case null {} };
        switch (input.territory)   { case (?v) { user.territory   := v }; case null {} };
        switch (input.joinDate)    { case (?v) { user.joinDate    := v }; case null {} };
        switch (input.dateOfBirth) { case (?v) { dobMap.add(userId.toText(), v) }; case null {} };
        switch (input.salary)      { case (?v) { user.salary      := v }; case null {} };
        switch (input.role)        { case (?v) { user.role        := v }; case null {} };
        switch (input.status)      { case (?v) { user.status      := v }; case null {} };
        switch (input.reportsTo)   { case (?v) { user.reportsTo   := v }; case null {} };
        switch (input.newPassword) { case (?p) { user.passwordHash := hashPassword(p) }; case null {} };
        switch (input.primaryHqId) { case (?v) { user.primaryHqId := ?v }; case null {} };
        switch (input.zoneIds)      { case (?v) { user.zoneIds      := v }; case null {} };
        switch (input.stateIds)     { case (?v) { user.stateIds     := v }; case null {} };
        switch (input.territoryIds) { case (?v) { user.territoryIds := v }; case null {} };
        switch (input.hqIds)        { case (?v) { user.hqIds        := v }; case null {} };
        switch (input.areaIds)      { case (?v) { user.areaIds      := v }; case null {} };
        switch (input.hqAssignments) { case (?v) { user.hqAssignments := v; user.migrationDone := true }; case null {} };
        #ok
      };
    }
  };

  /// Deactivate a user account (set status = #Inactive).
  public func deactivateUser(
    users  : Map.Map<UserId, UserRecord>,
    userId : UserId,
  ) : MutationResult {
    switch (users.get(userId)) {
      case null  { #err("User not found") };
      case (?user) {
        user.status := #Inactive;
        #ok
      };
    }
  };

  /// Reactivate a previously inactive user account.
  /// Sets status = #Active and checks whether critical settings (role, HQ) are present.
  /// Creates a reactivation log entry recording who performed the reactivation.
  public func reactivateUser(
    users            : Map.Map<UserId, UserRecord>,
    reactivationLog  : List.List<Types.ReactivationLogEntry>,
    userId           : UserId,
    reactivatedBy    : UserId,
    reactivatedByName : Text,
    now              : Int,
  ) : MutationResult {
    switch (users.get(userId)) {
      case null { #err("User not found: ID " # userId.toText()) };
      case (?user) {
        if (user.status == #Active) {
          return #err("User is already active");
        };
        user.status := #Active;
        // Check if critical settings are present; flag for review if not
        let needsReview = user.hqAssignments.size() == 0 or
                          (user.role != #Admin and user.role != #HRManager and
                           user.role != #ZSM and user.role != #RSM and
                           user.reportsTo == null);
        // Append reactivation log entry
        reactivationLog.add({
          employeeId        = userId;
          employeeName      = user.name;
          employeeCode      = user.employeeId;
          reactivatedAt     = now;
          reactivatedBy     = reactivatedBy;
          reactivatedByName = reactivatedByName;
          needsReview       = needsReview;
        });
        #ok
      };
    }
  };

  /// Return all users with status = #Inactive (for the Inactive Users tab).
  public func getInactiveUsers(
    users  : Map.Map<UserId, UserRecord>,
    dobMap : Map.Map<Text, Text>,
  ) : [UserInfo] {
    let result = List.empty<UserInfo>();
    for ((_, u) in users.entries()) {
      if (u.status == #Inactive) { result.add(toUserInfo(u, dobMap)) };
    };
    result.toArray()
  };

  /// Return all reactivation log entries. Admin/HR only.
  public func getReactivationLog(
    reactivationLog : List.List<Types.ReactivationLogEntry>,
  ) : [Types.ReactivationLogEntry] {
    reactivationLog.toArray()
  };

  // ── Query helpers ─────────────────────────────────────────────────────────

  /// Lookup a user by UserId; returns null if not found.
  public func getUser(
    users  : Map.Map<UserId, UserRecord>,
    dobMap : Map.Map<Text, Text>,
    userId : UserId,
  ) : ?UserInfo {
    switch (users.get(userId)) {
      case null  { null };
      case (?u)  { ?toUserInfo(u, dobMap) };
    }
  };

  /// Get the location allotment for a single user.
  public func getUserLocationAllotment(
    users  : Map.Map<UserId, UserRecord>,
    userId : UserId,
  ) : ?UserLocationAllotment {
    switch (users.get(userId)) {
      case null  { null };
      case (?u)  { ?toLocationAllotment(u) };
    }
  };

  /// Return location allotments for all users (Admin/HR view).
  public func listUsersWithAllotments(
    users : Map.Map<UserId, UserRecord>,
  ) : [UserLocationAllotment] {
    let result = List.empty<UserLocationAllotment>();
    for ((_, u) in users.entries()) {
      result.add(toLocationAllotment(u))
    };
    result.toArray()
  };

  /// Return all users matching a given role.
  public func listByRole(
    users  : Map.Map<UserId, UserRecord>,
    dobMap : Map.Map<Text, Text>,
    role   : Types.Role,
  ) : [UserInfo] {
    let result = List.empty<UserInfo>();
    for ((_, u) in users.entries()) {
      if (u.role == role) { result.add(toUserInfo(u, dobMap)) };
    };
    result.toArray()
  };

  /// Return all users whose reportsTo == managerId.
  public func listByManager(
    users     : Map.Map<UserId, UserRecord>,
    dobMap    : Map.Map<Text, Text>,
    managerId : UserId,
  ) : [UserInfo] {
    let result = List.empty<UserInfo>();
    for ((_, u) in users.entries()) {
      switch (u.reportsTo) {
        case (?mid) { if (mid == managerId) { result.add(toUserInfo(u, dobMap)) } };
        case null   {};
      }
    };
    result.toArray()
  };

  /// Return all users in a given territory.
  public func listByTerritory(
    users     : Map.Map<UserId, UserRecord>,
    dobMap    : Map.Map<Text, Text>,
    territory : Text,
  ) : [UserInfo] {
    let result = List.empty<UserInfo>();
    for ((_, u) in users.entries()) {
      if (u.territory == territory) { result.add(toUserInfo(u, dobMap)) };
    };
    result.toArray()
  };

  /// Map a Role variant to a numeric rank. MR=1, ASM=2, RSM=3, ZSM=4, HRManager=5, Admin=6.
  private func roleRank(role : Types.Role) : Nat {
    switch (role) {
      case (#MR)        { 1 };
      case (#ASM)       { 2 };
      case (#RSM)       { 3 };
      case (#ZSM)       { 4 };
      case (#HRManager) { 5 };
      case (#Admin)     { 6 };
    }
  };

  /// Return all active users whose role rank is strictly greater than the rank
  /// of `targetRole`. Used to populate the Reporting Manager dropdown in
  /// User Management (only show employees of higher rank).
  /// MR → rank≥2 (ASM/RSM/ZSM/HRManager/Admin)
  /// ASM → rank≥3 (RSM/ZSM/HRManager/Admin)
  /// RSM → rank≥4 (ZSM/HRManager/Admin)
  /// ZSM → rank≥5 (HRManager/Admin)
  /// HRManager/Admin → empty
  public func listUsersAboveRole(
    users      : Map.Map<UserId, UserRecord>,
    dobMap     : Map.Map<Text, Text>,
    targetRole : Types.Role,
  ) : [UserInfo] {
    let minRank = roleRank(targetRole) + 1;
    let result  = List.empty<UserInfo>();
    for ((_, u) in users.entries()) {
      if (u.status == #Active and roleRank(u.role) >= minRank) {
        result.add(toUserInfo(u, dobMap))
      };
    };
    result.toArray()
  };

  /// Return all users (admin view).
  public func listAll(users : Map.Map<UserId, UserRecord>, dobMap : Map.Map<Text, Text>) : [UserInfo] {
    let result = List.empty<UserInfo>();
    for ((_, u) in users.entries()) {
      result.add(toUserInfo(u, dobMap))
    };
    result.toArray()
  };

  // ── Authentication ────────────────────────────────────────────────────────

  /// Attempt login; on success creates a session token and inserts into sessions map.
  public func login(
    users         : Map.Map<UserId, UserRecord>,
    usernameIndex : Map.Map<Text, UserId>,
    sessions      : Map.Map<Text, Session>,
    username      : Text,
    password      : Text,
    now           : Int,
  ) : LoginResult {
    switch (usernameIndex.get(username)) {
      case null { #err("Invalid username or password") };
      case (?uid) {
        switch (users.get(uid)) {
          case null { #err("Invalid username or password") };
          case (?user) {
            if (user.status == #Inactive) {
              return #err("Account is inactive")
            };
            if (not verifyPassword(password, user.passwordHash)) {
              return #err("Invalid username or password")
            };
            let token   = generateToken(now) # "_" # uid.toText();
            let session = makeSession(user, token, now);
            sessions.add(token, session);
            #ok(session)
          };
        }
      };
    }
  };

  /// Validate an existing session token; returns the Session if valid.
  /// Removes expired tokens as a side effect (use only in update calls).
  public func validateSession(
    sessions : Map.Map<Text, Session>,
    token    : Text,
    now      : Int,
  ) : ?Session {
    switch (sessions.get(token)) {
      case null { null };
      case (?s) {
        if (now > s.expiresAt) {
          sessions.remove(token);
          null
        } else {
          ?s
        }
      };
    }
  };

  /// Read-only session check — safe to call from query functions (no mutation).
  public func peekSession(
    sessions : Map.Map<Text, Session>,
    token    : Text,
    now      : Int,
  ) : ?Session {
    switch (sessions.get(token)) {
      case null { null };
      case (?s) {
        if (now > s.expiresAt) null
        else ?s
      };
    }
  };

  /// Logout: remove a session token from the sessions map.
  public func logout(
    sessions : Map.Map<Text, Session>,
    token    : Text,
  ) : () {
    sessions.remove(token)
  };

  // ── GPS / Location ────────────────────────────────────────────────────────

  /// Record or overwrite the latest location for a user.
  public func submitLocation(
    locations : Map.Map<UserId, LocationRecord>,
    record    : LocationRecord,
  ) : () {
    locations.add(record.userId, record)
  };

  /// Get the latest location for a single user.
  public func getLocation(
    locations : Map.Map<UserId, LocationRecord>,
    userId    : UserId,
  ) : ?LocationRecord {
    locations.get(userId)
  };

  // ── HQ Hierarchy helpers ──────────────────────────────────────────────────

  /// Convert a Role variant to a display text.
  func roleToText(role : Types.Role) : Text {
    switch (role) {
      case (#Admin)     { "Admin" };
      case (#HRManager) { "HR Manager" };
      case (#ZSM)       { "ZSM" };
      case (#RSM)       { "RSM" };
      case (#ASM)       { "ASM" };
      case (#MR)        { "MR" };
    }
  };

  /// Resolve a name from a Map<Nat, HQRecord> by ID.
  func resolveHqName(m : Map.Map<Nat, LocTypes.HQRecord>, id : Nat) : Text {
    switch (m.get(id)) { case (?r) { r.name }; case null { "" } }
  };

  /// Resolve a name from a Map<Nat, AreaRecord> by ID.
  func resolveAreaName(m : Map.Map<Nat, LocTypes.AreaRecord>, id : Nat) : Text {
    switch (m.get(id)) { case (?r) { r.name }; case null { "" } }
  };

  /// Resolve a name from a Map<Nat, StationRecord> by station ID.
  func resolveStationName(m : Map.Map<Nat, LocTypes.StationRecord>, id : Nat) : Text {
    switch (m.get(id)) { case (?r) { r.stationName }; case null { "" } }
  };

  /// Collect all transitive reportee IDs (BFS, not including the seed user).
  /// PUBLIC so that other mixins (e.g. field-ops-api) can reuse BFS traversal.
  public func allReporteeIds(
    users     : Map.Map<UserId, UserRecord>,
    managerId : UserId,
  ) : [UserId] {
    let visited = List.empty<UserId>();
    let queue   = List.empty<UserId>();
    queue.add(managerId);
    label bfs loop {
      switch (queue.removeLast()) {
        case null    { break bfs };
        case (?uid) {
          if (not visited.contains(uid)) {
            visited.add(uid);
            for ((_, u) in users.entries()) {
              switch (u.reportsTo) {
                case (?mid) { if (mid == uid) { queue.add(u.id) } };
                case null   {};
              }
            }
          }
        };
      }
    };
    // Remove the seed manager from the result
    let result = List.empty<UserId>();
    for (uid in visited.values()) {
      if (uid != managerId) { result.add(uid) }
    };
    result.toArray()
  };

  /// Build a HqHierarchyEmployee record from a UserRecord with resolved names.
  func toHqHierarchyEmployee(
    user        : UserRecord,
    hqs         : Map.Map<Nat, LocTypes.HQRecord>,
    areas       : Map.Map<Nat, LocTypes.AreaRecord>,
    stations    : Map.Map<Nat, LocTypes.StationRecord>,
    managerName : Text,
  ) : Types.HqHierarchyEmployee {
    let blocks = List.empty<Types.HqHierarchyBlock>();
    for (asgn in user.hqAssignments.values()) {
      let areaNames    = asgn.areaIds.map(func(id : Nat) : Text { resolveAreaName(areas, id) });
      let stationNames = asgn.stationIds.map(func(id : Nat) : Text { resolveStationName(stations, id) });
      blocks.add({
        hqId         = asgn.hqId;
        hqName       = resolveHqName(hqs, asgn.hqId);
        areaNames    = areaNames;
        stationNames = stationNames;
      });
    };
    let blocksArr     = blocks.toArray();
    let primaryHqName = if (blocksArr.size() > 0) blocksArr[0].hqName else "";
    let statusText    = switch (user.status) {
      case (#Active)   { "Active" };
      case (#Inactive) { "Inactive" };
    };
    {
      userId               = user.id;
      employeeCode         = user.employeeId;
      employeeName         = user.name;
      role                 = roleToText(user.role);
      territory            = user.territory;
      status               = statusText;
      mobileNumber         = user.phone;
      reportingManagerId   = user.reportsTo;
      reportingManagerName = managerName;
      primaryHqName        = primaryHqName;
      hqAssignments        = blocksArr;
    }
  };

  /// List employees visible to the caller for the HQ hierarchy screen.
  /// - Admin/HR: all employees
  /// - ZSM/RSM/ASM: all transitive reportees
  /// - MR: only themselves (returns a single-element array)
  public func listEmployeesForHqHierarchy(
    users     : Map.Map<UserId, UserRecord>,
    sessions  : Map.Map<Text, Types.Session>,
    hqs       : Map.Map<Nat, LocTypes.HQRecord>,
    areas     : Map.Map<Nat, LocTypes.AreaRecord>,
    stations  : Map.Map<Nat, LocTypes.StationRecord>,
    token     : Text,
    now       : Int,
  ) : [Types.HqHierarchyEmployee] {
    switch (peekSession(sessions, token, now)) {
      case null { [] };
      case (?session) {
        let rawUsers = List.empty<UserRecord>();
        switch (session.role) {
          case (#Admin or #HRManager) {
            for ((_, u) in users.entries()) { rawUsers.add(u) }
          };
          case (#MR) {
            switch (users.get(session.userId)) {
              case (?u) { rawUsers.add(u) };
              case null {};
            }
          };
          case _ {
            for (uid in allReporteeIds(users, session.userId).values()) {
              switch (users.get(uid)) {
                case (?u) { rawUsers.add(u) };
                case null {};
              }
            }
          };
        };
        let result = List.empty<Types.HqHierarchyEmployee>();
        for (u in rawUsers.values()) {
          let managerName = switch (u.reportsTo) {
            case (?mid) {
              switch (users.get(mid)) {
                case (?mgr) { mgr.name };
                case null   { "" };
              }
            };
            case null { "" };
          };
          result.add(toHqHierarchyEmployee(u, hqs, areas, stations, managerName))
        };
        result.toArray()
      };
    }
  };

  /// Return the full upward reporting chain for a given employee,
  /// starting from the employee themselves up to the root.
  public func getEmployeeReportingChain(
    users     : Map.Map<UserId, UserRecord>,
    sessions  : Map.Map<Text, Types.Session>,
    token     : Text,
    targetId  : UserId,
    now       : Int,
  ) : [Types.ReportingChainEntry] {
    switch (peekSession(sessions, token, now)) {
      case null { [] };
      case (?_) {
        let chain   = List.empty<Types.ReportingChainEntry>();
        var current : ?UserId = ?targetId;
        var guard   : Nat = 0;  // cycle guard — max 20 hops
        label walk loop {
          if (guard >= 20) { break walk };
          switch (current) {
            case null { break walk };
            case (?uid) {
              switch (users.get(uid)) {
                case null { break walk };
                case (?u) {
                  chain.add({
                    userId = u.id;
                    name   = u.name;
                    role   = roleToText(u.role);
                  });
                  current := u.reportsTo;
                  guard   += 1;
                };
              }
            };
          }
        };
        chain.toArray()
      };
    }
  };

  /// Helper: collect IDs of direct reportees.
  private func directReporteeIds(
    users     : Map.Map<UserId, UserRecord>,
    managerId : UserId,
  ) : [UserId] {
    let result = List.empty<UserId>();
    for ((_, u) in users.entries()) {
      switch (u.reportsTo) {
        case (?mid) { if (mid == managerId) { result.add(u.id) } };
        case null   {};
      }
    };
    result.toArray()
  };

  /// Get latest locations of all direct and indirect reportees of a manager.
  public func getReporteeLocations(
    users     : Map.Map<UserId, UserRecord>,
    locations : Map.Map<UserId, LocationRecord>,
    managerId : UserId,
  ) : [LocationRecord] {
    // BFS — iteratively collect all transitive reportees
    let visited = List.empty<UserId>();
    let queue   = List.empty<UserId>();
    queue.add(managerId);

    label search loop {
      switch (queue.removeLast()) {
        case null     { break search };
        case (?uid) {
          if (not visited.contains(uid)) {
            visited.add(uid);
            for (rid in directReporteeIds(users, uid).values()) {
              queue.add(rid)
            }
          }
        };
      }
    };

    // Exclude the manager themselves, collect locations
    let result = List.empty<LocationRecord>();
    for (uid in visited.values()) {
      if (uid != managerId) {
        switch (locations.get(uid)) {
          case (?loc) { result.add(loc) };
          case null   {};
        }
      }
    };
    result.toArray()
  };

  /// Get all employee locations (Admin / ZSM view).
  public func getAllLocations(
    locations : Map.Map<UserId, LocationRecord>,
  ) : [LocationRecord] {
    let result = List.empty<LocationRecord>();
    for ((_, loc) in locations.entries()) {
      result.add(loc)
    };
    result.toArray()
  };

  // ── Password reset helpers ────────────────────────────────────────────────

  /// Generate a 12-character alphanumeric temporary password seeded from a timestamp.
  public func generateTempPassword(now : Int) : Text {
    let chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let len : Nat = 58; // length of chars string
    var seed : Nat = 0xCAFE_BABE_1337 + (if (now >= 0) now.toNat() else 0);
    var result = "";
    var i = 0;
    while (i < 12) {
      seed := (seed * 6364136223846793005 + 1442695040888963407) % 0xFFFF_FFFF_FFFF_FFFF;
      let idx = seed % len;
      // extract character at position idx from the chars string
      var pos = 0;
      for (c in chars.toIter()) {
        if (pos == idx) { result := result # c.toText() };
        pos += 1;
      };
      i += 1;
    };
    result
  };

  /// Reset a target user's password to a random temporary password.
  /// Caller must be Admin or HRManager. Target must NOT be an Admin.
  /// Returns the plaintext temp password on success.
  public func resetUserPassword(
    users  : Map.Map<UserId, UserRecord>,
    userId : UserId,
    now    : Int,
  ) : PasswordResetResult {
    switch (users.get(userId)) {
      case null { #err("User not found") };
      case (?user) {
        if (user.role == #Admin) {
          return #err("Cannot reset password for an Admin account via this method")
        };
        let tempPassword = generateTempPassword(now);
        user.passwordHash := hashPassword(tempPassword);
        #ok(tempPassword)
      };
    }
  };

  /// Seed or reset the Admin account: username = "admin", password = "Admin@1234".
  /// If called to reset, updates the existing Admin record's username and password hash.
  /// Also repairs the usernameIndex to reflect any username change.
  public func seedAdminPassword(
    users         : Map.Map<UserId, UserRecord>,
    usernameIndex : Map.Map<Text, UserId>,
  ) : MutationResult {
    var found = false;
    for ((_, u) in users.entries()) {
      if (u.role == #Admin) {
        // Remove old username index entry if username differs
        if (u.username != "admin") {
          usernameIndex.remove(u.username);
          usernameIndex.add("admin", u.id);
          u.username := "admin";
        };
        u.passwordHash := hashPassword("Admin@1234");
        found := true;
      };
    };
    if (found) #ok
    else #err("Admin account not found")
  };

  /// Create the initial Admin account if it does not already exist.
  /// Called at canister init to ensure admin credentials are always set.
  public func initAdminAccount(
    users         : Map.Map<UserId, UserRecord>,
    usernameIndex : Map.Map<Text, UserId>,
    nextId        : Nat,
    now           : Int,
  ) : () {
    // If any Admin account already exists, just ensure credentials are correct
    var adminExists = false;
    for ((_, u) in users.entries()) {
      if (u.role == #Admin) {
        adminExists := true;
        if (u.username != "admin") {
          usernameIndex.remove(u.username);
          usernameIndex.add("admin", u.id);
          u.username := "admin";
        };
        u.passwordHash := hashPassword("Admin@1234");
      };
    };
    if (not adminExists) {
      let record : UserRecord = {
        id               = nextId;
        var username     = "admin";
        var passwordHash = hashPassword("Admin@1234");
        var role         = #Admin;
        var status       = #Active;
        var employeeId   = "EMP001";
        var name         = "System Administrator";
        var email        = "admin@krishkar.com";
        var phone        = "";
        var designation  = "Administrator";
        var department   = "Administration";
        var territory    = "";
        var reportsTo    = null;
        var joinDate     = "";
        var salary       = { basic = 0; hra = 0; ta = 0.0; pfPercent = 12; esiPercent = 1 };
        var primaryHqId  = null;
        var zoneIds      = [];
        var stateIds     = [];
        var territoryIds = [];
        var hqIds        = [];
        var areaIds      = [];
        var hqAssignments = [];
        var migrationDone = true;
        createdAt        = now;
      };
      users.add(nextId, record);
      usernameIndex.add("admin", nextId);
    };
  };

  /// Return all employees whose stored role is not in the valid six-role hierarchy.
  /// After the NSM removal, all role values are from the valid six-role set, so this
  /// always returns []. Kept for API stability — Admin portal can call this safely.
  public func getInvalidRoleEmployees(
    users : Map.Map<UserId, UserRecord>,
  ) : [{ id : UserId; employeeId : Text; name : Text; rawRole : Text }] {
    let _ = users;
    []
  };
};
