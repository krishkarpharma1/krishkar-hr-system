import CommonTypes "common";

module {
  // ── Shared identifiers ────────────────────────────────────────────────────
  public type EmployeeId = Nat;
  public type Timestamp   = Int; // nanoseconds from Time.now()
  public type GpsCoord    = CommonTypes.GpsCoord;

  // ── Leave ─────────────────────────────────────────────────────────────────
  public type LeaveType = {
    #casual;  // CL  – Casual Leave
    #sick;    // SL  – Sick Leave
    #unpaid;  // UPL – Un-Paid Leave (deprecated alias; new code should use #lwp)
    #pl;      // PL  – Privilege Leave / Earned Leave (EL maps here for backward compat)
    #ml;      // ML  – Maternity Leave
    #lwp;     // LWP – Leave Without Pay
    #co;      // CO  – Compensatory Off / Field Leave (FL maps here for backward compat)
  };

  public type LeaveStatus = {
    #pending;
    #approved;
    #rejected;
  };

  public type LeaveApplication = {
    id             : Nat;
    employeeId     : EmployeeId;
    leaveType      : LeaveType;
    fromDate       : Text; // ISO date YYYY-MM-DD
    toDate         : Text;
    numDays        : Nat;
    reason         : Text;
    notes          : ?Text;
    attachmentUrl  : ?Text;   // object-storage URL for supporting document
    status         : LeaveStatus;
    approvedBy     : ?EmployeeId;
    approverId     : ?EmployeeId;  // UserId of approver
    approverRemark : ?Text;
    appliedAt      : Timestamp;
    updatedAt      : Timestamp;
    gpsLocation    : ?GpsCoord;   // GPS when leave was applied
  };

  public type LeaveQuota = {
    employeeId    : EmployeeId;
    year          : Nat;
    casualTotal   : Nat;
    sickTotal     : Nat;
    unpaidTotal   : Nat;   // legacy field (UPL) – kept for backward compat
    plTotal       : Nat;   // PL – Privilege Leave total
    mlTotal       : Nat;   // ML – Maternity Leave total
    lwpTotal      : Nat;   // LWP – Leave Without Pay (0 = unlimited)
    coTotal       : Nat;   // CO – Compensatory Off total
    casualUsed    : Nat;
    sickUsed      : Nat;
    unpaidUsed    : Nat;   // legacy (UPL) used days
    plUsed        : Nat;
    mlUsed        : Nat;
    lwpUsed       : Nat;
    coUsed        : Nat;
  };

  /// Per-role annual leave quota configured by Admin
  public type RoleLeaveQuota = {
    role          : CommonTypes.Role;
    year          : Nat;
    casualTotal   : Nat;
    sickTotal     : Nat;
    unpaidTotal   : Nat;  // legacy UPL – kept for backward compat
    plTotal       : Nat;  // PL – Privilege Leave
    mlTotal       : Nat;  // ML – Maternity Leave
    lwpTotal      : Nat;  // LWP – Leave Without Pay
    coTotal       : Nat;  // CO – Compensatory Off
  };

  /// EL accrual state per employee, updated monthly.
  public type EarnedLeaveAccrual = {
    employeeId   : EmployeeId;
    year         : Nat;
    month        : Nat;  // last month for which accrual was processed
    totalAccrued : Nat;  // total EL accrued so far (1.25/month = 15/year)
  };

  /// Input for submitting a new leave application
  public type ApplyLeaveInput = {
    leaveType     : LeaveType;
    fromDate      : Text;
    toDate        : Text;
    numDays       : Nat;
    reason        : Text;
    notes         : ?Text;
    attachmentUrl : ?Text;
    gpsLocation   : ?GpsCoord;
  };

  /// Input for approving or rejecting a leave application
  public type UpdateLeaveStatusInput = {
    leaveId    : Text;   // stringified Nat leave ID
    status     : LeaveStatus;
    approverId : EmployeeId;
    remark     : ?Text;
  };

  /// Filter parameters for leave queries and exports (HR/Admin)
  public type LeaveFilter = {
    userId    : ?EmployeeId;
    role      : ?CommonTypes.Role;
    month     : ?Nat;
    year      : ?Nat;
    status    : ?LeaveStatus;
    leaveType : ?LeaveType;
  };

  // ── Attendance ─────────────────────────────────────────────────────────────
  public type AttendanceStatus = {
    // Legacy variants — kept for backward compatibility
    #present;
    #absent;
    #halfDay;
    #onLeave;
    // Specific leave-type variants (auto-set from approved leave)
    #onLeaveCL;   // Casual Leave
    #onLeaveSL;   // Sick Leave
    #onLeaveUPL;  // Un-Paid Leave (legacy)
    #onLeavePL;   // Privilege Leave / Earned Leave
    #onLeaveML;   // Maternity Leave
    #onLeaveLWP;  // Leave Without Pay
    #onLeaveCO;   // Compensatory Off / Field Leave
    // Non-working paid day variants
    #weeklyOff;      // Sunday — paid, no deduction
    #companyHoliday; // Company Holiday — paid, no deduction
  };

  public type AttendanceRecord = {
    id                : Nat;
    employeeId        : EmployeeId;
    date              : Text;            // ISO date YYYY-MM-DD
    status            : AttendanceStatus;
    checkInTime       : ?Text;           // HH:MM:SS — set from GPS check-in
    checkInGps        : ?GpsCoord;       // GPS location at check-in
    leaveApplicationId: ?Nat;            // linked leave application (if status = onLeave*)
    holidayId         : ?Nat;            // linked company holiday record (if status = companyHoliday)
    correctedBy       : ?Text;           // employee name / principal of HR who corrected
    correctionRemark  : ?Text;           // reason for manual correction
    correctionAt      : ?Timestamp;      // when the correction was made
    recordedAt        : Timestamp;
  };

  /// Input for HR/Admin manual attendance correction
  public type AttendanceCorrectionInput = {
    employeeId : Nat;
    date       : Text;  // ISO date YYYY-MM-DD
    newStatus  : AttendanceStatus;
    reason     : Text;
  };

  public type MonthlySummary = {
    employeeId    : EmployeeId;
    month         : Nat; // 1-12
    year          : Nat;
    presentDays   : Nat;
    absentDays    : Nat;
    halfDays      : Nat;
    leaveDays     : Nat;
    weeklyOffs    : Nat; // Sundays — paid, no deduction
    holidays      : Nat; // Company Holidays — paid, no deduction
    payableDays   : Nat; // calculated field
  };

  // ── Payroll ────────────────────────────────────────────────────────────────
  public type PayrollRecord = {
    id               : Nat;
    employeeId       : EmployeeId;
    month            : Nat;
    year             : Nat;
    basicPay         : Nat; // in paise (Rs * 100) for integer math
    hra              : Nat;
    taAllowance      : Nat; // fixed monthly TA component only (NOT field reimbursement)
    daAllowance      : Nat; // kept for legacy compatibility; NOT included in grossPay
    grossPay         : Nat; // basicPay + hra + taAllowance (no field DA, no incentives)
    pfDeduction      : Nat; // 12% of basic
    esiDeduction     : Nat; // 0.75% of gross
    advanceRecovery  : Nat; // monthly advance installment deduction (0 if none)
    netPay           : Nat; // grossPay - pfDeduction - esiDeduction - advanceRecovery
    payableDays      : Nat;
    processedAt      : Timestamp;
    processedBy      : EmployeeId;
    isApproved       : Bool; // true once HR has approved; only approved slips are visible to employees
  };

  // ── TA/DA Expense Claims ──────────────────────────────────────────────────
  public type DaRate = {
    #rate250;
    #rate300;
  };

  /// Station type for TA/DA expense entry.
  /// "HQ" → distance=0, DA auto-set to HQ rate (Rs 250), from/to locations hidden.
  /// "ExHQ" | "Outstation" | "Local" → normal entry with from/to and distance.
  public type StationType = {
    #HQ;
    #ExHQ;
    #Outstation;
    #Local;
  };

  public type ExpenseStatus = {
    #pending;
    #approved;
    #rejected;
  };

  public type TaDaExpense = {
    id               : Nat;
    employeeId       : EmployeeId;
    date             : Text; // ISO date YYYY-MM-DD
    stationType      : StationType; // HQ | ExHQ | Outstation | Local
    fromLocation     : ?Text;  // null/empty when stationType = HQ
    toLocation       : ?Text;  // null/empty when stationType = HQ
    distanceKm       : Nat; // 0 when stationType = HQ
    travelAmount     : Nat; // distanceKm * taPerKmPaise → stored in paise; 0 for HQ
    dailyAllowance   : Nat; // DA in paise (from grade config or legacy rates)
    totalAmount      : Nat; // travelAmount + dailyAllowance + lodgingExpense + miscExpense
    purpose          : Text;
    submittedByRole  : Text; // role text of submitter
    status           : ExpenseStatus;
    approvedBy       : ?EmployeeId;
    submittedAt      : Timestamp;
    updatedAt        : Timestamp;
    gpsLocation      : ?GpsCoord;
    // ── New SFA fields (all optional — existing records remain valid) ────────
    modeOfTransport  : ?Text;  // "twoWheeler"|"fourWheeler"|"auto"|"train"|"bus"|"air"
    lodgingExpense   : ?Nat;   // in paise; applicable for Outstation days
    miscExpense      : ?Nat;   // miscellaneous expense in paise
    miscNarration    : ?Text;  // narration for misc expense
    totalClaimAmount : ?Nat;   // auto-calculated total (DA+TA+Lodging+Misc) in paise
    gradeName        : ?Text;  // TA/DA grade used for this claim (from TaDaGrade config)
  };

  // ── Performance ────────────────────────────────────────────────────────────
  public type PerformanceRecord = {
    id             : Nat;
    employeeId     : EmployeeId;
    month          : Nat;
    year           : Nat;
    callsMade      : Nat;
    doctorsVisited : Nat;
    chemistOrders  : Nat;
    totalSales     : Nat; // in paise
    remarks        : Text;
    recordedAt     : Timestamp;
    recordedBy     : EmployeeId;
  };

  // ── Document Storage ───────────────────────────────────────────────────────
  public type DocumentType = {
    #offerLetter;
    #idProof;
    #agreement;
    #other;
  };

  public type EmployeeDocument = {
    id           : Nat;
    employeeId   : EmployeeId;
    documentType : DocumentType;
    fileName     : Text;
    storageUrl   : Text;
    uploadedAt   : Timestamp;
    uploadedBy   : EmployeeId;
  };
};
