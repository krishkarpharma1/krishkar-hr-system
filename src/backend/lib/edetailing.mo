import List  "mo:core/List";
import Map   "mo:core/Map";
import Set   "mo:core/Set";
import Nat   "mo:core/Nat";
import Time  "mo:core/Time";
import Types "../types/edetailing";

/// Domain logic for E-Detailing / Product Content catalog.
/// Receives state by reference — no owned state.
module {

  func toInfo(p : Types.EDetailingProduct) : Types.EDetailingProductInfo {
    {
      productId        = p.productId;
      name             = p.name;
      category         = p.category;
      composition      = p.composition;
      mrp              = p.mrp;
      packSize         = p.packSize;
      description      = p.description;
      contentVersion   = p.contentVersion;
      publishedAt      = p.publishedAt;
      isCurrentVersion = p.isCurrentVersion;
    };
  };

  /// Create a new e-detailing product. Marks it as current version (v1).
  public func createEDetailingProduct(
    catalog     : List.List<Types.EDetailingProduct>,
    input       : Types.CreateEDetailingProductInput,
  ) : Types.EDetailingProductInfo {
    let now = Time.now();
    let p : Types.EDetailingProduct = {
      productId        = input.productId;
      var name         = input.name;
      var category     = input.category;
      var composition  = input.composition;
      var mrp          = input.mrp;
      var packSize     = input.packSize;
      var description  = input.description;
      var contentVersion   = 1;
      var publishedAt  = now;
      var isCurrentVersion = true;
    };
    catalog.add(p);
    toInfo(p);
  };

  /// Update a product — archives the old record and creates a new version entry.
  /// Bumps contentVersion, marks old entry as not current.
  public func updateEDetailingProduct(
    catalog     : List.List<Types.EDetailingProduct>,
    input       : Types.UpdateEDetailingProductInput,
  ) : Bool {
    // Find the current version entry for this productId
    switch (catalog.find(func(p : Types.EDetailingProduct) : Bool {
      p.productId == input.productId and p.isCurrentVersion
    })) {
      case null false;
      case (?p) {
        // Archive old version
        p.isCurrentVersion := false;
        let newVersion = p.contentVersion + 1;
        // New entry with updated fields
        let now = Time.now();
        let updated : Types.EDetailingProduct = {
          productId        = p.productId;
          var name         = switch (input.name)        { case (?v) v; case null p.name };
          var category     = switch (input.category)    { case (?v) v; case null p.category };
          var composition  = switch (input.composition) { case (?v) v; case null p.composition };
          var mrp          = switch (input.mrp)         { case (?v) v; case null p.mrp };
          var packSize     = switch (input.packSize)    { case (?v) v; case null p.packSize };
          var description  = switch (input.description) { case (?v) v; case null p.description };
          var contentVersion   = newVersion;
          var publishedAt  = now;
          var isCurrentVersion = true;
        };
        catalog.add(updated);
        true;
      };
    };
  };

  public func getEDetailingProduct(
    catalog   : List.List<Types.EDetailingProduct>,
    productId : Types.EDetailingProductId,
  ) : ?Types.EDetailingProductInfo {
    switch (catalog.find(func(p : Types.EDetailingProduct) : Bool {
      p.productId == productId and p.isCurrentVersion
    })) {
      case (?p) ?toInfo(p);
      case null null;
    };
  };

  /// List only current-version entries.
  public func listEDetailingProducts(
    catalog : List.List<Types.EDetailingProduct>,
  ) : [Types.EDetailingProductInfo] {
    catalog.filter(func(p : Types.EDetailingProduct) : Bool { p.isCurrentVersion })
           .map<Types.EDetailingProduct, Types.EDetailingProductInfo>(func(p) { toInfo(p) })
           .toArray();
  };

  /// Record a download event by an MR.
  public func trackDownload(
    downloads    : List.List<Types.DownloadRecord>,
    nextId       : { var val : Nat },
    productId    : Types.EDetailingProductId,
    mrId         : Nat,
  ) : Nat {
    let id = nextId.val;
    nextId.val += 1;
    downloads.add({
      recordId     = id;
      productId;
      mrId;
      downloadedAt = Time.now();
    });
    id;
  };

  /// Compute per-product download metrics (for Admin).
  public func getDownloadMetrics(
    catalog   : List.List<Types.EDetailingProduct>,
    downloads : List.List<Types.DownloadRecord>,
  ) : [Types.DownloadMetrics] {
    // Build a map productId -> (count, uniqueMRs, lastDownload)
    let metricsMap = Map.empty<Types.EDetailingProductId, (Nat, Set.Set<Nat>, Int)>();
    for (dl in downloads.values()) {
      switch (metricsMap.get(dl.productId)) {
        case null {
          let s = Set.empty<Nat>();
          s.add(dl.mrId);
          metricsMap.add(dl.productId, (1, s, dl.downloadedAt));
        };
        case (?(cnt, mrSet, lastDl)) {
          mrSet.add(dl.mrId);
          let newLast = if (dl.downloadedAt > lastDl) dl.downloadedAt else lastDl;
          metricsMap.add(dl.productId, (cnt + 1, mrSet, newLast));
        };
      };
    };
    // Map to current products
    catalog.filter(func(p : Types.EDetailingProduct) : Bool { p.isCurrentVersion })
      .map<Types.EDetailingProduct, Types.DownloadMetrics>(func(p) {
        switch (metricsMap.get(p.productId)) {
          case null { { productId = p.productId; productName = p.name; totalDownloads = 0; uniqueMRs = 0; lastDownloadAt = 0 } };
          case (?(cnt, mrSet, lastDl)) {
            { productId = p.productId; productName = p.name; totalDownloads = cnt; uniqueMRs = mrSet.size(); lastDownloadAt = lastDl };
          };
        }
      })
      .toArray();
  };

  /// Top N products by download count.
  public func getTopProductsByDownloads(
    catalog   : List.List<Types.EDetailingProduct>,
    downloads : List.List<Types.DownloadRecord>,
    topN      : Nat,
  ) : [Types.DownloadMetrics] {
    let all = getDownloadMetrics(catalog, downloads);
    let sorted = all.sort(func(a : Types.DownloadMetrics, b : Types.DownloadMetrics) : { #less; #equal; #greater } {
      if (b.totalDownloads > a.totalDownloads) #less
      else if (b.totalDownloads < a.totalDownloads) #greater
      else #equal
    });
    sorted.values().take(topN).toArray();
  };

  /// Downloads grouped by MR for a specific product.
  public func getDownloadsByMR(
    downloads : List.List<Types.DownloadRecord>,
    productId : Types.EDetailingProductId,
  ) : [Types.MrDownloadSummary] {
    let mrMap = Map.empty<Nat, (Nat, Int)>();
    for (dl in downloads.values()) {
      if (dl.productId == productId) {
        switch (mrMap.get(dl.mrId)) {
          case null { mrMap.add(dl.mrId, (1, dl.downloadedAt)) };
          case (?(cnt, lastDl)) {
            let newLast = if (dl.downloadedAt > lastDl) dl.downloadedAt else lastDl;
            mrMap.add(dl.mrId, (cnt + 1, newLast));
          };
        };
      };
    };
    mrMap.entries()
      .map<(Nat, (Nat, Int)), Types.MrDownloadSummary>(func((mrId, (cnt, lastDl))) {
        { mrId; totalDownloads = cnt; lastDownloadAt = lastDl }
      })
      .toArray();
  };
};
