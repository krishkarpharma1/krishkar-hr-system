import Types "../types/location-master";
import AuthTypes "../types/auth-users";
import Lib "../lib/location-master";
import Map "mo:core/Map";
import List "mo:core/List";
import Time "mo:core/Time";

/// Public API mixin for Location Master domain.
/// Exposes CRUD for Zone → State → Territory → HQ → Area → Station hierarchy.
mixin (
  sessions      : Map.Map<Text, AuthTypes.Session>,
  zones         : Map.Map<Types.LocationId, Types.ZoneRecord>,
  states        : Map.Map<Types.LocationId, Types.StateRecord>,
  territories   : Map.Map<Types.LocationId, Types.TerritoryRecord>,
  hqs           : Map.Map<Types.LocationId, Types.HQRecord>,
  areas         : Map.Map<Types.LocationId, Types.AreaRecord>,
  stations      : Map.Map<Types.LocationId, Types.StationRecord>,
  nextZoneId    : { var val : Nat },
  nextStateId   : { var val : Nat },
  nextTerrId    : { var val : Nat },
  nextHQId      : { var val : Nat },
  nextAreaId    : { var val : Nat },
  nextStationId : { var val : Nat },
  users         : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
  stationBulkHistory : List.List<Types.BulkStationImportResult>,
) {

  // ── Auth helpers (local) ──────────────────────────────────────────────────

  private func isAdmin(token : Text) : Bool {
    switch (sessions.get(token)) {
      case null { false };
      case (?s) { s.role == #Admin };
    }
  };

  private func isAuthenticated(token : Text) : Bool {
    switch (sessions.get(token)) {
      case null { false };
      case (?_) { true };
    }
  };

  // ── Zone endpoints ────────────────────────────────────────────────────────

  public func addZone(token : Text, input : Types.CreateZoneInput) : async Types.MutationResult {
    if (not isAdmin(token)) { return #err("Unauthorized: Admin role required") };
    Lib.addZone(zones, nextZoneId, input, Time.now())
  };

  public func updateZone(token : Text, id : Types.LocationId, input : Types.UpdateZoneInput) : async Types.MutationResult {
    if (not isAdmin(token)) { return #err("Unauthorized: Admin role required") };
    Lib.updateZone(zones, id, input)
  };

  public func deactivateZone(token : Text, id : Types.LocationId) : async Types.MutationResult {
    if (not isAdmin(token)) { return #err("Unauthorized: Admin role required") };
    Lib.deactivateZone(zones, id)
  };

  public query func listZones(token : Text) : async [Types.ZoneRecord] {
    if (not isAuthenticated(token)) { return [] };
    Lib.listZones(zones)
  };

  public query func listActiveZones(token : Text) : async [Types.ZoneRecord] {
    if (not isAuthenticated(token)) { return [] };
    Lib.listActiveZones(zones)
  };

  // ── State endpoints ───────────────────────────────────────────────────────

  public func addState(token : Text, input : Types.CreateStateInput) : async Types.MutationResult {
    if (not isAdmin(token)) { return #err("Unauthorized: Admin role required") };
    Lib.addState(states, nextStateId, input, Time.now())
  };

  public func updateState(token : Text, id : Types.LocationId, input : Types.UpdateStateInput) : async Types.MutationResult {
    if (not isAdmin(token)) { return #err("Unauthorized: Admin role required") };
    Lib.updateState(states, id, input)
  };

  public func deactivateState(token : Text, id : Types.LocationId) : async Types.MutationResult {
    if (not isAdmin(token)) { return #err("Unauthorized: Admin role required") };
    Lib.deactivateState(states, id)
  };

  public query func listStatesByZone(token : Text, zoneId : Types.LocationId) : async [Types.StateRecord] {
    if (not isAuthenticated(token)) { return [] };
    Lib.listStatesByZone(states, zoneId)
  };

  public query func listActiveStatesByZone(token : Text, zoneId : Types.LocationId) : async [Types.StateRecord] {
    if (not isAuthenticated(token)) { return [] };
    Lib.listActiveStatesByZone(states, zoneId)
  };

  // ── Territory endpoints ───────────────────────────────────────────────────

  public func addTerritory(token : Text, input : Types.CreateTerritoryInput) : async Types.MutationResult {
    if (not isAdmin(token)) { return #err("Unauthorized: Admin role required") };
    Lib.addTerritory(territories, nextTerrId, input, Time.now())
  };

  public func updateTerritory(token : Text, id : Types.LocationId, input : Types.UpdateTerritoryInput) : async Types.MutationResult {
    if (not isAdmin(token)) { return #err("Unauthorized: Admin role required") };
    Lib.updateTerritory(territories, id, input)
  };

  public func deactivateTerritory(token : Text, id : Types.LocationId) : async Types.MutationResult {
    if (not isAdmin(token)) { return #err("Unauthorized: Admin role required") };
    Lib.deactivateTerritory(territories, id)
  };

  public query func listTerritoriesByState(token : Text, stateId : Types.LocationId) : async [Types.TerritoryRecord] {
    if (not isAuthenticated(token)) { return [] };
    Lib.listTerritoriesByState(territories, stateId)
  };

  public query func listActiveTerritories(token : Text, stateId : Types.LocationId) : async [Types.TerritoryRecord] {
    if (not isAuthenticated(token)) { return [] };
    Lib.listActiveTerritories(territories, stateId)
  };

  // ── HQ endpoints ──────────────────────────────────────────────────────────

  public func addHQ(token : Text, input : Types.CreateHQInput) : async Types.MutationResult {
    if (not isAdmin(token)) { return #err("Unauthorized: Admin role required") };
    Lib.addHQ(hqs, nextHQId, input, Time.now())
  };

  public func updateHQ(token : Text, id : Types.LocationId, input : Types.UpdateHQInput) : async Types.MutationResult {
    if (not isAdmin(token)) { return #err("Unauthorized: Admin role required") };
    Lib.updateHQ(hqs, id, input)
  };

  public func deactivateHQ(token : Text, id : Types.LocationId) : async Types.MutationResult {
    if (not isAdmin(token)) { return #err("Unauthorized: Admin role required") };
    Lib.deactivateHQ(hqs, id)
  };

  public query func listHQsByTerritory(token : Text, territoryId : Types.LocationId) : async [Types.HQRecord] {
    if (not isAuthenticated(token)) { return [] };
    Lib.listHQsByTerritory(hqs, territoryId)
  };

  public query func listActiveHQsByTerritory(token : Text, territoryId : Types.LocationId) : async [Types.HQRecord] {
    if (not isAuthenticated(token)) { return [] };
    Lib.listActiveHQsByTerritory(hqs, territoryId)
  };

  // ── Area endpoints ────────────────────────────────────────────────────────

  public func addArea(token : Text, input : Types.CreateAreaInput) : async Types.MutationResult {
    if (not isAdmin(token)) { return #err("Unauthorized: Admin role required") };
    Lib.addArea(areas, nextAreaId, input, Time.now())
  };

  public func updateArea(token : Text, id : Types.LocationId, input : Types.UpdateAreaInput) : async Types.MutationResult {
    if (not isAdmin(token)) { return #err("Unauthorized: Admin role required") };
    Lib.updateArea(areas, id, input)
  };

  public func deactivateArea(token : Text, id : Types.LocationId) : async Types.MutationResult {
    if (not isAdmin(token)) { return #err("Unauthorized: Admin role required") };
    Lib.deactivateArea(areas, id)
  };

  public query func listAreasByHQ(token : Text, hqId : Types.LocationId) : async [Types.AreaRecord] {
    if (not isAuthenticated(token)) { return [] };
    Lib.listAreasByHQ(areas, hqId)
  };

  public query func listActiveAreasByHQ(token : Text, hqId : Types.LocationId) : async [Types.AreaRecord] {
    if (not isAuthenticated(token)) { return [] };
    Lib.listActiveAreasByHQ(areas, hqId)
  };

  public query func listAllAreas(token : Text) : async [Types.AreaRecord] {
    if (not isAuthenticated(token)) { return [] };
    Lib.listAllAreas(areas)
  };

  public query func listAllActiveAreas(token : Text) : async [Types.AreaRecord] {
    if (not isAuthenticated(token)) { return [] };
    Lib.listAllActiveAreas(areas)
  };

  // ── Flat list queries (no parent filter) — for HR/Admin multi-select ────────

  /// List all zones regardless of parent — for HR/Admin role population.
  public query func getAllZones(token : Text) : async [Types.ZoneRecord] {
    if (not isAuthenticated(token)) { return [] };
    Lib.listZones(zones)
  };

  /// List all active zones — for dropdown population.
  public query func getAllActiveZones(token : Text) : async [Types.ZoneRecord] {
    if (not isAuthenticated(token)) { return [] };
    Lib.listActiveZones(zones)
  };

  /// List all states regardless of zone — for HR/Admin role population.
  public query func getAllStates(token : Text) : async [Types.StateRecord] {
    if (not isAuthenticated(token)) { return [] };
    Lib.listAllStates(states)
  };

  /// List all active states — for dropdown population.
  public query func getAllActiveStates(token : Text) : async [Types.StateRecord] {
    if (not isAuthenticated(token)) { return [] };
    Lib.listAllActiveStates(states)
  };

  /// List all territories regardless of state — for RSM/Admin role population.
  public query func getAllTerritories(token : Text) : async [Types.TerritoryRecord] {
    if (not isAuthenticated(token)) { return [] };
    Lib.listAllTerritories(territories)
  };

  /// List all active territories — for dropdown population.
  public query func getAllActiveTerritories(token : Text) : async [Types.TerritoryRecord] {
    if (not isAuthenticated(token)) { return [] };
    Lib.listAllActiveTerritories(territories)
  };

  /// List all HQs regardless of territory — for ASM/Admin role population.
  public query func getAllHQs(token : Text) : async [Types.HQRecord] {
    if (not isAuthenticated(token)) { return [] };
    Lib.listAllHQs(hqs)
  };

  /// List all active HQs — for dropdown population.
  public query func getAllActiveHQs(token : Text) : async [Types.HQRecord] {
    if (not isAuthenticated(token)) { return [] };
    Lib.listAllActiveHQs(hqs)
  };

  // ── Station endpoints ─────────────────────────────────────────────────────

  /// Create a new Station under a given HQ. Admin only.
  /// Validates unique name within the same HQ.
  public func createStation(token : Text, input : Types.CreateStationInput) : async Types.MutationResult {
    if (not isAdmin(token)) { return #err("Unauthorized: Admin role required") };
    Lib.addStation(stations, nextStationId, input, Time.now())
  };

  /// Update a Station's name or active status. Admin only.
  /// hqId is immutable — cannot be changed.
  public func updateStation(token : Text, stationId : Types.LocationId, input : Types.UpdateStationInput) : async Types.MutationResult {
    if (not isAdmin(token)) { return #err("Unauthorized: Admin role required") };
    switch (Lib.updateStation(stations, stationId, input, Time.now())) {
      case null { #err("Station not found") };
      case (?_) { #ok };
    }
  };

  /// Soft-delete a station (sets isActive = false). Admin only.
  public func deleteStation(token : Text, stationId : Types.LocationId) : async Bool {
    if (not isAdmin(token)) { return false };
    Lib.deleteStation(stations, stationId, Time.now())
  };

  /// List all active stations under a given HQ. Authenticated users only.
  public query func listStationsByHQ(token : Text, hqId : Types.LocationId) : async [Types.StationRecord] {
    if (not isAuthenticated(token)) { return [] };
    Lib.listStationsByHQ(stations, hqId)
  };

  /// List all active stations across all HQs. Admin/HR overview.
  public query func listAllStations(token : Text) : async [Types.StationRecord] {
    if (not isAuthenticated(token)) { return [] };
    Lib.listAllStations(stations)
  };

  // ── Bulk Station Import ────────────────────────────────────────────────────

  /// Bulk-import stations from an array of (stationName, hqName) rows. Admin only.
  /// Looks up each HQ by name (case-insensitive), validates uniqueness, creates stations.
  /// Stores a history record for the import session.
  public shared func bulkImportStations(
    token : Text,
    rows  : [Types.BulkStationImportInput],
  ) : async Types.BulkStationImportResult {
    if (not isAdmin(token)) {
      return {
        totalRows  = rows.size();
        saved      = 0;
        skipped    = rows.size();
        rowResults = [];
        uploadedBy = "";
        uploadedAt = 0;
      }
    };
    let uploaderName = switch (sessions.get(token)) {
      case (?s) {
        switch (users.get(s.userId)) {
          case (?u) u.name;
          case null "Admin";
        }
      };
      case null "Admin";
    };
    let result = Lib.bulkImportStations(stations, hqs, nextStationId, rows, uploaderName, Time.now());
    stationBulkHistory.add(result);
    result
  };

  /// List all past bulk station import history records. Admin only.
  public query func listStationBulkUploadHistory(token : Text) : async [Types.BulkStationImportResult] {
    if (not isAdmin(token)) { return [] };
    Lib.listStationBulkUploadHistory(stationBulkHistory)
  };
};
