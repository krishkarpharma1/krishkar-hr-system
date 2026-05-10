import CommonTypes "common";

module {
  public type UserId    = CommonTypes.UserId;
  public type Timestamp = CommonTypes.Timestamp;

  public type CrmDoctorSaleId = Nat;

  /// One product line item within a CRM doctor-wise sale entry
  public type DoctorSaleProductEntry = {
    productId   : Nat;
    productName : Text;
    quantity    : Nat;
    saleValue   : Float;
    remarks     : ?Text;
  };

  /// A CRM doctor-wise sale record submitted by MR or ASM
  public type CrmDoctorSaleRecord = {
    id             : CrmDoctorSaleId;
    submittedBy    : UserId;           // MR or ASM who submitted
    doctorId       : Nat;
    saleDate       : Timestamp;        // date of the sale/visit
    areaId         : Nat;              // auto-derived from doctor's area
    products       : [DoctorSaleProductEntry];
    totalSaleValue : Float;            // sum of all product saleValues
    createdAt      : Timestamp;
  };

  /// Input to create a new CRM doctor-wise sale entry
  public type CreateCrmDoctorSaleRequest = {
    doctorId : Nat;
    saleDate : Timestamp;
    products : [DoctorSaleProductEntry];
  };

  /// Filter for listing/exporting CRM doctor-wise sale records
  public type CrmDoctorSaleFilter = {
    submittedBy : ?UserId;
    doctorId    : ?Nat;
    areaId      : ?Nat;
    fromDate    : ?Timestamp;
    toDate      : ?Timestamp;
  };
};
