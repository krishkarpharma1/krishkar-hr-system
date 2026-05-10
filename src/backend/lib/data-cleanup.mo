import FieldTypes    "../types/field-ops";
import HRTypes       "../types/hr-core";
import TPTypes       "../types/travel-plan";
import BookingTypes  "../types/booking";
import CrmTypes      "../types/crm";
import GpsTypes      "../types/gps-trail";
import IncentiveTypes "../types/incentives";
import List           "mo:core/List";

module {

  // ── Types ────────────────────────────────────────────────────────────────────

  /// Immutable audit log entry for a data cleanup action.
  /// Append-only — never deleted or modified once created.
  public type DataCleanupLog = {
    id             : Nat;
    adminUsername  : Text;
    timestamp      : Int;         // nanoseconds from Time.now()
    reason         : Text;
    recordsDeleted : [(Text, Nat)]; // [(entityName, count)]
    status         : Text;          // "success"
  };

  // ── Cleanup execution ────────────────────────────────────────────────────────

  /// Execute full data cleanup, clearing all trial/field-activity data.
  /// All master / configuration data is preserved.
  /// Returns a DataCleanupLog entry describing what was deleted.
  public func cleanTrialData(
    logs               : List.List<DataCleanupLog>,
    nextLogId          : { var value : Nat },
    adminUsername      : Text,
    reason             : Text,
    now                : Int,
    // ── field-ops erasable ───────────────────────────────────────────
    reports            : List.List<FieldTypes.CallReport>,
    // ── hr-core erasable ─────────────────────────────────────────────
    expenses           : List.List<HRTypes.TaDaExpense>,
    attendance         : List.List<HRTypes.AttendanceRecord>,
    leaves             : List.List<HRTypes.LeaveApplication>,
    // ── travel-plan erasable ─────────────────────────────────────────
    travelPlans        : List.List<TPTypes.TravelPlanRecord>,
    // ── booking erasable ─────────────────────────────────────────────
    bookingRequests    : List.List<BookingTypes.BookingRequest>,
    // ── crm erasable ─────────────────────────────────────────────────
    crmRequests        : List.List<CrmTypes.CrmRequest>,
    crmBusinessReports : List.List<CrmTypes.BusinessReport>,
    // ── gps-trail erasable ───────────────────────────────────────────
    gpsActivityLog     : List.List<GpsTypes.GpsActivityEntry>,
    checkIns           : List.List<GpsTypes.AttendanceCheckIn>,
    // ── incentive erasable ───────────────────────────────────────────
    incentiveCalcs     : List.List<IncentiveTypes.IncentiveCalculation>,
  ) : DataCleanupLog {

    // Capture counts BEFORE clearing
    let reportCount        = reports.size();
    let expenseCount       = expenses.size();
    let attendanceCount    = attendance.size();
    let leaveCount         = leaves.size();
    let travelPlanCount    = travelPlans.size();
    let bookingCount       = bookingRequests.size();
    let crmReqCount        = crmRequests.size();
    let crmBizCount        = crmBusinessReports.size();
    let gpsActivityCount   = gpsActivityLog.size();
    let checkInCount       = checkIns.size();
    let incentiveCalcCount = incentiveCalcs.size();

    // Clear all erasable data (preserves master data in other lists/maps)
    reports.clear();
    expenses.clear();
    attendance.clear();
    leaves.clear();
    travelPlans.clear();
    bookingRequests.clear();
    crmRequests.clear();
    crmBusinessReports.clear();
    gpsActivityLog.clear();
    checkIns.clear();
    incentiveCalcs.clear();

    let id = nextLogId.value;
    nextLogId.value += 1;

    let entry : DataCleanupLog = {
      id;
      adminUsername;
      timestamp = now;
      reason;
      recordsDeleted = [
        ("CallReport",           reportCount),
        ("TaDaExpense",          expenseCount),
        ("AttendanceRecord",     attendanceCount),
        ("LeaveApplication",     leaveCount),
        ("TravelPlan",           travelPlanCount),
        ("BookingRequest",       bookingCount),
        ("CrmRequest",           crmReqCount),
        ("BusinessReport",       crmBizCount),
        ("GpsActivityEntry",     gpsActivityCount),
        ("AttendanceCheckIn",    checkInCount),
        ("IncentiveCalculation", incentiveCalcCount),
      ];
      status = "success";
    };
    // Append-only — never delete log entries
    logs.add(entry);
    entry
  };

  // ── Query helpers ─────────────────────────────────────────────────────────────

  /// Return all cleanup log entries (Admin/HR read-only view).
  /// The log is immutable — entries are never deleted or modified.
  public func getCleanupHistory(
    logs : List.List<DataCleanupLog>,
  ) : [DataCleanupLog] {
    logs.toArray()
  };
};
