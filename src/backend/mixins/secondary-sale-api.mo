import Types       "../types/secondary-sale";
import StockTypes  "../types/stockist";
import AuthTypes   "../types/auth-users";
import AuthLib     "../lib/auth-users";
import Lib         "../lib/secondary-sale";
import Map         "mo:core/Map";
import List        "mo:core/List";
import Time        "mo:core/Time";
import Runtime     "mo:core/Runtime";

/// Public API mixin for Stockist-wise Secondary Sale entries.
/// MR and ASM can submit secondary sale data; HR/Admin can view and export all entries.
mixin (
  sessions          : Map.Map<Text, AuthTypes.Session>,
  users             : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
  stockists         : Map.Map<StockTypes.StockistId, StockTypes.StockistRecord>,
  secondarySales    : List.List<Types.SecondarySaleRecord>,
  nextSaleId        : { var value : Nat },
) {

  func ssIsAdminOrHR(role : AuthTypes.Role) : Bool {
    switch (role) {
      case (#Admin or #HRManager) { true };
      case _ { false };
    }
  };

  /// Submit a new secondary sale entry for a selected stockist (MR/ASM/HR/Admin).
  public shared func createSecondarySale(
    token : Text,
    req   : Types.CreateSecondarySaleRequest,
  ) : async { #ok : Types.SecondarySaleRecord; #err : Text } {
    switch (AuthLib.validateSession(sessions, token, Time.now())) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        Lib.createSecondarySale(
          secondarySales, stockists, users, nextSaleId,
          req, session.userId, Time.now()
        )
      };
    }
  };

  /// List secondary sale records with optional filters.
  /// Admin/HR see all; managers see team; MR/ASM see their own.
  public shared func listSecondarySales(
    token  : Text,
    filter : Types.SecondarySaleFilter,
  ) : async [Types.SecondarySaleRecord] {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { [] };
      case (?session) {
        let adminOrHR = ssIsAdminOrHR(session.role);
        Lib.listSecondarySales(secondarySales, users, filter, session.userId, adminOrHR)
      };
    }
  };

  /// Get all secondary sale records submitted by a specific employee.
  public shared func getSecondarySalesByEmployee(
    token      : Text,
    employeeId : AuthTypes.UserId,
  ) : async [Types.SecondarySaleRecord] {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { [] };
      case (?session) {
        // Allow: self, manager of that employee, Admin/HR
        let isSelf     = session.userId == employeeId;
        let adminOrHR  = ssIsAdminOrHR(session.role);
        if (not isSelf and not adminOrHR) { return [] };
        Lib.getSecondarySalesByEmployee(secondarySales, employeeId)
      };
    }
  };

  /// Export secondary sale records as flat array (Excel source data).
  /// Admin/HR only; filterable by MR, area, stockist, product, and date range.
  public shared func exportSecondarySales(
    token  : Text,
    filter : Types.SecondarySaleFilter,
  ) : async [Types.SecondarySaleRecord] {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { [] };
      case (?session) {
        if (not ssIsAdminOrHR(session.role)) { return [] };
        Lib.listSecondarySales(secondarySales, users, filter, session.userId, true)
      };
    }
  };
};
