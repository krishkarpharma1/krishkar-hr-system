import Time "mo:core/Time";
import List "mo:core/List";
import Map "mo:core/Map";
import Types "../types/sfa-sample";
import AuthTypes "../types/auth-users";
import SfaSample "../lib/sfa-sample";

/// Public API surface for Sample Allocation and Usage.
/// State is injected via mixin parameters — no owned state.
mixin (
  sampleAllocations   : List.List<Types.SampleAllocationRecord>,
  sampleUsages        : List.List<Types.SampleUsageRecord>,
  sessions            : Map.Map<Text, AuthTypes.Session>,
  users               : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
  nextSampleAllocId   : { var val : Nat },
  nextSampleUsageId   : { var val : Nat },
) {

  // ── Session helpers ────────────────────────────────────────────────────────

  func requireSessionSA(token : Text) : ?AuthTypes.Session {
    switch (sessions.get(token)) {
      case (?s) { if (s.expiresAt > Time.now()) ?s else null };
      case null { null };
    };
  };

  func requireAdminOrHRSA(token : Text) : ?AuthTypes.Session {
    switch (requireSessionSA(token)) {
      case null { null };
      case (?s) {
        switch (s.role) {
          case (#Admin or #HRManager) ?s;
          case _                      null;
        }
      };
    }
  };

  func requireManagerSA(token : Text) : ?AuthTypes.Session {
    switch (requireSessionSA(token)) {
      case null { null };
      case (?s) {
        switch (s.role) {
          case (#Admin or #HRManager or #ZSM or #RSM or #ASM) ?s;
          case _ null;
        }
      };
    }
  };

  /// Look up the UserId of the logged-in user from session token.
  func callerUserId(token : Text) : ?AuthTypes.UserId {
    switch (requireSessionSA(token)) {
      case (?s) ?s.userId;
      case null null;
    }
  };

  // ── Sample Allocation — Admin/HR ──────────────────────────────────────────

  /// Allocate samples to an MR. Admin/HR only.
  /// If an allocation already exists for (mrId, productId, month, year),
  /// the quantity is added to the existing record.
  public shared func allocateSamplesToMR(
    token : Text,
    input : Types.SampleAllocationInput,
  ) : async { #ok : Nat; #err : Text } {
    switch (requireAdminOrHRSA(token)) {
      case null { #err("Unauthorized: Admin or HR role required") };
      case (?s) {
        let allocId = SfaSample.allocateSamples(
          sampleAllocations, nextSampleAllocId, s.userId, input
        );
        #ok(allocId)
      };
    }
  };

  /// Get all sample allocations for a given month/year. Admin/HR only.
  public query func getAllAllocations(
    token : Text,
    month : Nat,
    year  : Nat,
  ) : async { #ok : [Types.SampleAllocationInfo]; #err : Text } {
    switch (requireAdminOrHRSA(token)) {
      case null { #err("Unauthorized: Admin or HR role required") };
      case (?_) {
        #ok(SfaSample.listAllSampleAllocations(sampleAllocations, month, year))
      };
    }
  };

  /// Get sample allocations for a specific MR. Admin, HR, ASM, or RSM.
  public query func getAllocationsForMR(
    token : Text,
    mrId  : Nat,
    month : Nat,
    year  : Nat,
  ) : async { #ok : [Types.SampleAllocationInfo]; #err : Text } {
    switch (requireManagerSA(token)) {
      case null { #err("Unauthorized: ASM or above required") };
      case (?_) {
        #ok(SfaSample.listSampleAllocationsForMR(sampleAllocations, mrId, month, year))
      };
    }
  };

  // ── Sample Allocation — MR self-service ───────────────────────────────────

  /// Get the calling MR's own sample allocations for a month/year.
  public query func listMyAllocations(
    token : Text,
    month : Nat,
    year  : Nat,
  ) : async [Types.SampleAllocationInfo] {
    switch (callerUserId(token)) {
      case null { [] };
      case (?uid) {
        SfaSample.listSampleAllocationsForMR(sampleAllocations, uid, month, year)
      };
    }
  };

  /// Get the calling MR's own sample balance for a month/year.
  public query func getMyBalance(
    token : Text,
    month : Nat,
    year  : Nat,
  ) : async [Types.SampleBalanceView] {
    switch (callerUserId(token)) {
      case null { [] };
      case (?uid) {
        SfaSample.getSampleBalance(sampleAllocations, uid, month, year)
      };
    }
  };

  // ── Team balance — manager view ───────────────────────────────────────────

  /// Get sample balances for a list of MR IDs. Requires manager role.
  public query func getTeamSampleBalances(
    token  : Text,
    mrIds  : [Nat],
    month  : Nat,
    year   : Nat,
  ) : async { #ok : [(Nat, [Types.SampleBalanceView])]; #err : Text } {
    switch (requireManagerSA(token)) {
      case null { #err("Unauthorized: ASM or above required") };
      case (?_) {
        #ok(SfaSample.getSampleBalanceForTeam(sampleAllocations, mrIds, month, year))
      };
    }
  };

  // ── Sample Usage — MR self-service ────────────────────────────────────────

  /// Record samples used during a Doctor Call. Caller must be an authenticated MR (or any role).
  /// Automatically deducts from the matching monthly allocation.
  public shared func recordSamplesUsed(
    token        : Text,
    callReportId : Nat,
    usages       : [Types.SampleUsageInput],
  ) : async { #ok : [Nat]; #err : Text } {
    switch (requireSessionSA(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        let ids = SfaSample.recordSampleUsage(
          sampleAllocations, sampleUsages, nextSampleUsageId,
          s.userId, callReportId, usages, Time.now()
        );
        #ok(ids)
      };
    }
  };

};
