import CommonTypes "common";

module {
  public type HolidayType = {
    #NationalHoliday;
    #FestivalHoliday;
    #RegionalHoliday;
    #OptionalHoliday;
  };

  public type HolidayApplicableTo = {
    #AllEmployees;
    #SpecificRoles       : [CommonTypes.Role];
    #SpecificTerritories : [Text];
  };

  public type CompanyHoliday = {
    id           : Nat;
    name         : Text;
    date         : Int;         // Unix timestamp (nanoseconds)
    holidayType  : HolidayType;
    applicableTo : HolidayApplicableTo;
    remarks      : ?Text;
    isActive     : Bool;
    createdBy    : Text;        // principal / user name of creator
    createdAt    : Int;
  };

  public type CreateHolidayInput = {
    name         : Text;
    date         : Int;
    holidayType  : HolidayType;
    applicableTo : HolidayApplicableTo;
    remarks      : ?Text;
  };

  public type UpdateHolidayInput = {
    id           : Nat;
    name         : ?Text;
    date         : ?Int;
    holidayType  : ?HolidayType;
    applicableTo : ?HolidayApplicableTo;
    remarks      : ?Text;
    isActive     : ?Bool;
  };

  /// Flat row used for Excel / PDF export of the holiday list
  public type HolidayExportRow = {
    srNo        : Nat;
    name        : Text;
    date        : Int;
    dayOfWeek   : Text;   // e.g. "Monday"
    holidayType : Text;   // human-readable label
    applicableTo: Text;   // human-readable label
  };
};
