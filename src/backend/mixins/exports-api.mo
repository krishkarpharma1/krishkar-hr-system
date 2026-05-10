import AuthLib      "../lib/auth-users";
import AuthTypes    "../types/auth-users";
import HRCoreTypes  "../types/hr-core";
import ExportTypes  "../types/exports";
import Map          "mo:core/Map";
import List         "mo:core/List";
import Time         "mo:core/Time";
import Runtime      "mo:core/Runtime";

/// Cross-domain export mixin.
/// Provides bulk export endpoints that span multiple data domains (users + payroll).
/// HR/Admin only — all endpoints enforce strict role checks.
mixin (
  sessions : Map.Map<Text, AuthTypes.Session>,
  users    : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
  payroll  : List.List<HRCoreTypes.PayrollRecord>,
) {

  // ── Helpers ────────────────────────────────────────────────────────────────

  private func isHrOrAdminEX(role : AuthTypes.Role) : Bool {
    switch (role) {
      case (#HRManager or #Admin) { true };
      case _ { false };
    }
  };

  // ── Export: Salary Slips ──────────────────────────────────────────────────

  /// Export all employees' salary data for a given month.
  /// HR/Admin only. Returns one row per employee who has a payroll record for
  /// the requested month (approved or unapproved).
  /// month format: "YYYY-MM"
  public query func exportSalarySlips(
    token : Text,
    month : Text,
  ) : async [ExportTypes.SalarySlipExportRow] {
    Runtime.trap("not implemented");
  };
};
