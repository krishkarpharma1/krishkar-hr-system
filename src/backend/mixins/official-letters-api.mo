import OLTypes  "../types/official-letters";
import OLLib    "../lib/official-letters";
import AuthTypes "../types/auth-users";
import CommonTypes "../types/common";
import List     "mo:core/List";
import Map      "mo:core/Map";
import Time     "mo:core/Time";

/// Public API surface for Official Company Letterhead feature.
/// All endpoints are gated to Admin and HR roles only.
mixin (
  sessions          : Map.Map<Text, AuthTypes.Session>,
  letters           : List.List<OLTypes.OfficialLetter>,
  letterRefNumbers  : Map.Map<Nat, Text>,
  letterEmailLogs   : Map.Map<Nat, [OLTypes.EmailInitiationLog]>,
  nextLetterId      : { var value : Nat },
  nextLetterRefSeq  : { var value : Nat },   // persistent sequence counter for ref numbers
) {

  // ── Session helpers ────────────────────────────────────────────────────────

  func requireHROrAdminOL(token : Text) : ?AuthTypes.Session {
    switch (sessions.get(token)) {
      case null { null };
      case (?s) {
        if (s.expiresAt <= Time.now()) { return null };
        switch (s.role) {
          case (#Admin or #HRManager) ?s;
          case _                      { null };
        }
      };
    }
  };

  // ── Reference-number helper ────────────────────────────────────────────────

  /// Derive the current calendar year from Time.now() (civil-calendar algorithm).
  /// Prefixed to avoid collision with the identically-named helper in HRCoreMixin.
  func olCurrentYear() : Nat {
    let nowSecs  : Int = Time.now() / 1_000_000_000;
    let days     : Int = nowSecs / 86400;
    let z   : Int = days + 719468;
    let era : Int = (if (z >= 0) z else z - 146096) / 146097;
    let doe : Int = z - era * 146097;
    let yoe : Int = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y   : Int = yoe + era * 400;
    let doy : Int = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp  : Int = (5 * doy + 2) / 153;
    let m   : Int = if (mp < 10) mp + 3 else mp - 9;
    let rawYear : Int = if (m <= 2) y + 1 else y;
    if (rawYear > 0) rawYear.toNat() else 2026
  };

  // ── Official Letters API (Admin and HR only) ───────────────────────────────

  public shared func createOfficialLetter(
    token : Text,
    input : OLTypes.CreateLetterInput,
  ) : async CommonTypes.MutationResult {
    switch (requireHROrAdminOL(token)) {
      case null { #err("Unauthorized: HR or Admin role required") };
      case (?s) {
        // Auto-assign a ref number if creating directly as Final
        let refNumber : ?Text = switch (input.status) {
          case (#final) {
            let seq = nextLetterRefSeq.value;
            nextLetterRefSeq.value += 1;
            ?OLLib.buildRefNumber(olCurrentYear(), seq)
          };
          case (#draft) null;
        };
        OLLib.createLetter(letters, letterRefNumbers, nextLetterId, input, s.userId, Time.now(), refNumber)
      };
    }
  };

  public shared func updateOfficialLetter(
    token : Text,
    id    : Nat,
    input : OLTypes.UpdateLetterInput,
  ) : async CommonTypes.MutationResult {
    switch (requireHROrAdminOL(token)) {
      case null { #err("Unauthorized: HR or Admin role required") };
      case (?s) { OLLib.updateLetter(letters, id, input, s.userId, Time.now()) };
    }
  };

  public shared func deleteOfficialLetter(
    token : Text,
    id    : Nat,
  ) : async CommonTypes.MutationResult {
    switch (requireHROrAdminOL(token)) {
      case null { #err("Unauthorized: HR or Admin role required") };
      case (?s) { OLLib.deleteLetter(letters, letterRefNumbers, letterEmailLogs, id, s.userId) };
    }
  };

  public query func getMyOfficialLetters(
    token : Text,
  ) : async [OLTypes.OfficialLetterView] {
    switch (requireHROrAdminOL(token)) {
      case null { [] };
      case (?s) { OLLib.getMyLetters(letters, letterRefNumbers, letterEmailLogs, s.userId) };
    }
  };

  public query func listAllOfficialLetters(
    token : Text,
  ) : async [OLTypes.OfficialLetterView] {
    switch (requireHROrAdminOL(token)) {
      case null { [] };
      case (?_) { OLLib.getAllLetters(letters, letterRefNumbers, letterEmailLogs) };
    }
  };

  public query func getOfficialLetter(
    token : Text,
    id    : Nat,
  ) : async ?OLTypes.OfficialLetterView {
    switch (requireHROrAdminOL(token)) {
      case null { null };
      case (?_) {
        switch (letters.find(func(l : OLTypes.OfficialLetter) : Bool { l.id == id })) {
          case null { null };
          case (?l) {
            ?{
              id              = l.id;
              letterType      = l.letterType;
              employeeId      = l.employeeId;
              employeeName    = l.employeeName;
              issuedBy        = l.issuedBy;
              issuedAt        = l.issuedAt;
              createdBy       = l.createdBy;
              recipientName   = l.recipientName;
              subject         = l.subject;
              body            = l.body;
              date            = l.date;
              status          = l.status;
              details         = l.details;
              createdAt       = l.createdAt;
              updatedAt       = l.updatedAt;
              letterRefNumber = letterRefNumbers.get(l.id);
              emailLogs       = switch (letterEmailLogs.get(l.id)) { case (?v) v; case null [] };
            }
          };
        }
      };
    }
  };

  public shared func finalizeOfficialLetter(
    token : Text,
    id    : Nat,
  ) : async CommonTypes.MutationResult {
    switch (requireHROrAdminOL(token)) {
      case null { #err("Unauthorized: HR or Admin role required") };
      case (?s) {
        let seq = nextLetterRefSeq.value;
        nextLetterRefSeq.value += 1;
        let refNumber = OLLib.buildRefNumber(olCurrentYear(), seq);
        OLLib.finalizeLetter(letters, letterRefNumbers, id, s.userId, Time.now(), refNumber)
      };
    }
  };

  /// Append an email-initiation log entry to the specified official letter.
  /// Authenticated HR or Admin only. Returns false if the letter is not found
  /// (encoded as #err in MutationResult).
  public shared func addOfficialLetterEmailLog(
    token    : Text,
    letterId : Nat,
    logEntry : OLTypes.EmailInitiationLog,
  ) : async CommonTypes.MutationResult {
    switch (requireHROrAdminOL(token)) {
      case null { #err("Unauthorized: HR or Admin role required") };
      case (?_) { OLLib.addEmailLog(letters, letterEmailLogs, letterId, logEntry) };
    }
  };

  /// Generate and return the next sequential letter reference number without
  /// permanently consuming the sequence — useful for previewing the ref before
  /// committing.  The sequence is NOT advanced by this query.
  public query func generateLetterRefNumber(
    token : Text,
  ) : async ?Text {
    switch (requireHROrAdminOL(token)) {
      case null { null };
      case (?_) {
        ?OLLib.buildRefNumber(olCurrentYear(), nextLetterRefSeq.value)
      };
    }
  };

  /// Returns all official letters issued to a specific employee.
  /// HR and Admin only.
  public query func getOfficialLettersByEmployee(
    token      : Text,
    employeeId : Nat,
  ) : async [OLTypes.OfficialLetterView] {
    switch (requireHROrAdminOL(token)) {
      case null { [] };
      case (?_) {
        OLLib.getLettersByEmployee(letters, letterRefNumbers, letterEmailLogs, employeeId)
      };
    }
  };

  /// Returns all official letters of a given letter type.
  /// HR and Admin only.
  public query func getOfficialLettersByType(
    token      : Text,
    letterType : OLTypes.LetterType,
  ) : async [OLTypes.OfficialLetterView] {
    switch (requireHROrAdminOL(token)) {
      case null { [] };
      case (?_) {
        OLLib.getLettersByType(letters, letterRefNumbers, letterEmailLogs, letterType)
      };
    }
  };
};
