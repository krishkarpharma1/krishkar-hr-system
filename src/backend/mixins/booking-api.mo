import Types    "../types/booking";
import AuthTypes "../types/auth-users";
import Lib      "../lib/booking";
import List     "mo:core/List";
import Map      "mo:core/Map";
import Time     "mo:core/Time";

/// Public API mixin for the Booking domain.
/// Field staff raise booking requests; HR/Admin approve or reject them.
mixin (
  sessions        : Map.Map<Text, AuthTypes.Session>,
  bookingRequests : List.List<Types.BookingRequest>,
  nextBookingId   : { var val : Nat },
) {

  // ── Session helpers ────────────────────────────────────────────────────────

  func requireSessionBK(token : Text) : ?AuthTypes.Session {
    switch (sessions.get(token)) {
      case (?s) {
        if (s.expiresAt > Time.now()) ?s else null
      };
      case null { null };
    };
  };

  func requireHROrAdminBK(token : Text) : ?AuthTypes.Session {
    switch (requireSessionBK(token)) {
      case null { null };
      case (?s) {
        switch (s.role) {
          case (#Admin or #HRManager) ?s;
          case _                      { null };
        }
      };
    }
  };

  // ── Booking API ────────────────────────────────────────────────────────────

  /// Submit a new booking request for Sample or Gift articles.
  /// Open to all authenticated roles.
  public func createBookingRequest(
    token       : Text,
    itemName    : Text,
    qty         : Nat,
    intendedUse : Types.IntendedUse,
    targetDate  : Text,
    notes       : ?Text,
  ) : async Types.MutationResult {
    switch (requireSessionBK(token)) {
      case null { return #err("Unauthorized: invalid or expired session") };
      case (?s) {
        // Validate required fields
        if (itemName.size() == 0) {
          return #err("Required field missing: Item Name");
        };
        if (qty == 0) {
          return #err("Quantity must be greater than zero");
        };
        if (targetDate.size() == 0) {
          return #err("Required field missing: Target Date");
        };

        let roleName = switch (s.role) {
          case (#Admin)     "Admin";
          case (#HRManager) "HRManager";
          case (#ZSM)       "ZSM";
          case (#RSM)       "RSM";
          case (#ASM)       "ASM";
          case (#MR)        "MR";
        };

        let _ = Lib.createBooking(
          bookingRequests,
          nextBookingId,
          s.userId,
          s.name,
          roleName,
          itemName,
          qty,
          intendedUse,
          targetDate,
          notes,
        );
        #ok
      };
    }
  };

  /// Approve a booking request. HR or Admin only.
  public func approveBookingRequest(
    token : Text,
    id    : Types.BookingId,
  ) : async Types.MutationResult {
    switch (requireHROrAdminBK(token)) {
      case null { #err("Unauthorized: HR or Admin role required") };
      case (?s) { Lib.approveBooking(bookingRequests, id, s.userId) };
    }
  };

  /// Reject a booking request with a reason. HR or Admin only.
  public func rejectBookingRequest(
    token  : Text,
    id     : Types.BookingId,
    reason : Text,
  ) : async Types.MutationResult {
    switch (requireHROrAdminBK(token)) {
      case null { #err("Unauthorized: HR or Admin role required") };
      case (?s) { Lib.rejectBooking(bookingRequests, id, reason, s.userId) };
    }
  };

  /// List the calling user's own booking requests.
  public query func listMyBookingRequests(token : Text) : async [Types.BookingRequestInfo] {
    switch (requireSessionBK(token)) {
      case null { [] };
      case (?s) { Lib.listMyBookings(bookingRequests, s.userId) };
    }
  };

  /// List all booking requests. HR or Admin only.
  public query func listAllBookingRequests(token : Text) : async [Types.BookingRequestInfo] {
    switch (requireHROrAdminBK(token)) {
      case null { [] };
      case (?_) { Lib.listAllBookings(bookingRequests) };
    }
  };

  /// Re-submit a previously rejected booking request (resets to Pending).
  /// Only the original requester may resubmit their own request.
  public func resubmitBookingRequest(
    token : Text,
    id    : Types.BookingId,
  ) : async Types.MutationResult {
    switch (requireSessionBK(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) { Lib.resubmitBooking(bookingRequests, id, s.userId) };
    }
  };
};
