import JfwLib   "../lib/jfw";
import AuthLib   "../lib/auth-users";
import JfwTypes  "../types/jfw";
import AuthTypes "../types/auth-users";
import Map       "mo:core/Map";
import List      "mo:core/List";
import Time      "mo:core/Time";

mixin (
  sessions  : Map.Map<Text, AuthTypes.Session>,
  users     : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
  jfws      : List.List<JfwTypes.JfwRecord>,
  nextJfwId : { var value : Nat },
) {

  // ── Session helpers ────────────────────────────────────────────────────────

  private func requireJfwSession(token : Text) : ?AuthTypes.Session {
    AuthLib.validateSession(sessions, token, Time.now())
  };

  private func peekJfwSession(token : Text) : ?AuthTypes.Session {
    AuthLib.peekSession(sessions, token, Time.now())
  };

  // ── Role guards ────────────────────────────────────────────────────────────

  private func canSubmitJfw(role : AuthTypes.Role) : Bool {
    switch (role) {
      case (#ASM or #RSM) { true };
      case _              { false };
    }
  };

  private func jfwIsHrOrAdmin(role : AuthTypes.Role) : Bool {
    switch (role) {
      case (#HRManager or #Admin) { true };
      case _                      { false };
    }
  };

  // ── Lookup helpers ─────────────────────────────────────────────────────────

  private func allNamesList() : [(AuthTypes.UserId, Text)] {
    let result = List.empty<(AuthTypes.UserId, Text)>();
    for ((_, u) in users.entries()) {
      result.add((u.id, u.name));
    };
    result.toArray()
  };

  private func lookupName(userId : AuthTypes.UserId) : Text {
    switch (users.get(userId)) {
      case (?u) { u.name };
      case null { "Unknown" };
    }
  };

  // ── Public API ─────────────────────────────────────────────────────────────

  /// Manager (ASM or RSM) submits a JFW entry for an MR.
  public shared ({ caller = _ }) func submitJfw(
    token : Text,
    input : JfwTypes.JfwInput,
  ) : async { #ok : Nat; #err : Text } {
    switch (requireJfwSession(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        if (not canSubmitJfw(session.role)) return #err("Only ASM or RSM can submit JFW entries");
        let mrName = lookupName(input.mrId);
        let id = JfwLib.submitJfw(jfws, nextJfwId, session.userId, input, mrName, Time.now());
        #ok(id)
      };
    }
  };

  /// Get a single JFW record by ID (authenticated).
  public query func getJfw(
    token : Text,
    jfwId : Nat,
  ) : async ?JfwTypes.JfwInfo {
    switch (peekJfwSession(token)) {
      case null  { null };
      case (?_)  { JfwLib.getJfw(jfws, jfwId) };
    }
  };

  /// List JFW entries submitted by the calling manager.
  public query func listMyJfws(
    token    : Text,
    fromDate : Text,
    toDate   : Text,
  ) : async [JfwTypes.JfwInfo] {
    switch (peekJfwSession(token)) {
      case null        { [] };
      case (?session)  {
        JfwLib.listJfwsByManager(jfws, session.userId, fromDate, toDate)
      };
    }
  };

  /// MR's own view — all JFW reports filed about them.
  public query func listJfwsAboutMe(
    token : Text,
  ) : async [JfwTypes.JfwInfo] {
    switch (peekJfwSession(token)) {
      case null        { [] };
      case (?session)  { JfwLib.listJfwsForMR(jfws, session.userId) };
    }
  };

  /// MR acknowledges a JFW report filed about them (MR role only).
  public shared ({ caller = _ }) func acknowledgeJfw(
    token : Text,
    jfwId : Nat,
  ) : async { #ok : Text; #err : Text } {
    switch (requireJfwSession(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        if (session.role != #MR) return #err("Only MRs can acknowledge a JFW");
        switch (JfwLib.acknowledgeJfw(jfws, session.userId, jfwId, Time.now())) {
          case (#ok)      { #ok("JFW acknowledged") };
          case (#err(e))  { #err(e) };
        }
      };
    }
  };

  /// HR/Admin view — all JFW entries within a date range.
  public query func getAllJfws(
    token    : Text,
    fromDate : Text,
    toDate   : Text,
  ) : async [JfwTypes.JfwInfo] {
    switch (peekJfwSession(token)) {
      case null { [] };
      case (?session) {
        if (not jfwIsHrOrAdmin(session.role)) return [];
        JfwLib.listAllJfws(jfws, fromDate, toDate)
      };
    }
  };

  /// HR/Admin — JFW Summary Report grouped by (manager, MR) pair.
  public query func getJfwSummary(
    token    : Text,
    fromDate : Text,
    toDate   : Text,
  ) : async [JfwTypes.JfwSummaryRow] {
    switch (peekJfwSession(token)) {
      case null { [] };
      case (?session) {
        if (not jfwIsHrOrAdmin(session.role)) return [];
        let names = allNamesList();
        JfwLib.getJfwSummary(jfws, fromDate, toDate, names, names)
      };
    }
  };

  /// Manager view — JFWs for a specific MR (ASM, RSM, HR, Admin).
  public query func listJfwsForMR(
    token : Text,
    mrId  : Nat,
  ) : async [JfwTypes.JfwInfo] {
    switch (peekJfwSession(token)) {
      case null { [] };
      case (?session) {
        switch (session.role) {
          case (#ASM or #RSM or #ZSM or #HRManager or #Admin) {
            JfwLib.listJfwsForMR(jfws, mrId)
          };
          case _ { [] };
        }
      };
    }
  };
};
