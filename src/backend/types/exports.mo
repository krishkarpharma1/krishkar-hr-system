import Common "common";

module {
  public type UserId    = Common.UserId;
  public type Timestamp = Common.Timestamp;

  // Re-export ExportFilter from common so callers can import it from here too
  public type ExportFilter = Common.ExportFilter;

  // ── Call Report Export Row ────────────────────────────────────────────────
  /// One row per daily call report — used for the Call Report export.
  public type CallReportExportRow = {
    reportId    : Nat;
    userId      : Text;
    userName    : Text;
    role        : Text;
    date        : Text;
    stationType : Text;
    daAmount    : Nat;      // in paise
    doctorCount : Nat;
    status      : Text;
  };

  // ── Doctor Visit Export Row ───────────────────────────────────────────────
  /// One row per doctor visit entry — flattened from DoctorVisitEntry.
  public type DoctorVisitExportRow = {
    reportId         : Nat;
    userId           : Text;
    userName         : Text;
    role             : Text;
    date             : Text;
    doctorId         : Nat;
    productsDiscussed : [Text];   // product names or IDs as text
    samplesDistributed : [Text];  // "productId:qty" pairs
    giftArticles     : [Text];    // "itemName:qty" pairs
    daAmount         : Nat;       // report-level DA in paise
  };

  // ── Travel Plan Export Row ────────────────────────────────────────────────
  /// One row per travel plan entry.
  public type TravelPlanExportRow = {
    planId         : Nat;
    userId         : Text;
    userName       : Text;
    role           : Text;
    date           : Text;
    plannedStation : Text;
    notes          : Text;
    status         : Text;
  };

  // ── DA Report Row ─────────────────────────────────────────────────────────
  /// One row per day per employee — used for the DA report export.
  public type DaReportRow = {
    userId      : Text;
    userName    : Text;
    role        : Text;
    date        : Text;
    stationType : Text;
    daAmount    : Float;  // converted to rupees for frontend display
  };

  // ── CRM Export Row ────────────────────────────────────────────────────────
  /// One row per CRM request — used for the CRM/Sales report export.
  public type CrmExportRow = {
    requestId   : Nat;
    userId      : Text;
    userName    : Text;
    doctorId    : Nat;
    doctorName  : Text;
    crmAmount   : Float;
    status      : Text;
    products    : [Text];   // "productName:qty" pairs from productCommitments
    salesTarget : Float;    // linked target amount; 0.0 if none
    month       : Text;     // derived from createdAt, "YYYY-MM"
  };

  // ── Leave Export Row ─────────────────────────────────────────────────────
  /// One row per leave application — used for the Leave records export (HR/Admin).
  public type LeaveExportRow = {
    leaveId      : Text;
    employeeId   : Text;
    employeeName : Text;
    role         : Text;
    leaveType    : Text;
    fromDate     : Text;
    toDate       : Text;
    numDays      : Nat;
    reason       : Text;
    status       : Text;
    approverName : ?Text;
    remark       : ?Text;
    appliedAt    : Text;
  };

  // ── Salary Slip Export Row ────────────────────────────────────────────────
  /// One row per employee per month — HR bulk salary slip export.
  public type SalarySlipExportRow = {
    userId       : Text;
    userName     : Text;
    employeeId   : Text;
    designation  : Text;
    month        : Text;   // "YYYY-MM"
    basicPay     : Nat;    // in paise
    hra          : Nat;
    taAllowance  : Nat;
    daAllowance  : Nat;
    grossPay     : Nat;
    pfDeduction  : Nat;
    esiDeduction : Nat;
    netPay       : Nat;
    payableDays  : Nat;
    isApproved   : Bool;
  };
};
