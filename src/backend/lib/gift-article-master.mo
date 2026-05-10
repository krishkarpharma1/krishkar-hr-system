import List "mo:core/List";
import Map  "mo:core/Map";
import Types "../types/gift-article-master";
import FieldTypes "../types/field-ops";

/// Domain logic for Gift Article Master.
/// Receives state by reference — no owned state.
module {

  func toInfo(g : Types.GiftArticle) : Types.GiftArticleInfo {
    {
      id          = g.id;
      name        = g.name;
      category    = g.category;
      description = g.description;
      isActive    = g.isActive;
      createdAt   = g.createdAt;
      createdBy   = g.createdBy;
    };
  };

  /// Create a new gift article and add it to the list. Returns the new record.
  public func createGiftArticle(
    giftArticles : List.List<Types.GiftArticle>,
    nextId       : { var val : Nat },
    input        : Types.CreateGiftArticleInput,
    createdBy    : Types.UserId,
    now          : Types.Timestamp,
  ) : Types.GiftArticleInfo {
    let id = nextId.val;
    nextId.val += 1;
    let article : Types.GiftArticle = {
      id;
      var name        = input.name;
      var category    = input.category;
      var description = input.description;
      var isActive    = true;
      createdAt       = now;
      createdBy;
    };
    giftArticles.add(article);
    toInfo(article);
  };

  /// Update an existing gift article by ID. Returns updated info or error.
  public func updateGiftArticle(
    giftArticles : List.List<Types.GiftArticle>,
    id           : Types.GiftArticleId,
    input        : Types.UpdateGiftArticleInput,
  ) : { #ok : Types.GiftArticleInfo; #err : Text } {
    switch (giftArticles.find(func(g : Types.GiftArticle) : Bool { g.id == id })) {
      case null { #err("Gift article not found") };
      case (?g) {
        switch (input.name)        { case (?v) { g.name        := v }; case null {} };
        switch (input.category)    { case (?v) { g.category    := v }; case null {} };
        switch (input.description) { case (?v) { g.description := v }; case null {} };
        switch (input.isActive)    { case (?v) { g.isActive    := v }; case null {} };
        #ok(toInfo(g));
      };
    };
  };

  /// Soft-delete: mark a gift article as inactive.
  /// (Permanent removal is not done to preserve history in visit records.)
  public func deleteGiftArticle(
    giftArticles : List.List<Types.GiftArticle>,
    id           : Types.GiftArticleId,
  ) : { #ok; #err : Text } {
    switch (giftArticles.find(func(g : Types.GiftArticle) : Bool { g.id == id })) {
      case null { #err("Gift article not found") };
      case (?g) { g.isActive := false; #ok };
    };
  };

  /// List all active gift articles (isActive = true). For MR use.
  public func listGiftArticles(
    giftArticles : List.List<Types.GiftArticle>,
  ) : [Types.GiftArticleInfo] {
    giftArticles
      .filter(func(g : Types.GiftArticle) : Bool { g.isActive })
      .map<Types.GiftArticle, Types.GiftArticleInfo>(func(g) { toInfo(g) })
      .toArray();
  };

  /// List all gift articles including inactive (Admin/HR only).
  public func listAllGiftArticles(
    giftArticles : List.List<Types.GiftArticle>,
  ) : [Types.GiftArticleInfo] {
    giftArticles
      .map<Types.GiftArticle, Types.GiftArticleInfo>(func(g) { toInfo(g) })
      .toArray();
  };

  /// Resolve a gift article name from its ID.
  /// Returns the article name if found, or "Unknown Gift" if not.
  public func resolveGiftArticleName(
    giftArticles  : List.List<Types.GiftArticle>,
    giftArticleId : Types.GiftArticleId,
  ) : Text {
    switch (giftArticles.find(func(g : Types.GiftArticle) : Bool { g.id == giftArticleId })) {
      case (?g) g.name;
      case null "Unknown Gift";
    };
  };

  // ── Bulk import ───────────────────────────────────────────────────────────

  /// Bulk-import gift articles from an array of CreateGiftArticleInput records.
  /// - Skips rows where name is blank.
  /// - Skips rows where an article with the same name (case-insensitive) already exists.
  /// - Creates all valid rows.
  /// Returns a BulkGiftArticleImportResult summarising the operation.
  public func bulkImportGiftArticles(
    giftArticles : List.List<Types.GiftArticle>,
    nextId       : { var val : Nat },
    rows         : [Types.CreateGiftArticleInput],
    createdBy    : Types.UserId,
    now          : Types.Timestamp,
  ) : Types.BulkGiftArticleImportResult {
    var created : Nat = 0;
    var skipped : Nat = 0;
    let errors  = List.empty<Types.BulkGiftArticleImportError>();

    for ((idx, input) in rows.enumerate()) {
      let rowNum = idx + 1;
      let trimmedName = input.name;
      // Validate: name must not be blank
      if (trimmedName.size() == 0) {
        skipped += 1;
        errors.add({ row = rowNum; name = trimmedName; reason = "Name is blank" });
      } else {
        // Check for duplicate (case-insensitive)
        let nameLower = trimmedName.toLower();
        let duplicate = giftArticles.find(
          func(g : Types.GiftArticle) : Bool { g.name.toLower() == nameLower }
        );
        switch (duplicate) {
          case (?_) {
            skipped += 1;
            errors.add({ row = rowNum; name = trimmedName; reason = "Duplicate name — article already exists" });
          };
          case null {
            let id = nextId.val;
            nextId.val += 1;
            let article : Types.GiftArticle = {
              id;
              var name        = trimmedName;
              var category    = input.category;
              var description = input.description;
              var isActive    = true;
              createdAt       = now;
              createdBy;
            };
            giftArticles.add(article);
            created += 1;
          };
        };
      };
    };

    {
      totalRows = rows.size();
      created;
      skipped;
      errors = errors.toArray();
    };
  };

  // ── Monthly usage counter ─────────────────────────────────────────────────

  /// Scan all CallReports for the given month+year and return
  /// (giftArticleId, totalQuantityGiven) pairs for every article used.
  /// month is 1–12, year is e.g. 2026.
  public func getGiftArticleMonthlyUsage(
    reports : List.List<FieldTypes.CallReport>,
    month   : Nat,
    year    : Nat,
  ) : [(Types.GiftArticleId, Nat)] {
    // Build "YYYY-MM" prefix for date comparison
    let mm  = if (month < 10) "0" # month.toText() else month.toText();
    let prefix = year.toText() # "-" # mm;

    // Accumulate totals per giftArticleId
    let totals = Map.empty<Types.GiftArticleId, Nat>();

    for (report in reports.values()) {
      // report.date is "YYYY-MM-DD"; check it starts with our prefix
      if (report.date.size() >= 7 and report.date.startsWith(#text prefix)) {
        for (visit in report.doctorsVisited.values()) {
          for (ga in visit.giftArticles.values()) {
            let prev = switch (totals.get(ga.giftArticleId)) {
              case (?n) n;
              case null 0;
            };
            totals.add(ga.giftArticleId, prev + ga.quantity);
          };
        };
      };
    };

    totals.toArray();
  };
};
