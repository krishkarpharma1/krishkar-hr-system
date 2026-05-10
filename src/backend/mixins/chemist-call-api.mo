import ChemistCallLib "../lib/chemist-call";
import AuthLib        "../lib/auth-users";
import Types          "../types/chemist-call";
import AuthTypes      "../types/auth-users";
import List           "mo:core/List";
import Map            "mo:core/Map";
import Time           "mo:core/Time";

mixin (
  sessions          : Map.Map<Text, AuthTypes.Session>,
  chemistCalls      : List.List<Types.ChemistCallRecord>,
  stockistCalls     : List.List<Types.StockistCallRecord>,
  nextChemistCallId  : { var val : Nat },
  nextStockistCallId : { var val : Nat },
) {

  // ── Session helpers ───────────────────────────────────────────────────────

  private func requireSessionCC(token : Text) : ?AuthTypes.Session {
    AuthLib.validateSession(sessions, token, Time.now())
  };

  private func chemistCallPeekSession(token : Text) : ?AuthTypes.Session {
    AuthLib.peekSession(sessions, token, Time.now())
  };

  private func ccIsManagerOrAbove(role : AuthTypes.Role) : Bool {
    switch (role) {
      case (#ASM or #RSM or #ZSM or #HRManager or #Admin) { true };
      case _ { false };
    }
  };

  // ── Chemist Call API ──────────────────────────────────────────────────────

  /// Submit a chemist visit — MR only.
  public shared ({ caller = _ }) func submitChemistCall(
    token : Text,
    input : Types.ChemistCallInput,
  ) : async { #ok : Nat; #err : Text } {
    switch (requireSessionCC(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        switch (session.role) {
          case (#MR) {
            let id = ChemistCallLib.submitChemistCall(
              chemistCalls, nextChemistCallId, session.userId, input, Time.now()
            );
            #ok(id)
          };
          case _ { #err("Unauthorized: MR role required to submit chemist calls") };
        }
      };
    }
  };

  /// Get a chemist call by ID (any authenticated user).
  public query func getChemistCall(
    token  : Text,
    callId : Nat,
  ) : async ?Types.ChemistCallInfo {
    switch (chemistCallPeekSession(token)) {
      case null   { null };
      case (?_)   { ChemistCallLib.getChemistCall(chemistCalls, callId) };
    }
  };

  /// List calling MR's own chemist calls within a date range.
  public query func listMyChemistCalls(
    token    : Text,
    fromDate : Text,
    toDate   : Text,
  ) : async [Types.ChemistCallInfo] {
    switch (chemistCallPeekSession(token)) {
      case null        { [] };
      case (?session)  {
        ChemistCallLib.listMyChemistCalls(chemistCalls, session.userId, fromDate, toDate)
      };
    }
  };

  /// List chemist calls for a set of MRs — manager/HR/Admin only.
  public query func listTeamChemistCalls(
    token    : Text,
    mrIds    : [Nat],
    fromDate : Text,
    toDate   : Text,
  ) : async [Types.ChemistCallInfo] {
    switch (chemistCallPeekSession(token)) {
      case null { [] };
      case (?session) {
        if (not ccIsManagerOrAbove(session.role)) { return [] };
        ChemistCallLib.listChemistCallsForTeam(chemistCalls, mrIds, fromDate, toDate)
      };
    }
  };

  // ── Stockist Call API ─────────────────────────────────────────────────────

  /// Submit a stockist visit — MR only.
  public shared ({ caller = _ }) func submitStockistCall(
    token : Text,
    input : Types.StockistCallInput,
  ) : async { #ok : Nat; #err : Text } {
    switch (requireSessionCC(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?session) {
        switch (session.role) {
          case (#MR) {
            let id = ChemistCallLib.submitStockistCall(
              stockistCalls, nextStockistCallId, session.userId, input, Time.now()
            );
            #ok(id)
          };
          case _ { #err("Unauthorized: MR role required to submit stockist calls") };
        }
      };
    }
  };

  /// Get a stockist call by ID (any authenticated user).
  public query func getStockistCall(
    token  : Text,
    callId : Nat,
  ) : async ?Types.StockistCallInfo {
    switch (chemistCallPeekSession(token)) {
      case null  { null };
      case (?_)  { ChemistCallLib.getStockistCall(stockistCalls, callId) };
    }
  };

  /// List calling MR's own stockist calls within a date range.
  public query func listMyStockistCalls(
    token    : Text,
    fromDate : Text,
    toDate   : Text,
  ) : async [Types.StockistCallInfo] {
    switch (chemistCallPeekSession(token)) {
      case null        { [] };
      case (?session)  {
        ChemistCallLib.listMyStockistCalls(stockistCalls, session.userId, fromDate, toDate)
      };
    }
  };

  /// List stockist calls for a set of MRs — manager/HR/Admin only.
  public query func listTeamStockistCalls(
    token    : Text,
    mrIds    : [Nat],
    fromDate : Text,
    toDate   : Text,
  ) : async [Types.StockistCallInfo] {
    switch (chemistCallPeekSession(token)) {
      case null { [] };
      case (?session) {
        if (not ccIsManagerOrAbove(session.role)) { return [] };
        ChemistCallLib.listStockistCallsForTeam(stockistCalls, mrIds, fromDate, toDate)
      };
    }
  };

  // ── Coverage Report API ───────────────────────────────────────────────────

  /// Combined chemist and stockist coverage report for a team — manager/HR/Admin only.
  public query func getChemistStockistCoverage(
    token    : Text,
    mrIds    : [Nat],
    fromDate : Text,
    toDate   : Text,
  ) : async { chemistCoverage : [Types.CoverageRow]; stockistCoverage : [Types.CoverageRow] } {
    switch (chemistCallPeekSession(token)) {
      case null {
        { chemistCoverage = []; stockistCoverage = [] }
      };
      case (?session) {
        if (not ccIsManagerOrAbove(session.role)) {
          return { chemistCoverage = []; stockistCoverage = [] }
        };
        // mrNames not available here without users map — pass empty list; names resolved on frontend
        let emptyNames : [(Nat, Text)] = [];
        let cc = ChemistCallLib.getChemistCoverage(chemistCalls, mrIds, fromDate, toDate, emptyNames);
        let sc = ChemistCallLib.getStockistCoverage(stockistCalls, mrIds, fromDate, toDate, emptyNames);
        { chemistCoverage = cc; stockistCoverage = sc }
      };
    }
  };

  /// Count of chemist and stockist calls for a specific MR on a given date.
  /// Used by the DCR module for pre-fill.
  public query func getDailyCallCounts(
    token  : Text,
    mrId   : Nat,
    date   : Text,
  ) : async { chemistCount : Nat; stockistCount : Nat } {
    switch (chemistCallPeekSession(token)) {
      case null { { chemistCount = 0; stockistCount = 0 } };
      case (?_) {
        ChemistCallLib.getDailyCallCounts(chemistCalls, stockistCalls, mrId, date)
      };
    }
  };
};
