import Types  "../types/jfw";
import Common "../types/common";
import List   "mo:core/List";
import Array  "mo:core/Array";

module {
  public type JfwRecord      = Types.JfwRecord;
  public type JfwInfo        = Types.JfwInfo;
  public type JfwInput       = Types.JfwInput;
  public type JfwSummaryRow  = Types.JfwSummaryRow;
  public type JfwRating      = Types.JfwRating;
  public type UserId         = Common.UserId;
  public type Timestamp      = Common.Timestamp;
  public type MutationResult = Common.MutationResult;

  // ── Date helper ───────────────────────────────────────────────────────────

  private func inRange(date : Text, fromDate : Text, toDate : Text) : Bool {
    date >= fromDate and date <= toDate
  };

  // ── Conversion ────────────────────────────────────────────────────────────

  public func toInfo(r : JfwRecord) : JfwInfo {
    {
      id                    = r.id;
      managerId             = r.managerId;
      mrId                  = r.mrId;
      mrName                = r.mrName;
      date                  = r.date;
      areaVisited           = r.areaVisited;
      stationVisited        = r.stationVisited;
      doctorsJointlyVisited = r.doctorsJointlyVisited;
      observations          = r.observations;
      rating                = r.rating;
      mrAcknowledged        = r.mrAcknowledged;
      mrAcknowledgedAt      = r.mrAcknowledgedAt;
      createdAt             = r.createdAt;
    }
  };

  // ── Rating helpers ────────────────────────────────────────────────────────

  /// Map JfwRating to a Float score for averaging.
  public func ratingToFloat(rating : JfwRating) : Float {
    switch (rating) {
      case (#Excellent) { 4.0 };
      case (#Good)      { 3.0 };
      case (#Average)   { 2.0 };
      case (#Poor)      { 1.0 };
    }
  };

  // ── CRUD ──────────────────────────────────────────────────────────────────

  /// Submit a new JFW entry by a manager (ASM or RSM). Returns the new JFW id.
  public func submitJfw(
    jfws       : List.List<JfwRecord>,
    nextJfwId  : { var value : Nat },
    managerId  : UserId,
    input      : JfwInput,
    mrName     : Text,
    now        : Timestamp,
  ) : Nat {
    let id = nextJfwId.value;
    let record : JfwRecord = {
      id                         = id;
      managerId                  = managerId;
      mrId                       = input.mrId;
      var mrName                 = mrName;
      date                       = input.date;
      var areaVisited            = input.areaVisited;
      var stationVisited         = input.stationVisited;
      var doctorsJointlyVisited  = input.doctorsJointlyVisited;
      var observations           = input.observations;
      var rating                 = input.rating;
      var mrAcknowledged         = false;
      var mrAcknowledgedAt       = null;
      createdAt                  = now;
    };
    jfws.add(record);
    nextJfwId.value += 1;
    id
  };

  public func getJfw(
    jfws  : List.List<JfwRecord>,
    jfwId : Nat,
  ) : ?JfwInfo {
    switch (jfws.find(func(r : JfwRecord) : Bool { r.id == jfwId })) {
      case (?r) { ?toInfo(r) };
      case null { null };
    }
  };

  public func listJfwsByManager(
    jfws      : List.List<JfwRecord>,
    managerId : UserId,
    fromDate  : Text,
    toDate    : Text,
  ) : [JfwInfo] {
    jfws.filter(func(r : JfwRecord) : Bool {
      r.managerId == managerId and inRange(r.date, fromDate, toDate)
    }).map<JfwRecord, JfwInfo>(toInfo).toArray()
  };

  public func listJfwsForMR(
    jfws : List.List<JfwRecord>,
    mrId : UserId,
  ) : [JfwInfo] {
    jfws.filter(func(r : JfwRecord) : Bool { r.mrId == mrId })
        .map<JfwRecord, JfwInfo>(toInfo)
        .toArray()
  };

  public func acknowledgeJfw(
    jfws  : List.List<JfwRecord>,
    mrId  : UserId,
    jfwId : Nat,
    now   : Timestamp,
  ) : MutationResult {
    switch (jfws.find(func(r : JfwRecord) : Bool { r.id == jfwId })) {
      case null { #err("JFW not found") };
      case (?r) {
        if (r.mrId != mrId) return #err("Unauthorized: this JFW was not filed for you");
        r.mrAcknowledged    := true;
        r.mrAcknowledgedAt  := ?now;
        #ok
      };
    }
  };

  public func listAllJfws(
    jfws     : List.List<JfwRecord>,
    fromDate : Text,
    toDate   : Text,
  ) : [JfwInfo] {
    jfws.filter(func(r : JfwRecord) : Bool { inRange(r.date, fromDate, toDate) })
        .map<JfwRecord, JfwInfo>(toInfo)
        .toArray()
  };

  public func listTeamJfws(
    jfws       : List.List<JfwRecord>,
    managerIds : [UserId],
    fromDate   : Text,
    toDate     : Text,
  ) : [JfwInfo] {
    jfws.filter(func(r : JfwRecord) : Bool {
      inRange(r.date, fromDate, toDate) and
      (managerIds.find(func(id : UserId) : Bool { id == r.managerId }) != null)
    }).map<JfwRecord, JfwInfo>(toInfo).toArray()
  };

  /// Build the JFW Summary Report grouped by (managerId, mrId).
  public func getJfwSummary(
    jfws         : List.List<JfwRecord>,
    fromDate     : Text,
    toDate       : Text,
    managerNames : [(UserId, Text)],
    mrNames      : [(UserId, Text)],
  ) : [JfwSummaryRow] {
    // Accumulate via mutable List of (managerId, mrId, count, ratingSum)
    let period = fromDate # " to " # toDate;
    // Use a mutable list of accumulators: each entry holds the pair key + running totals
    let acc = List.empty<{ managerId : Nat; mrId : Nat; var count : Nat; var ratingSum : Float }>();

    jfws.forEach(func(r : JfwRecord) {
      if (inRange(r.date, fromDate, toDate)) {
        let rScore = ratingToFloat(r.rating);
        switch (acc.find(func(a : { managerId : Nat; mrId : Nat; var count : Nat; var ratingSum : Float }) : Bool {
          a.managerId == r.managerId and a.mrId == r.mrId
        })) {
          case (?entry) {
            entry.count     += 1;
            entry.ratingSum += rScore;
          };
          case null {
            acc.add({ managerId = r.managerId; mrId = r.mrId; var count = 1; var ratingSum = rScore });
          };
        };
      };
    });

    let rows = List.empty<JfwSummaryRow>();
    acc.forEach(func(a : { managerId : Nat; mrId : Nat; var count : Nat; var ratingSum : Float }) {
      let managerName = switch (managerNames.find(func(pair : (UserId, Text)) : Bool { pair.0 == a.managerId })) {
        case (?(_, n)) { n };
        case null      { "Unknown" };
      };
      let mrName = switch (mrNames.find(func(pair : (UserId, Text)) : Bool { pair.0 == a.mrId })) {
        case (?(_, n)) { n };
        case null      { "Unknown" };
      };
      let avg = if (a.count == 0) 0.0 else a.ratingSum / a.count.toFloat();
      rows.add({
        managerId   = a.managerId;
        managerName = managerName;
        mrId        = a.mrId;
        mrName      = mrName;
        jfwCount    = a.count;
        avgRating   = avg;
        period      = period;
      });
    });
    rows.toArray()
  };
};
