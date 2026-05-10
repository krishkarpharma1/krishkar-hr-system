import AuthTypes "../types/auth-users";
import RCELib    "../lib/reporting-chain-emails";
import Map       "mo:core/Map";
import Time      "mo:core/Time";

/// Reporting-Chain Emails API
///
/// Exposes:
///   getAuthorityChainEmails(token) -> [Text]
///     Returns the email addresses of every manager in the caller's reporting
///     chain, from direct manager up to Admin.  Empty emails are skipped.
///     Admin callers receive an empty array (no higher authorities).
///
///   getAdminEmail(token) -> ?Text
///     Returns the first Admin user's email address, for BCC logic.
///     Returns null if no Admin has a configured email.
mixin (
  sessions : Map.Map<Text, AuthTypes.Session>,
  users    : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
) {

  // ── Session helpers ────────────────────────────────────────────────────────

  func requireSessionRCE(token : Text) : ?AuthTypes.Session {
    switch (sessions.get(token)) {
      case (?s) {
        if (s.expiresAt > Time.now()) ?s else null
      };
      case null { null };
    };
  };

  // ── Reporting-Chain Emails API ─────────────────────────────────────────────

  /// Returns email addresses of all higher authorities in the caller's
  /// reporting chain (direct manager → Admin), excluding empty addresses.
  /// Available to all authenticated roles.
  public query func getAuthorityChainEmails(
    token : Text,
  ) : async [Text] {
    switch (requireSessionRCE(token)) {
      case null { [] };
      case (?s) {
        switch (users.get(s.userId)) {
          case null { [] };
          case (?u) {
            RCELib.getAuthorityChainEmails(u, users)
          };
        }
      };
    }
  };

  /// Returns the first Admin user's email address.
  /// Intended for BCC population in email clients.
  /// Available to all authenticated roles.
  public query func getAdminEmail(
    token : Text,
  ) : async ?Text {
    switch (requireSessionRCE(token)) {
      case null { null };
      case (?_) {
        RCELib.getAdminEmail(users)
      };
    }
  };

};
