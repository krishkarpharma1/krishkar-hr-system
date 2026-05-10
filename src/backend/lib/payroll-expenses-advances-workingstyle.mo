import Types "../types/payroll-expenses-advances-workingstyle";
import List   "mo:core/List";

module {
  // ── Re-exports for convenience ────────────────────────────────────────────
  public type EmployeeAdvance           = Types.EmployeeAdvance;
  public type ExpenseSheet              = Types.ExpenseSheet;
  public type IncentiveBonusSheet       = Types.IncentiveBonusSheet;
  public type WorkingStyleRecord        = Types.WorkingStyleRecord;
  public type CreateAdvanceInput        = Types.CreateAdvanceInput;
  public type UpdateAdvanceInput        = Types.UpdateAdvanceInput;
  public type ExpenseSheetFilter        = Types.ExpenseSheetFilter;
  public type IncentiveBonusSheetFilter = Types.IncentiveBonusSheetFilter;
  public type SubmitWorkingStyleInput   = Types.SubmitWorkingStyleInput;

  // ────────────────────────────────────────────────────────────────────────
  // Internal helpers
  // ────────────────────────────────────────────────────────────────────────

  /// Advance firstDeductionMonth/Year: installmentStartMonth + 1
  func calcFirstDeduction(startMonth : Nat, startYear : Nat) : (Nat, Nat) {
    if (startMonth == 12) { (1, startYear + 1) }
    else { (startMonth + 1, startYear) };
  };

  /// Check whether (month, year) >= (firstMonth, firstYear)
  func isMonthGe(month : Nat, year : Nat, firstMonth : Nat, firstYear : Nat) : Bool {
    year > firstYear or (year == firstYear and month >= firstMonth);
  };

  /// Normalise a nanosecond timestamp to start-of-day UTC (midnight)
  /// One day = 86_400_000_000_000 nanoseconds
  func startOfDay(ts : Int) : Int {
    let dayNs : Int = 86_400_000_000_000;
    ts - (ts % dayNs);
  };

  /// Quarter end as (month, day) — used to compute due date
  func quarterEndMonthDay(quarter : Nat) : (Nat, Nat) {
    switch (quarter) {
      case 1 { (6, 30) };   // June 30
      case 2 { (9, 30) };   // Sep 30
      case 3 { (12, 31) };  // Dec 31
      case 4 { (3, 31) };   // Mar 31
      case _ { (12, 31) };
    };
  };

  /// Expense sheet is DueForPayment when now >= 16th of the following month.
  /// month and year are the expense month/year.
  func isExpenseDue(month : Nat, year : Nat, now : Int) : Bool {
    // 15th of following month at ~midnight = roughly (15 days + 1 day) worth of ns past month start
    // We use a simple check: if today's date is >= following month's 16th.
    // Represent due threshold as a timestamp approximation:
    // following month 16th ~= (year, month+1, 16) at 00:00 UTC
    // We compute nanoseconds: use calendar approximation
    // 1 day = 86_400_000_000_000 ns; Jan 1 1970 = 0
    // Simple formula: days since epoch for (y, m, 16)
    let (followMonth, followYear) : (Nat, Nat) =
      if (month == 12) { (1, year + 1) } else { (month + 1, year) };
    let dueEpochDays : Int = approxEpochDays(followYear, followMonth, 16);
    let dueNs : Int = dueEpochDays * 86_400_000_000_000;
    now >= dueNs;
  };

  /// Incentive/bonus sheet is DueForPayment when now >= 30 days after quarter end.
  func isIncentiveDue(quarter : Nat, year : Nat, now : Int) : Bool {
    let (qEndMonth, qEndDay) = quarterEndMonthDay(quarter);
    // Q4 (Jan-Mar) belongs to the *following* FY; the year field stores the FY start year.
    // E.g. FY 2025 Q4 = Jan-Mar 2026, so we need year+1 for the actual calendar year.
    let calYear : Nat = if (quarter == 4) { year + 1 } else { year };
    let qEndEpochDays : Int = approxEpochDays(calYear, qEndMonth, qEndDay);
    let dueNs : Int = (qEndEpochDays + 30) * 86_400_000_000_000;
    now >= dueNs;
  };

  /// Approximate days since Unix epoch for (year, month, day) — good enough for due-date checks.
  func approxEpochDays(year : Nat, month : Nat, day : Nat) : Int {
    // Days per month (non-leap approximation; acceptable for billing date checks)
    let dpm : [Nat] = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    var totalDays : Int = 0;
    // Years from 1970
    let y : Int = year.toInt() - 1970;
    totalDays += y * 365 + y / 4; // rough leap year correction
    // Months within year
    var m : Nat = 0;
    while (m < month - 1) {
      if (m < 12) { totalDays += dpm[m].toInt() };
      m += 1;
    };
    totalDays += day.toInt() - 1;
    totalDays;
  };

  // ────────────────────────────────────────────────────────────────────────
  // Employee Advance domain logic
  // ────────────────────────────────────────────────────────────────────────

  public func createAdvance(
    advances  : List.List<EmployeeAdvance>,
    input     : CreateAdvanceInput,
    createdBy : Text,
    now       : Int,
    newId     : Text,
  ) : Text {
    let installmentAmount : Float =
      if (input.totalInstallments == 0) { 0.0 }
      else { input.advanceAmount / input.totalInstallments.toFloat() };
    let (firstMonth, firstYear) = calcFirstDeduction(input.installmentStartMonth, input.installmentStartYear);
    let adv : EmployeeAdvance = {
      id                    = newId;
      employeeId            = input.employeeId;
      advanceAmount         = input.advanceAmount;
      advanceDate           = input.advanceDate;
      reason                = input.reason;
      totalInstallments     = input.totalInstallments;
      installmentAmount;
      installmentStartMonth = input.installmentStartMonth;
      installmentStartYear  = input.installmentStartYear;
      firstDeductionMonth   = firstMonth;
      firstDeductionYear    = firstYear;
      amountRecovered       = 0.0;
      installmentsCompleted = 0;
      status                = #Active;
      createdBy;
      createdAt             = now;
      remarks               = input.remarks;
      cancelRemark          = null;
      isPaused              = false;
    };
    advances.add(adv);
    newId;
  };

  public func updateAdvance(
    advances : List.List<EmployeeAdvance>,
    id       : Text,
    input    : UpdateAdvanceInput,
  ) : { #ok; #err : Text } {
    let idx = advances.findIndex(func(a) { a.id == id });
    switch (idx) {
      case null { #err("Advance not found") };
      case (?i) {
        let old = advances.at(i);
        if (old.status == #Cancelled) {
          return #err("Cannot update a cancelled advance");
        };
        // Recalculate remaining installments / amount
        let newTotal : Nat = switch (input.totalInstallments) {
          case (?t) { old.installmentsCompleted + t };
          case null { old.totalInstallments };
        };
        let newInstallmentAmount : Float = switch (input.installmentAmount) {
          case (?amt) { amt };
          case null {
            let newRemaining : Nat = switch (input.totalInstallments) {
              case (?t) { t };
              case null { old.totalInstallments - old.installmentsCompleted };
            };
            if (newRemaining == 0) { 0.0 }
            else {
              let balanceRemaining : Float = old.advanceAmount - old.amountRecovered;
              balanceRemaining / newRemaining.toFloat();
            };
          };
        };
        let remarksVal : ?Text = switch (input.remarks) {
          case (?r) { ?r };
          case null { old.remarks };
        };
        advances.put(i, {
          old with
          totalInstallments  = newTotal;
          installmentAmount  = newInstallmentAmount;
          remarks            = remarksVal;
        });
        #ok;
      };
    };
  };

  public func cancelAdvance(
    advances : List.List<EmployeeAdvance>,
    id       : Text,
    remark   : Text,
  ) : { #ok; #err : Text } {
    let idx = advances.findIndex(func(a) { a.id == id });
    switch (idx) {
      case null { #err("Advance not found") };
      case (?i) {
        let old = advances.at(i);
        advances.put(i, { old with status = #Cancelled; cancelRemark = ?remark });
        #ok;
      };
    };
  };

  public func pauseAdvance(
    advances : List.List<EmployeeAdvance>,
    id       : Text,
    pause    : Bool,
    remark   : Text,
  ) : { #ok; #err : Text } {
    let idx = advances.findIndex(func(a) { a.id == id });
    switch (idx) {
      case null { #err("Advance not found") };
      case (?i) {
        let old = advances.at(i);
        if (old.status == #Cancelled) {
          return #err("Cannot pause/resume a cancelled advance");
        };
        let newRemarks : ?Text = if (remark == "") { old.remarks } else { ?remark };
        advances.put(i, { old with isPaused = pause; remarks = newRemarks });
        #ok;
      };
    };
  };

  public func getAdvancesByEmployee(
    advances   : List.List<EmployeeAdvance>,
    employeeId : Text,
  ) : [EmployeeAdvance] {
    advances.filter(func(a) { a.employeeId == employeeId }).toArray();
  };

  public func getAllAdvances(
    advances : List.List<EmployeeAdvance>,
  ) : [EmployeeAdvance] {
    advances.toArray();
  };

  public func processMonthlyAdvanceDeductions(
    advances : List.List<EmployeeAdvance>,
    month    : Nat,
    year     : Nat,
  ) : { #ok; #err : Text } {
    advances.mapInPlace(func(adv) {
      if (
        adv.status == #Active and
        not adv.isPaused and
        adv.installmentsCompleted < adv.totalInstallments and
        isMonthGe(month, year, adv.firstDeductionMonth, adv.firstDeductionYear)
      ) {
        let newCompleted = adv.installmentsCompleted + 1;
        let newRecovered = adv.amountRecovered + adv.installmentAmount;
        let newStatus : Types.AdvanceStatus =
          if (newCompleted >= adv.totalInstallments) { #FullyRecovered }
          else { #Active };
        {
          adv with
          installmentsCompleted = newCompleted;
          amountRecovered       = newRecovered;
          status                = newStatus;
        };
      } else { adv };
    });
    #ok;
  };

  public func getMonthlyAdvanceDeductionForEmployee(
    advances   : List.List<EmployeeAdvance>,
    employeeId : Text,
    month      : Nat,
    year       : Nat,
  ) : Float {
    advances.foldLeft<Float, EmployeeAdvance>(
      0.0,
      func(acc, adv) {
        if (
          adv.employeeId == employeeId and
          adv.status == #Active and
          not adv.isPaused and
          adv.installmentsCompleted < adv.totalInstallments and
          isMonthGe(month, year, adv.firstDeductionMonth, adv.firstDeductionYear)
        ) { acc + adv.installmentAmount }
        else { acc };
      }
    );
  };

  // ────────────────────────────────────────────────────────────────────────
  // Expense Sheet domain logic
  // ────────────────────────────────────────────────────────────────────────

  public func generateExpenseSheet(
    sheets     : List.List<ExpenseSheet>,
    employeeId : Text,
    month      : Nat,
    year       : Nat,
    lineItems  : [Types.ExpenseLineItem],
    now        : Int,
    newId      : Text,
  ) : Text {
    let total : Float = lineItems.foldLeft<Types.ExpenseLineItem, Float>(
      0.0,
      func(acc, item) { acc + item.amount }
    );
    let existing = sheets.findIndex(func(s) {
      s.employeeId == employeeId and s.month == month and s.year == year
    });
    switch (existing) {
      case (?i) {
        let old = sheets.at(i);
        sheets.put(i, {
          old with
          lineItems   = lineItems;
          totalAmount = total;
          generatedAt = now;
        });
        old.id;
      };
      case null {
        let sheet : ExpenseSheet = {
          id            = newId;
          employeeId;
          month;
          year;
          lineItems;
          totalAmount   = total;
          paymentStatus = #Pending;
          paymentDate   = null;
          markedPaidBy  = null;
          generatedAt   = now;
        };
        sheets.add(sheet);
        newId;
      };
    };
  };

  public func getExpenseSheet(
    sheets     : List.List<ExpenseSheet>,
    employeeId : Text,
    month      : Nat,
    year       : Nat,
  ) : ?ExpenseSheet {
    sheets.find(func(s) {
      s.employeeId == employeeId and s.month == month and s.year == year
    });
  };

  public func getAllExpenseSheets(
    sheets : List.List<ExpenseSheet>,
    filter : ExpenseSheetFilter,
  ) : [ExpenseSheet] {
    sheets.filter(func(s) {
      let matchEmp = switch (filter.employeeId) {
        case (?eid) { s.employeeId == eid };
        case null   { true };
      };
      let matchMonth = switch (filter.month) {
        case (?m) { s.month == m };
        case null { true };
      };
      let matchYear = switch (filter.year) {
        case (?y) { s.year == y };
        case null { true };
      };
      let matchStatus = switch (filter.paymentStatus) {
        case (?st) { s.paymentStatus == st };
        case null  { true };
      };
      matchEmp and matchMonth and matchYear and matchStatus;
    }).toArray();
  };

  public func markExpenseSheetPaid(
    sheets      : List.List<ExpenseSheet>,
    sheetId     : Text,
    paymentDate : Int,
    markedBy    : Text,
  ) : { #ok; #err : Text } {
    let idx = sheets.findIndex(func(s) { s.id == sheetId });
    switch (idx) {
      case null { #err("Expense sheet not found") };
      case (?i) {
        let old = sheets.at(i);
        sheets.put(i, {
          old with
          paymentStatus = #Paid;
          paymentDate   = ?paymentDate;
          markedPaidBy  = ?markedBy;
        });
        #ok;
      };
    };
  };

  public func refreshExpenseSheetStatus(
    sheets : List.List<ExpenseSheet>,
    now    : Int,
  ) : () {
    sheets.mapInPlace(func(s) {
      if (s.paymentStatus == #Pending and isExpenseDue(s.month, s.year, now)) {
        { s with paymentStatus = #DueForPayment }
      } else { s };
    });
  };

  // ────────────────────────────────────────────────────────────────────────
  // Incentive & Bonus Sheet domain logic
  // ────────────────────────────────────────────────────────────────────────

  public func generateIncentiveBonusSheet(
    sheets         : List.List<IncentiveBonusSheet>,
    employeeId     : Text,
    quarter        : Nat,
    year           : Nat,
    monthlyEntries : [Types.IncentiveMonthEntry],
    bonusEntries   : [Types.BonusEntry],
    now            : Int,
    newId          : Text,
  ) : Text {
    let totalIncentive : Float = monthlyEntries.foldLeft<Types.IncentiveMonthEntry, Float>(
      0.0,
      func(acc, e) { acc + e.incentiveAmount }
    );
    let totalBonus : Float = bonusEntries.foldLeft<Types.BonusEntry, Float>(
      0.0,
      func(acc, e) { acc + e.amount }
    );
    let existing = sheets.findIndex(func(s) {
      s.employeeId == employeeId and s.quarter == quarter and s.year == year
    });
    switch (existing) {
      case (?i) {
        let old = sheets.at(i);
        sheets.put(i, {
          old with
          monthlyBreakdown     = monthlyEntries;
          bonusEntries;
          totalIncentiveAmount = totalIncentive;
          totalBonusAmount     = totalBonus;
          totalAmount          = totalIncentive + totalBonus;
          generatedAt          = now;
        });
        old.id;
      };
      case null {
        let sheet : IncentiveBonusSheet = {
          id                   = newId;
          employeeId;
          quarter;
          year;
          monthlyBreakdown     = monthlyEntries;
          bonusEntries;
          totalIncentiveAmount = totalIncentive;
          totalBonusAmount     = totalBonus;
          totalAmount          = totalIncentive + totalBonus;
          paymentStatus        = #Pending;
          paymentDate          = null;
          markedPaidBy         = null;
          generatedAt          = now;
        };
        sheets.add(sheet);
        newId;
      };
    };
  };

  public func getIncentiveBonusSheet(
    sheets     : List.List<IncentiveBonusSheet>,
    employeeId : Text,
    quarter    : Nat,
    year       : Nat,
  ) : ?IncentiveBonusSheet {
    sheets.find(func(s) {
      s.employeeId == employeeId and s.quarter == quarter and s.year == year
    });
  };

  public func getAllIncentiveBonusSheets(
    sheets : List.List<IncentiveBonusSheet>,
    filter : IncentiveBonusSheetFilter,
  ) : [IncentiveBonusSheet] {
    sheets.filter(func(s) {
      let matchEmp = switch (filter.employeeId) {
        case (?eid) { s.employeeId == eid };
        case null   { true };
      };
      let matchQ = switch (filter.quarter) {
        case (?q) { s.quarter == q };
        case null { true };
      };
      let matchYear = switch (filter.year) {
        case (?y) { s.year == y };
        case null { true };
      };
      let matchStatus = switch (filter.paymentStatus) {
        case (?st) { s.paymentStatus == st };
        case null  { true };
      };
      matchEmp and matchQ and matchYear and matchStatus;
    }).toArray();
  };

  public func markIncentiveBonusSheetPaid(
    sheets      : List.List<IncentiveBonusSheet>,
    sheetId     : Text,
    paymentDate : Int,
    markedBy    : Text,
  ) : { #ok; #err : Text } {
    let idx = sheets.findIndex(func(s) { s.id == sheetId });
    switch (idx) {
      case null { #err("Incentive/bonus sheet not found") };
      case (?i) {
        let old = sheets.at(i);
        sheets.put(i, {
          old with
          paymentStatus = #Paid;
          paymentDate   = ?paymentDate;
          markedPaidBy  = ?markedBy;
        });
        #ok;
      };
    };
  };

  public func addBonusEntry(
    sheets  : List.List<IncentiveBonusSheet>,
    sheetId : Text,
    entry   : Types.BonusEntry,
  ) : { #ok; #err : Text } {
    let idx = sheets.findIndex(func(s) { s.id == sheetId });
    switch (idx) {
      case null { #err("Incentive/bonus sheet not found") };
      case (?i) {
        let old = sheets.at(i);
        let newBonus = old.bonusEntries.concat([entry]);
        let newBonusTotal = old.totalBonusAmount + entry.amount;
        sheets.put(i, {
          old with
          bonusEntries    = newBonus;
          totalBonusAmount = newBonusTotal;
          totalAmount     = old.totalIncentiveAmount + newBonusTotal;
        });
        #ok;
      };
    };
  };

  public func refreshIncentiveBonusSheetStatus(
    sheets : List.List<IncentiveBonusSheet>,
    now    : Int,
  ) : () {
    sheets.mapInPlace(func(s) {
      if (s.paymentStatus == #Pending and isIncentiveDue(s.quarter, s.year, now)) {
        { s with paymentStatus = #DueForPayment }
      } else { s };
    });
  };

  // ────────────────────────────────────────────────────────────────────────
  // Working Style domain logic
  // ────────────────────────────────────────────────────────────────────────

  public func submitWorkingStyle(
    records : List.List<WorkingStyleRecord>,
    input   : SubmitWorkingStyleInput,
    now     : Int,
    newId   : Text,
  ) : { #ok : Text; #err : Text } {
    let dayStart = startOfDay(input.date);
    // Check duplicate: same employee, same calendar day
    let dup = records.find(func(r) {
      r.employeeId == input.employeeId and startOfDay(r.date) == dayStart
    });
    switch (dup) {
      case (?_) { #err("Working style already submitted for today") };
      case null {
        let rec : WorkingStyleRecord = {
          id               = newId;
          employeeId       = input.employeeId;
          date             = dayStart;
          workingMode      = input.workingMode;
          workingWithUserId = input.workingWithUserId;
          workingWithName  = null; // resolved by mixin layer
          stationSource    = input.stationSource;
          otherStationName = input.otherStationName;
          submittedAt      = now;
          workingType      = input.workingType;
          additionalArea   = input.additionalArea;
        };
        records.add(rec);
        #ok(newId);
      };
    };
  };

  public func getTodayWorkingStyle(
    records    : List.List<WorkingStyleRecord>,
    employeeId : Text,
    todayStart : Int,
  ) : ?WorkingStyleRecord {
    records.find(func(r) {
      r.employeeId == employeeId and startOfDay(r.date) == todayStart
    });
  };

  public func getWorkingStyleHistory(
    records    : List.List<WorkingStyleRecord>,
    employeeId : Text,
    from       : Int,
    to         : Int,
  ) : [WorkingStyleRecord] {
    records.filter(func(r) {
      r.employeeId == employeeId and r.date >= from and r.date <= to
    }).toArray();
  };

  public func getTeamWorkingStyleHistory(
    records        : List.List<WorkingStyleRecord>,
    subordinateIds : [Text],
    from           : Int,
    to             : Int,
  ) : [WorkingStyleRecord] {
    records.filter(func(r) {
      r.date >= from and r.date <= to and
      subordinateIds.find(func(sid) { sid == r.employeeId }) != null
    }).toArray();
  };

  public func getAllWorkingStyleRecords(
    records : List.List<WorkingStyleRecord>,
    from    : Int,
    to      : Int,
  ) : [WorkingStyleRecord] {
    records.filter(func(r) { r.date >= from and r.date <= to }).toArray();
  };

};
