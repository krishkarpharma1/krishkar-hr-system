import Types      "../types/secondary-sale";
import StockTypes  "../types/stockist";
import AuthTypes   "../types/auth-users";
import List        "mo:core/List";
import Map         "mo:core/Map";

module {
  public type SecondarySaleRecord       = Types.SecondarySaleRecord;
  public type SecondarySaleId           = Types.SecondarySaleId;
  public type CreateSecondarySaleRequest = Types.CreateSecondarySaleRequest;
  public type SecondarySaleFilter       = Types.SecondarySaleFilter;
  public type UserId                    = Types.UserId;
  public type Timestamp                 = Types.Timestamp;

  /// Create a new secondary sale entry.
  /// areaId and hqId are derived from the submitter's user profile and the stockist record.
  public func createSecondarySale(
    secondarySales : List.List<SecondarySaleRecord>,
    stockists      : Map.Map<StockTypes.StockistId, StockTypes.StockistRecord>,
    users          : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
    nextId         : { var value : Nat },
    req            : CreateSecondarySaleRequest,
    submittedBy    : UserId,
    now            : Timestamp,
  ) : { #ok : SecondarySaleRecord; #err : Text } {
    // Resolve areaId and hqId from submitter's profile
    let (areaId, hqId) : (Nat, Nat) = switch (users.get(submittedBy)) {
      case (?u) {
        let aid = if (u.areaIds.size() > 0) u.areaIds[0] else 0;
        let hid = if (u.hqIds.size() > 0) u.hqIds[0] else 0;
        (aid, hid)
      };
      case null { (0, 0) };
    };

    // Validate stockist exists and is active
    switch (stockists.get(req.stockistId)) {
      case null { return #err("Stockist not found or inactive") };
      case (?s) {
        if (not s.isActive) { return #err("Stockist is inactive") };
      };
    };

    // Calculate total net sale value
    var total : Float = 0.0;
    for (p in req.products.values()) { total += p.netSaleValue };

    let id = nextId.value;
    nextId.value += 1;
    let record : SecondarySaleRecord = {
      id;
      submittedBy;
      stockistId        = req.stockistId;
      saleDate          = req.saleDate;
      areaId;
      hqId;
      products          = req.products;
      totalNetSaleValue = total;
      createdAt         = now;
    };
    secondarySales.add(record);
    #ok(record)
  };

  /// Check if `uid` is a subordinate of `managerId` by walking reportsTo chain.
  func isSubordinate(
    users     : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
    uid       : AuthTypes.UserId,
    managerId : AuthTypes.UserId,
  ) : Bool {
    var current : ?AuthTypes.UserId = switch (users.get(uid)) {
      case (?u) { u.reportsTo };
      case null { null };
    };
    var depth = 0;
    label walk loop {
      if (depth > 10) break walk;
      switch (current) {
        case null { break walk };
        case (?mid) {
          if (mid == managerId) return true;
          current := switch (users.get(mid)) {
            case (?u) { u.reportsTo };
            case null { null };
          };
          depth += 1;
        };
      };
    };
    false
  };

  /// List secondary sale records with optional filters.
  public func listSecondarySales(
    secondarySales : List.List<SecondarySaleRecord>,
    users          : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
    filter         : SecondarySaleFilter,
    callerId       : UserId,
    isAdminOrHR    : Bool,
  ) : [SecondarySaleRecord] {
    secondarySales.filter(func(s : SecondarySaleRecord) : Bool {
      // Visibility: Admin/HR see all; others see their own or team's
      if (not isAdminOrHR) {
        let ownRecord = s.submittedBy == callerId;
        let teamRecord = isSubordinate(users, s.submittedBy, callerId);
        if (not ownRecord and not teamRecord) return false;
      };
      switch (filter.submittedBy) {
        case (?uid) { if (s.submittedBy != uid) return false };
        case null {};
      };
      switch (filter.stockistId) {
        case (?sid) { if (s.stockistId != sid) return false };
        case null {};
      };
      switch (filter.areaId) {
        case (?aid) { if (s.areaId != aid) return false };
        case null {};
      };
      switch (filter.fromDate) {
        case (?fd) { if (s.saleDate < fd) return false };
        case null {};
      };
      switch (filter.toDate) {
        case (?td) { if (s.saleDate > td) return false };
        case null {};
      };
      true
    }).toArray()
  };

  /// Get all secondary sale records for a given employee.
  public func getSecondarySalesByEmployee(
    secondarySales : List.List<SecondarySaleRecord>,
    employeeId     : UserId,
  ) : [SecondarySaleRecord] {
    secondarySales.filter(func(s : SecondarySaleRecord) : Bool {
      s.submittedBy == employeeId
    }).toArray()
  };
};
