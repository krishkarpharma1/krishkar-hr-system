import Map     "mo:core/Map";
import DistTypes "../types/distributor";
import AuthTypes "../types/auth-users";
import DistLib   "../lib/distributor";

/// Public API mixin for Distributor Master.
/// Only Admin can create/update/deactivate. All authenticated roles can read.
mixin (
  sessions     : Map.Map<Text, AuthTypes.Session>,
  users        : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
  distributors : Map.Map<DistTypes.DistributorId, DistTypes.Distributor>,
) {

  func dist_isAdminOrHR(token : Text) : Bool {
    switch (sessions.get(token)) {
      case null false;
      case (?s) switch (users.get(s.userId)) {
        case (?u) u.role == #Admin or u.role == #HRManager;
        case null false;
      };
    };
  };

  /// Admin: create a new distributor.
  public shared ({ caller }) func createDistributor(
    token : Text,
    input : DistTypes.CreateDistributorInput,
  ) : async { #ok : DistTypes.DistributorInfo; #err : Text } {
    if (not dist_isAdminOrHR(token)) return #err("Access denied");
    // Duplicate ID check
    switch (distributors.get(input.id)) {
      case (?_) return #err("Distributor ID already exists: " # input.id);
      case null {};
    };
    #ok(DistLib.createDistributor(distributors, input));
  };

  /// Admin: update a distributor.
  public shared ({ caller }) func updateDistributor(
    token : Text,
    input : DistTypes.UpdateDistributorInput,
  ) : async { #ok; #err : Text } {
    if (not dist_isAdminOrHR(token)) return #err("Access denied");
    if (DistLib.updateDistributor(distributors, input)) #ok
    else #err("Distributor not found: " # input.id);
  };

  /// Admin: deactivate a distributor.
  public shared ({ caller }) func deactivateDistributor(
    token : Text,
    id    : DistTypes.DistributorId,
  ) : async { #ok; #err : Text } {
    if (not dist_isAdminOrHR(token)) return #err("Access denied");
    if (DistLib.deactivateDistributor(distributors, id)) #ok
    else #err("Distributor not found: " # id);
  };

  /// Get a single distributor by ID.
  public query func getDistributor(
    token : Text,
    id    : DistTypes.DistributorId,
  ) : async ?DistTypes.DistributorInfo {
    DistLib.getDistributor(distributors, id);
  };

  /// List all active distributors.
  public query func listDistributors(
    token : Text,
  ) : async [DistTypes.DistributorInfo] {
    DistLib.listDistributors(distributors);
  };

  /// List distributors by area code.
  public query func listDistributorsByArea(
    token    : Text,
    areaCode : Text,
  ) : async [DistTypes.DistributorInfo] {
    DistLib.listDistributorsByArea(distributors, areaCode);
  };

  /// Search distributors by name, ID, or territory.
  public query func searchDistributors(
    token : Text,
    searchTerm : Text,
  ) : async [DistTypes.DistributorInfo] {
    DistLib.searchDistributors(distributors, searchTerm);
  };
};
