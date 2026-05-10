import BulkLib       "../lib/mtp-bulk-upload";
import AuthLib       "../lib/auth-users";
import BulkTypes     "../types/mtp-bulk-upload";
import TPTypes       "../types/travel-plan";
import AuthTypes     "../types/auth-users";
import NotifTypes    "../types/notifications";
import List          "mo:core/List";
import Map           "mo:core/Map";
import Time          "mo:core/Time";

mixin (
  sessions         : Map.Map<Text, AuthTypes.Session>,
  users            : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
  travelPlans      : List.List<TPTypes.TravelPlanRecord>,
  nextTravelPlanId : { var val : Nat },
  mtpBulkAuditLog  : List.List<BulkTypes.BulkMtpAuditEntry>,
  nextBulkAuditId  : { var val : Nat },
  notifications    : Map.Map<Text, NotifTypes.NotificationRecord>,
) {

  // ── Helpers ───────────────────────────────────────────────────────────────

  private func bulkRequireSession(token : Text) : ?AuthTypes.Session {
    AuthLib.validateSession(sessions, token, Time.now())
  };

  private func bulkPeekSession(token : Text) : ?AuthTypes.Session {
    AuthLib.peekSession(sessions, token, Time.now())
  };

  private func bulkIsAdminOrHr(role : AuthTypes.Role) : Bool {
    switch (role) {
      case (#Admin or #HRManager) { true };
      case _ { false };
    }
  };

  /// Build the "YYYY-MM" prefix for a given 1-based month and year.
  private func bulkMonthPrefix(month : Nat, year : Nat) : Text {
    let mm = if (month < 10) "0" # month.toText() else month.toText();
    year.toText() # "-" # mm
  };

  /// Return true if any Submitted (Approved) TravelPlanRecord exists for
  /// userId in the given month.
  private func bulkHasApprovedMtp(userId : Nat, month : Nat, year : Nat) : Bool {
    let prefix = bulkMonthPrefix(month, year);
    travelPlans.any(func(r : TPTypes.TravelPlanRecord) : Bool {
      r.userId == userId and
      r.status == #Submitted and
      r.date.startsWith(#text prefix)
    })
  };

  /// Delete all Draft TravelPlanRecords for userId in the given month.
  /// Rebuilds the list in-place.
  private func bulkDeleteDraftMtp(userId : Nat, month : Nat, year : Nat) : Nat {
    let prefix = bulkMonthPrefix(month, year);
    let toRemove = List.empty<Nat>();
    for (r in travelPlans.values()) {
      if (
        r.userId == userId and
        r.status == #Draft and
        r.date.startsWith(#text prefix)
      ) {
        toRemove.add(r.id);
      };
    };
    let removed = toRemove.size();
    let keep = List.empty<TPTypes.TravelPlanRecord>();
    for (r in travelPlans.values()) {
      let shouldRemove = toRemove.any(func(rid : Nat) : Bool { rid == r.id });
      if (not shouldRemove) { keep.add(r) };
    };
    travelPlans.clear();
    travelPlans.append(keep);
    removed
  };

  /// MTP submission deadline: 25th of each month (matches sfaReminderSettings default).
  private let mtpDeadlineDay : Nat = 25;

  // ── Public API ────────────────────────────────────────────────────────────

  /// Bulk-create MTP entries for the authenticated user or a target MR.
  /// Returns BulkMtpResult with savedCount, errorRows, and lateSubmission flag.
  public shared ({ caller = _ }) func bulkCreateTravelPlans(
    token : Text,
    input : BulkTypes.BulkMtpInput,
  ) : async BulkTypes.BulkMtpResult {
    let errResult = func(reason : Text) : BulkTypes.BulkMtpResult = {
      savedCount     = 0;
      errorRows      = [{ rowNumber = 0; date = ""; reason }];
      lateSubmission = false;
    };

    switch (bulkRequireSession(token)) {
      case null { errResult("Unauthorized: invalid or expired session") };
      case (?session) {
        // Determine target userId
        let (targetUserId, targetUserOpt) : (Nat, ?AuthTypes.UserRecord) =
          switch (input.targetEmployeeId) {
            case null { (session.userId, users.get(session.userId)) };
            case (?empIdText) {
              if (not bulkIsAdminOrHr(session.role)) {
                return errResult("Unauthorized: only Admin or HR can upload on behalf of another employee")
              };
              switch (empIdText.toNat()) {
                case null  { return errResult("Invalid targetEmployeeId: '" # empIdText # "'") };
                case (?tid) { (tid, users.get(tid)) };
              }
            };
          };

        let targetUserRecord = switch (targetUserOpt) {
          case null  { return errResult("Target employee not found") };
          case (?u)  { u };
        };

        // Reject if an Approved MTP already exists for this month
        if (bulkHasApprovedMtp(targetUserId, input.month, input.year)) {
          return errResult("An approved MTP already exists for this month. Please contact your manager or Admin to unlock it before re-uploading.")
        };

        // Overwrite any existing Draft MTP for this month
        let _ = bulkDeleteDraftMtp(targetUserId, input.month, input.year);

        // Run bulk creation (pure logic in lib)
        let (result, newRecords) = BulkLib.bulkCreateTravelPlans(
          targetUserId, input, nextTravelPlanId, Time.now(), mtpDeadlineDay
        );

        // Persist new Draft records
        for (r in newRecords.values()) {
          travelPlans.add(r);
        };

        // Audit log + MR notification when Admin/HR uploads on behalf
        switch (input.targetEmployeeId) {
          case (?_) {
            if (bulkIsAdminOrHr(session.role)) {
              let uploaderName = switch (users.get(session.userId)) {
                case (?u) { u.name };
                case null { "Unknown" };
              };
              let auditEntry : BulkTypes.BulkMtpAuditEntry = {
                id             = nextBulkAuditId.val;
                uploaderUserId = session.userId;
                uploaderName;
                targetUserId;
                targetUserName = targetUserRecord.name;
                month          = input.month;
                year           = input.year;
                rowsSaved      = result.savedCount;
                rowsSkipped    = result.errorRows.size();
                lateSubmission = result.lateSubmission;
                timestamp      = Time.now();
              };
              mtpBulkAuditLog.add(auditEntry);
              nextBulkAuditId.val += 1;

              let monthName : Text = switch (input.month) {
                case 1  "January";   case 2  "February"; case 3  "March";
                case 4  "April";     case 5  "May";      case 6  "June";
                case 7  "July";      case 8  "August";   case 9  "September";
                case 10 "October";   case 11 "November"; case 12 "December";
                case _  (input.month.toText());
              };
              let nowNs     = Time.now();
              let recipText = targetUserId.toText();
              let notifId   = nowNs.toText() # "_mtp_bulk_" # recipText;
              let notif : NotifTypes.NotificationRecord = {
                id                = notifId;
                recipientId       = recipText;
                senderId          = session.userId.toText();
                notificationType  = #mtpReminder;
                title             = "MTP Uploaded on Your Behalf";
                body              = "Your MTP for " # monthName # " " # input.year.toText() # " has been uploaded by " # uploaderName # ". Please review and submit it for approval.";
                isRead            = false;
                relatedEntityId   = null;
                relatedEntityType = ?("mtp");
                createdAt         = nowNs;
              };
              notifications.add(notifId, notif);
            };
          };
          case null {};
        };

        result
      };
    }
  };

  /// Return working-days breakdown for a month (Sundays excluded; holidayCount = 0).
  public query func countWorkingDaysInMonth(
    month : Nat,
    year  : Nat,
  ) : async BulkTypes.WorkingDaysResult {
    BulkLib.countWorkingDaysInMonth(month, year)
  };

  /// Return bulk-upload audit log entries (Admin/HR only), optionally
  /// filtered by month and/or year.
  public query func getBulkMtpAuditLog(
    token : Text,
    month : ?Nat,
    year  : ?Nat,
  ) : async [BulkTypes.BulkMtpAuditEntry] {
    switch (bulkPeekSession(token)) {
      case null { [] };
      case (?session) {
        if (not bulkIsAdminOrHr(session.role)) { return [] };
        let result = List.empty<BulkTypes.BulkMtpAuditEntry>();
        for (entry in mtpBulkAuditLog.values()) {
          let matchMonth = switch (month) { case null true; case (?m) entry.month == m };
          let matchYear  = switch (year)  { case null true; case (?y) entry.year  == y };
          if (matchMonth and matchYear) { result.add(entry) };
        };
        result.toArray()
      };
    }
  };

  /// Return the valid enum values for Type of Work and Mode of Transport.
  public query func getBulkMtpEnumValues() : async {
    typeOfWorkValues      : [Text];
    modeOfTransportValues : [Text];
  } {
    {
      typeOfWorkValues      = ["HQ", "Ex-Station", "Out-Station", "Joint Work with Manager"];
      modeOfTransportValues = ["Two Wheeler", "Four Wheeler", "Auto", "Train", "Bus", "Air"];
    }
  };
};
