import CommonTypes "common";

module {
  public type PricelistProductId = Nat;
  public type Timestamp = CommonTypes.Timestamp;

  /// A product entry in the pricelist.
  /// `srNo` is a globally sequential number assigned at insertion and never reused.
  public type PricelistProduct = {
    id          : PricelistProductId;
    srNo        : Nat;
    name        : Text;
    composition : Text;
    mrp         : Float;
    pts         : Float;
    ptr         : Float;
    createdAt   : Timestamp;
    updatedAt   : Timestamp;
  };

  /// Read-only view returned to clients — identical to PricelistProduct (immutable record).
  public type PricelistProductInfo = {
    id          : PricelistProductId;
    srNo        : Nat;
    name        : Text;
    composition : Text;
    mrp         : Float;
    pts         : Float;
    ptr         : Float;
    createdAt   : Timestamp;
    updatedAt   : Timestamp;
  };

  /// Input for creating a new pricelist product.
  public type AddPricelistProductInput = {
    name        : Text;
    composition : Text;
    mrp         : Float;
    pts         : Float;
    ptr         : Float;
  };

  /// Input for updating an existing pricelist product.
  /// All fields are optional — only provided fields are updated.
  public type UpdatePricelistProductInput = {
    name        : ?Text;
    composition : ?Text;
    mrp         : ?Float;
    pts         : ?Float;
    ptr         : ?Float;
  };

  /// Result returned by bulkAddPricelistProducts.
  public type BulkAddResult = {
    added  : Nat;
    errors : [Text];
  };
};
