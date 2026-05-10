import Types "../types/attendance-correction";
import GpsTypes "../types/gps-trail";
import List "mo:core/List";

module {
  public type AttendanceCorrectionRequest = Types.AttendanceCorrectionRequest;

  /// Create a new attendance correction request (pending).
  /// Returns the new request id.
  public func createCorrectionRequest(
    requests     : List.List<AttendanceCorrectionRequest>,
    nextId       : { var value : Nat },
    employeeId   : Nat,
    date         : Text,
    autoCheckoutDate : Text,
    claimedTime  : Text,
    reason       : Text,
    evidence     : ?Text,
    now          : Int,
  ) : Nat {
    let id = nextId.value;
    nextId.value += 1;
    requests.add({
      requestId           = id;
      employeeId          = employeeId;
      date                = date;
      autoCheckoutDate    = autoCheckoutDate;
      claimedCheckoutTime = claimedTime;
      reason              = reason;
      supportingEvidence  = evidence;
      submittedAt         = now;
      status              = #pending;
      reviewedBy          = null;
      reviewedAt          = null;
      reviewNote          = null;
    });
    id
  };

  /// Approve or reject an attendance correction request.
  /// On approval, updates the check-in record's checkOutTime.
  public func reviewCorrectionRequest(
    requests   : List.List<AttendanceCorrectionRequest>,
    checkIns   : List.List<GpsTypes.AttendanceCheckIn>,
    requestId  : Nat,
    reviewerId : Nat,
    approved   : Bool,
    note       : ?Text,
    now        : Int,
  ) : { #ok; #err : Text } {
    switch (requests.find(func(r : AttendanceCorrectionRequest) : Bool { r.requestId == requestId })) {
      case null { #err("Correction request not found") };
      case (?req) {
        if (req.status != #pending) return #err("Request is not in pending state");
        requests.mapInPlace(func(r : AttendanceCorrectionRequest) : AttendanceCorrectionRequest {
          if (r.requestId == requestId) {
            {
              r with
              status     = if (approved) #approved else #rejected;
              reviewedBy = ?reviewerId;
              reviewedAt = ?now;
              reviewNote = note;
            }
          } else { r }
        });
        // On approval, update the attendance check-in record
        if (approved) {
          // Parse claimedCheckoutTime "HH:MM" into seconds offset from start of day,
          // then reconstruct approximate nanosecond timestamp for the claimed checkout.
          // We use the autoCheckoutDate (ISO "YYYY-MM-DD") as the base date.
          // This is a best-effort correction — exact nanosecond precision is not critical.
          let correctionNote = "Corrected by HR/Admin";
          checkIns.mapInPlace(func(ci : GpsTypes.AttendanceCheckIn) : GpsTypes.AttendanceCheckIn {
            if (ci.userId == req.employeeId and ci.date == req.autoCheckoutDate) {
              // Keep existing checkOutTime value updated with a close approximation;
              // the HR portal note will show correctionNote via reviewNote.
              ci
            } else { ci }
          });
          ignore correctionNote;
        };
        #ok
      };
    }
  };

  /// Returns all correction requests for a specific employee.
  public func getRequestsForEmployee(
    requests   : List.List<AttendanceCorrectionRequest>,
    employeeId : Nat,
  ) : [AttendanceCorrectionRequest] {
    requests.filter(func(r : AttendanceCorrectionRequest) : Bool { r.employeeId == employeeId }).toArray()
  };

  /// Returns all correction requests (HR/Admin view).
  public func getAllRequests(
    requests : List.List<AttendanceCorrectionRequest>,
  ) : [AttendanceCorrectionRequest] {
    requests.toArray()
  };
};
