import HRCoreTypes "../types/hr-core";
import HolidayTypes "../types/company-holiday";
import FieldOpsTypes "../types/field-ops";
import GpsTrailTypes "../types/gps-trail";
import ExportTypes  "../types/exports";
import AuthTypes    "../types/auth-users";
import AuthLib      "../lib/auth-users";
import HRCoreLib   "../lib/hr-core";
import CompanyHolidayLib "../lib/company-holiday";
import FieldOps    "../lib/field-ops";
import Map         "mo:core/Map";
import List        "mo:core/List";
import Array       "mo:core/Array";
import Time        "mo:core/Time";
import Nat         "mo:core/Nat";
import Int         "mo:core/Int";

mixin (
  sessions         : Map.Map<Text, AuthTypes.Session>,
  leaves           : List.List<HRCoreTypes.LeaveApplication>,
  leaveQuotas      : List.List<HRCoreTypes.LeaveQuota>,
  roleLeaveQuotas  : List.List<HRCoreTypes.RoleLeaveQuota>,
  attendance       : List.List<HRCoreTypes.AttendanceRecord>,
  payroll          : List.List<HRCoreTypes.PayrollRecord>,
  expenses         : List.List<HRCoreTypes.TaDaExpense>,
  performance      : List.List<HRCoreTypes.PerformanceRecord>,
  documents        : List.List<HRCoreTypes.EmployeeDocument>,
  reports          : List.List<FieldOpsTypes.CallReport>,
  daConfigs        : Map.Map<Text, FieldOpsTypes.DaConfig>,
  users            : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
  nextLeaveId  : { var value : Nat },
  nextAttendId : { var value : Nat },
  nextPayId    : { var value : Nat },
  nextExpId    : { var value : Nat },
  nextPerfId   : { var value : Nat },
  nextDocId    : { var value : Nat },
  // Company holiday state — used for leave approval and payroll
  companyHolidays : List.List<HolidayTypes.CompanyHoliday>,
  // Grade-based TA/DA configuration (keyed by grade name)
  taDaGradeConfig : Map.Map<Text, FieldOpsTypes.TaDaGrade>,
  // Earned Leave accrual state
  elAccruals : List.List<HRCoreTypes.EarnedLeaveAccrual>,
) {

  // ── Session helpers ────────────────────────────────────────────────────────

  func requireSession(token : Text) : ?AuthTypes.Session {
    switch (sessions.get(token)) {
      case (?s) {
        if (s.expiresAt > Time.now()) ?s else null
      };
      case null { null };
    };
  };

  func requireHROrAdmin(token : Text) : ?AuthTypes.Session {
    switch (requireSession(token)) {
      case null { null };
      case (?s) {
        switch (s.role) {
          case (#Admin or #HRManager) ?s;
          case _                      { null };
        }
      };
    }
  };

  func requireManager(token : Text) : ?AuthTypes.Session {
    switch (requireSession(token)) {
      case null { null };
      case (?s) {
        switch (s.role) {
          case (#Admin or #HRManager or #ASM or #RSM or #ZSM) ?s;
          case _ { null };
        }
      };
    }
  };

  // ── Date helpers ───────────────────────────────────────────────────────────

  /// Parse "YYYY-MM-DD" into year, month, day tuple.
  func parseDateParts(date : Text) : (Nat, Nat, Nat) {
    let parts = date.split(#char '-').toArray();
    if (parts.size() < 3) return (0, 0, 0);
    let yr = switch (Nat.fromText(parts[0])) { case (?v) v; case null 0 };
    let mo = switch (Nat.fromText(parts[1])) { case (?v) v; case null 0 };
    let dy = switch (Nat.fromText(parts[2])) { case (?v) v; case null 0 };
    (yr, mo, dy)
  };

  /// Convert "YYYY-MM-DD" to nanoseconds since Unix epoch (midnight UTC).
  func dateToNs(date : Text) : Int {
    let (yr, mo, dy) = parseDateParts(date);
    // Civil epoch algorithm: days since 1970-01-01
    let m = mo.toInt();
    let y = yr.toInt();
    let d = dy.toInt();
    let yadj = if (m <= 2) y - 1 else y;
    let m2 = if (m <= 2) m + 9 else m - 3;
    let era = (if (yadj >= 0) yadj else yadj - 399) / 400;
    let yoe = yadj - era * 400;
    let doy = (153 * m2 + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    let days = era * 146097 + doe - 719468;
    days * 86400 * 1_000_000_000
  };

  /// Return true if the nanosecond timestamp is a Sunday (dow=0).
  func tsIsSunday(ts : Int) : Bool {
    let secs : Int = ts / 1_000_000_000;
    let days : Int = secs / 86400;
    let dow  : Int = Int.rem(days + 4, 7);
    dow == 0
  };

  /// Enumerate all ISO dates "YYYY-MM-DD" from fromDate to toDate inclusive.
  func dateRange(fromDate : Text, toDate : Text) : [Text] {
    let fromNs = dateToNs(fromDate);
    let toNs   = dateToNs(toDate);
    let dayNs  : Int = 86400 * 1_000_000_000;
    let result = List.empty<Text>();
    var cur = fromNs;
    var safety = 0;
    while (cur <= toNs and safety < 366) {
      // Convert nanoseconds back to ISO date
      let secs : Int = cur / 1_000_000_000;
      let days : Int = secs / 86400;
      let z    : Int = days + 719468;
      let era  : Int = (if (z >= 0) z else z - 146096) / 146097;
      let doe  : Int = z - era * 146097;
      let yoe  : Int = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
      let y    : Int = yoe + era * 400;
      let doy  : Int = doe - (365 * yoe + yoe / 4 - yoe / 100);
      let mp   : Int = (5 * doy + 2) / 153;
      let d    : Int = doy - (153 * mp + 2) / 5 + 1;
      let m    : Int = if (mp < 10) mp + 3 else mp - 9;
      let yr   : Int = if (m <= 2) y + 1 else y;
      let ys = yr.toText();
      let ms = if (m < 10) "0" # m.toText() else m.toText();
      let ds = if (d < 10) "0" # d.toText() else d.toText();
      result.add(ys # "-" # ms # "-" # ds);
      cur += dayNs;
      safety += 1;
    };
    result.toArray()
  };

  /// Upsert an attendance record with given status, leaveAppId, and holidayId.
  /// When inserting fresh, initialises all optional fields to null.
  func upsertAttendanceRecord(
    employeeId    : Nat,
    date          : Text,
    status        : HRCoreTypes.AttendanceStatus,
    checkInTime   : ?Text,
    checkInGps    : ?HRCoreTypes.GpsCoord,
    leaveAppId    : ?Nat,
    holidayId     : ?Nat,
  ) {
    let idx = attendance.findIndex(func(r : HRCoreTypes.AttendanceRecord) : Bool {
      r.employeeId == employeeId and r.date == date
    });
    switch (idx) {
      case (?i) {
        let old = attendance.at(i);
        attendance.put(i, {
          old with
          status;
          checkInTime        = switch (checkInTime) { case (?v) ?v; case null old.checkInTime };
          checkInGps         = switch (checkInGps)  { case (?v) ?v; case null old.checkInGps  };
          leaveApplicationId = switch (leaveAppId)  { case (?v) ?v; case null old.leaveApplicationId };
          holidayId          = switch (holidayId)   { case (?v) ?v; case null old.holidayId };
        });
      };
      case null {
        let rec : HRCoreTypes.AttendanceRecord = {
          id                 = nextAttendId.value;
          employeeId;
          date;
          status;
          checkInTime;
          checkInGps;
          leaveApplicationId = leaveAppId;
          holidayId;
          correctedBy        = null;
          correctionRemark   = null;
          correctionAt       = null;
          recordedAt         = Time.now();
        };
        nextAttendId.value += 1;
        attendance.add(rec);
      };
    };
  };

  /// Auto-mark attendance records for all days of an approved leave.
  /// Skips Sundays and Company Holidays (those stay as-is).
  func autoMarkLeaveAttendance(leave : HRCoreTypes.LeaveApplication) {
    let leaveStatus : HRCoreTypes.AttendanceStatus = switch (leave.leaveType) {
      case (#casual)      #onLeaveCL;
      case (#sick)        #onLeaveSL;
      case (#unpaid)      #onLeaveUPL;
      case (#pl)          #onLeavePL;
      case (#ml)          #onLeaveML;
      case (#lwp)         #onLeaveLWP;
      case (#co)          #onLeaveCO;
      // #pl covers Earned Leave (EL) — maps to #onLeavePL
      // #co covers Field Leave (FL) — maps to #onLeaveCO
    };
    let dates = dateRange(leave.fromDate, leave.toDate);
    for (date in dates.values()) {
      let ns = dateToNs(date);
      // Skip Sundays
      if (tsIsSunday(ns)) {
        // do nothing — Sunday is paid weekly off
      } else if (CompanyHolidayLib.isHolidayDate(companyHolidays, ns)) {
        // do nothing — company holiday takes precedence
      } else {
        upsertAttendanceRecord(leave.employeeId, date, leaveStatus, null, null, ?leave.id, null);
      };
    };
  };

  // ── Leave Management API ───────────────────────────────────────────────────

  /// Apply for leave using structured input. GPS captured at application time.
  public shared func applyLeaveV2(
    token : Text,
    input : HRCoreTypes.ApplyLeaveInput,
  ) : async { #ok : HRCoreTypes.LeaveApplication; #err : Text } {
    switch (requireSession(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        let app = HRCoreLib.applyLeaveV2(leaves, nextLeaveId.value, s.userId, input);
        nextLeaveId.value += 1;
        #ok(app)
      };
    }
  };

  /// Approve or reject a leave application (manager/HR/Admin).
  /// On approval: auto-marks attendance records for the leave period.
  public shared func updateLeaveStatus(
    token : Text,
    input : HRCoreTypes.UpdateLeaveStatusInput,
  ) : async { #ok : HRCoreTypes.LeaveApplication; #err : Text } {
    switch (requireManager(token)) {
      case null { #err("Unauthorized: manager role required or session expired") };
      case (?s) {
        let verifiedInput = { input with approverId = s.userId };
        switch (HRCoreLib.updateLeaveStatusV2(leaves, verifiedInput)) {
          case (?updated) {
            if (updated.status == #approved) {
              autoMarkLeaveAttendance(updated);
            };
            #ok(updated)
          };
          case null { #err("Leave application not found") };
        }
      };
    }
  };

  /// Return all leave applications submitted by the calling user.
  public query func getMyLeaves(token : Text) : async { #ok : [HRCoreTypes.LeaveApplication]; #err : Text } {
    switch (requireSession(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) { #ok(HRCoreLib.getEmployeeLeaves(leaves, s.userId)) };
    }
  };

  /// Return pending leaves from the calling manager's direct subordinates.
  public query func getPendingLeavesForManager(token : Text) : async { #ok : [HRCoreTypes.LeaveApplication]; #err : Text } {
    switch (requireManager(token)) {
      case null { #err("Unauthorized: manager role required or session expired") };
      case (?s) { #ok(HRCoreLib.getPendingLeavesForManager(leaves, users, s.userId)) };
    }
  };

  /// Derive the current 4-digit calendar year from a nanosecond timestamp.
  /// Uses the same civil-calendar algorithm as yearFromNow() in lib/auth-users.mo.
  func currentYear() : Nat {
    let now : Int = Time.now();
    let secs : Int = now / 1_000_000_000;
    let days : Int = secs / 86400;
    let z    : Int = days + 719468;
    let era  : Int = (if (z >= 0) z else z - 146096) / 146097;
    let doe  : Int = z - era * 146097;
    let yoe  : Int = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y    : Int = yoe + era * 400;
    let doy  : Int = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp   : Int = (5 * doy + 2) / 153;
    let m    : Int = if (mp < 10) mp + 3 else mp - 9;
    let yr   : Int = if (m <= 2) y + 1 else y;
    if (yr > 0) yr.toNat() else 2026
  };

  /// Return the calling user's remaining leave balance for the current year.
  public query func getLeaveBalance(token : Text) : async { #ok : { casual : Int; sick : Int; unpaid : Int; pl : Int; ml : Int; lwp : Int; co : Int }; #err : Text } {
    switch (requireSession(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        let year = currentYear();
        #ok(HRCoreLib.getLeaveBalanceV2(leaveQuotas, roleLeaveQuotas, leaves, users, s.userId, year))
      };
    }
  };

  /// Set role-level annual leave quota (Admin only).
  public shared func setRoleLeaveQuota(
    token : Text,
    quota : HRCoreTypes.RoleLeaveQuota,
  ) : async { #ok : HRCoreTypes.RoleLeaveQuota; #err : Text } {
    switch (requireSession(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        switch (s.role) {
          case (#Admin) { #ok(HRCoreLib.setRoleLeaveQuota(roleLeaveQuotas, quota)) };
          case _ { #err("Access denied: Admin only") };
        }
      };
    }
  };

  /// Get role-level annual leave quota for a specific role and year.
  public query func getRoleLeaveQuota(
    token : Text,
    role  : AuthTypes.Role,
    year  : Nat,
  ) : async { #ok : HRCoreTypes.RoleLeaveQuota; #err : Text } {
    switch (requireSession(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        switch (s.role) {
          case (#Admin or #HRManager) {
            switch (HRCoreLib.getRoleLeaveQuota(roleLeaveQuotas, role, year)) {
              case (?q) { #ok(q) };
              case null { #err("Role quota not found") };
            }
          };
          case _ { #err("Access denied: HR or Admin required") };
        }
      };
    }
  };

  /// Return all leave applications matching the given filter (HR/Admin only).
  public query func getAllLeaves(
    token  : Text,
    filter : HRCoreTypes.LeaveFilter,
  ) : async { #ok : [HRCoreTypes.LeaveApplication]; #err : Text } {
    switch (requireSession(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        switch (s.role) {
          case (#Admin or #HRManager) {
            #ok(HRCoreLib.getAllLeaves(leaves, filter))
          };
          case _ {
            let subordinateFilter : HRCoreTypes.LeaveFilter = { filter with userId = null };
            let allLeavesArr = HRCoreLib.getAllLeaves(leaves, subordinateFilter);
            let teamLeaves = allLeavesArr.filter(func(app) {
              switch (users.get(app.employeeId)) {
                case (?u) {
                  switch (u.reportsTo) {
                    case (?mid) mid == s.userId;
                    case null false;
                  }
                };
                case null false;
              }
            });
            #ok(teamLeaves)
          };
        }
      };
    }
  };

  /// Return leave export rows matching the given filter (HR/Admin only).
  public query func getLeaveExportRows(
    token  : Text,
    filter : HRCoreTypes.LeaveFilter,
  ) : async { #ok : [ExportTypes.LeaveExportRow]; #err : Text } {
    switch (requireHROrAdmin(token)) {
      case null { #err("Unauthorized: HR or Admin role required") };
      case (?_) { #ok(HRCoreLib.getLeaveExportRows(leaves, users, filter)) };
    }
  };

  // ── Attendance API ─────────────────────────────────────────────────────────

  public shared func recordAttendance(
    token      : Text,
    employeeId : Nat,
    date       : Text,
    status     : HRCoreTypes.AttendanceStatus,
  ) : async AuthTypes.MutationResult {
    switch (requireHROrAdmin(token)) {
      case null { #err("Unauthorized: HR or Admin role required") };
      case (?_) {
        let _ = HRCoreLib.recordAttendance(attendance, nextAttendId.value, employeeId, date, status);
        nextAttendId.value += 1;
        #ok
      };
    }
  };

  public query func getMonthlyAttendance(
    token      : Text,
    employeeId : Nat,
    month      : Nat,
    year       : Nat,
  ) : async [HRCoreTypes.AttendanceRecord] {
    switch (requireSession(token)) {
      case null { [] };
      case (?_) { HRCoreLib.getMonthlyAttendance(attendance, employeeId, month, year) };
    }
  };

  public query func getMonthlySummary(
    token      : Text,
    employeeId : Nat,
    month      : Nat,
    year       : Nat,
  ) : async HRCoreTypes.MonthlySummary {
    let _ = requireSession(token); // optional: returns empty summary if unauth
    HRCoreLib.computeMonthlySummary(attendance, leaves, employeeId, month, year);
  };

  // ── Payroll API ────────────────────────────────────────────────────────────

  public shared func processPayroll(
    token      : Text,
    employeeId : Nat,
    month      : Nat,
    year       : Nat,
  ) : async AuthTypes.MutationResult {
    switch (requireHROrAdmin(token)) {
      case null { #err("Unauthorized: HR or Admin role required") };
      case (?s) {
        switch (HRCoreLib.getPayrollRecord(payroll, employeeId, month, year)) {
          case (?_) { #err("Payroll already processed for this period") };
          case null {
            let _ = HRCoreLib.processPayroll(payroll, nextPayId.value, attendance, leaves, employeeId, month, year, 0, 0, 0, 0, 0, s.userId);
            nextPayId.value += 1;
            #ok
          };
        }
      };
    }
  };

  /// Full payroll processing with explicit salary components.
  public shared func processPayrollFull(
    token       : Text,
    employeeId  : Nat,
    month       : Nat,
    year        : Nat,
    basicPay    : Nat,
    hra         : Nat,
    taAllowance : Nat,
    daAllowance : Nat,
  ) : async AuthTypes.MutationResult {
    switch (requireHROrAdmin(token)) {
      case null { #err("Unauthorized: HR or Admin role required") };
      case (?s) {
        switch (HRCoreLib.getPayrollRecord(payroll, employeeId, month, year)) {
          case (?_) { #err("Payroll already processed for this period") };
          case null {
            let (effectiveTa, baseDa) : (Nat, Nat) = if (taAllowance == 0 and daAllowance == 0) {
              let totals = HRCoreLib.getApprovedTaDaTotal(expenses, employeeId, month, year);
              (totals.taTotal, totals.daTotal)
            } else {
              (taAllowance, daAllowance)
            };
            let dcrDa = FieldOps.getApprovedDaForMonth(reports, employeeId, month, year);
            let effectiveDa = baseDa + dcrDa;
            let _ = HRCoreLib.processPayroll(payroll, nextPayId.value, attendance, leaves, employeeId, month, year, basicPay, hra, effectiveTa, effectiveDa, 0, s.userId);
            nextPayId.value += 1;
            #ok
          };
        }
      };
    }
  };

  public query func getPayrollRecord(
    token      : Text,
    employeeId : Nat,
    month      : Nat,
    year       : Nat,
  ) : async ?HRCoreTypes.PayrollRecord {
    switch (requireSession(token)) {
      case null { null };
      case (?_) { HRCoreLib.getPayrollRecord(payroll, employeeId, month, year) };
    }
  };

  public query func getMyPayrollHistory(token : Text) : async [HRCoreTypes.PayrollRecord] {
    switch (requireSession(token)) {
      case null { [] };
      case (?s) {
        let history = HRCoreLib.getEmployeePayrollHistory(payroll, s.userId);
        let approved = history.filter(func(r) { r.isApproved });
        approved.reverse()
      };
    }
  };

  public query func getMyPayrollRecord(
    token : Text,
    month : Nat,
    year  : Nat,
  ) : async ?HRCoreTypes.PayrollRecord {
    switch (requireSession(token)) {
      case null { null };
      case (?s) {
        switch (HRCoreLib.getPayrollRecord(payroll, s.userId, month, year)) {
          case (?r) { if (r.isApproved) ?r else null };
          case null { null };
        }
      };
    }
  };

  // ── TA/DA Expense Claims API ──────────────────────────────────────────────

  /// Get the configured HQ DA rate in Rupees. Used by frontend to auto-fill HQ DA amount.
  /// Returns 250 (the HQ daily allowance rate in Rupees).
  public query func getHqDaRate() : async Nat {
    HRCoreLib.hqDaRateRs
  };

  /// Submit a Personal TA/DA expense claim. Accessible to ALL employee roles.
  /// When stationType is "HQ": fromLocation/toLocation are ignored, distance is stored
  /// as 0, and DA is automatically set to the HQ rate (Rs 250 = 25000 paise).
  /// For all other station types: fromLocation, toLocation, and distanceKm are used normally.
  public shared func submitTaDaExpense(
    token        : Text,
    date         : Text,
    stationType  : HRCoreTypes.StationType,
    fromLocation : ?Text,
    toLocation   : ?Text,
    distanceKm   : Nat,
    daRate       : HRCoreTypes.DaRate,
    purpose      : Text,
    gpsLocation  : ?HRCoreTypes.GpsCoord,
  ) : async AuthTypes.MutationResult {
    switch (requireSession(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        // Derive role as text for storage — all roles are permitted
        let roleText : Text = switch (s.role) {
          case (#Admin)     "Admin";
          case (#HRManager) "HR";
          case (#ZSM)       "ZSM";
          case (#RSM)       "RSM";
          case (#ASM)       "ASM";
          case (#MR)        "MR";
        };
        let _ = HRCoreLib.submitExpense(
          expenses, nextExpId.value, s.userId,
          date, stationType, fromLocation, toLocation,
          distanceKm, daRate, purpose, roleText, gpsLocation,
        );
        nextExpId.value += 1;
        #ok
      };
    }
  };

  public shared func approveExpense(
    token     : Text,
    expenseId : Nat,
    approve   : Bool,
  ) : async AuthTypes.MutationResult {
    switch (requireManager(token)) {
      case null { #err("Unauthorized: manager role required or session expired") };
      case (?s) {
        let newStatus : HRCoreTypes.ExpenseStatus = if (approve) #approved else #rejected;
        let ok = HRCoreLib.updateExpenseStatus(expenses, expenseId, newStatus, s.userId);
        if (ok) #ok else #err("Expense not found or already processed")
      };
    }
  };

  public query func getMyExpenses(token : Text) : async [HRCoreTypes.TaDaExpense] {
    switch (requireSession(token)) {
      case null { [] };
      case (?s) { HRCoreLib.getEmployeeExpenses(expenses, s.userId) };
    }
  };

  public query func getPendingExpenses(token : Text) : async [HRCoreTypes.TaDaExpense] {
    switch (requireManager(token)) {
      case null { [] };
      case (?s) {
        // HR and Admin see all pending expenses
        switch (s.role) {
          case (#Admin or #HRManager) {
            HRCoreLib.getPendingExpenses(expenses)
          };
          case _ {
            // Other managers (ASM/RSM/ZSM) see only pending expenses
            // from employees within their transitive reporting hierarchy
            let subordinateIds = AuthLib.allReporteeIds(users, s.userId);
            HRCoreLib.getPendingExpenses(expenses).filter(func(e : HRCoreTypes.TaDaExpense) : Bool {
              subordinateIds.find(func(sid : Nat) : Bool { sid == e.employeeId }) != null
            })
          };
        }
      };
    }
  };

  // ── Performance API ────────────────────────────────────────────────────────

  public query func getEmployeePerformance(
    token      : Text,
    employeeId : Nat,
    month      : Nat,
    year       : Nat,
  ) : async ?HRCoreTypes.PerformanceRecord {
    switch (requireSession(token)) {
      case null { null };
      case (?_) { HRCoreLib.getPerformanceRecord(performance, employeeId, month, year) };
    }
  };

  public shared func upsertPerformance(
    token          : Text,
    employeeId     : Nat,
    month          : Nat,
    year           : Nat,
    callsMade      : Nat,
    doctorsVisited : Nat,
    chemistOrders  : Nat,
    totalSales     : Nat,
    remarks        : Text,
  ) : async AuthTypes.MutationResult {
    switch (requireSession(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        let _ = HRCoreLib.upsertPerformance(performance, nextPerfId.value, employeeId, month, year, callsMade, doctorsVisited, chemistOrders, totalSales, remarks, s.userId);
        nextPerfId.value += 1;
        #ok
      };
    }
  };

  // ── Document Storage API ───────────────────────────────────────────────────

  public shared func addDocument(
    token        : Text,
    employeeId   : Nat,
    documentType : HRCoreTypes.DocumentType,
    fileName     : Text,
    storageUrl   : Text,
  ) : async AuthTypes.MutationResult {
    switch (requireHROrAdmin(token)) {
      case null { #err("Unauthorized: HR or Admin role required") };
      case (?s) {
        let _ = HRCoreLib.addDocument(documents, nextDocId.value, employeeId, documentType, fileName, storageUrl, s.userId);
        nextDocId.value += 1;
        #ok
      };
    }
  };

  public query func getEmployeeDocuments(
    token      : Text,
    employeeId : Nat,
  ) : async [HRCoreTypes.EmployeeDocument] {
    switch (requireSession(token)) {
      case null { [] };
      case (?_) { HRCoreLib.getEmployeeDocuments(documents, employeeId) };
    }
  };

  public shared func deleteDocument(
    token      : Text,
    documentId : Nat,
  ) : async AuthTypes.MutationResult {
    switch (requireHROrAdmin(token)) {
      case null { #err("Unauthorized: HR or Admin role required") };
      case (?_) {
        let ok = HRCoreLib.deleteDocument(documents, documentId);
        if (ok) #ok else #err("Document not found")
      };
    }
  };

  // ── TA/DA Auto-fetch for Payroll ──────────────────────────────────────────

  public query func getApprovedTaDaForMonth(
    token      : Text,
    employeeId : Nat,
    month      : Nat,
    year       : Nat,
  ) : async GpsTrailTypes.TaDaTotals {
    let _ = requireSession(token); // returns zero totals if unauth — non-sensitive query
    HRCoreLib.getApprovedTaDaTotal(expenses, employeeId, month, year);
  };

  public query func getEmployeeDcrDaForMonth(
    token      : Text,
    employeeId : Nat,
    month      : Nat,
    year       : Nat,
  ) : async Nat {
    switch (requireHROrAdmin(token)) {
      case null { 0 };
      case (?_) { FieldOps.getApprovedDaForMonth(reports, employeeId, month, year) };
    }
  };

  // ── Attendance API — Extended ─────────────────────────────────────────────

  public shared func correctAttendance(
    token : Text,
    input : HRCoreTypes.AttendanceCorrectionInput,
  ) : async { #ok; #err : Text } {
    switch (requireHROrAdmin(token)) {
      case null { #err("Unauthorized: HR or Admin role required") };
      case (?s) {
        let idx = attendance.findIndex(func(r : HRCoreTypes.AttendanceRecord) : Bool {
          r.employeeId == input.employeeId and r.date == input.date
        });
        switch (idx) {
          case null {
            let rec : HRCoreTypes.AttendanceRecord = {
              id                 = nextAttendId.value;
              employeeId         = input.employeeId;
              date               = input.date;
              status             = input.newStatus;
              checkInTime        = null;
              checkInGps         = null;
              leaveApplicationId = null;
              holidayId          = null;
              correctedBy        = ?s.userId.toText();
              correctionRemark   = ?input.reason;
              correctionAt       = ?Time.now();
              recordedAt         = Time.now();
            };
            nextAttendId.value += 1;
            attendance.add(rec);
            #ok
          };
          case (?i) {
            let old = attendance.at(i);
            attendance.put(i, {
              old with
              status           = input.newStatus;
              correctedBy      = ?s.userId.toText();
              correctionRemark = ?input.reason;
              correctionAt     = ?Time.now();
            });
            #ok
          };
        }
      };
    }
  };

  public query func getEmployeeMonthlyAttendance(
    token      : Text,
    employeeId : Nat,
    month      : Nat,
    year       : Nat,
  ) : async [HRCoreTypes.AttendanceRecord] {
    switch (requireHROrAdmin(token)) {
      case null { [] };
      case (?_) { HRCoreLib.getMonthlyAttendance(attendance, employeeId, month, year) };
    }
  };

  public query func getMyMonthlyAttendance(
    token : Text,
    month : Nat,
    year  : Nat,
  ) : async [HRCoreTypes.AttendanceRecord] {
    switch (requireSession(token)) {
      case null { [] };
      case (?s) { HRCoreLib.getMonthlyAttendance(attendance, s.userId, month, year) };
    }
  };

  public query func getAttendanceSummaryForEmployee(
    token      : Text,
    employeeId : Nat,
    month      : Nat,
    year       : Nat,
  ) : async { present : Nat; absent : Nat; leaves : Nat; holidays : Nat; weeklyOffs : Nat } {
    switch (requireHROrAdmin(token)) {
      case null { { present = 0; absent = 0; leaves = 0; holidays = 0; weeklyOffs = 0 } };
      case (?_) {
        let summary = HRCoreLib.computeMonthlySummary(attendance, leaves, employeeId, month, year);
        {
          present    = summary.presentDays;
          absent     = summary.absentDays;
          leaves     = summary.leaveDays;
          holidays   = summary.holidays;
          weeklyOffs = summary.weeklyOffs;
        }
      };
    }
  };

  // ── Grade-based TA/DA Configuration API ───────────────────────────────────────

  /// Set or update a TA/DA grade configuration (Admin and HR only).
  public shared func setTaDaGrade(
    token : Text,
    grade : FieldOpsTypes.TaDaGrade,
  ) : async { #ok : FieldOpsTypes.TaDaGrade; #err : Text } {
    switch (requireHROrAdmin(token)) {
      case null { #err("Unauthorized: HR or Admin role required") };
      case (?_) {
        taDaGradeConfig.add(grade.gradeName, grade);
        #ok(grade)
      };
    }
  };

  /// Get all TA/DA grade configurations.
  public query func getTaDaGrades(token : Text) : async { #ok : [FieldOpsTypes.TaDaGrade]; #err : Text } {
    switch (requireSession(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?_) {
        let grades : List.List<FieldOpsTypes.TaDaGrade> = List.empty();
        for ((_, g) in taDaGradeConfig.entries()) { grades.add(g) };
        #ok(grades.toArray())
      };
    }
  };

  /// Get a specific TA/DA grade by name.
  public query func getTaDaGradeByName(
    token     : Text,
    gradeName : Text,
  ) : async { #ok : FieldOpsTypes.TaDaGrade; #err : Text } {
    switch (requireSession(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?_) {
        switch (taDaGradeConfig.get(gradeName)) {
          case (?g) { #ok(g) };
          case null { #err("Grade not found: " # gradeName) };
        }
      };
    }
  };

  /// Delete a TA/DA grade configuration (Admin only).
  public shared func deleteTaDaGrade(
    token     : Text,
    gradeName : Text,
  ) : async { #ok; #err : Text } {
    switch (requireSession(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        switch (s.role) {
          case (#Admin) { taDaGradeConfig.remove(gradeName); #ok };
          case _ { #err("Access denied: Admin only") };
        }
      };
    }
  };

  /// Submit a TA/DA expense claim with full SFA fields.
  /// Accepts optional grade name to auto-apply grade-based rates.
  /// Backward compat: existing submitTaDaExpense still works; this is the V2 endpoint.
  public shared func submitTaDaExpenseV2(
    token           : Text,
    date            : Text,
    stationType     : HRCoreTypes.StationType,
    fromLocation    : ?Text,
    toLocation      : ?Text,
    distanceKm      : Nat,
    daRate          : HRCoreTypes.DaRate,
    purpose         : Text,
    gpsLocation     : ?HRCoreTypes.GpsCoord,
    modeOfTransport : ?Text,
    lodgingExpense  : ?Nat,
    miscExpense     : ?Nat,
    miscNarration   : ?Text,
    gradeName       : ?Text,
  ) : async { #ok : HRCoreTypes.TaDaExpense; #err : Text } {
    switch (requireSession(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        let roleText : Text = switch (s.role) {
          case (#Admin)     "Admin";
          case (#HRManager) "HR";
          case (#ZSM)       "ZSM";
          case (#RSM)       "RSM";
          case (#ASM)       "ASM";
          case (#MR)        "MR";
        };
        // Resolve grade-based rates if grade name provided
        let (taPerKm, daOverride) : (Nat, Nat) = switch (gradeName) {
          case (?gn) {
            switch (taDaGradeConfig.get(gn)) {
              case (?g) {
                let da : Nat = switch (stationType) {
                  case (#HQ)         g.daHqRate;
                  case (#ExHQ)       g.daExStationRate;
                  case (#Outstation) g.daOutStationRate;
                  case (#Local)      g.daHqRate;
                };
                (g.taPerKmRate, da)
              };
              case null { (275, 0) };
            }
          };
          case null { (275, 0) };
        };
        let exp = HRCoreLib.submitExpenseV2(
          expenses, nextExpId.value, s.userId,
          date, stationType, fromLocation, toLocation,
          distanceKm, daRate, purpose, roleText, gpsLocation,
          modeOfTransport, lodgingExpense, miscExpense, miscNarration,
          gradeName, taPerKm, daOverride,
        );
        nextExpId.value += 1;
        #ok(exp)
      };
    }
  };

  // ── Earned Leave Accrual (EL) ───────────────────────────────────────────────────

  /// Get Earned Leave balance for the calling employee (or any employee for HR/Admin).
  public shared ({ caller }) func getEarnedLeaveBalance(
    token : Text,
    empId : ?Nat,
    year  : Nat,
  ) : async { #ok : { accrued : Nat; used : Nat; balance : Int }; #err : Text } {
    switch (requireSession(token)) {
      case null #err("Not authenticated");
      case (?s) {
        let targetId = switch (empId) {
          case (?id) id;
          case null  s.userId;
        };
        #ok(HRCoreLib.getEarnedLeaveBalance(elAccruals, leaves, targetId, year));
      };
    };
  };

  /// Admin/HR: trigger monthly EL accrual for an employee.
  public shared ({ caller }) func updateEarnedLeaveAccrual(
    token       : Text,
    employeeId  : Nat,
    year        : Nat,
    month       : Nat,
    annualLimit : Nat,
  ) : async { #ok; #err : Text } {
    switch (requireHROrAdmin(token)) {
      case null #err("Access denied");
      case (?_s) {
        HRCoreLib.updateEarnedLeaveAccrual(elAccruals, employeeId, year, month, annualLimit);
        #ok;
      };
    };
  };
};
