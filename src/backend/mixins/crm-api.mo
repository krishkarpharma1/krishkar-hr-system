import CrmLib    "../lib/crm";
import AuthLib   "../lib/auth-users";
import Types     "../types/crm";
import AuthTypes "../types/auth-users";
import ExportTypes "../types/exports";
import Map       "mo:core/Map";
import List      "mo:core/List";
import Time      "mo:core/Time";
import Runtime   "mo:core/Runtime";

mixin (
  sessions        : Map.Map<Text, AuthTypes.Session>,
  users           : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
  crmRequests     : List.List<Types.CrmRequest>,
  salesTargets    : List.List<Types.SalesTarget>,
  businessReports : List.List<Types.BusinessReport>,
  nextCrmId       : { var val : Nat },
  nextTargetId    : { var val : Nat },
  nextReportId    : { var val : Nat },
) {

  // ── Helpers ────────────────────────────────────────────────────────────────

  /// Returns true for roles that are ASM and above (CRM access)
  func isAsmOrAbove(role : AuthTypes.Role) : Bool {
    switch (role) {
      case (#ASM or #RSM or #ZSM or #HRManager or #Admin) { true };
      case _ { false };
    }
  };

  /// Returns true for HR/Admin roles (approve/admin access)
  func isHrOrAdmin(role : AuthTypes.Role) : Bool {
    switch (role) {
      case (#HRManager or #Admin) { true };
      case _ { false };
    }
  };

  /// Returns true for ZSM/HR/Admin (can view other users' dashboards)
  func canViewOthers(role : AuthTypes.Role) : Bool {
    switch (role) {
      case (#ZSM or #HRManager or #Admin) { true };
      case _ { false };
    }
  };

  // ── CRM Request endpoints ──────────────────────────────────────────────────

  /// Raise a CRM money request (ASM and above only)
  public shared ({ caller = _ }) func createCrmRequest(
    token : Text,
    input : Types.CreateCrmRequestInput,
  ) : async { #ok : Types.CrmRequestId; #err : Text } {
    switch (AuthLib.validateSession(sessions, token, Time.now())) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        if (not isAsmOrAbove(session.role)) {
          return #err("Access denied: ASM or above required");
        };
        let id = CrmLib.createCrmRequest(crmRequests, session.userId, input, nextCrmId, Time.now());
        #ok(id)
      };
    }
  };

  /// Get a single CRM request by ID
  public query func getCrmRequest(
    token : Text,
    id    : Types.CrmRequestId,
  ) : async ?Types.CrmRequestInfo {
    let now = Time.now();
    switch (AuthLib.peekSession(sessions, token, now)) {
      case null { null };
      case (?session) {
        if (not isAsmOrAbove(session.role)) { return null };
        switch (CrmLib.getCrmRequest(crmRequests, id)) {
          case null { null };
          case (?info) {
            // Pending requests only visible to requester or HR/Admin
            if (info.status == #Pending and info.userId != session.userId and not isHrOrAdmin(session.role)) {
              null
            } else {
              ?info
            }
          };
        }
      };
    }
  };

  /// List own CRM requests (all statuses visible to requester)
  public query func listMyCrmRequests(
    token : Text,
  ) : async [Types.CrmRequestInfo] {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { [] };
      case (?session) {
        if (not isAsmOrAbove(session.role)) { return [] };
        CrmLib.listMyCrmRequests(crmRequests, session.userId)
      };
    }
  };

  /// List all CRM requests — HR/Admin only; optionally filtered by status
  /// Manager-level roles (ASM/RSM/ZSM) only see #Approved requests, not #Pending
  public query func listAllCrmRequests(
    token  : Text,
    status : ?Types.CrmStatus,
  ) : async [Types.CrmRequestInfo] {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { [] };
      case (?session) {
        if (not isAsmOrAbove(session.role)) { return [] };
        if (isHrOrAdmin(session.role)) {
          // HR/Admin see everything, filtered by requested status
          CrmLib.listAllCrmRequests(crmRequests, status)
        } else {
          // Manager-level: only show #Approved requests
          let effectiveFilter : ?Types.CrmStatus = switch (status) {
            case (?(#Pending)) { return [] }; // explicitly requested pending — deny
            case (?(#Rejected)) { return [] }; // explicitly requested rejected — deny
            case _ { ?#Approved };             // default to approved only
          };
          CrmLib.listAllCrmRequests(crmRequests, effectiveFilter)
        }
      };
    }
  };

  /// Approve a CRM request (HR/Admin only)
  public shared ({ caller = _ }) func approveCrmRequest(
    token : Text,
    id    : Types.CrmRequestId,
  ) : async Types.MutationResult {
    switch (AuthLib.validateSession(sessions, token, Time.now())) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        if (not isHrOrAdmin(session.role)) {
          return #err("Access denied: HR or Admin role required");
        };
        CrmLib.approveCrmRequest(crmRequests, id, session.userId, Time.now())
      };
    }
  };

  /// Reject a CRM request with a reason (HR/Admin only)
  public shared ({ caller = _ }) func rejectCrmRequest(
    token  : Text,
    id     : Types.CrmRequestId,
    reason : Text,
  ) : async Types.MutationResult {
    switch (AuthLib.validateSession(sessions, token, Time.now())) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        if (not isHrOrAdmin(session.role)) {
          return #err("Access denied: HR or Admin role required");
        };
        CrmLib.rejectCrmRequest(crmRequests, id, session.userId, reason, Time.now())
      };
    }
  };

  // ── Sales Target endpoints ─────────────────────────────────────────────────

  /// Create a sales target for the calling user (ASM and above)
  public shared ({ caller = _ }) func createSalesTarget(
    token : Text,
    input : Types.CreateSalesTargetInput,
  ) : async { #ok : Types.SalesTargetId; #err : Text } {
    switch (AuthLib.validateSession(sessions, token, Time.now())) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        if (not isAsmOrAbove(session.role)) {
          return #err("Access denied: ASM or above required");
        };
        let id = CrmLib.createSalesTarget(salesTargets, session.userId, input, nextTargetId, Time.now());
        #ok(id)
      };
    }
  };

  /// List own sales targets
  public query func listMySalesTargets(
    token : Text,
  ) : async [Types.SalesTarget] {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { [] };
      case (?session) {
        if (not isAsmOrAbove(session.role)) { return [] };
        CrmLib.listMySalesTargets(salesTargets, session.userId)
      };
    }
  };

  // ── Business Report endpoints ──────────────────────────────────────────────

  /// Submit a monthly business report for a doctor (ASM and above)
  public shared ({ caller = _ }) func createBusinessReport(
    token : Text,
    input : Types.CreateBusinessReportInput,
  ) : async { #ok : Types.BusinessReportId; #err : Text } {
    switch (AuthLib.validateSession(sessions, token, Time.now())) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        if (not isAsmOrAbove(session.role)) {
          return #err("Access denied: ASM or above required");
        };
        let id = CrmLib.createBusinessReport(businessReports, session.userId, input, nextReportId, Time.now());
        #ok(id)
      };
    }
  };

  /// List own business reports, optionally filtered by month/year
  public query func listMyBusinessReports(
    token : Text,
    month : ?Nat,
    year  : ?Nat,
  ) : async [Types.BusinessReportInfo] {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { [] };
      case (?session) {
        if (not isAsmOrAbove(session.role)) { return [] };
        CrmLib.listMyBusinessReports(businessReports, session.userId, month, year)
      };
    }
  };

  /// List all business reports (HR/Admin only), optionally filtered
  public query func listAllBusinessReports(
    token  : Text,
    userId : ?Nat,
    month  : ?Nat,
    year   : ?Nat,
  ) : async [Types.BusinessReportInfo] {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { [] };
      case (?session) {
        if (not isHrOrAdmin(session.role)) { return [] };
        CrmLib.listAllBusinessReports(businessReports, userId, month, year)
      };
    }
  };

  // ── Sales Dashboard endpoints ──────────────────────────────────────────────

  /// Get the sales dashboard summary for the calling user
  public query func getMySalesDashboard(
    token      : Text,
    month      : Nat,
    year       : Nat,
    currentDay : Int,
  ) : async Types.SalesDashboardSummary {
    let empty : Types.SalesDashboardSummary = {
      totalActualSales       = 0.0;
      totalCrmSpent          = 0.0;
      overallProgressPercent = 0.0;
      doctorBreakdown        = [];
    };
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { empty };
      case (?session) {
        if (not isAsmOrAbove(session.role)) { return empty };
        let day : Nat = if (currentDay > 0) { currentDay.toNat() } else { 0 };
        CrmLib.getSalesDashboard(businessReports, crmRequests, salesTargets, session.userId, month, year, day)
      };
    }
  };

  /// Get the sales dashboard summary for any user (HR/Admin/ZSM only)
  public query func getSalesDashboardForUser(
    token      : Text,
    userId     : Nat,
    month      : Nat,
    year       : Nat,
    currentDay : Int,
  ) : async Types.SalesDashboardSummary {
    let empty : Types.SalesDashboardSummary = {
      totalActualSales       = 0.0;
      totalCrmSpent          = 0.0;
      overallProgressPercent = 0.0;
      doctorBreakdown        = [];
    };
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { empty };
      case (?session) {
        if (not canViewOthers(session.role)) { return empty };
        let day : Nat = if (currentDay > 0) { currentDay.toNat() } else { 0 };
        CrmLib.getSalesDashboard(businessReports, crmRequests, salesTargets, userId, month, year, day)
      };
    }
  };

  // ── Export: CRM / Sales Report ────────────────────────────────────────────

  /// Export CRM and sales data with role-based visibility.
  /// Admin/HR see all; managers see their team; users see own data.
  public query func exportCrmSalesReport(
    token  : Text,
    filter : ExportTypes.ExportFilter,
  ) : async [ExportTypes.CrmExportRow] {
    Runtime.trap("not implemented");
  };
};
