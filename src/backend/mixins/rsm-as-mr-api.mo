import Debug          "mo:core/Debug";
import List           "mo:core/List";
import Map            "mo:core/Map";
import Time           "mo:core/Time";
import Runtime        "mo:core/Runtime";
import Types          "../types/rsm-as-mr";
import ACTypes        "../types/additional-charge";
import AuthTypes      "../types/auth-users";
import CommonTypes    "../types/common";
import NotifTypes     "../types/notifications";
import AuthLib        "../lib/auth-users";
import ACLib          "../lib/additional-charge";
import Lib            "../lib/rsm-as-mr";

/// Public API mixin for the RSM-as-MR feature.
/// Exposes role-switcher config queries, self-approval detection,
/// and notification triggers for the RSM additional MR role.
mixin (
  sessions        : Map.Map<Text, AuthTypes.Session>,
  users           : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
  charges         : List.List<ACTypes.AdditionalCharge>,
  notifications   : Map.Map<Text, NotifTypes.NotificationRecord>,
  notifIdRef      : { var value : Nat },
) {

  // ── Private helpers ────────────────────────────────────────────────────────

  private func rsmApiIsAdminOrHR(role : AuthTypes.Role) : Bool {
    switch (role) {
      case (#Admin or #HRManager) { true };
      case _ { false };
    }
  };

  // ── Query: RSM role-switcher config ────────────────────────────────────────

  /// Returns the RsmMrModeConfig for an RSM who has an active MR additional role.
  /// Returns null if the employee has no active MR additional role.
  /// Accessible by the employee themselves, their manager, Admin, or HR.
  public shared func getRsmMrModeConfig(
    token      : Text,
    employeeId : AuthTypes.UserId,
  ) : async ?Types.RsmMrModeConfig {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { null };
      case (?session) {
        let allowed = rsmApiIsAdminOrHR(session.role) or
                      session.userId == employeeId;
        if (not allowed) { return null };
        let now = Time.now();
        switch (Lib.getAdditionalMrRole(charges, employeeId, now)) {
          case null      { null };
          case (?charge) { Lib.buildRsmMrModeConfig(charge) };
        }
      };
    }
  };

  /// Returns the active MR additional role charge for an RSM, if any.
  /// Returns null if no active MR role charge exists for the employee.
  public shared func getAdditionalMrRole(
    token      : Text,
    employeeId : AuthTypes.UserId,
  ) : async ?ACTypes.AdditionalCharge {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { null };
      case (?session) {
        let allowed = rsmApiIsAdminOrHR(session.role) or
                      session.userId == employeeId;
        if (not allowed) { return null };
        Lib.getAdditionalMrRole(charges, employeeId, Time.now())
      };
    }
  };

  // ── Query: self-approval check ─────────────────────────────────────────────

  /// Returns true if the caller (identified by token) is the same person as
  /// the submitter and that person has an active MR additional role.
  /// Used by frontend approval screens to show the correct routing warning.
  public shared func isRsmActingAsMr(
    token       : Text,
    submitterId : AuthTypes.UserId,
  ) : async Bool {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { false };
      case (?session) {
        Lib.isRsmActingAsMr(charges, session.userId, submitterId, Time.now())
      };
    }
  };

  // ── Query: MR-mode approver ────────────────────────────────────────────────

  /// Returns the UserId of the authority who should approve MTP/DCR submissions
  /// made by the given RSM while in MR mode (bypasses self-approval).
  /// Returns null if no appropriate approver is found.
  public shared func getMrModeApprover(
    token : Text,
    rsmId : AuthTypes.UserId,
  ) : async ?AuthTypes.UserId {
    switch (AuthLib.peekSession(sessions, token, Time.now())) {
      case null { null };
      case (?session) {
        let allowed = rsmApiIsAdminOrHR(session.role) or session.userId == rsmId;
        if (not allowed) { return null };
        Lib.getMrModeApprover(users, rsmId)
      };
    }
  };

  // ── Notification triggers ──────────────────────────────────────────────────

  /// Trigger in-app notifications when an RSM is assigned the MR additional role.
  /// Sends one notification to the RSM and one to their ZSM (if resolvable).
  /// Only callable by Admin or HR.
  public shared func notifyRsmOnMrAssignment(
    token         : Text,
    rsmId         : AuthTypes.UserId,
    territoryName : Text,
    startDate     : Text,
  ) : async CommonTypes.MutationResult {
    switch (AuthLib.validateSession(sessions, token, Time.now())) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        if (not rsmApiIsAdminOrHR(session.role)) {
          return #err("Access denied: Admin or HR required");
        };
        let now = Time.now();
        let rsmName = switch (users.get(rsmId)) {
          case (?u) { u.name };
          case null { return #err("RSM employee not found") };
        };
        let zsmId = Lib.getMrModeApprover(users, rsmId);
        let payload : Types.RsmMrAssignmentNotification = {
          rsmId;
          zsmId;
          rsmName;
          territoryName;
          startDate;
        };
        let notifs = Lib.buildMrAssignmentNotifications(payload, notifIdRef, now);
        for (n in notifs.values()) {
          notifications.add(n.id, n);
        };
        #ok
      };
    }
  };

  /// Trigger a DCR-submission notification to the ZSM when an RSM submits a DCR in MR mode.
  /// rsmName: display name of the RSM. date: ISO date string "YYYY-MM-DD".
  /// Only callable by the RSM themselves (validated via token).
  public shared func notifyZsmOnRsmMrDcrSubmission(
    token         : Text,
    rsmId         : AuthTypes.UserId,
    territoryName : Text,
    date          : Text,
  ) : async CommonTypes.MutationResult {
    switch (AuthLib.validateSession(sessions, token, Time.now())) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        // Only the RSM themselves (or Admin/HR) may trigger this notification
        let allowed = rsmApiIsAdminOrHR(session.role) or session.userId == rsmId;
        if (not allowed) {
          return #err("Access denied: RSM, Admin, or HR required");
        };
        // Verify RSM has an active MR role
        switch (Lib.getAdditionalMrRole(charges, rsmId, Time.now())) {
          case null { return #err("No active MR additional role found for this employee") };
          case (?_) {};
        };
        let zsmId = switch (Lib.getMrModeApprover(users, rsmId)) {
          case null { return #err("No ZSM approver found in reporting chain") };
          case (?z) { z };
        };
        let rsmName = switch (users.get(rsmId)) {
          case (?u) { u.name };
          case null { "RSM" };
        };
        let now = Time.now();
        let notif = Lib.buildRsmMrDcrNotification(
          zsmId, rsmName, territoryName, date, notifIdRef, now
        );
        notifications.add(notif.id, notif);
        #ok
      };
    }
  };
};
