import List    "mo:core/List";
import Map     "mo:core/Map";
import Text    "mo:core/Text";
import Nat     "mo:core/Nat";
import Time    "mo:core/Time";
import SRTypes "../types/sample-return";
import AuthTypes "../types/auth-users";

/// Public API mixin for Sample Return tracking and approval workflow.
/// MR: recordSampleReturn. ASM/Admin: approveSampleReturn, rejectSampleReturn.
mixin (
  sessions       : Map.Map<Text, AuthTypes.Session>,
  users          : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
  sampleReturns  : List.List<SRTypes.SampleReturn>,
  nextReturnId   : { var val : Nat },
) {

  func sessionUserId(token : Text) : ?Nat {
    switch (sessions.get(token)) {
      case (?s) ?s.userId;
      case null null;
    };
  };

  func userRole(uid : Nat) : ?AuthTypes.Role {
    switch (users.get(uid)) {
      case (?u) ?u.role;
      case null null;
    };
  };

  func canApprove(token : Text) : Bool {
    switch (sessionUserId(token)) {
      case null false;
      case (?uid) switch (userRole(uid)) {
        case (?(#ASM))       true;
        case (?(#RSM))       true;
        case (?(#ZSM))       true;
        case (?(#Admin))     true;
        case (?(#HRManager)) true;
        case _               false;
      };
    };
  };

  /// MR: record a sample return request.
  public shared ({ caller }) func recordSampleReturn(
    token : Text,
    input : SRTypes.RecordSampleReturnInput,
  ) : async { #ok : Text; #err : Text } {
    switch (sessionUserId(token)) {
      case null #err("Not authenticated");
      case (?_mrId) {
        let id = nextReturnId.val.toText();
        nextReturnId.val += 1;
        let now = Time.now();
        sampleReturns.add({
          returnId         = id;
          issueId          = input.issueId;
          doctorId         = input.doctorId;
          productId        = input.productId;
          batchNumber      = input.batchNumber;
          quantityReturned = input.quantityReturned;
          reason           = input.reason;
          notes            = input.notes;
          gpsLat           = input.gpsLat;
          gpsLng           = input.gpsLng;
          returnDate       = now;
          var status       = (#pending : SRTypes.ReturnStatus);
          var approvedBy   = "";
          var approvedAt   = (0 : Int);
        });
        #ok(id);
      };
    };
  };

  /// ASM/Admin: approve a sample return.
  public shared ({ caller }) func approveSampleReturn(
    token    : Text,
    returnId : Text,
  ) : async { #ok; #err : Text } {
    if (not canApprove(token)) return #err("Access denied");
    switch (sessionUserId(token)) {
      case null #err("Not authenticated");
      case (?uid) {
        switch (sampleReturns.find(func(r : SRTypes.SampleReturn) : Bool { r.returnId == returnId })) {
          case null #err("Sample return not found");
          case (?r) {
            r.status     := #approved;
            r.approvedBy := uid.toText();
            r.approvedAt := Time.now();
            #ok;
          };
        };
      };
    };
  };

  /// ASM/Admin: reject a sample return.
  public shared ({ caller }) func rejectSampleReturn(
    token    : Text,
    returnId : Text,
    reason   : Text,
  ) : async { #ok; #err : Text } {
    if (not canApprove(token)) return #err("Access denied");
    switch (sampleReturns.find(func(r : SRTypes.SampleReturn) : Bool { r.returnId == returnId })) {
      case null #err("Sample return not found");
      case (?r) {
        r.status     := #rejected;
        r.approvedAt := Time.now();
        #ok;
      };
    };
  };

  /// MR/Manager: get all sample returns for an MR.
  public query func getSampleReturnsByMR(
    token : Text,
    mrId  : ?Nat,
  ) : async [SRTypes.SampleReturnInfo] {
    let targetId : ?Nat = switch (mrId) {
      case (?id) ?id;
      case null sessionUserId(token);
    };
    switch (targetId) {
      case null [];
      case (?_uid) {
        sampleReturns
          .map<SRTypes.SampleReturn, SRTypes.SampleReturnInfo>(func(r) {
            {
              returnId         = r.returnId;
              issueId          = r.issueId;
              doctorId         = r.doctorId;
              productId        = r.productId;
              batchNumber      = r.batchNumber;
              quantityReturned = r.quantityReturned;
              reason           = r.reason;
              notes            = r.notes;
              gpsLat           = r.gpsLat;
              gpsLng           = r.gpsLng;
              returnDate       = r.returnDate;
              status           = r.status;
              approvedBy       = r.approvedBy;
              approvedAt       = r.approvedAt;
            }
          })
          .toArray();
      };
    };
  };

  /// Admin/HR: get sample balance report including returns (all MRs or filtered by MR).
  public query func getSampleBalanceReport(
    token : Text,
    mrId  : ?Nat,
  ) : async [SRTypes.SampleBalanceReportRow] {
    // Aggregate returns per (productId) for the given MR
    let returnMap = Map.empty<Text, Nat>();  // productId -> total returned qty
    for (r in sampleReturns.values()) {
      let key = r.productId;
      switch (returnMap.get(key)) {
        case (?qty) returnMap.add(key, qty + r.quantityReturned);
        case null   returnMap.add(key, r.quantityReturned);
      };
    };
    // Build report rows from return map
    returnMap.entries()
      .map<(Text, Nat), SRTypes.SampleBalanceReportRow>(func((productId, returnedQty)) {
        {
          productId;
          productName    = "";
          totalIssued    = 0;   // caller resolves from sfa-sample allocation
          totalReturned  = returnedQty;
          netDistributed = 0;
        }
      })
      .toArray();
  };
};
