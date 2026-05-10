import ACLib    "../lib/attendance-correction";
import ACTypes  "../types/attendance-correction";
import AuthLib  "../lib/auth-users";
import AuthTypes "../types/auth-users";
import GpsTypes "../types/gps-trail";
import NotifTypes "../types/notifications";
import Map  "mo:core/Map";
import List "mo:core/List";
import Time "mo:core/Time";

/// Public API mixin for Attendance Correction Requests.
mixin (
  sessions              : Map.Map<Text, AuthTypes.Session>,
  users                 : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
  checkIns              : List.List<GpsTypes.AttendanceCheckIn>,
  correctionRequests    : List.List<ACTypes.AttendanceCorrectionRequest>,
  nextCorrectionId      : { var value : Nat },
  notifications         : Map.Map<Text, NotifTypes.NotificationRecord>,
) {

  private func acRequireSession(token : Text) : ?AuthTypes.Session {
    AuthLib.validateSession(sessions, token, Time.now())
  };

  private func acPeekSession(token : Text) : ?AuthTypes.Session {
    AuthLib.peekSession(sessions, token, Time.now())
  };

  private func acIsHrOrAdmin(role : AuthTypes.Role) : Bool {
    switch (role) {
      case (#HRManager or #Admin) { true };
      case _ { false };
    }
  };

  /// MR submits an attendance correction request for an auto-checkout.
  public shared ({ caller = _ }) func submitAttendanceCorrectionRequest(
    token            : Text,
    autoCheckoutDate : Text,
    claimedTime      : Text,
    reason           : Text,
    evidence         : ?Text,
  ) : async { #ok : Nat; #err : Text } {
    switch (acRequireSession(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        let now = Time.now();
        let id = ACLib.createCorrectionRequest(
          correctionRequests,
          nextCorrectionId,
          session.userId,
          autoCheckoutDate,  // date displayed same as autoCheckoutDate for this feature
          autoCheckoutDate,
          claimedTime,
          reason,
          evidence,
          now,
        );
        // Notify HR and Admin
        let empName = switch (users.get(session.userId)) {
          case (?u) { u.name };
          case null { "Employee" };
        };
        let notifBody = empName # " has submitted an Attendance Correction Request for " # autoCheckoutDate # ". Claimed checkout time: " # claimedTime # ". Please review.";
        // Notify all HR and Admin users
        for ((_, u) in users.entries()) {
          switch (u.role) {
            case (#HRManager or #Admin) {
              let nid = now.toText() # "_acreq_" # u.id.toText();
              let notif : NotifTypes.NotificationRecord = {
                id                = nid;
                recipientId       = u.id.toText();
                senderId          = session.userId.toText();
                notificationType  = #dcrReminder;  // reusing available type
                title             = "Attendance Correction Request";
                body              = notifBody;
                isRead            = false;
                relatedEntityId   = ?id.toText();
                relatedEntityType = ?"attendanceCorrection";
                createdAt         = now;
              };
              notifications.add(nid, notif);
            };
            case _ {};
          };
        };
        #ok(id)
      };
    }
  };

  /// HR or Admin reviews an attendance correction request.
  public shared ({ caller = _ }) func reviewAttendanceCorrectionRequest(
    token     : Text,
    requestId : Nat,
    approved  : Bool,
    note      : ?Text,
  ) : async { #ok : Text; #err : Text } {
    switch (acRequireSession(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        if (not acIsHrOrAdmin(session.role)) {
          return #err("Access denied: HR or Admin role required");
        };
        let now = Time.now();
        switch (ACLib.reviewCorrectionRequest(
          correctionRequests, checkIns, requestId,
          session.userId, approved, note, now,
        )) {
          case (#err(e)) { #err(e) };
          case (#ok) {
            // Notify the employee
            switch (correctionRequests.find(func(r : ACTypes.AttendanceCorrectionRequest) : Bool { r.requestId == requestId })) {
              case (?req) {
                let statusText = if (approved) "approved" else "rejected";
                let nid = now.toText() # "_acrev_" # req.employeeId.toText();
                let notif : NotifTypes.NotificationRecord = {
                  id                = nid;
                  recipientId       = req.employeeId.toText();
                  senderId          = session.userId.toText();
                  notificationType  = #dcrReminder;
                  title             = "Attendance Correction " # (if (approved) "Approved" else "Rejected");
                  body              = "Your Attendance Correction Request for " # req.autoCheckoutDate # " has been " # statusText # "." # (switch (note) { case (?n) " Note: " # n; case null "" });
                  isRead            = false;
                  relatedEntityId   = ?requestId.toText();
                  relatedEntityType = ?"attendanceCorrection";
                  createdAt         = now;
                };
                notifications.add(nid, notif);
              };
              case null {};
            };
            #ok("Correction request " # (if (approved) "approved" else "rejected") # " successfully")
          };
        }
      };
    }
  };

  /// Get correction requests — MR sees own, HR/Admin see all.
  public query func getAttendanceCorrectionRequests(
    token : Text,
  ) : async [ACTypes.AttendanceCorrectionRequest] {
    switch (acPeekSession(token)) {
      case null { [] };
      case (?session) {
        if (acIsHrOrAdmin(session.role)) {
          ACLib.getAllRequests(correctionRequests)
        } else {
          ACLib.getRequestsForEmployee(correctionRequests, session.userId)
        }
      };
    }
  };
};
