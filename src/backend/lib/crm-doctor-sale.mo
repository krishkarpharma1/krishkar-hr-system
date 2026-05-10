import Types      "../types/crm-doctor-sale";
import AuthTypes   "../types/auth-users";
import List        "mo:core/List";
import Map         "mo:core/Map";

module {
  public type CrmDoctorSaleRecord       = Types.CrmDoctorSaleRecord;
  public type CrmDoctorSaleId           = Types.CrmDoctorSaleId;
  public type CreateCrmDoctorSaleRequest = Types.CreateCrmDoctorSaleRequest;
  public type CrmDoctorSaleFilter       = Types.CrmDoctorSaleFilter;
  public type UserId                    = Types.UserId;
  public type Timestamp                 = Types.Timestamp;

  /// Check if `uid` is a subordinate of `managerId`.
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

  /// Create a new CRM doctor-wise sale entry.
  /// areaId is resolved from the submitter's user profile (primary area).
  public func createCrmDoctorSale(
    crmDoctorSales : List.List<CrmDoctorSaleRecord>,
    users          : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
    nextId         : { var value : Nat },
    req            : CreateCrmDoctorSaleRequest,
    submittedBy    : UserId,
    now            : Timestamp,
  ) : { #ok : CrmDoctorSaleRecord; #err : Text } {
    // Resolve areaId from the submitter's user profile
    let areaId : Nat = switch (users.get(submittedBy)) {
      case (?u) { if (u.areaIds.size() > 0) u.areaIds[0] else 0 };
      case null { 0 };
    };

    // Calculate total sale value
    var total : Float = 0.0;
    for (p in req.products.values()) { total += p.saleValue };

    let id = nextId.value;
    nextId.value += 1;
    let record : CrmDoctorSaleRecord = {
      id;
      submittedBy;
      doctorId       = req.doctorId;
      saleDate       = req.saleDate;
      areaId;
      products       = req.products;
      totalSaleValue = total;
      createdAt      = now;
    };
    crmDoctorSales.add(record);
    #ok(record)
  };

  /// List CRM doctor-wise sale records with optional filters.
  /// Managers see their subordinates' records; Admin/HR see all.
  public func listCrmDoctorSales(
    crmDoctorSales : List.List<CrmDoctorSaleRecord>,
    users          : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
    filter         : CrmDoctorSaleFilter,
    callerId       : UserId,
    isAdminOrHR    : Bool,
  ) : [CrmDoctorSaleRecord] {
    crmDoctorSales.filter(func(s : CrmDoctorSaleRecord) : Bool {
      // Visibility check
      if (not isAdminOrHR) {
        let ownRecord  = s.submittedBy == callerId;
        let teamRecord = isSubordinate(users, s.submittedBy, callerId);
        if (not ownRecord and not teamRecord) return false;
      };
      switch (filter.submittedBy) {
        case (?uid) { if (s.submittedBy != uid) return false };
        case null {};
      };
      switch (filter.doctorId) {
        case (?did) { if (s.doctorId != did) return false };
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

  /// Get all CRM doctor-wise sale records submitted by a specific employee.
  public func getCrmDoctorSalesByEmployee(
    crmDoctorSales : List.List<CrmDoctorSaleRecord>,
    employeeId     : UserId,
  ) : [CrmDoctorSaleRecord] {
    crmDoctorSales.filter(func(s : CrmDoctorSaleRecord) : Bool {
      s.submittedBy == employeeId
    }).toArray()
  };
};
