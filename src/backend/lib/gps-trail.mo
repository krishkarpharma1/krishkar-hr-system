import Types      "../types/gps-trail";
import FieldTypes  "../types/field-ops";
import AuthTypes   "../types/auth-users";
import LocTypes    "../types/location-master";
import Map         "mo:core/Map";
import List        "mo:core/List";
import Array       "mo:core/Array";
import Nat         "mo:core/Nat";
import Int         "mo:core/Int";
import Float       "mo:core/Float";
import Order       "mo:core/Order";
import Runtime     "mo:core/Runtime";
import Text        "mo:core/Text";

module {
  // ── Trail key comparison ──────────────────────────────────────────────────

  /// Composite key comparison for (UserId, Text) map keys.
  public func trailKeyCompare(
    a : (Types.UserId, Text),
    b : (Types.UserId, Text),
  ) : Order.Order {
    let (aId, aDate) = a;
    let (bId, bDate) = b;
    switch (Nat.compare(aId, bId)) {
      case (#equal) { };
      case (o)      { return o };
    };
    if (aDate < bDate) #less
    else if (aDate > bDate) #greater
    else #equal;
  };

  // ── Trail storage helpers ─────────────────────────────────────────────────

  /// Append a GPS coord to the trail for (userId, date). Creates trail if absent.
  public func appendTrailCoord(
    trails : Map.Map<(Types.UserId, Text), Types.GpsTrailRecord>,
    userId : Types.UserId,
    date   : Text,
    coord  : Types.GpsCoord,
  ) : () {
    let key = (userId, date);
    let existing = trails.get(trailKeyCompare, key);
    let updated : Types.GpsTrailRecord = switch (existing) {
      case (?rec) { { rec with coords = rec.coords.concat([coord]) } };
      case null   { { userId; date; coords = [coord] } };
    };
    trails.add(trailKeyCompare, key, updated);
  };

  /// Return all coords for a user on a given date, or [] if no trail exists.
  public func getTrail(
    trails : Map.Map<(Types.UserId, Text), Types.GpsTrailRecord>,
    userId : Types.UserId,
    date   : Text,
  ) : [Types.GpsCoord] {
    switch (trails.get(trailKeyCompare, (userId, date))) {
      case (?rec) rec.coords;
      case null   [];
    };
  };

  /// Return all trails for a given user across all dates.
  public func getUserTrails(
    trails : Map.Map<(Types.UserId, Text), Types.GpsTrailRecord>,
    userId : Types.UserId,
  ) : [Types.GpsTrailRecord] {
    let result = List.empty<Types.GpsTrailRecord>();
    for ((key, rec) in trails.entries()) {
      let (uid, _) = key;
      if (uid == userId) { result.add(rec) };
    };
    result.toArray();
  };

  // ── Haversine distance ────────────────────────────────────────────────────

  /// Haversine formula — returns distance in km between two lat/lng points.
  public func haversineKm(
    lat1 : Float, lng1 : Float,
    lat2 : Float, lng2 : Float,
  ) : Float {
    let r = 6371.0; // Earth radius in km
    let dLat = (lat2 - lat1) * Float.pi / 180.0;
    let dLng = (lng2 - lng1) * Float.pi / 180.0;
    let a = Float.sin(dLat / 2.0) * Float.sin(dLat / 2.0)
          + Float.cos(lat1 * Float.pi / 180.0)
          * Float.cos(lat2 * Float.pi / 180.0)
          * Float.sin(dLng / 2.0) * Float.sin(dLng / 2.0);
    let c = 2.0 * Float.arctan2(Float.sqrt(a), Float.sqrt(1.0 - a));
    r * c;
  };

  // ── Location-based attendance check-in ───────────────────────────────────

  /// Attempt a location-based attendance check-in.
  /// Returns #alreadyCheckedIn with the existing record if the user has already
  /// checked in for the given date. Otherwise stores and returns a new record.
  public func checkInAttendance(
    checkIns    : List.List<Types.AttendanceCheckIn>,
    users       : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
    hqs         : Map.Map<LocTypes.LocationId, LocTypes.HQRecord>,
    areas       : Map.Map<LocTypes.LocationId, LocTypes.AreaRecord>,
    userId      : Types.UserId,
    coord       : Types.GpsCoord,
    date        : Text,
    now         : Types.Timestamp,
  ) : { #ok : Types.AttendanceCheckIn; #alreadyCheckedIn : Types.AttendanceCheckIn } {
    // Guard: only one check-in per user per day
    switch (checkIns.find(func(c : Types.AttendanceCheckIn) : Bool {
      c.userId == userId and c.date == date
    })) {
      case (?existing) { return #alreadyCheckedIn(existing) };
      case null {};
    };

    // NOTE: HQ and Area records don't store GPS coords in this data model.
    // We store the check-in as #matched if the user has assignments, #unmatched otherwise.
    let matchedLocation : ?Text = switch (users.get(userId)) {
      case (?u) {
        let hqMatch = u.hqIds.find(func(_hqId : Nat) : Bool { true });
        switch (hqMatch) {
          case (?hqId) {
            switch (hqs.get(hqId)) {
              case (?hq) ?hq.name;
              case null  null;
            };
          };
          case null {
            let areaMatch = u.areaIds.find(func(_aId : Nat) : Bool { true });
            switch (areaMatch) {
              case (?areaId) {
                switch (areas.get(areaId)) {
                  case (?area) ?area.name;
                  case null    null;
                };
              };
              case null null;
            };
          };
        };
      };
      case null null;
    };

    let status : Types.CheckInStatus = switch (matchedLocation) {
      case (?_) #matched;
      case null  #unmatched;
    };

    let record : Types.AttendanceCheckIn = {
      userId;
      date;
      gpsCoord        = coord;
      matchedLocation;
      distance        = 0.0;
      status;
      recordedAt      = now;
      checkOutTime    = null;
      checkOutGps     = null;
    };
    checkIns.add(record);
    #ok(record)
  };

  /// Check out the calling user for the given date.
  /// Returns #notCheckedIn if no check-in found, #alreadyCheckedOut if already done,
  /// otherwise updates the record with checkOutTime and optional GPS coord.
  public func checkOutAttendance(
    checkIns : List.List<Types.AttendanceCheckIn>,
    userId   : Types.UserId,
    coord    : ?Types.GpsCoord,
    date     : Text,
    now      : Types.Timestamp,
  ) : { #ok : Types.AttendanceCheckIn; #notCheckedIn; #alreadyCheckedOut } {
    let idx = checkIns.findIndex(func(c : Types.AttendanceCheckIn) : Bool {
      c.userId == userId and c.date == date
    });
    switch (idx) {
      case null { #notCheckedIn };
      case (?i) {
        let existing = checkIns.at(i);
        switch (existing.checkOutTime) {
          case (?_) { #alreadyCheckedOut };
          case null {
            let updated : Types.AttendanceCheckIn = {
              existing with
              checkOutTime = ?now;
              checkOutGps  = coord;
            };
            checkIns.put(i, updated);
            #ok(updated)
          };
        };
      };
    }
  };

  /// Return all check-in records for a given user.
  public func getMyCheckIns(
    checkIns : List.List<Types.AttendanceCheckIn>,
    userId   : Types.UserId,
  ) : [Types.AttendanceCheckIn] {
    checkIns.filter(func(c) { c.userId == userId }).toArray();
  };

  /// Return all check-in records for a given date (manager view).
  public func getCheckInsByDate(
    checkIns : List.List<Types.AttendanceCheckIn>,
    date     : Text,
  ) : [Types.AttendanceCheckIn] {
    checkIns.filter(func(c) { c.date == date }).toArray();
  };

  // ── GPS Activity Log helpers ──────────────────────────────────────────────

  /// Extract the ISO date string ("YYYY-MM-DD") from a nanosecond timestamp.
  /// Timestamp is nanoseconds since Unix epoch (Int).
  /// We derive the date by dividing to get seconds, then computing the calendar date.
  func timestampToDate(ts : Int) : Text {
    // Convert nanoseconds to seconds
    let secs : Int = ts / 1_000_000_000;
    // Days since Unix epoch (1970-01-01)
    let days : Int = secs / 86400;
    // Compute year/month/day from days since epoch using the proleptic Gregorian calendar
    // Algorithm from http://howardhinnant.github.io/date_algorithms.html
    let z : Int = days + 719468;
    let era : Int = (if (z >= 0) z else z - 146096) / 146097;
    let doe : Int = z - era * 146097;
    let yoe : Int = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y : Int = yoe + era * 400;
    let doy : Int = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp : Int = (5 * doy + 2) / 153;
    let d : Int = doy - (153 * mp + 2) / 5 + 1;
    let m : Int = if (mp < 10) mp + 3 else mp - 9;
    let yr : Int = if (m <= 2) y + 1 else y;
    // Format as YYYY-MM-DD with zero-padding
    let ys = yr.toText();
    let ms = if (m < 10) "0" # m.toText() else m.toText();
    let ds = if (d < 10) "0" # d.toText() else d.toText();
    ys # "-" # ms # "-" # ds
  };

  /// Capture a GPS activity entry and append it to the activity log.
  /// Also calls appendTrailCoord so the trail is updated in tandem.
  public func captureGpsActivityEntry(
    activityLog : List.List<Types.GpsActivityEntry>,
    nextId      : { var value : Nat },
    trails      : Map.Map<(Types.UserId, Text), Types.GpsTrailRecord>,
    userId      : Types.UserId,
    lat         : Float,
    lng         : Float,
    accuracy    : ?Float,
    timestamp   : Types.Timestamp,
    source      : Text,
  ) : Types.GpsActivityEntry {
    let id = nextId.value;
    nextId.value += 1;
    let entry : Types.GpsActivityEntry = {
      id;
      userId;
      lat;
      lng;
      accuracy;
      capturedAt = timestamp;
      source;
    };
    activityLog.add(entry);
    // Also keep the GPS trail up to date
    let coord : Types.GpsCoord = { lat; lng; timestamp };
    let date = timestampToDate(timestamp);
    appendTrailCoord(trails, userId, date, coord);
    entry;
  };

  /// Return filtered GPS activity log entries.
  /// Filters by userId, dateFrom, and dateTo (ISO date strings "YYYY-MM-DD").
  /// Role filter is applied by the mixin/caller (requires joining with user data).
  public func getGpsActivityLog(
    activityLog : List.List<Types.GpsActivityEntry>,
    filter      : Types.GpsActivityFilter,
  ) : [Types.GpsActivityEntry] {
    activityLog.filter(func(entry : Types.GpsActivityEntry) : Bool {
      // Filter by userId
      let userMatch = switch (filter.userId) {
        case (?uid) entry.userId == uid;
        case null   true;
      };
      if (not userMatch) return false;
      // Filter by dateFrom
      let fromMatch = switch (filter.dateFrom) {
        case (?df) timestampToDate(entry.capturedAt) >= df;
        case null  true;
      };
      if (not fromMatch) return false;
      // Filter by dateTo
      switch (filter.dateTo) {
        case (?dt) timestampToDate(entry.capturedAt) <= dt;
        case null  true;
      };
    }).toArray();
  };

  /// Collect all transitive subordinate userIds for a manager (BFS).
  /// Returns an array of all userId values that directly or indirectly report to managerId.
  /// Excludes managerId itself.
  public func getSubordinateIds(
    users     : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
    managerId : AuthTypes.UserId,
  ) : [AuthTypes.UserId] {
    let visited = List.empty<AuthTypes.UserId>();
    let queue   = List.empty<AuthTypes.UserId>();
    queue.add(managerId);
    label search loop {
      switch (queue.removeLast()) {
        case null    { break search };
        case (?uid) {
          if (not visited.contains(uid)) {
            visited.add(uid);
            for ((_, u) in users.entries()) {
              switch (u.reportsTo) {
                case (?mid) { if (mid == uid) { queue.add(u.id) } };
                case null   {};
              };
            };
          };
        };
      };
    };
    // Exclude the manager themselves
    visited.filter(func(uid : AuthTypes.UserId) : Bool { uid != managerId }).toArray()
  };

  /// Check whether targetUserId is in the visible set for requestorId.
  /// Admin, HRManager, and ZSM can see everyone.
  /// All other managers can see only their transitive subordinates.
  public func canViewTrail(
    users          : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
    requestorId    : AuthTypes.UserId,
    requestorRole  : Types.Role,
    targetUserId   : AuthTypes.UserId,
  ) : Bool {
    switch (requestorRole) {
      case (#Admin or #HRManager or #ZSM) { true };
      case _ {
        // Check if targetUserId is a subordinate of requestorId
        let subs = getSubordinateIds(users, requestorId);
        subs.any(func(uid : AuthTypes.UserId) : Bool { uid == targetUserId })
      };
    };
  };

  // ── Trail enriched with Doctor Call names ────────────────────────────────

  /// 5-minute window in nanoseconds for timestamp proximity matching.
  let matchWindowNs : Int = 300_000_000_000;

  /// Return an enriched trail for a given employee and date.
  /// Each GPS coord in the trail is annotated with any doctor call(s) whose
  /// GPS timestamp falls within `matchWindowNs` of that coord's timestamp.
  /// If a DoctorVisitEntry.gps is null, its parent CallReport.gps timestamp is used.
  ///
  /// Parameters:
  ///   trails        – GPS trail state map
  ///   reports       – CallReport list (field-ops domain)
  ///   doctors       – Doctor list (field-ops domain, for name / specialization lookup)
  ///   userId        – target employee
  ///   date          – ISO date "YYYY-MM-DD"
  public func getTrailWithDoctorCalls(
    trails   : Map.Map<(Types.UserId, Text), Types.GpsTrailRecord>,
    reports  : List.List<FieldTypes.CallReport>,
    doctors  : List.List<FieldTypes.Doctor>,
    userId   : Types.UserId,
    date     : Text,
  ) : [Types.EnrichedTrailEvent] {

    // 1. Get the raw trail coords for this user+date.
    let coords : [Types.GpsCoord] = switch (trails.get(trailKeyCompare, (userId, date))) {
      case (?rec) rec.coords;
      case null   [];
    };

    if (coords.size() == 0) return [];

    // 2. Collect all doctor visits submitted by this user on this date.
    //    Each element: (visitGpsTimestamp: Int, doctorId, doctorName, specialization, station)
    //    We flatten across all CallReports for this user on this date.
    let visitTuples = List.empty<(Int, FieldTypes.DoctorId, Text, Text, Text)>();
    for (r in reports.values()) {
      if (r.mrId == userId and r.date == date) {
        // The top-level report GPS timestamp is the fallback when a visit has no GPS
        let reportGpsTs : Int = r.gps.timestamp;
        for (visit in r.doctorsVisited.values()) {
          let visitTs : Int = switch (visit.gps) {
            case (?g) g.timestamp;
            case null  reportGpsTs;
          };
          // Resolve doctor name, specialization, and station from the Doctor master
          let (dName, dSpec, dStation) = switch (doctors.find(func(d : FieldTypes.Doctor) : Bool { d.id == visit.doctorId })) {
            case (?d) (d.name, d.specialization, d.station);
            case null ("Doctor #" # visit.doctorId.toText(), "", "");
          };
          visitTuples.add((visitTs, visit.doctorId, dName, dSpec, dStation));
        };
      };
    };
    let allVisits = visitTuples.toArray();

    // 3. For each trail coord, find matching visits within the time window.
    coords.map<Types.GpsCoord, Types.EnrichedTrailEvent>(func(coord) {
      let ts = coord.timestamp;
      let matched = List.empty<Types.TrailDoctorCall>();
      for ((visitTs, _, dName, dSpec, dStation) in allVisits.values()) {
        let diff = if (ts >= visitTs) ts - visitTs else visitTs - ts;
        if (diff <= matchWindowNs) {
          matched.add({
            doctorName           = dName;
            doctorSpecialization = dSpec;
            station              = dStation;
          });
        };
      };
      let calls = matched.toArray();
      let activityType = if (calls.size() > 0) "DoctorCall" else "GpsRecording";
      {
        coord;
        activityType;
        doctorCalls = calls;
      }
    })
  };

  // ── GPS Enforcement ────────────────────────────────────────────────────────

  /// GPS accuracy threshold in metres (100 m).
  public let GPS_ACCURACY_THRESHOLD_M : Float = 100.0;

  /// Compute the GpsAccuracyCategory for a given optional accuracy value.
  /// null accuracy → #none; ≤100 m → #verified; >100 m → #lowAccuracy.
  public func computeAccuracyCategory(accuracy : ?Float) : Types.GpsAccuracyCategory {
    switch (accuracy) {
      case null    { #none      };
      case (?acc)  {
        if (acc <= GPS_ACCURACY_THRESHOLD_M) { #verified }
        else { #lowAccuracy }
      };
    };
  };

  // ── GPS Override helpers ──────────────────────────────────────────────────

  /// Nat comparison for the overrides map.
  func natCompare(a : Nat, b : Nat) : Order.Order { Nat.compare(a, b) };

  /// Add a new GPS override entry to the overrides map and log list.
  /// Returns the newly created entry.
  public func addGpsOverride(
    overrides    : Map.Map<AuthTypes.UserId, List.List<Types.GpsOverrideEntry>>,
    nextId       : { var value : Nat },
    grantedBy    : AuthTypes.UserId,
    employeeId   : AuthTypes.UserId,
    reason       : Text,
    overrideDate : ?Text,
    now          : Int,
  ) : Types.GpsOverrideEntry {
    let id = nextId.value;
    nextId.value += 1;
    let entry : Types.GpsOverrideEntry = {
      id;
      employeeId;
      grantedBy;
      reason;
      overrideDate;
      timestamp = now;
      active    = true;
    };
    switch (overrides.get(natCompare, employeeId)) {
      case (?lst) { lst.add(entry) };
      case null   {
        let lst = List.empty<Types.GpsOverrideEntry>();
        lst.add(entry);
        overrides.add(natCompare, employeeId, lst);
      };
    };
    entry;
  };

  /// Revoke an active GPS override by ID for the given employee.
  /// Returns #ok on success, #err if not found.
  public func revokeGpsOverride(
    overrides  : Map.Map<AuthTypes.UserId, List.List<Types.GpsOverrideEntry>>,
    employeeId : AuthTypes.UserId,
    overrideId : Nat,
  ) : { #ok; #err : Text } {
    switch (overrides.get(natCompare, employeeId)) {
      case null { #err("No overrides found for employee") };
      case (?lst) {
        let idx = lst.findIndex(func(e : Types.GpsOverrideEntry) : Bool { e.id == overrideId });
        switch (idx) {
          case null { #err("Override not found") };
          case (?i) {
            let old = lst.at(i);
            if (not old.active) {
              return #err("Override is already revoked");
            };
            lst.put(i, { old with active = false });
            #ok
          };
        };
      };
    };
  };

  /// Return all GPS override entries across all employees as a flat array.
  public func listAllGpsOverrides(
    overrides : Map.Map<AuthTypes.UserId, List.List<Types.GpsOverrideEntry>>,
  ) : [Types.GpsOverrideEntry] {
    let result = List.empty<Types.GpsOverrideEntry>();
    for ((_, lst) in overrides.entries()) {
      lst.forEach(func(e : Types.GpsOverrideEntry) {
        result.add(e);
      });
    };
    result.toArray();
  };

  /// Check whether an employee has an active GPS override for a specific date.
  /// An override with overrideDate = null is permanent.
  /// An override with overrideDate = ?date applies only on that calendar date.
  public func checkGpsOverride(
    overrides  : Map.Map<AuthTypes.UserId, List.List<Types.GpsOverrideEntry>>,
    employeeId : AuthTypes.UserId,
    date       : Text,
  ) : Bool {
    switch (overrides.get(natCompare, employeeId)) {
      case null  { false };
      case (?lst) {
        lst.any(func(e : Types.GpsOverrideEntry) : Bool {
          if (not e.active) return false;
          switch (e.overrideDate) {
            case null    { true };          // permanent override
            case (?d)    { d == date };     // date-specific override
          };
        })
      };
    };
  };

  /// Group GPS activity entries by userId for a given date.
  /// Returns an array of (userId text, entries) pairs for HR viewing.
  public func getGpsActivityLogGrouped(
    activityLog : List.List<Types.GpsActivityEntry>,
    users       : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
    filterUserId : ?Types.UserId,
    date        : Text,
  ) : [(Text, [Types.GpsActivityEntry])] {
    // Collect all entries for the target date (optionally filtered by userId)
    let dayEntries = activityLog.filter(func(e : Types.GpsActivityEntry) : Bool {
      let dateMatch = timestampToDate(e.capturedAt) == date;
      let userMatch = switch (filterUserId) {
        case (?uid) e.userId == uid;
        case null   true;
      };
      dateMatch and userMatch;
    });

    // Group by userId using a Map
    let grouped = Map.empty<Types.UserId, List.List<Types.GpsActivityEntry>>();
    dayEntries.forEach(func(e : Types.GpsActivityEntry) {
      switch (grouped.get(e.userId)) {
        case (?lst) lst.add(e);
        case null   {
          let lst = List.empty<Types.GpsActivityEntry>();
          lst.add(e);
          grouped.add(e.userId, lst);
        };
      };
    });

    // Convert to output array with user name labels
    let result = List.empty<(Text, [Types.GpsActivityEntry])>();
    for ((uid, lst) in grouped.entries()) {
      let userLabel = switch (users.get(uid)) {
        case (?u) u.name # " (" # u.employeeId # ")";
        case null uid.toText();
      };
      result.add((userLabel, lst.toArray()));
    };
    result.toArray();
  };
};
