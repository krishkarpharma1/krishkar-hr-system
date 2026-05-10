import AuthTypes "../types/auth-users";
import CommonTypes "../types/common";
import Map "mo:core/Map";
import List "mo:core/List";

module {

  public type UserId    = AuthTypes.UserId;
  public type UserRecord = AuthTypes.UserRecord;

  /// Walk the reportsTo chain upward from the given user, collecting email
  /// addresses of every manager in the chain.  Stops when the chain ends or
  /// an Admin is reached (Admin is included; nothing above Admin is needed).
  /// Empty or whitespace-only emails are silently skipped.
  /// Returns a deduplicated array of email strings in ascending hierarchy order
  /// (direct manager first, Admin last).
  public func getAuthorityChainEmails(
    user  : UserRecord,
    users : Map.Map<UserId, UserRecord>,
  ) : [Text] {
    // Admin has no higher authorities
    if (user.role == #Admin) { return [] };

    let result : List.List<Text> = List.empty();
    let seen   : Map.Map<UserId, Bool> = Map.empty();

    var currentId : ?UserId = user.reportsTo;
    var steps : Nat = 0;
    let maxSteps : Nat = 10; // safety cap to prevent infinite loops on bad data

    label walkUp loop {
      if (steps >= maxSteps) { break walkUp };
      switch (currentId) {
        case null { break walkUp };
        case (?mid) {
          // Skip if already visited (cycle guard)
          switch (seen.get(mid)) {
            case (?_) { break walkUp };
            case null {};
          };
          seen.add(mid, true);

          switch (users.get(mid)) {
            case null { break walkUp };
            case (?mgr) {
              // Collect email if non-empty
              let email = mgr.email;
              if (email.size() > 0) {
                result.add(email);
              };
              // Stop after including Admin — nothing higher exists
              if (mgr.role == #Admin) { break walkUp };
              currentId := mgr.reportsTo;
              steps += 1;
            };
          };
        };
      };
    };

    result.toArray()
  };

  /// Returns the email of the first active Admin user found in the users map.
  /// Used for BCC logic in email flows.
  /// Returns null if no Admin has a non-empty email.
  public func getAdminEmail(
    users : Map.Map<UserId, UserRecord>,
  ) : ?Text {
    for ((_, u) in users.entries()) {
      if (u.role == #Admin and u.email.size() > 0) {
        return ?u.email;
      };
    };
    null
  };

};
