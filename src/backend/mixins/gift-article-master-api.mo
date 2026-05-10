import Time "mo:core/Time";
import List "mo:core/List";
import Map "mo:core/Map";
import Types "../types/gift-article-master";
import FieldTypes "../types/field-ops";
import GiftArticleLib "../lib/gift-article-master";
import AuthTypes "../types/auth-users";

/// Public API surface for Gift Article Master.
/// State is injected via mixin parameters — no owned state.
mixin (
  giftArticles       : List.List<Types.GiftArticle>,
  nextGiftArticleId  : { var val : Nat },
  sessions           : Map.Map<Text, AuthTypes.Session>,
  reports            : List.List<FieldTypes.CallReport>,
) {

  // ── Session helpers ────────────────────────────────────────────────────────

  func requireSessionGA(token : Text) : ?AuthTypes.Session {
    switch (sessions.get(token)) {
      case (?s) { if (s.expiresAt > Time.now()) ?s else null };
      case null { null };
    };
  };

  func requireHROrAdminGA(token : Text) : ?AuthTypes.Session {
    switch (requireSessionGA(token)) {
      case null { null };
      case (?s) {
        switch (s.role) {
          case (#Admin or #HRManager) ?s;
          case _                      { null };
        }
      };
    }
  };

  // ── Gift Article CRUD ──────────────────────────────────────────────────────

  /// Create a new gift article. Admin/HR only.
  public shared func createGiftArticle(
    token : Text,
    input : Types.CreateGiftArticleInput,
  ) : async { #ok : Types.GiftArticleInfo; #err : Text } {
    switch (requireHROrAdminGA(token)) {
      case null { #err("Unauthorized: HR or Admin role required") };
      case (?s) {
        let info = GiftArticleLib.createGiftArticle(giftArticles, nextGiftArticleId, input, s.userId, Time.now());
        #ok(info)
      };
    }
  };

  /// Update an existing gift article by ID. Admin/HR only.
  public shared func updateGiftArticle(
    token : Text,
    id    : Types.GiftArticleId,
    input : Types.UpdateGiftArticleInput,
  ) : async { #ok : Types.GiftArticleInfo; #err : Text } {
    switch (requireHROrAdminGA(token)) {
      case null { #err("Unauthorized: HR or Admin role required") };
      case (?_) { GiftArticleLib.updateGiftArticle(giftArticles, id, input) };
    }
  };

  /// Permanently delete a gift article by ID. Admin/HR only.
  public shared func deleteGiftArticle(
    token : Text,
    id    : Types.GiftArticleId,
  ) : async { #ok; #err : Text } {
    switch (requireHROrAdminGA(token)) {
      case null { #err("Unauthorized: HR or Admin role required") };
      case (?_) { GiftArticleLib.deleteGiftArticle(giftArticles, id) };
    }
  };

  /// List all active gift articles. All authenticated roles.
  public query func listGiftArticles(token : Text) : async [Types.GiftArticleInfo] {
    switch (requireSessionGA(token)) {
      case null { [] };
      case (?_) { GiftArticleLib.listGiftArticles(giftArticles) };
    }
  };

  /// List all gift articles including inactive ones. Admin/HR only.
  public query func listAllGiftArticles(token : Text) : async [Types.GiftArticleInfo] {
    switch (requireHROrAdminGA(token)) {
      case null { [] };
      case (?_) { GiftArticleLib.listAllGiftArticles(giftArticles) };
    }
  };

  // ── Bulk import ────────────────────────────────────────────────────────────

  /// Bulk-import gift articles from an array of CreateGiftArticleInput rows.
  /// Admin/HR only. Skips blank names and duplicates; returns a detailed result.
  public shared func bulkImportGiftArticles(
    token : Text,
    rows  : [Types.CreateGiftArticleInput],
  ) : async Types.BulkGiftArticleImportResult {
    switch (requireHROrAdminGA(token)) {
      case null {
        { totalRows = rows.size(); created = 0; skipped = rows.size(); errors = [{ row = 0; name = ""; reason = "Unauthorized: HR or Admin role required" }] }
      };
      case (?s) {
        GiftArticleLib.bulkImportGiftArticles(giftArticles, nextGiftArticleId, rows, s.userId, Time.now())
      };
    }
  };

  // ── Monthly usage counter ──────────────────────────────────────────────────

  /// Return (giftArticleId, totalQuantityGiven) pairs for a given month/year.
  /// Scans all CallReports. Admin/HR only.
  public query func getGiftArticleMonthlyUsage(
    token : Text,
    month : Nat,
    year  : Nat,
  ) : async [(Types.GiftArticleId, Nat)] {
    switch (requireHROrAdminGA(token)) {
      case null { [] };
      case (?_) { GiftArticleLib.getGiftArticleMonthlyUsage(reports, month, year) };
    }
  };
};
