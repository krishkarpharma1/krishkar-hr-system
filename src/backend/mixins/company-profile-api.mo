import CPTypes  "../types/company-profile";
import CPLib    "../lib/company-profile";
import AuthTypes "../types/auth-users";
import CommonTypes "../types/common";
import Map      "mo:core/Map";
import Time     "mo:core/Time";

/// Public API surface for Company Profile branding feature.
/// getCompanyProfile is open to all authenticated users (all portals need it for report headers).
/// setCompanyProfile is Admin-only.
mixin (
  sessions       : Map.Map<Text, AuthTypes.Session>,
  companyProfile : CPLib.State,
) {

  // ── Session helpers ────────────────────────────────────────────────────────

  func requireSessionCP(token : Text) : ?AuthTypes.Session {
    switch (sessions.get(token)) {
      case (?s) {
        if (s.expiresAt > Time.now()) ?s else null
      };
      case null { null };
    };
  };

  func requireAdminCP(token : Text) : ?AuthTypes.Session {
    switch (requireSessionCP(token)) {
      case null    { null };
      case (?s) {
        switch (s.role) {
          case (#Admin) ?s;
          case _        { null };
        }
      };
    }
  };

  // ── Company Profile API ────────────────────────────────────────────────────

  /// Returns the current company profile. Available to all authenticated users.
  public query func getCompanyProfile(
    token : Text,
  ) : async ?CPTypes.CompanyProfile {
    switch (requireSessionCP(token)) {
      case null    { null };
      case (?_)    { CPLib.getCompanyProfile(companyProfile) };
    }
  };

  /// Creates or updates the company profile. Admin only.
  public shared func setCompanyProfile(
    token : Text,
    input : CPTypes.UpdateCompanyProfileInput,
  ) : async CommonTypes.MutationResult {
    switch (requireAdminCP(token)) {
      case null { #err("Unauthorized: Admin role required or session expired") };
      case (?_) { CPLib.setCompanyProfile(companyProfile, input, Time.now()) };
    }
  };
};
