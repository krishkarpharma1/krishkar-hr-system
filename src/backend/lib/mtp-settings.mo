import Types "../types/mtp-settings";
import LocTypes "../types/location-master";
import AuthTypes "../types/auth-users";
import Map "mo:core/Map";
import List "mo:core/List";

/// Domain logic for MTP settings and station-HQ queries.
module {

  // ── MTP Settings ─────────────────────────────────────────────────────────────

  /// Return the current MTP settings as a shared snapshot.
  public func getMtpSettings(state : Types.MtpSettingsState) : Types.MtpSettings {
    Types.toInfo(state)
  };

  /// Update MTP settings (Admin only; auth enforced in the mixin).
  public func updateMtpSettings(
    state : Types.MtpSettingsState,
    input : Types.MtpSettings,
  ) : { #ok; #err : Text } {
    state.enableStationSelectionInMtp     := input.enableStationSelectionInMtp;
    state.stationSelectionMandatory       := input.stationSelectionMandatory;
    state.enableAdditionalStationInMtp    := input.enableAdditionalStationInMtp;
    state.allowMultipleAdditionalStations := input.allowMultipleAdditionalStations;
    state.requireApprovalForResubmission  := input.requireApprovalForResubmission;
    state.enableOtherStationInDcrEntry    := input.enableOtherStationInDcrEntry;
    #ok
  };

  // ── Station-HQ lookup ─────────────────────────────────────────────────────────

  /// Return all active stations mapped under the HQ assigned to employeeId.
  /// employeeId here is the Nat UserId. Returns [] if the employee has no HQ
  /// assignment or if no active stations are mapped to their HQ.
  public func getStationsForEmployeeHQ(
    employeeId : AuthTypes.UserId,
    users      : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
    stations   : Map.Map<LocTypes.LocationId, LocTypes.StationRecord>,
  ) : [LocTypes.StationRecord] {
    // Resolve the employee's primaryHqId
    let hqIdOpt : ?LocTypes.LocationId = switch (users.get(employeeId)) {
      case null    { null };
      case (?user) { user.primaryHqId };
    };
    switch (hqIdOpt) {
      case null { [] };
      case (?hqId) {
        let result = List.empty<LocTypes.StationRecord>();
        for ((_, s) in stations.entries()) {
          if (s.hqId == hqId and s.isActive) { result.add(s) };
        };
        result.toArray()
      };
    }
  };
};
