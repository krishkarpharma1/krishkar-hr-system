import Types "../types/booking";
import List  "mo:core/List";
import Time  "mo:core/Time";

module {

  // ── Helpers ───────────────────────────────────────────────────────────────

  /// Convert mutable BookingRequest to shared BookingRequestInfo.
  public func toInfo(r : Types.BookingRequest) : Types.BookingRequestInfo {
    {
      id              = r.id;
      userId          = r.userId;
      userName        = r.userName;
      userRole        = r.userRole;
      itemName        = r.itemName;
      quantity        = r.quantity;
      intendedUse     = r.intendedUse;
      targetDate      = r.targetDate;
      notes           = r.notes;
      status          = r.status;
      rejectionReason = r.rejectionReason;
      reviewedBy      = r.reviewedBy;
      reviewedAt      = r.reviewedAt;
      createdAt       = r.createdAt;
      updatedAt       = r.updatedAt;
    }
  };

  // ── Mutations ─────────────────────────────────────────────────────────────

  /// Create and store a new BookingRequest. Returns the created record info.
  public func createBooking(
    bookingRequests : List.List<Types.BookingRequest>,
    nextBookingId   : { var val : Nat },
    userId          : Nat,
    userName        : Text,
    userRole        : Text,
    itemName        : Text,
    quantity        : Nat,
    intendedUse     : Types.IntendedUse,
    targetDate      : Text,
    notes           : ?Text,
  ) : Types.BookingRequestInfo {
    let id = nextBookingId.val;
    nextBookingId.val += 1;
    let now = Time.now();

    let record : Types.BookingRequest = {
      id                  = id;
      userId              = userId;
      var userName        = userName;
      var userRole        = userRole;
      var itemName        = itemName;
      var quantity        = quantity;
      var intendedUse     = intendedUse;
      var targetDate      = targetDate;
      var notes           = notes;
      var status          = #Pending;
      var rejectionReason = null;
      var reviewedBy      = null;
      var reviewedAt      = null;
      createdAt           = now;
      var updatedAt       = now;
    };
    bookingRequests.add(record);
    toInfo(record)
  };

  /// Approve a booking by id. Requires HR or Admin role (validated by caller).
  public func approveBooking(
    bookingRequests : List.List<Types.BookingRequest>,
    id              : Types.BookingId,
    reviewerId      : Nat,
  ) : Types.MutationResult {
    switch (bookingRequests.find(func(r : Types.BookingRequest) : Bool { r.id == id })) {
      case null { #err("Booking request not found") };
      case (?r) {
        if (r.status == #Approved) {
          return #err("Booking request is already approved");
        };
        if (r.status == #Rejected) {
          return #err("Cannot approve a rejected booking request; ask the requester to resubmit");
        };
        let now = Time.now();
        r.status     := #Approved;
        r.reviewedBy := ?reviewerId;
        r.reviewedAt := ?now;
        r.updatedAt  := now;
        #ok
      };
    }
  };

  /// Reject a booking by id with a reason. Requires HR or Admin role.
  public func rejectBooking(
    bookingRequests : List.List<Types.BookingRequest>,
    id              : Types.BookingId,
    reason          : Text,
    reviewerId      : Nat,
  ) : Types.MutationResult {
    if (reason.size() == 0) {
      return #err("Rejection reason is required");
    };
    switch (bookingRequests.find(func(r : Types.BookingRequest) : Bool { r.id == id })) {
      case null { #err("Booking request not found") };
      case (?r) {
        if (r.status == #Rejected) {
          return #err("Booking request is already rejected");
        };
        let now = Time.now();
        r.status          := #Rejected;
        r.rejectionReason := ?reason;
        r.reviewedBy      := ?reviewerId;
        r.reviewedAt      := ?now;
        r.updatedAt       := now;
        #ok
      };
    }
  };

  /// Re-submit a previously rejected booking (resets status to Pending).
  public func resubmitBooking(
    bookingRequests  : List.List<Types.BookingRequest>,
    id               : Types.BookingId,
    requestingUserId : Nat,
  ) : Types.MutationResult {
    switch (bookingRequests.find(func(r : Types.BookingRequest) : Bool { r.id == id })) {
      case null { #err("Booking request not found") };
      case (?r) {
        if (r.userId != requestingUserId) {
          return #err("Access denied: only the original requester may resubmit this booking");
        };
        if (r.status != #Rejected) {
          return #err("Only rejected booking requests can be resubmitted");
        };
        r.status          := #Pending;
        r.rejectionReason := null;
        r.reviewedBy      := null;
        r.reviewedAt      := null;
        r.updatedAt       := Time.now();
        #ok
      };
    }
  };

  // ── Queries ───────────────────────────────────────────────────────────────

  /// List all bookings belonging to a specific user.
  public func listMyBookings(
    bookingRequests : List.List<Types.BookingRequest>,
    userId          : Nat,
  ) : [Types.BookingRequestInfo] {
    bookingRequests
      .filter(func(r : Types.BookingRequest) : Bool { r.userId == userId })
      .map<Types.BookingRequest, Types.BookingRequestInfo>(toInfo)
      .toArray()
  };

  /// List all booking requests (HR/Admin only — access enforced by mixin).
  public func listAllBookings(
    bookingRequests : List.List<Types.BookingRequest>,
  ) : [Types.BookingRequestInfo] {
    bookingRequests
      .map<Types.BookingRequest, Types.BookingRequestInfo>(toInfo)
      .toArray()
  };
};
