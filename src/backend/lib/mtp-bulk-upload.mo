import Types    "../types/mtp-bulk-upload";
import TPTypes  "../types/travel-plan";
import List     "mo:core/List";

module {
  public type BulkMtpRow      = Types.BulkMtpRow;
  public type BulkMtpErrorRow = Types.BulkMtpErrorRow;
  public type BulkMtpResult   = Types.BulkMtpResult;
  public type BulkMtpInput    = Types.BulkMtpInput;
  public type WorkingDaysResult = Types.WorkingDaysResult;
  public type TravelPlanRecord  = TPTypes.TravelPlanRecord;

  // ── Calendar helpers ──────────────────────────────────────────────────────

  public func isLeapYear(year : Nat) : Bool {
    (year % 4 == 0 and year % 100 != 0) or (year % 400 == 0)
  };

  public func daysInMonth(month : Nat, year : Nat) : Nat {
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
      case _  { 0 };
    }
  };

  /// Compute the day-of-week for a given date (0 = Sunday … 6 = Saturday).
  /// Uses the civil-calendar algorithm (Zeller-compatible).
  public func dayOfWeek(year : Nat, month : Nat, day : Nat) : Nat {
    // Shift Jan/Feb to previous year (months 13/14)
    let m : Nat = if (month < 3) month + 12 else month;
    let y : Nat = if (month < 3) (if (year > 0) year - 1 else 0) else year;
    let k : Nat = y % 100;
    let j : Nat = y / 100;
    // Zeller's congruence (Sunday = 0)
    let h : Nat = (day + (13 * (m + 1)) / 5 + k + k / 4 + j / 4 + 5 * j) % 7;
    // Zeller: 0=Sat,1=Sun,2=Mon,...  -> remap to 0=Sun,1=Mon,...,6=Sat
    if (h == 0) 6 else h - 1
  };

  // ── Date helpers ──────────────────────────────────────────────────────────

  /// Parse a "DD-MM-YYYY" string into (day, month, year). Returns null on failure.
  public func parseDdMmYyyy(date : Text) : ?(Nat, Nat, Nat) {
    let parts = date.split(#char '-');
    let arr = List.empty<Text>();
    for (p in parts) { arr.add(p) };
    if (arr.size() != 3) { return null };
    let ddText   = arr.at(0);
    let mmText   = arr.at(1);
    let yyyyText = arr.at(2);
    switch (ddText.toNat(), mmText.toNat(), yyyyText.toNat()) {
      case (?dd, ?mm, ?yyyy) {
        if (dd < 1 or dd > 31 or mm < 1 or mm > 12 or yyyy < 1900) { null }
        else { ?(dd, mm, yyyy) }
      };
      case _ { null };
    }
  };

  /// Format (day, month, year) as "DD-MM-YYYY".
  public func formatDdMmYyyy(day : Nat, month : Nat, year : Nat) : Text {
    let dd = if (day   < 10) "0" # day.toText()   else day.toText();
    let mm = if (month < 10) "0" # month.toText() else month.toText();
    dd # "-" # mm # "-" # year.toText()
  };

  /// Convert (day, month, year) to internal YYYY-MM-DD format used in TravelPlanRecord.
  private func toIsoDate(day : Nat, month : Nat, year : Nat) : Text {
    let dd = if (day   < 10) "0" # day.toText()   else day.toText();
    let mm = if (month < 10) "0" # month.toText() else month.toText();
    year.toText() # "-" # mm # "-" # dd
  };

  // ── Enum validators ───────────────────────────────────────────────────────

  public func isValidTypeOfWork(val : Text) : Bool {
    val == "HQ" or val == "Ex-Station" or
    val == "Out-Station" or val == "Joint Work with Manager"
  };

  public func isValidModeOfTransport(val : Text) : Bool {
    val == "Two Wheeler" or val == "Four Wheeler" or val == "Auto" or
    val == "Train"       or val == "Bus"          or val == "Air"
  };

  // ── Late submission check ─────────────────────────────────────────────────

  /// Returns true if nowNs is past the deadlineDay of the prior month
  /// relative to (month, year). E.g. for month=5/year=2026 the deadline
  /// is 25-Apr-2026. If today is after that date, the submission is late.
  public func isLateSubmission(month : Nat, year : Nat, deadlineDay : Nat, nowNs : Int) : Bool {
    let deadlineMonth : Nat = if (month == 1) 12 else month - 1;
    let deadlineYear  : Nat = if (month == 1) (if (year > 0) year - 1 else 0) else year;

    // Derive today's (day, month, year) from Unix nanosecond timestamp
    let nowSecs   : Int = nowNs / 1_000_000_000;
    let nowDays   : Int = nowSecs / 86400;
    let z   : Int = nowDays + 719468;
    let era : Int = (if (z >= 0) z else z - 146096) / 146097;
    let doe : Int = z - era * 146097;
    let yoe : Int = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y   : Int = yoe + era * 400;
    let doy : Int = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp  : Int = (5 * doy + 2) / 153;
    let curDay    : Nat = (doy - (153 * mp + 2) / 5 + 1).toNat();
    let curMonthI : Int = if (mp < 10) mp + 3 else mp - 9;
    let curYearI  : Int = if (curMonthI <= 2) y + 1 else y;
    let curMonth  : Nat = curMonthI.toNat();
    let curYear   : Nat = curYearI.toNat();

    if (curYear > deadlineYear)  { return true };
    if (curYear < deadlineYear)  { return false };
    if (curMonth > deadlineMonth) { return true };
    if (curMonth < deadlineMonth) { return false };
    curDay > deadlineDay
  };

  // ── Row validator ─────────────────────────────────────────────────────────

  /// Validate a single BulkMtpRow. Returns an error message or null if valid.
  /// seenDates is the list of DD-MM-YYYY dates already accepted in this upload pass.
  public func validateRow(
    row       : BulkMtpRow,
    rowNumber : Nat,
    month     : Nat,
    year      : Nat,
    seenDates : List.List<Text>,
  ) : ?Text {
    switch (parseDdMmYyyy(row.date)) {
      case null {
        return ?("Row " # rowNumber.toText() # ": Date '" # row.date # "' is not a valid DD-MM-YYYY date")
      };
      case (?(dd, mm, yyyy)) {
        if (mm != month or yyyy != year) {
          return ?("Row " # rowNumber.toText() # ": Date '" # row.date # "' does not belong to " # month.toText() # "/" # year.toText())
        };
        if (dd < 1 or dd > daysInMonth(mm, yyyy)) {
          return ?("Row " # rowNumber.toText() # ": Day " # dd.toText() # " is out of range for month " # mm.toText())
        };
      };
    };

    if (row.typeOfWork == "") {
      return ?("Row " # rowNumber.toText() # ": Type of Work is required")
    };
    if (not isValidTypeOfWork(row.typeOfWork)) {
      return ?("Row " # rowNumber.toText() # ": Invalid Type of Work '" # row.typeOfWork # "'. Valid values: HQ, Ex-Station, Out-Station, Joint Work with Manager")
    };

    if (row.modeOfTransport == "") {
      return ?("Row " # rowNumber.toText() # ": Mode of Transport is required")
    };
    if (not isValidModeOfTransport(row.modeOfTransport)) {
      return ?("Row " # rowNumber.toText() # ": Invalid Mode of Transport '" # row.modeOfTransport # "'. Valid values: Two Wheeler, Four Wheeler, Auto, Train, Bus, Air")
    };

    let isDuplicate = seenDates.any(func(d : Text) : Bool { d == row.date });
    if (isDuplicate) {
      return ?("Row " # rowNumber.toText() # ": Duplicate date '" # row.date # "' — each day can only appear once")
    };

    null
  };

  // ── Notes encoder ─────────────────────────────────────────────────────────

  /// Encode all MTP fields into the [MTP|area=…|…] notes format used by the app.
  private func encodeMtpNotes(row : BulkMtpRow) : Text {
    "[MTP|area=" # row.area #
    "|typeOfWork=" # row.typeOfWork #
    "|transport=" # row.modeOfTransport #
    "|expDr=" # row.expectedDoctors.toText() #
    "|expCh=" # row.expectedChemists.toText() #
    "|expSt=" # row.expectedStockists.toText() #
    "|notes=" # row.remarks # "]"
  };

  // ── Core bulk create ──────────────────────────────────────────────────────

  /// Process all rows from BulkMtpInput, validate them, build TravelPlanRecord
  /// objects for valid rows, and return (BulkMtpResult, [TravelPlanRecord]).
  /// The caller must add the returned records to stable storage.
  /// Callers should delete existing Draft records for the month before calling
  /// this function to achieve overwrite semantics.
  public func bulkCreateTravelPlans(
    userId      : Nat,
    input       : BulkMtpInput,
    nextPlanId  : { var val : Nat },
    nowNs       : Int,
    deadlineDay : Nat,
  ) : (BulkMtpResult, [TravelPlanRecord]) {
    let lateSubmission = isLateSubmission(input.month, input.year, deadlineDay, nowNs);

    let errorRows  = List.empty<BulkMtpErrorRow>();
    let newRecords = List.empty<TravelPlanRecord>();
    let seenDates  = List.empty<Text>();

    var rowNum : Nat = 1;
    for (row in input.rows.values()) {
      switch (validateRow(row, rowNum, input.month, input.year, seenDates)) {
        case (?errMsg) {
          errorRows.add({ rowNumber = rowNum; date = row.date; reason = errMsg });
        };
        case null {
          let isoDate : Text = switch (parseDdMmYyyy(row.date)) {
            case (?(dd, mm, yyyy)) { toIsoDate(dd, mm, yyyy) };
            case null { row.date };  // fallback (validation already passed)
          };

          let record : TravelPlanRecord = {
            id                      = nextPlanId.val;
            userId                  = userId;
            var date                = isoDate;
            var plannedStation      = row.area;
            var notes               = encodeMtpNotes(row);
            var status              = #Draft;
            createdAt               = nowNs;
            var updatedAt           = nowNs;
            var primaryStation      = "";
            var additionalStations  = [];
          };
          newRecords.add(record);
          seenDates.add(row.date);
          nextPlanId.val += 1;
        };
      };
      rowNum += 1;
    };

    let result : BulkMtpResult = {
      savedCount     = newRecords.size();
      errorRows      = errorRows.toArray();
      lateSubmission;
    };
    (result, newRecords.toArray())
  };

  // ── Working days calculator ───────────────────────────────────────────────

  /// Count working days in a month, excluding Sundays.
  public func countWorkingDaysInMonth(month : Nat, year : Nat) : WorkingDaysResult {
    let total   = daysInMonth(month, year);
    var sundays : Nat = 0;
    var d : Nat = 1;
    while (d <= total) {
      if (dayOfWeek(year, month, d) == 0) {
        sundays += 1;
      };
      d += 1;
    };
    {
      workingDays  = total - sundays;
      totalDays    = total;
      sundaysCount = sundays;
      holidayCount = 0;
    }
  };
};
