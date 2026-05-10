import Types      "../types/crm-doctor-sale";
import AuthTypes  "../types/auth-users";
import FieldTypes "../types/field-ops";
import AuthLib    "../lib/auth-users";
import Lib        "../lib/crm-doctor-sale";
import Map        "mo:core/Map";
import List       "mo:core/List";
import Time       "mo:core/Time";
import Runtime    "mo:core/Runtime";

/// Public API mixin for CRM Doctor-wise Sale entries.
/// MR and ASM can submit doctor-wise sale data; managers and HR/Admin can view.
mixin (
  sessions         : Map.Map<Text, AuthTypes.Session>,
  users            : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
  doctors          : List.List<FieldTypes.Doctor>,
  crmDoctorSales   : List.List<Types.CrmDoctorSaleRecord>,
  nextCrmSaleId    : { var value : Nat },
) {

  func cdsIsAdminOrHR(role : AuthTypes.Role) : Bool {
    switch (role) {
      case (#Admin or #HRManager) { true };
      case _ { false };
    }
  };

  /// Submit a new CRM doctor-wise sale entry (MR/ASM/HR/Admin).
  public shared func createCrmDoctorSale(
    token : Text,
    req   : Types.CreateCrmDoctorSaleRequest,
  ) : async { #ok : Types.CrmDoctorSaleRecord; #err : Text } {
    switch (AuthLib.validateSession(sessions, token, Time.now())) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        Lib.createCrmDoctorSale(
          crmDoctorSales, users, nextCrmSaleId,
          req, session.userId, Time.now()
        )
      };
    }
  };

  /// List CRM doctor-wise sale records with optional filters.
  /// Admin/HR see all; managers see team; MR/ASM see their own.
  public shared func listCrmDoctorSales(
    token  : Text,
    filter : Types.CrmDoctorSaleFilter,
  ) : async [Types.CrmDoctorSaleRecord] {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { [] };
      case (?session) {
        let adminOrHR = cdsIsAdminOrHR(session.role);
        Lib.listCrmDoctorSales(crmDoctorSales, users, filter, session.userId, adminOrHR)
      };
    }
  };

  /// Get all CRM doctor-wise sale records submitted by a specific employee.
  public shared func getCrmDoctorSalesByEmployee(
    token      : Text,
    employeeId : AuthTypes.UserId,
  ) : async [Types.CrmDoctorSaleRecord] {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { [] };
      case (?session) {
        let isSelf    = session.userId == employeeId;
        let adminOrHR = cdsIsAdminOrHR(session.role);
        if (not isSelf and not adminOrHR) { return [] };
        Lib.getCrmDoctorSalesByEmployee(crmDoctorSales, employeeId)
      };
    }
  };

  /// Export CRM doctor-wise sale records as flat array (Excel source data).
  /// Admin/HR only; filterable by doctor, MR, area, product, and date range.
  public shared func exportCrmDoctorSales(
    token  : Text,
    filter : Types.CrmDoctorSaleFilter,
  ) : async [Types.CrmDoctorSaleRecord] {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { [] };
      case (?session) {
        if (not cdsIsAdminOrHR(session.role)) { return [] };
        Lib.listCrmDoctorSales(crmDoctorSales, users, filter, session.userId, true)
      };
    }
  };
};
