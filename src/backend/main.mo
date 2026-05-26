

import AuthTypes  "types/auth-users";
import FieldTypes "types/field-ops";
import GAMTypes    "types/gift-article-master";
import HRTypes    "types/hr-core";
import LocTypes   "types/location-master";
import GpsTypes   "types/gps-trail";
import TPTypes    "types/travel-plan";
import CrmTypes     "types/crm";
import BookingTypes  "types/booking";
import AMTypes      "types/admin-messages";
import OLTypes       "types/official-letters";
import BUTTypes     "types/bottom-up-targets";
import HistTypes    "types/target-history";
import IncentiveTypes "types/incentives";
import MTargetTypes  "types/monthly-targets";
import ACTypes       "types/additional-charge";
import StockistTypes "types/stockist";
import SSTypes       "types/secondary-sale";
import CDSTypes      "types/crm-doctor-sale";
import HolidayTypes  "types/company-holiday";
import AuthUsersMixin "mixins/auth-users-api";
import FieldOpsMixin  "mixins/field-ops-api";
import GiftArticleMasterMixin "mixins/gift-article-master-api";
import HRCoreMixin    "mixins/hr-core-api";
import LocMixin       "mixins/location-master-api";
import LocationHqMixin "mixins/location-hq-api";
import GpsTrailMixin  "mixins/gps-trail-api";
import TravelPlanMixin "mixins/travel-plan-api";
import CrmMixin        "mixins/crm-api";
import BookingMixin     "mixins/booking-api";
import AdminMessagesMixin "mixins/admin-messages-api";
import CompanyProfileMixin "mixins/company-profile-api";
import OfficialLettersMixin "mixins/official-letters-api";
import BottomUpTargetsMixin "mixins/bottom-up-targets-api";
import TargetHistoryMixin   "mixins/target-history-api";
import IncentivesMixin      "mixins/incentives-api";
import EmployeeIdMixin      "mixins/employee-id-api";
import DataCleanupMixin     "mixins/data-cleanup-api";
import PricelistMixin       "mixins/pricelist-api";
import MonthlyTargetsMixin  "mixins/monthly-targets-api";
import AdditionalChargeMixin "mixins/additional-charge-api";
import StockistMixin         "mixins/stockist-api";
import SecondarySaleMixin    "mixins/secondary-sale-api";
import CrmDoctorSaleMixin    "mixins/crm-doctor-sale-api";
import CompanyHolidayMixin   "mixins/company-holiday-api";
import PayrollExpensesAdvancesMixin "mixins/payroll-expenses-advances-workingstyle-api";
import PEAWTypes "types/payroll-expenses-advances-workingstyle";
import HealthCheckMixin  "mixins/health-check-api";
import HealthRepairMixin "mixins/health-repair-api";
import CommonTypes "types/common";
import SugTypes    "types/suggestions";
import SuggestionsMixin "mixins/suggestions-api";
import BirthdayMixin "mixins/birthday-api";
import NotifTypes  "types/notifications";
import NotifMixin  "mixins/notifications-api";
import AbsenceTypes "types/absence-inactivation";
import AbsenceInactivationMixin "mixins/absence-inactivation-api";
import AdminSettingsMixin "mixins/admin-settings-api";
import DcrTypes  "types/dcr";
import DcrMixin  "mixins/dcr-api";
import ReportingChainEmailsMixin "mixins/reporting-chain-emails-api";
import JfwTypes  "types/jfw";
import JfwMixin  "mixins/jfw-api";
import SFATypes  "types/sfa-sample";
import SfaSampleMixin "mixins/sfa-sample-api";
import CCTypes   "types/chemist-call";
import ChemistCallMixin "mixins/chemist-call-api";
import DashboardMixin  "mixins/dashboard-api";
import EDTypes "types/employee-delete";
import EmployeeDeleteMixin "mixins/employee-delete-api";



import DataCleanupLib "lib/data-cleanup";
import PLLib    "lib/pricelist";
import CPLib    "lib/company-profile";
import AuthLib   "lib/auth-users";
import EmpIdLib  "lib/employee-id";
import HealthLib "lib/health-check";





import Map   "mo:core/Map";
import List  "mo:core/List";
import Time  "mo:core/Time";
import Timer "mo:core/Timer";




























actor {
  // ── Stable migration types (M0170 fix) ─────────────────────────────────────
  // These OLD types match the shapes stored in the previously-deployed canister.
  // They are only used in preupgrade / postupgrade to satisfy the M0170 checker.

  // OLD AttendanceStatus (before #onLeaveEL / #onLeaveFL were added)
  type AttendanceStatusOld = {
    #present; #absent; #halfDay; #onLeave;
    #onLeaveCL; #onLeaveSL; #onLeaveUPL; #onLeavePL; #onLeaveML;
    #onLeaveLWP; #onLeaveCO; #weeklyOff; #companyHoliday;
  };
  // OLD AttendanceRecord (status field uses the old variant set)
  type AttendanceRecordOld = {
    id                 : Nat;
    employeeId         : Nat;
    date               : Text;
    status             : AttendanceStatusOld;
    checkInTime        : ?Text;
    checkInGps         : ?CommonTypes.GpsCoord;
    leaveApplicationId : ?Nat;
    holidayId          : ?Nat;
    correctedBy        : ?Text;
    correctionRemark   : ?Text;
    correctionAt       : ?Int;
    recordedAt         : Int;
  };
  // OLD LeaveType (before #earnedLeave / #fieldLeave were added)
  type LeaveTypeOld = { #casual; #sick; #unpaid; #pl; #ml; #lwp; #co };
  // OLD LeaveApplication (leaveType uses old variant set)
  type LeaveApplicationOld = {
    id             : Nat;  employeeId     : Nat;  leaveType      : LeaveTypeOld;
    fromDate       : Text; toDate         : Text; numDays        : Nat;
    reason         : Text; notes          : ?Text; attachmentUrl : ?Text;
    status         : HRTypes.LeaveStatus;
    approvedBy     : ?Nat; approverId     : ?Nat; approverRemark : ?Text;
    appliedAt      : Int;  updatedAt      : Int;
    gpsLocation    : ?CommonTypes.GpsCoord;
  };
  // OLD LeaveQuota (shape stored before elUsed/flUsed were added)
  type LeaveQuotaOld = {
    employeeId  : Nat; year       : Nat;
    casualTotal : Nat; sickTotal  : Nat; unpaidTotal : Nat;
    plTotal     : Nat; mlTotal    : Nat; lwpTotal    : Nat; coTotal : Nat;
    casualUsed  : Nat; sickUsed   : Nat; unpaidUsed  : Nat;
    plUsed      : Nat; mlUsed     : Nat; lwpUsed     : Nat; coUsed  : Nat;
  };
  // OLD RoleLeaveQuota (shape stored in the previously-deployed canister)
  type RoleLeaveQuotaOld = {
    role        : CommonTypes.Role; year        : Nat;
    casualTotal : Nat; sickTotal   : Nat; unpaidTotal : Nat;
    plTotal     : Nat; mlTotal     : Nat; lwpTotal    : Nat; coTotal : Nat;
  };

  // ── Employee ID state ────────────────────────────────────────────────────────────
  let empIdCounters : Map.Map<Text, EmpIdLib.EmpIdCounter> = Map.empty();
  let empIdConfigs  : Map.Map<Text, EmpIdLib.EmpIdConfig>  = Map.empty();
  // New company-wide UID config (KP-YYYY-NNN format)
  let uidConfig     : EmpIdLib.UidConfig                   = EmpIdLib.emptyUidConfig();

  // ── Auth state ──────────────────────────────────────────────────────────────
  let users         : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>     = Map.empty();
  let usernameIndex : Map.Map<Text, AuthTypes.UserId>                     = Map.empty();
  let sessions      : Map.Map<Text, AuthTypes.Session>                    = Map.empty();
  let locations     : Map.Map<AuthTypes.UserId, AuthTypes.LocationRecord> = Map.empty();
  let nextUserId    = { var value : Nat = 1 };

  // ── Field-ops state ──────────────────────────────────────────────────────────
  let products    : List.List<FieldTypes.Product>      = List.empty();
  let doctors     : List.List<FieldTypes.Doctor>       = List.empty();
  let chemists    : List.List<FieldTypes.Chemist>      = List.empty();
  let orders      : List.List<FieldTypes.ChemistOrder> = List.empty();
  let reports     : List.List<FieldTypes.CallReport>   = List.empty();
  let assignments : Map.Map<(FieldTypes.UserId, FieldTypes.DoctorId), FieldTypes.DoctorProductAssignment> = Map.empty();
  // DA rate configs keyed by role name ("MR", "ASM", "RSM", "ZSM", etc.)
  let daConfigs   : Map.Map<Text, FieldTypes.DaConfig> = Map.empty();
  let nextProductId = { var val : Nat = 1 };
  let nextDoctorId  = { var val : Nat = 1 };
  let nextChemistId = { var val : Nat = 1 };
  let nextOrderId   = { var val : Nat = 1 };
  let nextReportId  = { var val : Nat = 1 };

  // ── HR Core state ────────────────────────────────────────────────────────────
  let leaves           : List.List<HRTypes.LeaveApplication>  = List.empty();
  let leaveQuotas      : List.List<HRTypes.LeaveQuota>         = List.empty();
  let roleLeaveQuotas  : List.List<HRTypes.RoleLeaveQuota>     = List.empty();
  let attendance  : List.List<HRTypes.AttendanceRecord>   = List.empty();
  let payroll     : List.List<HRTypes.PayrollRecord>      = List.empty();
  let expenses    : List.List<HRTypes.TaDaExpense>        = List.empty();
  let performance : List.List<HRTypes.PerformanceRecord>  = List.empty();
  let documents   : List.List<HRTypes.EmployeeDocument>   = List.empty();

  let nextLeaveId  = { var value : Nat = 1 };
  let nextAttendId = { var value : Nat = 1 };
  let nextPayId    = { var value : Nat = 1 };
  let nextExpId    = { var value : Nat = 1 };
  let nextPerfId   = { var value : Nat = 1 };
  let nextDocId    = { var value : Nat = 1 };

  // ── Location Master state ──────────────────────────────────────────────────────
  let zones       : Map.Map<LocTypes.LocationId, LocTypes.ZoneRecord>      = Map.empty();
  let locStates   : Map.Map<LocTypes.LocationId, LocTypes.StateRecord>     = Map.empty();
  let territories : Map.Map<LocTypes.LocationId, LocTypes.TerritoryRecord> = Map.empty();
  let hqs         : Map.Map<LocTypes.LocationId, LocTypes.HQRecord>        = Map.empty();
  let areas       : Map.Map<LocTypes.LocationId, LocTypes.AreaRecord>      = Map.empty();
  let stations    : Map.Map<LocTypes.LocationId, LocTypes.StationRecord>   = Map.empty();
  let nextZoneId  = { var val : Nat = 1 };
  let nextStateId = { var val : Nat = 1 };
  let nextTerrId  = { var val : Nat = 1 };
  let nextHQId    = { var val : Nat = 1 };
  let nextAreaId  = { var val : Nat = 1 };
  let nextStationId = { var val : Nat = 1 };

  // ── GPS Trail state ───────────────────────────────────────────────────────────
  let trails   : Map.Map<(GpsTypes.UserId, Text), GpsTypes.GpsTrailRecord> = Map.empty();
  let checkIns : List.List<GpsTypes.AttendanceCheckIn>                     = List.empty();
  let gpsActivityLog    : List.List<GpsTypes.GpsActivityEntry>             = List.empty();
  let nextGpsActivityId = { var value : Nat = 1 };

  // GPS enforcement toggle — true = strict enforcement (default on)
  let gpsEnforcementEnabled = { var value : Bool = true };

  // GPS overrides — per-employee exception grants (Map<UserId, List<GpsOverrideEntry>>)
  let gpsOverrides      : Map.Map<GpsTypes.UserId, List.List<GpsTypes.GpsOverrideEntry>> = Map.empty();
  let nextGpsOverrideId = { var value : Nat = 1 };

  // ── Travel Plan state ──────────────────────────────────────────────────────────
  let travelPlans      : List.List<TPTypes.TravelPlanRecord>    = List.empty();
  let roleHierarchyConf = { var value : TPTypes.RoleHierarchyConfig = {
    roleOrder = [#MR, #ASM, #RSM, #ZSM, #HRManager, #Admin]
  } };
  let nextTravelPlanId  = { var val : Nat = 1 };

  // ── CRM state ──────────────────────────────────────────────────────────────────
  let crmRequests     : List.List<CrmTypes.CrmRequest>      = List.empty();
  let salesTargets    : List.List<CrmTypes.SalesTarget>     = List.empty();
  let crmBusinessReports : List.List<CrmTypes.BusinessReport> = List.empty();
  let nextCrmId        = { var val : Nat = 1 };
  let nextTargetId     = { var val : Nat = 1 };
  let nextCrmReportId  = { var val : Nat = 1 };

  // ── Booking state ─────────────────────────────────────────────────────────────
  let bookingRequests : List.List<BookingTypes.BookingRequest> = List.empty();
  let nextBookingId   = { var val : Nat = 1 };

  // ── Admin Messages state ───────────────────────────────────────────────────────
  let adminMessages : List.List<AMTypes.AdminMessage> = List.empty();
  let nextMsgId     = { var value : Nat = 1 };

  // ── Company Profile state ──────────────────────────────────────────────────────
  let companyProfile : CPLib.State = CPLib.empty();

  // ── Official Letters state ──────────────────────────────────────────────────────
  let letters           : List.List<OLTypes.OfficialLetter>          = List.empty();
  let letterRefNumbers  : Map.Map<Nat, Text>                         = Map.empty();
  let letterEmailLogs   : Map.Map<Nat, [OLTypes.EmailInitiationLog]> = Map.empty();
  let nextLetterId     = { var value : Nat = 1 };
  let nextLetterRefSeq = { var value : Nat = 1 };

  // ── Bottom-Up Targets state ────────────────────────────────────────────────────
  let bottomUpTargets      : List.List<BUTTypes.BottomUpTarget> = List.empty();
  let nextBottomUpTargetId = { var val : Nat = 1 };

  // ── Target Adjustment History state ─────────────────────────────────────────
  let targetAdjLogs : List.List<HistTypes.TargetAdjustmentLog> = List.empty();
  let nextAdjLogId  = { var value : Nat = 1 };

  // ── Incentive Program state ───────────────────────────────────────────────────
  let incentivePlans : List.List<IncentiveTypes.IncentivePlan>         = List.empty();
  let incentiveCalcs : List.List<IncentiveTypes.IncentiveCalculation>  = List.empty();
  let nextPlanId     = { var value : Nat = 1 };
  let nextCalcId     = { var value : Nat = 1 };

  // ── Data Cleanup audit log ───────────────────────────────────────────────────────
  let dataCleanupLogs  : List.List<DataCleanupLib.DataCleanupLog> = List.empty();
  let nextCleanupLogId = { var value : Nat = 1 };

  // ── Pricelist state ─────────────────────────────────────────────────────────────
  let pricelistProducts : List.List<PLLib.PricelistProduct> = List.empty();
  let nextPricelistId   : PLLib.NextId   = { var val : Nat = 1 };
  let nextPricelistSrNo : PLLib.NextSrNo = { var val : Nat = 1 };

  // ── Monthly Sales Target state ────────────────────────────────────────────────
  let monthlyTargets : List.List<MTargetTypes.MonthlyTarget> = List.empty();

  // ── Additional Charge state ─────────────────────────────────────────────────────
  let additionalCharges : List.List<ACTypes.AdditionalCharge> = List.empty();
  let nextChargeId      = { var value : Nat = 1 };
  // Monotonically increasing counter used by additional-charge notification builders.
  let rsmMrNotifIdRef = { var value : Nat = 1 };


  // ── Stockist Master state ──────────────────────────────────────────────────────
  let stockists      : Map.Map<StockistTypes.StockistId, StockistTypes.StockistRecord> = Map.empty();
  let nextStockistId = { var value : Nat = 1 };

  // ── Secondary Sale state ───────────────────────────────────────────────────────
  let secondarySales : List.List<SSTypes.SecondarySaleRecord> = List.empty();
  let nextSaleId     = { var value : Nat = 1 };

  // ── CRM Doctor-wise Sale state ────────────────────────────────────────────────
  let crmDoctorSales : List.List<CDSTypes.CrmDoctorSaleRecord> = List.empty();
  let nextCrmSaleId  = { var value : Nat = 1 };

  // ── Missed visit alert dismissals + bulk upload history ─────────────────────────
  let dismissedAlerts   : List.List<FieldTypes.DismissedAlert>    = List.empty();
  let bulkUploadHistory : List.List<FieldTypes.BulkUploadRecord>  = List.empty();
  let nextBulkHistoryId = { var value : Nat = 1 };

  // ── Doctor audit log (edit/delete only — allotment table removed) ───────────────
  let allotmentAuditLogs : List.List<FieldTypes.AllotmentAuditLog> = List.empty();
  let nextAllotmentLogId = { var val : Nat = 1 };

  // ── Gift Article Master state ────────────────────────────────────────────────────
  let giftArticles      : List.List<GAMTypes.GiftArticle> = List.empty();
  let nextGiftArticleId = { var val : Nat = 1 };

  // ── Station Bulk Import history ─────────────────────────────────────────────────
  let stationBulkHistory : List.List<LocTypes.BulkStationImportResult> = List.empty();

  // ── Company Holiday state ─────────────────────────────────────────────────────
  let companyHolidays : List.List<HolidayTypes.CompanyHoliday> = List.empty();
  let nextHolidayId   = { var value : Nat = 1 };

  // ── Payroll Expenses, Advances & Working Style state ───────────────────────────
  let advances             : List.List<PEAWTypes.EmployeeAdvance>     = List.empty();
  let expenseSheets        : List.List<PEAWTypes.ExpenseSheet>         = List.empty();
  let incentiveBonusSheets : List.List<PEAWTypes.IncentiveBonusSheet>  = List.empty();
  let workingStyleRecords  : List.List<PEAWTypes.WorkingStyleRecord>   = List.empty();
  let nextAdvanceId        = { var value : Nat = 1 };
  let nextExpenseSheetId   = { var value : Nat = 1 };
  let nextIncentiveBonusId = { var value : Nat = 1 };
  let nextWorkingStyleId   = { var value : Nat = 1 };

  // ── Health-Check log state ──────────────────────────────────────────────────────
  let healthCheckLogs : List.List<CommonTypes.HealthCheckReport> = List.empty();

  // ── Auto-Repair log state ─────────────────────────────────────────────────────
  let repairLogs : List.List<CommonTypes.RepairLog> = List.empty();

  // ── Suggestions & Queries state ────────────────────────────────────────────────
  let suggestions      : List.List<SugTypes.SuggestionSubmission> = List.empty();
  let nextSuggestionId = { var value : Nat = 1 };

  // ── Notification state ─────────────────────────────────────────────────────────
  let notifications       : Map.Map<Text, NotifTypes.NotificationRecord> = Map.empty();
  let notificationSettings = { var value : NotifTypes.NotificationSettings = {
    doctorCallNotificationsEnabled = true;
    cascadeLevel                   = "asm_only";
    batchingEnabled                = true;
    batchWindowSeconds             = 300;
    batchMinCount                  = 3;
    quietHoursEnabled              = false;
    quietHoursStart                = "22:00";
    quietHoursEnd                  = "07:00";
  }};
  let pendingBatches      : Map.Map<Text, NotifTypes.PendingBatch> = Map.empty();

  // ── Absence inactivation settings ──────────────────────────────────────────────
  let absenceSettings : AbsenceTypes.AbsenceSettings = {
    var consecutiveAbsenceThreshold = 3;
    var absenceCheckEnabled         = true;
    var excludeLongTermLeave        = true;
    var warningNotificationsEnabled = true;
  };

  // ── Absence inactivation log state ─────────────────────────────────────────────
  let absenceInactivationLog : List.List<AbsenceTypes.AbsenceInactivationLogEntry> = List.empty();
  let nextAbsenceLogId       = { var value : Nat = 1 };

  // ── User Reactivation log ───────────────────────────────────────────────────
  let reactivationLog : List.List<AuthTypes.ReactivationLogEntry> = List.empty();
  let deletionLog : List.List<EDTypes.EmployeeDeletionAuditEntry> = List.empty();

  // ── DCR (Daily Call Report) state ───────────────────────────────────────────────
  let dcrs         : List.List<DcrTypes.DcrRecord> = List.empty();
  let nextDcrId                                    = { var value : Nat = 1 };
  let dcrSettings  : DcrTypes.DcrSettings          = {
    var dailyDeadlineHour   = 21;
    var dailyDeadlineMinute = 0;
    var isEnabled           = true;
  };
// ── JFW (Joint Field Work) state ───────────────────────────────────────────────
  let jfws      : List.List<JfwTypes.JfwRecord> = List.empty();
  let nextJfwId                                 = { var value : Nat = 1 };

  // ── SFA Sample Allocation & Usage state ─────────────────────────────────────────
  let sampleAllocations  : List.List<SFATypes.SampleAllocationRecord> = List.empty();
  let sampleUsages       : List.List<SFATypes.SampleUsageRecord>      = List.empty();
  let nextSampleAllocId                                                = { var val : Nat = 1 };
  let nextSampleUsageId                                                = { var val : Nat = 1 };

  // ── EL Accrual state ──────────────────────────────────────────────────────────
  let elAccruals : List.List<HRTypes.EarnedLeaveAccrual> = List.empty();

  // ── Chemist Call & Stockist Call state ─────────────────────────────────────────
  let chemistCalls       : List.List<CCTypes.ChemistCallRecord>   = List.empty();
  let stockistCalls      : List.List<CCTypes.StockistCallRecord>  = List.empty();
  let nextChemistCallId                                           = { var val : Nat = 1 };
  let nextStockistCallId                                          = { var val : Nat = 1 };

  // ── External Date-of-Birth maps ───────────────────────────────────────────────────
  let userDobMap   : Map.Map<Text, Text> = Map.empty();
  let doctorDobMap : Map.Map<Text, Text> = Map.empty();

  // ── SFA reminder settings (DCR / MTP deadline reminders) ────────────────────────
  let sfaReminderSettings = { var value : NotifTypes.SfaReminderSettings = {
    dcrReminderHour               = 21;
    dcrReminderEnabled            = true;
    mtpDeadlineDay                = 25;
    mtpReminderDaysBeforeDeadline = 3;
    mtpReminderEnabled            = true;
  }};

  // ── TA/DA Grade configuration ───────────────────────────────────────────────────
  let taDaGradeConfig : Map.Map<Text, FieldTypes.TaDaGrade> = Map.empty();

  // ── Migrate MR flat hq/area fields to per-HQ blocks ──────────────────────────────
  do {
    for ((_uid, u) in users.entries()) {
      if (not u.migrationDone and u.role == #MR) {
        let blockMap = Map.empty<Nat, [Nat]>();
        for (aId in u.areaIds.values()) {
          let hId : Nat = if (u.hqIds.size() > 0) u.hqIds[0] else 0;
          switch (blockMap.get(hId)) {
            case (?existing) {
              let arr = existing.concat([aId]);
              blockMap.add(hId, arr);
            };
            case null { blockMap.add(hId, [aId]) };
          };
        };
        let blocks = List.empty<AuthTypes.HqAssignment>();
        for (hId in u.hqIds.values()) {
          let aIds = switch (blockMap.get(hId)) { case (?a) a; case null [] };
          blocks.add({ hqId = hId; areaIds = aIds; stationIds = []; exStationIds = [] });
        };
        u.hqAssignments := blocks.toArray();
        u.migrationDone := true;
      };
    };
  };

  // ── Admin account initialization ─────────────────────────────────────────────────
  do {
    let adminId = nextUserId.value;
    AuthLib.initAdminAccount(users, usernameIndex, adminId, Time.now());
    switch (usernameIndex.get("admin")) {
      case (?uid) { if (uid == adminId) { nextUserId.value += 1 } };
      case null {};
    };
  };

  // ── Default DA rate configuration ────────────────────────────────────────────────
  do {
    let defaultConfigs : [FieldTypes.DaConfig] = [
      { role = "MR";  hqRate = 25000; exStationRate = 30000;  outStationRate = 50000  },
      { role = "ASM"; hqRate = 25000; exStationRate = 30000;  outStationRate = 50000  },
      { role = "RSM"; hqRate = 25000; exStationRate = 110000; outStationRate = 110000 },
      { role = "ZSM"; hqRate = 25000; exStationRate = 110000; outStationRate = 110000 },
    ];
    if (daConfigs.isEmpty()) {
      for (cfg in defaultConfigs.values()) {
        daConfigs.add(cfg.role, cfg);
      };
    } else {
      for (cfg in defaultConfigs.values()) {
        switch (daConfigs.get(cfg.role)) {
          case (?existing) {
            if ((cfg.role == "RSM" or cfg.role == "ZSM") and existing.exStationRate == 30000) {
              daConfigs.add(cfg.role, cfg);
            };
          };
          case null {
            daConfigs.add(cfg.role, cfg);
          };
        };
      };
    };
  };

  // ── Default role leave quota seeding ────────────────────────────────────────────
  do {
    if (roleLeaveQuotas.isEmpty()) {
      let nowNs : Int = Time.now();
      let nowSecs : Int = nowNs / 1_000_000_000;
      let nowDays : Int = nowSecs / 86400;
      let z : Int = nowDays + 719468;
      let era : Int = (if (z >= 0) z else z - 146096) / 146097;
      let doe : Int = z - era * 146097;
      let yoe : Int = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
      let y : Int = yoe + era * 400;
      let doy : Int = doe - (365 * yoe + yoe / 4 - yoe / 100);
      let mp : Int = (5 * doy + 2) / 153;
      let m : Int = if (mp < 10) mp + 3 else mp - 9;
      let rawYear : Int = if (m <= 2) y + 1 else y;
      let curYear : Nat = if (rawYear > 0) rawYear.toNat() else 2026;
      let prevYear : Nat = if (curYear > 0) curYear - 1 else curYear;
      let seedYears : [Nat] = [prevYear, curYear];
      for (yr in seedYears.values()) {
        let defaults : [HRTypes.RoleLeaveQuota] = [
          { role = #MR;        year = yr; casualTotal = 12; sickTotal = 6;  unpaidTotal = 0; plTotal = 15; mlTotal = 0; lwpTotal = 0; coTotal = 5 },
          { role = #ASM;       year = yr; casualTotal = 12; sickTotal = 6;  unpaidTotal = 0; plTotal = 15; mlTotal = 0; lwpTotal = 0; coTotal = 5 },
          { role = #RSM;       year = yr; casualTotal = 12; sickTotal = 8;  unpaidTotal = 0; plTotal = 18; mlTotal = 0; lwpTotal = 0; coTotal = 5 },
          { role = #ZSM;       year = yr; casualTotal = 12; sickTotal = 8;  unpaidTotal = 0; plTotal = 18; mlTotal = 0; lwpTotal = 0; coTotal = 5 },
          { role = #HRManager; year = yr; casualTotal = 15; sickTotal = 10; unpaidTotal = 0; plTotal = 21; mlTotal = 0; lwpTotal = 0; coTotal = 7 },
          { role = #Admin;     year = yr; casualTotal = 15; sickTotal = 10; unpaidTotal = 0; plTotal = 21; mlTotal = 0; lwpTotal = 0; coTotal = 7 },
        ];
        for (q in defaults.values()) {
          roleLeaveQuotas.add(q);
        };
      };
    };
  };

  // ── Mixin composition ───────────────────────────────────────────────────────
  include AuthUsersMixin(
    users, usernameIndex, sessions, locations, nextUserId, empIdCounters, empIdConfigs, uidConfig,
    hqs, areas, stations,
    reactivationLog,
    userDobMap,
  );
  include FieldOpsMixin(
    products, doctors, chemists, orders, reports, assignments,
    daConfigs, sessions, users,
    nextProductId, nextDoctorId, nextChemistId, nextOrderId, nextReportId,
    dismissedAlerts, bulkUploadHistory, nextBulkHistoryId,
    allotmentAuditLogs, nextAllotmentLogId,
    additionalCharges, areas, hqs, stations,
    giftArticles, nextGiftArticleId,
    doctorDobMap,
  );
  include GiftArticleMasterMixin(giftArticles, nextGiftArticleId, sessions, reports);
  include HRCoreMixin(
    sessions, leaves, leaveQuotas, roleLeaveQuotas, attendance, payroll, expenses, performance, documents,
    reports, daConfigs, users,
    nextLeaveId, nextAttendId, nextPayId, nextExpId, nextPerfId, nextDocId,
    companyHolidays,
    taDaGradeConfig,
    elAccruals,
  );
  include LocMixin(
    sessions, zones, locStates, territories, hqs, areas, stations,
    nextZoneId, nextStateId, nextTerrId, nextHQId, nextAreaId, nextStationId,
    users, stationBulkHistory,
  );
  include LocationHqMixin(
    sessions, users,
    zones, locStates, territories, hqs, areas, stations,
  );
  include GpsTrailMixin(sessions, trails, checkIns, users, hqs, areas, gpsActivityLog, nextGpsActivityId, attendance, nextAttendId, reports, doctors, gpsEnforcementEnabled, gpsOverrides, nextGpsOverrideId);
  include TravelPlanMixin(sessions, users, travelPlans, roleHierarchyConf, nextTravelPlanId, stations, areas, hqs);
  include CrmMixin(sessions, users, crmRequests, salesTargets, crmBusinessReports, nextCrmId, nextTargetId, nextCrmReportId);
  include BookingMixin(sessions, bookingRequests, nextBookingId);
  include AdminMessagesMixin(sessions, adminMessages, nextMsgId);
  include CompanyProfileMixin(sessions, companyProfile);
  include OfficialLettersMixin(sessions, letters, letterRefNumbers, letterEmailLogs, nextLetterId, nextLetterRefSeq);
  include BottomUpTargetsMixin(
    sessions, users, territories, areas,
    bottomUpTargets, targetAdjLogs, crmBusinessReports,
    nextBottomUpTargetId, nextAdjLogId,
  );
  include TargetHistoryMixin(sessions, targetAdjLogs);
  include IncentivesMixin(
    sessions, users,
    incentivePlans, incentiveCalcs,
    monthlyTargets, crmBusinessReports,
    nextPlanId, nextCalcId,
  );
  include EmployeeIdMixin(sessions, users, empIdCounters, empIdConfigs, uidConfig, userDobMap);
  include DataCleanupMixin(
    sessions, users, dataCleanupLogs, nextCleanupLogId,
    reports, expenses, attendance, leaves,
    travelPlans, bookingRequests,
    crmRequests, crmBusinessReports,
    gpsActivityLog, checkIns,
    incentiveCalcs,
  );
  include PricelistMixin(sessions, pricelistProducts, nextPricelistId, nextPricelistSrNo);
  include MonthlyTargetsMixin(
    sessions, users, territories, areas,
    monthlyTargets, crmBusinessReports,
    doctors, reports, chemistCalls, stockistCalls,
  );
  include AdditionalChargeMixin(sessions, users, additionalCharges, nextChargeId, notifications, rsmMrNotifIdRef);
  include StockistMixin(sessions, users, stockists, hqs, areas, nextStockistId, bulkUploadHistory, nextBulkHistoryId);
  include SecondarySaleMixin(sessions, users, stockists, secondarySales, nextSaleId);
  include CrmDoctorSaleMixin(sessions, users, doctors, crmDoctorSales, nextCrmSaleId);
  include CompanyHolidayMixin(sessions, companyHolidays, nextHolidayId, attendance, nextAttendId, users);
  include PayrollExpensesAdvancesMixin(
    sessions, users,
    advances, expenseSheets, incentiveBonusSheets, workingStyleRecords,
    expenses,
    nextAdvanceId, nextExpenseSheetId, nextIncentiveBonusId, nextWorkingStyleId,
  );
  include HealthCheckMixin(
    sessions, users,
    roleLeaveQuotas, leaves, expenses, doctors, areas,
    healthCheckLogs,
  );
  include HealthRepairMixin(
    sessions, users,
    roleLeaveQuotas, leaves, expenses, doctors, areas,
    healthCheckLogs, repairLogs,
  );
  include SuggestionsMixin(sessions, users, leaves, suggestions, nextSuggestionId);
  include BirthdayMixin(users, doctors, sessions, userDobMap, doctorDobMap);
  include NotifMixin(
    sessions, users, reports, doctors,
    notifications, notificationSettings, pendingBatches,
    dcrs, checkIns, travelPlans, sfaReminderSettings,
  );
  include AdminSettingsMixin(sessions, notificationSettings, absenceSettings);
  include AbsenceInactivationMixin(
    sessions, users,
    attendance, leaves, companyHolidays,
    absenceInactivationLog, absenceSettings, nextAbsenceLogId,
  );
  include DcrMixin(
    sessions, users, checkIns, dcrs, nextDcrId, dcrSettings,
  );
  include JfwMixin(sessions, users, jfws, nextJfwId);
  include SfaSampleMixin(
    sampleAllocations, sampleUsages,
    sessions, users,
    nextSampleAllocId, nextSampleUsageId,
  );
  include ChemistCallMixin(
    sessions,
    chemistCalls, stockistCalls,
    nextChemistCallId, nextStockistCallId,
  );
  include DashboardMixin(
    sessions, users,
    reports, chemistCalls, stockistCalls,
    dcrs, dcrSettings, checkIns, locations,
    leaves, expenses, expenseSheets,
    sampleUsages, sampleAllocations,
    absenceInactivationLog, bulkUploadHistory,
    hqs, areas, stations,
  );
  include ReportingChainEmailsMixin(sessions, users);
  include EmployeeDeleteMixin(users, usernameIndex, sessions, deletionLog);

  // ── Daily absence check recurringTimer ─────────────────────────────────────────────
  let _absenceCheckTimer = Timer.recurringTimer<system>(
    #seconds(86400),
    func() : async () { await doRunAbsenceCheck() },
  );

  // ── DCR deadline reminder timer (fires every 24 hours) ──────────────────────────
  let _dcrReminderTimer = Timer.recurringTimer<system>(
    #seconds(86400),
    func() : async () {
      let nowNs    : Int = Time.now();
      let nowSecs  : Int = nowNs / 1_000_000_000;
      let daysSinceEpoch : Int = nowSecs / 86400;
      let z   : Int = daysSinceEpoch + 719468;
      let era : Int = (if (z >= 0) z else z - 146096) / 146097;
      let doe : Int = z - era * 146097;
      let yoe : Int = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
      let y   : Int = yoe + era * 400;
      let doy : Int = doe - (365 * yoe + yoe / 4 - yoe / 100);
      let mp  : Int = (5 * doy + 2) / 153;
      let day : Int = doy - (153 * mp + 2) / 5 + 1;
      let month : Int = if (mp < 10) mp + 3 else mp - 9;
      let year  : Int = if (month <= 2) y + 1 else y;
      let mm = if (month < 10) "0" # month.toText() else month.toText();
      let dd = if (day   < 10) "0" # day.toText()   else day.toText();
      let todayDate = year.toText() # "-" # mm # "-" # dd;
      for ((_, u) in users.entries()) {
        if (u.role == #MR and u.status == #Active) {
          let checkedInToday = checkIns.any(func(ci : GpsTypes.AttendanceCheckIn) : Bool {
            ci.userId == u.id and ci.date == todayDate
          });
          if (checkedInToday) {
            let hasDcr = dcrs.any(func(d : DcrTypes.DcrRecord) : Bool {
              d.mrId == u.id and d.date == todayDate and
              (d.status == #Submitted or d.status == #Late or
               d.status == #Approved  or d.status == #Rejected)
            });
            if (not hasDcr) {
              let deadlineHour = dcrSettings.dailyDeadlineHour;
              let recipText  = u.id.toText();
              let notifId    = nowNs.toText() # "_dcr_reminder_" # recipText;
              let notif : NotifTypes.NotificationRecord = {
                id                = notifId;
                recipientId       = recipText;
                senderId          = "system";
                notificationType  = #dcrReminder;
                title             = "DCR Reminder";
                body              = "Reminder: Please submit your Daily Call Report (DCR) for today before " #
                                    deadlineHour.toText() # ":00.";
                isRead            = false;
                relatedEntityId   = null;
                relatedEntityType = ?"dcr";
                createdAt         = nowNs;
              };
              notifications.add(notifId, notif);
            };
          };
        };
      };
    },
  );

  // ── Startup health-check ─────────────────────────────────────────────────────
  do {
    let report = HealthLib.runHealthCheck(
      users, roleLeaveQuotas, leaves, expenses, doctors, areas, sessions,
    );
    healthCheckLogs.add(report);
  };

  // ── Stable migration buffers (M0170 fix) ──────────────────────────────────────
  var _migAttendance      : [AttendanceRecordOld] = [];
  var _migLeaves          : [LeaveApplicationOld] = [];
  var _migLeaveQuotas     : [LeaveQuotaOld]       = [];
  var _migRoleLeaveQuotas : [RoleLeaveQuotaOld]   = [];

  // ── preupgrade: snapshot current Lists as OLD-typed arrays ─────────────────────
  system func preupgrade() {
    let attBuf = List.empty<AttendanceRecordOld>();
    attendance.forEach(func(r : HRTypes.AttendanceRecord) {
      let oldStatus : AttendanceStatusOld = switch (r.status) {
        case (#present)        #present;
        case (#absent)         #absent;
        case (#halfDay)        #halfDay;
        case (#onLeave)        #onLeave;
        case (#onLeaveCL)      #onLeaveCL;
        case (#onLeaveSL)      #onLeaveSL;
        case (#onLeaveUPL)     #onLeaveUPL;
        case (#onLeavePL)      #onLeavePL;
        case (#onLeaveML)      #onLeaveML;
        case (#onLeaveLWP)     #onLeaveLWP;
        case (#onLeaveCO)      #onLeaveCO;
        case (#weeklyOff)      #weeklyOff;
        case (#companyHoliday) #companyHoliday;
      };
      attBuf.add({
        id = r.id; employeeId = r.employeeId; date = r.date;
        status = oldStatus;
        checkInTime = r.checkInTime; checkInGps = r.checkInGps;
        leaveApplicationId = r.leaveApplicationId; holidayId = r.holidayId;
        correctedBy = r.correctedBy; correctionRemark = r.correctionRemark;
        correctionAt = r.correctionAt; recordedAt = r.recordedAt;
      });
    });
    _migAttendance := attBuf.toArray();

    let lvBuf = List.empty<LeaveApplicationOld>();
    leaves.forEach(func(app : HRTypes.LeaveApplication) {
      let oldLT : LeaveTypeOld = switch (app.leaveType) {
        case (#casual)      #casual;
        case (#sick)        #sick;
        case (#unpaid)      #unpaid;
        case (#pl)          #pl;
        case (#ml)          #ml;
        case (#lwp)         #lwp;
        case (#co)          #co;
      };
      lvBuf.add({
        id = app.id; employeeId = app.employeeId; leaveType = oldLT;
        fromDate = app.fromDate; toDate = app.toDate; numDays = app.numDays;
        reason = app.reason; notes = app.notes; attachmentUrl = app.attachmentUrl;
        status = app.status; approvedBy = app.approvedBy; approverId = app.approverId;
        approverRemark = app.approverRemark;
        appliedAt = app.appliedAt; updatedAt = app.updatedAt;
        gpsLocation = app.gpsLocation;
      });
    });
    _migLeaves := lvBuf.toArray();

    let lqBuf = List.empty<LeaveQuotaOld>();
    leaveQuotas.forEach(func(q : HRTypes.LeaveQuota) {
      lqBuf.add({
        employeeId = q.employeeId; year = q.year;
        casualTotal = q.casualTotal; sickTotal = q.sickTotal; unpaidTotal = q.unpaidTotal;
        plTotal = q.plTotal; mlTotal = q.mlTotal; lwpTotal = q.lwpTotal; coTotal = q.coTotal;
        casualUsed = q.casualUsed; sickUsed = q.sickUsed; unpaidUsed = q.unpaidUsed;
        plUsed = q.plUsed; mlUsed = q.mlUsed; lwpUsed = q.lwpUsed; coUsed = q.coUsed;
      });
    });
    _migLeaveQuotas := lqBuf.toArray();

    let rlqBuf = List.empty<RoleLeaveQuotaOld>();
    roleLeaveQuotas.forEach(func(q : HRTypes.RoleLeaveQuota) {
      rlqBuf.add({
        role = q.role; year = q.year;
        casualTotal = q.casualTotal; sickTotal = q.sickTotal; unpaidTotal = q.unpaidTotal;
        plTotal = q.plTotal; mlTotal = q.mlTotal; lwpTotal = q.lwpTotal; coTotal = q.coTotal;
      });
    });
    _migRoleLeaveQuotas := rlqBuf.toArray();
  };

  // ── postupgrade: restore from OLD buffers with defaults for new fields ──────────
  system func postupgrade() {
    if (_migAttendance.size() > 0) {
      attendance.clear();
      for (old in _migAttendance.values()) {
        let newStatus : HRTypes.AttendanceStatus = switch (old.status) {
          case (#present)        #present;
          case (#absent)         #absent;
          case (#halfDay)        #halfDay;
          case (#onLeave)        #onLeave;
          case (#onLeaveCL)      #onLeaveCL;
          case (#onLeaveSL)      #onLeaveSL;
          case (#onLeaveUPL)     #onLeaveUPL;
          case (#onLeavePL)      #onLeavePL;
          case (#onLeaveML)      #onLeaveML;
          case (#onLeaveLWP)     #onLeaveLWP;
          case (#onLeaveCO)      #onLeaveCO;
          case (#weeklyOff)      #weeklyOff;
          case (#companyHoliday) #companyHoliday;
        };
        attendance.add({
          id = old.id; employeeId = old.employeeId; date = old.date;
          status = newStatus;
          checkInTime = old.checkInTime; checkInGps = old.checkInGps;
          leaveApplicationId = old.leaveApplicationId; holidayId = old.holidayId;
          correctedBy = old.correctedBy; correctionRemark = old.correctionRemark;
          correctionAt = old.correctionAt; recordedAt = old.recordedAt;
        });
      };
      _migAttendance := [];
    };

    if (_migLeaves.size() > 0) {
      leaves.clear();
      for (old in _migLeaves.values()) {
        let newLT : HRTypes.LeaveType = switch (old.leaveType) {
          case (#casual) #casual;
          case (#sick)   #sick;
          case (#unpaid) #unpaid;
          case (#pl)     #pl;
          case (#ml)     #ml;
          case (#lwp)    #lwp;
          case (#co)     #co;
        };
        leaves.add({
          id = old.id; employeeId = old.employeeId; leaveType = newLT;
          fromDate = old.fromDate; toDate = old.toDate; numDays = old.numDays;
          reason = old.reason; notes = old.notes; attachmentUrl = old.attachmentUrl;
          status = old.status; approvedBy = old.approvedBy; approverId = old.approverId;
          approverRemark = old.approverRemark;
          appliedAt = old.appliedAt; updatedAt = old.updatedAt;
          gpsLocation = old.gpsLocation;
        });
      };
      _migLeaves := [];
    };

    if (_migLeaveQuotas.size() > 0) {
      leaveQuotas.clear();
      for (old in _migLeaveQuotas.values()) {
        leaveQuotas.add({
          employeeId = old.employeeId; year = old.year;
          casualTotal = old.casualTotal; sickTotal = old.sickTotal; unpaidTotal = old.unpaidTotal;
          plTotal = old.plTotal; mlTotal = old.mlTotal; lwpTotal = old.lwpTotal; coTotal = old.coTotal;
          casualUsed = old.casualUsed; sickUsed = old.sickUsed; unpaidUsed = old.unpaidUsed;
          plUsed = old.plUsed; mlUsed = old.mlUsed; lwpUsed = old.lwpUsed; coUsed = old.coUsed;
        });
      };
      _migLeaveQuotas := [];
    };

    if (_migRoleLeaveQuotas.size() > 0) {
      roleLeaveQuotas.clear();
      for (old in _migRoleLeaveQuotas.values()) {
        roleLeaveQuotas.add({
          role = old.role; year = old.year;
          casualTotal = old.casualTotal; sickTotal = old.sickTotal; unpaidTotal = old.unpaidTotal;
          plTotal = old.plTotal; mlTotal = old.mlTotal; lwpTotal = old.lwpTotal; coTotal = old.coTotal;
        });
      };
      _migRoleLeaveQuotas := [];
    };
  };
};
