import CommonTypes "common";

module {
  public type UserId    = CommonTypes.UserId;
  public type Timestamp = CommonTypes.Timestamp;

  // ── MR daily activity row (used in ASM/RSM team tables) ───────────────────

  /// One row per MR in the manager's team activity table.
  /// Populated from check-in records, Doctor Calls, Chemist/Stockist visits,
  /// and DCR submissions for a given date.
  public type MrDailyActivityRow = {
    mrId               : UserId;
    mrName             : Text;
    checkInStatus      : Bool;
    checkInTime        : ?Int;      // Unix nanoseconds of check-in, null if not checked in
    doctorCallsToday   : Nat;
    chemistVisitsToday : Nat;
    stockistVisitsToday : Nat;
    dcrStatusToday     : Text;     // "Submitted" | "Late" | "Approved" | "Rejected" | "Not Submitted"
    lastGpsLat         : ?Float;
    lastGpsLng         : ?Float;
    lastGpsTime        : ?Int;     // Unix nanoseconds of last known GPS ping
  };

  // ── Pending approval counts (used in manager dashboard widgets) ───────────

  /// Counts of pending approval items for the logged-in manager.
  /// rsmLevelLeavePending / rsmLevelTadaPending are only populated for RSM
  /// when the RSM has directly managed MRs; both are 0 for other roles.
  public type PendingApprovalCounts = {
    leavePending         : Nat;
    tadaPending          : Nat;
    mtpPending           : Nat;
    dcrPending           : Nat;
    rsmLevelLeavePending : Nat;  // RSM-level escalated (from ASMs)
    rsmLevelTadaPending  : Nat;  // RSM-level escalated (from ASMs)
  };

  // ── Dashboard aggregate KPIs ───────────────────────────────────────────────

  /// Role-specific KPI aggregates returned by getDashboardAggregates.
  /// The shape is a variant — callers pattern-match on their role.
  public type DashboardAggregates = {
    #mr  : MrKpis;
    #asm : AsmKpis;
    #rsm : RsmKpis;
    #zsm : ZsmKpis;
    #hr  : HrKpis;
    #admin : AdminKpis;
  };

  /// KPIs for the MR portal dashboard
  public type MrKpis = {
    doctorCallsCount      : Nat;
    doctorCallsTarget     : Nat;
    chemistVisitsCount    : Nat;
    chemistVisitsTarget   : Nat;
    stockistVisitsCount   : Nat;
    stockistVisitsTarget  : Nat;
    sampleBalanceCount    : Nat;    // total samples remaining across all products
    dcrSubmissionRate     : Float;  // 0.0–1.0 fraction of working days with submitted DCR
    mtpAdherenceRate      : Float;  // 0.0–1.0 fraction of planned days matching actuals
    newDoctorsAdded       : Nat;
    newDoctorsTarget      : Nat;
  };

  /// KPIs for the ASM portal dashboard
  public type AsmKpis = {
    teamDoctorCallsCount   : Nat;
    teamDoctorCallsTarget  : Nat;
    teamChemistVisits      : Nat;
    teamDcrOnTimeCount     : Nat;
    teamDcrExpected        : Nat;
    mrsNotCheckedInToday   : Nat;
    mrsPendingMtpApproval  : Nat;
    pendingLeaveCount      : Nat;
    pendingTadaCount       : Nat;
    totalMrs               : Nat;
  };

  /// KPIs for the RSM portal dashboard
  public type RsmKpis = {
    regionDoctorCallsCount  : Nat;
    regionDoctorCallsTarget : Nat;
    regionChemistVisits     : Nat;
    regionDcrRate           : Float;
    mrsNotCheckedInToday    : Nat;
    pendingApprovals        : Nat;
    mtpAdherenceRate        : Float;
    directMrCount           : Nat;   // 0 if RSM has no directly managed MRs
    totalMrsInRegion        : Nat;
  };

  /// KPIs for the ZSM portal dashboard
  public type ZsmKpis = {
    zoneDoctorCallsCount  : Nat;
    zoneDoctorCallsTarget : Nat;
    zoneChemistVisits     : Nat;
    zoneDcrRate           : Float;
    mrsNotCheckedInToday  : Nat;
    pendingApprovals      : Nat;
    mtpAdherenceRate      : Float;
    totalMrsInZone        : Nat;
  };

  /// KPIs for the HR portal dashboard
  public type HrKpis = {
    totalActiveEmployees     : Nat;
    totalEmployees           : Nat;
    employeesOnLeaveToday    : Nat;
    pendingLeaveApplications : Nat;
    pendingTadaClaims        : Nat;
    lateCheckInsToday        : Nat;
    autoInactivatedPending   : Nat;   // auto-inactivated accounts needing reactivation
    upcomingBirthdaysCount   : Nat;   // in the next 7 days
  };

  /// KPIs for the Admin portal dashboard
  public type AdminKpis = {
    totalActiveUsers          : Nat;
    usersByRole               : [(Text, Nat)];  // [("MR", 12), ("ASM", 4), ...]
    doctorCallsToday          : Nat;
    doctorCallsThisMonth      : Nat;
    chemistVisitsToday        : Nat;
    chemistVisitsThisMonth    : Nat;
    attendanceRateToday       : Float;         // 0.0–1.0
    totalPendingApprovals     : Nat;
    autoInactivatedPending    : Nat;
    systemAlertCount          : Nat;
  };

  // ── Expense claim summary ─────────────────────────────────────────────────

  /// One row per MR in the Expense Claim Summary report.
  public type ExpenseClaimSummaryRow = {
    mrId                  : UserId;
    mrName                : Text;
    totalClaimed          : Float;
    byType                : [(Text, Float)];  // [("TA", 1200.0), ("DA", 800.0), ...]
    doctorCallsInPeriod   : Nat;
    chemistVisitsInPeriod : Nat;
    stockistVisitsInPeriod : Nat;
  };

  // ── DCR reminder status ───────────────────────────────────────────────────

  /// Result of getDcrReminderStatus — tells the frontend whether to show
  /// the "Please submit your DCR" reminder for the calling MR.
  public type DcrReminderStatus = {
    checkedIn     : Bool;
    dcrSubmitted  : Bool;
    deadlineHour  : Nat;
  };

  // ── Station info for MTP planning ─────────────────────────────────────────

  /// A station allotted to the MR within their Area HQ, used for MTP planning.
  public type StationInfo = {
    stationId  : Nat;
    stationName : Text;
    areaId     : Nat;
    areaName   : Text;
    regionId   : Nat;
    regionName : Text;
  };

  // ── System alerts (Admin-only) ─────────────────────────────────────────────

  /// A single system-level alert for the Admin dashboard alert panel.
  public type SystemAlert = {
    alertId   : Nat;
    alertType : Text;    // e.g. "AUTO_INACTIVATION" | "CONSECUTIVE_ABSENCE" | "BULK_UPLOAD_ERROR" | "FAILED_JOB"
    message   : Text;
    createdAt : Int;     // nanoseconds
    severity  : Text;    // "info" | "warning" | "critical"
  };
};
