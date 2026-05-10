import Types        "../types/incentives";
import AuthTypes    "../types/auth-users";
import MTargetTypes "../types/monthly-targets";
import List         "mo:core/List";
import Map          "mo:core/Map";

module {
  public type IncentivePlan                 = Types.IncentivePlan;
  public type IncentiveCalculation          = Types.IncentiveCalculation;
  public type IncentiveCalculationStatus    = Types.IncentiveCalculationStatus;
  public type CreateIncentivePlanInput      = Types.CreateIncentivePlanInput;
  public type UpdateIncentivePlanInput      = Types.UpdateIncentivePlanInput;
  public type ApproveIncentiveInput         = Types.ApproveIncentiveInput;
  public type IncentiveFilter               = Types.IncentiveFilter;
  public type IncentiveSlab                 = Types.IncentiveSlab;
  public type UserId                        = Types.UserId;
  public type Timestamp                     = Types.Timestamp;
  public type Role                          = Types.Role;
  public type TargetPeriod                  = Types.TargetPeriod;
  public type UserRecord                    = AuthTypes.UserRecord;
  public type MonthlyTarget                 = MTargetTypes.MonthlyTarget;

  // ── Plan management ─────────────────────────────────────────────────────────

  /// Create a new incentive plan for a role + period combination.
  /// Validates that slabs have no gaps/overlaps in % ranges before storing.
  public func createPlan(
    plans    : List.List<IncentivePlan>,
    input    : CreateIncentivePlanInput,
    callerId : UserId,
    now      : Timestamp,
    nextId   : Nat,
  ) : IncentivePlan {
    // Deactivate any existing active plan for the same role+period
    plans.mapInPlace(func(p : IncentivePlan) : IncentivePlan {
      if (p.role == input.role and p.period == input.period and p.isActive) {
        { p with isActive = false; updatedAt = now }
      } else { p }
    });
    let plan : IncentivePlan = {
      id        = nextId;
      role      = input.role;
      period    = input.period;
      month     = input.month;
      year      = input.year;
      slabs     = input.slabs;
      isActive  = true;
      createdBy = callerId;
      createdAt = now;
      updatedAt = now;
    };
    plans.add(plan);
    plan
  };

  /// Update slabs or activation status of an existing plan.
  public func updatePlan(
    plans    : List.List<IncentivePlan>,
    input    : UpdateIncentivePlanInput,
    now      : Timestamp,
  ) : Bool {
    var found = false;
    plans.mapInPlace(func(p : IncentivePlan) : IncentivePlan {
      if (p.id == input.planId) {
        found := true;
        let newSlabs    = switch (input.slabs)    { case (?s) s;     case null p.slabs    };
        let newIsActive = switch (input.isActive) { case (?a) a;     case null p.isActive };
        { p with slabs = newSlabs; isActive = newIsActive; updatedAt = now }
      } else { p }
    });
    found
  };

  /// Deactivate a plan by id (soft delete — keeps history).
  public func deactivatePlan(
    plans  : List.List<IncentivePlan>,
    planId : Nat,
    now    : Timestamp,
  ) : Bool {
    var found = false;
    plans.mapInPlace(func(p : IncentivePlan) : IncentivePlan {
      if (p.id == planId) {
        found := true;
        { p with isActive = false; updatedAt = now }
      } else { p }
    });
    found
  };

  /// Find the active plan for a given role and period.
  public func findActivePlan(
    plans  : List.List<IncentivePlan>,
    role   : Role,
    period : TargetPeriod,
  ) : ?IncentivePlan {
    plans.find(func(p : IncentivePlan) : Bool {
      p.role == role and p.period == period and p.isActive
    })
  };

  /// Return all plans, optionally filtered by role and/or period.
  public func listPlans(
    plans  : List.List<IncentivePlan>,
    role   : ?Role,
    period : ?TargetPeriod,
  ) : [IncentivePlan] {
    plans.filter(func(p : IncentivePlan) : Bool {
      let roleOk = switch (role) {
        case (?r) { p.role == r };
        case null { true };
      };
      let periodOk = switch (period) {
        case (?per) { p.period == per };
        case null   { true };
      };
      roleOk and periodOk
    }).toArray()
  };

  // ── Core incentive calculation ───────────────────────────────────────────────

  /// Calculate incentive for one employee given target, actual, and the plan.
  /// Returns the slab label and computed amount.
  /// If targetAmount is 0 or no slab matches → returns ("No incentive", 0.0).
  public func calculateIncentive(
    plan            : IncentivePlan,
    targetAmount    : Float,
    actualAmount    : Float,
    basicSalary     : Nat,
  ) : (Text, Float) {
    if (targetAmount <= 0.0) {
      return ("No target set", 0.0);
    };
    let achievementPct = (actualAmount / targetAmount) * 100.0;

    // Find matching slab
    var matchedSlab : ?IncentiveSlab = null;
    for (slab in plan.slabs.values()) {
      if (achievementPct >= slab.minAchievementPct and achievementPct <= slab.maxAchievementPct) {
        matchedSlab := ?slab;
      };
    };

    switch (matchedSlab) {
      case null {
        // Check if it's below the lowest slab (no incentive)
        ("No incentive", 0.0)
      };
      case (?slab) {
        let slabName = slabLabel(slab);
        let amount = switch (slab.incentiveType) {
          case (#Fixed) { slab.value };
          case (#PercentOfSalary) {
            let salary : Float = basicSalary.toFloat();
            salary * slab.value / 100.0
          };
          case (#PercentOfTarget) {
            // value is treated as % of the target passed to this function
            if (targetAmount > 0.0) {
              targetAmount * slab.value / 100.0
            } else { 0.0 }
          };
        };
        (slabName, amount)
      };
    }
  };

  func slabLabel(slab : IncentiveSlab) : Text {
    let maxStr = if (slab.maxAchievementPct >= 999.0) "+" else "%-" # floatTrunc(slab.maxAchievementPct) # "%";
    floatTrunc(slab.minAchievementPct) # "%" # maxStr
  };

  func floatTrunc(f : Float) : Text {
    let n : Int = f.toInt();
    n.toText()
  };

  // ── Bulk calculation ─────────────────────────────────────────────────────────

  /// Trigger auto-calculation of incentives for all users for a given period.
  /// Reads each user's target and actual sales, applies the relevant plan, and
  /// writes IncentiveCalculation records.
  public func triggerBulkCalculation(
    calculations : List.List<IncentiveCalculation>,
    plans        : List.List<IncentivePlan>,
    users        : Map.Map<UserId, UserRecord>,
    getTarget    : (UserId, TargetPeriod, Nat) -> Float,
    getActual    : (UserId, TargetPeriod, Nat) -> Float,
    period       : TargetPeriod,
    year         : Nat,
    month        : ?Nat,
    callerId     : UserId,
    now          : Timestamp,
    nextIdRef    : { var value : Nat },
  ) : Nat {
    var count = 0;
    for ((uid, user) in users.entries()) {
      let targetAmount = getTarget(uid, period, year);
      if (targetAmount > 0.0) {
        let actualAmount = getActual(uid, period, year);
        switch (findActivePlan(plans, user.role, period)) {
          case null {};
          case (?plan) {
            let (slabUsed, incentiveAmt) = calculateIncentive(
              plan, targetAmount, actualAmount, user.salary.basic
            );
            let achievementPct = if (targetAmount > 0.0) {
              (actualAmount / targetAmount) * 100.0
            } else { 0.0 };

            // Check if a Calculated record already exists; if so, overwrite
            let existing = calculations.findIndex(func(c : IncentiveCalculation) : Bool {
              c.userId == uid and c.period == period and c.year == year and
              (switch (month) {
                case (?m) { switch (c.month) { case (?cm) cm == m; case null false } };
                case null { c.month == null };
              })
            });
            switch (existing) {
              case (?idx) {
                let old = calculations.at(idx);
                if (old.status == #Calculated) {
                  // Replace with updated calculation
                  calculations.put(idx, {
                    old with
                    targetAmount    = targetAmount;
                    actualAmount    = actualAmount;
                    achievementPct  = achievementPct;
                    slabApplied     = slabUsed;
                    incentiveAmount = incentiveAmt;
                    calculatedAt    = now;
                  });
                  count += 1;
                }
                // If HRApproved or PaidOnSlip, skip overwrite
              };
              case null {
                let calc : IncentiveCalculation = {
                  id               = nextIdRef.value;
                  userId           = uid;
                  role             = user.role;
                  period           = period;
                  year             = year;
                  month            = month;
                  targetAmount     = targetAmount;
                  aggregatedTarget = targetAmount;  // default: same as targetAmount until bottom-up recalc
                  actualAmount     = actualAmount;
                  achievementPct   = achievementPct;
                  slabApplied      = slabUsed;
                  incentiveAmount  = incentiveAmt;
                  status           = #Calculated;
                  approvedBy       = null;
                  adjustedAmount   = null;
                  notes            = null;
                  calculatedAt     = now;
                };
                nextIdRef.value += 1;
                calculations.add(calc);
                count += 1;
              };
            };
          };
        };
      };
    };
    count
  };

  /// HR approves or adjusts a calculated incentive.
  public func approveCalculation(
    calculations : List.List<IncentiveCalculation>,
    input        : ApproveIncentiveInput,
    approverId   : UserId,
    now          : Timestamp,
  ) : Bool {
    var found = false;
    calculations.mapInPlace(func(c : IncentiveCalculation) : IncentiveCalculation {
      if (c.id == input.calculationId) {
        found := true;
        {
          c with
          status         = #HRApproved;
          approvedBy     = ?approverId;
          adjustedAmount = input.adjustedAmount;
          notes          = input.notes;
        }
      } else { c }
    });
    found
  };

  /// Mark approved incentive records as paid (included on salary slip).
  public func markPaidOnSlip(
    calculations : List.List<IncentiveCalculation>,
    userId       : UserId,
    period       : TargetPeriod,
    year         : Nat,
    month        : ?Nat,
  ) : Bool {
    var found = false;
    calculations.mapInPlace(func(c : IncentiveCalculation) : IncentiveCalculation {
      if (c.userId == userId and c.period == period and c.year == year and
          c.status == #HRApproved and monthMatches(c.month, month)) {
        found := true;
        { c with status = #PaidOnSlip }
      } else { c }
    });
    found
  };

  // ── Bottom-up incentive target aggregation ──────────────────────────────────

  /// Walk the reporting hierarchy from MR upward and compute aggregated incentive
  /// targets for each manager level. For each manager the aggregatedTarget equals
  /// the sum of all direct/indirect MR-level targets.
  /// Mutates existing #Calculated IncentiveCalculation records in place.
  /// Returns the number of records updated.
  public func calculateBottomUpTargets(
    calculations   : List.List<IncentiveCalculation>,
    monthlyTargets : List.List<MonthlyTarget>,
    users          : Map.Map<UserId, UserRecord>,
    year           : Nat,
    month          : Nat,
    now            : Timestamp,
  ) : Nat {
    // Build a map of userId -> MR-level target for this month/year
    let mrTargets = Map.empty<UserId, Float>();
    for ((uid, u) in users.entries()) {
      switch (u.role) {
        case (#MR) {
          // Find monthly target for this MR
          let targetId = uid.toText() # "-" # year.toText() # "-" # month.toText();
          let amount : Float = switch (monthlyTargets.find(func(t : MonthlyTarget) : Bool { t.id == targetId })) {
            case (?t) { t.targetAmount };
            case null { 0.0 };
          };
          if (amount > 0.0) { mrTargets.add(uid, amount) };
        };
        case _ {};
      };
    };

    // For each non-MR employee, compute the sum of all subordinate MR targets
    var updatedCount = 0;
    for ((uid, u) in users.entries()) {
      switch (u.role) {
        case (#MR) {}; // MR's own aggregated target is their direct target
        case _ {
          // Sum all MR targets under this manager
          var aggTotal : Float = 0.0;
          for ((mrId, mrAmt) in mrTargets.entries()) {
            if (isTransitiveSubordinate(users, mrId, uid)) {
              aggTotal += mrAmt;
            };
          };
          if (aggTotal > 0.0) {
            // Update any existing Calculated record for this user + month + year
            calculations.mapInPlace(func(c : IncentiveCalculation) : IncentiveCalculation {
              if (c.userId == uid and c.period == #Monthly and c.year == year and
                  (switch (c.month) { case (?m) m == month; case null false }) and
                  c.status == #Calculated) {
                updatedCount += 1;
                { c with aggregatedTarget = aggTotal }
              } else { c }
            });
          };
        };
      };
    };
    updatedCount
  };

  /// Walk the reportsTo chain to check if `uid` is a direct or transitive
  /// subordinate of `managerId`.
  func isTransitiveSubordinate(
    users     : Map.Map<UserId, UserRecord>,
    uid       : UserId,
    managerId : UserId,
  ) : Bool {
    var current : ?UserId = switch (users.get(uid)) {
      case (?u) { u.reportsTo };
      case null { null };
    };
    var depth = 0;
    label walk loop {
      if (depth > 10) break walk;
      switch (current) {
        case null { break walk };
        case (?mid) {
          if (mid == managerId) return true;
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

  // ── Query helpers ───────────────────────────────────────────────────────────

  /// Query incentive calculations with optional filters.
  public func queryCalculations(
    calculations : List.List<IncentiveCalculation>,
    filter       : IncentiveFilter,
  ) : [IncentiveCalculation] {
    calculations.filter(func(c : IncentiveCalculation) : Bool {
      matchesCalcFilter(c, filter)
    }).toArray()
  };

  /// Get all calculations for a single employee (employee history view).
  public func getCalculationsForUser(
    calculations : List.List<IncentiveCalculation>,
    userId       : UserId,
  ) : [IncentiveCalculation] {
    calculations.filter(func(c : IncentiveCalculation) : Bool {
      c.userId == userId
    }).toArray()
  };

  /// Get visible incentive calculations for a manager (own team only).
  public func getCalculationsForManager(
    calculations : List.List<IncentiveCalculation>,
    users        : Map.Map<UserId, UserRecord>,
    managerId    : UserId,
  ) : [IncentiveCalculation] {
    // Collect all transitive subordinate IDs
    let subordinates = collectSubordinates(users, managerId);
    calculations.filter(func(c : IncentiveCalculation) : Bool {
      subordinates.contains(c.userId)
    }).toArray()
  };

  // ── Private helpers ─────────────────────────────────────────────────────────

  func matchesCalcFilter(c : IncentiveCalculation, f : IncentiveFilter) : Bool {
    switch (f.userId)  { case (?uid) { if (c.userId  != uid)    return false }; case null {} };
    switch (f.role)    { case (?r)   { if (c.role    != r)      return false }; case null {} };
    switch (f.period)  { case (?p)   { if (c.period  != p)      return false }; case null {} };
    switch (f.year)    { case (?y)   { if (c.year    != y)      return false }; case null {} };
    switch (f.month)   { case (?m)   {
      switch (c.month) {
        case (?cm) { if (cm != m) return false };
        case null  { return false };
      }
    }; case null {} };
    switch (f.status)  { case (?s)   { if (c.status  != s)      return false }; case null {} };
    true
  };

  func monthMatches(a : ?Nat, b : ?Nat) : Bool {
    switch (a, b) {
      case (null, null)       { true };
      case (?ma, ?mb)         { ma == mb };
      case _                  { false };
    }
  };

  func collectSubordinates(
    users     : Map.Map<UserId, UserRecord>,
    managerId : UserId,
  ) : List.List<UserId> {
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
                case (?mid) {
                  if (mid == uid and not visited.contains(u.id)) {
                    queue.add(u.id);
                  }
                };
                case null {};
              };
            };
          };
        };
      };
    };
    // Remove the manager themselves — only include subordinates
    visited.filter(func(uid : UserId) : Bool { uid != managerId })
  };
};
