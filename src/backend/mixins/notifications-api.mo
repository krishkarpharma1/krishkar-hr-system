import NotifTypes  "../types/notifications";
import AuthTypes   "../types/auth-users";
import FieldTypes  "../types/field-ops";
import DcrTypes    "../types/dcr";
import TpTypes     "../types/travel-plan";
import GpsTypes    "../types/gps-trail";
import CommonTypes "../types/common";
import NotifLib    "../lib/notifications";
import Map  "mo:core/Map";
import List "mo:core/List";
import Time "mo:core/Time";

mixin (
  sessions          : Map.Map<Text, AuthTypes.Session>,
  users             : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
  reports           : List.List<FieldTypes.CallReport>,
  doctors           : List.List<FieldTypes.Doctor>,
  notifications     : Map.Map<Text, NotifTypes.NotificationRecord>,
  notificationSettings : { var value : NotifTypes.NotificationSettings },
  pendingBatches    : Map.Map<Text, NotifTypes.PendingBatch>,
  dcrs              : List.List<DcrTypes.DcrRecord>,
  checkIns          : List.List<GpsTypes.AttendanceCheckIn>,
  travelPlans       : List.List<TpTypes.TravelPlanRecord>,
  sfaReminderSettings : { var value : NotifTypes.SfaReminderSettings },
) {

  // ── Session helpers ────────────────────────────────────────────────────────

  func requireNotifSession(token : Text) : ?AuthTypes.Session {
    switch (sessions.get(token)) {
      case (?s) { if (s.expiresAt > Time.now()) ?s else null };
      case null { null };
    }
  };

  // ── Notification inbox API ─────────────────────────────────────────────────

  /// Return up to 50 most-recent notifications for the logged-in user.
  public query func getMyNotifications(
    token : Text,
  ) : async [NotifTypes.NotificationRecord] {
    switch (requireNotifSession(token)) {
      case null { [] };
      case (?s) {
        NotifLib.getNotificationsForUser(s.userId.toText(), notifications)
      };
    }
  };

  /// Return the unread notification count for the logged-in user.
  public query func getUnreadNotificationCount(
    token : Text,
  ) : async Nat {
    switch (requireNotifSession(token)) {
      case null { 0 };
      case (?s) {
        NotifLib.getUnreadCount(s.userId.toText(), notifications)
      };
    }
  };

  /// Mark specific notification IDs as read (only for the calling user's own notifications).
  public shared func markNotificationsRead(
    notificationIds : [Text],
    token           : Text,
  ) : async CommonTypes.MutationResult {
    switch (requireNotifSession(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        NotifLib.markAsRead(notificationIds, s.userId.toText(), notifications)
      };
    }
  };

  /// Mark all of the calling user's notifications as read.
  public shared func markAllNotificationsRead(
    token : Text,
  ) : async CommonTypes.MutationResult {
    switch (requireNotifSession(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        NotifLib.markAllAsRead(s.userId.toText(), notifications)
      };
    }
  };

  /// Remove all of the calling user's notifications from the inbox.
  public shared func clearMyNotifications(
    token : Text,
  ) : async CommonTypes.MutationResult {
    switch (requireNotifSession(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        NotifLib.clearNotifications(s.userId.toText(), notifications)
      };
    }
  };

  // ── Doctor Call notification trigger ──────────────────────────────────────

  /// Called by the frontend immediately after a Doctor Call is submitted.
  /// Looks up the call report, resolves the MR user and doctor name,
  /// then triggers the notification cascade.
  public shared func triggerDoctorCallNotification(
    callReportId : Text,
    token        : Text,
  ) : async CommonTypes.MutationResult {
    switch (requireNotifSession(token)) {
      case null { return #err("Unauthorized: invalid or expired session") };
      case (?s) {
        // Only MR (and higher roles acting as MR) may trigger this
        let reportIdNat : Nat = switch (callReportId.toNat()) {
          case (?n) { n };
          case null { return #err("Invalid call report ID") };
        };

        // Find the call report
        let reportOpt = reports.find(func(r : FieldTypes.CallReport) : Bool {
          r.id == reportIdNat and r.mrId == s.userId
        });

        let callReport = switch (reportOpt) {
          case null { return #err("Call report not found or does not belong to caller") };
          case (?r) { r };
        };

        // Find the submitting MR's user record
        let mrUser = switch (users.get(s.userId)) {
          case null { return #err("Caller user record not found") };
          case (?u) { u };
        };

        // Resolve the primary doctor name from the first visit entry
        let doctorName : Text = if (callReport.doctorsVisited.size() > 0) {
          let firstVisit = callReport.doctorsVisited[0];
          switch (doctors.find(func(d : FieldTypes.Doctor) : Bool { d.id == firstVisit.doctorId })) {
            case (?d)  { d.name };
            case null  { "Unknown Doctor" };
          }
        } else {
          "Unknown Doctor"
        };

        let _ = NotifLib.triggerDoctorCallNotification(
          callReport,
          mrUser,
          doctorName,
          users,
          notificationSettings.value,
          notifications,
          pendingBatches,
        );

        #ok
      };
    }
  };

  // ── DCR / MTP Reminder helpers (called by frontend scheduler) ─────────────────────

  /// Get SFA reminder settings (Admin-configurable).
  public query func getSfaReminderSettings(token : Text) : async { #ok : NotifTypes.SfaReminderSettings; #err : Text } {
    switch (requireNotifSession(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?_) { #ok(sfaReminderSettings.value) };
    }
  };

  /// Update SFA reminder settings (Admin only).
  public shared func setSfaReminderSettings(
    token    : Text,
    settings : NotifTypes.SfaReminderSettings,
  ) : async { #ok; #err : Text } {
    switch (requireNotifSession(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        switch (s.role) {
          case (#Admin) { sfaReminderSettings.value := settings; #ok };
          case _ { #err("Access denied: Admin only") };
        }
      };
    }
  };

  /// Returns the IDs of MRs who checked in on the given date but have not
  /// yet submitted a DCR (status = Submitted|Late|Approved|Rejected).
  /// Date format: ISO "YYYY-MM-DD".
  /// Called by the frontend scheduler to trigger DCR reminders.
  public query func getDcrUnsubmittedMRs(token : Text, date : Text) : async { #ok : [Nat]; #err : Text } {
    switch (requireNotifSession(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        switch (s.role) {
          case (#Admin or #HRManager) {};
          case _ { return #err("Access denied: Admin or HR required") };
        };
        let result : List.List<Nat> = List.empty();
        for ((_, u) in users.entries()) {
          if (u.role == #MR and u.status == #Active) {
            let checkedIn = checkIns.any(func(ci : GpsTypes.AttendanceCheckIn) : Bool {
              ci.userId == u.id and ci.date == date
            });
            if (checkedIn) {
              let hasDcr = dcrs.any(func(d : DcrTypes.DcrRecord) : Bool {
                d.mrId == u.id and d.date == date and
                (d.status == #Submitted or d.status == #Late or
                 d.status == #Approved  or d.status == #Rejected)
              });
              if (not hasDcr) { result.add(u.id) };
            };
          };
        };
        #ok(result.toArray())
      };
    }
  };

  /// Returns the IDs of MRs who have no submitted/approved MTP for the given month/year.
  /// Called by the frontend scheduler to trigger MTP reminders.
  public query func getMtpUnsubmittedMRs(token : Text, month : Nat, year : Nat) : async { #ok : [Nat]; #err : Text } {
    switch (requireNotifSession(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        switch (s.role) {
          case (#Admin or #HRManager) {};
          case _ { return #err("Access denied: Admin or HR required") };
        };
        let monthStr = if (month < 10) "0" # month.toText() else month.toText();
        let prefix   = year.toText() # "-" # monthStr;
        let result : List.List<Nat> = List.empty();
        for ((_, u) in users.entries()) {
          if (u.role == #MR and u.status == #Active) {
            let hasMtp = travelPlans.any(func(tp : TpTypes.TravelPlanRecord) : Bool {
              tp.userId == u.id and tp.date.startsWith(#text prefix)
            });
            if (not hasMtp) { result.add(u.id) };
          };
        };
        #ok(result.toArray())
      };
    }
  };

  /// Create a DCR reminder in-app notification for an MR.
  /// Called by the frontend scheduler after getDcrUnsubmittedMRs.
  public shared func createDcrReminder(token : Text, mrId : Nat) : async { #ok; #err : Text } {
    switch (requireNotifSession(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        switch (s.role) {
          case (#Admin or #HRManager) {};
          case _ { return #err("Access denied: Admin or HR required") };
        };
        let deadlineHour = sfaReminderSettings.value.dcrReminderHour;
        let nowNs  = Time.now();
        let notifId = nowNs.toText() # "_dcr_reminder_" # mrId.toText();
        let notif : NotifTypes.NotificationRecord = {
          id                = notifId;
          recipientId       = mrId.toText();
          senderId          = "system";
          notificationType  = #dcrReminder;
          title             = "DCR Reminder";
          body              = "Please submit your Daily Call Report (DCR) before " # deadlineHour.toText() # ":00 today.";
          isRead            = false;
          relatedEntityId   = null;
          relatedEntityType = ?"dcr";
          createdAt         = nowNs;
        };
        notifications.add(notifId, notif);
        #ok
      };
    }
  };

  /// Create an MTP reminder in-app notification for an MR.
  /// Called by the frontend scheduler after getMtpUnsubmittedMRs.
  public shared func createMtpReminder(token : Text, mrId : Nat) : async { #ok; #err : Text } {
    switch (requireNotifSession(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        switch (s.role) {
          case (#Admin or #HRManager) {};
          case _ { return #err("Access denied: Admin or HR required") };
        };
        let deadline = sfaReminderSettings.value.mtpDeadlineDay;
        let nowNs    = Time.now();
        let notifId  = nowNs.toText() # "_mtp_reminder_" # mrId.toText();
        let notif : NotifTypes.NotificationRecord = {
          id                = notifId;
          recipientId       = mrId.toText();
          senderId          = "system";
          notificationType  = #mtpReminder;
          title             = "MTP Submission Reminder";
          body              = "Please submit your Monthly Tour Program (MTP) before the " # deadline.toText() # "th of this month.";
          isRead            = false;
          relatedEntityId   = null;
          relatedEntityType = ?"mtp";
          createdAt         = nowNs;
        };
        notifications.add(notifId, notif);
        #ok
      };
    }
  };
};
