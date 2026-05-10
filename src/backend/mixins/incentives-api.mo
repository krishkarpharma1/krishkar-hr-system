import Types        "../types/incentives";
import AuthTypes    "../types/auth-users";
import CrmTypes     "../types/crm";
import MTargetTypes "../types/monthly-targets";
import AuthLib      "../lib/auth-users";
import Lib          "../lib/incentives";
import MTLib        "../lib/monthly-targets";
import List         "mo:core/List";
import Map          "mo:core/Map";
import Time         "mo:core/Time";
import Runtime      "mo:core/Runtime";

/// Public API surface for the Incentive Program.
/// Incentive calculation now uses Monthly Sales Targets as the base amount
/// for #PercentOfTarget slabs (replaces bottom-up target lookup).
mixin (
  sessions           : Map.Map<Text, AuthTypes.Session>,
  users              : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
  incentivePlans     : List.List<Types.IncentivePlan>,
  incentiveCalcs     : List.List<Types.IncentiveCalculation>,
  monthlyTargets     : List.List<MTargetTypes.MonthlyTarget>,
  crmBusinessReports : List.List<CrmTypes.BusinessReport>,
  nextPlanId         : { var value : Nat },
  nextCalcId         : { var value : Nat },
) {

  // ── Role helpers ─────────────────────────────────────────────────────────────

  func incIsAdminOrHR(role : AuthTypes.Role) : Bool {
    switch (role) {
      case (#Admin or #HRManager) { true };
      case _                      { false };
    }
  };

  func incIsManager(role : AuthTypes.Role) : Bool {
    switch (role) {
      case (#ASM or #RSM or #ZSM or #Admin or #HRManager) { true };
      case _ { false };
    }
  };

  // ── Internal helpers ─────────────────────────────────────────────────────────

  /// Get the monthly target amount for a user+month+year from the new Monthly Targets module.
  func getMonthlyTargetAmount(uid : AuthTypes.UserId, year : Nat, month : Nat) : Float {
    MTLib.getTargetAmount(monthlyTargets, uid, month, year)
  };

  /// Get total actual sales for a user+month+year from CRM business reports.
  func getActualForMonth(uid : AuthTypes.UserId, year : Nat, month : Nat) : Float {
    var total : Float = 0.0;
    for (r in crmBusinessReports.values()) {
      if (r.userId == uid and r.year == year and r.month == month) {
        total += r.actualSales;
      };
    };
    total
  };

  /// Get total actual sales for a user+year (all months combined).
  func getActualForYear(uid : AuthTypes.UserId, year : Nat) : Float {
    var total : Float = 0.0;
    for (r in crmBusinessReports.values()) {
      if (r.userId == uid and r.year == year) {
        total += r.actualSales;
      };
    };
    total
  };

  // ── Plan management (Admin / HR) ─────────────────────────────────────────────

  /// Create a new role- and period-specific incentive plan.
  /// month (1-12) and year fields allow configuring a separate plan for each month.
  /// Pass month=0 or year=0 to create a plan that applies to all months/years.
  public shared func createIncentivePlan(
    token : Text,
    input : Types.CreateIncentivePlanInput,
  ) : async { #ok : Types.IncentivePlan; #err : Text } {
    switch (AuthLib.validateSession(sessions, token, Time.now())) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        if (not incIsAdminOrHR(session.role)) {
          return #err("Access denied: Admin or HR required");
        };
        let plan = Lib.createPlan(
          incentivePlans, input, session.userId, Time.now(), nextPlanId.value
        );
        nextPlanId.value += 1;
        #ok(plan)
      };
    }
  };

  /// Update slabs or activation flag on an existing plan.
  public shared func updateIncentivePlan(
    token : Text,
    input : Types.UpdateIncentivePlanInput,
  ) : async { #ok; #err : Text } {
    switch (AuthLib.validateSession(sessions, token, Time.now())) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        if (not incIsAdminOrHR(session.role)) {
          return #err("Access denied: Admin or HR required");
        };
        if (Lib.updatePlan(incentivePlans, input, Time.now())) {
          #ok
        } else {
          #err("Incentive plan not found")
        }
      };
    }
  };

  /// Deactivate an incentive plan (soft delete).
  public shared func deactivateIncentivePlan(
    token  : Text,
    planId : Nat,
  ) : async { #ok; #err : Text } {
    switch (AuthLib.validateSession(sessions, token, Time.now())) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        if (not incIsAdminOrHR(session.role)) {
          return #err("Access denied: Admin or HR required");
        };
        if (Lib.deactivatePlan(incentivePlans, planId, Time.now())) {
          #ok
        } else {
          #err("Incentive plan not found")
        }
      };
    }
  };

  /// List all incentive plans, optionally filtered by role and/or period.
  public shared func listIncentivePlans(
    token  : Text,
    role   : ?Types.Role,
    period : ?Types.TargetPeriod,
  ) : async [Types.IncentivePlan] {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { [] };
      case (?session) {
        if (not incIsAdminOrHR(session.role)) { return [] };
        Lib.listPlans(incentivePlans, role, period)
      };
    }
  };

  // ── Bottom-up incentive target aggregation ─────────────────────────────────

  /// Walk the reporting hierarchy from MR upward and aggregate incentive targets.
  /// For each manager, their aggregated target = sum of all direct/indirect MR targets.
  /// Updates the aggregatedTarget field on existing IncentiveCalculation records.
  /// Admin/HR only.
  public shared func calculateBottomUpIncentiveTargets(
    token : Text,
    year  : Nat,
    month : Nat,
  ) : async { #ok : Nat; #err : Text } {
    switch (AuthLib.validateSession(sessions, token, Time.now())) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        if (not incIsAdminOrHR(session.role)) {
          return #err("Access denied: Admin or HR required");
        };
        let count = Lib.calculateBottomUpTargets(
          incentiveCalcs, monthlyTargets, users, year, month, Time.now()
        );
        #ok(count)
      };
    }
  };

  // ── Calculation triggers (HR only) ───────────────────────────────────────────

  /// Trigger auto-calculation of incentives for all employees for a given period.
  /// For Monthly period, the base target is fetched from the Monthly Sales Targets module.
  public shared func triggerIncentiveCalculation(
    token  : Text,
    period : Types.TargetPeriod,
    year   : Nat,
    month  : ?Nat,
  ) : async { #ok : Nat; #err : Text } {
    switch (AuthLib.validateSession(sessions, token, Time.now())) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        if (not incIsAdminOrHR(session.role)) {
          return #err("Access denied: HR or Admin required");
        };
        // For Monthly period: use monthly target + actual for that specific month
        // For other periods (Quarterly, HalfYearly, Yearly): sum across relevant months
        let getTarget = func(uid : AuthTypes.UserId, per : Types.TargetPeriod, yr : Nat) : Float {
          switch (per) {
            case (#Monthly) {
              switch (month) {
                case (?m) { getMonthlyTargetAmount(uid, yr, m) };
                case null { 0.0 };
              }
            };
            case (#Quarterly) {
              // Sum all monthly targets for the year (simple yearly rollup)
              var total : Float = 0.0;
              for (m in [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].values()) {
                total += getMonthlyTargetAmount(uid, yr, m);
              };
              total
            };
            case (#HalfYearly) {
              var total : Float = 0.0;
              for (m in [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].values()) {
                total += getMonthlyTargetAmount(uid, yr, m);
              };
              total
            };
            case (#Yearly) {
              var total : Float = 0.0;
              for (m in [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].values()) {
                total += getMonthlyTargetAmount(uid, yr, m);
              };
              total
            };
          }
        };
        let getActual = func(uid : AuthTypes.UserId, per : Types.TargetPeriod, yr : Nat) : Float {
          switch (per) {
            case (#Monthly) {
              switch (month) {
                case (?m) { getActualForMonth(uid, yr, m) };
                case null { 0.0 };
              }
            };
            case _ { getActualForYear(uid, yr) };
          }
        };
        let count = Lib.triggerBulkCalculation(
          incentiveCalcs, incentivePlans, users,
          getTarget, getActual,
          period, year, month,
          session.userId, Time.now(), nextCalcId
        );
        #ok(count)
      };
    }
  };

  /// HR approves or adjusts a single incentive calculation.
  public shared func approveIncentiveCalculation(
    token : Text,
    input : Types.ApproveIncentiveInput,
  ) : async { #ok; #err : Text } {
    switch (AuthLib.validateSession(sessions, token, Time.now())) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        if (not incIsAdminOrHR(session.role)) {
          return #err("Access denied: HR or Admin required");
        };
        if (Lib.approveCalculation(incentiveCalcs, input, session.userId, Time.now())) {
          #ok
        } else {
          #err("Incentive calculation not found")
        }
      };
    }
  };

  // ── Query / visibility ───────────────────────────────────────────────────────

  /// Any authenticated user: get their own incentive calculations.
  public shared func getMyIncentives(
    token  : Text,
    filter : Types.IncentiveFilter,
  ) : async [Types.IncentiveCalculation] {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { [] };
      case (?session) {
        let ownFilter : Types.IncentiveFilter = {
          filter with userId = ?session.userId
        };
        Lib.queryCalculations(incentiveCalcs, ownFilter)
      };
    }
  };

  /// Manager: get incentive calculations for all direct/indirect reportees.
  public shared func getTeamIncentives(
    token  : Text,
    filter : Types.IncentiveFilter,
  ) : async [Types.IncentiveCalculation] {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { [] };
      case (?session) {
        if (not incIsManager(session.role)) { return [] };
        Lib.getCalculationsForManager(incentiveCalcs, users, session.userId)
      };
    }
  };

  /// Admin / HR: get incentive calculations across all employees.
  public shared func getAllIncentiveCalculations(
    token  : Text,
    filter : Types.IncentiveFilter,
  ) : async [Types.IncentiveCalculation] {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { [] };
      case (?session) {
        if (not incIsAdminOrHR(session.role)) { return [] };
        Lib.queryCalculations(incentiveCalcs, filter)
      };
    }
  };

  /// Export incentive report as flat array (Excel source data).
  public shared func exportIncentiveReport(
    token  : Text,
    filter : Types.IncentiveFilter,
  ) : async [Types.IncentiveCalculation] {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { [] };
      case (?session) {
        if (not incIsAdminOrHR(session.role)) { return [] };
        Lib.queryCalculations(incentiveCalcs, filter)
      };
    }
  };

  /// Get the projected incentive for the current period (employee dashboard widget).
  public shared func getMyProjectedIncentive(
    token  : Text,
    period : Types.TargetPeriod,
    year   : Nat,
    month  : ?Nat,
  ) : async ?Types.IncentiveCalculation {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { null };
      case (?session) {
        let uid = session.userId;
        incentiveCalcs.find(func(c : Types.IncentiveCalculation) : Bool {
          c.userId == uid and c.period == period and c.year == year and
          (switch (month) {
            case (?m) { switch (c.month) { case (?cm) cm == m; case null false } };
            case null { c.month == null };
          })
        })
      };
    }
  };

  /// HR: mark an approved incentive as paid on salary slip.
  public shared func markIncentivePaidOnSlip(
    token  : Text,
    userId : AuthTypes.UserId,
    period : Types.TargetPeriod,
    year   : Nat,
    month  : ?Nat,
  ) : async { #ok; #err : Text } {
    switch (AuthLib.validateSession(sessions, token, Time.now())) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        if (not incIsAdminOrHR(session.role)) {
          return #err("Access denied: HR or Admin required");
        };
        if (Lib.markPaidOnSlip(incentiveCalcs, userId, period, year, month)) {
          #ok
        } else {
          #err("No approved incentive found for the given criteria")
        }
      };
    }
  };
};
