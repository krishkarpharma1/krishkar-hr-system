import SugTypes    "../types/suggestions";
import AuthTypes   "../types/auth-users";
import HRCoreTypes "../types/hr-core";
import CommonTypes "../types/common";
import SugLib      "../lib/suggestions";
import Map         "mo:core/Map";
import List        "mo:core/List";
import Time        "mo:core/Time";

mixin (
  sessions    : Map.Map<Text, AuthTypes.Session>,
  users       : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
  leaves      : List.List<HRCoreTypes.LeaveApplication>,
  suggestions : List.List<SugTypes.SuggestionSubmission>,
  nextSuggestionId : { var value : Nat },
) {

  // ── Session helpers ────────────────────────────────────────────────────────

  func requireSugSession(token : Text) : ?AuthTypes.Session {
    switch (sessions.get(token)) {
      case (?s) { if (s.expiresAt > Time.now()) ?s else null };
      case null { null };
    }
  };

  func requireSugHROrAdmin(token : Text) : ?AuthTypes.Session {
    switch (requireSugSession(token)) {
      case null { null };
      case (?s) {
        switch (s.role) {
          case (#Admin or #HRManager) ?s;
          case _ { null };
        }
      };
    }
  };

  // ── Suggestions & Queries API ──────────────────────────────────────────────

  /// Submit a new suggestion, query, complaint, feedback, or other message.
  /// Any authenticated user may call this.
  public shared func submitSuggestion(
    token : Text,
    input : SugTypes.SubmitSuggestionInput,
  ) : async CommonTypes.MutationResult {
    switch (requireSugSession(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        let empId : Text = switch (users.get(s.userId)) {
          case (?u) u.employeeId;
          case null { s.employeeId };
        };
        let _ = SugLib.submitSuggestion(suggestions, nextSuggestionId, s, empId, input);
        #ok
      };
    }
  };

  /// HR or Admin updates the status of a submission (Under Review / Resolved / Closed).
  public shared func updateSuggestionStatus(
    token : Text,
    input : SugTypes.UpdateSuggestionStatusInput,
  ) : async CommonTypes.MutationResult {
    switch (requireSugHROrAdmin(token)) {
      case null { #err("Unauthorized: HR or Admin role required") };
      case (?_) {
        switch (SugLib.updateSuggestionStatus(suggestions, input)) {
          case (?_) { #ok };
          case null { #err("Suggestion not found") };
        }
      };
    }
  };

  /// HR or Admin adds a written reply to a submission.
  public shared func addSuggestionReply(
    token : Text,
    input : SugTypes.AddSuggestionReplyInput,
  ) : async CommonTypes.MutationResult {
    switch (requireSugHROrAdmin(token)) {
      case null { #err("Unauthorized: HR or Admin role required") };
      case (?s) {
        switch (SugLib.addSuggestionReply(suggestions, s.name, input)) {
          case (?_) { #ok };
          case null { #err("Suggestion not found") };
        }
      };
    }
  };

  /// Return the calling user's own submission history (all statuses).
  public query func getMySubmissions(
    token : Text,
  ) : async [SugTypes.SuggestionSubmission] {
    switch (requireSugSession(token)) {
      case null { [] };
      case (?s) { SugLib.getMySubmissions(suggestions, s.userId) };
    }
  };

  /// HR/Admin: return all submissions, optionally filtered.
  public query func getAllSubmissions(
    token  : Text,
    filter : ?SugTypes.SuggestionFilter,
  ) : async [SugTypes.SuggestionSubmission] {
    switch (requireSugHROrAdmin(token)) {
      case null { [] };
      case (?_) { SugLib.getAllSubmissions(suggestions, filter) };
    }
  };

  /// HR/Admin: return the count of unread (new) submissions.
  public query func getUnreadSuggestionCount(
    token : Text,
  ) : async Nat {
    switch (requireSugHROrAdmin(token)) {
      case null { 0 };
      case (?_) { SugLib.getUnreadSuggestionCount(suggestions) };
    }
  };

  /// HR/Admin: mark a list of submission IDs as read.
  public shared func markSuggestionsAsRead(
    token : Text,
    ids   : [Nat],
  ) : async CommonTypes.MutationResult {
    switch (requireSugHROrAdmin(token)) {
      case null { #err("Unauthorized: HR or Admin role required") };
      case (?_) {
        SugLib.markSuggestionsAsRead(suggestions, ids);
        #ok
      };
    }
  };

  /// Any user: return count of their own submissions where HR has replied
  /// or changed status since the user last viewed them (isReadByEmployee=false).
  public query func getUnreadReplyCount(
    token : Text,
  ) : async Nat {
    switch (requireSugSession(token)) {
      case null { 0 };
      case (?s) { SugLib.getUnreadReplyCount(suggestions, s.userId) };
    }
  };

  // ── On-Leave Flash Indicator API ──────────────────────────────────────────

  /// Return the list of employees on approved leave today,
  /// scoped by the calling user's role and hierarchy.
  public query func getOnLeaveEmployeesForUser(
    token : Text,
  ) : async [SugTypes.OnLeaveEmployee] {
    switch (requireSugSession(token)) {
      case null { [] };
      case (?s) {
        SugLib.getOnLeaveEmployeesForUser(leaves, users, s.userId)
      };
    }
  };

};
