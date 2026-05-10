import CommonTypes "common";

module {
  public type UserId    = CommonTypes.UserId;
  public type Timestamp = CommonTypes.Timestamp;
  public type GpsCoord  = CommonTypes.GpsCoord;

  // ── Product enquiry / discussion entry ──────────────────────────────────

  /// One product discussed or enquired about during a Chemist or Stockist visit.
  public type ProductEnquired = {
    productId   : Nat;
    productName : Text;
    enquiryType : Text;  // e.g. "Availability", "Order", "Promotion"
  };

  // ── Chemist Call ─────────────────────────────────────────────────────────

  public type ChemistCallRecord = {
    id               : Nat;
    mrId             : UserId;
    chemistId        : Nat;
    var chemistName  : Text;
    var station      : Text;
    var area         : Text;
    date             : Text;     // ISO date "YYYY-MM-DD"
    var productsEnquired : [ProductEnquired];
    var orderNoted   : Text;
    gpsLocation      : GpsCoord;
    var remarks      : Text;
    createdAt        : Timestamp;
  };

  public type ChemistCallInfo = {
    id              : Nat;
    mrId            : UserId;
    chemistId       : Nat;
    chemistName     : Text;
    station         : Text;
    area            : Text;
    date            : Text;
    productsEnquired : [ProductEnquired];
    orderNoted      : Text;
    gpsLocation     : GpsCoord;
    remarks         : Text;
    createdAt       : Timestamp;
  };

  public type ChemistCallInput = {
    chemistId        : Nat;
    chemistName      : Text;
    station          : Text;
    area             : Text;
    date             : Text;
    productsEnquired : [ProductEnquired];
    orderNoted       : Text;
    gpsLocation      : GpsCoord;
    remarks          : Text;
  };

  // ── Stockist Call ─────────────────────────────────────────────────────────

  public type StockistCallRecord = {
    id                    : Nat;
    mrId                  : UserId;
    stockistId            : Nat;
    var stockistName      : Text;
    var station           : Text;
    var area              : Text;
    date                  : Text;     // ISO date "YYYY-MM-DD"
    var productsDiscussed : [ProductEnquired];
    var orderQty          : Text;    // free-form text e.g. "50 strips of Amox-500"
    gpsLocation           : GpsCoord;
    var remarks           : Text;
    createdAt             : Timestamp;
  };

  public type StockistCallInfo = {
    id               : Nat;
    mrId             : UserId;
    stockistId       : Nat;
    stockistName     : Text;
    station          : Text;
    area             : Text;
    date             : Text;
    productsDiscussed : [ProductEnquired];
    orderQty         : Text;
    gpsLocation      : GpsCoord;
    remarks          : Text;
    createdAt        : Timestamp;
  };

  public type StockistCallInput = {
    stockistId        : Nat;
    stockistName      : Text;
    station           : Text;
    area              : Text;
    date              : Text;
    productsDiscussed : [ProductEnquired];
    orderQty          : Text;
    gpsLocation       : GpsCoord;
    remarks           : Text;
  };

  // ── Coverage report row ───────────────────────────────────────────────────

  /// Aggregated coverage row for Chemist/Stockist Coverage Report.
  public type CoverageRow = {
    mrId         : UserId;
    mrName       : Text;
    station      : Text;
    area         : Text;
    chemistVisits  : Nat;
    stockistVisits : Nat;
    period       : Text;  // "YYYY-MM" or date range label
  };
};
