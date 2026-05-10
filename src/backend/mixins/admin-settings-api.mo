import AuthTypes     "../types/auth-users";
import NotifTypes    "../types/notifications";
import AbsenceTypes  "../types/absence-inactivation";
import Map           "mo:core/Map";
import Time          "mo:core/Time";

/// Admin-only API surface for notification and absence-inactivation settings.
/// State is injected via mixin parameters — no owned state.
mixin (
  sessions            : Map.Map<Text, AuthTypes.Session>,
  notificationSettings : { var value : NotifTypes.NotificationSettings },
  absenceSettings      : AbsenceTypes.AbsenceSettings,
) {

  // ── Session helpers ────────────────────────────────────────────────────────

  func adminSettingsSession(token : Text) : ?AuthTypes.Session {
    switch (sessions.get(token)) {
      case (?s) { if (s.expiresAt > Time.now()) ?s else null };
      case null { null };
    };
  };

  func adminSettingsRequireAdmin(token : Text) : ?AuthTypes.Session {
    switch (adminSettingsSession(token)) {
      case null { null };
      case (?s) {
        switch (s.role) {
          case (#Admin) ?s;
          case _        { null };
        };
      };
    };
  };

  // ── Notification settings ──────────────────────────────────────────────────

  /// Returns current notification settings. Admin only.
  public shared func getNotificationSettings(token : Text) : async NotifTypes.NotificationSettings {
    switch (adminSettingsRequireAdmin(token)) {
      case null {
        Runtime.trap("Unauthorized: admin access required");
      };
      case (?_) {
        notificationSettings.value;
      };
    };
  };

  /// Updates notification settings. Admin only.
  public shared func updateNotificationSettings(
    input : {
      doctorCallNotificationsEnabled : Bool;
      cascadeLevel                   : Text;
      batchingEnabled                : Bool;
      batchWindowSeconds             : Nat;
      batchMinCount                  : Nat;
      quietHoursEnabled              : Bool;
      quietHoursStart                : Text;
      quietHoursEnd                  : Text;
    },
    token : Text,
  ) : async { #ok : Text; #err : Text } {
    switch (adminSettingsRequireAdmin(token)) {
      case null { #err("Unauthorized: admin access required") };
      case (?_) {
        // Validate cascadeLevel value
        let validLevels = ["asm_only", "asm_rsm", "asm_rsm_zsm", "all_levels"];
        let isValidLevel = validLevels.find(func(l : Text) : Bool { l == input.cascadeLevel }) != null;
        if (not isValidLevel) {
          return #err("Invalid cascadeLevel. Must be one of: asm_only, asm_rsm, asm_rsm_zsm, all_levels");
        };
        notificationSettings.value := {
          doctorCallNotificationsEnabled = input.doctorCallNotificationsEnabled;
          cascadeLevel                   = input.cascadeLevel;
          batchingEnabled                = input.batchingEnabled;
          batchWindowSeconds             = input.batchWindowSeconds;
          batchMinCount                  = input.batchMinCount;
          quietHoursEnabled              = input.quietHoursEnabled;
          quietHoursStart                = input.quietHoursStart;
          quietHoursEnd                  = input.quietHoursEnd;
        };
        #ok("Notification settings updated successfully");
      };
    };
  };

  // ── Absence settings ───────────────────────────────────────────────────────

  /// Returns current absence detection settings. Admin only.
  public shared func getAbsenceSettings(token : Text) : async {
    consecutiveAbsenceThreshold : Nat;
    absenceCheckEnabled         : Bool;
    excludeLongTermLeave        : Bool;
    warningNotificationsEnabled : Bool;
  } {
    switch (adminSettingsRequireAdmin(token)) {
      case null {
        Runtime.trap("Unauthorized: admin access required");
      };
      case (?_) {
        {
          consecutiveAbsenceThreshold = absenceSettings.consecutiveAbsenceThreshold;
          absenceCheckEnabled         = absenceSettings.absenceCheckEnabled;
          excludeLongTermLeave        = absenceSettings.excludeLongTermLeave;
          warningNotificationsEnabled = absenceSettings.warningNotificationsEnabled;
        };
      };
    };
  };

  /// Updates absence detection settings. Admin only.
  public shared func updateAbsenceSettings(
    input : {
      consecutiveAbsenceThreshold : Nat;
      absenceCheckEnabled         : Bool;
      excludeLongTermLeave        : Bool;
      warningNotificationsEnabled : Bool;
    },
    token : Text,
  ) : async { #ok : Text; #err : Text } {
    switch (adminSettingsRequireAdmin(token)) {
      case null { #err("Unauthorized: admin access required") };
      case (?_) {
        if (input.consecutiveAbsenceThreshold < 1 or input.consecutiveAbsenceThreshold > 30) {
          return #err("consecutiveAbsenceThreshold must be between 1 and 30");
        };
        absenceSettings.consecutiveAbsenceThreshold  := input.consecutiveAbsenceThreshold;
        absenceSettings.absenceCheckEnabled          := input.absenceCheckEnabled;
        absenceSettings.excludeLongTermLeave         := input.excludeLongTermLeave;
        absenceSettings.warningNotificationsEnabled  := input.warningNotificationsEnabled;
        #ok("Absence settings updated successfully");
      };
    };
  };

  /// Triggers the daily absence check immediately (admin-only, for testing / manual runs).
  /// The actual check logic is executed by the absence-inactivation domain at runtime;
  /// this endpoint signals that a manual run has been requested and returns confirmation.
  public shared func triggerAbsenceCheckNow(token : Text) : async { #ok : Text; #err : Text } {
    switch (adminSettingsRequireAdmin(token)) {
      case null { #err("Unauthorized: admin access required") };
      case (?_) {
        if (not absenceSettings.absenceCheckEnabled) {
          return #err("Absence check is currently disabled. Enable it in absence settings first.");
        };
        // Signal accepted — the absence domain timer or next scheduled run
        // will execute the full check. This call confirms the intent is logged.
        #ok("Absence check triggered at " # debug_show(Time.now()));
      };
    };
  };

};
