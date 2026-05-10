import CommonTypes "common";

module {
  public type UserId    = CommonTypes.UserId;
  public type Timestamp = CommonTypes.Timestamp;
  public type GpsCoord  = CommonTypes.GpsCoord;

  // ── Working type for a DCR day ────────────────────────────────────────────

  public type DcrWorkingType = {
    #FieldWork;
    #OfficeWork;
    #Leave;
    #Holiday;
    #Training;
    #SickLeave;
  };

  // ── DCR status lifecycle ──────────────────────────────────────────────────

  /// #Draft     – saved but not yet submitted
  /// #Submitted – submitted on time (manually by MR)
  /// #Late      – submitted after the configured deadline
  /// #Approved  – approved by reporting manager
  /// #Rejected  – rejected by reporting manager
  public type DcrStatus = {
    #Draft;
    #Submitted;
    #Late;
    #Approved;
    #Rejected;
  };

  // ── DCR Record ────────────────────────────────────────────────────────────

  public type DcrRecord = {
    id                     : Nat;
    mrId                   : UserId;
    date                   : Text;          // ISO date "YYYY-MM-DD"
    var workingType        : DcrWorkingType;
    var totalDoctorsVisited  : Nat;
    var totalChemistsVisited : Nat;
    var totalStockistsVisited : Nat;
    var stationCovered     : Text;
    var areaCovered        : Text;
    var remarks            : Text;
    var gpsLocation        : ?GpsCoord;
    var status             : DcrStatus;
    isLate                 : Bool;          // set at submission time; immutable after
    var submittedAt        : ?Timestamp;
    var approvedBy         : ?UserId;       // ASM or RSM who approved/rejected
    var approvedAt         : ?Timestamp;
    var approverRemark     : Text;
    createdAt              : Timestamp;
  };

  public type DcrInfo = {
    id                    : Nat;
    mrId                  : UserId;
    date                  : Text;
    workingType           : DcrWorkingType;
    totalDoctorsVisited   : Nat;
    totalChemistsVisited  : Nat;
    totalStockistsVisited : Nat;
    stationCovered        : Text;
    areaCovered           : Text;
    remarks               : Text;
    gpsLocation           : ?GpsCoord;
    status                : DcrStatus;
    isLate                : Bool;
    submittedAt           : ?Timestamp;
    approvedBy            : ?UserId;
    approvedAt            : ?Timestamp;
    approverRemark        : Text;
    createdAt             : Timestamp;
  };

  // ── Input types ───────────────────────────────────────────────────────────

  public type DcrInput = {
    date                  : Text;
    workingType           : DcrWorkingType;
    totalDoctorsVisited   : Nat;
    totalChemistsVisited  : Nat;
    totalStockistsVisited : Nat;
    stationCovered        : Text;
    areaCovered           : Text;
    remarks               : Text;
    gpsLocation           : ?GpsCoord;
  };

  /// Used by reporting manager (ASM or RSM) to approve or reject a DCR.
  /// status must be #Approved or #Rejected.
  public type DcrApprovalInput = {
    dcrId  : Nat;
    status : DcrStatus;
    remark : Text;
  };

  // ── Report / summary types ────────────────────────────────────────────────

  /// One row in the DCR Summary Report — one entry per MR per date.
  public type DcrSummaryRow = {
    mrId             : UserId;
    mrName           : Text;
    date             : Text;
    status           : DcrStatus;
    isLate           : Bool;
    totalDoctors     : Nat;
    totalChemists    : Nat;
    totalStockists   : Nat;
  };

  // ── Settings ──────────────────────────────────────────────────────────────

  /// Configurable daily submission deadline. Default: 21:00 (9 PM).
  /// isEnabled = false → deadline check is skipped (no Late flag set).
  public type DcrSettings = {
    var dailyDeadlineHour   : Nat;    // 0–23
    var dailyDeadlineMinute : Nat;    // 0–59
    var isEnabled           : Bool;
  };

  public type DcrSettingsInfo = {
    dailyDeadlineHour   : Nat;
    dailyDeadlineMinute : Nat;
    isEnabled           : Bool;
  };
};
