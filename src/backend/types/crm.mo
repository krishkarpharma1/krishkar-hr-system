import Common   "common";
import FieldOps "field-ops";

module {
  public type UserId    = Common.UserId;
  public type Timestamp = Common.Timestamp;
  public type DoctorId  = FieldOps.DoctorId;
  public type ProductId = FieldOps.ProductId;

  // ── IDs ──────────────────────────────────────────────────────────────────
  public type CrmRequestId    = Nat;
  public type SalesTargetId   = Nat;
  public type BusinessReportId = Nat;

  // ── CRM Request Status ───────────────────────────────────────────────────
  public type CrmStatus = {
    #Pending;
    #Approved;
    #Rejected;
  };

  // ── Product Commitment ───────────────────────────────────────────────────
  /// A product the doctor has committed to prescribe/promote
  public type ProductCommitment = {
    productId        : ProductId;
    productName      : Text;
    expectedQuantity : Nat;
  };

  // ── CRM Request ──────────────────────────────────────────────────────────
  public type CrmRequest = {
    id                  : CrmRequestId;
    userId              : UserId;
    doctorId            : DoctorId;
    doctorName          : Text;
    crmAmount           : Float;
    salesTargetId       : ?SalesTargetId;
    productCommitments  : [ProductCommitment];
    var status          : CrmStatus;
    requestNotes        : ?Text;
    var approvedBy      : ?UserId;
    var approvedAt      : ?Timestamp;
    var rejectionReason : ?Text;
    createdAt           : Timestamp;
    var updatedAt       : Timestamp;
  };

  /// Public/shared view of CrmRequest (no mutable fields)
  public type CrmRequestInfo = {
    id                 : CrmRequestId;
    userId             : UserId;
    doctorId           : DoctorId;
    doctorName         : Text;
    crmAmount          : Float;
    salesTargetId      : ?SalesTargetId;
    productCommitments : [ProductCommitment];
    status             : CrmStatus;
    requestNotes       : ?Text;
    approvedBy         : ?UserId;
    approvedAt         : ?Timestamp;
    rejectionReason    : ?Text;
    createdAt          : Timestamp;
    updatedAt          : Timestamp;
  };

  public type CreateCrmRequestInput = {
    doctorId           : DoctorId;
    doctorName         : Text;
    crmAmount          : Float;
    salesTargetId      : ?SalesTargetId;
    productCommitments : [ProductCommitment];
    requestNotes       : ?Text;
  };

  // ── Sales Target ─────────────────────────────────────────────────────────
  public type SalesTarget = {
    id           : SalesTargetId;
    userId       : UserId;
    month        : Nat;    // 1–12
    year         : Nat;
    targetAmount : Float;
    description  : Text;
    createdAt    : Timestamp;
  };

  public type CreateSalesTargetInput = {
    month        : Nat;
    year         : Nat;
    targetAmount : Float;
    description  : Text;
  };

  // ── Business Report ───────────────────────────────────────────────────────
  public type BusinessReport = {
    id                   : BusinessReportId;
    userId               : UserId;
    doctorId             : DoctorId;
    doctorName           : Text;
    linkedCrmRequestId   : ?CrmRequestId;
    month                : Nat;
    year                 : Nat;
    actualSales          : Float;
    prescriptionCount    : Nat;
    reportNotes          : ?Text;
    createdAt            : Timestamp;
  };

  /// Public/shared view of BusinessReport
  public type BusinessReportInfo = {
    id                 : BusinessReportId;
    userId             : UserId;
    doctorId           : DoctorId;
    doctorName         : Text;
    linkedCrmRequestId : ?CrmRequestId;
    month              : Nat;
    year               : Nat;
    actualSales        : Float;
    prescriptionCount  : Nat;
    reportNotes        : ?Text;
    createdAt          : Timestamp;
  };

  public type CreateBusinessReportInput = {
    doctorId           : DoctorId;
    doctorName         : Text;
    linkedCrmRequestId : ?CrmRequestId;
    month              : Nat;
    year               : Nat;
    actualSales        : Float;
    prescriptionCount  : Nat;
    reportNotes        : ?Text;
  };

  // ── Sales Dashboard ───────────────────────────────────────────────────────
  public type SalesTrackingData = {
    doctorId             : DoctorId;
    doctorName           : Text;
    actualSales          : Float;
    crmSpent             : Float;
    salesProgressPercent : Float;
    projectedEndTarget   : Float;
    dailyAvgSales        : Float;
  };

  public type SalesDashboardSummary = {
    totalActualSales      : Float;
    totalCrmSpent         : Float;
    overallProgressPercent : Float;
    doctorBreakdown       : [SalesTrackingData];
  };

  public type MutationResult = Common.MutationResult;

  /// Re-export for convenient access in CRM consumers
  public type ExportFilter = Common.ExportFilter;
};
