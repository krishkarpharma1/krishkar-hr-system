import Types   "../types/dcr";
import Common  "../types/common";
import List    "mo:core/List";
import Array   "mo:core/Array";
import Nat     "mo:core/Nat";

module {
  public type DcrRecord        = Types.DcrRecord;
  public type DcrInfo          = Types.DcrInfo;
  public type DcrInput         = Types.DcrInput;
  public type DcrApprovalInput = Types.DcrApprovalInput;
  public type DcrSummaryRow    = Types.DcrSummaryRow;
  public type DcrStatus        = Types.DcrStatus;
  public type DcrSettings      = Types.DcrSettings;
  public type DcrSettingsInfo  = Types.DcrSettingsInfo;
  public type UserId           = Common.UserId;
  public type Timestamp        = Common.Timestamp;
  public type MutationResult   = Common.MutationResult;

  // ── Date helpers ─────────────────────────────────────────────────────────

  /// Extract the first n characters of a Text string.
  public func takeChars(t : Text, n : Nat) : Text {
    let chars = t.toArray();
    var result = "";
    var i = 0;
    for (c in chars.values()) {
      if (i < n) { result := result # c.toText() };
      i += 1;
    };
    result
  };

  /// Check if a date falls within [fromDate, toDate] (inclusive, ISO strings).
  private func inRange(date : Text, fromDate : Text, toDate : Text) : Bool {
    date >= fromDate and date <= toDate
  };

  /// Extract hour (0-23) from an IC nanosecond Int timestamp.
  private func hourFromNs(ns : Int) : Nat {
    let secs : Int = ns / 1_000_000_000;
    let secondsInDay : Int = secs - (secs / 86400) * 86400;
    let h : Int = secondsInDay / 3600;
    if (h < 0) 0 else h.toNat()
  };

  /// Extract minute (0-59) from an IC nanosecond Int timestamp.
  private func minuteFromNs(ns : Int) : Nat {
    let secs : Int = ns / 1_000_000_000;
    let secondsInDay : Int = secs - (secs / 86400) * 86400;
    let m : Int = (secondsInDay - (secondsInDay / 3600) * 3600) / 60;
    if (m < 0) 0 else m.toNat()
  };

  // ── Conversion ────────────────────────────────────────────────────────────

  public func toInfo(r : DcrRecord) : DcrInfo {
    {
      id                    = r.id;
      mrId                  = r.mrId;
      date                  = r.date;
      workingType           = r.workingType;
      totalDoctorsVisited   = r.totalDoctorsVisited;
      totalChemistsVisited  = r.totalChemistsVisited;
      totalStockistsVisited = r.totalStockistsVisited;
      stationCovered        = r.stationCovered;
      areaCovered           = r.areaCovered;
      remarks               = r.remarks;
      gpsLocation           = r.gpsLocation;
      status                = r.status;
      isLate                = r.isLate;
      submittedAt           = r.submittedAt;
      approvedBy            = r.approvedBy;
      approvedAt            = r.approvedAt;
      approverRemark        = r.approverRemark;
      createdAt             = r.createdAt;
    }
  };

  // ── Core operations ───────────────────────────────────────────────────────

  /// Submit a DCR for a given MR. Returns the new DCR id, or 0 on duplicate error.
  public func submitDcr(
    dcrs        : List.List<DcrRecord>,
    nextDcrId   : { var value : Nat },
    settings    : DcrSettings,
    mrId        : UserId,
    input       : DcrInput,
    now         : Timestamp,
  ) : Nat {
    switch (dcrs.find(func(r : DcrRecord) : Bool { r.mrId == mrId and r.date == input.date })) {
      case (?existing) {
        if (existing.status == #Draft) {
          existing.workingType           := input.workingType;
          existing.totalDoctorsVisited   := input.totalDoctorsVisited;
          existing.totalChemistsVisited  := input.totalChemistsVisited;
          existing.totalStockistsVisited := input.totalStockistsVisited;
          existing.stationCovered        := input.stationCovered;
          existing.areaCovered           := input.areaCovered;
          existing.remarks               := input.remarks;
          existing.gpsLocation           := input.gpsLocation;
          let late = isLateSubmission(settings, now);
          existing.status      := if (late) #Late else #Submitted;
          existing.submittedAt := ?now;
          existing.id
        } else {
          0 // duplicate — already submitted
        }
      };
      case null {
        let late = isLateSubmission(settings, now);
        let id   = nextDcrId.value;
        let record : DcrRecord = {
          id                          = id;
          mrId                        = mrId;
          date                        = input.date;
          var workingType             = input.workingType;
          var totalDoctorsVisited     = input.totalDoctorsVisited;
          var totalChemistsVisited    = input.totalChemistsVisited;
          var totalStockistsVisited   = input.totalStockistsVisited;
          var stationCovered          = input.stationCovered;
          var areaCovered             = input.areaCovered;
          var remarks                 = input.remarks;
          var gpsLocation             = input.gpsLocation;
          var status                  = if (late) #Late else #Submitted;
          isLate                      = late;
          var submittedAt             = ?now;
          var approvedBy              = null;
          var approvedAt              = null;
          var approverRemark          = "";
          createdAt                   = now;
        };
        dcrs.add(record);
        nextDcrId.value += 1;
        id
      };
    }
  };

  private func isLateSubmission(settings : DcrSettings, now : Int) : Bool {
    if (not settings.isEnabled) return false;
    let h = hourFromNs(now);
    let m = minuteFromNs(now);
    if (h > settings.dailyDeadlineHour) return true;
    if (h == settings.dailyDeadlineHour and m > settings.dailyDeadlineMinute) return true;
    false
  };

  public func getDcr(
    dcrs  : List.List<DcrRecord>,
    dcrId : Nat,
  ) : ?DcrInfo {
    switch (dcrs.find(func(r : DcrRecord) : Bool { r.id == dcrId })) {
      case (?r) { ?toInfo(r) };
      case null { null };
    }
  };

  public func getDcrByMrAndDate(
    dcrs : List.List<DcrRecord>,
    mrId : UserId,
    date : Text,
  ) : ?DcrInfo {
    switch (dcrs.find(func(r : DcrRecord) : Bool { r.mrId == mrId and r.date == date })) {
      case (?r) { ?toInfo(r) };
      case null { null };
    }
  };

  public func listDcrsForMR(
    dcrs     : List.List<DcrRecord>,
    mrId     : UserId,
    fromDate : Text,
    toDate   : Text,
  ) : [DcrInfo] {
    dcrs.filter(func(r : DcrRecord) : Bool {
      r.mrId == mrId and inRange(r.date, fromDate, toDate)
    }).map<DcrRecord, DcrInfo>(toInfo).toArray()
  };

  public func listDcrsForTeam(
    dcrs     : List.List<DcrRecord>,
    mrIds    : [UserId],
    fromDate : Text,
    toDate   : Text,
  ) : [DcrInfo] {
    dcrs.filter(func(r : DcrRecord) : Bool {
      inRange(r.date, fromDate, toDate) and
      (mrIds.find(func(id : UserId) : Bool { id == r.mrId }) != null)
    }).map<DcrRecord, DcrInfo>(toInfo).toArray()
  };

  public func approveDcr(
    dcrs      : List.List<DcrRecord>,
    managerId : UserId,
    input     : DcrApprovalInput,
    now       : Timestamp,
  ) : MutationResult {
    switch (dcrs.find(func(r : DcrRecord) : Bool { r.id == input.dcrId })) {
      case null { #err("DCR not found") };
      case (?r) {
        switch (input.status) {
          case (#Approved or #Rejected) {
            r.status         := input.status;
            r.approvedBy     := ?managerId;
            r.approvedAt     := ?now;
            r.approverRemark := input.remark;
            #ok
          };
          case _ { #err("Invalid approval status: must be #Approved or #Rejected") };
        }
      };
    }
  };

  /// Build the DCR Summary Report (one row per MR per date in range).
  public func getDcrSummary(
    dcrs     : List.List<DcrRecord>,
    mrIds    : [UserId],
    fromDate : Text,
    toDate   : Text,
    mrNames  : [(UserId, Text)],
  ) : [DcrSummaryRow] {
    let rows = List.empty<DcrSummaryRow>();
    for (mrId in mrIds.values()) {
      let mrName = switch (mrNames.find(func(pair : (UserId, Text)) : Bool { pair.0 == mrId })) {
        case (?(_, n)) { n };
        case null      { "Unknown" };
      };
      for (date in dateRange(fromDate, toDate).values()) {
        switch (dcrs.find(func(r : DcrRecord) : Bool { r.mrId == mrId and r.date == date })) {
          case (?r) {
            rows.add({
              mrId           = mrId;
              mrName         = mrName;
              date           = date;
              status         = r.status;
              isLate         = r.isLate;
              totalDoctors   = r.totalDoctorsVisited;
              totalChemists  = r.totalChemistsVisited;
              totalStockists = r.totalStockistsVisited;
            });
          };
          case null {
            rows.add({
              mrId           = mrId;
              mrName         = mrName;
              date           = date;
              status         = #Draft;  // sentinel for "Not Submitted"
              isLate         = false;
              totalDoctors   = 0;
              totalChemists  = 0;
              totalStockists = 0;
            });
          };
        };
      };
    };
    rows.toArray()
  };

  public func getDcrSettings(settings : DcrSettings) : DcrSettingsInfo {
    {
      dailyDeadlineHour   = settings.dailyDeadlineHour;
      dailyDeadlineMinute = settings.dailyDeadlineMinute;
      isEnabled           = settings.isEnabled;
    }
  };

  public func updateDcrSettings(
    settings       : DcrSettings,
    deadlineHour   : ?Nat,
    deadlineMinute : ?Nat,
    isEnabled      : ?Bool,
  ) : MutationResult {
    switch (deadlineHour) {
      case (?h) {
        if (h > 23) return #err("dailyDeadlineHour must be 0-23");
        settings.dailyDeadlineHour := h;
      };
      case null {};
    };
    switch (deadlineMinute) {
      case (?m) {
        if (m > 59) return #err("dailyDeadlineMinute must be 0-59");
        settings.dailyDeadlineMinute := m;
      };
      case null {};
    };
    switch (isEnabled) {
      case (?b) { settings.isEnabled := b };
      case null {};
    };
    #ok
  };

  /// Returns true if the MR checked in on date but has NOT submitted a DCR.
  public func checkPendingDcrForMR(
    dcrs         : List.List<DcrRecord>,
    mrId         : UserId,
    date         : Text,
    hasCheckedIn : Bool,
  ) : Bool {
    if (not hasCheckedIn) return false;
    not hasDcrForDate(dcrs, mrId, date)
  };

  public func hasDcrForDate(
    dcrs : List.List<DcrRecord>,
    mrId : UserId,
    date : Text,
  ) : Bool {
    switch (dcrs.find(func(r : DcrRecord) : Bool { r.mrId == mrId and r.date == date })) {
      case null { false };
      case _ { true };
    }
  };

  /// MTP vs Actual comparison — one row per day in the given month.
  public func getMtpActualComparison(
    dcrs            : List.List<DcrRecord>,
    mrId            : UserId,
    month           : Nat,
    year            : Nat,
    plannedStations : [(Text, Text)],  // (date, plannedStation)
  ) : [{ date : Text; plannedStation : Text; plannedArea : Text; actualStation : Text; actualArea : Text; isDeviation : Bool }] {
    let monthStr    = year.toText() # "-" # (if (month < 10) "0" # month.toText() else month.toText());
    let daysInMonth = daysInMonthFn(month, year);
    let rows = List.empty<{ date : Text; plannedStation : Text; plannedArea : Text; actualStation : Text; actualArea : Text; isDeviation : Bool }>();
    var day = 1;
    while (day <= daysInMonth) {
      let dayStr  = if (day < 10) "0" # day.toText() else day.toText();
      let dateStr = monthStr # "-" # dayStr;
      let planned = switch (plannedStations.find(func(pair : (Text, Text)) : Bool { pair.0 == dateStr })) {
        case (?(_, s)) { s };
        case null      { "" };
      };
      let (actualStation, actualArea) =
        switch (dcrs.find(func(r : DcrRecord) : Bool { r.mrId == mrId and r.date == dateStr })) {
          case (?r) { (r.stationCovered, r.areaCovered) };
          case null { ("", "") };
        };
      let isDeviation = planned != "" and actualStation != "" and planned != actualStation;
      rows.add({ date = dateStr; plannedStation = planned; plannedArea = ""; actualStation; actualArea; isDeviation });
      day += 1;
    };
    rows.toArray()
  };

  // ── Date range iterator ────────────────────────────────────────────────────

  /// Returns ISO date strings from fromDate to toDate inclusive (max 400 days).
  public func dateRange(fromDate : Text, toDate : Text) : [Text] {
    let from = parseDate(fromDate);
    let to   = parseDate(toDate);
    switch (from, to) {
      case (?(fy, fm, fd), ?(ty, tm, td)) {
        let fromJd = toJulianDay(fy, fm, fd);
        let toJd   = toJulianDay(ty, tm, td);
        if (toJd < fromJd) return [];
        let count = toJd - fromJd + 1;
        let limit = if (count > 400) 400 else count;
        let results = List.empty<Text>();
        var i = 0;
        while (i < limit) {
          results.add(fromJulianDay(fromJd + i));
          i += 1;
        };
        results.toArray()
      };
      case _ { [] };
    }
  };

  // ── Date math helpers ──────────────────────────────────────────────────────

  private func parseDate(d : Text) : ?(Nat, Nat, Nat) {
    let chars = d.toArray();
    if (chars.size() < 10) return null;
    let yStr   = takeChars(d, 4);
    let mStr   = chars[5].toText() # chars[6].toText();
    let dayStr = chars[8].toText() # chars[9].toText();
    switch (Nat.fromText(yStr), Nat.fromText(mStr), Nat.fromText(dayStr)) {
      case (?y, ?m, ?day) { ?(y, m, day) };
      case _              { null };
    }
  };

  private func toJulianDay(y : Nat, m : Nat, d : Nat) : Nat {
    let a : Int   = ((14 - m) / 12).toInt();
    let yr : Int  = y.toInt() - a;
    let mo : Int  = m.toInt() + 12 * a - 3;
    let jdn : Int = d.toInt() + (153 * mo + 2) / 5 + 365 * yr + yr / 4 - yr / 100 + yr / 400 + 32045;
    if (jdn < 0) 0 else jdn.toNat()
  };

  private func fromJulianDay(jd : Nat) : Text {
    let j : Int   = jd.toInt();
    let a : Int   = j + 32044;
    let b : Int   = (4 * a + 3) / 146097;
    let c : Int   = a - (146097 * b) / 4;
    let dd : Int  = (4 * c + 3) / 1461;
    let e : Int   = c - (1461 * dd) / 4;
    let mm : Int  = (5 * e + 2) / 153;
    let day : Int = e - (153 * mm + 2) / 5 + 1;
    let mon : Int = mm + 3 - 12 * (mm / 10);
    let yr : Int  = 100 * b + dd - 4800 + mm / 10;
    let yStr = if (yr < 0) "0000" else yr.toNat().toText();
    let mStr = if (mon < 10) "0" # mon.toNat().toText() else mon.toNat().toText();
    let dStr = if (day < 10) "0" # day.toNat().toText() else day.toNat().toText();
    yStr # "-" # mStr # "-" # dStr
  };

  private func daysInMonthFn(month : Nat, year : Nat) : Nat {
    switch (month) {
      case 1  { 31 };
      case 2  { if (isLeapYear(year)) 29 else 28 };
      case 3  { 31 };
      case 4  { 30 };
      case 5  { 31 };
      case 6  { 30 };
      case 7  { 31 };
      case 8  { 31 };
      case 9  { 30 };
      case 10 { 31 };
      case 11 { 30 };
      case 12 { 31 };
      case _  { 30 };
    }
  };

  private func isLeapYear(year : Nat) : Bool {
    (year % 4 == 0 and year % 100 != 0) or (year % 400 == 0)
  };
};
