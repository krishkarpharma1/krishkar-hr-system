import Types "../types/location-hq";
import AuthTypes "../types/auth-users";
import LocTypes "../types/location-master";
import Map "mo:core/Map";
import List "mo:core/List";

module {
  public type LocationId          = Types.LocationId;
  public type UserId              = Types.UserId;
  public type Role                = Types.Role;
  public type LocationLevel       = Types.LocationLevel;
  public type LocationHierarchyPath = Types.LocationHierarchyPath;
  public type PrimaryHqInfo       = Types.PrimaryHqInfo;
  public type InvalidHqEmployee   = Types.InvalidHqEmployee;
  public type UserWithPrimaryHq   = Types.UserWithPrimaryHq;

  // ── Role → expected HQ level mapping ─────────────────────────────────────

  /// Return the expected LocationLevel for a given role.
  /// Admin and HRManager do not have a required level (returns null).
  public func expectedLevelForRole(role : Role) : ?LocationLevel {
    switch (role) {
      case (#ZSM)       { ?#Zone    };
      case (#RSM)       { ?#Region  };
      case (#ASM)       { ?#Area    };
      case (#MR)        { ?#Station };
      case (#Admin)     { null };
      case (#HRManager) { null };
    }
  };

  /// Convert a LocationLevel to a display text.
  public func levelToText(level : LocationLevel) : Text {
    switch (level) {
      case (#Zone)    { "Zone"    };
      case (#Region)  { "Region"  };
      case (#Area)    { "Area"    };
      case (#Station) { "Station" };
    }
  };

  /// Convert a Role to a display text.
  public func roleToText(role : Role) : Text {
    switch (role) {
      case (#Admin)     { "Admin"      };
      case (#HRManager) { "HR Manager" };
      case (#ZSM)       { "ZSM"        };
      case (#RSM)       { "RSM"        };
      case (#ASM)       { "ASM"        };
      case (#MR)        { "MR"         };
    }
  };

  // ── Level detection helpers ───────────────────────────────────────────────

  /// Determine the LocationLevel of a given location ID by checking all
  /// level maps in order: Zone → Region (State) → Area → Station.
  /// The existing 6-level system maps as: Zone=Zone, State=Region, Area=Area, Station=Station.
  /// Territory and HQ records are treated as internal sub-levels (not used for primaryHqId).
  public func detectLevel(
    locationId  : LocationId,
    zones       : Map.Map<LocationId, LocTypes.ZoneRecord>,
    states      : Map.Map<LocationId, LocTypes.StateRecord>,
    areas       : Map.Map<LocationId, LocTypes.AreaRecord>,
    stations    : Map.Map<LocationId, LocTypes.StationRecord>,
  ) : ?LocationLevel {
    if (zones.containsKey(locationId))    { return ?#Zone    };
    if (states.containsKey(locationId))   { return ?#Region  };
    if (areas.containsKey(locationId))    { return ?#Area    };
    if (stations.containsKey(locationId)) { return ?#Station };
    null
  };

  /// Resolve the display name of a location ID across all level maps.
  public func resolveName(
    locationId  : LocationId,
    zones       : Map.Map<LocationId, LocTypes.ZoneRecord>,
    states      : Map.Map<LocationId, LocTypes.StateRecord>,
    areas       : Map.Map<LocationId, LocTypes.AreaRecord>,
    stations    : Map.Map<LocationId, LocTypes.StationRecord>,
  ) : Text {
    switch (zones.get(locationId)) {
      case (?r) { return r.name };
      case null {};
    };
    switch (states.get(locationId)) {
      case (?r) { return r.name };
      case null {};
    };
    switch (areas.get(locationId)) {
      case (?r) { return r.name };
      case null {};
    };
    switch (stations.get(locationId)) {
      case (?r) { return r.stationName };
      case null {};
    };
    ""
  };

  // ── getLocationsByLevel ───────────────────────────────────────────────────

  /// Return all active locations at the given level.
  public func getLocationsByLevel(
    level    : LocationLevel,
    zones    : Map.Map<LocationId, LocTypes.ZoneRecord>,
    states   : Map.Map<LocationId, LocTypes.StateRecord>,
    areas    : Map.Map<LocationId, LocTypes.AreaRecord>,
    stations : Map.Map<LocationId, LocTypes.StationRecord>,
  ) : [PrimaryHqInfo] {
    let result = List.empty<PrimaryHqInfo>();
    switch (level) {
      case (#Zone) {
        for ((id, r) in zones.entries()) {
          if (r.isActive) { result.add({ id; name = r.name; level = #Zone }) };
        };
      };
      case (#Region) {
        for ((id, r) in states.entries()) {
          if (r.isActive) { result.add({ id; name = r.name; level = #Region }) };
        };
      };
      case (#Area) {
        for ((id, r) in areas.entries()) {
          if (r.isActive) { result.add({ id; name = r.name; level = #Area }) };
        };
      };
      case (#Station) {
        for ((id, r) in stations.entries()) {
          if (r.isActive) { result.add({ id; name = r.stationName; level = #Station }) };
        };
      };
    };
    result.toArray()
  };

  // ── getLocationsForRole ───────────────────────────────────────────────────

  /// Return all active locations at the level appropriate for the given role.
  /// Admin and HRManager: returns empty (no required HQ level).
  public func getLocationsForRole(
    role     : Role,
    zones    : Map.Map<LocationId, LocTypes.ZoneRecord>,
    states   : Map.Map<LocationId, LocTypes.StateRecord>,
    areas    : Map.Map<LocationId, LocTypes.AreaRecord>,
    stations : Map.Map<LocationId, LocTypes.StationRecord>,
  ) : [PrimaryHqInfo] {
    switch (expectedLevelForRole(role)) {
      case null    { [] };
      case (?level) { getLocationsByLevel(level, zones, states, areas, stations) };
    }
  };

  // ── getLocationHierarchy ──────────────────────────────────────────────────

  /// Build the full hierarchy path for any location ID.
  /// Maps: Zone→Zone, State→Region, Area→Area, Station→Station.
  /// Traverses parent links upward to fill in Zone/Region/Area/Station fields.
  public func getLocationHierarchy(
    locationId   : LocationId,
    zones        : Map.Map<LocationId, LocTypes.ZoneRecord>,
    states       : Map.Map<LocationId, LocTypes.StateRecord>,
    territories  : Map.Map<LocationId, LocTypes.TerritoryRecord>,
    hqs          : Map.Map<LocationId, LocTypes.HQRecord>,
    areas        : Map.Map<LocationId, LocTypes.AreaRecord>,
    stations     : Map.Map<LocationId, LocTypes.StationRecord>,
  ) : ?LocationHierarchyPath {
    // Determine the level of the provided location
    if (zones.containsKey(locationId)) {
      // Zone level
      let zoneName = switch (zones.get(locationId)) { case (?r) r.name; case null "" };
      return ?{
        locationId   = locationId;
        locationName = zoneName;
        level        = #Zone;
        zoneId       = ?locationId;
        zoneName     = ?zoneName;
        regionId     = null;
        regionName   = null;
        areaId       = null;
        areaName     = null;
        stationId    = null;
        stationName  = null;
      };
    };

    if (states.containsKey(locationId)) {
      // Region (State) level — parent is Zone
      switch (states.get(locationId)) {
        case null { return null };
        case (?s) {
          let zoneName = switch (zones.get(s.zoneId)) { case (?r) ?r.name; case null null };
          return ?{
            locationId   = locationId;
            locationName = s.name;
            level        = #Region;
            zoneId       = ?s.zoneId;
            zoneName     = zoneName;
            regionId     = ?locationId;
            regionName   = ?s.name;
            areaId       = null;
            areaName     = null;
            stationId    = null;
            stationName  = null;
          };
        };
      };
    };

    if (areas.containsKey(locationId)) {
      // Area level — parent chain: Area → HQ → Territory → State → Zone
      switch (areas.get(locationId)) {
        case null { return null };
        case (?a) {
          // Walk up: Area → HQ → Territory → State → Zone
          var zoneId   : ?LocationId = null;
          var zoneName : ?Text       = null;
          var regionId : ?LocationId = null;
          var regionNm : ?Text       = null;
          switch (hqs.get(a.hqId)) {
            case (?hq) {
              switch (territories.get(hq.territoryId)) {
                case (?terr) {
                  regionId := ?terr.stateId;
                  switch (states.get(terr.stateId)) {
                    case (?st) {
                      regionNm := ?st.name;
                      zoneId   := ?st.zoneId;
                      switch (zones.get(st.zoneId)) {
                        case (?z) { zoneName := ?z.name };
                        case null {};
                      };
                    };
                    case null {};
                  };
                };
                case null {};
              };
            };
            case null {};
          };
          return ?{
            locationId   = locationId;
            locationName = a.name;
            level        = #Area;
            zoneId       = zoneId;
            zoneName     = zoneName;
            regionId     = regionId;
            regionName   = regionNm;
            areaId       = ?locationId;
            areaName     = ?a.name;
            stationId    = null;
            stationName  = null;
          };
        };
      };
    };

    if (stations.containsKey(locationId)) {
      // Station level — parent chain: Station → HQ → Territory → State → Zone
      switch (stations.get(locationId)) {
        case null { return null };
        case (?st) {
          var zoneId   : ?LocationId = null;
          var zoneName : ?Text       = null;
          var regionId : ?LocationId = null;
          var regionNm : ?Text       = null;
          var areaId   : ?LocationId = null;
          var areaNm   : ?Text       = null;
          switch (hqs.get(st.hqId)) {
            case (?hq) {
              switch (territories.get(hq.territoryId)) {
                case (?terr) {
                  regionId := ?terr.stateId;
                  switch (states.get(terr.stateId)) {
                    case (?s) {
                      regionNm := ?s.name;
                      zoneId   := ?s.zoneId;
                      switch (zones.get(s.zoneId)) {
                        case (?z) { zoneName := ?z.name };
                        case null {};
                      };
                    };
                    case null {};
                  };
                };
                case null {};
              };
              // Find an area that belongs to this HQ (first active one)
              for ((aid, ar) in areas.entries()) {
                if (ar.hqId == st.hqId and ar.isActive and areaId == null) {
                  areaId := ?aid;
                  areaNm := ?ar.name;
                };
              };
            };
            case null {};
          };
          return ?{
            locationId   = locationId;
            locationName = st.stationName;
            level        = #Station;
            zoneId       = zoneId;
            zoneName     = zoneName;
            regionId     = regionId;
            regionName   = regionNm;
            areaId       = areaId;
            areaName     = areaNm;
            stationId    = ?locationId;
            stationName  = ?st.stationName;
          };
        };
      };
    };

    null
  };

  // ── getEmployeesByHq ──────────────────────────────────────────────────────

  /// Return all employees whose primaryHqId matches the given hqId.
  public func getEmployeesByHq(
    users    : Map.Map<UserId, AuthTypes.UserRecord>,
    hqId     : LocationId,
    zones    : Map.Map<LocationId, LocTypes.ZoneRecord>,
    states   : Map.Map<LocationId, LocTypes.StateRecord>,
    areas    : Map.Map<LocationId, LocTypes.AreaRecord>,
    stations : Map.Map<LocationId, LocTypes.StationRecord>,
  ) : [UserWithPrimaryHq] {
    let result = List.empty<UserWithPrimaryHq>();
    let hqName = resolveName(hqId, zones, states, areas, stations);
    for ((_, u) in users.entries()) {
      switch (u.primaryHqId) {
        case (?pid) {
          if (pid == hqId) {
            result.add({
              userId      = u.id;
              employeeId  = u.employeeId;
              name        = u.name;
              role        = roleToText(u.role);
              primaryHqId = ?pid;
              hqName      = hqName;
            });
          };
        };
        case null {};
      };
    };
    result.toArray()
  };

  // ── getSubordinatesInHierarchy ────────────────────────────────────────────

  /// Return IDs of all employees within a manager's location hierarchy scope.
  /// Combines reporting-manager BFS (already in auth-users) with HQ-level scoping:
  /// employees whose primaryHqId falls within the manager's HQ subtree are included.
  /// This is an additive scope — it adds HQ-scoped employees on top of the
  /// standard reporting-manager BFS already available in lib/auth-users.
  public func getSubordinatesInHierarchy(
    users       : Map.Map<UserId, AuthTypes.UserRecord>,
    managerId   : UserId,
    zones       : Map.Map<LocationId, LocTypes.ZoneRecord>,
    states      : Map.Map<LocationId, LocTypes.StateRecord>,
    territories : Map.Map<LocationId, LocTypes.TerritoryRecord>,
    hqs         : Map.Map<LocationId, LocTypes.HQRecord>,
    areas       : Map.Map<LocationId, LocTypes.AreaRecord>,
    stations    : Map.Map<LocationId, LocTypes.StationRecord>,
  ) : [UserId] {
    switch (users.get(managerId)) {
      case null { [] };
      case (?mgr) {
        let mgrHqId = mgr.primaryHqId;
        let mgrLevel = switch (mgrHqId) {
          case null    { null };
          case (?hqId) { detectLevel(hqId, zones, states, areas, stations) };
        };

        let result = List.empty<UserId>();
        let seen   = List.empty<UserId>();

        for ((uid, u) in users.entries()) {
          if (uid != managerId) {
            // Check reporting chain membership
            var inChain = false;
            var cur : ?UserId = u.reportsTo;
            var hops : Nat = 0;
            label chainWalk loop {
              if (hops >= 20) { break chainWalk };
              switch (cur) {
                case null { break chainWalk };
                case (?mid) {
                  if (mid == managerId) { inChain := true; break chainWalk };
                  switch (users.get(mid)) {
                    case null { break chainWalk };
                    case (?m) { cur := m.reportsTo; hops += 1 };
                  };
                };
              };
            };

            if (inChain) {
              if (not seen.contains(uid)) {
                seen.add(uid);
                result.add(uid);
              };
            } else {
              // Check HQ hierarchy scope
              switch (mgrHqId, mgrLevel, u.primaryHqId) {
                case (?mhq, ?ml, ?uhq) {
                  let inScope = isHqInScope(uhq, mhq, ml, zones, states, territories, hqs, areas, stations);
                  if (inScope and not seen.contains(uid)) {
                    seen.add(uid);
                    result.add(uid);
                  };
                };
                case _ {};
              };
            };
          };
        };
        result.toArray()
      };
    }
  };

  /// Check if employeeHqId falls within the scope defined by managerHqId at managerLevel.
  /// ZSM (Zone) scope: all Regions/Areas/Stations in the same Zone.
  /// RSM (Region) scope: all Areas/Stations in the same Region/State.
  /// ASM (Area) scope: all Stations in the same Area's HQ.
  /// MR (Station) scope: only the same station (no sub-scope).
  private func isHqInScope(
    empHqId     : LocationId,
    mgrHqId     : LocationId,
    mgrLevel    : LocationLevel,
    zones       : Map.Map<LocationId, LocTypes.ZoneRecord>,
    states      : Map.Map<LocationId, LocTypes.StateRecord>,
    territories : Map.Map<LocationId, LocTypes.TerritoryRecord>,
    hqs         : Map.Map<LocationId, LocTypes.HQRecord>,
    areas       : Map.Map<LocationId, LocTypes.AreaRecord>,
    stations    : Map.Map<LocationId, LocTypes.StationRecord>,
  ) : Bool {
    if (empHqId == mgrHqId) { return true };
    switch (mgrLevel) {
      case (#Zone) {
        // Manager is ZSM — employee is in scope if their HQ's ancestry reaches this Zone
        ancestorZoneId(empHqId, states, territories, hqs, areas, stations) == ?mgrHqId
      };
      case (#Region) {
        // Manager is RSM — employee is in scope if their HQ's Region (State) matches
        ancestorRegionId(empHqId, territories, hqs, areas, stations) == ?mgrHqId
      };
      case (#Area) {
        // Manager is ASM — employee is in scope if their Area matches or their Station is under this Area's HQ
        // For simplicity: employee must be a Station under an HQ that the Area belongs to
        ancestorAreaHqId(empHqId, stations) == ancestorAreaHqId(mgrHqId, stations)
          and ancestorAreaHqId(mgrHqId, stations) != null
      };
      case (#Station) {
        // MR has no sub-scope
        false
      };
    }
  };

  /// Walk empHqId up to its Zone ancestor via: State→Zone or Area→HQ→Territory→State→Zone or Station→HQ→Territory→State→Zone.
  private func ancestorZoneId(
    hqId        : LocationId,
    states      : Map.Map<LocationId, LocTypes.StateRecord>,
    territories : Map.Map<LocationId, LocTypes.TerritoryRecord>,
    hqs         : Map.Map<LocationId, LocTypes.HQRecord>,
    areas       : Map.Map<LocationId, LocTypes.AreaRecord>,
    stations    : Map.Map<LocationId, LocTypes.StationRecord>,
  ) : ?LocationId {
    // Check if hqId is a State (Region) → get its zoneId
    switch (states.get(hqId)) {
      case (?s) { return ?s.zoneId };
      case null {};
    };
    // Check if hqId is an Area → Area→HQ→Territory→State→Zone
    switch (areas.get(hqId)) {
      case (?a) {
        switch (hqs.get(a.hqId)) {
          case (?hq) {
            switch (territories.get(hq.territoryId)) {
              case (?t) {
                switch (states.get(t.stateId)) {
                  case (?s) { return ?s.zoneId };
                  case null {};
                };
              };
              case null {};
            };
          };
          case null {};
        };
      };
      case null {};
    };
    // Check if hqId is a Station → Station→HQ→Territory→State→Zone
    switch (stations.get(hqId)) {
      case (?st) {
        switch (hqs.get(st.hqId)) {
          case (?hq) {
            switch (territories.get(hq.territoryId)) {
              case (?t) {
                switch (states.get(t.stateId)) {
                  case (?s) { return ?s.zoneId };
                  case null {};
                };
              };
              case null {};
            };
          };
          case null {};
        };
      };
      case null {};
    };
    null
  };

  /// Walk hqId up to its Region (State) ancestor.
  private func ancestorRegionId(
    hqId        : LocationId,
    territories : Map.Map<LocationId, LocTypes.TerritoryRecord>,
    hqs         : Map.Map<LocationId, LocTypes.HQRecord>,
    areas       : Map.Map<LocationId, LocTypes.AreaRecord>,
    stations    : Map.Map<LocationId, LocTypes.StationRecord>,
  ) : ?LocationId {
    // If hqId is Area → Area→HQ→Territory→State
    switch (areas.get(hqId)) {
      case (?a) {
        switch (hqs.get(a.hqId)) {
          case (?hq) {
            switch (territories.get(hq.territoryId)) {
              case (?t) { return ?t.stateId };
              case null {};
            };
          };
          case null {};
        };
      };
      case null {};
    };
    // If hqId is Station → Station→HQ→Territory→State
    switch (stations.get(hqId)) {
      case (?st) {
        switch (hqs.get(st.hqId)) {
          case (?hq) {
            switch (territories.get(hq.territoryId)) {
              case (?t) { return ?t.stateId };
              case null {};
            };
          };
          case null {};
        };
      };
      case null {};
    };
    null
  };

  /// Get the HQ (legacy HQ record) ancestor for an Area or Station — for ASM scope matching.
  private func ancestorAreaHqId(
    hqId     : LocationId,
    stations : Map.Map<LocationId, LocTypes.StationRecord>,
  ) : ?LocationId {
    switch (stations.get(hqId)) {
      case (?st) { ?st.hqId };
      case null  { null };
    }
  };

  // ── getInvalidHqEmployees ─────────────────────────────────────────────────

  /// Return employees whose primaryHqId does not match the expected level for their role.
  /// Employees with no primaryHqId are also flagged for field roles (ZSM/RSM/ASM/MR).
  public func getInvalidHqEmployees(
    users    : Map.Map<UserId, AuthTypes.UserRecord>,
    zones    : Map.Map<LocationId, LocTypes.ZoneRecord>,
    states   : Map.Map<LocationId, LocTypes.StateRecord>,
    areas    : Map.Map<LocationId, LocTypes.AreaRecord>,
    stations : Map.Map<LocationId, LocTypes.StationRecord>,
  ) : [InvalidHqEmployee] {
    let result = List.empty<InvalidHqEmployee>();
    for ((_, u) in users.entries()) {
      switch (expectedLevelForRole(u.role)) {
        case null {
          // Admin / HRManager — no HQ required, skip
        };
        case (?expected) {
          let reason : ?Text = switch (u.primaryHqId) {
            case null {
              ?"primaryHqId is not set for this role"
            };
            case (?hqId) {
              let actual = detectLevel(hqId, zones, states, areas, stations);
              switch (actual) {
                case null {
                  ?"primaryHqId refers to an unknown location"
                };
                case (?lvl) {
                  if (lvl != expected) {
                    ?("Expected level " # levelToText(expected) # " but got " # levelToText(lvl))
                  } else {
                    null   // valid
                  }
                };
              };
            };
          };
          switch (reason) {
            case null {};
            case (?r) {
              result.add({
                userId        = u.id;
                employeeId    = u.employeeId;
                name          = u.name;
                role          = roleToText(u.role);
                primaryHqId   = u.primaryHqId;
                expectedLevel = expected;
                reason        = r;
              });
            };
          };
        };
      };
    };
    result.toArray()
  };

  // ── validatePrimaryHqForRole ──────────────────────────────────────────────

  /// Validate that a given primaryHqId is appropriate for the given role.
  /// Returns #ok if valid (or if role has no HQ requirement).
  /// Returns #err with a message if the level does not match.
  public func validatePrimaryHqForRole(
    role     : Role,
    hqId     : LocationId,
    zones    : Map.Map<LocationId, LocTypes.ZoneRecord>,
    states   : Map.Map<LocationId, LocTypes.StateRecord>,
    areas    : Map.Map<LocationId, LocTypes.AreaRecord>,
    stations : Map.Map<LocationId, LocTypes.StationRecord>,
  ) : { #ok; #err : Text } {
    switch (expectedLevelForRole(role)) {
      case null { #ok };  // Admin / HRManager — no level constraint
      case (?expected) {
        switch (detectLevel(hqId, zones, states, areas, stations)) {
          case null {
            #err("Location ID " # hqId.toText() # " does not exist in any level")
          };
          case (?actual) {
            if (actual == expected) {
              #ok
            } else {
              #err(
                roleToText(role) # " requires a " # levelToText(expected) #
                "-level HQ but the provided location is at " # levelToText(actual) # " level"
              )
            }
          };
        }
      };
    }
  };
};
