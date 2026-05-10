import List    "mo:core/List";
import Map     "mo:core/Map";
import Text    "mo:core/Text";
import Nat     "mo:core/Nat";
import VFTypes "../types/visit-frequency";
import FieldTypes "../types/field-ops";
import AuthTypes  "../types/auth-users";
import VFLib   "../lib/visit-frequency";

/// Public API mixin for Visit Frequency Planner.
/// Admin: config + tier assignment. MR + managers: read report.
mixin (
  sessions       : Map.Map<Text, AuthTypes.Session>,
  users          : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
  vfConfig       : { var value : VFTypes.VisitFrequencyConfig },
  doctorTierMap  : Map.Map<Nat, VFTypes.DoctorTierAssignment>,
  reports        : List.List<FieldTypes.CallReport>,
  doctors        : List.List<FieldTypes.Doctor>,
) {

  func vf_isAdminOrHR(token : Text) : Bool {
    switch (sessions.get(token)) {
      case null false;
      case (?s) switch (users.get(s.userId)) {
        case (?u) u.role == #Admin or u.role == #HRManager;
        case null false;
      };
    };
  };

  func vf_isAuthenticated(token : Text) : Bool {
    sessions.get(token) != null;
  };

  func vf_sessionUserId(token : Text) : ?Nat {
    switch (sessions.get(token)) {
      case (?s) ?s.userId;
      case null null;
    };
  };

  /// Admin: set system-wide visit frequency targets per tier.
  public shared ({ caller }) func setVisitFrequencyTargets(
    token : Text,
    cfg   : VFTypes.VisitFrequencyConfig,
  ) : async { #ok; #err : Text } {
    if (not vf_isAdminOrHR(token)) return #err("Access denied");
    VFLib.setVisitFrequencyTargets(vfConfig, cfg);
    #ok;
  };

  /// Get current visit frequency targets.
  public query func getVisitFrequencyTargets(
    token : Text,
  ) : async VFTypes.VisitFrequencyConfig {
    VFLib.getVisitFrequencyTargets(vfConfig);
  };

  /// Admin/HR: assign a tier to a doctor.
  public shared ({ caller }) func setDoctorTierAssignment(
    token    : Text,
    doctorId : Nat,
    tier     : VFTypes.DoctorTier,
  ) : async { #ok; #err : Text } {
    switch (vf_sessionUserId(token)) {
      case null #err("Not authenticated");
      case (?uid) {
        VFLib.setDoctorTierAssignment(doctorTierMap, doctorId, tier, uid);
        #ok;
      };
    };
  };

  /// Get tier assignment for a doctor.
  public query func getDoctorTierAssignment(
    token    : Text,
    doctorId : Nat,
  ) : async VFTypes.DoctorTier {
    VFLib.getDoctorTierAssignment(doctorTierMap, doctorId);
  };

  /// MR/Manager: get visit frequency compliance report for an MR for a given month/year.
  public query func getVisitFrequencyReport(
    token : Text,
    mrId  : Nat,
    month : Nat,
    year  : Nat,
  ) : async VFTypes.VisitFrequencyReport {
    VFLib.getVisitFrequencyReport(
      doctorTierMap, vfConfig,
      reports,
      doctors,
      mrId, month, year,
    );
  };
};
