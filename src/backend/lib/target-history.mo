import Types "../types/target-history";
import List   "mo:core/List";

module {
  public type TargetAdjustmentLog    = Types.TargetAdjustmentLog;
  public type TargetAdjustmentFilter = Types.TargetAdjustmentFilter;
  public type UserId                 = Types.UserId;
  public type Timestamp              = Types.Timestamp;
  public type Role                   = Types.Role;
  public type TargetPeriod           = Types.TargetPeriod;

  /// Append a new log entry when a target is created or overridden.
  /// previousValue should be 0.0 for brand-new targets.
  public func appendLog(
    logs          : List.List<TargetAdjustmentLog>,
    userId        : UserId,
    role          : Role,
    period        : TargetPeriod,
    year          : Nat,
    month         : ?Nat,
    previousValue : Float,
    newValue      : Float,
    reason        : ?Text,
    changedBy     : UserId,
    now           : Timestamp,
    nextId        : Nat,
  ) : TargetAdjustmentLog {
    let entry : TargetAdjustmentLog = {
      id            = nextId;
      userId        = userId;
      role          = role;
      period        = period;
      year          = year;
      month         = month;
      previousValue = previousValue;
      newValue      = newValue;
      reason        = reason;
      changedBy     = changedBy;
      changedAt     = now;
    };
    logs.add(entry);
    entry
  };

  /// Return all log entries matching the supplied filter.
  /// Results are sorted newest-first (descending changedAt).
  public func queryLogs(
    logs   : List.List<TargetAdjustmentLog>,
    filter : TargetAdjustmentFilter,
  ) : [TargetAdjustmentLog] {
    let matched = List.empty<TargetAdjustmentLog>();
    for (entry in logs.values()) {
      if (matchesFilter(entry, filter)) {
        matched.add(entry);
      };
    };
    // Sort newest-first
    let arr = matched.toArray();
    arr.sort(func(a : TargetAdjustmentLog, b : TargetAdjustmentLog) : {#less; #equal; #greater} {
      if (a.changedAt > b.changedAt)      { #less }
      else if (a.changedAt < b.changedAt) { #greater }
      else                                { #equal }
    })
  };

  /// Return all log entries for a specific employee (per-employee history tab).
  /// Results are sorted oldest-first (chronological).
  public func getLogsForUser(
    logs   : List.List<TargetAdjustmentLog>,
    userId : UserId,
  ) : [TargetAdjustmentLog] {
    let matched = List.empty<TargetAdjustmentLog>();
    for (entry in logs.values()) {
      if (entry.userId == userId) {
        matched.add(entry);
      };
    };
    let arr = matched.toArray();
    arr.sort(func(a : TargetAdjustmentLog, b : TargetAdjustmentLog) : {#less; #equal; #greater} {
      if (a.changedAt < b.changedAt)      { #less }
      else if (a.changedAt > b.changedAt) { #greater }
      else                                { #equal }
    })
  };

  // ── Private helpers ─────────────────────────────────────────────────────────

  func matchesFilter(entry : TargetAdjustmentLog, f : TargetAdjustmentFilter) : Bool {
    switch (f.userId) {
      case (?uid) { if (entry.userId != uid) return false };
      case null   {};
    };
    switch (f.role) {
      case (?r) { if (entry.role != r) return false };
      case null {};
    };
    switch (f.period) {
      case (?p) { if (entry.period != p) return false };
      case null {};
    };
    switch (f.year) {
      case (?y) { if (entry.year != y) return false };
      case null {};
    };
    switch (f.changedBy) {
      case (?cb) { if (entry.changedBy != cb) return false };
      case null  {};
    };
    // startDate / endDate: compare as ISO strings "YYYY-MM-DD"
    // We derive a comparable date string from changedAt (Int nanoseconds).
    // For simplicity we use integer comparison on changedAt directly vs
    // the epoch nanoseconds implied by the ISO strings if provided.
    // Since we don't have a full date parser, we'll skip date-range filtering
    // when the strings are absent; otherwise do a lexicographic comparison
    // after converting changedAt to a rough YYYY-MM-DD representation.
    switch (f.startDate) {
      case (?sd) {
        let entryDate = timestampToDateString(entry.changedAt);
        if (entryDate < sd) return false;
      };
      case null {};
    };
    switch (f.endDate) {
      case (?ed) {
        let entryDate = timestampToDateString(entry.changedAt);
        if (entryDate > ed) return false;
      };
      case null {};
    };
    true
  };

  /// Convert a nanosecond timestamp to a "YYYY-MM-DD" string (UTC, best-effort).
  func timestampToDateString(ts : Int) : Text {
    // ts is nanoseconds since Unix epoch (1970-01-01)
    let secondsTotal : Int = ts / 1_000_000_000;
    // Days since epoch
    let days : Int = secondsTotal / 86400;
    // Use Gregorian calendar approximation
    var n : Int = days + 719468;
    let era : Int = if (n >= 0) n / 146097 else (n - 146096) / 146097;
    let doe : Int = n - era * 146097;
    let yoe : Int = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y   : Int = yoe + era * 400;
    let doy : Int = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp  : Int = (5 * doy + 2) / 153;
    let d   : Int = doy - (153 * mp + 2) / 5 + 1;
    let m   : Int = if (mp < 10) mp + 3 else mp - 9;
    let yr  : Int = if (m <= 2) y + 1 else y;

    let ys = yr.toText();
    let ms = if (m < 10) "0" # m.toText() else m.toText();
    let ds = if (d < 10) "0" # d.toText() else d.toText();
    ys # "-" # ms # "-" # ds
  };
};
