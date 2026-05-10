import AuthLib      "../lib/auth-users";
import MtpSettingsLib "../lib/mtp-settings";
import MtpTypes     "../types/mtp-settings";
import AuthTypes    "../types/auth-users";
import LocTypes     "../types/location-master";
import Map          "mo:core/Map";
import Time "mo:core/Time";

/// Public API mixin for MTP settings and station-HQ lookup.
/// Admin-only mutations; any authenticated user may read settings
/// and query the station list for their own HQ.
mixin (
  sessions   : Map.Map<Text, AuthTypes.Session>,
  users      : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
  stations   : Map.Map<LocTypes.LocationId, LocTypes.StationRecord>,
  mtpSettings : MtpTypes.MtpSettingsState,
) {

  // ── Auth helpers ─────────────────────────────────────────────────────────────

  private func requireSessionMtp(token : Text) : ?AuthTypes.Session {
    AuthLib.validateSession(sessions, token, Time.now())
  };

  private func peekSessionMtp(token : Text) : ?AuthTypes.Session {
    AuthLib.peekSession(sessions, token, Time.now())
  };

  // ── Public API ────────────────────────────────────────────────────────────────

  /// Get the current MTP settings (any authenticated user).
  public query func getMtpSettings(
    token : Text,
  ) : async MtpTypes.MtpSettings {
    switch (peekSessionMtp(token)) {
      case null {
        // Return defaults for unauthenticated callers (safe read-only)
        MtpTypes.toInfo(mtpSettings)
      };
      case (?_) {
        MtpSettingsLib.getMtpSettings(mtpSettings)
      };
    }
  };

  /// Update MTP settings (Admin only).
  public shared ({ caller = _ }) func updateMtpSettings(
    token : Text,
    input : MtpTypes.MtpSettings,
  ) : async { #ok : Text; #err : Text } {
    switch (requireSessionMtp(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        switch (session.role) {
          case (#Admin) {
            switch (MtpSettingsLib.updateMtpSettings(mtpSettings, input)) {
              case (#ok)       { #ok("MTP settings updated successfully") };
              case (#err(msg)) { #err(msg) };
            }
          };
          case _ { #err("Unauthorized: Admin role required") };
        }
      };
    }
  };

  /// Return all active stations under the employee's assigned HQ.
  /// The caller may pass any employeeId; access is scoped in the mixin
  /// (MR sees only their own, managers may query any subordinate).
  public query func getStationsForEmployeeHQ(
    token      : Text,
    employeeId : Nat,
  ) : async [LocTypes.StationRecord] {
    switch (peekSessionMtp(token)) {
      case null { [] };
      case (?session) {
        // MR can only query for themselves; managers/HR/Admin can query any employee
        let isManagerOrAbove : Bool = switch (session.role) {
          case (#ASM or #RSM or #ZSM or #HRManager or #Admin) { true };
          case _ { false };
        };
        if (not isManagerOrAbove and session.userId != employeeId) {
          return []
        };
        MtpSettingsLib.getStationsForEmployeeHQ(employeeId, users, stations)
      };
    }
  };

  /// Return all active stations under the calling user's HQ
  /// (convenience wrapper for the MR's own MTP form).
  public query func getMyStationsForMtp(
    token : Text,
  ) : async [LocTypes.StationRecord] {
    switch (peekSessionMtp(token)) {
      case null { [] };
      case (?session) {
        MtpSettingsLib.getStationsForEmployeeHQ(session.userId, users, stations)
      };
    }
  };
};
