import CommonTypes "common";

module {
  public type UserId    = CommonTypes.UserId;
  public type Timestamp = CommonTypes.Timestamp;

  public type StockistId = Nat;

  /// Master record for a pharmaceutical stockist/distributor
  public type StockistRecord = {
    id                : StockistId;
    name              : Text;
    proprietorName    : Text;
    mobileNumber      : Text;
    emailId           : ?Text;
    address           : Text;
    areaId            : Nat;          // linked to location master AreaRecord
    hqId              : Nat;          // linked to location master HQRecord (auto-derived or selected)
    drugLicenseNumber : ?Text;
    gstNumber         : ?Text;
    remarks           : ?Text;
    isActive          : Bool;
    createdAt         : Timestamp;
    createdBy         : UserId;       // Admin or HR who created this record
  };

  /// Filter for listing stockists
  public type StockistFilter = {
    nameSearch : ?Text;   // partial match on stockist name
    areaId     : ?Nat;
    hqId       : ?Nat;
    isActive   : ?Bool;
  };

  /// Input to create a new stockist (Admin/HR)
  public type CreateStockistRequest = {
    name              : Text;
    proprietorName    : Text;
    mobileNumber      : Text;
    emailId           : ?Text;
    address           : Text;
    areaId            : Nat;
    drugLicenseNumber : ?Text;
    gstNumber         : ?Text;
    remarks           : ?Text;
  };

  /// Input to update an existing stockist (Admin/HR)
  public type UpdateStockistRequest = {
    id                : StockistId;
    name              : ?Text;
    proprietorName    : ?Text;
    mobileNumber      : ?Text;
    emailId           : ?Text;
    address           : ?Text;
    areaId            : ?Nat;
    drugLicenseNumber : ?Text;
    gstNumber         : ?Text;
    remarks           : ?Text;
    isActive          : ?Bool;
  };

  /// One row for bulk stockist upload
  public type BulkStockistInput = {
    name              : Text;
    proprietorName    : Text;
    mobileNumber      : Text;
    address           : Text;
    areaId            : Nat;
    drugLicenseNumber : ?Text;
    gstNumber         : ?Text;
    remarks           : ?Text;
  };

  /// Result of a bulk upload operation
  public type BulkUploadResult = {
    succeeded : Nat;
    failed    : Nat;
    errors    : [Text];
  };
};
