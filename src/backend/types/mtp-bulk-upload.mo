module {
  // ── Bulk MTP Row ─────────────────────────────────────────────────────────────
  /// One row from the uploaded Excel/CSV template.
  /// employeeId and roleContext are optional – used by Admin/HR uploading on behalf of MR.
  public type BulkMtpRow = {
    date              : Text;    // DD-MM-YYYY
    area              : Text;
    typeOfWork        : Text;    // HQ | Ex-Station | Out-Station | Joint Work with Manager
    expectedDoctors   : Nat;
    expectedChemists  : Nat;
    expectedStockists : Nat;
    modeOfTransport   : Text;    // Two Wheeler | Four Wheeler | Auto | Train | Bus | Air
    remarks           : Text;
    employeeId        : ?Text;   // target MR employee id (unused in lib; used at mixin layer)
    roleContext       : ?Text;   // e.g. "MR" (unused in lib; forwarded from mixin)
  };

  // ── Error Row ─────────────────────────────────────────────────────────────
  /// Describes a single invalid row that was skipped during bulk upload.
  public type BulkMtpErrorRow = {
    rowNumber : Nat;
    date      : Text;
    reason    : Text;
  };

  // ── Bulk MTP Result ───────────────────────────────────────────────────────
  /// Returned by bulkCreateTravelPlans.
  public type BulkMtpResult = {
    savedCount     : Nat;
    errorRows      : [BulkMtpErrorRow];
    lateSubmission : Bool;
  };

  // ── Bulk MTP Input ────────────────────────────────────────────────────────
  /// Caller-supplied payload for a bulk upload operation.
  public type BulkMtpInput = {
    month            : Nat;   // 1–12
    year             : Nat;
    rows             : [BulkMtpRow];
    targetEmployeeId : ?Text; // null = self; non-null = Admin/HR uploading for an MR
  };

  // ── Audit Entry ───────────────────────────────────────────────────────────
  /// Recorded whenever Admin or HR uploads an MTP on behalf of an MR.
  public type BulkMtpAuditEntry = {
    id             : Nat;
    uploaderUserId : Nat;
    uploaderName   : Text;
    targetUserId   : Nat;
    targetUserName : Text;
    month          : Nat;
    year           : Nat;
    rowsSaved      : Nat;
    rowsSkipped    : Nat;
    lateSubmission : Bool;
    timestamp      : Int;
  };

  // ── Working Days Result ───────────────────────────────────────────────────
  /// Breakdown of days in a month, excluding Sundays.
  public type WorkingDaysResult = {
    workingDays  : Nat;   // totalDays - sundaysCount
    totalDays    : Nat;
    sundaysCount : Nat;
    holidayCount : Nat;   // always 0 for now (holidays not tracked in this module)
  };
};
