import AMTypes  "../types/admin-messages";
import AMMsgs   "../lib/admin-messages";
import AuthTypes "../types/auth-users";
import List     "mo:core/List";
import Map      "mo:core/Map";
import Time     "mo:core/Time";

/// Public API surface for Admin Message popup feature.
/// State is injected — no owned state.
mixin (
  sessions     : Map.Map<Text, AuthTypes.Session>,
  adminMessages : List.List<AMTypes.AdminMessage>,
  nextMsgId    : { var value : Nat },
) {

  // ── Session helpers ────────────────────────────────────────────────────────

  func requireSessionAM(token : Text) : ?AuthTypes.Session {
    switch (sessions.get(token)) {
      case (?s) { if (s.expiresAt > Time.now()) ?s else null };
      case null { null };
    };
  };

  func requireHROrAdminAM(token : Text) : ?AuthTypes.Session {
    switch (requireSessionAM(token)) {
      case null { null };
      case (?s) {
        switch (s.role) {
          case (#Admin or #HRManager) ?s;
          case _                      { null };
        }
      };
    }
  };

  // ── Admin Message Management (Admin/HR only) ───────────────────────────────

  public shared func createAdminMessage(
    token : Text,
    input : AMTypes.CreateAdminMessageInput,
  ) : async { #ok : AMTypes.AdminMessageInfo; #err : Text } {
    switch (requireHROrAdminAM(token)) {
      case null { #err("Unauthorized: HR or Admin role required") };
      case (?s) {
        let msg = AMMsgs.createMessage(adminMessages, nextMsgId.value, s.userId.toText(), input);
        nextMsgId.value += 1;
        #ok(AMMsgs.toInfo(msg))
      };
    }
  };

  public shared func updateAdminMessage(
    token : Text,
    input : AMTypes.UpdateAdminMessageInput,
  ) : async { #ok : AMTypes.AdminMessageInfo; #err : Text } {
    switch (requireHROrAdminAM(token)) {
      case null { #err("Unauthorized: HR or Admin role required") };
      case (?_) {
        switch (AMMsgs.updateMessage(adminMessages, input)) {
          case (?info) { #ok(info) };
          case null    { #err("Message not found") };
        }
      };
    }
  };

  public shared func deactivateAdminMessage(
    token     : Text,
    messageId : Text,
  ) : async AMTypes.MutationResult {
    switch (requireHROrAdminAM(token)) {
      case null { #err("Unauthorized: HR or Admin role required") };
      case (?_) {
        if (AMMsgs.deactivateMessage(adminMessages, messageId)) #ok
        else #err("Message not found")
      };
    }
  };

  public shared func deleteAdminMessage(
    token     : Text,
    messageId : Text,
  ) : async AMTypes.MutationResult {
    switch (requireHROrAdminAM(token)) {
      case null { #err("Unauthorized: HR or Admin role required") };
      case (?_) {
        if (AMMsgs.deleteMessage(adminMessages, messageId)) #ok
        else #err("Message not found")
      };
    }
  };

  public query func listAdminMessages(
    token : Text,
  ) : async { #ok : [AMTypes.AdminMessageInfo]; #err : Text } {
    switch (requireHROrAdminAM(token)) {
      case null { #err("Unauthorized: HR or Admin role required") };
      case (?_) { #ok(AMMsgs.getAllMessages(adminMessages)) };
    }
  };

  // ── User-facing API ────────────────────────────────────────────────────────

  public query func getActiveAdminMessage(
    token : Text,
    today : Text,
  ) : async ?AMTypes.AdminMessageInfo {
    switch (requireSessionAM(token)) {
      case null { null };
      case (?s) {
        let userId = s.userId.toText();
        switch (AMMsgs.getActiveMessage(adminMessages, today)) {
          case null { null };
          case (?info) {
            if (AMMsgs.hasUserSeenToday(adminMessages, info.id, userId, today)) null
            else ?info
          };
        }
      };
    }
  };

  public shared func recordMessageDismissal(
    token     : Text,
    messageId : Text,
    today     : Text,
  ) : async AMTypes.MutationResult {
    switch (requireSessionAM(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        let userId = s.userId.toText();
        if (AMMsgs.recordDismissal(adminMessages, messageId, userId, today)) #ok
        else #err("Message not found")
      };
    }
  };

  public query func hasUserSeenMessageToday(
    token     : Text,
    messageId : Text,
    today     : Text,
  ) : async Bool {
    switch (requireSessionAM(token)) {
      case null { false };
      case (?s) {
        let userId = s.userId.toText();
        AMMsgs.hasUserSeenToday(adminMessages, messageId, userId, today)
      };
    }
  };
};
