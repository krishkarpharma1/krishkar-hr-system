import HRCoreTypes  "../types/hr-core";
import CommonTypes  "../types/common";
import GpsTrailTypes "../types/gps-trail";
import AuthTypes     "../types/auth-users";
import AuthLib      "auth-users";
import ExportTypes   "../types/exports";
import List    "mo:core/List";
import Iter    "mo:core/Iter";
import Time    "mo:core/Time";
import Nat     "mo:core/Nat";
import Map     "mo:core/Map";
import Array   "mo:core/Array";

module {
  // ── Type Aliases ───────────────────────────────────────────────────────────
  public type EmployeeId        = HRCoreTypes.EmployeeId;
  public type LeaveApplication  = HRCoreTypes.LeaveApplication;
  public type LeaveQuota        = HRCoreTypes.LeaveQuota;
  public type AttendanceRecord  = HRCoreTypes.AttendanceRecord;
  public type MonthlySummary    = HRCoreTypes.MonthlySummary;
  public type PayrollRecord     = HRCoreTypes.PayrollRecord;
  public type TaDaExpense       = HRCoreTypes.TaDaExpense;
  public type PerformanceRecord = HRCoreTypes.PerformanceRecord;
  public type EmployeeDocument  = HRCoreTypes.EmployeeDocument;
  public type LeaveType         = HRCoreTypes.LeaveType;
  public type LeaveStatus       = HRCoreTypes.LeaveStatus;
  public type AttendanceStatus  = HRCoreTypes.AttendanceStatus;
  public type ExpenseStatus     = HRCoreTypes.ExpenseStatus;
  public type DaRate            = HRCoreTypes.DaRate;
  public type DocumentType      = HRCoreTypes.DocumentType;
  public type ApplyLeaveInput   = HRCoreTypes.ApplyLeaveInput;
  public type UpdateLeaveStatusInput = HRCoreTypes.UpdateLeaveStatusInput;
  public type LeaveFilter       = HRCoreTypes.LeaveFilter;
  public type RoleLeaveQuota    = HRCoreTypes.RoleLeaveQuota;
  public type LeaveExportRow    = ExportTypes.LeaveExportRow;

  // ── Helpers ────────────────────────────────────────────────────────────────

  /// Extract YYYY from a "YYYY-MM-DD" date string
  func dateYear(date : Text) : Nat {
    let parts = date.split(#char '-');
    let arr = parts.toArray();
    if (arr.size() < 1) return 0;
    switch (Nat.fromText(arr[0])) {
      case (?y) y;
      case null 0;
    };
  };

  /// Extract MM (1-12) from a "YYYY-MM-DD" date string
  func dateMonth(date : Text) : Nat {
    let parts = date.split(#char '-');
    let arr = parts.toArray();
    if (arr.size() < 2) return 0;
    switch (Nat.fromText(arr[1])) {
      case (?m) m;
      case null 0;
    };
  };

  // ── Leave Management ───────────────────────────────────────────────────────

  /// Apply for leave (legacy — use applyLeaveV2 for new code)
  public func applyLeave(
    leaves      : List.List<LeaveApplication>,
    nextId      : Nat,
    employeeId  : EmployeeId,
    leaveType   : LeaveType,
    fromDate    : Text,
    toDate      : Text,
    reason      : Text,
    gpsLocation : ?HRCoreTypes.GpsCoord,
  ) : LeaveApplication {
    let now = Time.now();
    let app : LeaveApplication = {
      id             = nextId;
      employeeId;
      leaveType;
      fromDate;
      toDate;
      numDays        = 1;
      reason;
      notes          = null;
      attachmentUrl  = null;
      status         = #pending;
      approvedBy     = null;
      approverId     = null;
      approverRemark = null;
      appliedAt      = now;
      updatedAt      = now;
      gpsLocation;
    };
    leaves.add(app);
    app;
  };

  /// Approve or reject a leave application (legacy — use updateLeaveStatusV2)
  public func updateLeaveStatus(
    leaves     : List.List<LeaveApplication>,
    leaveId    : Nat,
    status     : LeaveStatus,
    approvedBy : EmployeeId,
  ) : Bool {
    var found = false;
    leaves.mapInPlace(func(app) {
      if (app.id == leaveId and app.status == #pending) {
        found := true;
        { app with status; approvedBy = ?approvedBy; approverId = ?approvedBy; updatedAt = Time.now() };
      } else { app };
    });
    found;
  };

  /// Get all leave applications for an employee
  public func getEmployeeLeaves(
    leaves     : List.List<LeaveApplication>,
    employeeId : EmployeeId,
  ) : [LeaveApplication] {
    leaves.filter(func(a) { a.employeeId == employeeId }).toArray();
  };

  /// Get all pending leave applications (for approvers)
  public func getPendingLeaves(
    leaves : List.List<LeaveApplication>,
  ) : [LeaveApplication] {
    leaves.filter(func(a) { a.status == #pending }).toArray();
  };

  /// Get leave balance for employee in a year
  public func getLeaveBalance(
    quotas     : List.List<LeaveQuota>,
    employeeId : EmployeeId,
    year       : Nat,
  ) : ?LeaveQuota {
    quotas.find(func(q) { q.employeeId == employeeId and q.year == year });
  };

  /// Set annual leave quota for an employee (upsert)
  public func setLeaveQuota(
    quotas      : List.List<LeaveQuota>,
    employeeId  : EmployeeId,
    year        : Nat,
    casualTotal : Nat,
    sickTotal   : Nat,
    unpaidTotal : Nat,
  ) : () {
    let existing = quotas.findIndex(func(q) { q.employeeId == employeeId and q.year == year });
    switch (existing) {
      case (?idx) {
        let old = quotas.at(idx);
        quotas.put(idx, { old with casualTotal; sickTotal; unpaidTotal });
      };
      case null {
        quotas.add({
          employeeId;
          year;
          casualTotal;
          sickTotal;
          unpaidTotal;
          plTotal    = 0;
          mlTotal    = 0;
          lwpTotal   = 0;
          coTotal    = 0;
          casualUsed = 0;
          sickUsed   = 0;
          unpaidUsed = 0;
          plUsed     = 0;
          mlUsed     = 0;
          lwpUsed    = 0;
          coUsed     = 0;
        });
      };
    };
  };

  // ── Attendance ─────────────────────────────────────────────────────────────

  /// Record attendance for an employee on a date (upsert by date)
  public func recordAttendance(
    attendance : List.List<AttendanceRecord>,
    nextId     : Nat,
    employeeId : EmployeeId,
    date       : Text,
    status     : AttendanceStatus,
  ) : AttendanceRecord {
    let existing = attendance.findIndex(func(r) {
      r.employeeId == employeeId and r.date == date
    });
    switch (existing) {
      case (?idx) {
        let old = attendance.at(idx);
        let updated = { old with status; recordedAt = Time.now() };
        attendance.put(idx, updated);
        updated;
      };
      case null {
        let rec : AttendanceRecord = {
          id                 = nextId;
          employeeId;
          date;
          status;
          checkInTime        = null;
          checkInGps         = null;
          leaveApplicationId = null;
          holidayId          = null;
          correctedBy        = null;
          correctionRemark   = null;
          correctionAt       = null;
          recordedAt         = Time.now();
        };
        attendance.add(rec);
        rec;
      };
    };
  };

  /// Get attendance records for an employee in a month/year
  public func getMonthlyAttendance(
    attendance : List.List<AttendanceRecord>,
    employeeId : EmployeeId,
    month      : Nat,
    year       : Nat,
  ) : [AttendanceRecord] {
    attendance.filter(func(r) {
      r.employeeId == employeeId and
      dateYear(r.date) == year and
      dateMonth(r.date) == month
    }).toArray();
  };

  /// Compute monthly attendance summary including payable days
  public func computeMonthlySummary(
    attendance : List.List<AttendanceRecord>,
    _leaves    : List.List<LeaveApplication>,
    employeeId : EmployeeId,
    month      : Nat,
    year       : Nat,
  ) : MonthlySummary {
    let recs = attendance.filter(func(r) {
      r.employeeId == employeeId and
      dateYear(r.date) == year and
      dateMonth(r.date) == month
    });

    var present    : Nat = 0;
    var absent     : Nat = 0;
    var halfDays   : Nat = 0;
    var onLeave    : Nat = 0;
    var weeklyOffs : Nat = 0;
    var holidays   : Nat = 0;

    recs.forEach(func(r : AttendanceRecord) {
      switch (r.status) {
        case (#present)        { present    += 1 };
        case (#absent)         { absent     += 1 };
        case (#halfDay)        { halfDays   += 1 };
        case (#onLeave)        { onLeave    += 1 };
        case (#onLeaveCL)      { onLeave    += 1 };
        case (#onLeaveSL)      { onLeave    += 1 };
        case (#onLeaveUPL)     { onLeave    += 1 };
        case (#onLeavePL)      { onLeave    += 1 };
        case (#onLeaveML)      { onLeave    += 1 };
        case (#onLeaveLWP)     { onLeave    += 1 };
        case (#onLeaveCO)      { onLeave    += 1 };

        case (#weeklyOff)      { weeklyOffs += 1 };
        case (#companyHoliday) { holidays   += 1 };
      };
    });

    // payable = present + halfDays/2 + onLeave + weeklyOffs + holidays
    let payable = present + (halfDays / 2) + onLeave + weeklyOffs + holidays;

    {
      employeeId;
      month;
      year;
      presentDays = present;
      absentDays  = absent;
      halfDays    = halfDays;
      leaveDays   = onLeave;
      weeklyOffs  = weeklyOffs;
      holidays    = holidays;
      payableDays = payable;
    };
  };

  // ── Payroll ────────────────────────────────────────────────────────────────

  /// Process monthly payroll for an employee.
  /// grossPay = basicPay + hra + taAllowance  (field DA and incentives are excluded — separate sheets).
  /// netPay   = grossPay - pfDeduction - esiDeduction - advanceRecovery.
  public func processPayroll(
    payrollList       : List.List<PayrollRecord>,
    nextId            : Nat,
    attendance        : List.List<AttendanceRecord>,
    leaves            : List.List<LeaveApplication>,
    employeeId        : EmployeeId,
    month             : Nat,
    year              : Nat,
    basicPay          : Nat,
    hra               : Nat,
    taAllowance       : Nat,
    daAllowance       : Nat, // stored for reference only; NOT added to grossPay
    advanceRecovery   : Nat, // monthly installment deduction from employee advances
    processedBy       : EmployeeId,
  ) : PayrollRecord {
    let summary = computeMonthlySummary(attendance, leaves, employeeId, month, year);

    // PF = 12% of basicPay
    let pfDeduction  = (basicPay * 12) / 100;
    // Gross = basic + hra + fixed TA component only (no field DA, no incentives)
    let grossPay     = basicPay + hra + taAllowance;
    // ESI = 0.75% of gross (stored * 100 to avoid fractions → divide by 10000)
    let esiDeduction = (grossPay * 75) / 10000;
    let totalDeductions = pfDeduction + esiDeduction + advanceRecovery;
    let netPay = if (grossPay > totalDeductions) { grossPay - totalDeductions } else { 0 };

    let rec : PayrollRecord = {
      id              = nextId;
      employeeId;
      month;
      year;
      basicPay;
      hra;
      taAllowance;
      daAllowance;
      grossPay;
      pfDeduction;
      esiDeduction;
      advanceRecovery;
      netPay;
      payableDays     = summary.payableDays;
      processedAt     = Time.now();
      processedBy;
      isApproved      = true;
    };
    payrollList.add(rec);
    rec;
  };

  /// Get payroll record for employee in a month/year
  public func getPayrollRecord(
    payrollList : List.List<PayrollRecord>,
    employeeId  : EmployeeId,
    month       : Nat,
    year        : Nat,
  ) : ?PayrollRecord {
    payrollList.find(func(r) { r.employeeId == employeeId and r.month == month and r.year == year });
  };

  /// Get all payroll records for an employee
  public func getEmployeePayrollHistory(
    payrollList : List.List<PayrollRecord>,
    employeeId  : EmployeeId,
  ) : [PayrollRecord] {
    payrollList.filter(func(r) { r.employeeId == employeeId }).toArray();
  };

  // ── TA/DA Expense Claims ──────────────────────────────────────────────────

  /// Submit a TA/DA expense claim
  /// HQ DA rate in paise (Rs 250 = 25000 paise). Used for HQ station type auto-fill.
  public let hqDaRatePaise : Nat = 25000;

  /// Human-readable HQ DA rate in Rupees.
  public let hqDaRateRs : Nat = 250;

  public func submitExpense(
    expenses        : List.List<TaDaExpense>,
    nextId          : Nat,
    employeeId      : EmployeeId,
    date            : Text,
    stationType     : HRCoreTypes.StationType,
    fromLoc         : ?Text,
    toLoc           : ?Text,
    distanceKm      : Nat,
    daRate          : DaRate,
    purpose         : Text,
    submittedByRole : Text,
    gpsLocation     : ?HRCoreTypes.GpsCoord,
  ) : TaDaExpense {
    // When stationType is HQ: distance=0, DA=HQ rate (Rs 250), from/to locations cleared.
    let (effectiveDistance, effectiveFromLoc, effectiveToLoc, effectiveDa) : (Nat, ?Text, ?Text, Nat) =
      switch (stationType) {
        case (#HQ) {
          (0, null, null, hqDaRatePaise)
        };
        case _ {
          // Non-HQ: DA from provided rate
          let da = switch (daRate) {
            case (#rate250) 25000;
            case (#rate300) 30000;
          };
          (distanceKm, fromLoc, toLoc, da)
        };
      };
    // Travel: Rs 2.75/km → stored in paise: 275 paise/km; 0 for HQ
    let travelAmount = effectiveDistance * 275;
    let totalAmount  = travelAmount + effectiveDa;
    let now = Time.now();
    let exp : TaDaExpense = {
      id               = nextId;
      employeeId;
      date;
      stationType;
      fromLocation     = effectiveFromLoc;
      toLocation       = effectiveToLoc;
      distanceKm       = effectiveDistance;
      travelAmount;
      dailyAllowance   = effectiveDa;
      totalAmount;
      purpose;
      submittedByRole;
      status           = #pending;
      approvedBy       = null;
      submittedAt      = now;
      updatedAt        = now;
      gpsLocation;
      modeOfTransport  = null;
      lodgingExpense   = null;
      miscExpense      = null;
      miscNarration    = null;
      totalClaimAmount = null;
      gradeName        = null;
    };
    expenses.add(exp);
    exp;
  };

  /// Approve or reject a TA/DA expense claim
  public func updateExpenseStatus(
    expenses   : List.List<TaDaExpense>,
    expenseId  : Nat,
    status     : ExpenseStatus,
    approvedBy : EmployeeId,
  ) : Bool {
    var found = false;
    expenses.mapInPlace(func(e) {
      if (e.id == expenseId and e.status == #pending) {
        found := true;
        { e with status; approvedBy = ?approvedBy; updatedAt = Time.now() };
      } else { e };
    });
    found;
  };

  /// Get all expenses for an employee
  public func getEmployeeExpenses(
    expenses   : List.List<TaDaExpense>,
    employeeId : EmployeeId,
  ) : [TaDaExpense] {
    expenses.filter(func(e) { e.employeeId == employeeId }).toArray();
  };

  /// Submit a TA/DA expense claim with full SFA fields (grade-based, transport, lodging, misc).
  /// All new fields are optional; existing claims remain valid.
  public func submitExpenseV2(
    expenses         : List.List<TaDaExpense>,
    nextId           : Nat,
    employeeId       : EmployeeId,
    date             : Text,
    stationType      : HRCoreTypes.StationType,
    fromLoc          : ?Text,
    toLoc            : ?Text,
    distanceKm       : Nat,
    daRate           : DaRate,
    purpose          : Text,
    submittedByRole  : Text,
    gpsLocation      : ?HRCoreTypes.GpsCoord,
    modeOfTransport  : ?Text,
    lodgingExpense   : ?Nat,
    miscExpense      : ?Nat,
    miscNarration    : ?Text,
    gradeName        : ?Text,
    taPerKmPaise     : Nat, // 275 if no grade config, else from grade
    daOverridePaise  : Nat, // 0 = use daRate legacy; >0 = use this grade-derived amount
  ) : TaDaExpense {
    let (effectiveDistance, effectiveFromLoc, effectiveToLoc, effectiveDa) : (Nat, ?Text, ?Text, Nat) =
      switch (stationType) {
        case (#HQ) { (0, null, null, if (daOverridePaise > 0) daOverridePaise else hqDaRatePaise) };
        case _ {
          let da = if (daOverridePaise > 0) daOverridePaise else switch (daRate) {
            case (#rate250) 25000;
            case (#rate300) 30000;
          };
          (distanceKm, fromLoc, toLoc, da)
        };
      };
    let travelAmount = effectiveDistance * taPerKmPaise;
    let lodging      = switch (lodgingExpense) { case (?l) l; case null 0 };
    let misc         = switch (miscExpense)    { case (?m) m; case null 0 };
    let total        = travelAmount + effectiveDa + lodging + misc;
    let now = Time.now();
    let exp : TaDaExpense = {
      id               = nextId;
      employeeId;
      date;
      stationType;
      fromLocation     = effectiveFromLoc;
      toLocation       = effectiveToLoc;
      distanceKm       = effectiveDistance;
      travelAmount;
      dailyAllowance   = effectiveDa;
      totalAmount      = total;
      purpose;
      submittedByRole;
      status           = #pending;
      approvedBy       = null;
      submittedAt      = now;
      updatedAt        = now;
      gpsLocation;
      modeOfTransport;
      lodgingExpense;
      miscExpense;
      miscNarration;
      totalClaimAmount = ?total;
      gradeName;
    };
    expenses.add(exp);
    exp;
  };

  /// Get all pending expense claims (for approvers)
  public func getPendingExpenses(
    expenses : List.List<TaDaExpense>,
  ) : [TaDaExpense] {
    expenses.filter(func(e) { e.status == #pending }).toArray();
  };

  // ── Performance ────────────────────────────────────────────────────────────

  /// Add or update a performance record for an employee (upsert by month/year)
  public func upsertPerformance(
    records        : List.List<PerformanceRecord>,
    nextId         : Nat,
    employeeId     : EmployeeId,
    month          : Nat,
    year           : Nat,
    callsMade      : Nat,
    doctorsVisited : Nat,
    chemistOrders  : Nat,
    totalSales     : Nat,
    remarks        : Text,
    recordedBy     : EmployeeId,
  ) : PerformanceRecord {
    let existing = records.findIndex(func(r) {
      r.employeeId == employeeId and r.month == month and r.year == year
    });
    switch (existing) {
      case (?idx) {
        let old = records.at(idx);
        let updated = {
          old with
          callsMade;
          doctorsVisited;
          chemistOrders;
          totalSales;
          remarks;
          recordedAt = Time.now();
          recordedBy;
        };
        records.put(idx, updated);
        updated;
      };
      case null {
        let rec : PerformanceRecord = {
          id             = nextId;
          employeeId;
          month;
          year;
          callsMade;
          doctorsVisited;
          chemistOrders;
          totalSales;
          remarks;
          recordedAt     = Time.now();
          recordedBy;
        };
        records.add(rec);
        rec;
      };
    };
  };

  /// Get performance record for employee in a month/year
  public func getPerformanceRecord(
    records    : List.List<PerformanceRecord>,
    employeeId : EmployeeId,
    month      : Nat,
    year       : Nat,
  ) : ?PerformanceRecord {
    records.find(func(r) { r.employeeId == employeeId and r.month == month and r.year == year });
  };

  /// Get all performance records for an employee
  public func getEmployeePerformanceHistory(
    records    : List.List<PerformanceRecord>,
    employeeId : EmployeeId,
  ) : [PerformanceRecord] {
    records.filter(func(r) { r.employeeId == employeeId }).toArray();
  };

  // ── Document Storage ───────────────────────────────────────────────────────

  /// Add a document record for an employee
  public func addDocument(
    documents    : List.List<EmployeeDocument>,
    nextId       : Nat,
    employeeId   : EmployeeId,
    documentType : DocumentType,
    fileName     : Text,
    storageUrl   : Text,
    uploadedBy   : EmployeeId,
  ) : EmployeeDocument {
    let doc : EmployeeDocument = {
      id           = nextId;
      employeeId;
      documentType;
      fileName;
      storageUrl;
      uploadedAt   = Time.now();
      uploadedBy;
    };
    documents.add(doc);
    doc;
  };

  /// Get all documents for an employee
  public func getEmployeeDocuments(
    documents  : List.List<EmployeeDocument>,
    employeeId : EmployeeId,
  ) : [EmployeeDocument] {
    documents.filter(func(d) { d.employeeId == employeeId }).toArray();
  };

  /// Delete a document by ID
  public func deleteDocument(
    documents  : List.List<EmployeeDocument>,
    documentId : Nat,
  ) : Bool {
    let existing = documents.findIndex(func(d) { d.id == documentId });
    switch (existing) {
      case (?_) {
        let updated = documents.filter(func(d) { d.id != documentId });
        documents.clear();
        documents.append(updated);
        true;
      };
      case null { false };
    };
  };

  /// Apply for leave using structured input — new v2 of applyLeave.
  /// When the submitter has the HRManager role, the application routes directly
  /// to Admin for approval (status remains #pending so it appears in Admin queue).
  /// Returns the created LeaveApplication.
  public func applyLeaveV2(
    leaves     : List.List<LeaveApplication>,
    nextId     : Nat,
    employeeId : EmployeeId,
    input      : ApplyLeaveInput,
  ) : LeaveApplication {
    let now = Time.now();
    let app : LeaveApplication = {
      id             = nextId;
      employeeId;
      leaveType      = input.leaveType;
      fromDate       = input.fromDate;
      toDate         = input.toDate;
      numDays        = input.numDays;
      reason         = input.reason;
      notes          = input.notes;
      attachmentUrl  = input.attachmentUrl;
      status         = #pending;
      approvedBy     = null;
      approverId     = null;
      approverRemark = null;
      appliedAt      = now;
      updatedAt      = now;
      gpsLocation    = input.gpsLocation;
    };
    leaves.add(app);
    app;
  };

  /// Apply for leave — HR role overload that explicitly routes to Admin.
  /// Identical to applyLeaveV2 in storage but documents the routing intent.
  public func applyLeaveAsHR(
    leaves     : List.List<LeaveApplication>,
    nextId     : Nat,
    employeeId : EmployeeId,
    input      : ApplyLeaveInput,
  ) : LeaveApplication {
    // HR leave goes directly to Admin — no intermediate recommendation step.
    // The record is marked #pending so it surfaces in the Admin approval queue.
    applyLeaveV2(leaves, nextId, employeeId, input)
  };

  /// Approve or reject a leave application using structured input — new v2.
  /// Returns the updated LeaveApplication or null if not found.
  public func updateLeaveStatusV2(
    leaves : List.List<LeaveApplication>,
    input  : UpdateLeaveStatusInput,
  ) : ?LeaveApplication {
    let leaveIdNat : ?Nat = Nat.fromText(input.leaveId);
    switch (leaveIdNat) {
      case null { null };
      case (?lid) {
        var result : ?LeaveApplication = null;
        leaves.mapInPlace(func(app) {
          if (app.id == lid) {
            let updated : LeaveApplication = {
              app with
              status         = input.status;
              approverId     = ?input.approverId;
              approvedBy     = ?input.approverId;
              approverRemark = input.remark;
              updatedAt      = Time.now();
            };
            result := ?updated;
            updated;
          } else { app };
        });
        result;
      };
    };
  };

  /// Get pending leaves from all transitive subordinates of a manager.
  /// Uses BFS to collect the full reporting hierarchy under managerId,
  /// then returns all #pending leave applications from those employees.
  public func getPendingLeavesForManager(
    leaves    : List.List<LeaveApplication>,
    users     : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
    managerId : EmployeeId,
  ) : [LeaveApplication] {
    // BFS: collect all subordinate IDs transitively under this manager
    let subordinateIds = AuthLib.allReporteeIds(users, managerId);
    if (subordinateIds.size() == 0) return [];
    leaves.filter(func(app) {
      app.status == #pending and
      subordinateIds.find(func(sid : Nat) : Bool { sid == app.employeeId }) != null
    }).toArray();
  };

  /// Get leave balance for calling employee in the current year.
  /// Returns remaining days for all 9 pharma SFA leave types (including EL and FL).
  public func getLeaveBalanceV2(
    quotas      : List.List<LeaveQuota>,
    roleQuotas  : List.List<RoleLeaveQuota>,
    leaves      : List.List<LeaveApplication>,
    users       : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
    employeeId  : EmployeeId,
    year        : Nat,
  ) : { casual : Int; sick : Int; unpaid : Int; pl : Int; ml : Int; lwp : Int; co : Int; el : Int; fl : Int } {
    let (casualTotal, sickTotal, unpaidTotal, plTotal, mlTotal, lwpTotal, coTotal) : (Int, Int, Int, Int, Int, Int, Int) = do {
      switch (quotas.find(func(q) { q.employeeId == employeeId and q.year == year })) {
        case (?q) {
          (q.casualTotal.toInt(), q.sickTotal.toInt(), q.unpaidTotal.toInt(),
           q.plTotal.toInt(), q.mlTotal.toInt(), q.lwpTotal.toInt(), q.coTotal.toInt())
        };
        case null {
          let userRole : ?CommonTypes.Role = switch (users.get(employeeId)) {
            case (?u) ?u.role;
            case null null;
          };
          switch (userRole) {
            case (?role) {
              switch (roleQuotas.find(func(rq) { rq.role == role and rq.year == year })) {
                case (?rq) {
                  (rq.casualTotal.toInt(), rq.sickTotal.toInt(), rq.unpaidTotal.toInt(),
                   rq.plTotal.toInt(), rq.mlTotal.toInt(), rq.lwpTotal.toInt(), rq.coTotal.toInt())
                };
                case null { (12, 6, 0, 15, 0, 0, 5) };
              };
            };
            case null { (12, 6, 0, 15, 0, 0, 5) };
          };
        };
      }
    };

    var casualUsed : Int = 0;
    var sickUsed   : Int = 0;
    var unpaidUsed : Int = 0;
    var plUsed     : Int = 0;
    var mlUsed     : Int = 0;
    var lwpUsed    : Int = 0;
    var coUsed     : Int = 0;
    let elUsed   : Int = 0; // EL not tracked in LeaveType — always 0
    let flUsed   : Int = 0; // FL not tracked in LeaveType — always 0



    leaves.forEach(func(app) {
      if (app.employeeId == employeeId and app.status == #approved and dateYear(app.fromDate) == year) {
        switch (app.leaveType) {
          case (#casual)      { casualUsed += app.numDays.toInt() };
          case (#sick)        { sickUsed   += app.numDays.toInt() };
          case (#unpaid)      { unpaidUsed += app.numDays.toInt() };
          case (#pl)          { plUsed     += app.numDays.toInt() };
          case (#ml)          { mlUsed     += app.numDays.toInt() };
          case (#lwp)         { lwpUsed    += app.numDays.toInt() };
          case (#co)          { coUsed     += app.numDays.toInt() };
        };
      };
    });

    // EL and FL use fixed defaults (15/12) — these fields are no longer stored in LeaveQuota
    let elTotal : Int = 15;
    let flTotal : Int = 12;

    {
      casual = casualTotal - casualUsed;
      sick   = sickTotal   - sickUsed;
      unpaid = unpaidTotal - unpaidUsed;
      pl     = plTotal     - plUsed;
      ml     = mlTotal     - mlUsed;
      lwp    = lwpTotal    - lwpUsed;
      co     = coTotal     - coUsed;
      el     = elTotal     - elUsed;
      fl     = flTotal     - flUsed;
    };
  };

  /// Set role-level annual leave quota (Admin only). Upsert by (role, year).
  public func setRoleLeaveQuota(
    roleQuotas : List.List<RoleLeaveQuota>,
    quota      : RoleLeaveQuota,
  ) : RoleLeaveQuota {
    let existing = roleQuotas.findIndex(func(rq) { rq.role == quota.role and rq.year == quota.year });
    switch (existing) {
      case (?idx) { roleQuotas.put(idx, quota) };
      case null   { roleQuotas.add(quota) };
    };
    quota;
  };

  /// Get role-level annual leave quota for a given role and year.
  public func getRoleLeaveQuota(
    roleQuotas : List.List<RoleLeaveQuota>,
    role       : CommonTypes.Role,
    year       : Nat,
  ) : ?RoleLeaveQuota {
    roleQuotas.find(func(rq) { rq.role == role and rq.year == year });
  };

  /// Get all leave applications matching optional filter (HR/Admin).
  public func getAllLeaves(
    leaves : List.List<LeaveApplication>,
    filter : LeaveFilter,
  ) : [LeaveApplication] {
    leaves.filter(func(app) {
      let matchUser = switch (filter.userId) {
        case (?uid) { app.employeeId == uid };
        case null   { true };
      };
      let matchStatus = switch (filter.status) {
        case (?st) { app.status == st };
        case null  { true };
      };
      let matchType = switch (filter.leaveType) {
        case (?lt) { app.leaveType == lt };
        case null  { true };
      };
      let matchYear = switch (filter.year) {
        case (?y) { dateYear(app.fromDate) == y };
        case null { true };
      };
      let matchMonth = switch (filter.month) {
        case (?m) { dateMonth(app.fromDate) == m };
        case null { true };
      };
      matchUser and matchStatus and matchType and matchYear and matchMonth
    }).toArray();
  };

  /// Build export rows for all leave applications matching filter (HR/Admin).
  public func getLeaveExportRows(
    leaves : List.List<LeaveApplication>,
    users  : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
    filter : LeaveFilter,
  ) : [LeaveExportRow] {
    let filtered = getAllLeaves(leaves, filter);
    filtered.map<LeaveApplication, LeaveExportRow>(func(app) {
      let empName : Text = switch (users.get(app.employeeId)) {
        case (?u) u.name;
        case null "";
      };
      let empRole : Text = switch (users.get(app.employeeId)) {
        case (?u) {
          switch (u.role) {
            case (#Admin)     "Admin";
            case (#HRManager) "HRManager";
            case (#ZSM)       "ZSM";
            case (#RSM)       "RSM";
            case (#ASM)       "ASM";
            case (#MR)        "MR";
          }
        };
        case null "";
      };
      let approverName : ?Text = switch (app.approverId) {
        case (?aid) {
          switch (users.get(aid)) {
            case (?u) ?u.name;
            case null null;
          }
        };
        case null null;
      };
      let leaveTypeText : Text = switch (app.leaveType) {
        case (#casual)      "Casual Leave (CL)";
        case (#sick)        "Sick Leave (SL)";
        case (#unpaid)      "Leave Without Pay (LWP)";
        case (#pl)          "Privilege Leave (PL)";
        case (#ml)          "Maternity Leave (ML)";
        case (#lwp)         "Leave Without Pay (LWP)";
        case (#co)          "Compensatory Off (CO)";

      };
      let statusText : Text = switch (app.status) {
        case (#pending)  "Pending";
        case (#approved) "Approved";
        case (#rejected) "Rejected";
      };
      {
        leaveId      = app.id.toText();
        employeeId   = app.employeeId.toText();
        employeeName = empName;
        role         = empRole;
        leaveType    = leaveTypeText;
        fromDate     = app.fromDate;
        toDate       = app.toDate;
        numDays      = app.numDays;
        reason       = app.reason;
        status       = statusText;
        approverName;
        remark       = app.approverRemark;
        appliedAt    = app.appliedAt.toText();
      }
    });
  };

  // ── TA/DA Auto-fetch for Payroll ─────────────────────────────────────────────────────────

  /// Canonical type alias — defined in types/gps-trail.mo
  public type TaDaTotals = GpsTrailTypes.TaDaTotals;

  public func getApprovedTaDaTotal(
    expenses   : List.List<TaDaExpense>,
    employeeId : EmployeeId,
    month      : Nat,
    year       : Nat,
  ) : TaDaTotals {
    expenses.foldLeft<TaDaTotals, TaDaExpense>(
      { taTotal = 0; daTotal = 0 },
      func(acc, exp) {
        if (
          exp.employeeId == employeeId and
          exp.status == #approved and
          dateMonth(exp.date) == month and
          dateYear(exp.date) == year
        ) {
          { taTotal = acc.taTotal + exp.travelAmount; daTotal = acc.daTotal + exp.dailyAllowance }
        } else { acc };
      }
    );
  };

  // ── Earned Leave Accrual ─────────────────────────────────────────────────────────────────────

  /// Get EL balance for an employee in a year.
  /// EL accrues at 1.25 days per completed calendar month (15 days/year).
  public func getEarnedLeaveBalance(
    accruals   : List.List<HRCoreTypes.EarnedLeaveAccrual>,
    leaves     : List.List<LeaveApplication>,
    employeeId : EmployeeId,
    year       : Nat,
  ) : { accrued : Nat; used : Nat; balance : Int } {
    let accrued : Nat = switch (accruals.find(func(a) { a.employeeId == employeeId and a.year == year })) {
      case (?a) a.totalAccrued;
      case null 0;
    };
    var used : Nat = 0;
    leaves.forEach(func(app) {
      if (
        app.employeeId == employeeId and
        app.status == #approved and
        app.leaveType == #pl and
        dateYear(app.fromDate) == year
      ) { used += app.numDays };
    });
    { accrued; used; balance = accrued.toInt() - used.toInt() };
  };

  /// Process monthly EL accrual for an employee (1.25 per month, max annual limit).
  /// Idempotent: skips if accrual for this (employeeId, year, month) already processed.
  public func updateEarnedLeaveAccrual(
    accruals    : List.List<HRCoreTypes.EarnedLeaveAccrual>,
    employeeId  : EmployeeId,
    year        : Nat,
    month       : Nat,  // 1-12
    annualLimit : Nat,  // configurable; default 15
  ) : () {
    switch (accruals.findIndex(func(a) { a.employeeId == employeeId and a.year == year })) {
      case (?idx) {
        let existing = accruals.at(idx);
        // Only process if not already done for this month
        if (existing.month >= month) return;
        let newAccrued = Nat.min(existing.totalAccrued + 1, annualLimit); // 1.25 rounds to 1 per month
        accruals.put(idx, { existing with month; totalAccrued = newAccrued });
      };
      case null {
        accruals.add({
          employeeId;
          year;
          month;
          totalAccrued = 1;
        });
      };
    };
  };

};
