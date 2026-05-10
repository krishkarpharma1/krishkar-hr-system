import CommonTypes "common";

module {
  public type UserId    = CommonTypes.UserId;
  public type Timestamp = CommonTypes.Timestamp;

  public type SecondarySaleId = Nat;

  /// One product line item within a secondary sale entry
  public type SaleProductEntry = {
    productId    : Nat;
    productName  : Text;
    quantitySold : Nat;
    mrp          : Float;
    pts          : Float;   // price to stockist
    ptr          : Float;   // price to retailer
    netSaleValue : Float;   // calculated: quantitySold * pts (or as configured)
  };

  /// A complete secondary sale record submitted by MR or ASM for a stockist
  public type SecondarySaleRecord = {
    id                : SecondarySaleId;
    submittedBy       : UserId;           // MR or ASM who submitted
    stockistId        : Nat;
    saleDate          : Timestamp;        // date of the sale
    areaId            : Nat;              // auto-derived from submitter's assignment
    hqId              : Nat;              // auto-derived from stockist's HQ
    products          : [SaleProductEntry];
    totalNetSaleValue : Float;            // sum of all product netSaleValues
    createdAt         : Timestamp;
  };

  /// Input to create a new secondary sale entry
  public type CreateSecondarySaleRequest = {
    stockistId : Nat;
    saleDate   : Timestamp;
    products   : [SaleProductEntry];
  };

  /// Filter for listing/exporting secondary sale records
  public type SecondarySaleFilter = {
    submittedBy : ?UserId;
    stockistId  : ?Nat;
    areaId      : ?Nat;
    fromDate    : ?Timestamp;
    toDate      : ?Timestamp;
  };
};
