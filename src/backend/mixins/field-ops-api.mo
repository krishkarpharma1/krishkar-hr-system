import Time "mo:core/Time";
import List "mo:core/List";
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Types "../types/field-ops";
import GATypes "../types/gift-article-master";
import ExportTypes "../types/exports";
import FieldOps "../lib/field-ops";
import GiftArticleLib "../lib/gift-article-master";
import AuthLib "../lib/auth-users";
import AuthTypes "../types/auth-users";
import ACTypes "../types/additional-charge";
import LocTypes "../types/location-master";

/// Public API surface for MR field operations.
/// State is injected via mixin parameters — no owned state.
mixin (
  products    : List.List<Types.Product>,
  doctors     : List.List<Types.Doctor>,
  chemists    : List.List<Types.Chemist>,
  orders      : List.List<Types.ChemistOrder>,
  reports     : List.List<Types.CallReport>,
  assignments : Map.Map<(Types.UserId, Types.DoctorId), Types.DoctorProductAssignment>,
  daConfigs   : Map.Map<Text, Types.DaConfig>,
  sessions    : Map.Map<Text, AuthTypes.Session>,
  users       : Map.Map<AuthTypes.UserId, AuthTypes.UserRecord>,
  nextProductId : { var val : Nat },
  nextDoctorId  : { var val : Nat },
  nextChemistId : { var val : Nat },
  nextOrderId   : { var val : Nat },
  nextReportId  : { var val : Nat },
  dismissedAlerts    : List.List<Types.DismissedAlert>,
  bulkUploadHistory  : List.List<Types.BulkUploadRecord>,
  nextBulkHistoryId  : { var value : Nat },
  allotmentAuditLogs : List.List<Types.AllotmentAuditLog>,
  nextAllotmentLogId : { var val : Nat },
  additionalCharges  : List.List<ACTypes.AdditionalCharge>,
  areas              : Map.Map<LocTypes.LocationId, LocTypes.AreaRecord>,
  hqs                : Map.Map<LocTypes.LocationId, LocTypes.HQRecord>,
  stations           : Map.Map<LocTypes.LocationId, LocTypes.StationRecord>,
  giftArticles       : List.List<GATypes.GiftArticle>,
  nextGiftArticleId  : { var val : Nat },
  doctorDobMap       : Map.Map<Text, Text>,
) {

  // ── Session helpers ────────────────────────────────────────────────────────

  func requireSessionFO(token : Text) : ?AuthTypes.Session {
    switch (sessions.get(token)) {
      case (?s) { if (s.expiresAt > Time.now()) ?s else null };
      case null { null };
    };
  };

  func requireAdminFO(token : Text) : ?AuthTypes.Session {
    switch (requireSessionFO(token)) {
      case null { null };
      case (?s) {
        switch (s.role) {
          case (#Admin) ?s;
          case _        { null };
        }
      };
    }
  };

  func requireHROrAdminFO(token : Text) : ?AuthTypes.Session {
    switch (requireSessionFO(token)) {
      case null { null };
      case (?s) {
        switch (s.role) {
          case (#Admin or #HRManager) ?s;
          case _                      { null };
        }
      };
    }
  };

  // ── Product catalog ───────────────────────────────────────────────────────

  public shared func addProduct(input : Types.CreateProductInput) : async Types.ProductId {
    FieldOps.addProduct(products, nextProductId, input, Time.now());
  };

  public query func getProduct(productId : Types.ProductId) : async ?Types.ProductInfo {
    FieldOps.getProduct(products, productId);
  };

  public query func listProducts() : async [Types.ProductInfo] {
    FieldOps.listProducts(products);
  };

  public shared func updateProduct(
    productId   : Types.ProductId,
    name        : ?Text,
    category    : ?Types.ProductCategory,
    description : ?Text,
    productCode : ?Text,
    division    : ?Text,
    mrpPaise    : ?Nat,
    packSize    : ?Text,
  ) : async Types.MutationResult {
    FieldOps.updateProduct(products, productId, name, category, description, productCode, division, mrpPaise, packSize);
  };

  public shared func deactivateProduct(productId : Types.ProductId) : async Types.MutationResult {
    FieldOps.deactivateProduct(products, productId);
  };

  // ── Doctors ───────────────────────────────────────────────────────────────

  public shared func addDoctor(mrId : Types.UserId, input : Types.CreateDoctorInput) : async Types.DoctorId {
    FieldOps.addDoctor(doctors, nextDoctorId, doctorDobMap, mrId, input, Time.now());
  };

  public query func getDoctor(doctorId : Types.DoctorId) : async ?Types.DoctorInfo {
    FieldOps.getDoctor(doctors, doctorDobMap, doctorId);
  };

  public query func listDoctors() : async [Types.DoctorInfo] {
    FieldOps.listDoctors(doctors, doctorDobMap);
  };

  public query func listDoctorsByTerritory(territory : Text) : async [Types.DoctorInfo] {
    FieldOps.listDoctorsByTerritory(doctors, doctorDobMap, territory);
  };

  public query func listMyDoctors(mrId : Types.UserId) : async [Types.DoctorInfo] {
    FieldOps.listDoctorsByMr(doctors, doctorDobMap, mrId);
  };

  public shared func updateDoctor(
    doctorId       : Types.DoctorId,
    mrId           : Types.UserId,
    name           : ?Text,
    station        : ?Text,
    area           : ?Text,
    territory      : ?Text,
    specialization : ?Text,
    contactPhone   : ?Text,
  ) : async Types.MutationResult {
    FieldOps.updateDoctor(doctors, doctorId, mrId, name, station, area, territory, specialization, contactPhone);
  };

  // ── Doctor product assignments ────────────────────────────────────────────

  public shared func assignProductsToDoctor(mrId : Types.UserId, input : Types.AssignProductsInput) : async () {
    FieldOps.assignProductsToDoctor(assignments, mrId, input, Time.now());
  };

  public query func getDoctorAssignment(mrId : Types.UserId, doctorId : Types.DoctorId) : async ?Types.DoctorProductAssignment {
    FieldOps.getDoctorAssignment(assignments, mrId, doctorId);
  };

  public query func listMyDoctorAssignments(mrId : Types.UserId) : async [Types.DoctorProductAssignment] {
    FieldOps.listAssignmentsByMr(assignments, mrId);
  };

  // ── Chemists ──────────────────────────────────────────────────────────────

  public shared func addChemist(mrId : Types.UserId, input : Types.CreateChemistInput) : async Types.ChemistId {
    FieldOps.addChemist(chemists, nextChemistId, mrId, input, Time.now());
  };

  public query func getChemist(chemistId : Types.ChemistId) : async ?Types.ChemistInfo {
    FieldOps.getChemist(chemists, chemistId);
  };

  public query func listChemists() : async [Types.ChemistInfo] {
    FieldOps.listChemists(chemists);
  };

  public query func listChemistsByTerritory(territory : Text) : async [Types.ChemistInfo] {
    FieldOps.listChemistsByTerritory(chemists, territory);
  };

  public query func listMyChemists(mrId : Types.UserId) : async [Types.ChemistInfo] {
    FieldOps.listChemistsByMr(chemists, mrId);
  };

  // ── Chemist orders ────────────────────────────────────────────────────────

  /// Submit a chemist order. gpsLocation in input is captured at submission time.
  public shared func submitChemistOrder(mrId : Types.UserId, input : Types.CreateOrderInput) : async Types.OrderId {
    FieldOps.createOrder(orders, nextOrderId, mrId, input, Time.now());
  };

  public query func getChemistOrder(orderId : Types.OrderId) : async ?Types.ChemistOrderInfo {
    FieldOps.getOrder(orders, orderId);
  };

  public query func listMyOrders(mrId : Types.UserId) : async [Types.ChemistOrderInfo] {
    FieldOps.listOrdersByMr(orders, mrId);
  };

  public query func listOrdersByChemist(chemistId : Types.ChemistId) : async [Types.ChemistOrderInfo] {
    FieldOps.listOrdersByChemist(orders, chemistId);
  };

  public shared func updateOrderStatus(
    orderId : Types.OrderId,
    status  : Types.OrderStatus,
  ) : async Types.MutationResult {
    FieldOps.updateOrderStatus(orders, orderId, status);
  };

  // ── Daily call reports ────────────────────────────────────────────────────

  /// Create a call report. Top-level gps in CreateReportInput captures location at submission.
  public shared func createCallReport(mrId : Types.UserId, input : Types.CreateReportInput) : async Types.ReportId {
    FieldOps.createReport(reports, nextReportId, mrId, input, Time.now());
  };

  /// Submit a call report — calculates and stores DA amount based on caller's role.
  public shared func submitCallReport(token : Text, reportId : Types.ReportId) : async Types.MutationResult {
    switch (requireSessionFO(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        let roleText = FieldOps.roleToText(s.role);
        FieldOps.submitReport(reports, reportId, s.userId, roleText, daConfigs, Time.now())
      };
    }
  };

  public query func getCallReport(reportId : Types.ReportId) : async ?Types.CallReportInfo {
    FieldOps.getReport(reports, reportId);
  };

  public query func listMyCallReports(mrId : Types.UserId) : async [Types.CallReportInfo] {
    FieldOps.listReportsByMr(reports, mrId);
  };

  public query func listMyCallReportsByMonth(mrId : Types.UserId, month : Text) : async [Types.CallReportInfo] {
    FieldOps.listReportsByMrAndMonth(reports, mrId, month);
  };

  public query func listSubmittedReports() : async [Types.CallReportInfo] {
    FieldOps.listSubmittedReports(reports);
  };

  public shared func reviewCallReport(
    reviewerId : Types.UserId,
    reportId   : Types.ReportId,
    approved   : Bool,
    note       : Text,
  ) : async Types.MutationResult {
    FieldOps.reviewReport(reports, reportId, reviewerId, approved, note, Time.now());
  };

  // ── Analytics ─────────────────────────────────────────────────────────────

  public query func getMrMonthlySummary(mrId : Types.UserId, month : Text) : async Types.MrMonthlySummary {
    FieldOps.getMrMonthlySummary(reports, orders, mrId, month);
  };

  public query func getTerritoryCoverage(territory : Text, month : Text) : async Types.TerritoryCoverage {
    FieldOps.getTerritoryCoverage(doctors, reports, territory, month);
  };

  public query func listAllMrSummaries(month : Text) : async [Types.MrMonthlySummary] {
    FieldOps.listAllMrSummaries(reports, orders, month);
  };

  // ── Bulk import ───────────────────────────────────────────────────────────

  /// Bulk-import doctors reading area from each Excel row. Admin/HR only.
  public shared func bulkImportDoctors(
    token : Text,
    mrId  : Types.UserId,
    items : [Types.BulkImportDoctorInput],
  ) : async Types.BulkImportDoctorResult {
    switch (requireHROrAdminFO(token)) {
      case null {
        { succeeded = 0; failed = items.size(); errors = ["Unauthorized: HR or Admin role required"]; newDoctorIds = [] }
      };
      case (?s) {
        let now = Time.now();
        let validAreaNames = List.empty<Text>();
        for ((_, ar) in areas.entries()) {
          if (ar.name != "") validAreaNames.add(ar.name);
        };
        let result = FieldOps.bulkImportDoctors(doctors, nextDoctorId, items, validAreaNames.toArray(), mrId, now);
        let histId = nextBulkHistoryId.value;
        nextBulkHistoryId.value += 1;
        bulkUploadHistory.add({
          id          = histId;
          uploadType  = "doctors";
          uploadedBy  = s.userId;
          uploadedAt  = now;
          totalRows   = items.size();
          savedRows   = result.succeeded;
          skippedRows = result.failed;
          errors      = result.errors;
        });
        result
      };
    }
  };

  /// Bulk-import chemists for a given area. Admin/HR only.
  public shared func bulkImportChemists(
    token    : Text,
    mrId     : Types.UserId,
    items    : [Types.BulkImportChemistInput],
    areaName : Text,
  ) : async Types.BulkImportResult {
    switch (requireHROrAdminFO(token)) {
      case null {
        { succeeded = 0; failed = items.size(); errors = ["Unauthorized: HR or Admin role required"] }
      };
      case (?s) {
        let result = FieldOps.bulkImportChemists(chemists, nextChemistId, items, areaName, mrId, Time.now());
        let histId = nextBulkHistoryId.value;
        nextBulkHistoryId.value += 1;
        bulkUploadHistory.add({
          id          = histId;
          uploadType  = "chemists";
          uploadedBy  = s.userId;
          uploadedAt  = Time.now();
          totalRows   = items.size();
          savedRows   = result.succeeded;
          skippedRows = result.failed;
          errors      = result.errors;
        });
        result
      };
    }
  };

  // ── DA Configuration ──────────────────────────────────────────────────────

  /// Returns all DA rate configurations (one per role). Admin-readable.
  public query func getDaConfigs() : async [Types.DaConfig] {
    FieldOps.getDaConfigs(daConfigs);
  };

  /// Returns the Out Station DA rate (in paise) for the given user, based on their role.
  public query func getOutStationDaRate(token : Text, userId : Types.UserId) : async ?Nat {
    switch (requireSessionFO(token)) {
      case null { null };
      case (?s) {
        let _ = userId;
        let roleText = FieldOps.roleToText(s.role);
        switch (daConfigs.get(roleText)) {
          case (?cfg) ?cfg.outStationRate;
          case null   null;
        }
      };
    }
  };

  /// Replaces all DA rate configs with the provided list. Admin only.
  public shared func setDaConfigs(token : Text, configs : [Types.DaConfig]) : async Types.MutationResult {
    switch (requireAdminFO(token)) {
      case null { #err("Unauthorized: Admin role required") };
      case (?_) {
        FieldOps.setDaConfigs(daConfigs, configs);
        #ok
      };
    }
  };

  // ── Doctor visit history ──────────────────────────────────────────────────

  /// Returns the most recent `limit` call reports that include the given doctor.
  public query func getDoctorVisitHistory(doctorId : Types.DoctorId, limit : Nat) : async [Types.CallReportInfo] {
    FieldOps.getDoctorVisitHistory(reports, doctorId, limit);
  };

  // ── 30-Day working detail (DA history) ───────────────────────────────────

  /// Returns submitted/approved DCRs for the calling user for a given month/year.
  public query func getMyDaHistory(token : Text, month : Nat, year : Nat) : async [Types.DaHistoryRow] {
    switch (requireSessionFO(token)) {
      case null { [] };
      case (?s) { FieldOps.getDaHistory(reports, s.userId, month, year) };
    }
  };

  /// Returns submitted/approved DCRs for any employee in a given month/year.
  /// HR/Admin only.
  public query func getEmployeeDaHistory(
    token      : Text,
    employeeId : Types.UserId,
    month      : Nat,
    year       : Nat,
  ) : async [Types.DaHistoryRow] {
    switch (requireHROrAdminFO(token)) {
      case null { [] };
      case (?_) { FieldOps.getDaHistory(reports, employeeId, month, year) };
    }
  };

  // ── Export: Call Reports ──────────────────────────────────────────────────

  public query func exportCallReports(
    token  : Text,
    filter : ExportTypes.ExportFilter,
  ) : async [ExportTypes.CallReportExportRow] {
    let _ = token; let _ = filter; []
  };

  public query func exportDoctorVisitReports(
    token  : Text,
    filter : ExportTypes.ExportFilter,
  ) : async [ExportTypes.DoctorVisitExportRow] {
    let _ = token; let _ = filter; []
  };

  public query func exportDaReport(
    token  : Text,
    filter : ExportTypes.ExportFilter,
  ) : async [ExportTypes.DaReportRow] {
    let _ = token; let _ = filter; []
  };

  // ── MR Call Details Report (P3) ───────────────────────────────────────────

  /// Helper: build userId -> name map from users map for quick lookups.
  func buildUserNameMap() : Map.Map<Types.UserId, Text> {
    let m = Map.empty<Types.UserId, Text>();
    for ((uid, u) in users.entries()) {
      m.add(uid, u.name);
    };
    m
  };

  /// Check if callerSession can access MR data (self, manager chain, HR, Admin).
  func canAccessMrData(session : AuthTypes.Session, mrUserId : Types.UserId) : Bool {
    if (session.userId == mrUserId) return true;
    switch (session.role) {
      case (#Admin or #HRManager) return true;
      case _ {};
    };
    var current = switch (users.get(mrUserId)) {
      case (?u) u.reportsTo;
      case null null;
    };
    var depth = 0;
    label walk loop {
      if (depth > 10) break walk;
      switch (current) {
        case null { break walk };
        case (?mid) {
          if (mid == session.userId) return true;
          current := switch (users.get(mid)) {
            case (?u) u.reportsTo;
            case null null;
          };
          depth += 1;
        };
      };
    };
    false
  };

  /// Get date-wise call details for an MR within a date range.
  public query func getMRCallDetails(
    token     : Text,
    mrUserId  : Types.UserId,
    fromDate  : Int,
    toDate    : Int,
  ) : async { #ok : [Types.DayCallSummary]; #err : Text } {
    switch (requireSessionFO(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        if (not canAccessMrData(s, mrUserId)) {
          return #err("Access denied: you do not have permission to view this MR's data")
        };
        #ok(FieldOps.getMRCallDetails(reports, doctors, products, mrUserId, fromDate, toDate))
      };
    }
  };

  /// Get summary totals for an MR over a date range.
  public query func getMRCallSummary(
    token    : Text,
    mrUserId : Types.UserId,
    fromDate : Int,
    toDate   : Int,
  ) : async { #ok : Types.MRCallSummary; #err : Text } {
    switch (requireSessionFO(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        if (not canAccessMrData(s, mrUserId)) {
          return #err("Access denied: you do not have permission to view this MR's data")
        };
        #ok(FieldOps.getMRCallSummary(reports, mrUserId, fromDate, toDate))
      };
    }
  };

  // ── Missed Doctor Visits (P4) ─────────────────────────────────────────────

  /// Get doctors for an MR that have fewer than 2 visits in the given month/year.
  public query func getMissedDoctorsForMR(
    token    : Text,
    mrUserId : Types.UserId,
    month    : Nat,
    year     : Nat,
  ) : async { #ok : [Types.MissedDoctorInfo]; #err : Text } {
    switch (requireSessionFO(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        if (not canAccessMrData(s, mrUserId)) {
          return #err("Access denied: you do not have permission to view this MR's data")
        };
        let now = Time.now();
        let mrDoctors = FieldOps.getDoctorsByMRHQAndArea(doctors, users, areas, hqs, additionalCharges, mrUserId, now);
        #ok(FieldOps.getMissedDoctorsFromList(reports, mrDoctors, mrUserId, month, year))
      };
    }
  };

  /// Get missed visit summary for all MRs under the logged-in manager.
  public query func getMRMissedVisitSummary(
    token : Text,
    month : Nat,
    year  : Nat,
  ) : async { #ok : [Types.MRMissedSummary]; #err : Text } {
    switch (requireSessionFO(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        let allowed = switch (s.role) {
          case (#Admin or #HRManager or #ZSM or #RSM or #ASM) true;
          case _ false;
        };
        if (not allowed) {
          return #err("Access denied: ASM or above required")
        };
        let mrIds = List.empty<Types.UserId>();
        for ((uid, u) in users.entries()) {
          switch (u.role) {
            case (#MR) {
              let shouldInclude = switch (s.role) {
                case (#Admin or #HRManager) true;
                case _ canAccessMrData(s, uid);
              };
              if (shouldInclude) mrIds.add(uid);
            };
            case _ {};
          };
        };
        let nameMap = buildUserNameMap();
        let now = Time.now();
        #ok(FieldOps.getMRMissedVisitSummariesHQArea(
          reports, doctors, users, areas, hqs, additionalCharges, nameMap, mrIds.toArray(), month, year, now
        ))
      };
    }
  };

  // ── MR Portal Tagged Entries (P5) ─────────────────────────────────────────

  public query func getMRPortalEntries(
    token    : Text,
    fromDate : Int,
    toDate   : Int,
  ) : async { #ok : [Types.TaggedCallEntry]; #err : Text } {
    switch (requireSessionFO(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        switch (s.role) {
          case (#Admin or #HRManager) {};
          case _ { return #err("Access denied: HR or Admin required") };
        };
        let nameMap = buildUserNameMap();
        #ok(FieldOps.getMRPortalEntries(reports, nameMap, fromDate, toDate))
      };
    }
  };

  // ── Missed Visit Alerts (20-day threshold) ────────────────────────────────

  func collectMrIdsForSession(s : AuthTypes.Session) : [Types.UserId] {
    let mrIds = List.empty<Types.UserId>();
    for ((uid, u) in users.entries()) {
      switch (u.role) {
        case (#MR) {
          let shouldInclude = switch (s.role) {
            case (#Admin or #HRManager) true;
            case _ canAccessMrData(s, uid);
          };
          if (shouldInclude) mrIds.add(uid);
        };
        case _ {};
      };
    };
    mrIds.toArray()
  };

  /// Get missed visit alerts (doctors not visited in 20+ days) for MRs under the caller.
  public query func getMissedVisitAlerts(
    token     : Text,
    managerId : Nat,
  ) : async { #ok : [Types.MissedVisitAlert]; #err : Text } {
    switch (requireSessionFO(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        let allowed = switch (s.role) {
          case (#Admin or #HRManager or #ZSM or #RSM or #ASM) true;
          case _ false;
        };
        if (not allowed) {
          return #err("Access denied: ASM or above required")
        };
        let nameMap = buildUserNameMap();
        let mrIds = collectMrIdsForSession(s);
        let now = Time.now();
        #ok(FieldOps.getMissedVisitAlertsHQArea(
          reports, doctors, users, areas, hqs, additionalCharges, nameMap, dismissedAlerts, managerId, mrIds, now
        ))
      };
    }
  };

  /// Get missed visit alerts for ALL MRs across all managers (Admin/HR only).
  public query func getMissedVisitAlertsAll(
    token : Text,
  ) : async { #ok : [Types.MissedVisitAlert]; #err : Text } {
    switch (requireHROrAdminFO(token)) {
      case null { #err("Unauthorized: HR or Admin role required") };
      case (?s) {
        let nameMap = buildUserNameMap();
        let mrIds = List.empty<Types.UserId>();
        for ((uid, u) in users.entries()) {
          switch (u.role) { case (#MR) mrIds.add(uid); case _ {} };
        };
        let now = Time.now();
        #ok(FieldOps.getMissedVisitAlertsHQArea(
          reports, doctors, users, areas, hqs, additionalCharges, nameMap, dismissedAlerts, s.userId, mrIds.toArray(), now
        ))
      };
    }
  };

  /// Dismiss a missed visit alert for the current calendar day.
  public shared func dismissMissedVisitAlert(
    token    : Text,
    mrId     : Nat,
    doctorId : Nat,
  ) : async { #ok; #err : Text } {
    switch (requireSessionFO(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        let allowed = switch (s.role) {
          case (#Admin or #HRManager or #ZSM or #RSM or #ASM) true;
          case _ false;
        };
        if (not allowed) {
          return #err("Access denied: ASM or above required")
        };
        FieldOps.dismissAlert(dismissedAlerts, s.userId, mrId, doctorId, Time.now());
        #ok
      };
    }
  };

  // ── Doctor Visit Trend ────────────────────────────────────────────────────

  /// Get per-MR doctor visit % trend for the last N months under the calling manager.
  public query func getDoctorVisitTrend(
    token     : Text,
    managerId : Nat,
    months    : Nat,
  ) : async { #ok : [Types.MonthlyVisitData]; #err : Text } {
    switch (requireSessionFO(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        let allowed = switch (s.role) {
          case (#Admin or #HRManager or #ZSM or #RSM or #ASM) true;
          case _ false;
        };
        if (not allowed) {
          return #err("Access denied: ASM or above required")
        };
        let nameMap = buildUserNameMap();
        let mrIds = collectMrIdsForSession(s);
        let _ = managerId;
        let nMonths = if (months == 0) 6 else months;
        let now = Time.now();
        #ok(FieldOps.getDoctorVisitTrendHQArea(
          reports, doctors, users, areas, hqs, additionalCharges, nameMap, mrIds, nMonths, now
        ))
      };
    }
  };

  /// Get consolidated team-average visit % per month for the calling manager.
  public query func getConsolidatedVisitTrend(
    token     : Text,
    managerId : Nat,
    months    : Nat,
  ) : async { #ok : [Types.ConsolidatedMonthData]; #err : Text } {
    switch (requireSessionFO(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        let allowed = switch (s.role) {
          case (#Admin or #HRManager or #ZSM or #RSM or #ASM) true;
          case _ false;
        };
        if (not allowed) {
          return #err("Access denied: ASM or above required")
        };
        let mrIds = collectMrIdsForSession(s);
        let _ = managerId;
        let nMonths = if (months == 0) 6 else months;
        let now = Time.now();
        #ok(FieldOps.getConsolidatedVisitTrendHQArea(
          reports, doctors, users, areas, hqs, additionalCharges, mrIds, nMonths, now
        ))
      };
    }
  };

  // ── Bulk Upload History ───────────────────────────────────────────────────

  /// Get bulk upload history. uploadType: "doctors" | "chemists" | "all".
  /// Access: Admin/HR only.
  public query func getBulkUploadHistory(
    token      : Text,
    uploadType : Text,
  ) : async [Types.BulkUploadRecord] {
    switch (requireHROrAdminFO(token)) {
      case null { [] };
      case (?_) {
        if (uploadType == "all") {
          bulkUploadHistory.toArray()
        } else {
          bulkUploadHistory.filter(func(r : Types.BulkUploadRecord) : Bool {
            r.uploadType == uploadType
          }).toArray()
        }
      };
    }
  };

  // ── HQ+Area doctor lookup (on-the-fly, replaces allotment) ───────────────

  /// Returns all active doctors accessible to an MR based on their HQ+Area assignments.
  public query func getDoctorsByMRHQAndArea(
    token    : Text,
    mrUserId : Nat,
  ) : async { #ok : [Types.DoctorInfo]; #err : Text } {
    switch (requireSessionFO(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        if (not canAccessMrData(s, mrUserId)) {
          return #err("Access denied: you do not have permission to view this MR's doctors")
        };
        #ok(FieldOps.getDoctorsByMRHQAndArea(doctors, users, areas, hqs, additionalCharges, mrUserId, Time.now()))
      };
    }
  };

  /// Returns active doctors accessible to an MR additionally filtered by station name.
  public query func getDoctorsForStation(
    token       : Text,
    mrUserId    : Nat,
    stationName : Text,
  ) : async { #ok : [Types.DoctorInfo]; #err : Text } {
    switch (requireSessionFO(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        if (not canAccessMrData(s, mrUserId)) {
          return #err("Access denied: you do not have permission to view this MR's doctors")
        };
        #ok(FieldOps.getDoctorsForStation(doctors, users, areas, hqs, additionalCharges, mrUserId, stationName, Time.now()))
      };
    }
  };

  // ── Stations for MR (Doctor Call Step 1) ─────────────────────────────────

  /// Get all distinct station values for an MR from all doctors in their accessible areas.
  public query func getStationsByMR(
    token    : Text,
    mrUserId : Nat,
  ) : async { #ok : [Text]; #err : Text } {
    switch (requireSessionFO(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        if (not canAccessMrData(s, mrUserId)) {
          return #err("Access denied: you do not have permission to view this MR's stations")
        };
        #ok(FieldOps.getStationsByMR(doctors, users, areas, hqs, additionalCharges, mrUserId, Time.now()))
      };
    }
  };

  /// Get stations for an MR from the Station Master, using HQ assignments.
  public query func getStationsByMRHqAssignments(
    token    : Text,
    mrUserId : Nat,
  ) : async { #ok : [LocTypes.StationRecord]; #err : Text } {
    switch (requireSessionFO(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        if (not canAccessMrData(s, mrUserId)) {
          return #err("Access denied: you do not have permission to view this MR's stations")
        };
        #ok(FieldOps.getStationsByMRHqAssignments(users, stations, additionalCharges, mrUserId, Time.now()))
      };
    }
  };

  // ── Doctor classification ──────────────────────────────────────────────────

  /// Set Core/Non-Core classification and visit frequency target for a doctor.
  /// Requires Admin, HR, ASM, RSM, or ZSM role.
  public shared func setDoctorClassification(
    token                : Text,
    doctorId             : Nat,
    isCoreDoctor         : Bool,
    visitFrequencyTarget : Nat,
  ) : async Types.MutationResult {
    switch (requireSessionFO(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        let allowed = switch (s.role) {
          case (#Admin or #HRManager or #ZSM or #RSM or #ASM) true;
          case _ false;
        };
        if (not allowed) return #err("Access denied: ASM or above required");
        FieldOps.setDoctorClassification(doctors, doctorId, isCoreDoctor, visitFrequencyTarget)
      };
    }
  };

  // ── Doctor Admin operations (edit/delete with audit trail) ────────────────

  /// Update a doctor record (Admin/HR, no ownership restriction).
  /// Accepts all editable fields including category, email, clinicName, address, isActive.
  /// Any optional field not provided keeps its existing value unchanged.
  public shared func updateDoctorAdmin(
    token          : Text,
    doctorId       : Nat,
    name           : ?Text,
    qualification  : ?Types.DoctorQualification,
    station        : ?Text,
    area           : ?Text,
    territory      : ?Text,
    specialization : ?Text,
    contactPhone   : ?Text,
    category       : ?Text,
    email          : ?Text,
    clinicName     : ?Text,
    address        : ?Text,
    isActive       : ?Bool,
    dateOfBirth    : ?Text,
  ) : async Types.MutationResult {
    switch (requireHROrAdminFO(token)) {
      case null { #err("Unauthorized: HR or Admin role required") };
      case (?s) {
        FieldOps.updateDoctorAdmin(
          doctors, allotmentAuditLogs, nextAllotmentLogId,
          doctorDobMap,
          doctorId, s.userId,
          name, qualification, station, area, territory, specialization, contactPhone,
          category, email, clinicName, address, isActive, dateOfBirth,
          Time.now()
        )
      };
    }
  };

  /// Permanently delete a single doctor. Admin/HR only.
  public shared func deleteDoctor(
    token     : Text,
    doctorId  : Nat,
  ) : async Bool {
    switch (requireHROrAdminFO(token)) {
      case null { false };
      case (?s) {
        FieldOps.deleteDoctorById(
          doctors, allotmentAuditLogs, nextAllotmentLogId,
          doctorId, s.userId, Time.now()
        )
      };
    }
  };

  /// Bulk delete doctors. Admin/HR only.
  public shared func deleteDoctors(
    token     : Text,
    doctorIds : [Nat],
  ) : async Types.BulkDeleteResult {
    switch (requireHROrAdminFO(token)) {
      case null { { deleted = 0; failed = doctorIds.size() } };
      case (?s) {
        FieldOps.bulkDeleteDoctors(
          doctors, allotmentAuditLogs, nextAllotmentLogId,
          doctorIds, s.userId, Time.now()
        )
      };
    }
  };

  // ── Gift Article Master (proxy — Admin/HR CRUD, all-roles read) ──────────

  /// Create a new gift article. Admin/HR only.
  public shared func createGiftArticleMaster(
    token : Text,
    input : GATypes.CreateGiftArticleInput,
  ) : async { #ok : GATypes.GiftArticleInfo; #err : Text } {
    switch (requireHROrAdminFO(token)) {
      case null { #err("Unauthorized: HR or Admin role required") };
      case (?s) {
        let info = GiftArticleLib.createGiftArticle(giftArticles, nextGiftArticleId, input, s.userId, Time.now());
        #ok(info)
      };
    }
  };

  /// Update an existing gift article. Admin/HR only.
  public shared func updateGiftArticleMaster(
    token : Text,
    id    : GATypes.GiftArticleId,
    input : GATypes.UpdateGiftArticleInput,
  ) : async { #ok : GATypes.GiftArticleInfo; #err : Text } {
    switch (requireHROrAdminFO(token)) {
      case null { #err("Unauthorized: HR or Admin role required") };
      case (?_) { GiftArticleLib.updateGiftArticle(giftArticles, id, input) };
    }
  };

  /// Delete (deactivate) a gift article. Admin/HR only.
  public shared func deleteGiftArticleMaster(
    token : Text,
    id    : GATypes.GiftArticleId,
  ) : async { #ok; #err : Text } {
    switch (requireHROrAdminFO(token)) {
      case null { #err("Unauthorized: HR or Admin role required") };
      case (?_) { GiftArticleLib.deleteGiftArticle(giftArticles, id) };
    }
  };

  /// List active gift articles. All authenticated roles.
  public query func listGiftArticlesMaster(token : Text) : async [GATypes.GiftArticleInfo] {
    switch (requireSessionFO(token)) {
      case null { [] };
      case (?_) { GiftArticleLib.listGiftArticles(giftArticles) };
    }
  };

  /// List all gift articles including inactive. Admin/HR only.
  public query func listAllGiftArticlesMaster(token : Text) : async [GATypes.GiftArticleInfo] {
    switch (requireHROrAdminFO(token)) {
      case null { [] };
      case (?_) { GiftArticleLib.listAllGiftArticles(giftArticles) };
    }
  };

  // ── Call Reports Screen ───────────────────────────────────────────────────

  /// Collect all MR userIds the caller is authorised to view call reports for.
  ///   Admin / HR  → all MR-role users
  ///   ASM         → MRs who directly report to this ASM (direct reportees)
  ///   RSM/ZSM     → all MRs at any depth below in the hierarchy (BFS traversal)
  ///   MR          → just themselves
  public query func listCallReportsMrIds(token : Text) : async { #ok : [Types.UserId]; #err : Text } {
    switch (requireSessionFO(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        let result = List.empty<Types.UserId>();
        switch (s.role) {
          case (#MR) {
            result.add(s.userId);
          };
          case (#Admin or #HRManager) {
            for ((uid, u) in users.entries()) {
              switch (u.role) { case (#MR) result.add(uid); case _ {} };
            };
          };
          case (#ASM) {
            // ASM: only direct MR reportees
            for ((uid, u) in users.entries()) {
              switch (u.role) {
                case (#MR) {
                  switch (u.reportsTo) {
                    case (?mid) { if (mid == s.userId) result.add(uid) };
                    case null {};
                  };
                };
                case _ {};
              };
            };
          };
          case (#RSM or #ZSM) {
            // Use BFS to get ALL transitive reportees, then keep only MR-role ones
            let allIds = AuthLib.allReporteeIds(users, s.userId);
            for (uid in allIds.values()) {
              switch (users.get(uid)) {
                case (?u) {
                  switch (u.role) { case (#MR) result.add(uid); case _ {} };
                };
                case null {};
              };
            };
          };
          case _ {
            // Any other role gets an empty list — not a field-facing role
          };
        };
        #ok(result.toArray())
      };
    }
  };

  /// Returns MRs under the calling manager grouped by their ASM.
  /// Used by the MR Detail Report dropdown on RSM/ZSM portals.
  ///   RSM  → ASMs under RSM, with MRs per ASM
  ///   ZSM  → RSMs → ASMs → MRs (only MR-role users are in the leaf groups)
  ///   Admin/HR → all MRs, grouped by ASM
  ///   ASM  → own MRs (single group: themselves as the ASM)
  ///   MR   → empty (MRs don't manage anyone)
  public query func getMrsGroupedByAsmForManager(
    token : Text,
  ) : async { #ok : [Types.AsmMrGroup]; #err : Text } {
    switch (requireSessionFO(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        let allowed = switch (s.role) {
          case (#Admin or #HRManager or #ZSM or #RSM or #ASM) true;
          case _ false;
        };
        if (not allowed) {
          return #err("Access denied: ASM or above required")
        };
        // For Admin/HR, gather all transitive IDs (everyone)
        let transitiveIds : [Types.UserId] = switch (s.role) {
          case (#Admin or #HRManager) {
            let all = List.empty<Types.UserId>();
            for ((uid, _) in users.entries()) { all.add(uid) };
            all.toArray()
          };
          case _ {
            AuthLib.allReporteeIds(users, s.userId)
          };
        };
        #ok(FieldOps.getMrsGroupedByAsmForManager(users, s.userId, transitiveIds))
      };
    }
  };

  /// List call reports for a given MR, filtered by optional date range.
  /// fromDate / toDate are Int nanosecond timestamps; pass 0 for no bound.
  /// Returns rich CallReportDetail records with all names resolved.
  public query func listCallReportsByMr(
    token    : Text,
    mrId     : Types.UserId,
    fromDate : Int,
    toDate   : Int,
  ) : async { #ok : [Types.CallReportDetail]; #err : Text } {
    switch (requireSessionFO(token)) {
      case null { #err("Unauthorized: invalid or expired session") };
      case (?s) {
        // Permission check
        let allowed = s.userId == mrId or (
          switch (s.role) {
            case (#Admin or #HRManager) true;
            case (#ASM or #RSM or #ZSM) canAccessMrData(s, mrId);
            case _ false;
          }
        );
        if (not allowed) {
          return #err("Access denied: you do not have permission to view this MR's call reports")
        };

        // Resolve MR name
        let mrName = switch (users.get(mrId)) {
          case (?u) u.name;
          case null "Unknown MR";
        };

        // Build product id → name map (active + inactive for historical records)
        let productNameMap = Map.empty<Types.ProductId, Text>();
        for (p in products.values()) {
          productNameMap.add(p.id, p.name);
        };

        // Build gift article id → name map
        let giftNameMap = Map.empty<Types.GiftArticleId, Text>();
        for (g in giftArticles.values()) {
          giftNameMap.add(g.id, g.name);
        };

        // Build doctor id → DoctorInfo map for fast lookup
        let doctorMap = Map.empty<Types.DoctorId, Types.Doctor>();
        for (d in doctors.values()) {
          doctorMap.add(d.id, d);
        };

        // Filter reports by mrId and date range, then build details
        let details = List.empty<Types.CallReportDetail>();
        for (r in reports.values()) {
          if (r.mrId == mrId) {
            let ts = r.createdAt;
            let inRange = (fromDate == 0 or ts >= fromDate) and
                          (toDate == 0 or ts <= toDate);
            if (inRange) {
              // Build per-doctor visit details
              let visitDetails = List.empty<Types.DoctorVisitDetail>();
              for (visit in r.doctorsVisited.values()) {
                let (dName, dSpec, dCat, dStation) = switch (doctorMap.get(visit.doctorId)) {
                  case (?d) (d.name, d.specialization, "", d.station);
                  case null ("Unknown Doctor", "", "", "");
                };

                // Resolve products discussed
                let productsDetail = List.empty<Types.ProductVisitDetail>();
                for (pid in visit.productIds.values()) {
                  let pName = switch (productNameMap.get(pid)) {
                    case (?n) n;
                    case null "Product #" # pid.toText();
                  };
                  // Find details text for this product, if any
                  let detText = switch (
                    visit.detailsPerProduct.find(
                      func((dpid, _) : (Types.ProductId, Text)) : Bool { dpid == pid }
                    )
                  ) {
                    case (?(_, t)) t;
                    case null "";
                  };
                  productsDetail.add({ productId = pid; productName = pName; detailsDiscussed = detText });
                };

                // Resolve samples
                let samplesDetail = List.empty<Types.SampleGivenDetail>();
                for (sample in visit.samplesDistributed.values()) {
                  let pName = switch (productNameMap.get(sample.productId)) {
                    case (?n) n;
                    case null "Product #" # sample.productId.toText();
                  };
                  samplesDetail.add({ productId = sample.productId; productName = pName; quantity = sample.quantity });
                };

                // Resolve gifts
                let giftsDetail = List.empty<Types.GiftGivenDetail>();
                for (g in visit.giftArticles.values()) {
                  let gName = switch (giftNameMap.get(g.giftArticleId)) {
                    case (?n) n;
                    case null g.giftArticleName;  // fall back to stored name
                  };
                  giftsDetail.add({ articleId = g.giftArticleId; articleName = gName; quantity = g.quantity });
                };

                visitDetails.add({
                  doctorId       = visit.doctorId;
                  doctorName     = dName;
                  specialization = dSpec;
                  category       = dCat;
                  station        = dStation;
                  products       = productsDetail.toArray();
                  samplesGiven   = samplesDetail.toArray();
                  giftsGiven     = giftsDetail.toArray();
                  remarks        = visit.notes;
                });
              };

              details.add({
                reportId     = r.id;
                mrId         = mrId;
                mrName       = mrName;
                date         = r.date;
                submittedAt  = r.createdAt;
                doctorVisits = visitDetails.toArray();
              });
            };
          };
        };

        // Sort newest first (by createdAt descending)
        let sorted = details.sort(
          func(a : Types.CallReportDetail, b : Types.CallReportDetail) : { #less; #equal; #greater } {
            if (a.submittedAt > b.submittedAt) #less
            else if (a.submittedAt < b.submittedAt) #greater
            else #equal
          }
        );
        #ok(sorted.toArray())
      };
    }
  };

};
