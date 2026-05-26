import Types "../types/location-master";
import Map "mo:core/Map";
import List "mo:core/List";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";

module {
  public type LocationId          = Types.LocationId;
  public type MutationResult      = Types.MutationResult;
  public type ZoneRecord          = Types.ZoneRecord;
  public type StateRecord         = Types.StateRecord;
  public type TerritoryRecord     = Types.TerritoryRecord;
  public type HQRecord            = Types.HQRecord;
  public type AreaRecord          = Types.AreaRecord;
  public type StationRecord       = Types.StationRecord;
  public type CreateZoneInput     = Types.CreateZoneInput;
  public type UpdateZoneInput     = Types.UpdateZoneInput;
  public type CreateStateInput    = Types.CreateStateInput;
  public type UpdateStateInput    = Types.UpdateStateInput;
  public type CreateTerritoryInput = Types.CreateTerritoryInput;
  public type UpdateTerritoryInput = Types.UpdateTerritoryInput;
  public type CreateHQInput       = Types.CreateHQInput;
  public type UpdateHQInput       = Types.UpdateHQInput;
  public type CreateAreaInput     = Types.CreateAreaInput;
  public type UpdateAreaInput     = Types.UpdateAreaInput;
  public type CreateStationInput  = Types.CreateStationInput;
  public type UpdateStationInput  = Types.UpdateStationInput;
  public type BulkStationImportInput      = Types.BulkStationImportInput;
  public type BulkStationImportRowResult  = Types.BulkStationImportRowResult;
  public type BulkStationImportResult     = Types.BulkStationImportResult;

  // ── Zone CRUD ─────────────────────────────────────────────────────────────

  public func addZone(
    zones    : Map.Map<LocationId, ZoneRecord>,
    nextId   : { var val : Nat },
    input    : CreateZoneInput,
    now      : Int,
  ) : MutationResult {
    let id = nextId.val;
    let record : ZoneRecord = {
      id        = id;
      name      = input.name;
      code      = input.code;
      isActive  = true;
      createdAt = now;
    };
    zones.add(id, record);
    nextId.val += 1;
    #ok
  };

  public func updateZone(
    zones : Map.Map<LocationId, ZoneRecord>,
    id    : LocationId,
    input : UpdateZoneInput,
  ) : MutationResult {
    switch (zones.get(id)) {
      case null { #err("Zone not found") };
      case (?z) {
        zones.add(id, {
          z with
          name = switch (input.name) { case (?v) v; case null z.name };
          code = switch (input.code) { case (?v) v; case null z.code };
        });
        #ok
      };
    }
  };

  public func deactivateZone(
    zones : Map.Map<LocationId, ZoneRecord>,
    id    : LocationId,
  ) : MutationResult {
    switch (zones.get(id)) {
      case null { #err("Zone not found") };
      case (?z) {
        zones.add(id, { z with isActive = false });
        #ok
      };
    }
  };

  public func listZones(zones : Map.Map<LocationId, ZoneRecord>) : [ZoneRecord] {
    let result = List.empty<ZoneRecord>();
    for ((_, z) in zones.entries()) { result.add(z) };
    result.toArray()
  };

  public func listActiveZones(zones : Map.Map<LocationId, ZoneRecord>) : [ZoneRecord] {
    let result = List.empty<ZoneRecord>();
    for ((_, z) in zones.entries()) {
      if (z.isActive) { result.add(z) }
    };
    result.toArray()
  };

  public func listAllStates(states : Map.Map<LocationId, StateRecord>) : [StateRecord] {
    let result = List.empty<StateRecord>();
    for ((_, s) in states.entries()) { result.add(s) };
    result.toArray()
  };

  public func listAllActiveStates(states : Map.Map<LocationId, StateRecord>) : [StateRecord] {
    let result = List.empty<StateRecord>();
    for ((_, s) in states.entries()) {
      if (s.isActive) { result.add(s) }
    };
    result.toArray()
  };

  public func listAllTerritories(territories : Map.Map<LocationId, TerritoryRecord>) : [TerritoryRecord] {
    let result = List.empty<TerritoryRecord>();
    for ((_, t) in territories.entries()) { result.add(t) };
    result.toArray()
  };

  public func listAllActiveTerritories(territories : Map.Map<LocationId, TerritoryRecord>) : [TerritoryRecord] {
    let result = List.empty<TerritoryRecord>();
    for ((_, t) in territories.entries()) {
      if (t.isActive) { result.add(t) }
    };
    result.toArray()
  };

  public func listAllHQs(hqs : Map.Map<LocationId, HQRecord>) : [HQRecord] {
    let result = List.empty<HQRecord>();
    for ((_, h) in hqs.entries()) { result.add(h) };
    result.toArray()
  };

  public func listAllActiveHQs(hqs : Map.Map<LocationId, HQRecord>) : [HQRecord] {
    let result = List.empty<HQRecord>();
    for ((_, h) in hqs.entries()) {
      if (h.isActive) { result.add(h) }
    };
    result.toArray()
  };

  // ── State CRUD ────────────────────────────────────────────────────────────

  public func addState(
    states  : Map.Map<LocationId, StateRecord>,
    nextId  : { var val : Nat },
    input   : CreateStateInput,
    now     : Int,
  ) : MutationResult {
    let id = nextId.val;
    let record : StateRecord = {
      id        = id;
      name      = input.name;
      zoneId    = input.zoneId;
      isActive  = true;
      createdAt = now;
    };
    states.add(id, record);
    nextId.val += 1;
    #ok
  };

  public func updateState(
    states : Map.Map<LocationId, StateRecord>,
    id     : LocationId,
    input  : UpdateStateInput,
  ) : MutationResult {
    switch (states.get(id)) {
      case null { #err("State not found") };
      case (?s) {
        states.add(id, {
          s with
          name   = switch (input.name)   { case (?v) v; case null s.name };
          zoneId = switch (input.zoneId) { case (?v) v; case null s.zoneId };
        });
        #ok
      };
    }
  };

  public func deactivateState(
    states : Map.Map<LocationId, StateRecord>,
    id     : LocationId,
  ) : MutationResult {
    switch (states.get(id)) {
      case null { #err("State not found") };
      case (?s) {
        states.add(id, { s with isActive = false });
        #ok
      };
    }
  };

  public func listStatesByZone(
    states : Map.Map<LocationId, StateRecord>,
    zoneId : LocationId,
  ) : [StateRecord] {
    let result = List.empty<StateRecord>();
    for ((_, s) in states.entries()) {
      if (s.zoneId == zoneId) { result.add(s) }
    };
    result.toArray()
  };

  public func listActiveStatesByZone(
    states : Map.Map<LocationId, StateRecord>,
    zoneId : LocationId,
  ) : [StateRecord] {
    let result = List.empty<StateRecord>();
    for ((_, s) in states.entries()) {
      if (s.zoneId == zoneId and s.isActive) { result.add(s) }
    };
    result.toArray()
  };

  // ── Territory CRUD ────────────────────────────────────────────────────────

  public func addTerritory(
    territories : Map.Map<LocationId, TerritoryRecord>,
    nextId      : { var val : Nat },
    input       : CreateTerritoryInput,
    now         : Int,
  ) : MutationResult {
    let id = nextId.val;
    let record : TerritoryRecord = {
      id        = id;
      name      = input.name;
      stateId   = input.stateId;
      isActive  = true;
      createdAt = now;
    };
    territories.add(id, record);
    nextId.val += 1;
    #ok
  };

  public func updateTerritory(
    territories : Map.Map<LocationId, TerritoryRecord>,
    id          : LocationId,
    input       : UpdateTerritoryInput,
  ) : MutationResult {
    switch (territories.get(id)) {
      case null { #err("Territory not found") };
      case (?t) {
        territories.add(id, {
          t with
          name    = switch (input.name)    { case (?v) v; case null t.name };
          stateId = switch (input.stateId) { case (?v) v; case null t.stateId };
        });
        #ok
      };
    }
  };

  public func deactivateTerritory(
    territories : Map.Map<LocationId, TerritoryRecord>,
    id          : LocationId,
  ) : MutationResult {
    switch (territories.get(id)) {
      case null { #err("Territory not found") };
      case (?t) {
        territories.add(id, { t with isActive = false });
        #ok
      };
    }
  };

  public func listTerritoriesByState(
    territories : Map.Map<LocationId, TerritoryRecord>,
    stateId     : LocationId,
  ) : [TerritoryRecord] {
    let result = List.empty<TerritoryRecord>();
    for ((_, t) in territories.entries()) {
      if (t.stateId == stateId) { result.add(t) }
    };
    result.toArray()
  };

  public func listActiveTerritories(
    territories : Map.Map<LocationId, TerritoryRecord>,
    stateId     : LocationId,
  ) : [TerritoryRecord] {
    let result = List.empty<TerritoryRecord>();
    for ((_, t) in territories.entries()) {
      if (t.stateId == stateId and t.isActive) { result.add(t) }
    };
    result.toArray()
  };

  // ── HQ CRUD ───────────────────────────────────────────────────────────────

  public func addHQ(
    hqs         : Map.Map<LocationId, HQRecord>,
    nextId      : { var val : Nat },
    input       : CreateHQInput,
    now         : Int,
  ) : MutationResult {
    let id = nextId.val;
    let record : HQRecord = {
      id          = id;
      name        = input.name;
      territoryId = input.territoryId;
      isActive    = true;
      createdAt   = now;
    };
    hqs.add(id, record);
    nextId.val += 1;
    #ok
  };

  public func updateHQ(
    hqs   : Map.Map<LocationId, HQRecord>,
    id    : LocationId,
    input : UpdateHQInput,
  ) : MutationResult {
    switch (hqs.get(id)) {
      case null { #err("HQ not found") };
      case (?h) {
        hqs.add(id, {
          h with
          name        = switch (input.name)        { case (?v) v; case null h.name };
          territoryId = switch (input.territoryId) { case (?v) v; case null h.territoryId };
        });
        #ok
      };
    }
  };

  public func deactivateHQ(
    hqs : Map.Map<LocationId, HQRecord>,
    id  : LocationId,
  ) : MutationResult {
    switch (hqs.get(id)) {
      case null { #err("HQ not found") };
      case (?h) {
        hqs.add(id, { h with isActive = false });
        #ok
      };
    }
  };

  public func listHQsByTerritory(
    hqs         : Map.Map<LocationId, HQRecord>,
    territoryId : LocationId,
  ) : [HQRecord] {
    let result = List.empty<HQRecord>();
    for ((_, h) in hqs.entries()) {
      if (h.territoryId == territoryId) { result.add(h) }
    };
    result.toArray()
  };

  public func listActiveHQsByTerritory(
    hqs         : Map.Map<LocationId, HQRecord>,
    territoryId : LocationId,
  ) : [HQRecord] {
    let result = List.empty<HQRecord>();
    for ((_, h) in hqs.entries()) {
      if (h.territoryId == territoryId and h.isActive) { result.add(h) }
    };
    result.toArray()
  };

  // ── Area CRUD ─────────────────────────────────────────────────────────────

  public func addArea(
    areas  : Map.Map<LocationId, AreaRecord>,
    nextId : { var val : Nat },
    input  : CreateAreaInput,
    now    : Int,
  ) : MutationResult {
    let id = nextId.val;
    let record : AreaRecord = {
      id        = id;
      name      = input.name;
      hqId      = input.hqId;
      isActive  = true;
      createdAt = now;
    };
    areas.add(id, record);
    nextId.val += 1;
    #ok
  };

  public func updateArea(
    areas : Map.Map<LocationId, AreaRecord>,
    id    : LocationId,
    input : UpdateAreaInput,
  ) : MutationResult {
    switch (areas.get(id)) {
      case null { #err("Area not found") };
      case (?a) {
        areas.add(id, {
          a with
          name = switch (input.name) { case (?v) v; case null a.name };
          hqId = switch (input.hqId) { case (?v) v; case null a.hqId };
        });
        #ok
      };
    }
  };

  public func deactivateArea(
    areas : Map.Map<LocationId, AreaRecord>,
    id    : LocationId,
  ) : MutationResult {
    switch (areas.get(id)) {
      case null { #err("Area not found") };
      case (?a) {
        areas.add(id, { a with isActive = false });
        #ok
      };
    }
  };

  public func listAreasByHQ(
    areas : Map.Map<LocationId, AreaRecord>,
    hqId  : LocationId,
  ) : [AreaRecord] {
    let result = List.empty<AreaRecord>();
    for ((_, a) in areas.entries()) {
      if (a.hqId == hqId) { result.add(a) }
    };
    result.toArray()
  };

  public func listActiveAreasByHQ(
    areas : Map.Map<LocationId, AreaRecord>,
    hqId  : LocationId,
  ) : [AreaRecord] {
    let result = List.empty<AreaRecord>();
    for ((_, a) in areas.entries()) {
      if (a.hqId == hqId and a.isActive) { result.add(a) }
    };
    result.toArray()
  };

  public func listAllAreas(areas : Map.Map<LocationId, AreaRecord>) : [AreaRecord] {
    let result = List.empty<AreaRecord>();
    for ((_, a) in areas.entries()) { result.add(a) };
    result.toArray()
  };

  public func listAllActiveAreas(areas : Map.Map<LocationId, AreaRecord>) : [AreaRecord] {
    let result = List.empty<AreaRecord>();
    for ((_, a) in areas.entries()) {
      if (a.isActive) { result.add(a) }
    };
    result.toArray()
  };

  // ── Station CRUD ──────────────────────────────────────────────────────────

  /// Add a new Station. Validates unique name within the same HQ.
  public func addStation(
    stations      : Map.Map<LocationId, StationRecord>,
    nextStationId : { var val : Nat },
    input         : CreateStationInput,
    now           : Int,
  ) : MutationResult {
    // Reject duplicate name under same HQ (case-insensitive)
    let lower = input.stationName.toLower().trim(#predicate(func c = c == ' '));
    for ((_, s) in stations.entries()) {
      if (
        s.hqId == input.hqId and
        s.isActive and
        s.stationName.toLower().trim(#predicate(func c = c == ' ')) == lower
      ) {
        return #err("Station '" # input.stationName # "' already exists under this HQ");
      };
    };
    let id = nextStationId.val;
    nextStationId.val += 1;
    let record : StationRecord = {
      stationId   = id;
      stationName = input.stationName;
      hqId        = input.hqId;
      createdAt   = now;
      updatedAt   = now;
      isActive    = true;
    };
    stations.add(id, record);
    #ok
  };

  /// Update a Station's name (hqId is immutable). Soft-reactivates if isActive=?true.
  public func updateStation(
    stations  : Map.Map<LocationId, StationRecord>,
    stationId : LocationId,
    input     : UpdateStationInput,
    now       : Int,
  ) : ?StationRecord {
    switch (stations.get(stationId)) {
      case null { null };
      case (?s) {
        let updated : StationRecord = {
          stationId   = s.stationId;
          stationName = switch (input.stationName) { case (?n) n; case null s.stationName };
          hqId        = s.hqId;  // hqId is immutable
          createdAt   = s.createdAt;
          updatedAt   = now;
          isActive    = switch (input.isActive) { case (?v) v; case null s.isActive };
        };
        stations.add(stationId, updated);
        ?updated
      };
    }
  };

  /// Soft-delete a station by setting isActive = false.
  public func deleteStation(
    stations  : Map.Map<LocationId, StationRecord>,
    stationId : LocationId,
    now       : Int,
  ) : Bool {
    switch (stations.get(stationId)) {
      case null { false };
      case (?s) {
        stations.add(stationId, {
          stationId   = s.stationId;
          stationName = s.stationName;
          hqId        = s.hqId;
          createdAt   = s.createdAt;
          updatedAt   = now;
          isActive    = false;
        });
        true
      };
    }
  };

  /// List all active stations under a given HQ.
  public func listStationsByHQ(
    stations : Map.Map<LocationId, StationRecord>,
    hqId     : LocationId,
  ) : [StationRecord] {
    let result = List.empty<StationRecord>();
    for ((_, s) in stations.entries()) {
      if (s.hqId == hqId and s.isActive) { result.add(s) }
    };
    result.toArray()
  };

  /// List all active stations across all HQs (Admin overview).
  public func listAllStations(stations : Map.Map<LocationId, StationRecord>) : [StationRecord] {
    let result = List.empty<StationRecord>();
    for ((_, s) in stations.entries()) {
      if (s.isActive) { result.add(s) }
    };
    result.toArray()
  };

  /// Traverse Station → HQ → Territory to return the Territory records
  /// associated with a given Station.
  /// Chain: StationRecord.hqId → HQRecord.territoryId → TerritoryRecord.
  /// Returns [territory] if the Territory is active, otherwise [].
  public func listTerritoriesByStation(
    stations    : Map.Map<LocationId, StationRecord>,
    hqs         : Map.Map<LocationId, HQRecord>,
    territories : Map.Map<LocationId, TerritoryRecord>,
    stationId   : LocationId,
  ) : [TerritoryRecord] {
    // Step 1: look up the Station to get its hqId
    let hqId = switch (stations.get(stationId)) {
      case null { return [] };
      case (?s) { s.hqId };
    };
    // Step 2: look up the HQ to get its territoryId
    let territoryId = switch (hqs.get(hqId)) {
      case null { return [] };
      case (?h) { h.territoryId };
    };
    // Step 3: look up the Territory and check isActive
    switch (territories.get(territoryId)) {
      case null { [] };
      case (?t) {
        if (t.isActive) { [t] } else { [] }
      };
    }
  };

  // ── No-auth cascade helpers (for dropdown population without token) ─────────

  /// Return all active zones (no auth required — for dropdown population).
  public func listAllZonesPublic(zones : Map.Map<LocationId, ZoneRecord>) : [ZoneRecord] {
    listActiveZones(zones)
  };

  /// Return active Regions (States) under a Zone (no auth required).
  public func listRegionsByZonePublic(
    states : Map.Map<LocationId, StateRecord>,
    zoneId : LocationId,
  ) : [StateRecord] {
    listActiveStatesByZone(states, zoneId)
  };

  /// Return active Areas (Territories) under a Region/State (no auth required).
  public func listAreasByRegionPublic(
    territories : Map.Map<LocationId, TerritoryRecord>,
    regionId    : LocationId,
  ) : [TerritoryRecord] {
    listActiveTerritories(territories, regionId)
  };

  /// Return active Stations (HQs) under an Area/Territory (no auth required).
  public func listStationsByAreaPublic(
    hqs    : Map.Map<LocationId, HQRecord>,
    areaId : LocationId,
  ) : [HQRecord] {
    listActiveHQsByTerritory(hqs, areaId)
  };

  /// Return active Territories (Areas) under a Station/HQ (no auth required).
  public func listTerritoriesByStationPublic(
    areas     : Map.Map<LocationId, AreaRecord>,
    stationId : LocationId,
  ) : [AreaRecord] {
    listActiveAreasByHQ(areas, stationId)
  };

  // ── Bulk Station Import ────────────────────────────────────────────────────

  /// Bulk-import stations from an array of (stationName, hqName) rows.
  /// Looks up each HQ by name (case-insensitive).
  /// Validates non-empty station name and no duplicate name+HQ.
  /// uploadedByName: display name of the Admin who triggered the import.
  public func bulkImportStations(
    stations      : Map.Map<LocationId, StationRecord>,
    hqs           : Map.Map<LocationId, HQRecord>,
    nextStationId : { var val : Nat },
    rows          : [BulkStationImportInput],
    uploadedByName : Text,
    now           : Int,
  ) : BulkStationImportResult {
    let rowResults = List.empty<BulkStationImportRowResult>();
    var savedCount : Nat = 0;
    var skippedCount : Nat = 0;

    for (i in rows.keys()) {
      let row = rows[i];
      let rowIdx = i + 1;

      // Validate non-empty station name
      if (row.stationName == "") {
        rowResults.add({
          rowIndex    = rowIdx;
          stationName = row.stationName;
          hqName      = row.hqName;
          status      = #error;
          errorReason = ?"Station name is required";
        });
        skippedCount += 1;
      } else {
        // Find HQ by name (case-insensitive)
        let stationNameLower = row.stationName.toLower().trim(#predicate(func c = c == ' '));
        let hqNameLower = row.hqName.toLower().trim(#predicate(func c = c == ' '));
        var foundHqId : ?LocationId = null;
        for ((hId, hq) in hqs.entries()) {
          if (hq.name.toLower().trim(#predicate(func c = c == ' ')) == hqNameLower and hq.isActive) {
            foundHqId := ?hId;
          };
        };

        switch (foundHqId) {
          case null {
            rowResults.add({
              rowIndex    = rowIdx;
              stationName = row.stationName;
              hqName      = row.hqName;
              status      = #error;
              errorReason = ?("HQ not found: " # row.hqName);
            });
            skippedCount += 1;
          };
          case (?hqId) {
            // Check for duplicate station name within same HQ
            var duplicate = false;
            for ((_, st) in stations.entries()) {
              if (st.hqId == hqId and st.stationName.toLower().trim(#predicate(func c = c == ' ')) == stationNameLower) {
                duplicate := true;
              };
            };

            if (duplicate) {
              rowResults.add({
                rowIndex    = rowIdx;
                stationName = row.stationName;
                hqName      = row.hqName;
                status      = #error;
                errorReason = ?("Duplicate station: " # row.stationName # " already exists under HQ " # row.hqName);
              });
              skippedCount += 1;
            } else {
              let stId = nextStationId.val;
              stations.add(stId, {
                stationId   = stId;
                stationName = row.stationName;
                hqId        = hqId;
                createdAt   = now;
                updatedAt   = now;
                isActive    = true;
              });
              nextStationId.val += 1;
              rowResults.add({
                rowIndex    = rowIdx;
                stationName = row.stationName;
                hqName      = row.hqName;
                status      = #ok;
                errorReason = null;
              });
              savedCount += 1;
            };
          };
        };
      };
    };

    {
      totalRows   = rows.size();
      saved       = savedCount;
      skipped     = skippedCount;
      rowResults  = rowResults.toArray();
      uploadedBy  = uploadedByName;
      uploadedAt  = now;
    }
  };

  /// Return the stored bulk station import history list as an array.
  public func listStationBulkUploadHistory(
    history : List.List<BulkStationImportResult>,
  ) : [BulkStationImportResult] {
    history.toArray()
  };
};
