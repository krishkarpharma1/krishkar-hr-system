import CommonTypes "common";

module {
  public type Timestamp = Int;

  // ── Shared sub-types ──────────────────────────────────────────────────────
  public type ExpenseLineItem = {
    expenseType       : Text;   // "TA" | "DA" | "Hotel" | "Travel" | "LocalConveyance" | ...
    amount            : Float;
    date              : Int;    // timestamp
    description       : ?Text;
    sourceCallReportId: ?Text;
  };

  public type IncentiveMonthEntry = {
    month          : Nat;  // 1-12
    year           : Nat;
    incentiveAmount: Float;
    slabApplied    : Text;
    achievementPct : Float;
  };

  public type BonusEntry = {
    bonusType: Text;
    amount   : Float;
    remarks  : ?Text;
  };

  // ── Status variants ───────────────────────────────────────────────────────
  public type AdvanceStatus = {
    #Active;
    #FullyRecovered;
    #Cancelled;
  };

  public type PaymentStatus = {
    #Pending;
    #DueForPayment;
    #Paid;
  };

  public type WorkingStyleMode = {
    #WorkingAlone;
    #WorkingWith;
  };

  public type WorkingStationSource = {
    #AsPerPlan;
    #OtherStation;
  };

  // ── Core record types ─────────────────────────────────────────────────────
  public type EmployeeAdvance = {
    id                   : Text;
    employeeId           : Text;
    advanceAmount        : Float;
    advanceDate          : Int;   // timestamp
    reason               : Text;
    totalInstallments    : Nat;
    installmentAmount    : Float; // advanceAmount / totalInstallments
    installmentStartMonth: Nat;   // 1-12 — the recorded start month
    installmentStartYear : Nat;
    firstDeductionMonth  : Nat;   // installmentStartMonth + 1 (wrapping Dec→Jan)
    firstDeductionYear   : Nat;
    amountRecovered      : Float;
    installmentsCompleted: Nat;
    status               : AdvanceStatus;
    createdBy            : Text;
    createdAt            : Int;
    remarks              : ?Text;
    cancelRemark         : ?Text;
    isPaused             : Bool;
  };

  public type ExpenseSheet = {
    id            : Text;
    employeeId    : Text;
    month         : Nat;   // 1-12
    year          : Nat;
    lineItems     : [ExpenseLineItem];
    totalAmount   : Float;
    paymentStatus : PaymentStatus;
    paymentDate   : ?Int;
    markedPaidBy  : ?Text;
    generatedAt   : Int;
  };

  public type IncentiveBonusSheet = {
    id                  : Text;
    employeeId          : Text;
    quarter             : Nat;   // 1-4 (Indian FY: Q1=Apr-Jun … Q4=Jan-Mar)
    year                : Nat;   // FY year, e.g. 2025 = FY 2025-26
    monthlyBreakdown    : [IncentiveMonthEntry];
    bonusEntries        : [BonusEntry];
    totalIncentiveAmount: Float;
    totalBonusAmount    : Float;
    totalAmount         : Float;
    paymentStatus       : PaymentStatus;
    paymentDate         : ?Int;
    markedPaidBy        : ?Text;
    generatedAt         : Int;
  };

  public type WorkingStyleRecord = {
    id               : Text;
    employeeId       : Text;
    date             : Int;   // date-only timestamp (start-of-day)
    workingMode      : WorkingStyleMode;
    workingWithUserId: ?Text; // higher authority userId if WorkingWith
    workingWithName  : ?Text; // denormalized display name
    stationSource    : WorkingStationSource;
    otherStationName : ?Text; // required when stationSource = OtherStation
    submittedAt      : Int;
    workingType      : ?Text; // "Working" | "Meeting" | "Training" | "Transit" | "CME / Camp / Doctor Meet" | "Admin Work"
    additionalArea   : ?Text; // optional additional area/station selected by employee
  };

  // ── Input types ───────────────────────────────────────────────────────────
  public type CreateAdvanceInput = {
    employeeId           : Text;
    advanceAmount        : Float;
    advanceDate          : Int;
    reason               : Text;
    totalInstallments    : Nat;
    installmentStartMonth: Nat;
    installmentStartYear : Nat;
    remarks              : ?Text;
  };

  public type UpdateAdvanceInput = {
    totalInstallments: ?Nat;   // revise remaining installments
    installmentAmount: ?Float; // override installment amount
    remarks          : ?Text;
  };

  public type ExpenseSheetFilter = {
    employeeId   : ?Text;
    month        : ?Nat;
    year         : ?Nat;
    paymentStatus: ?PaymentStatus;
  };

  public type IncentiveBonusSheetFilter = {
    employeeId   : ?Text;
    quarter      : ?Nat;
    year         : ?Nat;
    paymentStatus: ?PaymentStatus;
  };

  public type SubmitWorkingStyleInput = {
    token            : Text;
    employeeId       : Text;
    date             : Int;
    workingMode      : WorkingStyleMode;
    workingWithUserId: ?Text;
    stationSource    : WorkingStationSource;
    otherStationName : ?Text;
    workingType      : ?Text; // "Working" | "Meeting" | "Training" | "Transit" | "CME / Camp / Doctor Meet" | "Admin Work"
    additionalArea   : ?Text; // optional additional area/station
  };
};
