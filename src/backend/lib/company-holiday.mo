import HolidayTypes "../types/company-holiday";
import List "mo:core/List";
import Time "mo:core/Time";
import Int  "mo:core/Int";

module {
  public type CompanyHoliday    = HolidayTypes.CompanyHoliday;
  public type CreateHolidayInput = HolidayTypes.CreateHolidayInput;
  public type UpdateHolidayInput = HolidayTypes.UpdateHolidayInput;
  public type HolidayExportRow   = HolidayTypes.HolidayExportRow;

  // ── Date helpers ────────────────────────────────────────────────────────────

  /// Extract "YYYY-MM-DD" from a nanosecond Unix timestamp.
  func tsToDate(ts : Int) : Text {
    let secs : Int = ts / 1_000_000_000;
    let days : Int = secs / 86400;
    let z    : Int = days + 719468;
    let era  : Int = (if (z >= 0) z else z - 146096) / 146097;
    let doe  : Int = z - era * 146097;
    let yoe  : Int = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y    : Int = yoe + era * 400;
    let doy  : Int = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp   : Int = (5 * doy + 2) / 153;
    let d    : Int = doy - (153 * mp + 2) / 5 + 1;
    let m    : Int = if (mp < 10) mp + 3 else mp - 9;
    let yr   : Int = if (m <= 2) y + 1 else y;
    let ys = yr.toText();
    let ms = if (m < 10) "0" # m.toText() else m.toText();
    let ds = if (d < 10) "0" # d.toText() else d.toText();
    ys # "-" # ms # "-" # ds
  };

  /// Return the ISO weekday name for a nanosecond timestamp.
  func tsToWeekday(ts : Int) : Text {
    let secs : Int = ts / 1_000_000_000;
    let days : Int = secs / 86400;
    // 1970-01-01 was a Thursday (day index 4 if Mon=0 or day 4 if Sun=0)
    // Using Sun=0: (days + 4) % 7 gives 0=Sun,1=Mon,...,6=Sat
    let dow : Int = Int.rem(days + 4, 7);
    let idx : Nat = if (dow < 0) (dow + 7).toNat() else dow.toNat();
    let names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    if (idx < 7) names[idx] else "Unknown"
  };

  func holidayTypeText(ht : HolidayTypes.HolidayType) : Text {
    switch (ht) {
      case (#NationalHoliday)  "National Holiday";
      case (#FestivalHoliday)  "Festival Holiday";
      case (#RegionalHoliday)  "Regional Holiday";
      case (#OptionalHoliday)  "Optional Holiday";
    }
  };

  func applicableToText(at : HolidayTypes.HolidayApplicableTo) : Text {
    switch (at) {
      case (#AllEmployees)         "All Employees";
      case (#SpecificRoles(roles)) "Specific Roles (" # roles.size().toText() # ")";
      case (#SpecificTerritories(ts)) "Specific Territories (" # ts.size().toText() # ")";
    }
  };

  // ── Add ─────────────────────────────────────────────────────────────────────

  public func addHoliday(
    holidays  : List.List<CompanyHoliday>,
    nextId    : { var value : Nat },
    input     : CreateHolidayInput,
    createdBy : Text,
  ) : { #ok : Nat; #err : Text } {
    let id = nextId.value;
    nextId.value += 1;
    let holiday : CompanyHoliday = {
      id;
      name         = input.name;
      date         = input.date;
      holidayType  = input.holidayType;
      applicableTo = input.applicableTo;
      remarks      = input.remarks;
      isActive     = true;
      createdBy;
      createdAt    = Time.now();
    };
    holidays.add(holiday);
    #ok(id)
  };

  // ── Update ──────────────────────────────────────────────────────────────────

  public func updateHoliday(
    holidays : List.List<CompanyHoliday>,
    input    : UpdateHolidayInput,
  ) : { #ok; #err : Text } {
    let idx = holidays.findIndex(func(h : CompanyHoliday) : Bool { h.id == input.id });
    switch (idx) {
      case null { #err("Holiday not found") };
      case (?i) {
        let old = holidays.at(i);
        let updated : CompanyHoliday = {
          old with
          name         = switch (input.name)        { case (?v) v;   case null old.name        };
          date         = switch (input.date)        { case (?v) v;   case null old.date        };
          holidayType  = switch (input.holidayType) { case (?v) v;   case null old.holidayType };
          applicableTo = switch (input.applicableTo){ case (?v) v;   case null old.applicableTo};
          remarks      = switch (input.remarks)     { case (?v) ?v;  case null old.remarks     };
          isActive     = switch (input.isActive)    { case (?v) v;   case null old.isActive    };
        };
        holidays.put(i, updated);
        #ok
      };
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────────

  public func deleteHoliday(
    holidays : List.List<CompanyHoliday>,
    id       : Nat,
  ) : { #ok; #err : Text } {
    let idx = holidays.findIndex(func(h : CompanyHoliday) : Bool { h.id == id });
    switch (idx) {
      case null { #err("Holiday not found") };
      case (?_) {
        let filtered = holidays.filter(func(h : CompanyHoliday) : Bool { h.id != id });
        holidays.clear();
        holidays.append(filtered);
        #ok
      };
    }
  };

  // ── Deactivate ───────────────────────────────────────────────────────────────

  public func deactivateHoliday(
    holidays : List.List<CompanyHoliday>,
    id       : Nat,
  ) : { #ok; #err : Text } {
    let idx = holidays.findIndex(func(h : CompanyHoliday) : Bool { h.id == id });
    switch (idx) {
      case null { #err("Holiday not found") };
      case (?i) {
        let old = holidays.at(i);
        holidays.put(i, { old with isActive = false });
        #ok
      };
    }
  };

  // ── Queries ──────────────────────────────────────────────────────────────────

  public func getAll(holidays : List.List<CompanyHoliday>) : [CompanyHoliday] {
    holidays.toArray()
  };

  public func getActive(holidays : List.List<CompanyHoliday>) : [CompanyHoliday] {
    holidays.filter(func(h : CompanyHoliday) : Bool { h.isActive }).toArray()
  };

  /// Returns true if any active holiday's date matches the calendar date of `date`
  /// (date is a nanosecond timestamp; we compare YYYY-MM-DD strings).
  public func isHolidayDate(
    holidays : List.List<CompanyHoliday>,
    date     : Int,
  ) : Bool {
    let targetDate = tsToDate(date);
    holidays.any(func(h : CompanyHoliday) : Bool {
      h.isActive and tsToDate(h.date) == targetDate
    })
  };

  /// Returns true if the calendar date of the nanosecond timestamp `ts` falls on a Sunday.
  public func isSunday(ts : Int) : Bool {
    let secs : Int = ts / 1_000_000_000;
    let days : Int = secs / 86400;
    // 1970-01-01 was Thursday. Sun=0: (days + 4) % 7 == 0 means Sunday
    let dow : Int = Int.rem(days + 4, 7);
    dow == 0
  };

  // ── Export ───────────────────────────────────────────────────────────────────

  public func getExportRows(holidays : List.List<CompanyHoliday>) : [HolidayExportRow] {
    var srNo : Nat = 0;
    holidays.map<CompanyHoliday, HolidayExportRow>(func(h) {
      srNo += 1;
      {
        srNo;
        name         = h.name;
        date         = h.date;
        dayOfWeek    = tsToWeekday(h.date);
        holidayType  = holidayTypeText(h.holidayType);
        applicableTo = applicableToText(h.applicableTo);
      }
    }).toArray()
  };
};
