import Types    "../types/travel-plan";
import Common   "../types/common";
import List     "mo:core/List";

module {
  public type TravelPlanId        = Types.TravelPlanId;
  public type TravelPlanRecord    = Types.TravelPlanRecord;
  public type TravelPlanInfo      = Types.TravelPlanInfo;
  public type TravelPlanStatus    = Types.TravelPlanStatus;
  public type RoleHierarchyConfig = Types.RoleHierarchyConfig;
  public type CreateTravelPlanInput = Types.CreateTravelPlanInput;
  public type UserId    = Common.UserId;
  public type Role      = Common.Role;
  public type Timestamp = Common.Timestamp;
  public type MutationResult = Common.MutationResult;

  // ── Date helpers ────────────────────────────────────────────────────────────

  /// Extract "YYYY-MM" month prefix from an ISO date "YYYY-MM-DD"
  private func monthOf(date : Text) : Text {
    let chars = date.toArray();
    if (chars.size() < 7) return date;
    var result = "";
    var i = 0;
    for (c in chars.values()) {
      if (i < 7) { result := result # c.toText() };
      i += 1;
    };
    result
  };

  /// Check if a date string "YYYY-MM-DD" belongs to a given month prefix "YYYY-MM"
  private func isInMonth(date : Text, monthPrefix : Text) : Bool {
    monthOf(date) == monthPrefix
  };

  // ── Conversion ─────────────────────────────────────────────────────────────

  /// Convert internal mutable record to immutable shared TravelPlanInfo
  public func toInfo(r : TravelPlanRecord) : TravelPlanInfo {
    {
      id             = r.id;
      userId         = r.userId;
      date           = r.date;
      plannedStation = r.plannedStation;
      notes          = r.notes;
      status         = r.status;
      createdAt      = r.createdAt;
      updatedAt      = r.updatedAt;
    }
  };

  // ── CRUD operations ───────────────────────────────────────────────────────────

  /// Create a new travel plan record; returns the new TravelPlanId.
  public func createTravelPlan(
    plans  : List.List<TravelPlanRecord>,
    userId : UserId,
    input  : CreateTravelPlanInput,
    nextId : { var val : Nat },
    now    : Timestamp,
  ) : TravelPlanId {
    let id = nextId.val;
    let record : TravelPlanRecord = {
      id                 = id;
      userId             = userId;
      var date           = input.date;
      var plannedStation = input.plannedStation;
      var notes          = input.notes;
      var status         = #Draft;
      createdAt          = now;
      var updatedAt      = now;
    };
    plans.add(record);
    nextId.val += 1;
    id
  };

  /// Get a single travel plan by ID
  public func getTravelPlan(
    plans : List.List<TravelPlanRecord>,
    id    : TravelPlanId,
  ) : ?TravelPlanInfo {
    switch (plans.find(func(r : TravelPlanRecord) : Bool { r.id == id })) {
      case null   { null };
      case (?r)   { ?toInfo(r) };
    }
  };

  /// List all plans for a given user, optionally filtered by month prefix "YYYY-MM".
  public func listMyTravelPlans(
    plans  : List.List<TravelPlanRecord>,
    userId : UserId,
    month  : ?Text,
  ) : [TravelPlanInfo] {
    let result = List.empty<TravelPlanInfo>();
    for (r in plans.values()) {
      if (r.userId == userId) {
        let inMonth = switch (month) {
          case null  { true };
          case (?m)  { isInMonth(r.date, m) };
        };
        if (inMonth) { result.add(toInfo(r)) };
      };
    };
    result.toArray()
  };

  /// List all employees' travel plans (managers/HR view).
  public func listAllTravelPlans(
    plans  : List.List<TravelPlanRecord>,
    userId : ?UserId,
    month  : ?Text,
  ) : [TravelPlanInfo] {
    let result = List.empty<TravelPlanInfo>();
    for (r in plans.values()) {
      let userMatch = switch (userId) {
        case null   { true };
        case (?uid) { r.userId == uid };
      };
      let monthMatch = switch (month) {
        case null  { true };
        case (?m)  { isInMonth(r.date, m) };
      };
      if (userMatch and monthMatch) { result.add(toInfo(r)) };
    };
    result.toArray()
  };

  /// Update an existing travel plan (only when in #Draft status and owned by userId).
  public func updateTravelPlan(
    plans  : List.List<TravelPlanRecord>,
    id     : TravelPlanId,
    userId : UserId,
    input  : CreateTravelPlanInput,
    now    : Timestamp,
  ) : MutationResult {
    switch (plans.find(func(r : TravelPlanRecord) : Bool { r.id == id })) {
      case null  { #err("Travel plan not found") };
      case (?r) {
        if (r.userId != userId) { return #err("Unauthorized: not your travel plan") };
        switch (r.status) {
          case (#Draft) {
            r.date           := input.date;
            r.plannedStation := input.plannedStation;
            r.notes          := input.notes;
            r.updatedAt      := now;
            #ok
          };
          case (#Submitted) { #err("Cannot update a submitted travel plan") };
        }
      };
    }
  };

  /// Submit a travel plan: transitions #Draft -> #Submitted.
  public func submitTravelPlan(
    plans  : List.List<TravelPlanRecord>,
    id     : TravelPlanId,
    userId : UserId,
    now    : Timestamp,
  ) : MutationResult {
    switch (plans.find(func(r : TravelPlanRecord) : Bool { r.id == id })) {
      case null  { #err("Travel plan not found") };
      case (?r) {
        if (r.userId != userId) { return #err("Unauthorized: not your travel plan") };
        switch (r.status) {
          case (#Draft) {
            r.status    := #Submitted;
            r.updatedAt := now;
            #ok
          };
          case (#Submitted) { #err("Travel plan is already submitted") };
        }
      };
    }
  };

  /// Look up the planned station for a user on a given date (exact date match).
  public func getStationForDate(
    plans  : List.List<TravelPlanRecord>,
    userId : UserId,
    date   : Text,
  ) : ?Text {
    switch (plans.find(func(r : TravelPlanRecord) : Bool {
      r.userId == userId and r.date == date and r.status == #Submitted
    })) {
      case null  { null };
      case (?r)  { ?r.plannedStation };
    }
  };

  // ── Role Hierarchy Config ──────────────────────────────────────────────────────

  /// Get the current role hierarchy configuration.
  public func getRoleHierarchyConfig(
    config : { var value : RoleHierarchyConfig },
  ) : RoleHierarchyConfig {
    config.value
  };

  /// Update the role hierarchy configuration (Admin only — enforced at mixin layer).
  public func setRoleHierarchyConfig(
    config   : { var value : RoleHierarchyConfig },
    newOrder : [Role],
  ) : MutationResult {
    if (newOrder.size() == 0) {
      return #err("Role order must not be empty")
    };
    config.value := { roleOrder = newOrder };
    #ok
  };

  // ── MTP vs Actual Report helper ──────────────────────────────────────────────

  /// Returns [(date, plannedStation, notes)] for all travel plan entries belonging
  /// to `mrId` in the given month and year.
  public func getMtpSummaryForReport(
    plans : List.List<TravelPlanRecord>,
    mrId  : UserId,
    month : Nat,
    year  : Nat,
  ) : [(Text, Text, Text)] {
    let mm = if (month < 10) { "0" # month.toText() } else { month.toText() };
    let prefix = year.toText() # "-" # mm;
    let result = List.empty<(Text, Text, Text)>();
    for (r in plans.values()) {
      if (r.userId == mrId and isInMonth(r.date, prefix)) {
        result.add((r.date, r.plannedStation, r.notes))
      }
    };
    result.toArray()
  };

  /// Return all roles that appear strictly above `role` in the hierarchy.
  public func getHigherAuthorities(
    config : RoleHierarchyConfig,
    role   : Role,
  ) : [Role] {
    let order = config.roleOrder;
    var roleIdx : ?Nat = null;
    var i = 0;
    for (r in order.values()) {
      if (r == role and roleIdx == null) { roleIdx := ?i };
      i += 1;
    };
    switch (roleIdx) {
      case null { [] };
      case (?idx) {
        let result = List.empty<Role>();
        var j = 0;
        for (r in order.values()) {
          if (j > idx) { result.add(r) };
          j += 1;
        };
        result.toArray()
      };
    }
  };
};
