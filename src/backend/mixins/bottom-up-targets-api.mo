import BUTLib    "../lib/bottom-up-targets";
import AuthLib   "../lib/auth-users";
import Types     "../types/bottom-up-targets";
import HistTypes "../types/target-history";
import AuthTypes  "../types/auth-users";
import CrmTypes   "../types/crm";
import LocTypes   "../types/location-master";
import CommonTypes "../types/common";
import Map        "mo:core/Map";
import List       "mo:core/List";
import Time       "mo:core/Time";

/// Public API mixin for the Bottom-Up Target Calculation feature.
/// Injected state: sessions, users, territories, areas, bottomUpTargets,
/// targetAdjLogs (for history logging), crmBizReports (for actuals),
/// nextBottomUpTargetId, nextAdjLogId.
mixin (
  sessions             : Map.Map<Text, AuthTypes.Session>,
  users                : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
  territories          : Map.Map<Nat, LocTypes.TerritoryRecord>,
  areas                : Map.Map<Nat, LocTypes.AreaRecord>,
  bottomUpTargets      : List.List<Types.BottomUpTarget>,
  targetAdjLogs        : List.List<HistTypes.TargetAdjustmentLog>,
  crmBizReports        : List.List<CrmTypes.BusinessReport>,
  nextBottomUpTargetId : { var val : Nat },
  nextAdjLogId         : { var value : Nat },
) {

  // ── Role helpers ─────────────────────────────────────────────────────────────

  func butIsAdminOrHR(role : AuthTypes.Role) : Bool {
    switch (role) {
      case (#Admin or #HRManager) { true };
      case _ { false };
    }
  };

  func isBUTAdmin(role : AuthTypes.Role) : Bool {
    switch (role) {
      case (#Admin) { true };
      case _ { false };
    }
  };

  // ── Public endpoints ─────────────────────────────────────────────────────────

  /// Assign or update an MR-level target (Admin/HR only).
  /// Returns the new target's id on success.
  public shared func setMrTarget(
    token : Text,
    input : Types.CreateBottomUpTargetInput,
  ) : async { #ok : Nat; #err : Text } {
    switch (AuthLib.validateSession(sessions, token, Time.now())) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        if (not butIsAdminOrHR(session.role)) {
          return #err("Access denied: Admin or HR Manager required");
        };
        // Validate that the target user is an MR
        switch (users.get(input.userId)) {
          case null { return #err("User not found") };
          case (?u) {
            if (u.role != #MR) {
              return #err("Target user must have the MR role");
            };
          };
        };
        let callerId = session.userId;
        let now      = Time.now();
        let nextId   = nextBottomUpTargetId.val;
        let (_, newTarget) = BUTLib.setMrTarget(
          bottomUpTargets, users, targetAdjLogs, input, callerId, now, nextId, nextAdjLogId
        );
        // Advance ID only if we created a new record (id == nextId means new)
        if (newTarget.id == nextId) {
          nextBottomUpTargetId.val += 1;
        };
        #ok(newTarget.id)
      };
    }
  };

  /// Manually override an auto-calculated target amount (Admin only).
  public shared func overrideTarget(
    token : Text,
    input : Types.OverrideBottomUpTargetInput,
  ) : async CommonTypes.MutationResult {
    switch (AuthLib.validateSession(sessions, token, Time.now())) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        if (not isBUTAdmin(session.role)) {
          return #err("Access denied: Admin only");
        };
        // Verify target exists
        let found = bottomUpTargets.find(func(t : Types.BottomUpTarget) : Bool {
          t.id == input.targetId
        });
        switch (found) {
          case null { #err("Target not found") };
          case _ {
            let _ = BUTLib.overrideTarget(
              bottomUpTargets, targetAdjLogs, input, session.userId, Time.now(), nextAdjLogId
            );
            #ok
          };
        }
      };
    }
  };

  /// Remove a manual override and revert to auto-calculated value (Admin only).
  public shared func undoOverride(
    token    : Text,
    targetId : Nat,
  ) : async CommonTypes.MutationResult {
    switch (AuthLib.validateSession(sessions, token, Time.now())) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        if (not isBUTAdmin(session.role)) {
          return #err("Access denied: Admin only");
        };
        let found = bottomUpTargets.find(func(t : Types.BottomUpTarget) : Bool {
          t.id == targetId
        });
        switch (found) {
          case null { #err("Target not found") };
          case _ {
            let _ = BUTLib.undoOverride(
              bottomUpTargets, targetId, users, session.userId, Time.now()
            );
            #ok
          };
        }
      };
    }
  };

  /// Return the hierarchy tree from the requestor's perspective.
  /// MR sees own node only; managers see their chain; Admin/HR see the full tree.
  public shared func getTargetHierarchy(
    token : Text,
  ) : async [Types.TargetHierarchyNode] {
    switch (AuthLib.validateSession(sessions, token, Time.now())) {
      case null { [] };
      case (?session) {
        BUTLib.getHierarchy(
          bottomUpTargets, users, territories, areas,
          session.role, session.userId
        )
      };
    }
  };

  /// Return a single employee's target for the given period and year.
  /// Any authenticated user can call this; they receive their own target only.
  public shared func getMyTarget(
    token  : Text,
    period : Types.TargetPeriod,
    year   : Nat,
  ) : async ?Types.BottomUpTarget {
    switch (AuthLib.validateSession(sessions, token, Time.now())) {
      case null { null };
      case (?session) {
        bottomUpTargets.find(func(t : Types.BottomUpTarget) : Bool {
          t.userId == session.userId and t.period == period and t.year == year
        })
      };
    }
  };

  /// Generate the Bottom-Up Target Summary Report rows (Admin/HR only).
  public shared func getSummaryReport(
    token           : Text,
    filterTerritory : ?Text,
    filterArea      : ?Text,
    filterRole      : ?Types.Role,
  ) : async [Types.BottomUpTargetSummaryRow] {
    switch (AuthLib.validateSession(sessions, token, Time.now())) {
      case null { [] };
      case (?session) {
        if (not butIsAdminOrHR(session.role)) { return [] };
        BUTLib.getSummaryRows(
          bottomUpTargets, users, territories, areas,
          filterTerritory, filterArea, filterRole
        )
      };
    }
  };

  /// Return every BottomUpTarget record in the system (Admin/HR only).
  public shared func listAllBottomUpTargets(
    token : Text,
  ) : async [Types.BottomUpTarget] {
    switch (AuthLib.validateSession(sessions, token, Time.now())) {
      case null { [] };
      case (?session) {
        if (not butIsAdminOrHR(session.role)) { return [] };
        bottomUpTargets.toArray()
      };
    }
  };

  /// Target vs. Actual Performance Dashboard.
  /// Returns a flat list of all subordinates (direct and indirect) with their
  /// target, actual sales, achievement %, remaining target, and projected achievement.
  /// Admin/HR: pass managerId = 0 (or any userId) to get all employees.
  /// Managers: pass their own userId to get their team.
  /// drillDownFrom: optional sub-manager to filter to that manager's team.
  public shared func getTargetVsActualPerformance(
    token  : Text,
    filter : Types.PerformanceFilter,
  ) : async [Types.PerformanceRow] {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { [] };
      case (?session) {
        // Determine whose subordinates to show
        let rootId = if (butIsAdminOrHR(session.role)) {
          // Admin/HR see everyone
          null : ?AuthTypes.UserId
        } else {
          ?session.userId
        };

        // Collect target users: subordinates of rootId, or all users for Admin/HR
        let targetUsers = collectPerformanceUsers(rootId, filter.drillDownFrom);

        // Compute elapsed fraction of the period for performance status
        let now = Time.now();
        let elapsedPct = elapsedPeriodPercent(filter.period, filter.year, filter.month, now);

        let rows = List.empty<Types.PerformanceRow>();
        for (uid in targetUsers.values()) {
          switch (users.get(uid)) {
            case null {};
            case (?u) {
              // Get target for this user/period/year
              let targetAmt : Float = switch (
                bottomUpTargets.find(func(t : Types.BottomUpTarget) : Bool {
                  t.userId == uid and t.period == filter.period and t.year == filter.year
                })
              ) {
                case (?t) { t.targetAmount.toFloat() };
                case null { 0.0 };
              };

              // Get actual sales from CRM business reports
              let actualSales = sumActualSales(uid, filter.period, filter.year, filter.month);

              let achievementPct = if (targetAmt > 0.0) {
                (actualSales / targetAmt) * 100.0
              } else { 0.0 };

              let remainingTarget = if (targetAmt > actualSales) targetAmt - actualSales else 0.0;

              // Projected: dailyAvg * totalDaysInPeriod
              let daysElapsed = elapsedDays(filter.period, filter.year, filter.month, now);
              let dailyAvg = if (daysElapsed > 0.0) actualSales / daysElapsed else 0.0;
              let totalDays = totalPeriodDays(filter.period, filter.year, filter.month);
              let projected = dailyAvg * totalDays;

              let perfStatus = classifyPerformance(achievementPct, elapsedPct);

              // Get territory/area
              let terrName : ?Text = if (u.territoryIds.size() > 0) {
                switch (territories.get(u.territoryIds[0])) {
                  case (?tr) { ?tr.name };
                  case null  { null };
                }
              } else if (u.territory != "") { ?u.territory } else { null };

              let areaName : ?Text = if (u.areaIds.size() > 0) {
                switch (areas.get(u.areaIds[0])) {
                  case (?ar) { ?ar.name };
                  case null  { null };
                }
              } else { null };

              rows.add({
                userId               = uid;
                employeeId           = u.employeeId;
                name                 = u.name;
                role                 = u.role;
                territory            = terrName;
                area                 = areaName;
                targetAmount         = targetAmt;
                actualSales          = actualSales;
                achievementPct       = achievementPct;
                remainingTarget      = remainingTarget;
                projectedAchievement = projected;
                performanceStatus    = perfStatus;
              });
            };
          };
        };
        rows.toArray()
      };
    }
  };

  // ── Performance helpers ──────────────────────────────────────────────────────

  func collectPerformanceUsers(
    rootId       : ?AuthTypes.UserId,
    drillDownFrom : ?AuthTypes.UserId,
  ) : List.List<AuthTypes.UserId> {
    let startFrom : AuthTypes.UserId = switch (drillDownFrom) {
      case (?ddId) { ddId };
      case null {
        switch (rootId) {
          case (?rid) { rid };
          case null   { 0 }; // Admin/HR: collect all
        }
      };
    };

    switch (rootId) {
      case null {
        // Admin/HR: all users
        let all = List.empty<AuthTypes.UserId>();
        for ((uid, _) in users.entries()) { all.add(uid) };
        all
      };
      case (?_) {
        // BFS all subordinates under startFrom (inclusive of startFrom)
        let visited = List.empty<AuthTypes.UserId>();
        let queue   = List.empty<AuthTypes.UserId>();
        queue.add(startFrom);
        label bfs loop {
          switch (queue.removeLast()) {
            case null   { break bfs };
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
        // Remove the manager themselves — show only their team
        visited.filter(func(uid : AuthTypes.UserId) : Bool { uid != startFrom })
      };
    }
  };

  func sumActualSales(
    uid    : AuthTypes.UserId,
    period : Types.TargetPeriod,
    year   : Nat,
    month  : ?Nat,
  ) : Float {
    var total : Float = 0.0;
    // Access crmBusinessReports via a closure over the injected state
    // We iterate bottomUpTargets-adjacent state — use the CRM mixin's data
    // through the shared `crmBusinessReports` state (injected below)
    for (r in crmBizReports.values()) {
      if (r.userId == uid and r.year == year) {
        let inPeriod : Bool = switch (period) {
          case (#Monthly)    {
            switch (month) {
              case (?m) { r.month == m };
              case null { true };
            }
          };
          case (#Quarterly)  { true };
          case (#HalfYearly) { true };
          case (#Yearly)     { true };
        };
        if (inPeriod) { total += r.actualSales };
      };
    };
    total
  };

  func elapsedDays(
    period : Types.TargetPeriod,
    year   : Nat,
    month  : ?Nat,
    now    : Int,
  ) : Float {
    let nowSec : Int = now / 1_000_000_000;
    let epochDays : Int = nowSec / 86400;

    // Get period start in days since epoch
    let startDays : Int = switch (period) {
      case (#Monthly) {
        let m = switch (month) { case (?m) m; case null 1 };
        dateToDays(year, m, 1)
      };
      case (#Quarterly) {
        dateToDays(year, 1, 1)
      };
      case (#HalfYearly) {
        dateToDays(year, 1, 1)
      };
      case (#Yearly) {
        dateToDays(year, 1, 1)
      };
    };
    let elapsed : Int = epochDays - startDays;
    if (elapsed > 0) elapsed.toFloat() else 1.0
  };

  func totalPeriodDays(
    period : Types.TargetPeriod,
    year   : Nat,
    month  : ?Nat,
  ) : Float {
    switch (period) {
      case (#Monthly) {
        let m = switch (month) { case (?m) m; case null 1 };
        daysInMonth(year, m).toFloat()
      };
      case (#Quarterly)  { 91.0 };
      case (#HalfYearly) { 182.0 };
      case (#Yearly)     { 365.0 };
    }
  };

  func elapsedPeriodPercent(
    period : Types.TargetPeriod,
    year   : Nat,
    month  : ?Nat,
    now    : Int,
  ) : Float {
    let elapsed = elapsedDays(period, year, month, now);
    let total   = totalPeriodDays(period, year, month);
    if (total > 0.0) (elapsed / total) * 100.0 else 0.0
  };

  func classifyPerformance(achievementPct : Float, elapsedPct : Float) : Types.PerformanceStatus {
    if (achievementPct >= elapsedPct) { #OnTrack }
    else if (achievementPct >= elapsedPct * 0.85) { #SlightlyBehind }
    else { #SignificantlyBehind }
  };

  func dateToDays(year : Nat, month : Nat, day : Nat) : Int {
    // Gregorian days since Unix epoch (1970-01-01)
    let y : Int = if (month <= 2) year.toInt() - 1 else year.toInt();
    let m : Int = if (month <= 2) month.toInt() + 9 else month.toInt() - 3;
    let era : Int = (if (y >= 0) y else y - 399) / 400;
    let yoe : Int = y - era * 400;
    let doy : Int = (153 * m + 2) / 5 + day.toInt() - 1;
    let doe : Int = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146097 + doe - 719468
  };

  func daysInMonth(year : Nat, month : Nat) : Nat {
    switch (month) {
      case 1  { 31 };
      case 2  { if (isLeapYear(year)) 29 else 28 };
      case 3  { 31 };
      case 4  { 30 };
      case 5  { 31 };
      case 6  { 30 };
      case 7  { 31 };
      case 8  { 31 };
      case 9  { 30 };
      case 10 { 31 };
      case 11 { 30 };
      case 12 { 31 };
      case _  { 30 };
    }
  };

  func isLeapYear(year : Nat) : Bool {
    (year % 4 == 0 and year % 100 != 0) or (year % 400 == 0)
  };
};
