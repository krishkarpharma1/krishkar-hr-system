import Types      "../types/monthly-targets";
import AuthTypes   "../types/auth-users";
import CrmTypes    "../types/crm";
import LocTypes    "../types/location-master";
import CommonTypes "../types/common";
import FieldTypes  "../types/field-ops";
import DcrTypes    "../types/dcr";
import CCTypes     "../types/chemist-call";
import AuthLib     "../lib/auth-users";
import Lib         "../lib/monthly-targets";
import Map         "mo:core/Map";
import List        "mo:core/List";
import Time        "mo:core/Time";
import Text        "mo:core/Text";

/// Public API mixin for the Monthly Sales Target feature.
/// Replaces the monthly-level calculations of the old bottom-up target system.
/// Admin and HR are excluded from target assignment (field staff only: MR, ASM, RSM, ZSM).
mixin (
  sessions           : Map.Map<Text, AuthTypes.Session>,
  users              : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
  territories        : Map.Map<Nat, LocTypes.TerritoryRecord>,
  areas              : Map.Map<Nat, LocTypes.AreaRecord>,
  monthlyTargets     : List.List<Types.MonthlyTarget>,
  crmBusinessReports : List.List<CrmTypes.BusinessReport>,
  doctors            : List.List<FieldTypes.Doctor>,
  reports            : List.List<FieldTypes.CallReport>,
  chemistCalls       : List.List<CCTypes.ChemistCallRecord>,
  stockistCalls      : List.List<CCTypes.StockistCallRecord>,
) {

  func mtIsAdminOrHR(role : AuthTypes.Role) : Bool {
    switch (role) {
      case (#Admin or #HRManager) { true };
      case _ { false };
    }
  };

  func mtIsFieldStaff(role : AuthTypes.Role) : Bool {
    switch (role) {
      case (#MR or #ASM or #RSM or #ZSM) { true };
      case _ { false };
    }
  };

  func mtIsManager(role : AuthTypes.Role) : Bool {
    switch (role) {
      case (#ASM or #RSM or #ZSM or #Admin or #HRManager) { true };
      case _ { false };
    }
  };

  /// Look up a user's role from the users map.
  func getUserRole(uid : AuthTypes.UserId) : AuthTypes.Role {
    switch (users.get(uid)) {
      case (?u) { u.role };
      case null { #MR };
    }
  };

  /// Set or revise a monthly target for a single field staff employee (Admin/HR only).
  public shared func setMonthlyTarget(
    token : Text,
    input : Types.SetMonthlyTargetInput,
  ) : async { #ok : Types.MonthlyTarget; #err : Text } {
    switch (AuthLib.validateSession(sessions, token, Time.now())) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        if (not mtIsAdminOrHR(session.role)) {
          return #err("Access denied: Admin or HR required");
        };
        // Verify target employee is field staff only
        let targetRole = getUserRole(input.userId);
        if (not mtIsFieldStaff(targetRole)) {
          return #err("Target assignment is only allowed for MR, ASM, RSM, or ZSM roles");
        };
        let target = Lib.setTargetWithRole(
          monthlyTargets, input, targetRole, session.userId, Time.now()
        );
        #ok(target)
      };
    }
  };

  /// Set monthly targets for multiple employees at once for one month/year (Admin/HR only).
  public shared func bulkSetMonthlyTargets(
    token : Text,
    input : Types.BulkSetMonthlyTargetsInput,
  ) : async { #ok : Nat; #err : Text } {
    switch (AuthLib.validateSession(sessions, token, Time.now())) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        if (not mtIsAdminOrHR(session.role)) {
          return #err("Access denied: Admin or HR required");
        };
        // Filter rows to field staff only
        let fieldRows = input.rows.filter(func(row : Types.BulkTargetRow) : Bool {
          mtIsFieldStaff(getUserRole(row.userId))
        });
        let filteredInput : Types.BulkSetMonthlyTargetsInput = {
          input with rows = fieldRows
        };
        let count = Lib.bulkSetTargets(
          monthlyTargets, users, filteredInput, session.userId, Time.now()
        );
        #ok(count)
      };
    }
  };

  /// Get a single employee's monthly target (by userId + month + year).
  /// Field staff: own target only. Managers: any subordinate. Admin/HR: any.
  public shared func getMonthlyTarget(
    token  : Text,
    userId : AuthTypes.UserId,
    month  : Nat,
    year   : Nat,
  ) : async ?Types.MonthlyTarget {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { null };
      case (?session) {
        let allowed = mtIsAdminOrHR(session.role) or
                      session.userId == userId or
                      (mtIsManager(session.role) and isSubordinateOf(userId, session.userId));
        if (not allowed) return null;
        Lib.getTarget(monthlyTargets, userId, month, year)
      };
    }
  };

  /// Get the caller's own monthly target for the given month/year.
  public shared func getMyMonthlyTarget(
    token : Text,
    month : Nat,
    year  : Nat,
  ) : async ?Types.MonthlyTarget {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { null };
      case (?session) {
        Lib.getTarget(monthlyTargets, session.userId, month, year)
      };
    }
  };

  /// List monthly targets with filters (role, month, year, territory, area).
  /// Admin/HR: full access. Managers: own team only. Others: own records only.
  public shared func listMonthlyTargets(
    token  : Text,
    filter : Types.MonthlyTargetFilter,
  ) : async [Types.MonthlyTarget] {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { [] };
      case (?session) {
        // Scope filter based on role
        let scopedFilter : Types.MonthlyTargetFilter = if (mtIsAdminOrHR(session.role)) {
          filter
        } else if (mtIsManager(session.role)) {
          // Managers may only see their team; if a userId is specified, verify it's a subordinate
          switch (filter.userId) {
            case (?uid) {
              if (not isSubordinateOf(uid, session.userId)) {
                return []
              };
              filter
            };
            case null {
              // No specific user requested — return all subordinates' targets below
              let allTargets = Lib.listTargets(monthlyTargets, users, filter);
              return allTargets.filter(func(t : Types.MonthlyTarget) : Bool {
                isSubordinateOf(t.userId, session.userId)
              });
            };
          }
        } else {
          // Field staff — own records only
          { filter with userId = ?session.userId }
        };
        Lib.listTargets(monthlyTargets, users, scopedFilter)
      };
    }
  };

  /// Get the full revision history for a specific employee + month + year.
  public shared func getTargetRevisionHistory(
    token  : Text,
    userId : AuthTypes.UserId,
    month  : Nat,
    year   : Nat,
  ) : async [Types.TargetRevision] {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { [] };
      case (?session) {
        if (not mtIsAdminOrHR(session.role) and session.userId != userId) {
          return []
        };
        Lib.getRevisionHistory(monthlyTargets, userId, month, year)
      };
    }
  };

  /// Get target vs. actual for the calling employee.
  public shared func getMyTargetVsActual(
    token : Text,
    month : Nat,
    year  : Nat,
  ) : async Types.TargetVsActual {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null {
        { userId = 0; employeeId = ""; name = ""; role = #MR;
          territory = null; area = null; month; year;
          targetAmount = 0.0; actualAmount = 0.0;
          achievementPct = 0.0; remainingTarget = 0.0 }
      };
      case (?session) {
        Lib.getTargetVsActual(
          monthlyTargets, users, territories, areas,
          crmBusinessReports, session.userId, month, year
        )
      };
    }
  };

  /// Get target vs. actual for a specific employee (manager/Admin/HR use).
  public shared func getEmployeeTargetVsActual(
    token  : Text,
    userId : AuthTypes.UserId,
    month  : Nat,
    year   : Nat,
  ) : async Types.TargetVsActual {
    let empty : Types.TargetVsActual = {
      userId = userId; employeeId = ""; name = ""; role = #MR;
      territory = null; area = null; month; year;
      targetAmount = 0.0; actualAmount = 0.0;
      achievementPct = 0.0; remainingTarget = 0.0
    };
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { empty };
      case (?session) {
        let allowed = mtIsAdminOrHR(session.role) or
                      session.userId == userId or
                      (mtIsManager(session.role) and isSubordinateOf(userId, session.userId));
        if (not allowed) return empty;
        Lib.getTargetVsActual(
          monthlyTargets, users, territories, areas,
          crmBusinessReports, userId, month, year
        )
      };
    }
  };

  /// Get team-wide target vs. actual for a manager, or all field staff for Admin/HR.
  public shared func getTeamTargetVsActual(
    token : Text,
    month : Nat,
    year  : Nat,
  ) : async [Types.TargetVsActual] {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { [] };
      case (?session) {
        let rootId : ?AuthTypes.UserId = if (mtIsAdminOrHR(session.role)) null
                                         else ?session.userId;
        Lib.getTeamTargetVsActual(
          monthlyTargets, users, territories, areas,
          crmBusinessReports, rootId, month, year
        )
      };
    }
  };

  /// Export monthly targets as a flat array (Excel source data).
  /// Admin/HR only. Admin/HR records are excluded from the export.
  public shared func exportMonthlyTargets(
    token  : Text,
    filter : Types.MonthlyTargetFilter,
  ) : async [Types.MonthlyTarget] {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { [] };
      case (?session) {
        if (not mtIsAdminOrHR(session.role)) { return [] };
        let results = Lib.listTargets(monthlyTargets, users, filter);
        // Exclude any targets belonging to Admin or HR (safety guard)
        results.filter(func(t : Types.MonthlyTarget) : Bool {
          mtIsFieldStaff(t.role)
        })
      };
    }
  };

  // ── Private helper ─────────────────────────────────────────────────────────

  /// Walk the reportsTo chain to check if `uid` is (transitively) under `managerId`.
  func isSubordinateOf(uid : AuthTypes.UserId, managerId : AuthTypes.UserId) : Bool {
    var current : ?AuthTypes.UserId = switch (users.get(uid)) {
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

  // ── SFA KPI helpers ────────────────────────────────────────────────────────

  /// Count of new doctors added by a specific MR in a given month/year.
  /// Accessible to the MR themselves, their managers, and Admin/HR.
  public shared func getNewDoctorsThisMonth(
    token : Text,
    mrId  : AuthTypes.UserId,
    month : Nat,
    year  : Nat,
  ) : async Nat {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { 0 };
      case (?session) {
        let allowed = mtIsAdminOrHR(session.role) or
                      session.userId == mrId or
                      (mtIsManager(session.role) and isSubordinateOf(mrId, session.userId));
        if (not allowed) return 0;
        Lib.getNewDoctorsAddedThisMonth(mrId, month, year, doctors)
      };
    }
  };

  /// Aggregate all KPI data for a single MR for a given month/year.
  /// Returns target, actuals, and achievement percentages.
  /// Accessible to the MR themselves, their managers, and Admin/HR.
  public shared func getMRKpiSummary(
    token : Text,
    mrId  : AuthTypes.UserId,
    month : Nat,
    year  : Nat,
  ) : async {
    target         : ?Types.MonthlyTarget;
    doctorCalls    : Nat;
    chemistVisits  : Nat;
    stockistVisits : Nat;
    newDoctors     : Nat;
    doctorCallPct  : Float;
    chemistPct     : Float;
    stockistPct    : Float;
    newDoctorsPct  : Float;
  } {
    let empty = {
      target = null; doctorCalls = 0; chemistVisits = 0;
      stockistVisits = 0; newDoctors = 0;
      doctorCallPct = 0.0; chemistPct = 0.0;
      stockistPct = 0.0; newDoctorsPct = 0.0;
    };
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { empty };
      case (?session) {
        let allowed = mtIsAdminOrHR(session.role) or
                      session.userId == mrId or
                      (mtIsManager(session.role) and isSubordinateOf(mrId, session.userId));
        if (not allowed) return empty;

        let tgt = Lib.getTarget(monthlyTargets, mrId, month, year);

        // Count doctor calls for this MR in the given month/year from call reports
        var doctorCallCount : Nat = 0;
        for (r in reports.values()) {
          if (r.mrId == mrId) {
            // Parse report date "YYYY-MM-DD"
            let dateStr = r.date;
            if (dateStr.size() >= 7) {
              let yearStr  = Text.fromIter(dateStr.chars().take(4));
              let monthStr = Text.fromIter(dateStr.chars().drop(5).take(2));
              let rYear  = textToNatSafe(yearStr);
              let rMonth = textToNatSafe(monthStr);
              if (rYear == year and rMonth == month) {
                doctorCallCount += 1;
              };
            };
          };
        };

        // Count chemist visits
        var chemistCount : Nat = 0;
        for (c in chemistCalls.values()) {
          if (c.mrId == mrId) {
            let dateStr = c.date;
            if (dateStr.size() >= 7) {
              let yearStr  = Text.fromIter(dateStr.chars().take(4));
              let monthStr = Text.fromIter(dateStr.chars().drop(5).take(2));
              let rYear  = textToNatSafe(yearStr);
              let rMonth = textToNatSafe(monthStr);
              if (rYear == year and rMonth == month) {
                chemistCount += 1;
              };
            };
          };
        };

        // Count stockist visits
        var stockistCount : Nat = 0;
        for (s in stockistCalls.values()) {
          if (s.mrId == mrId) {
            let dateStr = s.date;
            if (dateStr.size() >= 7) {
              let yearStr  = Text.fromIter(dateStr.chars().take(4));
              let monthStr = Text.fromIter(dateStr.chars().drop(5).take(2));
              let rYear  = textToNatSafe(yearStr);
              let rMonth = textToNatSafe(monthStr);
              if (rYear == year and rMonth == month) {
                stockistCount += 1;
              };
            };
          };
        };

        // Count new doctors added
        let newDocCount = Lib.getNewDoctorsAddedThisMonth(mrId, month, year, doctors);

        // Compute achievement percentages
        let achievements = switch (tgt) {
          case null {
            { doctorCallPct = 0.0; chemistPct = 0.0; stockistPct = 0.0; newDoctorsPct = 0.0 }
          };
          case (?t) {
            Lib.getMRKpiAchievement(t, doctorCallCount, chemistCount, stockistCount, newDocCount)
          };
        };

        {
          target         = tgt;
          doctorCalls    = doctorCallCount;
          chemistVisits  = chemistCount;
          stockistVisits = stockistCount;
          newDoctors     = newDocCount;
          doctorCallPct  = achievements.doctorCallPct;
          chemistPct     = achievements.chemistPct;
          stockistPct    = achievements.stockistPct;
          newDoctorsPct  = achievements.newDoctorsPct;
        }
      };
    }
  };

  /// Parse a decimal Nat from a Text — returns 0 on any parse failure.
  func textToNatSafe(t : Text) : Nat {
    var result : Nat = 0;
    for (c in t.chars()) {
      switch (c) {
        case '0' { result := result * 10 + 0 };
        case '1' { result := result * 10 + 1 };
        case '2' { result := result * 10 + 2 };
        case '3' { result := result * 10 + 3 };
        case '4' { result := result * 10 + 4 };
        case '5' { result := result * 10 + 5 };
        case '6' { result := result * 10 + 6 };
        case '7' { result := result * 10 + 7 };
        case '8' { result := result * 10 + 8 };
        case '9' { result := result * 10 + 9 };
        case _ { return 0 };
      }
    };
    result
  };
};
