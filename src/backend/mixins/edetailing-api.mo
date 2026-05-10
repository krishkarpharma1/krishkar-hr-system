import List    "mo:core/List";
import Map     "mo:core/Map";
import Text    "mo:core/Text";
import Nat     "mo:core/Nat";
import EDTypes "../types/edetailing";
import AuthTypes "../types/auth-users";
import EDLib   "../lib/edetailing";

/// Public API mixin for E-Detailing / Product Content catalog.
/// Admin: create/update. MR: trackDownload. All authenticated: read.
mixin (
  sessions       : Map.Map<Text, AuthTypes.Session>,
  users          : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
  edCatalog      : List.List<EDTypes.EDetailingProduct>,
  edDownloads    : List.List<EDTypes.DownloadRecord>,
  nextDownloadId : { var val : Nat },
) {

  func ed_isAdminOrHR(token : Text) : Bool {
    switch (sessions.get(token)) {
      case null false;
      case (?s) switch (users.get(s.userId)) {
        case (?u) u.role == #Admin or u.role == #HRManager;
        case null false;
      };
    };
  };

  func ed_getSessionUserId(token : Text) : ?Nat {
    switch (sessions.get(token)) {
      case (?s) ?s.userId;
      case null null;
    };
  };

  func ed_isAuthenticated(token : Text) : Bool {
    sessions.get(token) != null;
  };

  /// Admin: create a new e-detailing product entry.
  public shared ({ caller }) func createEDetailingProduct(
    token : Text,
    input : EDTypes.CreateEDetailingProductInput,
  ) : async { #ok : EDTypes.EDetailingProductInfo; #err : Text } {
    if (not ed_isAdminOrHR(token)) return #err("Access denied");
    #ok(EDLib.createEDetailingProduct(edCatalog, input));
  };

  /// Admin: update an e-detailing product (creates new version, archives old).
  public shared ({ caller }) func updateEDetailingProduct(
    token : Text,
    input : EDTypes.UpdateEDetailingProductInput,
  ) : async { #ok; #err : Text } {
    if (not ed_isAdminOrHR(token)) return #err("Access denied");
    if (EDLib.updateEDetailingProduct(edCatalog, input)) #ok
    else #err("Product not found or no current version: " # input.productId);
  };

  /// Get a single product (current version).
  public query func getEDetailingProduct(
    token     : Text,
    productId : EDTypes.EDetailingProductId,
  ) : async ?EDTypes.EDetailingProductInfo {
    EDLib.getEDetailingProduct(edCatalog, productId);
  };

  /// List all current-version e-detailing products.
  public query func listEDetailingProducts(
    token : Text,
  ) : async [EDTypes.EDetailingProductInfo] {
    EDLib.listEDetailingProducts(edCatalog);
  };

  /// MR: record that they viewed/downloaded a product.
  public shared ({ caller }) func trackEDetailingDownload(
    token     : Text,
    productId : EDTypes.EDetailingProductId,
  ) : async { #ok : Nat; #err : Text } {
    switch (ed_getSessionUserId(token)) {
      case null #err("Not authenticated");
      case (?mrId) {
        let id = EDLib.trackDownload(edDownloads, nextDownloadId, productId, mrId);
        #ok(id);
      };
    };
  };

  /// Admin: get download metrics for all products.
  public query func getEDetailingDownloadMetrics(
    token : Text,
  ) : async [EDTypes.DownloadMetrics] {
    EDLib.getDownloadMetrics(edCatalog, edDownloads);
  };

  /// Admin: get top N products by download count.
  public query func getTopEDetailingProducts(
    token : Text,
    topN  : Nat,
  ) : async [EDTypes.DownloadMetrics] {
    EDLib.getTopProductsByDownloads(edCatalog, edDownloads, topN);
  };

  /// Admin/MR: get downloads per MR for a specific product.
  public query func getEDetailingDownloadsByMR(
    token     : Text,
    productId : EDTypes.EDetailingProductId,
  ) : async [EDTypes.MrDownloadSummary] {
    EDLib.getDownloadsByMR(edDownloads, productId);
  };
};
