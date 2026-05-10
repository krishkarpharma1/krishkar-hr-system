/// MTP Settings types for station selection, additional station,
/// and working-style re-submission configuration.
module {

  /// Admin-configurable settings for the MTP (Monthly Tour Plan) module.
  /// All fields default to safe backward-compatible values:
  ///   enableStationSelectionInMtp  = true  (show station dropdown on MTP form)
  ///   stationSelectionMandatory    = false (station is optional by default)
  ///   enableAdditionalStationInMtp = true  (show Additional Station toggle)
  ///   allowMultipleAdditionalStations = false (one additional station per day)
  ///   requireApprovalForResubmission  = false (re-submission takes effect immediately)
  ///   enableOtherStationInDcrEntry    = true  (show Other Station dropdown in DCR entry)
  public type MtpSettings = {
    enableStationSelectionInMtp     : Bool;
    stationSelectionMandatory       : Bool;
    enableAdditionalStationInMtp    : Bool;
    allowMultipleAdditionalStations : Bool;
    requireApprovalForResubmission  : Bool;
    enableOtherStationInDcrEntry    : Bool;
  };

  /// Mutable wrapper held in actor state so settings can be updated in place.
  public type MtpSettingsState = {
    var enableStationSelectionInMtp     : Bool;
    var stationSelectionMandatory       : Bool;
    var enableAdditionalStationInMtp    : Bool;
    var allowMultipleAdditionalStations : Bool;
    var requireApprovalForResubmission  : Bool;
    var enableOtherStationInDcrEntry    : Bool;
  };

  /// Default initial values (called once from main.mo do-block).
  public func defaultSettings() : MtpSettingsState {
    {
      var enableStationSelectionInMtp     = true;
      var stationSelectionMandatory       = false;
      var enableAdditionalStationInMtp    = true;
      var allowMultipleAdditionalStations = false;
      var requireApprovalForResubmission  = false;
      var enableOtherStationInDcrEntry    = true;
    }
  };

  /// Shared (immutable) snapshot returned to callers.
  public func toInfo(s : MtpSettingsState) : MtpSettings {
    {
      enableStationSelectionInMtp     = s.enableStationSelectionInMtp;
      stationSelectionMandatory       = s.stationSelectionMandatory;
      enableAdditionalStationInMtp    = s.enableAdditionalStationInMtp;
      allowMultipleAdditionalStations = s.allowMultipleAdditionalStations;
      requireApprovalForResubmission  = s.requireApprovalForResubmission;
      enableOtherStationInDcrEntry    = s.enableOtherStationInDcrEntry;
    }
  };
};
