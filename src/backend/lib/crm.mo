import Types     "../types/crm";
import Common    "../types/common";
import List      "mo:core/List";
import Map       "mo:core/Map";

module {
  public type CrmRequestId       = Types.CrmRequestId;
  public type SalesTargetId      = Types.SalesTargetId;
  public type BusinessReportId   = Types.BusinessReportId;
  public type CrmRequest         = Types.CrmRequest;
  public type CrmRequestInfo     = Types.CrmRequestInfo;
  public type CrmStatus          = Types.CrmStatus;
  public type SalesTarget        = Types.SalesTarget;
  public type BusinessReport     = Types.BusinessReport;
  public type BusinessReportInfo = Types.BusinessReportInfo;
  public type SalesTrackingData  = Types.SalesTrackingData;
  public type SalesDashboardSummary = Types.SalesDashboardSummary;
  public type CreateCrmRequestInput    = Types.CreateCrmRequestInput;
  public type CreateSalesTargetInput   = Types.CreateSalesTargetInput;
  public type CreateBusinessReportInput = Types.CreateBusinessReportInput;
  public type UserId    = Common.UserId;
  public type Timestamp = Common.Timestamp;
  public type MutationResult = Common.MutationResult;

  /// Convert internal CrmRequest to shared info type
  public func crmRequestToInfo(r : CrmRequest) : CrmRequestInfo {
    {
      id                 = r.id;
      userId             = r.userId;
      doctorId           = r.doctorId;
      doctorName         = r.doctorName;
      crmAmount          = r.crmAmount;
      salesTargetId      = r.salesTargetId;
      productCommitments = r.productCommitments;
      status             = r.status;
      requestNotes       = r.requestNotes;
      approvedBy         = r.approvedBy;
      approvedAt         = r.approvedAt;
      rejectionReason    = r.rejectionReason;
      createdAt          = r.createdAt;
      updatedAt          = r.updatedAt;
    }
  };

  /// Convert internal BusinessReport to shared info type
  public func businessReportToInfo(r : BusinessReport) : BusinessReportInfo {
    {
      id                 = r.id;
      userId             = r.userId;
      doctorId           = r.doctorId;
      doctorName         = r.doctorName;
      linkedCrmRequestId = r.linkedCrmRequestId;
      month              = r.month;
      year               = r.year;
      actualSales        = r.actualSales;
      prescriptionCount  = r.prescriptionCount;
      reportNotes        = r.reportNotes;
      createdAt          = r.createdAt;
    }
  };

  /// Create a new CRM money request (ASM and above)
  public func createCrmRequest(
    crmRequests : List.List<CrmRequest>,
    userId      : UserId,
    input       : CreateCrmRequestInput,
    nextId      : { var val : Nat },
    now         : Timestamp,
  ) : CrmRequestId {
    if (input.crmAmount <= 0.0) {
      Runtime.trap("crmAmount must be greater than 0");
    };
    for (pc in input.productCommitments.vals()) {
      if (pc.expectedQuantity == 0) {
        Runtime.trap("productCommitment expectedQuantity must be greater than 0");
      };
    };
    let id = nextId.val;
    let req : CrmRequest = {
      id                  = id;
      userId              = userId;
      doctorId            = input.doctorId;
      doctorName          = input.doctorName;
      crmAmount           = input.crmAmount;
      salesTargetId       = input.salesTargetId;
      productCommitments  = input.productCommitments;
      var status          = #Pending;
      requestNotes        = input.requestNotes;
      var approvedBy      = null;
      var approvedAt      = null;
      var rejectionReason = null;
      createdAt           = now;
      var updatedAt       = now;
    };
    crmRequests.add(req);
    nextId.val += 1;
    id
  };

  /// Get a single CRM request by ID
  public func getCrmRequest(
    crmRequests : List.List<CrmRequest>,
    id          : CrmRequestId,
  ) : ?CrmRequestInfo {
    switch (crmRequests.find(func(r : CrmRequest) : Bool { r.id == id })) {
      case null { null };
      case (?r) { ?crmRequestToInfo(r) };
    }
  };

  /// List CRM requests for a specific user
  public func listMyCrmRequests(
    crmRequests : List.List<CrmRequest>,
    userId      : UserId,
  ) : [CrmRequestInfo] {
    crmRequests
      .filter(func(r : CrmRequest) : Bool { r.userId == userId })
      .map<CrmRequest, CrmRequestInfo>(func(r) { crmRequestToInfo(r) })
      .toArray()
  };

  /// List all CRM requests (HR/Admin view), optionally filtered by status
  public func listAllCrmRequests(
    crmRequests : List.List<CrmRequest>,
    statusFilter : ?CrmStatus,
  ) : [CrmRequestInfo] {
    let filtered = switch (statusFilter) {
      case null { crmRequests.filter(func(_ : CrmRequest) : Bool { true }) };
      case (?s) {
        crmRequests.filter(func(r : CrmRequest) : Bool {
          switch (r.status, s) {
            case (#Pending, #Pending) { true };
            case (#Approved, #Approved) { true };
            case (#Rejected, #Rejected) { true };
            case _ { false };
          }
        })
      };
    };
    filtered.map<CrmRequest, CrmRequestInfo>(func(r) { crmRequestToInfo(r) }).toArray()
  };

  /// Approve a CRM request (HR approval required before visible to managers)
  public func approveCrmRequest(
    crmRequests : List.List<CrmRequest>,
    id          : CrmRequestId,
    approverId  : UserId,
    now         : Timestamp,
  ) : MutationResult {
    switch (crmRequests.find(func(r : CrmRequest) : Bool { r.id == id })) {
      case null { #err("CRM request not found") };
      case (?r) {
        switch (r.status) {
          case (#Approved) { #err("CRM request already approved") };
          case (#Rejected) { #err("CRM request already rejected") };
          case (#Pending) {
            r.status     := #Approved;
            r.approvedBy := ?approverId;
            r.approvedAt := ?now;
            r.updatedAt  := now;
            #ok
          };
        }
      };
    }
  };

  /// Reject a CRM request with reason
  public func rejectCrmRequest(
    crmRequests : List.List<CrmRequest>,
    id          : CrmRequestId,
    approverId  : UserId,
    reason      : Text,
    now         : Timestamp,
  ) : MutationResult {
    switch (crmRequests.find(func(r : CrmRequest) : Bool { r.id == id })) {
      case null { #err("CRM request not found") };
      case (?r) {
        switch (r.status) {
          case (#Approved) { #err("CRM request already approved") };
          case (#Rejected) { #err("CRM request already rejected") };
          case (#Pending) {
            r.status          := #Rejected;
            r.rejectionReason := ?reason;
            r.approvedBy      := ?approverId;
            r.updatedAt       := now;
            #ok
          };
        }
      };
    }
  };

  /// Create a sales target for a user
  public func createSalesTarget(
    salesTargets : List.List<SalesTarget>,
    userId       : UserId,
    input        : CreateSalesTargetInput,
    nextId       : { var val : Nat },
    now          : Timestamp,
  ) : SalesTargetId {
    if (input.targetAmount <= 0.0) {
      Runtime.trap("targetAmount must be greater than 0");
    };
    let id = nextId.val;
    let target : SalesTarget = {
      id           = id;
      userId       = userId;
      month        = input.month;
      year         = input.year;
      targetAmount = input.targetAmount;
      description  = input.description;
      createdAt    = now;
    };
    salesTargets.add(target);
    nextId.val += 1;
    id
  };

  /// List sales targets for a user
  public func listMySalesTargets(
    salesTargets : List.List<SalesTarget>,
    userId       : UserId,
  ) : [SalesTarget] {
    salesTargets
      .filter(func(t : SalesTarget) : Bool { t.userId == userId })
      .toArray()
  };

  /// Create a monthly business report for a doctor
  public func createBusinessReport(
    businessReports : List.List<BusinessReport>,
    userId          : UserId,
    input           : CreateBusinessReportInput,
    nextId          : { var val : Nat },
    now             : Timestamp,
  ) : BusinessReportId {
    let id = nextId.val;
    let report : BusinessReport = {
      id                   = id;
      userId               = userId;
      doctorId             = input.doctorId;
      doctorName           = input.doctorName;
      linkedCrmRequestId   = input.linkedCrmRequestId;
      month                = input.month;
      year                 = input.year;
      actualSales          = input.actualSales;
      prescriptionCount    = input.prescriptionCount;
      reportNotes          = input.reportNotes;
      createdAt            = now;
    };
    businessReports.add(report);
    nextId.val += 1;
    id
  };

  /// Helper: check if business report matches optional month/year filters
  func reportMatchesFilter(r : BusinessReport, month : ?Nat, year : ?Nat) : Bool {
    let monthOk = switch (month) {
      case (?m) { r.month == m };
      case null { true };
    };
    let yearOk = switch (year) {
      case (?y) { r.year == y };
      case null { true };
    };
    monthOk and yearOk
  };

  /// List business reports for the calling user, optionally filtered by month/year
  public func listMyBusinessReports(
    businessReports : List.List<BusinessReport>,
    userId          : UserId,
    month           : ?Nat,
    year            : ?Nat,
  ) : [BusinessReportInfo] {
    businessReports
      .filter(func(r : BusinessReport) : Bool {
        r.userId == userId and reportMatchesFilter(r, month, year)
      })
      .map<BusinessReport, BusinessReportInfo>(func(r) { businessReportToInfo(r) })
      .toArray()
  };

  /// List all business reports (HR/Admin), optionally filtered by userId, month, year
  public func listAllBusinessReports(
    businessReports : List.List<BusinessReport>,
    filterUserId    : ?UserId,
    month           : ?Nat,
    year            : ?Nat,
  ) : [BusinessReportInfo] {
    businessReports
      .filter(func(r : BusinessReport) : Bool {
        let userOk = switch (filterUserId) {
          case (?uid) { r.userId == uid };
          case null { true };
        };
        userOk and reportMatchesFilter(r, month, year)
      })
      .map<BusinessReport, BusinessReportInfo>(func(r) { businessReportToInfo(r) })
      .toArray()
  };

  /// Build the sales dashboard summary for a user in a given month/year.
  /// currentDay: day-of-month (1..31) used for projection; pass 0 to skip projection.
  public func getSalesDashboard(
    businessReports : List.List<BusinessReport>,
    crmRequests     : List.List<CrmRequest>,
    salesTargets    : List.List<SalesTarget>,
    userId          : UserId,
    month           : Nat,
    year            : Nat,
    currentDay      : Nat,
  ) : SalesDashboardSummary {
    // Filter reports for this user/month/year
    let myReports = businessReports.filter(func(r : BusinessReport) : Bool {
      r.userId == userId and r.month == month and r.year == year
    });

    // Approved CRM requests for this user
    let approvedCrm = crmRequests.filter(func(r : CrmRequest) : Bool {
      r.userId == userId and (switch (r.status) { case (#Approved) { true }; case _ { false } })
    });

    // Sales target for this user/month/year
    let targetAmountOpt = salesTargets
      .find(func(t : SalesTarget) : Bool {
        t.userId == userId and t.month == month and t.year == year
      });
    let targetAmount : Float = switch (targetAmountOpt) {
      case null { 0.0 };
      case (?t) { t.targetAmount };
    };

    // Build per-doctor aggregation using a Map keyed by doctorId
    let doctorSales  = Map.empty<Nat, Float>();
    let doctorCrm    = Map.empty<Nat, Float>();
    let doctorNames  = Map.empty<Nat, Text>();

    myReports.forEach(func(r : BusinessReport) {
      let prev = switch (doctorSales.get(r.doctorId)) { case null { 0.0 }; case (?v) { v } };
      doctorSales.add(r.doctorId, prev + r.actualSales);
      doctorNames.add(r.doctorId, r.doctorName);
    });

    approvedCrm.forEach(func(r : CrmRequest) {
      let prev = switch (doctorCrm.get(r.doctorId)) { case null { 0.0 }; case (?v) { v } };
      doctorCrm.add(r.doctorId, prev + r.crmAmount);
      doctorNames.add(r.doctorId, r.doctorName);
    });

    // Totals
    let totalActualSales = doctorSales.foldLeft(0.0, func(acc : Float, _k : Nat, v : Float) : Float { acc + v });
    let totalCrmSpent    = doctorCrm.foldLeft(0.0, func(acc : Float, _k : Nat, v : Float) : Float { acc + v });

    // Overall progress
    let overallProgress = if (targetAmount > 0.0) {
      (totalActualSales / targetAmount) * 100.0
    } else { 0.0 };

    // Days-in-month lookup (approximate; Feb = 28 for simplicity)
    let daysInMonth : Nat = switch (month) {
      case 2 { 28 };
      case (4 or 6 or 9 or 11) { 30 };
      case _ { 31 };
    };

    // Doctor breakdown
    let breakdown = Map.empty<Nat, SalesTrackingData>();
    for ((doctorId, dName) in doctorNames.entries()) {
      let sales = switch (doctorSales.get(doctorId)) { case null { 0.0 }; case (?v) { v } };
      let crm   = switch (doctorCrm.get(doctorId))   { case null { 0.0 }; case (?v) { v } };
      let progress = if (targetAmount > 0.0) { (sales / targetAmount) * 100.0 } else { 0.0 };
      let dailyAvg = if (currentDay > 0) { sales / currentDay.toFloat() } else { 0.0 };
      let projected = if (currentDay > 0) {
        dailyAvg * daysInMonth.toFloat()
      } else { 0.0 };
      breakdown.add(doctorId, {
        doctorId             = doctorId;
        doctorName           = dName;
        actualSales          = sales;
        crmSpent             = crm;
        salesProgressPercent = progress;
        projectedEndTarget   = projected;
        dailyAvgSales        = dailyAvg;
      });
    };

    {
      totalActualSales       = totalActualSales;
      totalCrmSpent          = totalCrmSpent;
      overallProgressPercent = overallProgress;
      doctorBreakdown        = breakdown.values().toArray();
    }
  };
};
