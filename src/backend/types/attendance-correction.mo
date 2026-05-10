import Common "common";

module {
  public type UserId    = Common.UserId;
  public type Timestamp = Common.Timestamp;

  /// Request submitted by an MR to correct an Auto Checkout record.
  public type AttendanceCorrectionRequest = {
    requestId            : Nat;
    employeeId           : UserId;
    date                 : Text;    // DD-MM-YYYY (display format) — stored as ISO internally
    autoCheckoutDate     : Text;    // ISO date "YYYY-MM-DD" of the auto-checkout event
    claimedCheckoutTime  : Text;    // HH:MM format (24-hour) claimed by employee
    reason               : Text;
    supportingEvidence   : ?Text;
    submittedAt          : Timestamp;
    status               : { #pending; #approved; #rejected };
    reviewedBy           : ?UserId;
    reviewedAt           : ?Timestamp;
    reviewNote           : ?Text;
  };
};
