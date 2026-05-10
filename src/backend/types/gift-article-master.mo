import CommonTypes "common";

module {
  public type UserId    = CommonTypes.UserId;
  public type Timestamp = CommonTypes.Timestamp;

  // ── IDs ───────────────────────────────────────────────────────────────────
  public type GiftArticleId = Nat;

  // ── Gift Article Master ───────────────────────────────────────────────────

  /// Internal (mutable) record stored in the gift articles list.
  public type GiftArticle = {
    id              : GiftArticleId;
    var name        : Text;
    var category    : Text;
    var description : Text;
    var isActive    : Bool;
    createdAt       : Timestamp;
    createdBy       : UserId;
  };

  /// Immutable public view of a GiftArticle — safe for API boundaries.
  public type GiftArticleInfo = {
    id          : GiftArticleId;
    name        : Text;
    category    : Text;
    description : Text;
    isActive    : Bool;
    createdAt   : Timestamp;
    createdBy   : UserId;
  };

  // ── Input types ───────────────────────────────────────────────────────────

  public type CreateGiftArticleInput = {
    name        : Text;
    category    : Text;
    description : Text;
  };

  public type UpdateGiftArticleInput = {
    name        : ?Text;
    category    : ?Text;
    description : ?Text;
    isActive    : ?Bool;
  };

  // ── Extended field-ops types (gift articles by ID) ─────────────────────────

  /// A gift article distributed to a doctor during a visit.
  /// Stores giftArticleId + redundant name for display even if article is deleted.
  public type GiftArticleDistributedV2 = {
    giftArticleId   : GiftArticleId;
    giftArticleName : Text;  // stored redundantly for display
    quantity        : Nat;
  };

  // ── Bulk import ───────────────────────────────────────────────────────────

  /// One row-level error reported during bulk gift article import.
  public type BulkGiftArticleImportError = {
    row    : Nat;   // 1-based row number in the submitted array
    name   : Text;
    reason : Text;
  };

  /// Result returned by bulkImportGiftArticles.
  public type BulkGiftArticleImportResult = {
    totalRows : Nat;
    created   : Nat;
    skipped   : Nat;
    errors    : [BulkGiftArticleImportError];
  };

  // ── Result alias ──────────────────────────────────────────────────────────
  public type MutationResult = CommonTypes.MutationResult;
};
