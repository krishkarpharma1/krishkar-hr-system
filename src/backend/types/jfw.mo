import CommonTypes "common";

module {
  public type UserId    = CommonTypes.UserId;
  public type Timestamp = CommonTypes.Timestamp;

  // ── Rating scale ─────────────────────────────────────────────────────────

  public type JfwRating = {
    #Excellent;
    #Good;
    #Average;
    #Poor;
  };

  // ── Sub-record: one doctor visited during the JFW ─────────────────────────

  public type DoctorVisited = {
    doctorId   : Nat;
    doctorName : Text;
    station    : Text;
  };

  // ── JFW Record ────────────────────────────────────────────────────────────

  public type JfwRecord = {
    id                         : Nat;
    managerId                  : UserId;  // ASM or RSM who conducted the JFW
    mrId                       : UserId;
    var mrName                 : Text;
    date                       : Text;    // ISO date "YYYY-MM-DD"
    var areaVisited            : Text;
    var stationVisited         : Text;
    var doctorsJointlyVisited  : [DoctorVisited];
    var observations           : Text;
    var rating                 : JfwRating;
    var mrAcknowledged         : Bool;
    var mrAcknowledgedAt       : ?Timestamp;
    createdAt                  : Timestamp;
  };

  public type JfwInfo = {
    id                    : Nat;
    managerId             : UserId;
    mrId                  : UserId;
    mrName                : Text;
    date                  : Text;
    areaVisited           : Text;
    stationVisited        : Text;
    doctorsJointlyVisited : [DoctorVisited];
    observations          : Text;
    rating                : JfwRating;
    mrAcknowledged        : Bool;
    mrAcknowledgedAt      : ?Timestamp;
    createdAt             : Timestamp;
  };

  // ── Input types ───────────────────────────────────────────────────────────

  public type JfwInput = {
    mrId                  : UserId;
    date                  : Text;
    areaVisited           : Text;
    stationVisited        : Text;
    doctorsJointlyVisited : [DoctorVisited];
    observations          : Text;
    rating                : JfwRating;
  };

  /// Used by the MR to acknowledge a JFW report submitted about them.
  public type JfwAcknowledgeInput = {
    jfwId : Nat;
  };

  // ── Summary Report ────────────────────────────────────────────────────────

  /// Aggregated row per manager–MR pair for the JFW Summary Report.
  public type JfwSummaryRow = {
    managerId   : UserId;
    managerName : Text;
    mrId        : UserId;
    mrName      : Text;
    jfwCount    : Nat;
    avgRating   : Float;  // 4 = Excellent, 3 = Good, 2 = Average, 1 = Poor
    period      : Text;   // "YYYY-MM" or date range label
  };
};
