import PLTypes  "../types/pricelist";
import PLLib    "../lib/pricelist";
import AuthTypes "../types/auth-users";
import CommonTypes "../types/common";
import Map  "mo:core/Map";
import List "mo:core/List";
import Time "mo:core/Time";

/// Public API surface for the Products Pricelist domain.
mixin (
  sessions         : Map.Map<Text, AuthTypes.Session>,
  pricelistProducts : List.List<PLLib.PricelistProduct>,
  nextPricelistId  : PLLib.NextId,
  nextPricelistSrNo : PLLib.NextSrNo,
) {

  // ── Session helpers ─────────────────────────────────────────────────────────

  func requireSessionPL(token : Text) : ?AuthTypes.Session {
    switch (sessions.get(token)) {
      case (?s) { if (s.expiresAt > Time.now()) ?s else null };
      case null { null };
    };
  };

  func requireAdminOrHrPL(token : Text) : ?AuthTypes.Session {
    switch (requireSessionPL(token)) {
      case null { null };
      case (?s) {
        switch (s.role) {
          case (#Admin or #HRManager) ?s;
          case _                      { null };
        }
      };
    }
  };

  // ── Pricelist API ───────────────────────────────────────────────────────────

  public query func listPricelistProducts(
    token : Text,
  ) : async [PLTypes.PricelistProductInfo] {
    switch (requireSessionPL(token)) {
      case null { [] };
      case (?_) { PLLib.listPricelistProducts(pricelistProducts) };
    }
  };

  public shared func addPricelistProduct(
    token : Text,
    input : PLTypes.AddPricelistProductInput,
  ) : async CommonTypes.MutationResult {
    switch (requireAdminOrHrPL(token)) {
      case null { #err("Unauthorized: Admin or HR Manager role required") };
      case (?_) { PLLib.addPricelistProduct(pricelistProducts, nextPricelistId, nextPricelistSrNo, input, Time.now()) };
    }
  };

  public shared func updatePricelistProduct(
    token : Text,
    id    : PLTypes.PricelistProductId,
    input : PLTypes.UpdatePricelistProductInput,
  ) : async CommonTypes.MutationResult {
    switch (requireAdminOrHrPL(token)) {
      case null { #err("Unauthorized: Admin or HR Manager role required") };
      case (?_) { PLLib.updatePricelistProduct(pricelistProducts, id, input, Time.now()) };
    }
  };

  public shared func deletePricelistProduct(
    token : Text,
    id    : PLTypes.PricelistProductId,
  ) : async CommonTypes.MutationResult {
    switch (requireAdminOrHrPL(token)) {
      case null { #err("Unauthorized: Admin or HR Manager role required") };
      case (?_) { PLLib.deletePricelistProduct(pricelistProducts, id) };
    }
  };

  public shared func bulkAddPricelistProducts(
    token  : Text,
    inputs : [PLTypes.AddPricelistProductInput],
  ) : async PLTypes.BulkAddResult {
    switch (requireAdminOrHrPL(token)) {
      case null {
        { added = 0; errors = ["Unauthorized: Admin or HR Manager role required"] }
      };
      case (?_) { PLLib.bulkAddPricelistProducts(pricelistProducts, nextPricelistId, nextPricelistSrNo, inputs, Time.now()) };
    }
  };
};
