import DashTypes "../types/dashboard";
import AuthTypes "../types/auth-users";
import DcrTypes  "../types/dcr";
import GpsTypes  "../types/gps-trail";
import FieldTypes "../types/field-ops";
import CCTypes   "../types/chemist-call";
import SFATypes  "../types/sfa-sample";
import HRTypes   "../types/hr-core";
import AbsenceTypes "../types/absence-inactivation";
import CommonTypes  "../types/common";
import PEAWTypes "../types/payroll-expenses-advances-workingstyle";
import LocTypes  "../types/location-master";
import Map   "mo:core/Map";
import List  "mo:core/List";
import Set   "mo:core/Set";
import Text  "mo:core/Text";

module {

  // ── RSM direct-MR detection ───────────────────────────────────────────────

  /// Returns all MRs whose reportsTo equals the given RSM userId.
  public func getRsmDirectMrs(
    rsmId : AuthTypes.UserId,
    users : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
  ) : [AuthTypes.UserInfo] {
    let result = List.empty<AuthTypes.UserInfo>();
    for ((_, u) in users.entries()) {
      if (u.role == #MR) {
        switch (u.reportsTo) {
          case (?mgr) {
            if (mgr == rsmId) {
              result.add({
                id           = u.id;
                username     = u.username;
                role         = u.role;
                status       = u.status;
                employeeId   = u.employeeId;
                name         = u.name;
                email        = u.email;
                phone        = u.phone;
                designation  = u.designation;
                department   = u.department;
                territory    = u.territory;
                reportsTo    = u.reportsTo;
                joinDate     = u.joinDate;
                dateOfBirth  = null;
                salary       = u.salary;
                primaryHqId  = u.primaryHqId;
                zoneIds      = u.zoneIds;
                stateIds     = u.stateIds;
                territoryIds = u.territoryIds;
                hqIds        = u.hqIds;
                areaIds      = u.areaIds;
                hqAssignments = u.hqAssignments;
                migrationDone = u.migrationDone;
                createdAt    = u.createdAt;
              });
            }
          };
          case null {};
        }
      }
    };
    result.toArray()
  };

  // ── Team daily activity ───────────────────────────────────────────────────

  /// For each MR in mrIds, build one MrDailyActivityRow for the given ISO date.
  public func getTeamDailyActivity(
    mrIds         : [AuthTypes.UserId],
    date          : Text,
    users         : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
    checkIns      : List.List<GpsTypes.AttendanceCheckIn>,
    reports       : List.List<FieldTypes.CallReport>,
    chemistCalls  : List.List<CCTypes.ChemistCallRecord>,
    stockistCalls : List.List<CCTypes.StockistCallRecord>,
    dcrs          : List.List<DcrTypes.DcrRecord>,
    locations     : Map.Map<AuthTypes.UserId, AuthTypes.LocationRecord>,
  ) : [DashTypes.MrDailyActivityRow] {
    let result = List.empty<DashTypes.MrDailyActivityRow>();
    for (mrId in mrIds.values()) {
      let mrName : Text = switch (users.get(mrId)) {
        case (?u) u.name;
        case null "Unknown";
      };

      // Check-in for this MR on this date
      let checkInOpt = checkIns.find(func(ci : GpsTypes.AttendanceCheckIn) : Bool {
        ci.userId == mrId and ci.date == date
      });
      let checkedIn     = checkInOpt != null;
      let checkInTime   : ?Int = switch (checkInOpt) {
        case (?ci) ?ci.recordedAt;
        case null  null;
      };

      // Doctor calls today
      let doctorCallsToday = reports.filter(func(r : FieldTypes.CallReport) : Bool {
        r.mrId == mrId and r.date == date
      }).size();

      // Chemist visits today
      let chemistVisitsToday = chemistCalls.filter(func(c : CCTypes.ChemistCallRecord) : Bool {
        c.mrId == mrId and c.date == date
      }).size();

      // Stockist visits today
      let stockistVisitsToday = stockistCalls.filter(func(s : CCTypes.StockistCallRecord) : Bool {
        s.mrId == mrId and s.date == date
      }).size();

      // DCR status today
      let dcrOpt = dcrs.find(func(d : DcrTypes.DcrRecord) : Bool {
        d.mrId == mrId and d.date == date
      });
      let dcrStatusToday : Text = switch (dcrOpt) {
        case null { "Not Submitted" };
        case (?d) {
          switch (d.status) {
            case (#Draft)     { "Not Submitted" };
            case (#Submitted) { if (d.isLate) "Late" else "Submitted" };
            case (#Late)      { "Late" };
            case (#Approved)  { "Approved" };
            case (#Rejected)  { "Rejected" };
          }
        };
      };

      // Last GPS: prefer most recent check-in GPS, fall back to location map
      let lastGpsLat  : ?Float = switch (checkInOpt) {
        case (?ci) ?ci.gpsCoord.lat;
        case null  {
          switch (locations.get(mrId)) {
            case (?loc) ?loc.lat;
            case null   null;
          }
        };
      };
      let lastGpsLng  : ?Float = switch (checkInOpt) {
        case (?ci) ?ci.gpsCoord.lng;
        case null  {
          switch (locations.get(mrId)) {
            case (?loc) ?loc.lng;
            case null   null;
          }
        };
      };
      let lastGpsTime : ?Int = switch (checkInOpt) {
        case (?ci) ?ci.gpsCoord.timestamp;
        case null  {
          switch (locations.get(mrId)) {
            case (?loc) ?loc.timestamp;
            case null   null;
          }
        };
      };

      result.add({
        mrId;
        mrName;
        checkInStatus        = checkedIn;
        checkInTime;
        doctorCallsToday;
        chemistVisitsToday;
        stockistVisitsToday;
        dcrStatusToday;
        lastGpsLat;
        lastGpsLng;
        lastGpsTime;
      });
    };
    result.toArray()
  };

  // ── Internal: collect MR IDs in hierarchy ────────────────────────────────

  func collectSubordinateMrIds(
    managerId : AuthTypes.UserId,
    users     : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
  ) : [AuthTypes.UserId] {
    let mrList = List.empty<AuthTypes.UserId>();
    for ((_, u) in users.entries()) {
      if (u.role == #MR) {
        var cursor : ?AuthTypes.UserId = u.reportsTo;
        var found  = false;
        var depth  = 0;
        label walker loop {
          switch (cursor) {
            case null { break walker };
            case (?mid) {
              if (mid == managerId) { found := true; break walker };
              if (depth >= 6) { break walker };
              depth += 1;
              cursor := switch (users.get(mid)) {
                case (?m) m.reportsTo;
                case null null;
              };
            };
          }
        };
        if (found) mrList.add(u.id);
      }
    };
    mrList.toArray()
  };

  func _allSubordinateIds(
    managerId : AuthTypes.UserId,
    users     : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
  ) : [AuthTypes.UserId] {
    let result = List.empty<AuthTypes.UserId>();
    for ((_, u) in users.entries()) {
      if (u.id != managerId) {
        var cursor : ?AuthTypes.UserId = u.reportsTo;
        var found  = false;
        var depth  = 0;
        label walker loop {
          switch (cursor) {
            case null { break walker };
            case (?mid) {
              if (mid == managerId) { found := true; break walker };
              if (depth >= 8) { break walker };
              depth += 1;
              cursor := switch (users.get(mid)) {
                case (?m) m.reportsTo;
                case null null;
              };
            };
          }
        };
        if (found) result.add(u.id);
      }
    };
    result.toArray()
  };

  // ── Pending approval counts ───────────────────────────────────────────────

  /// Count pending approvals for a manager. directMrIds is non-empty only for RSM.
  public func getPendingApprovalCounts(
    managerId   : AuthTypes.UserId,
    managerRole : CommonTypes.Role,
    directMrIds : [AuthTypes.UserId],
    leaves      : List.List<HRTypes.LeaveApplication>,
    expenses    : List.List<HRTypes.TaDaExpense>,
    dcrs        : List.List<DcrTypes.DcrRecord>,
    users       : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
  ) : DashTypes.PendingApprovalCounts {
    let allSubMrIds = collectSubordinateMrIds(managerId, users);

    var leavePending : Nat = 0;
    for (l in leaves.values()) {
      if (l.status == #pending) {
        let empId : AuthTypes.UserId = l.employeeId;
        if (allSubMrIds.any(func(id : AuthTypes.UserId) : Bool { id == empId })) {
          leavePending += 1;
        };
      };
    };

    var tadaPending : Nat = 0;
    for (e in expenses.values()) {
      if (e.status == #pending) {
        if (allSubMrIds.any(func(id : AuthTypes.UserId) : Bool { id == e.employeeId })) {
          tadaPending += 1;
        };
      };
    };

    // Direct MR scope for DCR approvals
    let dcrScopeMrIds : [AuthTypes.UserId] = switch (managerRole) {
      case (#ASM) {
        let direct = List.empty<AuthTypes.UserId>();
        for ((_, u) in users.entries()) {
          if (u.role == #MR) {
            switch (u.reportsTo) {
              case (?mgr) { if (mgr == managerId) direct.add(u.id) };
              case null {};
            };
          };
        };
        direct.toArray()
      };
      case (#RSM) { directMrIds };
      case _      { allSubMrIds };
    };

    var dcrPending : Nat = 0;
    for (d in dcrs.values()) {
      switch (d.status) {
        case (#Submitted or #Late) {
          if (dcrScopeMrIds.any(func(id : AuthTypes.UserId) : Bool { id == d.mrId })) {
            dcrPending += 1;
          };
        };
        case _ {};
      };
    };

    // RSM-level escalated counts
    var rsmLevelLeavePending : Nat = 0;
    var rsmLevelTadaPending  : Nat = 0;
    if (managerRole == #RSM) {
      let asmIds = List.empty<AuthTypes.UserId>();
      for ((_, u) in users.entries()) {
        switch (u.reportsTo) {
          case (?mgr) {
            if (mgr == managerId and u.role == #ASM) asmIds.add(u.id)
          };
          case null {};
        };
      };
      let asmSubMrIds = List.empty<AuthTypes.UserId>();
      for (asmId in asmIds.values()) {
        for (id in collectSubordinateMrIds(asmId, users).values()) {
          asmSubMrIds.add(id);
        };
      };
      let asmMrArr = asmSubMrIds.toArray();
      for (l in leaves.values()) {
        if (l.status == #pending and asmMrArr.any(func(id : AuthTypes.UserId) : Bool { id == l.employeeId })) {
          rsmLevelLeavePending += 1;
        };
      };
      for (e in expenses.values()) {
        if (e.status == #pending and asmMrArr.any(func(id : AuthTypes.UserId) : Bool { id == e.employeeId })) {
          rsmLevelTadaPending += 1;
        };
      };
    };

    {
      leavePending;
      tadaPending;
      mtpPending           = 0;  // travelPlans not injected here
      dcrPending;
      rsmLevelLeavePending;
      rsmLevelTadaPending;
    }
  };

  // ── Field activity check (expense validation) ─────────────────────────────

  /// Returns true if any Doctor Call, Chemist Visit, Stockist Visit, or DCR
  /// exists for the given MR on expenseDate (ISO "YYYY-MM-DD").
  public func checkExpenseFieldActivity(
    mrId          : AuthTypes.UserId,
    expenseDate   : Text,
    reports       : List.List<FieldTypes.CallReport>,
    chemistCalls  : List.List<CCTypes.ChemistCallRecord>,
    stockistCalls : List.List<CCTypes.StockistCallRecord>,
    dcrs          : List.List<DcrTypes.DcrRecord>,
  ) : Bool {
    if (reports.any(func(r : FieldTypes.CallReport) : Bool {
      r.mrId == mrId and r.date == expenseDate
    })) return true;

    if (chemistCalls.any(func(c : CCTypes.ChemistCallRecord) : Bool {
      c.mrId == mrId and c.date == expenseDate
    })) return true;

    if (stockistCalls.any(func(s : CCTypes.StockistCallRecord) : Bool {
      s.mrId == mrId and s.date == expenseDate
    })) return true;

    dcrs.any(func(d : DcrTypes.DcrRecord) : Bool {
      d.mrId == mrId and d.date == expenseDate and
      (d.status == #Submitted or d.status == #Late or
       d.status == #Approved  or d.status == #Rejected)
    })
  };

  // ── Expense claim summary ─────────────────────────────────────────────────

  /// Build expense claim summary rows for MRs in the given ID list
  /// over the date range [fromDateIso, toDateIso].
  public func getExpenseClaimSummary(
    mrIds         : [AuthTypes.UserId],
    fromDate      : Text,
    toDate        : Text,
    users         : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
    expenseSheets : List.List<PEAWTypes.ExpenseSheet>,
    reports       : List.List<FieldTypes.CallReport>,
    chemistCalls  : List.List<CCTypes.ChemistCallRecord>,
    stockistCalls : List.List<CCTypes.StockistCallRecord>,
  ) : [DashTypes.ExpenseClaimSummaryRow] {
    let result = List.empty<DashTypes.ExpenseClaimSummaryRow>();

    // Extract YYYY-MM prefixes for comparison
    let fromPrefix = if (fromDate.size() >= 7) {
      let chars = fromDate.toArray();
      Text.fromArray(chars.sliceToArray(0, 7))
    } else { fromDate };
    let toPrefix   = if (toDate.size() >= 7) {
      let chars = toDate.toArray();
      Text.fromArray(chars.sliceToArray(0, 7))
    } else { toDate };

    for (mrId in mrIds.values()) {
      let mrName : Text = switch (users.get(mrId)) {
        case (?u) u.name;
        case null "Unknown";
      };
      let mrEmpId : Text = switch (users.get(mrId)) {
        case (?u) u.employeeId;
        case null "";
      };

      var totalClaimed : Float = 0.0;
      let typeMap = Map.empty<Text, Float>();

      for (sheet in expenseSheets.values()) {
        if (sheet.employeeId == mrEmpId) {
          let monthStr : Text = if (sheet.month < 10) {
            "0" # sheet.month.toText()
          } else {
            sheet.month.toText()
          };
          let sheetMonth = sheet.year.toText() # "-" # monthStr;
          if (sheetMonth >= fromPrefix and sheetMonth <= toPrefix) {
            for (item in sheet.lineItems.values()) {
              totalClaimed += item.amount;
              switch (typeMap.get(item.expenseType)) {
                case (?existing) typeMap.add(item.expenseType, existing + item.amount);
                case null        typeMap.add(item.expenseType, item.amount);
              };
            };
          };
        };
      };

      let byType = typeMap.toArray();

      let doctorCallsInPeriod = reports.filter(func(r : FieldTypes.CallReport) : Bool {
        r.mrId == mrId and r.date >= fromDate and r.date <= toDate
      }).size();

      let chemistVisitsInPeriod = chemistCalls.filter(func(c : CCTypes.ChemistCallRecord) : Bool {
        c.mrId == mrId and c.date >= fromDate and c.date <= toDate
      }).size();

      let stockistVisitsInPeriod = stockistCalls.filter(func(s : CCTypes.StockistCallRecord) : Bool {
        s.mrId == mrId and s.date >= fromDate and s.date <= toDate
      }).size();

      result.add({
        mrId;
        mrName;
        totalClaimed;
        byType;
        doctorCallsInPeriod;
        chemistVisitsInPeriod;
        stockistVisitsInPeriod;
      });
    };
    result.toArray()
  };

  // ── DCR reminder status ───────────────────────────────────────────────────

  /// Returns DcrReminderStatus for the given MR on the given date.
  public func getDcrReminderStatus(
    mrId        : AuthTypes.UserId,
    date        : Text,
    checkIns    : List.List<GpsTypes.AttendanceCheckIn>,
    dcrs        : List.List<DcrTypes.DcrRecord>,
    dcrSettings : DcrTypes.DcrSettings,
  ) : DashTypes.DcrReminderStatus {
    let checkedIn = checkIns.any(func(ci : GpsTypes.AttendanceCheckIn) : Bool {
      ci.userId == mrId and ci.date == date
    });

    let dcrSubmitted = dcrs.any(func(d : DcrTypes.DcrRecord) : Bool {
      d.mrId == mrId and d.date == date and
      (d.status == #Submitted or d.status == #Late or
       d.status == #Approved  or d.status == #Rejected)
    });

    {
      checkedIn;
      dcrSubmitted;
      deadlineHour = dcrSettings.dailyDeadlineHour;
    }
  };

  // ── MTP allowed stations ──────────────────────────────────────────────────

  /// Return stations allotted to the MR within their Area HQ for MTP planning.
  public func getMtpAllowedStations(
    mrUser   : AuthTypes.UserRecord,
    stations : Map.Map<LocTypes.LocationId, LocTypes.StationRecord>,
    _areas   : Map.Map<LocTypes.LocationId, LocTypes.AreaRecord>,
    hqs      : Map.Map<LocTypes.LocationId, LocTypes.HQRecord>,
  ) : [DashTypes.StationInfo] {
    let result = List.empty<DashTypes.StationInfo>();
    let addedIds = Set.empty<Nat>();

    // Collect HQ IDs from hqAssignments blocks
    let mrHqSet = Set.empty<LocTypes.LocationId>();
    for (block in mrUser.hqAssignments.values()) {
      mrHqSet.add(block.hqId);
    };
    switch (mrUser.primaryHqId) {
      case (?hqId) { mrHqSet.add(hqId) };
      case null    {};
    };

    let addStation = func(stationId : LocTypes.LocationId, station : LocTypes.StationRecord) {
      if (station.isActive and not addedIds.contains(stationId)) {
        addedIds.add(stationId);
        let hqOpt    = hqs.get(station.hqId);
        let areaName = switch (hqOpt) { case (?h) h.name; case null "" };
        let areaId   = switch (hqOpt) { case (?h) h.territoryId; case null 0 };
        result.add({
          stationId;
          stationName = station.stationName;
          areaId;
          areaName;
          regionId   = 0;
          regionName = "";
        });
      };
    };

    // Stations belonging to any of the MR's HQs
    for ((stationId, station) in stations.entries()) {
      if (mrHqSet.contains(station.hqId)) {
        addStation(stationId, station);
      };
    };

    // Explicitly allotted station IDs from hqAssignment blocks
    for (block in mrUser.hqAssignments.values()) {
      for (stId in block.stationIds.values()) {
        switch (stations.get(stId)) {
          case (?st) { addStation(stId, st) };
          case null  {};
        };
      };
    };

    result.toArray()
  };

  // ── System alerts ─────────────────────────────────────────────────────────

  /// Collect recent system alerts from absence logs and bulk upload history.
  public func getSystemAlerts(
    absenceLog        : List.List<AbsenceTypes.AbsenceInactivationLogEntry>,
    bulkUploadHistory : List.List<FieldTypes.BulkUploadRecord>,
  ) : [DashTypes.SystemAlert] {
    let result = List.empty<DashTypes.SystemAlert>();
    var alertId : Nat = 1;

    // Last 10 absence inactivation events (most recent first)
    var count = 0;
    for (entry in absenceLog.reverseValues()) {
      if (count < 10) {
        let datesText = entry.absentDates.values().join(", ");
        result.add({
          alertId;
          alertType = "AUTO_INACTIVATION";
          message   = entry.employeeName # " (" # entry.employeeCode # ") auto-inactivated. Absent: " # datesText;
          createdAt = entry.inactivatedAt;
          severity  = "critical";
        });
        alertId += 1;
        count   += 1;
      };
    };

    // Last 5 bulk upload operations with errors
    var bulkCount = 0;
    for (rec in bulkUploadHistory.reverseValues()) {
      if (bulkCount < 5 and rec.errors.size() > 0) {
        result.add({
          alertId;
          alertType = "BULK_UPLOAD_ERROR";
          message   = "Bulk " # rec.uploadType # " upload: " #
                      rec.errors.size().toText() # " error(s), " #
                      rec.savedRows.toText() # "/" # rec.totalRows.toText() # " saved.";
          createdAt = rec.uploadedAt;
          severity  = "warning";
        });
        alertId   += 1;
        bulkCount += 1;
      };
    };

    result.toArray()
  };

  // ── Dashboard aggregates helpers ──────────────────────────────────────────

  func countDcrOnDate(
    mrIds : [AuthTypes.UserId],
    date  : Text,
    dcrs  : List.List<DcrTypes.DcrRecord>,
  ) : (Nat, Nat) {
    var submitted : Nat = 0;
    for (mrId in mrIds.values()) {
      let found = dcrs.any(func(d : DcrTypes.DcrRecord) : Bool {
        d.mrId == mrId and d.date == date and
        (d.status == #Submitted or d.status == #Approved)
      });
      if (found) submitted += 1;
    };
    (submitted, mrIds.size())
  };

  func computeMtpAdherence(
    mrIds : [AuthTypes.UserId],
    dcrs  : List.List<DcrTypes.DcrRecord>,
  ) : Float {
    var approved : Nat = 0;
    var total    : Nat = 0;
    for (mrId in mrIds.values()) {
      for (d in dcrs.values()) {
        if (d.mrId == mrId) {
          switch (d.status) {
            case (#Submitted or #Late) { total += 1 };
            case (#Approved)           { total += 1; approved += 1 };
            case _                     {};
          };
        };
      };
    };
    if (total == 0) 1.0 else approved.toFloat() / total.toFloat()
  };

  func countMrsNotCheckedIn(
    mrIds    : [AuthTypes.UserId],
    date     : Text,
    checkIns : List.List<GpsTypes.AttendanceCheckIn>,
  ) : Nat {
    var count : Nat = 0;
    for (mrId in mrIds.values()) {
      let found = checkIns.any(func(ci : GpsTypes.AttendanceCheckIn) : Bool {
        ci.userId == mrId and ci.date == date
      });
      if (not found) count += 1;
    };
    count
  };

  func computeSampleBalance(
    mrId          : AuthTypes.UserId,
    sampleAllocs  : List.List<SFATypes.SampleAllocationRecord>,
    sampleUsages  : List.List<SFATypes.SampleUsageRecord>,
  ) : Nat {
    var allocated : Int = 0;
    var used      : Int = 0;
    for (a in sampleAllocs.values()) {
      if (a.mrId == mrId) allocated += a.allocatedQty;
    };
    for (u in sampleUsages.values()) {
      if (u.mrId == mrId) used += u.qtyUsed;
    };
    let remaining = allocated - used;
    if (remaining > 0) remaining.toNat() else 0
  };

  func computeDcrRate(
    mrId     : AuthTypes.UserId,
    fromDate : Text,
    toDate   : Text,
    dcrs     : List.List<DcrTypes.DcrRecord>,
    checkIns : List.List<GpsTypes.AttendanceCheckIn>,
  ) : Float {
    var checkedInDays    : Nat = 0;
    var dcrSubmittedDays : Nat = 0;
    for (ci in checkIns.values()) {
      if (ci.userId == mrId and ci.date >= fromDate and ci.date <= toDate) {
        checkedInDays += 1;
        let hasDcr = dcrs.any(func(d : DcrTypes.DcrRecord) : Bool {
          d.mrId == mrId and d.date == ci.date and
          (d.status == #Submitted or d.status == #Late or d.status == #Approved)
        });
        if (hasDcr) dcrSubmittedDays += 1;
      };
    };
    if (checkedInDays == 0) 1.0 else dcrSubmittedDays.toFloat() / checkedInDays.toFloat()
  };

  // ── Dashboard aggregates (role-dispatched) ────────────────────────────────

  /// Build role-appropriate KPI aggregates for the given user.
  public func getDashboardAggregates(
    session           : AuthTypes.Session,
    fromDateIso       : Text,
    toDateIso         : Text,
    users             : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
    reports           : List.List<FieldTypes.CallReport>,
    chemistCalls      : List.List<CCTypes.ChemistCallRecord>,
    stockistCalls     : List.List<CCTypes.StockistCallRecord>,
    dcrs              : List.List<DcrTypes.DcrRecord>,
    checkIns          : List.List<GpsTypes.AttendanceCheckIn>,
    leaves            : List.List<HRTypes.LeaveApplication>,
    expenses          : List.List<HRTypes.TaDaExpense>,
    sampleUsages      : List.List<SFATypes.SampleUsageRecord>,
    sampleAllocations : List.List<SFATypes.SampleAllocationRecord>,
    absenceLog        : List.List<AbsenceTypes.AbsenceInactivationLogEntry>,
  ) : DashTypes.DashboardAggregates {
    switch (session.role) {

      // ── MR ────────────────────────────────────────────────────────────────
      case (#MR) {
        let mrId = session.userId;

        let doctorCallsCount = reports.filter(func(r : FieldTypes.CallReport) : Bool {
          r.mrId == mrId and r.date >= fromDateIso and r.date <= toDateIso
        }).size();

        let chemistVisitsCount = chemistCalls.filter(func(c : CCTypes.ChemistCallRecord) : Bool {
          c.mrId == mrId and c.date >= fromDateIso and c.date <= toDateIso
        }).size();

        let stockistVisitsCount = stockistCalls.filter(func(s : CCTypes.StockistCallRecord) : Bool {
          s.mrId == mrId and s.date >= fromDateIso and s.date <= toDateIso
        }).size();

        let sampleBalanceCount = computeSampleBalance(mrId, sampleAllocations, sampleUsages);
        let dcrSubmissionRate  = computeDcrRate(mrId, fromDateIso, toDateIso, dcrs, checkIns);
        let mtpAdherenceRate   = computeMtpAdherence([mrId], dcrs);

        // New doctors: doctors visited in period but not before period
        let beforeSet = Set.empty<Nat>();
        let inSet     = Set.empty<Nat>();
        for (r in reports.values()) {
          if (r.mrId == mrId) {
            for (v in r.doctorsVisited.values()) {
              if (r.date < fromDateIso) {
                beforeSet.add(v.doctorId);
              } else if (r.date >= fromDateIso and r.date <= toDateIso) {
                inSet.add(v.doctorId);
              };
            };
          };
        };
        var newDoctorsAdded : Nat = 0;
        for (did in inSet.values()) {
          if (not beforeSet.contains(did)) newDoctorsAdded += 1;
        };

        #mr({
          doctorCallsCount;
          doctorCallsTarget    = 0;
          chemistVisitsCount;
          chemistVisitsTarget  = 0;
          stockistVisitsCount;
          stockistVisitsTarget = 0;
          sampleBalanceCount;
          dcrSubmissionRate;
          mtpAdherenceRate;
          newDoctorsAdded;
          newDoctorsTarget     = 0;
        })
      };

      // ── ASM ───────────────────────────────────────────────────────────────
      case (#ASM) {
        let asmId = session.userId;
        let directMrs = List.empty<AuthTypes.UserId>();
        for ((_, u) in users.entries()) {
          if (u.role == #MR) {
            switch (u.reportsTo) {
              case (?mgr) { if (mgr == asmId) directMrs.add(u.id) };
              case null   {};
            };
          };
        };
        let mrArr = directMrs.toArray();

        let teamDoctorCallsCount = reports.filter(func(r : FieldTypes.CallReport) : Bool {
          mrArr.any(func(id : AuthTypes.UserId) : Bool { id == r.mrId }) and
          r.date >= fromDateIso and r.date <= toDateIso
        }).size();

        let teamChemistVisits = chemistCalls.filter(func(c : CCTypes.ChemistCallRecord) : Bool {
          mrArr.any(func(id : AuthTypes.UserId) : Bool { id == c.mrId }) and
          c.date >= fromDateIso and c.date <= toDateIso
        }).size();

        let todayDate = toDateIso;
        let mrsNotCheckedInToday = countMrsNotCheckedIn(mrArr, todayDate, checkIns);
        let (dcrOnTime, dcrExpected) = countDcrOnDate(mrArr, todayDate, dcrs);

        var pendingLeaveCount : Nat = 0;
        var pendingTadaCount  : Nat = 0;
        for (l in leaves.values()) {
          if (l.status == #pending and mrArr.any(func(id : AuthTypes.UserId) : Bool { id == l.employeeId })) {
            pendingLeaveCount += 1;
          };
        };
        for (e in expenses.values()) {
          if (e.status == #pending and mrArr.any(func(id : AuthTypes.UserId) : Bool { id == e.employeeId })) {
            pendingTadaCount += 1;
          };
        };

        #asm({
          teamDoctorCallsCount;
          teamDoctorCallsTarget  = 0;
          teamChemistVisits;
          teamDcrOnTimeCount     = dcrOnTime;
          teamDcrExpected        = dcrExpected;
          mrsNotCheckedInToday;
          mrsPendingMtpApproval  = 0;
          pendingLeaveCount;
          pendingTadaCount;
          totalMrs               = mrArr.size();
        })
      };

      // ── RSM ───────────────────────────────────────────────────────────────
      case (#RSM) {
        let rsmId = session.userId;
        let regionMrIds = collectSubordinateMrIds(rsmId, users);
        let directMrCount = List.empty<AuthTypes.UserId>();
        for ((_, u) in users.entries()) {
          if (u.role == #MR) {
            switch (u.reportsTo) {
              case (?mgr) { if (mgr == rsmId) directMrCount.add(u.id) };
              case null   {};
            };
          };
        };

        let regionDoctorCallsCount = reports.filter(func(r : FieldTypes.CallReport) : Bool {
          regionMrIds.any(func(id : AuthTypes.UserId) : Bool { id == r.mrId }) and
          r.date >= fromDateIso and r.date <= toDateIso
        }).size();

        let regionChemistVisits = chemistCalls.filter(func(c : CCTypes.ChemistCallRecord) : Bool {
          regionMrIds.any(func(id : AuthTypes.UserId) : Bool { id == c.mrId }) and
          c.date >= fromDateIso and c.date <= toDateIso
        }).size();

        let todayDate     = toDateIso;
        let mrsNotIn      = countMrsNotCheckedIn(regionMrIds, todayDate, checkIns);
        let (on, exp)     = countDcrOnDate(regionMrIds, todayDate, dcrs);
        let regionDcrRate : Float = if (exp == 0) 1.0 else on.toFloat() / exp.toFloat();
        let mtpRate       = computeMtpAdherence(regionMrIds, dcrs);

        var pendingApprovals : Nat = 0;
        for (l in leaves.values()) {
          if (l.status == #pending and regionMrIds.any(func(id : AuthTypes.UserId) : Bool { id == l.employeeId })) {
            pendingApprovals += 1;
          };
        };
        for (e in expenses.values()) {
          if (e.status == #pending and regionMrIds.any(func(id : AuthTypes.UserId) : Bool { id == e.employeeId })) {
            pendingApprovals += 1;
          };
        };

        #rsm({
          regionDoctorCallsCount;
          regionDoctorCallsTarget = 0;
          regionChemistVisits;
          regionDcrRate;
          mrsNotCheckedInToday    = mrsNotIn;
          pendingApprovals;
          mtpAdherenceRate        = mtpRate;
          directMrCount           = directMrCount.size();
          totalMrsInRegion        = regionMrIds.size();
        })
      };

      // ── ZSM ───────────────────────────────────────────────────────────────
      case (#ZSM) {
        let zsmId   = session.userId;
        let zoneMrIds = collectSubordinateMrIds(zsmId, users);

        let zoneDoctorCallsCount = reports.filter(func(r : FieldTypes.CallReport) : Bool {
          zoneMrIds.any(func(id : AuthTypes.UserId) : Bool { id == r.mrId }) and
          r.date >= fromDateIso and r.date <= toDateIso
        }).size();

        let zoneChemistVisits = chemistCalls.filter(func(c : CCTypes.ChemistCallRecord) : Bool {
          zoneMrIds.any(func(id : AuthTypes.UserId) : Bool { id == c.mrId }) and
          c.date >= fromDateIso and c.date <= toDateIso
        }).size();

        let todayDate   = toDateIso;
        let mrsNotIn    = countMrsNotCheckedIn(zoneMrIds, todayDate, checkIns);
        let (on, exp)   = countDcrOnDate(zoneMrIds, todayDate, dcrs);
        let zoneDcrRate : Float = if (exp == 0) 1.0 else on.toFloat() / exp.toFloat();
        let mtpRate     = computeMtpAdherence(zoneMrIds, dcrs);

        var pendingApprovals : Nat = 0;
        for (l in leaves.values()) {
          if (l.status == #pending and zoneMrIds.any(func(id : AuthTypes.UserId) : Bool { id == l.employeeId })) {
            pendingApprovals += 1;
          };
        };
        for (e in expenses.values()) {
          if (e.status == #pending and zoneMrIds.any(func(id : AuthTypes.UserId) : Bool { id == e.employeeId })) {
            pendingApprovals += 1;
          };
        };

        #zsm({
          zoneDoctorCallsCount;
          zoneDoctorCallsTarget = 0;
          zoneChemistVisits;
          zoneDcrRate;
          mrsNotCheckedInToday  = mrsNotIn;
          pendingApprovals;
          mtpAdherenceRate      = mtpRate;
          totalMrsInZone        = zoneMrIds.size();
        })
      };

      // ── HR ────────────────────────────────────────────────────────────────
      case (#HRManager) {
        var totalActive : Nat = 0;
        var totalAll    : Nat = 0;
        for ((_, u) in users.entries()) {
          totalAll += 1;
          if (u.status == #Active) totalActive += 1;
        };

        let todayDate = toDateIso;

        var onLeaveToday : Nat = 0;
        for (l in leaves.values()) {
          if (l.status == #approved and l.fromDate <= todayDate and l.toDate >= todayDate) {
            onLeaveToday += 1;
          };
        };

        var pendingLeaves : Nat = 0;
        for (l in leaves.values()) {
          if (l.status == #pending) pendingLeaves += 1;
        };

        var pendingTada : Nat = 0;
        for (e in expenses.values()) {
          if (e.status == #pending) pendingTada += 1;
        };

        var lateCheckIns : Nat = 0;
        for (ci in checkIns.values()) {
          if (ci.date == todayDate) {
            // After 10:00 AM = 36000 seconds from midnight
            let secOfDay : Int = (ci.recordedAt / 1_000_000_000) % 86400;
            if (secOfDay > 36000) lateCheckIns += 1;
          };
        };

        var autoInactivated : Nat = 0;
        for (entry in absenceLog.values()) {
          if (not entry.isReactivated) autoInactivated += 1;
        };

        #hr({
          totalActiveEmployees     = totalActive;
          totalEmployees           = totalAll;
          employeesOnLeaveToday    = onLeaveToday;
          pendingLeaveApplications = pendingLeaves;
          pendingTadaClaims        = pendingTada;
          lateCheckInsToday        = lateCheckIns;
          autoInactivatedPending   = autoInactivated;
          upcomingBirthdaysCount   = 0;
        })
      };

      // ── Admin ─────────────────────────────────────────────────────────────
      case (#Admin) {
        let todayDate = toDateIso;

        var totalActive : Nat = 0;
        let roleCountMap = Map.empty<Text, Nat>();
        for ((_, u) in users.entries()) {
          if (u.status == #Active) {
            totalActive += 1;
            let roleText : Text = switch (u.role) {
              case (#Admin)     "Admin";
              case (#HRManager) "HR";
              case (#ZSM)       "ZSM";
              case (#RSM)       "RSM";
              case (#ASM)       "ASM";
              case (#MR)        "MR";
            };
            switch (roleCountMap.get(roleText)) {
              case (?n) roleCountMap.add(roleText, n + 1);
              case null roleCountMap.add(roleText, 1);
            };
          };
        };
        let usersByRole = roleCountMap.toArray();

        let doctorCallsToday = reports.filter(func(r : FieldTypes.CallReport) : Bool {
          r.date == todayDate
        }).size();

        let doctorCallsThisMonth = reports.filter(func(r : FieldTypes.CallReport) : Bool {
          r.date >= fromDateIso and r.date <= toDateIso
        }).size();

        let chemistVisitsToday = chemistCalls.filter(func(c : CCTypes.ChemistCallRecord) : Bool {
          c.date == todayDate
        }).size();

        let chemistVisitsThisMonth = chemistCalls.filter(func(c : CCTypes.ChemistCallRecord) : Bool {
          c.date >= fromDateIso and c.date <= toDateIso
        }).size();

        // Attendance rate: checked-in active MRs / total active MRs
        var activeMrCount : Nat = 0;
        for ((_, u) in users.entries()) {
          if (u.role == #MR and u.status == #Active) activeMrCount += 1;
        };
        let checkedInToday = checkIns.filter(func(ci : GpsTypes.AttendanceCheckIn) : Bool {
          ci.date == todayDate
        }).size();
        let attendanceRateToday : Float = if (activeMrCount == 0) 1.0 else
          checkedInToday.toFloat() / activeMrCount.toFloat();

        var totalPendingApprovals : Nat = 0;
        for (l in leaves.values()) {
          if (l.status == #pending) totalPendingApprovals += 1;
        };
        for (e in expenses.values()) {
          if (e.status == #pending) totalPendingApprovals += 1;
        };

        var autoInactivated : Nat = 0;
        for (entry in absenceLog.values()) {
          if (not entry.isReactivated) autoInactivated += 1;
        };

        #admin({
          totalActiveUsers       = totalActive;
          usersByRole;
          doctorCallsToday;
          doctorCallsThisMonth;
          chemistVisitsToday;
          chemistVisitsThisMonth;
          attendanceRateToday;
          totalPendingApprovals;
          autoInactivatedPending = autoInactivated;
          systemAlertCount       = 0;
        })
      };
    }
  };
};
