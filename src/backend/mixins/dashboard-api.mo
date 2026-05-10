import Debug "mo:core/Debug";
import DashLib   "../lib/dashboard";
import DashTypes "../types/dashboard";
import AuthLib   "../lib/auth-users";
import AuthTypes "../types/auth-users";
import DcrTypes  "../types/dcr";
import GpsTypes  "../types/gps-trail";
import FieldTypes "../types/field-ops";
import CCTypes   "../types/chemist-call";
import SFATypes  "../types/sfa-sample";
import HRTypes   "../types/hr-core";
import AbsenceTypes "../types/absence-inactivation";
import PEAWTypes "../types/payroll-expenses-advances-workingstyle";
import LocTypes  "../types/location-master";
import Map   "mo:core/Map";
import List  "mo:core/List";
import Time  "mo:core/Time";

mixin (
  sessions          : Map.Map<Text, AuthTypes.Session>,
  users             : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
  reports           : List.List<FieldTypes.CallReport>,
  chemistCalls      : List.List<CCTypes.ChemistCallRecord>,
  stockistCalls     : List.List<CCTypes.StockistCallRecord>,
  dcrs              : List.List<DcrTypes.DcrRecord>,
  dcrSettings       : DcrTypes.DcrSettings,
  checkIns          : List.List<GpsTypes.AttendanceCheckIn>,
  locations         : Map.Map<AuthTypes.UserId, AuthTypes.LocationRecord>,
  leaves            : List.List<HRTypes.LeaveApplication>,
  expenses          : List.List<HRTypes.TaDaExpense>,
  expenseSheets     : List.List<PEAWTypes.ExpenseSheet>,
  sampleUsages      : List.List<SFATypes.SampleUsageRecord>,
  sampleAllocations : List.List<SFATypes.SampleAllocationRecord>,
  absenceLog        : List.List<AbsenceTypes.AbsenceInactivationLogEntry>,
  bulkUploadHistory : List.List<FieldTypes.BulkUploadRecord>,
  hqs               : Map.Map<LocTypes.LocationId, LocTypes.HQRecord>,
  areas             : Map.Map<LocTypes.LocationId, LocTypes.AreaRecord>,
  stations          : Map.Map<LocTypes.LocationId, LocTypes.StationRecord>,
) {

  // ── Session helpers ────────────────────────────────────────────────────────

  private func peekDashSession(token : Text) : ?AuthTypes.Session {
    AuthLib.peekSession(sessions, token, Time.now())
  };

  // ── Collect direct MR IDs for a manager ────────────────────────────────────

  private func directMrIdsOf(managerId : AuthTypes.UserId) : [AuthTypes.UserId] {
    let result = List.empty<AuthTypes.UserId>();
    for ((_, u) in users.entries()) {
      switch (u.reportsTo) {
        case (?mgr) {
          if (mgr == managerId and u.role == #MR) result.add(u.id)
        };
        case null {};
      }
    };
    result.toArray()
  };

  // ── RSM direct-MR detection ───────────────────────────────────────────────

  /// Returns the list of MRs whose direct reporting manager is the calling RSM.
  /// Used at RSM login to enable dynamic ASM-level features on the RSM portal.
  /// Returns empty array for non-RSM callers.
  public query func getRsmDirectMrs(
    token : Text,
  ) : async [AuthTypes.UserInfo] {
    switch (peekDashSession(token)) {
      case null { [] };
      case (?session) {
        if (session.role != #RSM) return [];
        DashLib.getRsmDirectMrs(session.userId, users)
      };
    }
  };

  // ── Team daily activity ───────────────────────────────────────────────────

  /// Returns one MrDailyActivityRow per MR under the calling manager's scope
  /// for the given date (ISO "YYYY-MM-DD").
  /// For RSM in direct-MR mode, scoped to directly managed MRs.
  /// For ASM, scoped to all directly reporting MRs.
  public query func getTeamDailyActivity(
    token : Text,
    date  : Text,
  ) : async [DashTypes.MrDailyActivityRow] {
    switch (peekDashSession(token)) {
      case null { [] };
      case (?session) {
        switch (session.role) {
          case (#ASM or #RSM) {};
          case _ { return [] };
        };
        let mrIds = directMrIdsOf(session.userId);
        if (mrIds.size() == 0) return [];
        DashLib.getTeamDailyActivity(
          mrIds, date, users, checkIns, reports,
          chemistCalls, stockistCalls, dcrs, locations,
        )
      };
    }
  };

  // ── Pending approval counts ───────────────────────────────────────────────

  /// Returns counts of pending approvals for the logged-in manager.
  /// For RSM with direct MRs, the rsmLevel fields reflect escalated items from ASMs.
  public query func getPendingApprovalCounts(
    token : Text,
  ) : async DashTypes.PendingApprovalCounts {
    let empty : DashTypes.PendingApprovalCounts = {
      leavePending         = 0;
      tadaPending          = 0;
      mtpPending           = 0;
      dcrPending           = 0;
      rsmLevelLeavePending = 0;
      rsmLevelTadaPending  = 0;
    };
    switch (peekDashSession(token)) {
      case null { empty };
      case (?session) {
        let directMrIds = if (session.role == #RSM) {
          directMrIdsOf(session.userId)
        } else {
          []
        };
        DashLib.getPendingApprovalCounts(
          session.userId, session.role, directMrIds,
          leaves, expenses, dcrs, users,
        )
      };
    }
  };

  // ── Dashboard aggregates ──────────────────────────────────────────────────

  /// Returns role-appropriate KPI aggregates for the logged-in user's portal.
  /// fromDate and toDate are ISO "YYYY-MM-DD" strings defining the report period
  /// (typically month start/end for the current month).
  public query func getDashboardAggregates(
    token    : Text,
    fromDate : Text,
    toDate   : Text,
  ) : async ?DashTypes.DashboardAggregates {
    switch (peekDashSession(token)) {
      case null { null };
      case (?session) {
        ?DashLib.getDashboardAggregates(
          session, fromDate, toDate,
          users, reports, chemistCalls, stockistCalls,
          dcrs, checkIns, leaves, expenses,
          sampleUsages, sampleAllocations, absenceLog,
        )
      };
    }
  };

  // ── Expense field-activity check ──────────────────────────────────────────

  /// Returns true if the calling MR has any Doctor Call, Chemist Visit,
  /// Stockist Visit, or DCR recorded for the given date (ISO "YYYY-MM-DD").
  /// Used by the frontend to show a warning flag on expense submission.
  public query func checkExpenseFieldActivity(
    token       : Text,
    expenseDate : Text,
  ) : async Bool {
    switch (peekDashSession(token)) {
      case null { false };
      case (?session) {
        if (session.role != #MR) return false;
        DashLib.checkExpenseFieldActivity(
          session.userId, expenseDate,
          reports, chemistCalls, stockistCalls, dcrs,
        )
      };
    }
  };

  // ── Expense claim summary ─────────────────────────────────────────────────

  /// Returns per-MR expense claim summary rows for the calling manager's scope.
  /// Accessible to ASM, RSM (for direct MRs), HR, and Admin.
  public query func getExpenseClaimSummary(
    token    : Text,
    fromDate : Text,
    toDate   : Text,
  ) : async [DashTypes.ExpenseClaimSummaryRow] {
    switch (peekDashSession(token)) {
      case null { [] };
      case (?session) {
        let mrIds : [AuthTypes.UserId] = switch (session.role) {
          case (#ASM or #RSM) { directMrIdsOf(session.userId) };
          case (#HRManager or #Admin) {
            let result = List.empty<AuthTypes.UserId>();
            for ((_, u) in users.entries()) {
              if (u.role == #MR) result.add(u.id)
            };
            result.toArray()
          };
          case _ { [] };
        };
        if (mrIds.size() == 0) return [];
        DashLib.getExpenseClaimSummary(
          mrIds, fromDate, toDate,
          users, expenseSheets, reports, chemistCalls, stockistCalls,
        )
      };
    }
  };

  // ── DCR reminder status ───────────────────────────────────────────────────

  /// Returns DCR reminder status for the calling MR on the given date.
  /// Used by the frontend to decide whether to show the "Submit your DCR" prompt.
  public query func getDcrReminderStatus(
    token : Text,
    date  : Text,
  ) : async DashTypes.DcrReminderStatus {
    let defaultStatus : DashTypes.DcrReminderStatus = {
      checkedIn    = false;
      dcrSubmitted = false;
      deadlineHour = dcrSettings.dailyDeadlineHour;
    };
    switch (peekDashSession(token)) {
      case null { defaultStatus };
      case (?session) {
        if (session.role != #MR) return defaultStatus;
        DashLib.getDcrReminderStatus(
          session.userId, date, checkIns, dcrs, dcrSettings,
        )
      };
    }
  };

  // ── MTP allowed stations ──────────────────────────────────────────────────

  /// Returns stations allotted to the calling MR within their Area HQ.
  /// Used in the MTP module to populate the station-selection dropdown.
  /// _month and _year params are accepted for future period-specific filtering.
  // getMtpAllowedStations removed (V81 feature);

  // ── System alerts (Admin only) ────────────────────────────────────────────

  /// Returns recent system-level alerts for the Admin dashboard alert panel.
  /// Only callable by Admin role.
  public query func getSystemAlerts(
    token : Text,
  ) : async [DashTypes.SystemAlert] {
    switch (peekDashSession(token)) {
      case null { [] };
      case (?session) {
        if (session.role != #Admin) return [];
        DashLib.getSystemAlerts(absenceLog, bulkUploadHistory)
      };
    }
  };
};
