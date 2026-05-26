import CommonTypes "common";

module {
  public type UserId    = CommonTypes.UserId;
  public type Timestamp = CommonTypes.Timestamp;
  public type GpsCoord  = CommonTypes.GpsCoord;
  public type Role      = CommonTypes.Role;

  // ── GPS Trail ──────────────────────────────────────────────────────────────

  /// One day's GPS trail for a single staff member.
  /// Key: (userId, date "YYYY-MM-DD")
  public type GpsTrailKey = {
    userId : UserId;
    date   : Text;   // ISO date "YYYY-MM-DD"
  };

  public type GpsTrailRecord = {
    userId : UserId;
    date   : Text;       // ISO date "YYYY-MM-DD"
    coords : [GpsCoord]; // ordered list of GPS coords captured during the day
  };

  // ── Location-based Attendance Check-In ────────────────────────────────────

  public type CheckInStatus = {
    #matched;   // check-in GPS is within 5 km of an assigned HQ/area
    #unmatched; // too far from any assigned location
  };

  /// Result of a location-based attendance check-in attempt.
  /// checkOutTime and checkOutGps are populated when the employee checks out.
  public type AttendanceCheckIn = {
    userId          : UserId;
    date            : Text;          // ISO date "YYYY-MM-DD"
    gpsCoord        : GpsCoord;      // GPS coord at check-in time
    matchedLocation : ?Text;         // name of the matched HQ/area (if any)
    distance        : Float;         // distance in km to nearest assigned location
    status          : CheckInStatus;
    recordedAt      : Timestamp;
    checkOutTime      : ?Timestamp;  // set when the employee checks out
    checkOutGps       : ?GpsCoord;   // GPS coord at check-out time (if provided)
    wasAutoCheckedOut : Bool;        // true when auto-checkout fired at 9 PM
  };

  public type MutationResult = CommonTypes.MutationResult;

  // ── TA/DA Totals (used by payroll auto-fetch) ─────────────────────────────
  public type TaDaTotals = {
    taTotal : Nat; // sum of travelAmount for approved expenses in the month
    daTotal : Nat; // sum of dailyAllowance for approved expenses in the month
  };

  // ── Enriched Trail (Doctor Name in Timeline) ─────────────────────────────

  /// One doctor call linked to a trail GPS point.
  public type TrailDoctorCall = {
    doctorName       : Text;
    doctorSpecialization : Text;  // "" when not available
    station          : Text;
  };

  /// A GPS trail point enriched with any doctor call(s) made at that location.
  public type EnrichedTrailEvent = {
    coord        : GpsCoord;
    activityType : Text;     // "DoctorCall" | "CheckIn" | "GpsRecording"
    doctorCalls  : [TrailDoctorCall]; // empty for non-doctor-call points
  };

  // ── GPS Activity Log ───────────────────────────────────────────────────────

  /// A single GPS capture event (background, report submission, or manual).
  /// source: "background" | "report_submit" | "manual"
  public type GpsActivityEntry = {
    id         : Nat;
    userId     : UserId;
    lat        : Float;
    lng        : Float;
    accuracy   : ?Float;  // device accuracy in metres, if available
    capturedAt : Timestamp;
    source     : Text;    // "background" | "report_submit" | "manual"
  };

  /// Filter for HR/Admin activity log queries.
  public type GpsActivityFilter = {
    userId   : ?UserId;
    role     : ?Role;
    dateFrom : ?Text;   // ISO date "YYYY-MM-DD"
    dateTo   : ?Text;   // ISO date "YYYY-MM-DD"
  };

  // ── GPS Enforcement ────────────────────────────────────────────────────────

  /// GPS accuracy category stored on Doctor Call records.
  ///   #verified     — accuracy ≤ 100 m (meets threshold)
  ///   #lowAccuracy  — accuracy > 100 m (captured but borderline)
  ///   #none         — no GPS captured at submission time
  public type GpsAccuracyCategory = {
    #verified;
    #lowAccuracy;
    #none;
  };

  /// An admin-granted GPS override for a specific employee.
  /// overrideDate: null means the override applies permanently until revoked.
  /// active: false means the override has been revoked.
  public type GpsOverrideEntry = {
    id           : Nat;
    employeeId   : UserId;
    grantedBy    : UserId;
    reason       : Text;
    overrideDate : ?Text;  // ISO date "YYYY-MM-DD"; null = permanent
    timestamp    : Int;
    active       : Bool;
  };
};
