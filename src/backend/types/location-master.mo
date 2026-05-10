import CommonTypes "common";

module {
  public type LocationId = Nat;
  public type Timestamp  = CommonTypes.Timestamp;

  // ── Zone ─────────────────────────────────────────────────────────────────
  public type ZoneRecord = {
    id        : LocationId;
    name      : Text;
    code      : Text;
    isActive  : Bool;
    createdAt : Timestamp;
  };

  public type CreateZoneInput = {
    name : Text;
    code : Text;
  };

  public type UpdateZoneInput = {
    name : ?Text;
    code : ?Text;
  };

  // ── State ─────────────────────────────────────────────────────────────────
  public type StateRecord = {
    id        : LocationId;
    name      : Text;
    zoneId    : LocationId;
    isActive  : Bool;
    createdAt : Timestamp;
  };

  public type CreateStateInput = {
    name   : Text;
    zoneId : LocationId;
  };

  public type UpdateStateInput = {
    name   : ?Text;
    zoneId : ?LocationId;
  };

  // ── Territory ─────────────────────────────────────────────────────────────
  public type TerritoryRecord = {
    id        : LocationId;
    name      : Text;
    stateId   : LocationId;
    isActive  : Bool;
    createdAt : Timestamp;
  };

  public type CreateTerritoryInput = {
    name    : Text;
    stateId : LocationId;
  };

  public type UpdateTerritoryInput = {
    name    : ?Text;
    stateId : ?LocationId;
  };

  // ── HQ ────────────────────────────────────────────────────────────────────
  public type HQRecord = {
    id          : LocationId;
    name        : Text;
    territoryId : LocationId;
    isActive    : Bool;
    createdAt   : Timestamp;
  };

  public type CreateHQInput = {
    name        : Text;
    territoryId : LocationId;
  };

  public type UpdateHQInput = {
    name        : ?Text;
    territoryId : ?LocationId;
  };

  // ── Area ──────────────────────────────────────────────────────────────────
  public type AreaRecord = {
    id        : LocationId;
    name      : Text;
    hqId      : LocationId;
    isActive  : Bool;
    createdAt : Timestamp;
  };

  public type CreateAreaInput = {
    name : Text;
    hqId : LocationId;
  };

  public type UpdateAreaInput = {
    name : ?Text;
    hqId : ?LocationId;
  };

  // ── Station ───────────────────────────────────────────────────────────────
  /// A Station belongs to exactly one HQ (one-to-one hqId constraint enforced in lib).
  public type StationRecord = {
    stationId   : LocationId;
    stationName : Text;
    hqId        : LocationId;   // exactly one HQ — cannot appear under multiple HQs
    createdAt   : Timestamp;
    updatedAt   : Timestamp;
    isActive    : Bool;
  };

  public type CreateStationInput = {
    stationName : Text;
    hqId        : LocationId;
  };

  public type UpdateStationInput = {
    stationName : ?Text;
    isActive    : ?Bool;
  };

  // ── Bulk Station Import ───────────────────────────────────────────────────

  /// One row of input from the Excel file for bulk station import.
  /// Only Station Name and HQ Name are required (template includes only these two columns).
  public type BulkStationImportInput = {
    stationName : Text;
    hqName      : Text;
  };

  /// Per-row result from a bulk station import operation.
  public type BulkStationImportRowResult = {
    rowIndex    : Nat;
    stationName : Text;
    hqName      : Text;
    status      : { #ok; #error };
    errorReason : ?Text;
  };

  /// Aggregate result and history record for one bulk station import session.
  public type BulkStationImportResult = {
    totalRows   : Nat;
    saved       : Nat;
    skipped     : Nat;
    rowResults  : [BulkStationImportRowResult];
    uploadedBy  : Text;   // display name of Admin who triggered the import
    uploadedAt  : Int;    // nanosecond timestamp
  };

  // ── Shared mutation result ────────────────────────────────────────────────
  public type MutationResult = CommonTypes.MutationResult;
};
