import Common "common";

module {
  public type UserId    = Common.UserId;
  public type Timestamp = Common.Timestamp;

  // ── IDs ──────────────────────────────────────────────────────────────────
  public type BookingId = Nat;

  // ── Intended use for the booked item ─────────────────────────────────────
  public type BookingIntendedUse = {
    #Sample;
    #Gift;
  };

  // Keep backward-compat alias used in early stubs
  public type IntendedUse = BookingIntendedUse;

  // ── Booking request status ────────────────────────────────────────────────
  public type BookingStatus = {
    #Pending;
    #Approved;
    #Rejected;
  };

  // ── Booking Request ───────────────────────────────────────────────────────
  /// A booking request raised by field staff for Sample or Gift article requirements.
  /// Submitted to HR/Admin for approval.
  public type BookingRequest = {
    id                  : BookingId;
    userId              : UserId;
    var userName        : Text;          // display name of the requester
    var userRole        : Text;          // role name at time of submission
    var itemName        : Text;          // product / gift article name
    var quantity        : Nat;
    var intendedUse     : BookingIntendedUse;  // #Sample | #Gift
    var targetDate      : Text;          // ISO date "YYYY-MM-DD"
    var notes           : ?Text;
    var status          : BookingStatus; // #Pending | #Approved | #Rejected
    var rejectionReason : ?Text;         // filled by HR/Admin on rejection
    var reviewedBy      : ?UserId;       // HR/Admin who actioned the request
    var reviewedAt      : ?Timestamp;
    createdAt           : Timestamp;
    var updatedAt       : Timestamp;
  };

  /// Public/shared view of BookingRequest (no mutable fields)
  public type BookingRequestInfo = {
    id              : BookingId;
    userId          : UserId;
    userName        : Text;
    userRole        : Text;
    itemName        : Text;
    quantity        : Nat;
    intendedUse     : BookingIntendedUse;
    targetDate      : Text;
    notes           : ?Text;
    status          : BookingStatus;
    rejectionReason : ?Text;
    reviewedBy      : ?UserId;
    reviewedAt      : ?Timestamp;
    createdAt       : Timestamp;
    updatedAt       : Timestamp;
  };

  // ── Input types ───────────────────────────────────────────────────────────
  public type CreateBookingRequestInput = {
    itemName    : Text;
    quantity    : Nat;
    intendedUse : BookingIntendedUse;
    targetDate  : Text;
    notes       : ?Text;
  };

  public type ReviewBookingRequestInput = {
    id              : BookingId;
    approve         : Bool;           // true = approve, false = reject
    rejectionReason : ?Text;
  };

  public type MutationResult = Common.MutationResult;
};
