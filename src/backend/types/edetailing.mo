module {
  public type EDetailingProductId = Text;

  /// One e-detailing product entry in the catalog.
  /// Multiple versions can exist; only the current version is returned by
  /// listEDetailingProducts by default.
  public type EDetailingProduct = {
    productId        : EDetailingProductId;  // matches field-ops ProductId text key
    var name         : Text;
    var category     : Text;         // e.g. "Tablet", "Injection"
    var composition  : Text;
    var mrp          : Nat;          // MRP in paise
    var packSize     : Text;
    var description  : Text;
    var contentVersion   : Nat;      // incremented on each update
    var publishedAt  : Int;          // nanosecond timestamp
    var isCurrentVersion : Bool;     // false = archived; only one entry per productId is current
  };

  public type EDetailingProductInfo = {
    productId        : EDetailingProductId;
    name             : Text;
    category         : Text;
    composition      : Text;
    mrp              : Nat;
    packSize         : Text;
    description      : Text;
    contentVersion   : Nat;
    publishedAt      : Int;
    isCurrentVersion : Bool;
  };

  public type CreateEDetailingProductInput = {
    productId    : EDetailingProductId;
    name         : Text;
    category     : Text;
    composition  : Text;
    mrp          : Nat;
    packSize     : Text;
    description  : Text;
  };

  public type UpdateEDetailingProductInput = {
    productId    : EDetailingProductId;
    name         : ?Text;
    category     : ?Text;
    composition  : ?Text;
    mrp          : ?Nat;
    packSize     : ?Text;
    description  : ?Text;
  };

  /// One download tracking entry — recorded when an MR views/downloads a product.
  public type DownloadRecord = {
    recordId   : Nat;
    productId  : EDetailingProductId;
    mrId       : Nat;   // UserId of the MR
    downloadedAt : Int; // nanosecond timestamp
  };

  /// Per-product download metrics returned to Admin.
  public type DownloadMetrics = {
    productId      : EDetailingProductId;
    productName    : Text;
    totalDownloads : Nat;
    uniqueMRs      : Nat;
    lastDownloadAt : Int;  // 0 if never downloaded
  };

  /// Per-MR download summary for a given product.
  public type MrDownloadSummary = {
    mrId           : Nat;
    totalDownloads : Nat;
    lastDownloadAt : Int;
  };
};
