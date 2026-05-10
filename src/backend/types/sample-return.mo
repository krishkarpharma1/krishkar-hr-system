module {
  public type ReturnStatus = {
    #pending;
    #approved;
    #rejected;
  };

  /// Mutable sample return record stored in backend.
  public type SampleReturn = {
    returnId         : Text;
    issueId          : Text;      // references a SampleAllocationRecord or usage record
    doctorId         : Text;      // text form of DoctorId for flexibility
    productId        : Text;      // text form of ProductId
    batchNumber      : Text;
    quantityReturned : Nat;
    reason           : Text;
    notes            : Text;
    gpsLat           : Float;
    gpsLng           : Float;
    returnDate       : Int;       // nanosecond timestamp
    var status       : ReturnStatus;
    var approvedBy   : Text;      // userId text of approver; empty if not yet approved
    var approvedAt   : Int;       // nanosecond timestamp; 0 if not yet approved
  };

  /// Immutable view for API responses.
  public type SampleReturnInfo = {
    returnId         : Text;
    issueId          : Text;
    doctorId         : Text;
    productId        : Text;
    batchNumber      : Text;
    quantityReturned : Nat;
    reason           : Text;
    notes            : Text;
    gpsLat           : Float;
    gpsLng           : Float;
    returnDate       : Int;
    status           : ReturnStatus;
    approvedBy       : Text;
    approvedAt       : Int;
  };

  public type RecordSampleReturnInput = {
    issueId          : Text;
    doctorId         : Text;
    productId        : Text;
    batchNumber      : Text;
    quantityReturned : Nat;
    reason           : Text;
    notes            : Text;
    gpsLat           : Float;
    gpsLng           : Float;
  };

  /// One row in the sample balance report.
  public type SampleBalanceReportRow = {
    productId      : Text;
    productName    : Text;
    totalIssued    : Nat;
    totalReturned  : Nat;
    netDistributed : Nat;  // totalIssued - totalReturned
  };
};
