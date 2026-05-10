import GpsTrailTypes "../types/gps-trail";
import FieldTypes    "../types/field-ops";
import HRCoreTypes   "../types/hr-core";
import AuthTypes     "../types/auth-users";
import LocTypes      "../types/location-master";
import GpsTrailLib   "../lib/gps-trail";
import Map           "mo:core/Map";
import List          "mo:core/List";
import Time          "mo:core/Time";

/// Public API surface for GPS trail recording and location-based attendance check-in.
/// State is injected via mixin parameters — no owned state.
mixin (
  sessions        : Map.Map<Text, AuthTypes.Session>,
  trails          : Map.Map<(GpsTrailTypes.UserId, Text), GpsTrailTypes.GpsTrailRecord>,
  checkIns        : List.List<GpsTrailTypes.AttendanceCheckIn>,
  users           : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
  hqs             : Map.Map<LocTypes.LocationId, LocTypes.HQRecord>,
  areas           : Map.Map<LocTypes.LocationId, LocTypes.AreaRecord>,
  gpsActivityLog  : List.List<GpsTrailTypes.GpsActivityEntry>,
  nextGpsActivityId : { var value : Nat },
  // HR attendance state — used to auto-record Present on check-in
  attendance      : List.List<HRCoreTypes.AttendanceRecord>,
  nextAttendId    : { var value : Nat },
  // Field-ops reports — for Doctor Call GPS lookup and trail enrichment
  reports         : List.List<FieldTypes.CallReport>,
  // Doctor master — for resolving doctor names in enriched trail
  doctors         : List.List<FieldTypes.Doctor>,
  // GPS enforcement toggle — global setting (default: true = strict)
  gpsEnforcementEnabled : { var value : Bool },
  // GPS overrides — per-employee exception grants
  gpsOverrides    : Map.Map<AuthTypes.UserId, List.List<GpsTrailTypes.GpsOverrideEntry>>,
  nextGpsOverrideId : { var value : Nat },
) {

  // ── Session helpers ────────────────────────────────────────────────────────

  func gpsRequireSession(token : Text) : ?AuthTypes.Session {
    switch (sessions.get(token)) {
      case (?s) { if (s.expiresAt > Time.now()) ?s else null };
      case null { null };
    };
  };

  func gpsRequireManager(token : Text) : ?AuthTypes.Session {
    switch (gpsRequireSession(token)) {
      case null { null };
      case (?s) {
        switch (s.role) {
          case (#Admin or #HRManager or #ASM or #RSM or #ZSM) ?s;
          case _ { null };
        }
      };
    }
  };

  func gpsRequireHROrAdmin(token : Text) : ?AuthTypes.Session {
    switch (gpsRequireSession(token)) {
      case null { null };
      case (?s) {
        switch (s.role) {
          case (#Admin or #HRManager) ?s;
          case _                      { null };
        }
      };
    }
  };

  // ── Auto-mark Present on check-in ─────────────────────────────────────────

  func autoMarkPresent(
    employeeId  : Nat,
    date        : Text,
    checkInTime : Text,
    coord       : GpsTrailTypes.GpsCoord,
  ) {
    let idx = attendance.findIndex(func(r : HRCoreTypes.AttendanceRecord) : Bool {
      r.employeeId == employeeId and r.date == date
    });
    switch (idx) {
      case (?i) {
        let old = attendance.at(i);
        switch (old.status) {
          case (#onLeave)    {};
          case (#onLeaveCL)  {};
          case (#onLeaveSL)  {};
          case (#onLeaveUPL) {};
          case _ {
            attendance.put(i, {
              old with
              status      = #present;
              checkInTime = ?checkInTime;
              checkInGps  = ?coord;
            });
          };
        };
      };
      case null {
        let rec : HRCoreTypes.AttendanceRecord = {
          id                 = nextAttendId.value;
          employeeId;
          date;
          status             = #present;
          checkInTime        = ?checkInTime;
          checkInGps         = ?coord;
          leaveApplicationId = null;
          holidayId          = null;
          correctedBy        = null;
          correctionRemark   = null;
          correctionAt       = null;
          recordedAt         = Time.now();
        };
        nextAttendId.value += 1;
        attendance.add(rec);
      };
    };
  };

  func fmtTime(ts : Int) : Text {
    let secs = ts / 1_000_000_000;
    let hh = (secs / 3600).toNat() % 24;
    let mm = ((secs % 3600) / 60).toNat();
    let ss = (secs % 60).toNat();
    let pad = func(n : Nat) : Text {
      if (n < 10) "0" # n.toText() else n.toText()
    };
    pad(hh) # ":" # pad(mm) # ":" # pad(ss)
  };

  // ── GPS Trail API ──────────────────────────────────────────────────────────

  public shared func recordGpsTrail(
    token : Text,
    date  : Text,
    coord : GpsTrailTypes.GpsCoord,
  ) : async GpsTrailTypes.MutationResult {
    switch (gpsRequireSession(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        GpsTrailLib.appendTrailCoord(trails, s.userId, date, coord);
        #ok
      };
    }
  };

  public query func getGpsTrail(
    token  : Text,
    userId : GpsTrailTypes.UserId,
    date   : Text,
  ) : async [GpsTrailTypes.GpsCoord] {
    switch (gpsRequireSession(token)) {
      case null { [] };
      case (?s) {
        if (s.userId != userId) {
          switch (gpsRequireManager(token)) {
            case null { return [] };
            case (?_) {};
          };
        };
        GpsTrailLib.getTrail(trails, userId, date)
      };
    }
  };

  public query func getAllTrailsForUser(
    token  : Text,
    userId : GpsTrailTypes.UserId,
  ) : async [GpsTrailTypes.GpsTrailRecord] {
    switch (gpsRequireManager(token)) {
      case null { [] };
      case (?_) { GpsTrailLib.getUserTrails(trails, userId) };
    }
  };

  // ── Location-based Attendance Check-In API ────────────────────────────────

  public shared func checkInAttendance(
    token : Text,
    coord : GpsTrailTypes.GpsCoord,
    date  : Text,
  ) : async { #ok : GpsTrailTypes.AttendanceCheckIn; #alreadyCheckedIn : GpsTrailTypes.AttendanceCheckIn; #err : Text } {
    switch (gpsRequireSession(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        let result = GpsTrailLib.checkInAttendance(
          checkIns, users, hqs, areas, s.userId, coord, date, Time.now()
        );
        switch (result) {
          case (#ok(rec)) {
            let checkInTime = fmtTime(rec.recordedAt);
            autoMarkPresent(s.userId, date, checkInTime, coord);
            #ok(rec)
          };
          case (#alreadyCheckedIn(rec)) { #alreadyCheckedIn(rec) };
        }
      };
    }
  };

  public shared func checkOutAttendance(
    token : Text,
    coord : ?GpsTrailTypes.GpsCoord,
    date  : Text,
  ) : async { #ok : GpsTrailTypes.AttendanceCheckIn; #notCheckedIn; #alreadyCheckedOut; #err : Text } {
    switch (gpsRequireSession(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        let result = GpsTrailLib.checkOutAttendance(checkIns, s.userId, coord, date, Time.now());
        switch (result) {
          case (#ok(rec))           { #ok(rec) };
          case (#notCheckedIn)      { #notCheckedIn };
          case (#alreadyCheckedOut) { #alreadyCheckedOut };
        }
      };
    }
  };

  public query func getMyCheckIns(token : Text) : async [GpsTrailTypes.AttendanceCheckIn] {
    switch (gpsRequireSession(token)) {
      case null { [] };
      case (?s) { GpsTrailLib.getMyCheckIns(checkIns, s.userId) };
    }
  };

  public query func getCheckInsByDate(
    token : Text,
    date  : Text,
  ) : async [GpsTrailTypes.AttendanceCheckIn] {
    switch (gpsRequireManager(token)) {
      case null { [] };
      case (?_) { GpsTrailLib.getCheckInsByDate(checkIns, date) };
    }
  };

  // ── GPS Background Capture API ────────────────────────────────────────────

  public shared func captureGpsBackground(
    token    : Text,
    lat      : Float,
    lng      : Float,
    accuracy : ?Float,
  ) : async GpsTrailTypes.MutationResult {
    switch (gpsRequireSession(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        let now = Time.now();
        let _ = GpsTrailLib.captureGpsActivityEntry(
          gpsActivityLog, nextGpsActivityId, trails,
          s.userId, lat, lng, accuracy, now, "background",
        );
        #ok
      };
    }
  };

  public query func getGpsActivityLog(
    token  : Text,
    filter : GpsTrailTypes.GpsActivityFilter,
  ) : async [GpsTrailTypes.GpsActivityEntry] {
    switch (gpsRequireHROrAdmin(token)) {
      case null { [] };
      case (?_) { GpsTrailLib.getGpsActivityLog(gpsActivityLog, filter) };
    }
  };

  public query func getGpsActivityLogGrouped(
    token        : Text,
    filterUserId : ?GpsTrailTypes.UserId,
    date         : Text,
  ) : async [(Text, [GpsTrailTypes.GpsActivityEntry])] {
    switch (gpsRequireHROrAdmin(token)) {
      case null { [] };
      case (?_) { GpsTrailLib.getGpsActivityLogGrouped(gpsActivityLog, users, filterUserId, date) };
    }
  };

  // ── Location Trail Access API ─────────────────────────────────────────────

  /// Return the GPS trail record for a specific employee on a specific date.
  /// Access is hierarchy-scoped: requestor must have the target in their subordinate tree
  /// (or be Admin/HRManager/ZSM to see all).
  public query func getLocationTrailForEmployee(
    requestorSession : Text,
    targetUserId     : GpsTrailTypes.UserId,
    date             : Text,
  ) : async { #ok : GpsTrailTypes.GpsTrailRecord; #err : Text } {
    switch (gpsRequireSession(requestorSession)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        let allowed = GpsTrailLib.canViewTrail(users, s.userId, s.role, targetUserId);
        if (not allowed) {
          return #err("Access denied: employee is not under your reporting hierarchy");
        };
        switch (trails.get(GpsTrailLib.trailKeyCompare, (targetUserId, date))) {
          case (?rec) { #ok(rec) };
          case null   {
            // Return an empty trail record rather than an error — "no data found" is normal
            #ok({ userId = targetUserId; date; coords = [] })
          };
        };
      };
    }
  };

  /// Return the list of employees the caller is allowed to view trails for,
  /// scoped to their hierarchy.
  /// Admin/HRManager/ZSM get every employee.
  /// Other managers get only their transitive subordinates.
  public query func getEmployeesForTrailSelector(
    session : Text,
  ) : async { #ok : [{ userId : GpsTrailTypes.UserId; name : Text; role : Text }]; #err : Text } {
    switch (gpsRequireSession(session)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        let visibleIds : [GpsTrailTypes.UserId] = switch (s.role) {
          case (#Admin or #HRManager or #ZSM) {
            // Return all employees
            let all = List.empty<GpsTrailTypes.UserId>();
            for ((uid, _) in users.entries()) { all.add(uid) };
            all.toArray()
          };
          case _ {
            GpsTrailLib.getSubordinateIds(users, s.userId)
          };
        };
        let result = List.empty<{ userId : GpsTrailTypes.UserId; name : Text; role : Text }>();
        for (uid in visibleIds.values()) {
          switch (users.get(uid)) {
            case (?u) {
              let roleText = switch (u.role) {
                case (#Admin)     "Admin";
                case (#HRManager) "HR Manager";
                case (#ZSM)       "ZSM";
                case (#RSM)       "RSM";
                case (#ASM)       "ASM";
                case (#MR)        "MR";
              };
              result.add({ userId = uid; name = u.name; role = roleText });
            };
            case null {};
          };
        };
        #ok(result.toArray())
      };
    }
  };

  // ── Doctor Call GPS Location API ──────────────────────────────────────────

  /// Return the GPS coordinates captured when a Doctor Call was submitted.
  /// The call is identified by the CallReport ID (reportId) and which doctor
  /// visit index within that report (visitIndex, 0-based).
  /// Returns the GPS coord from the top-level CallReport.gps field (captured at submission).
  /// Accessible to ASM, RSM, ZSM, HRManager, and Admin only.
  public query func getDoctorCallGpsLocation(
    session   : Text,
    reportId  : GpsTrailTypes.UserId,  // reusing UserId = Nat as ReportId = Nat
  ) : async { #ok : { lat : Float; lng : Float; timestamp : Int; mrName : Text; submittedAt : Int }; #err : Text } {
    switch (gpsRequireManager(session)) {
      case null { #err("Unauthorized: manager or admin session required") };
      case (?_) {
        switch (reports.find(func(r : FieldTypes.CallReport) : Bool { r.id == reportId })) {
          case null { #err("Call report not found") };
          case (?r) {
            let mrName = switch (users.get(r.mrId)) {
              case (?u) u.name;
              case null "(Unknown MR)";
            };
            let g = r.gps;
            #ok({
              lat         = g.lat;
              lng         = g.lng;
              timestamp   = g.timestamp;
              mrName;
              submittedAt = r.createdAt;
            })
          };
        };
      };
    }
  };

  // ── Live Locations with Last-Reported-Time ────────────────────────────────

  /// Return live GPS locations enriched with name, role, and lastReportedAt timestamp.
  /// This extends the existing getReporteeLocations / getAllLocations data with resolved
  /// employee names and roles so the frontend can display last-reported-time badges.
  /// Access rules mirror getReporteeLocations: managers see their team, Admin/ZSM see all.
  public query func getEnrichedLiveLocations(
    token : Text,
  ) : async { #ok : [{ userId : GpsTrailTypes.UserId; name : Text; role : Text; lat : Float; lng : Float; lastReportedAt : Int }]; #err : Text } {
    switch (gpsRequireSession(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        // Build the list of location records to return based on role
        // We iterate the users map directly so we can join names and roles in one pass.
        let result = List.empty<{ userId : GpsTrailTypes.UserId; name : Text; role : Text; lat : Float; lng : Float; lastReportedAt : Int }>();
        let subIds : [GpsTrailTypes.UserId] = switch (s.role) {
          case (#Admin or #ZSM) {
            // All employees
            let all = List.empty<GpsTrailTypes.UserId>();
            for ((uid, _) in users.entries()) { all.add(uid) };
            all.toArray()
          };
          case (#HRManager or #RSM or #ASM) {
            GpsTrailLib.getSubordinateIds(users, s.userId)
          };
          case _ {
            // MR — just themselves
            [s.userId]
          };
        };
        for (uid in subIds.values()) {
          switch (users.get(uid)) {
            case null {};
            case (?u) {
              // Check GPS activity log for last reported location for this user
              // Find the most recent entry in gpsActivityLog for this user
              var latestLat    : Float = 0.0;
              var latestLng    : Float = 0.0;
              var latestTs     : Int   = 0;
              var found        : Bool  = false;
              for (entry in gpsActivityLog.values()) {
                if (entry.userId == uid and entry.capturedAt > latestTs) {
                  latestTs  := entry.capturedAt;
                  latestLat := entry.lat;
                  latestLng := entry.lng;
                  found     := true;
                };
              };
              if (found) {
                let roleText = switch (u.role) {
                  case (#Admin)     "Admin";
                  case (#HRManager) "HR Manager";
                  case (#ZSM)       "ZSM";
                  case (#RSM)       "RSM";
                  case (#ASM)       "ASM";
                  case (#MR)        "MR";
                };
                result.add({
                  userId       = uid;
                  name         = u.name;
                  role         = roleText;
                  lat          = latestLat;
                  lng          = latestLng;
                  lastReportedAt = latestTs;
                });
              };
            };
          };
        };
        #ok(result.toArray())
      };
    }
  };

  // ── Trail enriched with Doctor Call names ────────────────────────────────

  /// Return the GPS trail for a given employee and date, enriched with doctor
  /// call details (Doctor Name, Specialization, Station) at each point.
  ///
  /// Access rules:
  ///   Admin / HRManager / ZSM → can view any employee's trail
  ///   RSM / ASM               → can view trails for employees in their hierarchy
  ///   All others              → denied
  public query func getTrailWithDoctorCalls(
    session      : Text,
    targetUserId : GpsTrailTypes.UserId,
    date         : Text,
  ) : async { #ok : [GpsTrailTypes.EnrichedTrailEvent]; #err : Text } {
    switch (gpsRequireSession(session)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        // Only manager+ roles may access location trail
        let allowed = switch (s.role) {
          case (#Admin or #HRManager or #ZSM or #RSM or #ASM) true;
          case _ false;
        };
        if (not allowed) {
          return #err("Access denied: manager role required to view location trails");
        };
        // Hierarchy scope check
        if (not GpsTrailLib.canViewTrail(users, s.userId, s.role, targetUserId)) {
          return #err("Access denied: employee is not under your reporting hierarchy");
        };
        #ok(GpsTrailLib.getTrailWithDoctorCalls(trails, reports, doctors, targetUserId, date))
      };
    }
  };

  // ── GPS Enforcement Toggle ─────────────────────────────────────────────────

  /// Get the current GPS enforcement state.
  /// Public — no token required (frontend reads this on form load).
  public query func getGpsEnforcementEnabled() : async Bool {
    gpsEnforcementEnabled.value
  };

  /// Set the GPS enforcement toggle. Admin or HRManager only.
  public shared func setGpsEnforcementEnabled(
    token   : Text,
    enabled : Bool,
  ) : async { #ok; #err : Text } {
    switch (gpsRequireHROrAdmin(token)) {
      case null { #err("Unauthorized: Admin or HR role required") };
      case (?_) {
        gpsEnforcementEnabled.value := enabled;
        #ok
      };
    }
  };

  // ── GPS Override Management ────────────────────────────────────────────────

  /// Grant a GPS override for an employee. Admin or HRManager only.
  /// overrideDate: null = permanent override; "YYYY-MM-DD" = single-day override.
  public shared func addGpsOverride(
    token        : Text,
    employeeId   : AuthTypes.UserId,
    reason       : Text,
    overrideDate : ?Text,
  ) : async { #ok : GpsTrailTypes.GpsOverrideEntry; #err : Text } {
    switch (gpsRequireHROrAdmin(token)) {
      case null { #err("Unauthorized: Admin or HR role required") };
      case (?s) {
        let entry = GpsTrailLib.addGpsOverride(
          gpsOverrides, nextGpsOverrideId,
          s.userId, employeeId, reason, overrideDate, Time.now()
        );
        #ok(entry)
      };
    }
  };

  /// Revoke an existing GPS override. Admin or HRManager only.
  public shared func revokeGpsOverride(
    token        : Text,
    employeeId   : AuthTypes.UserId,
    overrideId   : Nat,
  ) : async { #ok; #err : Text } {
    switch (gpsRequireHROrAdmin(token)) {
      case null { #err("Unauthorized: Admin or HR role required") };
      case (?_) {
        switch (GpsTrailLib.revokeGpsOverride(gpsOverrides, employeeId, overrideId)) {
          case (#ok)      { #ok };
          case (#err(e))  { #err(e) };
        }
      };
    }
  };

  /// List all GPS overrides. Admin or HRManager only.
  public query func listGpsOverrides(
    token : Text,
  ) : async { #ok : [GpsTrailTypes.GpsOverrideEntry]; #err : Text } {
    switch (gpsRequireHROrAdmin(token)) {
      case null { #err("Unauthorized: Admin or HR role required") };
      case (?_) {
        #ok(GpsTrailLib.listAllGpsOverrides(gpsOverrides))
      };
    }
  };

  /// Check whether the calling employee has an active GPS override for a given date.
  /// Each employee can check their own override status.
  public query func checkGpsOverride(
    token : Text,
    date  : Text,
  ) : async Bool {
    switch (gpsRequireSession(token)) {
      case null  { false };
      case (?s)  {
        GpsTrailLib.checkGpsOverride(gpsOverrides, s.userId, date)
      };
    }
  };

  /// Compute the GPS accuracy category for a given accuracy value.
  /// Pure utility — no auth required. Used by the frontend to badge records.
  public query func getGpsAccuracyCategory(
    accuracy : ?Float,
  ) : async GpsTrailTypes.GpsAccuracyCategory {
    GpsTrailLib.computeAccuracyCategory(accuracy)
  };
};
