import DataCleanupLib "../lib/data-cleanup";
import AuthTypes      "../types/auth-users";
import AuthLib        "../lib/auth-users";
import FieldTypes     "../types/field-ops";
import HRTypes        "../types/hr-core";
import TPTypes        "../types/travel-plan";
import BookingTypes   "../types/booking";
import CrmTypes       "../types/crm";
import GpsTypes       "../types/gps-trail";
import IncentiveTypes "../types/incentives";
import Map            "mo:core/Map";
import List           "mo:core/List";
import Time           "mo:core/Time";

/// Public API surface for the Admin "Clean Trial Data" feature.
/// All cleanup actions are logged immutably for audit.
mixin (
  sessions           : Map.Map<Text, AuthTypes.Session>,
  users              : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
  // ── audit log state ────────────────────────────────────────────────
  dataCleanupLogs    : List.List<DataCleanupLib.DataCleanupLog>,
  nextCleanupLogId   : { var value : Nat },
  // ── erasable data containers ───────────────────────────────────────
  reports            : List.List<FieldTypes.CallReport>,
  expenses           : List.List<HRTypes.TaDaExpense>,
  attendance         : List.List<HRTypes.AttendanceRecord>,
  leaves             : List.List<HRTypes.LeaveApplication>,
  travelPlans        : List.List<TPTypes.TravelPlanRecord>,
  bookingRequests    : List.List<BookingTypes.BookingRequest>,
  crmRequests        : List.List<CrmTypes.CrmRequest>,
  crmBusinessReports : List.List<CrmTypes.BusinessReport>,
  gpsActivityLog     : List.List<GpsTypes.GpsActivityEntry>,
  checkIns           : List.List<GpsTypes.AttendanceCheckIn>,
  incentiveCalcs     : List.List<IncentiveTypes.IncentiveCalculation>,
) {

  // ── Access helpers ────────────────────────────────────────────────────────────

  func isAdminOrHR(role : AuthTypes.Role) : Bool {
    switch (role) {
      case (#Admin or #HRManager) { true };
      case _                      { false };
    }
  };

  func isAdminRole(role : AuthTypes.Role) : Bool {
    switch (role) {
      case (#Admin) { true };
      case _        { false };
    }
  };

  // ── Cleanup action ────────────────────────────────────────────────────────────

  /// Admin only: erase all trial/field-activity data and log the action.
  /// Master/configuration data (doctors, employees, roles, targets, etc.) is preserved.
  ///
  /// The caller must supply the exact confirmation phrase "CONFIRM DELETE";
  /// the action is rejected otherwise.
  public shared func cleanTrialData(
    token              : Text,
    confirmationPhrase : Text,
    reason             : Text,
  ) : async { #ok : DataCleanupLib.DataCleanupLog; #err : Text } {
    switch (AuthLib.validateSession(sessions, token, Time.now())) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        if (not isAdminRole(session.role)) {
          return #err("Access denied: Admin only");
        };
        if (confirmationPhrase != "CONFIRM DELETE") {
          return #err("Confirmation phrase must be exactly: CONFIRM DELETE");
        };
        if (reason.size() == 0) {
          return #err("Reason is required for the audit log");
        };
        let adminUserId = session.userId;
        let adminUsername = switch (users.get(adminUserId)) {
          case (?u) u.username;
          case null  "admin";
        };
        let now = Time.now();
        let logEntry = DataCleanupLib.cleanTrialData(
          dataCleanupLogs, nextCleanupLogId,
          adminUsername, reason, now,
          reports, expenses, attendance, leaves,
          travelPlans, bookingRequests,
          crmRequests, crmBusinessReports,
          gpsActivityLog, checkIns,
          incentiveCalcs,
        );
        #ok(logEntry)
      };
    }
  };

  // ── Audit log read ────────────────────────────────────────────────────────────

  /// Admin or HR: view the complete, immutable data cleanup audit log.
  public shared func getDataCleanupHistory(
    token : Text,
  ) : async { #ok : [DataCleanupLib.DataCleanupLog]; #err : Text } {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        if (not isAdminOrHR(session.role)) {
          return #err("Access denied: Admin or HR only");
        };
        #ok(DataCleanupLib.getCleanupHistory(dataCleanupLogs))
      };
    }
  };
};
