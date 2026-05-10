import Types       "../types/bottom-up-targets";
import AuthTypes    "../types/auth-users";
import LocTypes     "../types/location-master";
import HistoryTypes "../types/target-history";
import HistoryLib   "target-history";
import Map          "mo:core/Map";
import List         "mo:core/List";

module {
  public type BottomUpTarget            = Types.BottomUpTarget;
  public type CreateBottomUpTargetInput = Types.CreateBottomUpTargetInput;
  public type OverrideBottomUpTargetInput = Types.OverrideBottomUpTargetInput;
  public type TargetHierarchyNode       = Types.TargetHierarchyNode;
  public type BottomUpTargetSummaryRow  = Types.BottomUpTargetSummaryRow;
  public type UserId                    = Types.UserId;
  public type Timestamp                 = Types.Timestamp;
  public type Role                      = Types.Role;
  public type TargetPeriod              = Types.TargetPeriod;
  public type CalculationStatus         = Types.CalculationStatus;
  public type UserRecord                = AuthTypes.UserRecord;
  public type TerritoryRecord           = LocTypes.TerritoryRecord;
  public type AreaRecord                = LocTypes.AreaRecord;
  public type TargetAdjustmentLog       = HistoryTypes.TargetAdjustmentLog;

  // ── Internal helpers ────────────────────────────────────────────────────────

  /// Collect all direct reportee IDs for a given manager from the users map.
  func directReporteeIds(users : Map.Map<UserId, UserRecord>, managerId : UserId) : [UserId] {
    let ids = List.empty<UserId>();
    for ((_, u) in users.entries()) {
      switch (u.reportsTo) {
        case (?rid) { if (rid == managerId) { ids.add(u.id) } };
        case null {};
      };
    };
    ids.toArray()
  };

  /// All distinct years present in the target list.
  func distinctYears(targets : List.List<BottomUpTarget>) : [Nat] {
    let seen = Map.empty<Nat, Bool>();
    for (t in targets.values()) {
      seen.add(t.year, true);
    };
    let years = List.empty<Nat>();
    for ((y, _) in seen.entries()) { years.add(y) };
    years.toArray()
  };

  /// All four target periods.
  let allPeriods : [TargetPeriod] = [#Monthly, #Quarterly, #HalfYearly, #Yearly];

  /// Look up an existing target by (userId, period, year).
  func findTarget(
    targets : List.List<BottomUpTarget>,
    uid     : UserId,
    period  : TargetPeriod,
    year    : Nat,
  ) : ?BottomUpTarget {
    targets.find(func(t : BottomUpTarget) : Bool {
      t.userId == uid and t.period == period and t.year == year
    })
  };

  /// Get the effective target amount for (userId, period, year).
  /// Returns 0 if no record exists.
  func effectiveAmount(
    targets : List.List<BottomUpTarget>,
    uid     : UserId,
    period  : TargetPeriod,
    year    : Nat,
  ) : Nat {
    switch (findTarget(targets, uid, period, year)) {
      case (?t) { t.targetAmount };
      case null { 0 };
    }
  };

  /// Get territory name for a user (first territoryId → territories map lookup).
  func getUserTerritory(
    u           : UserRecord,
    territories : Map.Map<Nat, TerritoryRecord>,
  ) : ?Text {
    if (u.territoryIds.size() > 0) {
      let tid = u.territoryIds[0];
      switch (territories.get(tid)) {
        case (?tr) { ?tr.name };
        case null { null };
      }
    } else if (u.territory != "") {
      ?u.territory
    } else {
      null
    }
  };

  /// Get area name for a user (first areaId → areas map lookup).
  func getUserArea(
    u     : UserRecord,
    areas : Map.Map<Nat, AreaRecord>,
  ) : ?Text {
    if (u.areaIds.size() > 0) {
      let aid = u.areaIds[0];
      switch (areas.get(aid)) {
        case (?ar) { ?ar.name };
        case null { null };
      }
    } else {
      null
    }
  };

  /// Role label string for summary rows.
  func roleLabel(role : Role) : Text {
    switch (role) {
      case (#MR)        { "MR" };
      case (#ASM)       { "ASM" };
      case (#RSM)       { "RSM" };
      case (#ZSM)       { "ZSM" };
      case (#HRManager) { "HRManager" };
      case (#Admin)     { "Admin" };
    }
  };

  // ── Exported functions ──────────────────────────────────────────────────────

  /// Month hint for history log: null unless Monthly period.
  func monthForPeriod(period : TargetPeriod) : ?Nat {
    switch (period) {
      case (#Monthly) { null }; // caller can specify month via input if needed
      case _          { null };
    }
  };

  /// Create or update an MR-level target, then cascade upward.
  /// Also appends an entry to the adjustment history log.
  public func setMrTarget(
    targets        : List.List<BottomUpTarget>,
    users          : Map.Map<UserId, UserRecord>,
    adjLogs        : List.List<TargetAdjustmentLog>,
    input          : CreateBottomUpTargetInput,
    callerId       : UserId,
    now            : Timestamp,
    nextId         : Nat,
    nextAdjLogId   : { var value : Nat },
  ) : (List.List<BottomUpTarget>, BottomUpTarget) {
    // Upsert: check existing
    switch (findTarget(targets, input.userId, input.period, input.year)) {
      case (?existing) {
        let prevAmount : Float = existing.targetAmount.toFloat();
        // Update in place
        targets.mapInPlace(func(t : BottomUpTarget) : BottomUpTarget {
          if (t.id == existing.id) {
            { t with
              targetAmount   = input.targetAmount;
              lastModifiedAt = now;
              lastModifiedBy = callerId;
            }
          } else { t }
        });
        let updated = switch (findTarget(targets, input.userId, input.period, input.year)) {
          case (?t) { t };
          case null { existing }; // shouldn't happen
        };
        // Log the update
        let _ = HistoryLib.appendLog(
          adjLogs, input.userId, existing.role, input.period, input.year,
          monthForPeriod(input.period), prevAmount, input.targetAmount.toFloat(),
          input.description, callerId, now, nextAdjLogId.value
        );
        nextAdjLogId.value += 1;
        let cascaded = recalcCascade(targets, users, now, callerId);
        (cascaded, updated)
      };
      case null {
        // Create new
        let newTarget : BottomUpTarget = {
          id                = nextId;
          userId            = input.userId;
          role              = #MR;
          period            = input.period;
          year              = input.year;
          targetAmount      = input.targetAmount;
          calculationStatus = #AutoCalculated;
          isOverridden      = false;
          overrideReason    = null;
          createdAt         = now;
          createdBy         = callerId;
          lastModifiedAt    = now;
          lastModifiedBy    = callerId;
        };
        targets.add(newTarget);
        // Log the creation (previousValue = 0.0 for new target)
        let _ = HistoryLib.appendLog(
          adjLogs, input.userId, #MR, input.period, input.year,
          monthForPeriod(input.period), 0.0, input.targetAmount.toFloat(),
          input.description, callerId, now, nextAdjLogId.value
        );
        nextAdjLogId.value += 1;
        let cascaded = recalcCascade(targets, users, now, callerId);
        (cascaded, newTarget)
      };
    }
  };

  /// Recompute all non-MR aggregated targets by walking the user hierarchy.
  /// Respects manual overrides: if a node is overridden, its overridden amount
  /// propagates to the next level (not the auto-sum).
  public func recalcCascade(
    targets  : List.List<BottomUpTarget>,
    users    : Map.Map<UserId, UserRecord>,
    now      : Timestamp,
    callerId : UserId,
  ) : List.List<BottomUpTarget> {
    let years = distinctYears(targets);

    // Role processing order: ASM ← MR, RSM ← ASM, ZSM ← RSM
    let roleLevels : [Role] = [#ASM, #RSM, #ZSM];

    for (year in years.values()) {
      for (period in allPeriods.values()) {
        for (managerRole in roleLevels.values()) {
          // Find all users with this managerRole
          for ((mid, mgr) in users.entries()) {
            if (mgr.role == managerRole) {
              // Sum effective amounts of direct reportees
              let reportees = directReporteeIds(users, mid);
              var sum : Nat = 0;
              for (rid in reportees.values()) {
                sum += effectiveAmount(targets, rid, period, year);
              };
              // Only create/update if sum > 0 (reportees exist with targets)
              // or if a record already exists
              switch (findTarget(targets, mid, period, year)) {
                case (?existing) {
                  if (not existing.isOverridden) {
                    // Update auto-calculated amount
                    targets.mapInPlace(func(t : BottomUpTarget) : BottomUpTarget {
                      if (t.id == existing.id) {
                        { t with
                          targetAmount      = sum;
                          calculationStatus = #AutoCalculated;
                          lastModifiedAt    = now;
                          lastModifiedBy    = callerId;
                        }
                      } else { t }
                    });
                  }
                  // If overridden, leave it alone — the overridden value propagates
                };
                case null {
                  if (sum > 0) {
                    // Create new auto-calculated aggregate
                    // We need a nextId — use a deterministic approach: just add
                    // We'll read current max id from targets and add 1
                    var maxId : Nat = 0;
                    for (t in targets.values()) {
                      if (t.id > maxId) { maxId := t.id };
                    };
                    let newId = maxId + 1;
                    let newRec : BottomUpTarget = {
                      id                = newId;
                      userId            = mid;
                      role              = managerRole;
                      period            = period;
                      year              = year;
                      targetAmount      = sum;
                      calculationStatus = #AutoCalculated;
                      isOverridden      = false;
                      overrideReason    = null;
                      createdAt         = now;
                      createdBy         = callerId;
                      lastModifiedAt    = now;
                      lastModifiedBy    = callerId;
                    };
                    targets.add(newRec);
                  }
                };
              };
            }
          }
        }
      }
    };
    targets
  };

  /// Manually override an existing target's amount.
  /// Also appends an entry to the adjustment history log.
  public func overrideTarget(
    targets      : List.List<BottomUpTarget>,
    adjLogs      : List.List<TargetAdjustmentLog>,
    input        : OverrideBottomUpTargetInput,
    callerId     : UserId,
    now          : Timestamp,
    nextAdjLogId : { var value : Nat },
  ) : List.List<BottomUpTarget> {
    // Find the target to read its current values before mutation
    let existingOpt = targets.find(func(t : BottomUpTarget) : Bool { t.id == input.targetId });
    targets.mapInPlace(func(t : BottomUpTarget) : BottomUpTarget {
      if (t.id == input.targetId) {
        { t with
          targetAmount      = input.newAmount;
          isOverridden      = true;
          calculationStatus = #ManuallyOverridden;
          overrideReason    = ?input.overrideReason;
          lastModifiedAt    = now;
          lastModifiedBy    = callerId;
        }
      } else { t }
    });
    // Log the override
    switch (existingOpt) {
      case (?existing) {
        let _ = HistoryLib.appendLog(
          adjLogs, existing.userId, existing.role, existing.period, existing.year,
          monthForPeriod(existing.period),
          existing.targetAmount.toFloat(), input.newAmount.toFloat(),
          ?input.overrideReason, callerId, now, nextAdjLogId.value
        );
        nextAdjLogId.value += 1;
      };
      case null {};
    };
    targets
  };

  /// Undo a manual override and revert to auto-calculated.
  public func undoOverride(
    targets  : List.List<BottomUpTarget>,
    targetId : Nat,
    users    : Map.Map<UserId, UserRecord>,
    callerId : UserId,
    now      : Timestamp,
  ) : List.List<BottomUpTarget> {
    targets.mapInPlace(func(t : BottomUpTarget) : BottomUpTarget {
      if (t.id == targetId) {
        { t with
          isOverridden      = false;
          overrideReason    = null;
          calculationStatus = #AutoCalculated;
          lastModifiedAt    = now;
          lastModifiedBy    = callerId;
        }
      } else { t }
    });
    recalcCascade(targets, users, now, callerId)
  };

  // ── Hierarchy builder ────────────────────────────────────────────────────────

  /// Build a TargetHierarchyNode for a single user with children populated recursively.
  func buildNode(
    uid         : UserId,
    targets     : List.List<BottomUpTarget>,
    users       : Map.Map<UserId, UserRecord>,
    territories : Map.Map<Nat, TerritoryRecord>,
    areas       : Map.Map<Nat, AreaRecord>,
    year        : Nat,
  ) : ?TargetHierarchyNode {
    switch (users.get(uid)) {
      case null { null };
      case (?u) {
        let monthly    = effectiveAmount(targets, uid, #Monthly,    year);
        let quarterly  = effectiveAmount(targets, uid, #Quarterly,  year);
        let halfYearly = effectiveAmount(targets, uid, #HalfYearly, year);
        let yearly     = effectiveAmount(targets, uid, #Yearly,     year);

        // Status from any stored target (prefer the yearly one as representative)
        let (status, isOver, overReason) : (CalculationStatus, Bool, ?Text) =
          switch (findTarget(targets, uid, #Yearly, year)) {
            case (?t) { (t.calculationStatus, t.isOverridden, t.overrideReason) };
            case null { (#AutoCalculated, false, null) };
          };

        // Build children (direct reportees)
        let reporteeIds = directReporteeIds(users, uid);
        let childNodes = List.empty<TargetHierarchyNode>();
        for (rid in reporteeIds.values()) {
          switch (buildNode(rid, targets, users, territories, areas, year)) {
            case (?n) { childNodes.add(n) };
            case null {};
          }
        };

        ?{
          userId         = uid;
          name           = u.name;
          role           = u.role;
          territory      = getUserTerritory(u, territories);
          area           = getUserArea(u, areas);
          monthly        = monthly;
          quarterly      = quarterly;
          halfYearly     = halfYearly;
          yearly         = yearly;
          status         = status;
          isOverridden   = isOver;
          overrideReason = overReason;
           children       = childNodes.toArray();
        }
      };
    }
  };

  /// Build the full target hierarchy tree visible to the requestor.
  public func getHierarchy(
    targets       : List.List<BottomUpTarget>,
    users         : Map.Map<UserId, UserRecord>,
    territories   : Map.Map<Nat, TerritoryRecord>,
    areas         : Map.Map<Nat, AreaRecord>,
    requestorRole : Role,
    requestorId   : UserId,
  ) : [TargetHierarchyNode] {
    // Use the most recent year in targets, or current year as fallback (2026)
    let years = distinctYears(targets);
    let year : Nat = if (years.size() > 0) {
      years.foldLeft<Nat, Nat>(years[0], func(acc, y) = if (y > acc) y else acc)
    } else { 2026 };

    switch (requestorRole) {
      case (#Admin or #HRManager) {
        // Full tree: find all top-level users (reportsTo = null)
        let roots = List.empty<TargetHierarchyNode>();
        for ((uid, u) in users.entries()) {
          switch (u.reportsTo) {
            case null {
              switch (buildNode(uid, targets, users, territories, areas, year)) {
                case (?n) { roots.add(n) };
                case null {};
              }
            };
            case _ {};
          }
        };
        roots.toArray()
      };
      case (#MR) {
        // Only own node
        switch (buildNode(requestorId, targets, users, territories, areas, year)) {
          case (?n) { [n] };
          case null { [] };
        }
      };
      case _ {
        // Manager: own subtree
        switch (buildNode(requestorId, targets, users, territories, areas, year)) {
          case (?n) { [n] };
          case null { [] };
        }
      };
    }
  };

  /// Return all BottomUpTarget records for a given MR user.
  public func getMrTargets(
    targets : List.List<BottomUpTarget>,
    userId  : UserId,
  ) : [BottomUpTarget] {
    let result = targets.filter(func(t : BottomUpTarget) : Bool {
      t.userId == userId and t.role == #MR
    });
    result.toArray()
  };

  /// Flatten hierarchy into exportable summary rows with optional filters.
  public func getSummaryRows(
    targets         : List.List<BottomUpTarget>,
    users           : Map.Map<UserId, UserRecord>,
    territories     : Map.Map<Nat, TerritoryRecord>,
    areas           : Map.Map<Nat, AreaRecord>,
    filterTerritory : ?Text,
    filterArea      : ?Text,
    filterRole      : ?Role,
  ) : [BottomUpTargetSummaryRow] {
    let years = distinctYears(targets);
    let year : Nat = if (years.size() > 0) {
      years.foldLeft<Nat, Nat>(years[0], func(acc, y) = if (y > acc) y else acc)
    } else { 2026 };

    // Collect rows in hierarchy order: MR, ASM, RSM, ZSM
    let orderedRoles : [Role] = [#MR, #ASM, #RSM, #ZSM];
    let rows = List.empty<BottomUpTargetSummaryRow>();

    for (r in orderedRoles.values()) {
      // Skip if filtering by role and this doesn't match
      switch (filterRole) {
        case (?fr) { if (fr != r) { /* skip */ } else {
          appendRowsForRole(rows, r, year, targets, users, territories, areas, filterTerritory, filterArea)
        } };
        case null {
          appendRowsForRole(rows, r, year, targets, users, territories, areas, filterTerritory, filterArea)
        };
      }
    };

    rows.toArray()
  };

  /// Append summary rows for a given role to the accumulator list.
  func appendRowsForRole(
    rows            : List.List<BottomUpTargetSummaryRow>,
    role            : Role,
    year            : Nat,
    targets         : List.List<BottomUpTarget>,
    users           : Map.Map<UserId, UserRecord>,
    territories     : Map.Map<Nat, TerritoryRecord>,
    areas           : Map.Map<Nat, AreaRecord>,
    filterTerritory : ?Text,
    filterArea      : ?Text,
  ) {
    for ((uid, u) in users.entries()) {
      if (u.role == role) {
        let terrName  = switch (getUserTerritory(u, territories)) { case (?t) t; case null "" };
        let areaName  = switch (getUserArea(u, areas))            { case (?a) a; case null "" };

        // Apply territory/area filters
        let passTerritory = switch (filterTerritory) {
          case (?ft) { terrName == ft };
          case null  { true };
        };
        let passArea = switch (filterArea) {
          case (?fa) { areaName == fa };
          case null  { true };
        };

        if (passTerritory and passArea) {
          let monthly    = effectiveAmount(targets, uid, #Monthly,    year);
          let quarterly  = effectiveAmount(targets, uid, #Quarterly,  year);
          let halfYearly = effectiveAmount(targets, uid, #HalfYearly, year);
          let yearly     = effectiveAmount(targets, uid, #Yearly,     year);

          let (statusText, overNote) : (Text, Text) =
            switch (findTarget(targets, uid, #Yearly, year)) {
              case (?t) {
                let s = switch (t.calculationStatus) {
                  case (#AutoCalculated)    { "Auto" };
                  case (#ManuallyOverridden) { "Overridden" };
                };
                let n = switch (t.overrideReason) { case (?r) r; case null "" };
                (s, n)
              };
              case null { ("Auto", "") };
            };

          rows.add({
            level         = roleLabel(role);
            employeeName  = u.name;
            territory     = terrName;
            area          = areaName;
            monthly       = monthly;
            quarterly     = quarterly;
            halfYearly    = halfYearly;
            yearly        = yearly;
            status        = statusText;
            overrideNotes = overNote;
          });
        }
      }
    }
  };
};
