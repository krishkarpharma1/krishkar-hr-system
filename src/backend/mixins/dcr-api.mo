import DcrLib        "../lib/dcr";
import AuthLib       "../lib/auth-users";
import DcrTypes      "../types/dcr";
import AuthTypes     "../types/auth-users";
import GpsTypes      "../types/gps-trail";
import Map           "mo:core/Map";
import List          "mo:core/List";
import Time          "mo:core/Time";

mixin (
  sessions      : Map.Map<Text, AuthTypes.Session>,
  users         : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
  checkIns      : List.List<GpsTypes.AttendanceCheckIn>,
  dcrs          : List.List<DcrTypes.DcrRecord>,
  nextDcrId     : { var value : Nat },
  dcrSettings   : DcrTypes.DcrSettings,
) {

  // ── Session helpers ─────────────────────────────────────────────────────

  private func requireDcrSession(token : Text) : ?AuthTypes.Session {
    AuthLib.validateSession(sessions, token, Time.now())
  };

  private func peekDcrSession(token : Text) : ?AuthTypes.Session {
    AuthLib.peekSession(sessions, token, Time.now())
  };

  // ── Role guards ────────────────────────────────────────────────────────

  private func dcrIsManagerOrAbove(role : AuthTypes.Role) : Bool {
    switch (role) {
      case (#ASM or #RSM or #ZSM or #HRManager or #Admin) { true };
      case _ { false };
    }
  };

  private func canApproveDcr(role : AuthTypes.Role) : Bool {
    switch (role) {
      case (#ASM or #RSM or #HRManager or #Admin) { true };
      case _ { false };
    }
  };

  // ── Lookup helpers ─────────────────────────────────────────────────────

  private func allMrNamesList() : [(AuthTypes.UserId, Text)] {
    let result = List.empty<(AuthTypes.UserId, Text)>();
    for ((_, u) in users.entries()) {
      result.add((u.id, u.name));
    };
    result.toArray()
  };

  private func datePrefix(t : Text) : Text {
    let chars = t.toArray();
    var result = "";
    var i = 0;
    for (c in chars.values()) {
      if (i < 10) { result := result # c.toText() };
      i += 1;
    };
    result
  };

  private func mrCheckedInOnDate(mrId : AuthTypes.UserId, date : Text) : Bool {
    checkIns.find(func(c : GpsTypes.AttendanceCheckIn) : Bool {
      c.userId == mrId and datePrefix(c.date) == date
    }) != null
  };

  // ── Public API ────────────────────────────────────────────────────────────

  /// MR submits their DCR for a given date.
  public shared ({ caller = _ }) func submitDcr(
    token : Text,
    input : DcrTypes.DcrInput,
  ) : async { #ok : Nat; #err : Text } {
    switch (requireDcrSession(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        if (session.role != #MR) return #err("Only MRs can submit a DCR");
        let id = DcrLib.submitDcr(dcrs, nextDcrId, dcrSettings, session.userId, input, Time.now());
        if (id == 0) #err("A DCR has already been submitted for this date")
        else #ok(id)
      };
    }
  };

  /// Get the calling MR's DCR for a specific date.
  public query func getMyDcr(
    token : Text,
    date  : Text,
  ) : async ?DcrTypes.DcrInfo {
    switch (peekDcrSession(token)) {
      case null        { null };
      case (?session)  { DcrLib.getDcrByMrAndDate(dcrs, session.userId, date) };
    }
  };

  /// List the calling MR's DCRs within a date range.
  public query func listMyDcrs(
    token    : Text,
    fromDate : Text,
    toDate   : Text,
  ) : async [DcrTypes.DcrInfo] {
    switch (peekDcrSession(token)) {
      case null        { [] };
      case (?session)  { DcrLib.listDcrsForMR(dcrs, session.userId, fromDate, toDate) };
    }
  };

  /// Manager view — list DCRs for a set of MR IDs (manager role required).
  public query func listTeamDcrs(
    token    : Text,
    mrIds    : [Nat],
    fromDate : Text,
    toDate   : Text,
  ) : async [DcrTypes.DcrInfo] {
    switch (peekDcrSession(token)) {
      case null { [] };
      case (?session) {
        if (not dcrIsManagerOrAbove(session.role)) return [];
        DcrLib.listDcrsForTeam(dcrs, mrIds, fromDate, toDate)
      };
    }
  };

  /// Approve or reject a DCR (ASM, RSM, HR, Admin only).
  public shared ({ caller = _ }) func approveDcr(
    token : Text,
    input : DcrTypes.DcrApprovalInput,
  ) : async { #ok : Text; #err : Text } {
    switch (requireDcrSession(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        if (not canApproveDcr(session.role)) return #err("Insufficient role to approve DCRs");
        switch (DcrLib.approveDcr(dcrs, session.userId, input, Time.now())) {
          case (#ok)      { #ok("DCR updated successfully") };
          case (#err(e))  { #err(e) };
        }
      };
    }
  };

  /// DCR Summary Report — one row per (MR, date) in range (manager role required).
  public query func getDcrSummary(
    token    : Text,
    mrIds    : [Nat],
    fromDate : Text,
    toDate   : Text,
  ) : async [DcrTypes.DcrSummaryRow] {
    switch (peekDcrSession(token)) {
      case null { [] };
      case (?session) {
        if (not dcrIsManagerOrAbove(session.role)) return [];
        DcrLib.getDcrSummary(dcrs, mrIds, fromDate, toDate, allMrNamesList())
      };
    }
  };

  /// Fetch current DCR settings (any authenticated user).
  public query func getDcrSettings(
    token : Text,
  ) : async DcrTypes.DcrSettingsInfo {
    let defaultInfo : DcrTypes.DcrSettingsInfo = {
      dailyDeadlineHour   = dcrSettings.dailyDeadlineHour;
      dailyDeadlineMinute = dcrSettings.dailyDeadlineMinute;
      isEnabled           = dcrSettings.isEnabled;
    };
    switch (peekDcrSession(token)) {
      case null { defaultInfo };
      case (?_) { DcrLib.getDcrSettings(dcrSettings) };
    }
  };

  /// Update DCR deadline settings (Admin only).
  public shared ({ caller = _ }) func updateDcrSettings(
    token          : Text,
    deadlineHour   : Nat,
    deadlineMinute : Nat,
    isEnabled      : Bool,
  ) : async { #ok : Text; #err : Text } {
    switch (requireDcrSession(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        if (session.role != #Admin) return #err("Admin role required");
        switch (DcrLib.updateDcrSettings(dcrSettings, ?deadlineHour, ?deadlineMinute, ?isEnabled)) {
          case (#err(e)) { #err(e) };
          case (#ok)     { #ok("DCR settings updated") };
        }
      };
    }
  };

  /// Returns true if the given MR has checked in but not submitted a DCR for the date.
  public query func checkDcrPending(
    token : Text,
    mrId  : Nat,
    date  : Text,
  ) : async Bool {
    switch (peekDcrSession(token)) {
      case null  { false };
      case (?_)  {
        let checkedIn = mrCheckedInOnDate(mrId, date);
        DcrLib.checkPendingDcrForMR(dcrs, mrId, date, checkedIn)
      };
    }
  };

  /// Get a DCR by its ID (any authenticated user).
  public query func getDcrById(
    token : Text,
    dcrId : Nat,
  ) : async ?DcrTypes.DcrInfo {
    switch (peekDcrSession(token)) {
      case null  { null };
      case (?_)  { DcrLib.getDcr(dcrs, dcrId) };
    }
  };
};
